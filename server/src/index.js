const path = require('path');
const crypto = require('crypto');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db, addPoints, addLog } = require('./db');

const PORT = parseInt(process.env.PORT || '3100', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'vision-she-dev-secret-change-me';
const PUBLIC_DIR = process.env.PUBLIC_DIR || path.join(__dirname, '..', '..');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

const now = () => Date.now();
const sign = user => jwt.sign({ uid: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
const safeUser = u => u && ({ id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar || '', role: u.role });
const getPoints = uid => db.prepare('SELECT available, frozen, total_gain AS totalGain FROM points WHERE user_id = ?').get(uid)
  || { available: 0, frozen: 0, totalGain: 0 };

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: '请先登录' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: '账号不存在' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: '登录状态已失效' });
  }
}
function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (token) {
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid) || null;
    } catch { req.user = null; }
  }
  next();
}
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ error: '无管理员权限' });
  next();
}

const categoriesOut = () => {
  const row = db.prepare('SELECT * FROM categories WHERE id = 1').get();
  return {
    resourceTypes: JSON.parse(row.resource_types),
    netdiskTypes: JSON.parse(row.netdisk_types),
    personTags: JSON.parse(row.person_tags),
  };
};
const mapArticle = a => ({
  id: a.id, title: a.title, cover: a.cover, excerpt: a.excerpt, content: a.content,
  author: a.author, pinned: !!a.pinned, views: a.views, createdAt: a.created_at,
  driveType: a.drive_type || '', driveLink: a.drive_link || '', driveCode: a.drive_code || '',
  drivePoint: a.drive_point || 0, relatedPostId: a.related_post_id || '',
});
const mapPerson = p => ({ id: p.id, name: p.name, tag: p.tag, avatar: p.avatar, bio: p.bio, baiduUrl: p.baidu_url });
const mapWork = w => ({
  id: w.id, personId: w.person_id, title: w.title, netdiskType: w.netdisk_type, link: w.link,
  extractCode: w.extract_code, content: w.content, cover: w.cover, userId: w.user_id,
  userName: w.user_name, status: w.status, createdAt: w.created_at,
});
const parsePref = v => { try { const a = JSON.parse(v || '[]'); return Array.isArray(a) ? a : []; } catch { return []; } };
const mapLog = l => ({ id: l.id, userId: l.user_id, point: l.point, type: l.type, remark: l.remark, relateId: l.relate_id, createdAt: l.created_at });
const mapSign = r => ({ id: r.id, userId: r.user_id, date: r.date, point: r.point, createdAt: r.created_at });
const mapPost = p => ({
  id: p.id, type: p.type, title: p.title, content: p.content, resourceType: p.resource_type,
  netdiskType: p.netdisk_type, netdiskPref: parsePref(p.netdisk_pref), link: p.link, extractCode: p.extract_code,
  rewardPoint: p.reward_point, unlockPoint: p.unlock_point, userId: p.user_id,
  userName: p.user_name, cover: p.cover, status: p.status, isFinish: !!p.is_finish,
  views: p.views, createdAt: p.created_at,
});

function unlockedSet(userId) {
  if (!userId) return new Set();
  return new Set(db.prepare('SELECT post_id FROM unlock_records WHERE user_id = ?').all(userId).map(r => r.post_id));
}
function maskPost(post, user, unlocked) {
  const p = mapPost(post);
  const isOwner = user && user.id === post.user_id;
  const isAdmin = user && user.role === 'admin';
  const unlockedNow = unlocked.has(post.id);
  if (post.type === 'share' && post.unlock_point > 0 && !isOwner && !isAdmin && !unlockedNow) {
    p.link = '';
    p.extractCode = '';
    p.locked = true;
  } else {
    p.locked = false;
  }
  p.unlocked = unlockedNow;
  return p;
}

function maskArticle(a, user, unlocked) {
  const m = mapArticle(a);
  const isAdminUser = user && user.role === 'admin';
  const ok = m.drivePoint <= 0 || isAdminUser || unlocked.has(m.id);
  if (!ok) { m.driveLink = ''; m.driveCode = ''; }
  m.driveLocked = !ok;
  return m;
}

