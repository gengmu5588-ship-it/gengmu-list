const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new Database(path.join(DATA_DIR, 'vision.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, nickname TEXT NOT NULL,
  password_hash TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'user', avatar TEXT DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS points (
  user_id TEXT PRIMARY KEY, available INTEGER NOT NULL DEFAULT 0,
  frozen INTEGER NOT NULL DEFAULT 0, total_gain INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS point_logs (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, point INTEGER NOT NULL,
  type TEXT NOT NULL, remark TEXT DEFAULT '', relate_id TEXT DEFAULT '', created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_logs_user ON point_logs(user_id, created_at DESC);
CREATE TABLE IF NOT EXISTS sign_records (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, date TEXT NOT NULL, point INTEGER NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(user_id, date)
);
CREATE TABLE IF NOT EXISTS unlock_records (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL, post_id TEXT NOT NULL, cost INTEGER NOT NULL, created_at INTEGER NOT NULL,
  UNIQUE(user_id, post_id)
);
CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY, type TEXT NOT NULL, title TEXT NOT NULL, content TEXT DEFAULT '',
  resource_type TEXT DEFAULT '', netdisk_type TEXT DEFAULT '', link TEXT DEFAULT '', extract_code TEXT DEFAULT '',
  netdisk_pref TEXT DEFAULT '[]',
  reward_point INTEGER NOT NULL DEFAULT 0, unlock_point INTEGER NOT NULL DEFAULT 0,
  user_id TEXT NOT NULL, user_name TEXT DEFAULT '', cover TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending', is_finish INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_posts_status ON posts(status, created_at DESC);
CREATE TABLE IF NOT EXISTS persons (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, tag TEXT DEFAULT '', avatar TEXT DEFAULT '',
  bio TEXT DEFAULT '', baidu_url TEXT DEFAULT '', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY, person_id TEXT DEFAULT '', title TEXT NOT NULL, netdisk_type TEXT DEFAULT '',
  link TEXT DEFAULT '', extract_code TEXT DEFAULT '', content TEXT DEFAULT '', cover TEXT DEFAULT '',
  user_id TEXT NOT NULL, user_name TEXT DEFAULT '', status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_works_person ON works(person_id, status);
CREATE TABLE IF NOT EXISTS articles (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, cover TEXT DEFAULT '', excerpt TEXT DEFAULT '',
  content TEXT DEFAULT '', author TEXT DEFAULT '站长', pinned INTEGER NOT NULL DEFAULT 0,
  views INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS article_comments (
  id TEXT PRIMARY KEY, article_id TEXT NOT NULL, user_id TEXT NOT NULL,
  user_name TEXT DEFAULT '', content TEXT NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_comments_article ON article_comments(article_id, created_at ASC);
CREATE TABLE IF NOT EXISTS banner (
  id TEXT PRIMARY KEY, title TEXT NOT NULL, desc TEXT DEFAULT '', tag TEXT DEFAULT '',
  image TEXT DEFAULT '', sort INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  resource_types TEXT NOT NULL, netdisk_types TEXT NOT NULL, person_tags TEXT NOT NULL
);
`);

// 兼容旧库：补充 netdisk_pref 字段
if (!db.prepare('PRAGMA table_info(posts)').all().some(c => c.name === 'netdisk_pref')) {
  db.exec("ALTER TABLE posts ADD COLUMN netdisk_pref TEXT DEFAULT '[]'");
}

// 兼容旧库：文章网盘链接字段（drive_point 0 = 免费，>0 需积分解锁）
const articleCols = () => db.prepare('PRAGMA table_info(articles)').all().map(c => c.name);
if (!articleCols().includes('drive_type')) db.exec("ALTER TABLE articles ADD COLUMN drive_type TEXT DEFAULT ''");
if (!articleCols().includes('drive_link')) db.exec("ALTER TABLE articles ADD COLUMN drive_link TEXT DEFAULT ''");
if (!articleCols().includes('drive_code')) db.exec("ALTER TABLE articles ADD COLUMN drive_code TEXT DEFAULT ''");
if (!articleCols().includes('drive_point')) db.exec("ALTER TABLE articles ADD COLUMN drive_point INTEGER NOT NULL DEFAULT 0");
if (!articleCols().includes('related_post_id')) db.exec("ALTER TABLE articles ADD COLUMN related_post_id TEXT DEFAULT ''");

const now = Date.now();
const count = n => db.prepare(`SELECT COUNT(*) AS c FROM ${n}`).get().c;

if (count('categories') === 0) {
  db.prepare('INSERT INTO categories (id, resource_types, netdisk_types, person_tags) VALUES (1, ?, ?, ?)').run(
    JSON.stringify(['写真', '影视', '音乐', '壁纸', '素材']),
    JSON.stringify(['百度网盘', '阿里云盘', '夸克网盘', '115网盘']),
    JSON.stringify(['演员', '网红', '歌手', '模特'])
  );
}

if (count('users') === 0) {
  const adminPassword = process.env.ADMIN_PASSWORD || '123456';
  db.prepare('INSERT INTO users (id, username, nickname, password_hash, role, avatar, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), 'admin', '管理员', bcrypt.hashSync(adminPassword, 10), 'admin', '', now);
}

if (count('persons') === 0) {
  const ins = db.prepare('INSERT INTO persons (id, name, tag, avatar, bio, baidu_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)');
  ins.run(crypto.randomUUID(), '示例明星A', '演员', '', '这里可以填写人物简介', '', now);
  ins.run(crypto.randomUUID(), '示例网红B', '网红', '', '这里可以填写人物简介', '', now);
  ins.run(crypto.randomUUID(), '示例歌手C', '歌手', '', '这里可以填写人物简介', '', now);
}

if (count('articles') === 0) {
  const ins = db.prepare('INSERT INTO articles (id, title, cover, excerpt, content, author, pinned, views, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
  ins.run(crypto.randomUUID(), '2025年度最值得收藏的高清图集精选', '',
    '从上千套图集中筛选出的年度精选，附下载与整理方式。',
    '<p>这里是文章正文，可在后台编辑。</p>', '站长', 1, 0, now);
  ins.run(crypto.randomUUID(), '网盘资源搜索技巧全攻略', '',
    '学会这几招，找资源不再靠运气。',
    '<p>这里是文章正文，可在后台编辑。</p>', '站长', 0, 0, now);
  ins.run(crypto.randomUUID(), '新人必读：积分体系与解锁指南', '',
    '签到、悬赏、解锁，一次讲清楚。',
    '<p>这里是文章正文，可在后台编辑。</p>', '站长', 0, 0, now);
}

if (count('banner') === 0) {
  const ins = db.prepare('INSERT INTO banner (id, title, desc, tag, image, sort) VALUES (?, ?, ?, ?, ?, ?)');
  ins.run(crypto.randomUUID(), '欢迎来到视觉社', '资源信息交流社区，每日签到领积分', '新手上路', '', 0);
  ins.run(crypto.randomUUID(), '每日签到赚积分', '100-200随机积分，解锁海量优质资源', '签到活动', '', 1);
}

function addPoints(userId, availableDelta, frozenDelta = 0) {
  const p = db.prepare('SELECT * FROM points WHERE user_id = ?').get(userId);
  if (!p) {
    db.prepare('INSERT INTO points (user_id, available, frozen, total_gain) VALUES (?, ?, ?, ?)')
      .run(userId, Math.max(0, availableDelta), Math.max(0, frozenDelta), Math.max(0, availableDelta));
    return;
  }
  db.prepare('UPDATE points SET available = ?, frozen = ?, total_gain = ? WHERE user_id = ?')
    .run(Math.max(0, p.available + availableDelta), Math.max(0, p.frozen + frozenDelta),
      p.total_gain + (availableDelta > 0 ? availableDelta : 0), userId);
}

function addLog(userId, point, type, remark = '', relateId = '') {
  db.prepare('INSERT INTO point_logs (id, user_id, point, type, remark, relate_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(crypto.randomUUID(), userId, point, type, remark, relateId, Date.now());
}

module.exports = { db, addPoints, addLog };