function publicBootstrap(user) {
  const unlocked = unlockedSet(user && user.id);
  const posts = db.prepare("SELECT * FROM posts WHERE status = 'approved' ORDER BY created_at DESC").all()
    .map(p => maskPost(p, user, unlocked));
  const works = db.prepare("SELECT * FROM works WHERE status = 'approved' ORDER BY created_at DESC").all().map(mapWork);
  return {
    articles: db.prepare('SELECT * FROM articles ORDER BY pinned DESC, created_at DESC').all().map(a => maskArticle(a, user, unlocked)),
    persons: db.prepare('SELECT * FROM persons ORDER BY created_at DESC').all().map(mapPerson),
    posts,
    works,
    banner: db.prepare('SELECT * FROM banner ORDER BY sort ASC, rowid ASC').all(),
    categories: categoriesOut(),
  };
}

/* ===== 公共接口 ===== */
app.get('/api/health', (_req, res) => res.json({ ok: true, time: now() }));

// 用户等级：返回 { userId: totalGain }，前端据此计算 V1–V100
app.get('/api/users/levels', (_req, res) => {
  const rows = db.prepare('SELECT user_id AS userId, total_gain AS totalGain FROM points').all();
  const map = {};
  rows.forEach(r => { map[r.userId] = r.totalGain || 0; });
  res.json(map);
});

app.get('/api/bootstrap', optionalAuth, (req, res) => {
  const data = publicBootstrap(req.user);
  if (req.user) {
    data.me = {
      user: safeUser(req.user),
      points: getPoints(req.user.id),
      signedToday: !!db.prepare('SELECT 1 FROM sign_records WHERE user_id = ? AND date = ?')
        .get(req.user.id, new Date().toISOString().slice(0, 10)),
      myUnlocked: [...unlockedSet(req.user.id)],
    };
  }
  res.json(data);
});

app.get('/api/articles/:id', optionalAuth, (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '文章不存在' });
  db.prepare('UPDATE articles SET views = views + 1 WHERE id = ?').run(a.id);
  const article = maskArticle({ ...a, views: a.views + 1 }, req.user, unlockedSet(req.user && req.user.id));
  article.commentCount = db.prepare('SELECT COUNT(*) AS c FROM article_comments WHERE article_id = ?').get(a.id).c;
  if (article.relatedPostId) {
    const rp = db.prepare("SELECT id, title, type FROM posts WHERE id = ? AND status = 'approved'").get(article.relatedPostId);
    if (rp) article.relatedPost = { id: rp.id, title: rp.title, type: rp.type };
    else article.relatedPostId = '';
  }
  res.json(article);
});

/* 文章评论 */
const FIRST_COMMENT_REWARD = 10;
app.get('/api/articles/:id/comments', (req, res) => {
  const a = db.prepare('SELECT id FROM articles WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '文章不存在' });
  const comments = db.prepare(`SELECT id, user_id AS userId, user_name AS userName, content, created_at AS createdAt
    FROM article_comments WHERE article_id = ? ORDER BY created_at ASC, rowid ASC`).all(a.id);
  res.json({ comments, count: comments.length });
});

app.post('/api/articles/:id/comments', auth, (req, res) => {
  const a = db.prepare('SELECT id FROM articles WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '文章不存在' });
  const content = String((req.body || {}).content || '').trim().slice(0, 500);
  if (!content) return res.status(400).json({ error: '评论内容不能为空' });
  const countBefore = db.prepare('SELECT COUNT(*) AS c FROM article_comments WHERE article_id = ?').get(a.id).c;
  let rewarded = false;
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO article_comments (id, article_id, user_id, user_name, content, created_at)
      VALUES (?, ?, ?, ?, ?, ?)`)
      .run(crypto.randomUUID(), a.id, req.user.id, req.user.nickname, content, now());
    if (countBefore === 0) {
      rewarded = true;
      addPoints(req.user.id, FIRST_COMMENT_REWARD);
      addLog(req.user.id, FIRST_COMMENT_REWARD, 'first_comment', '文章首评奖励', a.id);
    }
  });
  tx();
  res.json({ ok: true, rewarded, reward: rewarded ? FIRST_COMMENT_REWARD : 0, points: getPoints(req.user.id) });
});

app.delete('/api/admin/comments/:id', auth, adminOnly, (req, res) => {
  const r = db.prepare('DELETE FROM article_comments WHERE id = ?').run(req.params.id);
  if (!r.changes) return res.status(404).json({ error: '评论不存在' });
  res.json({ ok: true });
});

/* 文章网盘链接解锁（drive_point > 0 时消耗积分，复用 unlock_records） */
app.post('/api/articles/:id/unlock', auth, (req, res) => {
  const a = db.prepare('SELECT * FROM articles WHERE id = ?').get(req.params.id);
  if (!a) return res.status(404).json({ error: '文章不存在' });
  if (!a.drive_link) return res.status(400).json({ error: '该文章没有配置网盘链接' });
  const already = db.prepare('SELECT 1 FROM unlock_records WHERE user_id = ? AND post_id = ?').get(req.user.id, a.id);
  if ((a.drive_point || 0) <= 0 || req.user.role === 'admin' || already) {
    return res.json({ link: a.drive_link, extractCode: a.drive_code, points: getPoints(req.user.id) });
  }
  const cost = a.drive_point;
  const p = getPoints(req.user.id);
  if (p.available < cost) return res.status(400).json({ error: `积分不足，需要 ${cost} 积分` });
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO unlock_records (id, user_id, post_id, cost, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), req.user.id, a.id, cost, now());
    addPoints(req.user.id, -cost);
    addLog(req.user.id, -cost, 'unlock_article', `解锁文章网盘 - ${a.title}`, a.id);
  });
  tx();
  res.json({ link: a.drive_link, extractCode: a.drive_code, points: getPoints(req.user.id) });
});

app.get('/api/persons/:id', optionalAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM persons WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: '人物不存在' });
  const works = db.prepare("SELECT * FROM works WHERE person_id = ? AND status = 'approved' ORDER BY created_at DESC").all(p.id).map(mapWork);
  res.json({ ...mapPerson(p), works });
});

app.get('/api/posts/:id', optionalAuth, (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: '帖子不存在' });
  const isOwner = req.user && req.user.id === p.user_id;
  const isAdmin = req.user && req.user.role === 'admin';
  if (p.status !== 'approved' && !isOwner && !isAdmin) return res.status(404).json({ error: '帖子不存在' });
  db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(p.id);
  res.json(maskPost({ ...p, views: p.views + 1 }, req.user, unlockedSet(req.user && req.user.id)));
});

/* ===== 认证 ===== */
app.post('/api/auth/register', (req, res) => {
  const { username, password, nickname } = req.body || {};
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(String(username || ''))) return res.status(400).json({ error: '用户名需为 3-20 位字母、数字或下划线' });
  if (String(password || '').length < 6) return res.status(400).json({ error: '密码至少 6 位' });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return res.status(409).json({ error: '用户名已被注册' });
  const id = crypto.randomUUID();
  const nick = String(nickname || username).trim().slice(0, 20) || username;
  const t = now();
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO users (id, username, nickname, password_hash, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, username, nick, bcrypt.hashSync(password, 10), 'user', '', t);
    db.prepare('INSERT INTO points (user_id, available, frozen, total_gain) VALUES (?, 500, 0, 500)').run(id);
    addLog(id, 500, 'register', '新用户注册赠送');
  });
  tx();
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  res.json({ token: sign(user), user: safeUser(user), points: getPoints(id) });
});

app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = db.prepare('SELECT * FROM users WHERE username = ?').get(String(username || ''));
  if (!user || !bcrypt.compareSync(String(password || ''), user.password_hash)) {
    return res.status(401).json({ error: '账号或密码错误' });
  }
  res.json({ token: sign(user), user: safeUser(user), points: getPoints(user.id) });
});

app.get('/api/auth/me', auth, (req, res) => {
  const signedToday = !!db.prepare('SELECT 1 FROM sign_records WHERE user_id = ? AND date = ?')
    .get(req.user.id, new Date().toISOString().slice(0, 10));
  res.json({
    user: safeUser(req.user),
    points: getPoints(req.user.id),
    signedToday,
    myUnlocked: [...unlockedSet(req.user.id)],
    myPosts: db.prepare('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id).map(mapPost),
    logs: db.prepare('SELECT * FROM point_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id).map(mapLog),
    signRecords: db.prepare('SELECT * FROM sign_records WHERE user_id = ? ORDER BY date DESC LIMIT 30').all(req.user.id).map(mapSign),
  });
});

app.post('/api/auth/signin', auth, (req, res) => {
  const date = new Date().toISOString().slice(0, 10);
  if (db.prepare('SELECT 1 FROM sign_records WHERE user_id = ? AND date = ?').get(req.user.id, date)) {
    return res.status(409).json({ error: '今日已签到' });
  }
  const reward = 100 + Math.floor(Math.random() * 101);
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO sign_records (id, user_id, date, point, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), req.user.id, date, reward, now());
    addPoints(req.user.id, reward);
    addLog(req.user.id, reward, 'sign', '每日签到');
  });
  tx();
  res.json({ reward, points: getPoints(req.user.id) });
});

app.patch('/api/auth/profile', auth, (req, res) => {
  const nickname = String((req.body || {}).nickname || '').trim().slice(0, 20);
  const avatar = String((req.body || {}).avatar || '').trim().slice(0, 500);
  if (!nickname) return res.status(400).json({ error: '昵称不能为空' });
  db.prepare('UPDATE users SET nickname = ?, avatar = ? WHERE id = ?').run(nickname, avatar, req.user.id);
  res.json({ user: safeUser({ ...req.user, nickname, avatar }) });
});

/* ===== 用户内容 ===== */
app.post('/api/posts', auth, (req, res) => {
  const b = req.body || {};
  const type = b.type === 'share' ? 'share' : 'demand';
  const title = String(b.title || '').trim().slice(0, 80);
  if (!title) return res.status(400).json({ error: '标题不能为空' });
  const reward = Math.max(0, parseInt(b.rewardPoint, 10) || 0);
  const unlock = Math.max(0, parseInt(b.unlockPoint, 10) || 0);
  const p = getPoints(req.user.id);
  if (type === 'demand' && reward > p.available) return res.status(400).json({ error: '可用积分不足，无法冻结悬赏' });
  if (type === 'share' && unlock > 0 && unlock > 10000) return res.status(400).json({ error: '解锁积分过高' });
  const id = crypto.randomUUID();
  const tx = db.transaction(() => {
    db.prepare(`INSERT INTO posts (id, type, title, content, resource_type, netdisk_type, link, extract_code,
      netdisk_pref, reward_point, unlock_point, user_id, user_name, cover, status, is_finish, views, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 0, 0, ?)`)
      .run(id, type, title, String(b.content || '').slice(0, 2000), String(b.resourceType || ''),
        String(b.netdiskType || ''), String(b.link || ''), String(b.extractCode || ''),
        JSON.stringify(Array.isArray(b.netdiskPref) ? b.netdiskPref : []),
        reward, unlock, req.user.id, req.user.nickname, String(b.cover || ''), now());
    if (type === 'demand' && reward > 0) {
      addPoints(req.user.id, -reward, reward);
      addLog(req.user.id, -reward, 'demand_freeze', `发布悬赏 - ${title}`, id);
    }
  });
  tx();
  res.json({ id, status: 'pending' });
});

app.post('/api/posts/:id/unlock', auth, (req, res) => {
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post || post.status !== 'approved') return res.status(404).json({ error: '帖子不存在' });
  if (post.type !== 'share' || post.unlock_point <= 0) return res.json({ link: post.link, extractCode: post.extract_code });
  if (post.user_id === req.user.id) return res.json({ link: post.link, extractCode: post.extract_code });
  if (db.prepare('SELECT 1 FROM unlock_records WHERE user_id = ? AND post_id = ?').get(req.user.id, post.id)) {
    return res.json({ link: post.link, extractCode: post.extract_code });
  }
  const p = getPoints(req.user.id);
  if (p.available < post.unlock_point) return res.status(400).json({ error: '积分不足' });
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO unlock_records (id, user_id, post_id, cost, created_at) VALUES (?, ?, ?, ?, ?)')
      .run(crypto.randomUUID(), req.user.id, post.id, post.unlock_point, now());
    addPoints(req.user.id, -post.unlock_point);
    addLog(req.user.id, -post.unlock_point, 'unlock_post', `解锁帖子 - ${post.title}`, post.id);
    // 解锁积分归作者所有
    addPoints(post.user_id, post.unlock_point);
    addLog(post.user_id, post.unlock_point, 'unlock_income', `资源被解锁 - ${post.title}`, post.id);
  });
  tx();
  res.json({ link: post.link, extractCode: post.extract_code, points: getPoints(req.user.id) });
});

app.get('/api/my/posts', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM posts WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id).map(mapPost));
});

app.get('/api/my/logs', auth, (req, res) => {
  res.json(db.prepare('SELECT * FROM point_logs WHERE user_id = ? ORDER BY created_at DESC LIMIT 200').all(req.user.id));
});

app.post('/api/works', auth, (req, res) => {
  const b = req.body || {};
  const title = String(b.title || '').trim().slice(0, 80);
  if (!title) return res.status(400).json({ error: '作品标题不能为空' });
  const id = crypto.randomUUID();
  db.prepare(`INSERT INTO works (id, person_id, title, netdisk_type, link, extract_code, content, cover,
    user_id, user_name, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`)
    .run(id, String(b.personId || ''), title, String(b.netdiskType || ''), String(b.link || ''),
      String(b.extractCode || ''), String(b.content || '').slice(0, 2000), String(b.cover || ''),
      req.user.id, req.user.nickname, now());
  res.json({ id, status: 'pending' });
});

/* ===== 管理后台 ===== */
app.get('/api/admin/bootstrap', auth, adminOnly, (req, res) => {
  const posts = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all().map(mapPost);
  const works = db.prepare('SELECT * FROM works ORDER BY created_at DESC').all().map(mapWork);
  const users = db.prepare('SELECT id, username, nickname, avatar, role, created_at FROM users ORDER BY created_at DESC').all()
    .map(u => ({ id: u.id, username: u.username, nickname: u.nickname, avatar: u.avatar, role: u.role, createdAt: u.created_at, points: getPoints(u.id) }));
  res.json({
    articles: db.prepare('SELECT * FROM articles ORDER BY pinned DESC, created_at DESC').all().map(mapArticle),
    posts, persons: db.prepare('SELECT * FROM persons ORDER BY created_at DESC').all().map(mapPerson),
    works, banner: db.prepare('SELECT * FROM banner ORDER BY sort ASC, rowid ASC').all(),
    categories: categoriesOut(), users,
    articleComments: db.prepare(`SELECT c.id, c.article_id AS articleId, c.user_id AS userId,
      c.user_name AS userName, c.content, c.created_at AS createdAt, a.title AS articleTitle
      FROM article_comments c LEFT JOIN articles a ON a.id = c.article_id
      ORDER BY c.created_at DESC LIMIT 200`).all(),
    logs: db.prepare('SELECT * FROM point_logs ORDER BY created_at DESC LIMIT 100').all().map(mapLog),
    stats: {
      posts: posts.length, pendingPosts: posts.filter(p => p.status === 'pending').length,
      users: users.length, persons: count('persons'), works: count('works'),
      pendingWorks: works.filter(w => w.status === 'pending').length,
      openRewards: posts.filter(p => p.type === 'demand' && p.rewardPoint > 0 && !p.isFinish).length,
      frozenTotal: db.prepare('SELECT COALESCE(SUM(frozen),0) AS s FROM points').get().s,
      availableTotal: db.prepare('SELECT COALESCE(SUM(available),0) AS s FROM points').get().s,
    },
  });
});
function count(table) { return db.prepare(`SELECT COUNT(*) AS c FROM ${table}`).get().c; }

app.post('/api/admin/posts/:id/status', auth, adminOnly, (req, res) => {
  const status = req.body && req.body.status;
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: '状态不合法' });
  const r = db.prepare('UPDATE posts SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!r.changes) return res.status(404).json({ error: '帖子不存在' });
  res.json({ ok: true });
});

app.delete('/api/admin/posts/:id', auth, adminOnly, (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: '帖子不存在' });
  const tx = db.transaction(() => {
    if (p.type === 'demand' && p.reward_point > 0 && !p.is_finish) {
      addPoints(p.user_id, p.reward_point, -p.reward_point);
      addLog(p.user_id, p.reward_point, 'demand_unfreeze', `帖子删除退回悬赏 - ${p.title}`, p.id);
    }
    db.prepare('DELETE FROM posts WHERE id = ?').run(p.id);
  });
  tx();
  res.json({ ok: true });
});

app.post('/api/admin/posts/:id/finish', auth, adminOnly, (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  const receiverId = String((req.body || {}).receiverId || '');
  if (!p) return res.status(404).json({ error: '帖子不存在' });
  if (p.is_finish) return res.status(400).json({ error: '已结单' });
  if (p.type !== 'demand' || p.reward_point <= 0) return res.status(400).json({ error: '该帖没有可发放的悬赏' });
  if (receiverId === p.user_id) return res.status(400).json({ error: '不能发放给发帖人自己' });
  if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(receiverId)) return res.status(404).json({ error: '采纳者不存在' });
  const poster = db.prepare('SELECT * FROM points WHERE user_id = ?').get(p.user_id);
  if (!poster || poster.frozen < p.reward_point) return res.status(400).json({ error: `冻结积分不足（当前 ${poster ? poster.frozen : 0}）` });
  const tx = db.transaction(() => {
    addPoints(p.user_id, 0, -p.reward_point);
    addPoints(receiverId, p.reward_point);
    addLog(receiverId, p.reward_point, 'demand_reward', `获得悬赏 - ${p.title}`, p.id);
    db.prepare('UPDATE posts SET is_finish = 1 WHERE id = ?').run(p.id);
  });
  tx();
  res.json({ ok: true });
});

app.post('/api/admin/posts/:id/refund', auth, adminOnly, (req, res) => {
  const p = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!p) return res.status(404).json({ error: '帖子不存在' });
  if (p.is_finish) return res.status(400).json({ error: '已结单' });
  if (p.type !== 'demand' || p.reward_point <= 0) return res.status(400).json({ error: '该帖没有可退回的悬赏' });
  const poster = db.prepare('SELECT * FROM points WHERE user_id = ?').get(p.user_id);
  if (!poster || poster.frozen < p.reward_point) return res.status(400).json({ error: `冻结积分不足（当前 ${poster ? poster.frozen : 0}）` });
  const tx = db.transaction(() => {
    addPoints(p.user_id, p.reward_point, -p.reward_point);
    addLog(p.user_id, p.reward_point, 'demand_unfreeze', `悬赏退回 - ${p.title}`, p.id);
    db.prepare('UPDATE posts SET is_finish = 1 WHERE id = ?').run(p.id);
  });
  tx();
  res.json({ ok: true });
});

app.post('/api/admin/users/:id/points', auth, adminOnly, (req, res) => {
  const delta = parseInt((req.body || {}).delta, 10);
  const remark = String((req.body || {}).remark || '').slice(0, 50);
  if (!Number.isFinite(delta) || delta === 0) return res.status(400).json({ error: '积分变动不能为 0' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!u) return res.status(404).json({ error: '用户不存在' });
  const p = getPoints(u.id);
  if (delta < 0 && p.available < -delta) return res.status(400).json({ error: '扣减数量超过可用积分' });
  const tx = db.transaction(() => {
    addPoints(u.id, delta);
    addLog(u.id, delta, delta > 0 ? 'admin_give' : 'admin_deduct', remark || (delta > 0 ? '管理员发放' : '管理员扣减'));
  });
  tx();
  res.json({ points: getPoints(u.id) });
});

/* 管理后台内容 CRUD */
function crudRoutes(name, table, mapToRow, mapFromRow) {
  app.post(`/api/admin/${name}`, auth, adminOnly, (req, res) => {
    const row = mapToRow(req.body || {});
    if (!row.id) row.id = crypto.randomUUID();
    const cols = Object.keys(row);
    db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`)
      .run(...cols.map(c => row[c]));
    res.json({ id: row.id });
  });
  app.put(`/api/admin/${name}/:id`, auth, adminOnly, (req, res) => {
    const row = mapToRow(req.body || {});
    const cols = Object.keys(row).filter(c => c !== 'id');
    if (!cols.length) return res.status(400).json({ error: '无更新字段' });
    const r = db.prepare(`UPDATE ${table} SET ${cols.map(c => `${c} = ?`).join(', ')} WHERE id = ?`)
      .run(...cols.map(c => row[c]), req.params.id);
    if (!r.changes) return res.status(404).json({ error: '记录不存在' });
    res.json({ ok: true });
  });
  app.delete(`/api/admin/${name}/:id`, auth, adminOnly, (req, res) => {
    const r = db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(req.params.id);
    if (!r.changes) return res.status(404).json({ error: '记录不存在' });
    res.json({ ok: true });
  });
}

crudRoutes('persons', 'persons', b => ({
  id: b.id, name: String(b.name || '').trim(), tag: String(b.tag || ''), avatar: String(b.avatar || ''),
  bio: String(b.bio || ''), baidu_url: String(b.baiduUrl || b.baidu_url || ''), created_at: b.createdAt || now(),
}), mapPerson);

crudRoutes('articles', 'articles', b => ({
  id: b.id, title: String(b.title || '').trim(), cover: String(b.cover || ''), excerpt: String(b.excerpt || ''),
  content: String(b.content || ''), author: String(b.author || '站长'), pinned: b.pinned ? 1 : 0,
  views: b.views || 0, created_at: b.createdAt || now(),
  drive_type: String(b.driveType || b.drive_type || ''), drive_link: String(b.driveLink || b.drive_link || ''),
  drive_code: String(b.driveCode || b.drive_code || ''), drive_point: Math.max(0, parseInt(b.drivePoint ?? b.drive_point, 10) || 0),
  related_post_id: String(b.relatedPostId || b.related_post_id || ''),
}), mapArticle);

crudRoutes('banner', 'banner', b => ({
  id: b.id, title: String(b.title || '').trim(), desc: String(b.desc || ''), tag: String(b.tag || ''),
  image: String(b.image || ''), sort: parseInt(b.sort, 10) || 0,
}), b => b);

crudRoutes('works', 'works', b => ({
  id: b.id, person_id: String(b.personId || ''), title: String(b.title || '').trim(),
  netdisk_type: String(b.netdiskType || ''), link: String(b.link || ''), extract_code: String(b.extractCode || ''),
  content: String(b.content || ''), cover: String(b.cover || ''), user_id: String(b.userId || 'admin'),
  user_name: String(b.userName || '管理员'), status: String(b.status || 'approved'), created_at: b.createdAt || now(),
}), mapWork);

app.post('/api/admin/works/:id/status', auth, adminOnly, (req, res) => {
  const status = (req.body || {}).status;
  if (!['approved', 'rejected', 'pending'].includes(status)) return res.status(400).json({ error: '状态不合法' });
  const r = db.prepare('UPDATE works SET status = ? WHERE id = ?').run(status, req.params.id);
  if (!r.changes) return res.status(404).json({ error: '作品不存在' });
  res.json({ ok: true });
});

app.put('/api/admin/categories', auth, adminOnly, (req, res) => {
  const b = req.body || {};
  db.prepare('UPDATE categories SET resource_types = ?, netdisk_types = ?, person_tags = ? WHERE id = 1')
    .run(JSON.stringify(Array.isArray(b.resourceTypes) ? b.resourceTypes : []),
      JSON.stringify(Array.isArray(b.netdiskTypes) ? b.netdiskTypes : []),
      JSON.stringify(Array.isArray(b.personTags) ? b.personTags : []));
  res.json({ categories: categoriesOut() });
});

/* ===== 静态站点 ===== */
app.use(express.static(PUBLIC_DIR, {
  extensions: ['html'],
  maxAge: '1h',
  setHeaders(res, filePath) {
    if (/\.html?$/i.test(filePath)) res.setHeader('Cache-Control', 'no-cache');
  }
}));
app.use('/api', (_req, res) => res.status(404).json({ error: '接口不存在' }));
app.use((_req, res) => res.status(404).send('Not Found'));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`Vision-She server listening on 127.0.0.1:${PORT}, public=${PUBLIC_DIR}`);
});
