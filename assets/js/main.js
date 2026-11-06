/* ============================================
   视觉社 · 核心应用逻辑
   数据由后端 API 提供（/api/*），前端内存缓存
   ============================================ */

const App = (() => {
  // ===== 数据层 =====
  const TOKEN_KEY = 'vision_token';
  // 默认缩略图（后台可覆盖配置），论坛列表无自定义缩略图时使用
  const DEFAULT_THUMB = 'https://img.cdn1.vip/i/6aec4bef86be6_1793870831.webp';
  const CACHE = {
    articles: [], posts: [], persons: [], works: [], banner: [],
    categories: { resourceTypes: [], netdiskTypes: [], personTags: [] },
    settings: { defaultThumb: DEFAULT_THUMB },
    me: null, articleDetail: null, postDetail: null, articleComments: null,
    postComments: null, lbPreview: null, checkin: null, levelPoints: {}
  };
  const defaultThumb = () => (CACHE.settings && CACHE.settings.defaultThumb) || DEFAULT_THUMB;
  const postThumb = p => (p && p.thumb) || defaultThumb();

  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY); }

  async function api(path, options = {}) {
    const headers = Object.assign({}, options.headers || {});
    if (options.body !== undefined && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(path, Object.assign({}, options, { headers }));
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok) {
      if (res.status === 401) { setToken(''); CACHE.me = null; }
      throw new Error((data && data.error) || `请求失败（${res.status}）`);
    }
    return data;
  }

  async function loadBootstrap() {
    const data = await api('/api/bootstrap');
    CACHE.articles = data.articles || [];
    CACHE.posts = data.posts || [];
    CACHE.persons = data.persons || [];
    CACHE.works = data.works || [];
    CACHE.banner = data.banner || [];
    CACHE.categories = data.categories || CACHE.categories;
    CACHE.settings = data.settings || { defaultThumb: DEFAULT_THUMB };
    CACHE.me = data.me || null;
  }

  async function loadMe() {
    if (!getToken()) { CACHE.me = null; return; }
    try {
      const data = await api('/api/auth/me');
      CACHE.me = {
        user: data.user,
        email: data.email || null,
        mustChangePwd: !!data.mustChangePwd,
        points: data.points,
        signedToday: !!data.signedToday,
        signDays: data.signDays || 0,
        signStreak: data.signStreak || 0,
        myUnlocked: data.myUnlocked || [],
        myPosts: data.myPosts || [],
        logs: data.logs || [],
        signRecords: data.signRecords || []
      };
    } catch { CACHE.me = null; }
  }

  async function refresh() { await loadBootstrap(); await loadMe(); }

  // 拉取全部用户的累计积分（用于展示等级图标），缓存到 CACHE.levelPoints
  async function loadUserLevels() {
    try {
      const map = await api('/api/users/levels');
      if (map && typeof map === 'object') CACHE.levelPoints = map;
    } catch (e) { /* 等级图标降级为 V1，不影响主流程 */ }
  }

  // 仅保留读取接口，所有写入统一走后端 API
  function getDB(k) { return CACHE[k] || []; }
  function setDB() {}
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }


  // ===== 初始化种子数据 =====
  function initSeedData() {
    // 推荐文章
    if (!localStorage.getItem('articles')) {
      setDB('articles', [
        {
          id: uid(), title: '2025年度最值得收藏的高清图集精选', cover: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=beautiful%20photography%20gallery%20cover%20dark%20theme&image_size=landscape_16_9',
          content: '<h2>精品图集推荐</h2><p>这里收录了社区中最受欢迎的高清图集资源，涵盖影视、动漫、写真等多个领域。所有资源均由网友投稿并经过人工审核。</p><p>积分解锁机制保护了投稿者的劳动成果，也让真正有价值的内容得到回报。</p>',
          excerpt: '社区精选年度高清图集，覆盖影视/动漫/写真等多领域', pinned: true, author: '站长', views: 1234, createdAt: Date.now() - 86400000 * 3
        },
        {
          id: uid(), title: '网盘资源搜索技巧全攻略', cover: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=cloud%20storage%20digital%20network%20abstract&image_size=landscape_16_9',
          content: '<h2>搜索技巧</h2><p>分享一些实用的网盘搜索与资源整理技巧。</p>',
          excerpt: '分享百度/阿里/夸克网盘高效搜索资源的实用方法', pinned: false, author: '站长', views: 856, createdAt: Date.now() - 86400000 * 2
        },
        {
          id: uid(), title: '新人必读：积分体系与解锁指南', cover: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=gold%20coins%20points%20reward%20game%20ui&image_size=landscape_16_9',
          content: '<h2>积分指南</h2><p>详细介绍视觉社的积分获取与使用方式。</p>',
          excerpt: '每日签到/悬赏分享/积分解锁/三种管理员发放模式全解析', pinned: false, author: '站长', views: 567, createdAt: Date.now() - 86400000
        }
      ]);
    }

    // 分类
    if (!localStorage.getItem('categories')) {
      setDB('categories', {
        resourceTypes: ['影视', '音乐', '教程', '软件', '电子书', '素材', '其他'],
        netdiskTypes: ['百度网盘', '阿里云盘', '夸克网盘'],
        personTags: ['网红', '演员', '歌手', '模特', 'UP主', '运动员']
      });
    }

    // Banner
    if (!localStorage.getItem('banner')) {
      setDB('banner', [
        { id: uid(), title: '欢迎来到视觉社', desc: '资源信息交流社区，每日签到领积分', tag: '新手上路', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=dark%20purple%20gradient%20website%20banner%20modern&image_size=landscape_16_9' },
        { id: uid(), title: '每日签到赚积分', desc: '100-200随机积分，解锁海量优质资源', tag: '签到活动', image: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=golden%20coins%20treasure%20chest%20glow&image_size=landscape_16_9' }
      ]);
    }

    // 姬查查人物
    if (!localStorage.getItem('persons')) {
      setDB('persons', [
        { id: uid(), name: '示例明星A', tag: '演员', avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=portrait%20avatar%20actor%20headshot&image_size=square', bio: '这里可以填写人物简介', baiduUrl: '' },
        { id: uid(), name: '示例网红B', tag: '网红', avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=portrait%20avatar%20influencer%20creator&image_size=square', bio: '这里可以填写人物简介', baiduUrl: '' },
        { id: uid(), name: '示例歌手C', tag: '歌手', avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=portrait%20avatar%20singer%20musician&image_size=square', bio: '这里可以填写人物简介', baiduUrl: '' },
      ]);
    }

    // 示例帖子
    if (!localStorage.getItem('posts')) {
      const now = Date.now();
      setDB('posts', [
        // 求资源
        { id: uid(), type: 'demand', title: '求某高清修复版电影资源', content: '找了很久没找到，希望有大佬帮忙', resourceType: '影视', netdiskPref: ['百度网盘', '阿里云盘'], rewardPoint: 300, userId: 'demo', userName: '求片小哥', status: 'approved', isFinish: false, createdAt: now - 3600000 * 5 },
        { id: uid(), type: 'demand', title: '求Python编程入门教程全套', content: '想系统学习Python，求推荐好教程', resourceType: '教程', netdiskPref: ['不限'], rewardPoint: 100, userId: 'demo', userName: '学习中的小明', status: 'approved', isFinish: false, createdAt: now - 3600000 * 12 },
        // 我分享
        { id: uid(), type: 'share', title: '分享：XX设计素材包2025完整版', content: '包含PSD/AI/SVG等多种格式，总计50G+网盘资源', resourceType: '素材', netdiskType: '百度网盘', link: 'https://pan.baidu.com/s/xxxxx', extractCode: 'abcd', unlockPoint: 200, userId: 'demo', userName: '素材达人', cover: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=design%20assets%20creative%20software%20dark&image_size=landscape_16_9', status: 'approved', createdAt: now - 86400000 },
        { id: uid(), type: 'share', title: '免费分享：经典老歌精选合集', content: '80/90年代经典歌曲精选，FLAC无损格式', resourceType: '音乐', netdiskType: '夸克网盘', link: 'https://pan.quark.cn/s/xxxxx', extractCode: '', unlockPoint: 0, userId: 'demo', userName: '音乐爱好者', cover: 'https://trae-api-cn.mchost.guru/api/ide/v1/tool_text_to_image?prompt=music%20vinyl%20records%20collection%20dark&image_size=landscape_16_9', status: 'approved', createdAt: now - 86400000 * 2 },
      ]);
    }

    // 用户表
    if (!localStorage.getItem('users')) {
      setDB('users', []);
    }
    if (!localStorage.getItem('userPoints')) {
      setDB('userPoints', []);
    }
    if (!localStorage.getItem('pointLogs')) {
      setDB('pointLogs', []);
    }
    if (!localStorage.getItem('signRecords')) {
      setDB('signRecords', []);
    }
    if (!localStorage.getItem('unlockRecords')) {
      setDB('unlockRecords', []);
    }
  }

  // ===== 用户系统 =====
  function getCurrentUser() { return CACHE.me ? CACHE.me.user : null; }

  function isAdmin() {
    const u = getCurrentUser();
    return !!u && u.role === 'admin';
  }

  function getUserPoints() {
    return CACHE.me ? CACHE.me.points : { available: 0, frozen: 0, totalGain: 0 };
  }

  // ===== 等级系统（V1–V100，按累计积分 totalGain 计算）=====
  // 经验曲线：V(L) 上限 = 200 × L² 积分，即 L = floor(sqrt(P/200)) + 1，封顶 100
  const LEVEL_TIERS = [
    { name: '青铜', c1: '#d39a5e', c2: '#8a5a2b' },
    { name: '白银', c1: '#e6edf1', c2: '#9aa9b1' },
    { name: '黄金', c1: '#ffd86b', c2: '#d99b1c' },
    { name: '铂金', c1: '#8fe9dc', c2: '#2fa6a0' },
    { name: '钻石', c1: '#88bdff', c2: '#3a6fd8' },
    { name: '星耀', c1: '#c79bff', c2: '#7a3fe0' },
    { name: '大师', c1: '#ff9bb0', c2: '#e74d6b' },
    { name: '宗师', c1: '#ffc07a', c2: '#ff7a18' },
    { name: '王者', c1: '#ffcf6b', c2: '#ff4d4d' },
    { name: '传奇', c1: '#a8f5cf', c2: '#c9a227' },
  ];

  function getLevel(points) {
    const p = Math.max(0, Number(points) || 0);
    const L = Math.floor(Math.sqrt(p / 200)) + 1;
    return Math.min(100, Math.max(1, L));
  }

  function getLevelMeta(level) {
    level = Math.min(100, Math.max(1, level));
    const tierIdx = Math.floor((level - 1) / 10); // 0..9
    const tier = LEVEL_TIERS[tierIdx];
    const inner = ((level - 1) % 10) + 1; // 1..10（段位内进度）
    return { level, tierIdx: tierIdx + 1, tierName: tier.name, c1: tier.c1, c2: tier.c2, inner };
  }

  function levelLabel(level) { return 'V' + Math.min(100, Math.max(1, level)); }

  // 当前登录用户的等级（基于累计积分）
  function getCurrentUserLevel() {
    const pts = (getUserPoints() && getUserPoints().totalGain) || 0;
    return getLevel(pts);
  }

  // 根据用户 id 查询等级（依赖 CACHE.levelPoints 映射，缺失时按 V1 处理）
  function getLevelPointsForUser(userId) {
    if (!userId) return 0;
    const m = CACHE.levelPoints || {};
    return m[userId] || 0;
  }
  function getLevelForUser(userId) { return getLevel(getLevelPointsForUser(userId)); }

  // 生成内联 SVG 等级图标（跟随昵称展示）
  let _lvUid = 0;
  // 生成内联 SVG 等级徽章：段位配色圆角矩形 + 等级文字（如 Lv 7），不展示段位名
  // 横向修长比例（viewBox 46x18 ≈ 2.5:1），徽章高度明显小于昵称文字
  function renderLevelBadge(level, opts) {
    opts = opts || {};
    const h = opts.size || 13;            // 徽章高度（明显小于昵称文字）
    const w = Math.round(h * 2.3);        // 横向修长圆角矩形宽度
    const m = getLevelMeta(level);
    const gid = 'lvG' + (++_lvUid);
    const label = 'Lv ' + m.level;        // 如 Lv 7 / Lv 100
    const fs = label.length > 4 ? 8 : 10; // 位数多时收小字号
    const baseY = (9 + 0.36 * fs).toFixed(1); // viewBox 高 18，文字垂直居中
    return `<svg class="lv-badge-svg" width="${w}" height="${h}" viewBox="0 0 46 18" `
      + `role="img" aria-label="Lv ${m.level} ${m.tierName}" `
      + `style="vertical-align:middle;flex:0 0 auto;" `
      + `title="Lv ${m.level} · ${m.tierName}"><defs>`
      + `<linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">`
      + `<stop offset="0" stop-color="${m.c1}"/><stop offset="1" stop-color="${m.c2}"/></linearGradient></defs>`
      + `<rect x="1" y="1" width="44" height="16" rx="4.5" ry="4.5" fill="url(#${gid})"/>`
      + `<text x="23" y="${baseY}" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" `
      + `font-size="${fs}" font-weight="800" fill="#fff" letter-spacing="0.2" `
      + `style="paint-order:stroke;stroke:rgba(0,0,0,.22);stroke-width:.5px;">${label}</text></svg>`;
  }

  // 昵称 + 等级图标组合（用 flex 包裹，保证昵称与徽章严格垂直居中）
  function renderNameWithLevel(name, level, opts) {
    opts = opts || {};
    const lv = Number(level) || 0;
    const cls = opts.nameClass || 'uname';
    const safeName = escapeHtml(name || '匿名');
    if (!lv) return `<span class="${cls}">${safeName}</span>`;
    return `<span class="lv-pair"><span class="${cls}">${safeName}</span>${renderLevelBadge(lv, opts)}</span>`;
  }


  // ===== 签到系统 =====
  async function doSignin() {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }
    if (hasSignedToday()) { toast('今日已签到，明天再来吧', 'warning'); return; }

    try {
      const r = await api('/api/auth/signin', { method: 'POST', body: '{}' });
      await loadMe();
      showSigninResult(r.reward, r.streak);
      renderNav();
      render();
      loadLbPreview().then(() => { if (currentRoute === 'home') render(); });
      if (currentRoute === 'checkin') loadCheckin(checkinPage).then(() => render());
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function hasSignedToday() { return !!(CACHE.me && CACHE.me.signedToday); }

  function showSigninResult(point, streak) {
    const modal = openModal(`
      <div class="signin-result">
        <div class="signin-result-icon"><i class="fas fa-gift"></i></div>
        <div class="signin-result-title">🎉 签到成功！</div>
        <div class="signin-result-points">+${point}</div>
        <div class="signin-result-sub">${streak > 1 ? `已连续签到 ${streak} 天，明天继续！` : '今日已获得签到积分'}</div>
      </div>
    `, { hideFooter: true, hideClose: true });
    setTimeout(() => closeModal(modal), 2000);
  }

  /* 排行榜（首页侧栏预览） */
  async function loadLbPreview() {
    try {
      CACHE.lbPreview = await api('/api/signin/leaderboard?page=1&pageSize=5');
    } catch { CACHE.lbPreview = null; }
    return CACHE.lbPreview;
  }

  // ===== 导航 =====
  let currentRoute = 'home';
  let searchQuery = '';
  let searchFrom = 'home';
  let searchTimer = null;
  let checkinPage = 1;
  const CHECKIN_PAGE_SIZE = 20;

  function navigate(route) {
    currentRoute = route;
    // 手动切换栏目时清空搜索态，避免列表被旧关键词过滤
    if (route !== 'search') {
      searchQuery = '';
      const si = document.getElementById('navSearchInput');
      if (si) si.value = '';
    }
    const links = document.querySelectorAll('.nav-link');
    const activeRoute = route === 'checkin' ? 'home' : route;
    links.forEach(l => l.classList.toggle('active', l.dataset.route === activeRoute));

    const root = document.getElementById('appRoot');
    root.classList.remove('fade-in');
    void root.offsetWidth;
    root.classList.add('fade-in');

    render();
    if (route === 'profile' && getToken()) {
      loadMe().then(() => { if (currentRoute === 'profile') { renderNav(); render(); } }).catch(() => {});
    }
    if (route === 'checkin') loadCheckin(checkinPage).then(() => { if (currentRoute === 'checkin') render(); });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
  }

  function handleSearch(q) {
    const val = String(q || '');
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => runSearch(val), 180);
  }

  function searchNow(q) {
    clearTimeout(searchTimer);
    runSearch(q === undefined ? (document.getElementById('navSearchInput') || {}).value || '' : q);
  }

  function runSearch(val) {
    searchQuery = String(val || '').trim().toLowerCase();
    if (searchQuery) {
      if (currentRoute !== 'search') searchFrom = currentRoute;
      currentRoute = 'search';
      render();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    } else if (currentRoute === 'search') {
      currentRoute = searchFrom || 'home';
      render();
      document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.route === currentRoute));
    }
  }

  // ===== 渲染主入口 =====
  function render() {
    renderNav();
    const root = document.getElementById('appRoot');

    switch (currentRoute) {
      case 'home': root.innerHTML = renderHome(); break;
      case 'forum': root.innerHTML = renderForum(); break;
      case 'jicha': root.innerHTML = renderJicha(); break;
      case 'profile': root.innerHTML = renderProfile(); break;
      case 'article': root.innerHTML = renderArticle(); break;
      case 'postDetail': root.innerHTML = renderPostDetail(); break;
      case 'personDetail': root.innerHTML = renderPersonDetail(); break;
      case 'workDetail': root.innerHTML = renderWorkDetail(); break;
      case 'checkin': root.innerHTML = renderCheckin(); break;
      case 'featured': root.innerHTML = renderFeatured(); break;
      case 'search': root.innerHTML = renderSearch(); break;
      case 'about': root.innerHTML = renderAbout(); break;
      default: root.innerHTML = renderHome();
    }

    // 绑定事件
    bindRouteEvents();
  }

  function renderNav() {
    const user = getCurrentUser();
    const points = user ? getUserPoints(user.id) : { available: 0 };
    document.getElementById('navPoints').textContent = points.available;

    const signinBtn = document.getElementById('navSigninBtn');
    if (hasSignedToday()) {
      signinBtn.classList.add('done');
      signinBtn.innerHTML = '<i class="fas fa-check"></i> 已签到';
    } else {
      signinBtn.classList.remove('done');
      signinBtn.innerHTML = '<i class="fas fa-calendar-check"></i> 签到';
    }

    const userArea = document.getElementById('userArea');
    if (user) {
      const initial = user.nickname ? user.nickname.charAt(0).toUpperCase() : 'U';
      userArea.innerHTML = `
        <div class="dropdown" style="position:relative;">
          <button class="user-toggle" onclick="App.toggleUserMenu(event)">
            <div class="user-avatar" style="width:28px;height:28px;border-radius:50%;background:var(--gradient-primary);display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:white;">${initial}</div>
            ${renderNameWithLevel(user.nickname || '用户', getCurrentUserLevel(), { nameClass: 'user-name', size: 14 })}
            <i class="fas fa-chevron-down" style="font-size:0.6rem;color:var(--color-text-muted);"></i>
          </button>
        </div>
      `;
    } else {
      userArea.innerHTML = `<button class="btn btn-primary btn-sm" onclick="App.showLoginModal()">登录</button>`;
    }
  }

  function toggleUserMenu(e) {
    e.stopPropagation();
    const existing = document.getElementById('userDropdown');
    if (existing) { existing.remove(); return; }

    const menu = document.createElement('div');
    menu.id = 'userDropdown';
    menu.style.cssText = 'position:absolute;top:calc(100% + 0.5rem);right:0;background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-md);min-width:160px;padding:0.25rem 0;z-index:100;box-shadow:var(--shadow-lg);';
    menu.innerHTML = `
      <button class="dropdown-item" onclick="App.navigate('profile');document.getElementById('userDropdown')?.remove()" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.625rem 1rem;background:none;border:none;color:var(--color-text);font-size:0.875rem;cursor:pointer;text-align:left;">
        <i class="fas fa-user" style="color:var(--color-primary);width:16px;"></i>用户中心
      </button>
      <button class="dropdown-item" onclick="App.doSignin();document.getElementById('userDropdown')?.remove()" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.625rem 1rem;background:none;border:none;color:var(--color-text);font-size:0.875rem;cursor:pointer;text-align:left;">
        <i class="fas fa-calendar-check" style="color:var(--color-primary);width:16px;"></i>每日签到
      </button>
      <div style="height:1px;background:var(--color-border);margin:0.25rem 0;"></div>
      ${isAdmin() ? `<button class="dropdown-item" onclick="location.href='admin/'" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.625rem 1rem;background:none;border:none;color:var(--color-text);font-size:0.875rem;cursor:pointer;text-align:left;"><i class="fas fa-cog" style="color:var(--color-warning);width:16px;"></i>后台管理</button>` : ''}
      <button class="dropdown-item" onclick="App.logout()" style="display:flex;align-items:center;gap:0.5rem;width:100%;padding:0.625rem 1rem;background:none;border:none;color:var(--color-danger);font-size:0.875rem;cursor:pointer;text-align:left;">
        <i class="fas fa-sign-out-alt" style="width:16px;"></i>退出登录
      </button>
    `;

    e.currentTarget.parentElement.appendChild(menu);
    setTimeout(() => {
      const closeHandler = (ev) => {
        if (!menu.contains(ev.target)) {
          menu.remove();
          document.removeEventListener('click', closeHandler);
        }
      };
      document.addEventListener('click', closeHandler);
    }, 10);
  }

  function bindRouteEvents() {
    // Banner 轮播自动播放
    if (typeof window.startBannerCarousel === 'function') window.startBannerCarousel();

    // 侧栏上部区域：内容超出时加渐隐遮罩，提示还可以滚动
    const sc = document.querySelector('.sidebar-scroll');
    if (sc) {
      const sync = () => {
        const more = sc.scrollHeight - sc.clientHeight - sc.scrollTop > 4;
        sc.classList.toggle('is-scrollable', more);
      };
      sc.addEventListener('scroll', sync, { passive: true });
      sync();
    }
  }

  // ===== 首页 =====
  const HOME_FEATURED_LIMIT = 15;

  function renderHome() {
    const banners = getDB('banner');
    const articles = getDB('articles').sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
    const homeArticles = articles.slice(0, HOME_FEATURED_LIMIT);
    const posts = getDB('posts').filter(p => p.status === 'approved');
    const latestShares = posts.filter(p => p.type === 'share').slice(0, 5);
    const latestDemands = posts.filter(p => p.type === 'demand').slice(0, 5);

    return `
      ${renderBanner(banners)}

      <div class="page-layout">
        <div class="main-content">
          <div class="section-header">
            <h2 class="section-title">站长推荐<span class="section-count">共 ${articles.length} 篇</span></h2>
            <a class="section-more" onclick="App.openFeatured(1)">查看全部 →</a>
          </div>
          <div class="article-grid">
            ${homeArticles.length > 0 ? homeArticles.map(renderArticleCard).join('') : `
              <div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">暂无推荐文章</div></div>
            `}
          </div>

          <div style="margin-top:2.5rem;" class="section-header">
            <h2 class="section-title">最新社区分享</h2>
            <a class="section-more" onclick="App.navigate('forum')">查看全部 →</a>
          </div>
          <div class="post-list">
            ${latestShares.length > 0 ? latestShares.map(renderSharePostCard).join('') : ''}
            ${latestDemands.length > 0 ? latestDemands.slice(0, 3).map(renderDemandPostCard).join('') : ''}
          </div>
        </div>

        <aside class="sidebar">
          <div class="sidebar-inner">
          <div class="sidebar-scroll">
          <div class="sidebar-card">
            <div class="sidebar-header">
              <div class="sidebar-title"><i class="fas fa-check-circle"></i> 最新通过审核</div>
            </div>
            <div class="sidebar-body">
              ${latestShares.length > 0 ? latestShares.slice(0, 3).map(p => `
                <div class="side-item" onclick="App.openPost('${p.id}')">
                  <span class="side-item-title">${p.title}</span>
                  <span class="side-item-extra">${timeAgo(p.createdAt)}</span>
                </div>
              `).join('') : '<div class="side-empty">暂无内容</div>'}
            </div>
          </div>

          <div class="sidebar-card">
            <div class="sidebar-header">
              <div class="sidebar-title"><i class="fas fa-question-circle"></i> 最新求资源</div>
            </div>
            <div class="sidebar-body">
              ${latestDemands.length > 0 ? latestDemands.slice(0, 3).map(p => `
                <div class="side-item" onclick="App.openPost('${p.id}')">
                  <span class="side-item-title">${p.title}</span>
                  <span class="side-item-extra reward">🏆 ${p.rewardPoint}</span>
                </div>
              `).join('') : '<div class="side-empty">暂无内容</div>'}
            </div>
          </div>

          <div class="sidebar-card">
            <div class="sidebar-header">
              <div class="sidebar-title"><i class="fas fa-bullhorn"></i> 公告栏</div>
            </div>
            <div class="side-notice">
              本站不存储任何资源文件，内容由网友投稿，请自行甄别有效性。<br>
              🎯 每日签到 100-200 积分，可用于解锁优质分享帖。
            </div>
          </div>

          </div>

          ${renderLbPreview()}
          </div>
        </aside>
      </div>
    `;
  }

  function renderBanner(banners) {
    if (banners.length === 0) return '';
    return `
      <div class="banner">
        <div class="banner-slides" id="bannerSlides">
          ${banners.map((b, i) => `
            <div class="banner-slide ${i === 0 ? 'active' : ''}">
              <img src="${b.image}" alt="${b.title}">
              <div class="banner-slide-content">
                <span class="banner-slide-tag">${b.tag || '公告'}</span>
                <h3 class="banner-slide-title">${b.title}</h3>
                <p class="banner-slide-desc">${b.desc || ''}</p>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="banner-dots">
          ${banners.map((_, i) => `<div class="banner-dot ${i === 0 ? 'active' : ''}" onclick="App.showBannerSlide(${i})"></div>`).join('')}
        </div>
      </div>
    `;
  }

  let bannerTimer = null;
  let currentBannerIndex = 0;
  function startBannerCarousel() {
    const banner = getDB('banner');
    if (banner.length <= 1) return;
    if (bannerTimer) clearInterval(bannerTimer);
    bannerTimer = setInterval(() => {
      currentBannerIndex = (currentBannerIndex + 1) % banner.length;
      showBannerSlide(currentBannerIndex);
    }, 4000);
  }
  function showBannerSlide(i) {
    currentBannerIndex = i;
    const slides = document.querySelectorAll('#bannerSlides .banner-slide');
    const dots = document.querySelectorAll('.banner-dots .banner-dot');
    slides.forEach((s, idx) => s.classList.toggle('active', idx === i));
    dots.forEach((d, idx) => d.classList.toggle('active', idx === i));
  }

  // ===== 签到排行榜 / 签到中心 =====
  function dateCN(ts = Date.now()) {
    return new Date(ts + 8 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function rankClass(n) { return n <= 3 ? `lb-rank-${n}` : ''; }

  function renderLbPreview() {
    const d = CACHE.lbPreview;
    // 侧栏只放前 4 名，保证小屏也能完整显示；完整榜单在「签到详情」页
    const rows = ((d && d.list) || []).slice(0, 4);
    return `
      <div class="sidebar-card lb-card">
        <div class="sidebar-header">
          <div class="sidebar-title"><i class="fas fa-trophy"></i> 签到排行榜</div>
          <span class="sidebar-more" onclick="App.openCheckin()">签到详情 →</span>
        </div>
        <div class="sidebar-body">
          ${rows.length ? rows.map(r => `
            <div class="lb-row" onclick="App.openCheckin()">
              <span class="lb-rank ${rankClass(r.rank)}">${r.rank}</span>
              <div class="lb-user">
                <div class="lb-name">${escapeHtml(r.name)}</div>
                <div class="lb-meta">连签 ${r.streak} 天 · ${timeAgo(r.lastAt)}</div>
              </div>
              <span class="lb-point">${r.points}<em>分</em></span>
            </div>
          `).join('') : '<div class="side-empty">还没有人签到，快来抢第一</div>'}
          <div class="lb-foot">今日签到 ${d ? d.todayCount : 0} 人 · 累计 ${d ? d.totalRecords : 0} 次</div>
        </div>
      </div>
    `;
  }

  async function loadCheckin(page = 1) {
    try {
      const r = await api(`/api/signin/leaderboard?page=${page}&pageSize=${CHECKIN_PAGE_SIZE}`);
      CACHE.checkin = r;
      checkinPage = r.page;
    } catch { CACHE.checkin = null; }
    return CACHE.checkin;
  }

  function openCheckin(page = 1) {
    checkinPage = page;
    currentRoute = 'checkin';
    document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.route === 'home'));
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    loadCheckin(page).then(() => { if (currentRoute === 'checkin') render(); });
  }

  function goCheckinPage(page) {
    if (page < 1) return;
    checkinPage = page;
    render();
    document.getElementById('checkinList')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    loadCheckin(page).then(() => { if (currentRoute === 'checkin') render(); });
  }

  function renderPager(page, totalPages, fn = 'goCheckinPage') {
    if (totalPages <= 1) return '';
    const nums = [];
    const push = n => nums.push(`<button class="pager-btn ${n === page ? 'active' : ''}" onclick="App.${fn}(${n})">${n}</button>`);
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) push(i);
    } else {
      push(1);
      if (page > 3) nums.push('<span class="pager-gap">…</span>');
      for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) push(i);
      if (page < totalPages - 2) nums.push('<span class="pager-gap">…</span>');
      push(totalPages);
    }
    return `
      <div class="pager">
        <button class="pager-btn" onclick="App.${fn}(${page - 1})" ${page <= 1 ? 'disabled' : ''}>上一页</button>
        ${nums.join('')}
        <button class="pager-btn" onclick="App.${fn}(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>下一页</button>
      </div>
    `;
  }

  function renderCheckin() {
    const d = CACHE.checkin;
    const me = CACHE.me;
    const signed = hasSignedToday();
    const streak = (me && me.signStreak) || 0;
    const days = (me && me.signDays) || 0;
    const myPoints = (me && me.points && me.points.available) || 0;
    const todayRec = me && me.signRecords ? me.signRecords.find(r => r.date === dateCN()) : null;

    const list = (d && d.list) || [];
    const page = (d && d.page) || 1;
    const totalPages = (d && d.totalPages) || 1;

    return `
      <button onclick="App.navigate('home')" class="ck-back">
        <i class="fas fa-arrow-left"></i> 返回首页
      </button>

      <div class="section-header">
        <h2 class="section-title">签到中心</h2>
        <span class="section-count">每日 00:00 重置</span>
      </div>

      <div class="checkin-hero">
        <div class="checkin-hero-main">
          <div class="checkin-ring ${signed ? 'done' : ''}">
            <i class="fas ${signed ? 'fa-check' : 'fa-calendar-check'}"></i>
          </div>
          <div class="checkin-hero-text">
            <div class="checkin-status">今日${signed ? '已签到' : '还未签到'}</div>
            <div class="checkin-sub">${signed
              ? `今日已获得 <b>+${todayRec ? todayRec.point : 0}</b> 积分`
              : '签到可得 100~200 随机积分'}</div>
            <div class="checkin-streak">🔥 已连续签到 <b>${streak}</b> 天</div>
          </div>
        </div>
        <button class="btn btn-primary checkin-btn" onclick="App.doSignin()" ${signed ? 'disabled' : ''}>
          ${signed ? '<i class="fas fa-check"></i> 今日已签到' : '立即签到'}
        </button>
      </div>

      <div class="checkin-stats">
        <div class="checkin-stat"><div class="checkin-stat-value">${streak}</div><div class="checkin-stat-label">连续签到（天）</div></div>
        <div class="checkin-stat"><div class="checkin-stat-value">${days}</div><div class="checkin-stat-label">累计签到（天）</div></div>
        <div class="checkin-stat"><div class="checkin-stat-value">${myPoints}</div><div class="checkin-stat-label">我的可用积分</div></div>
        <div class="checkin-stat"><div class="checkin-stat-value">${d ? d.todayCount : 0}</div><div class="checkin-stat-label">今日签到人数</div></div>
      </div>

      <div class="ck-card">
        <div class="ck-card-head"><span><i class="fas fa-scroll"></i> 签到规则</span></div>
        <ol class="ck-rules">
          <li>每人每日可签到 1 次，随机获得 <b>100~200</b> 积分，按自然日（UTC+8）00:00 重置。</li>
          <li>连续签到按自然日累计，中断 1 天即从 1 重新计算，排行榜按「连续签到 → 累计签到 → 累计积分」排序。</li>
          <li>积分可用于解锁资源帖（文章网盘）与发布悬赏，不可提现、不可转让。</li>
          <li>禁止脚本刷签、多账号互刷等作弊行为，一经发现清零积分并封禁账号。</li>
        </ol>
      </div>

      <div class="ck-card" id="checkinList">
        <div class="ck-card-head">
          <span><i class="fas fa-trophy"></i> 签到排行榜</span>
          <span class="ck-card-sub">共 ${d ? d.totalUsers : 0} 人参与 · 累计 ${d ? d.totalRecords : 0} 次</span>
        </div>

        ${d && d.me ? `
          <div class="ck-me">
            <span class="lb-rank ${rankClass(d.me.rank)}">${d.me.rank}</span>
            <span class="ck-me-name">我的排名</span>
            <span class="ck-me-meta">连签 ${d.me.streak} 天 · 累计 ${d.me.days} 天 · ${d.me.points} 分</span>
          </div>
        ` : ''}

        ${list.length ? `
          <div class="ck-table">
            <div class="ck-row ck-head">
              <span class="ck-col-rank">排名</span>
              <span class="ck-col-user">用户</span>
              <span class="ck-col-num">连续</span>
              <span class="ck-col-num">累计</span>
              <span class="ck-col-num">积分</span>
              <span class="ck-col-time">最近签到</span>
            </div>
            ${list.map(r => `
              <div class="ck-row ${me && me.user && me.user.id === r.userId ? 'me' : ''}">
                <span class="ck-col-rank"><span class="lb-rank ${rankClass(r.rank)}">${r.rank}</span></span>
                <span class="ck-col-user">
                  ${renderNameWithLevel(r.name, getLevelForUser(r.userId), { nameClass: 'ck-name', size: 13 })}
                  ${r.signedToday ? '<span class="ck-badge">今日已签</span>' : ''}
                </span>
                <span class="ck-col-num"><b>${r.streak}</b> 天</span>
                <span class="ck-col-num"><b>${r.days}</b> 天</span>
                <span class="ck-col-num point"><b>${r.points}</b></span>
                <span class="ck-col-time">${timeAgo(r.lastAt)}</span>
              </div>
            `).join('')}
          </div>
          <div class="ck-pager-wrap">
            <span class="ck-pager-info">第 ${page} / ${totalPages} 页</span>
            ${renderPager(page, totalPages)}
          </div>
        ` : `
          <div class="empty-state"><div class="empty-state-icon">🏆</div><div class="empty-state-text">还没有签到记录，快来成为第一名</div></div>
        `}
      </div>
    `;
  }

  /* ===== 站长推荐完整列表（20 条/页） ===== */
  const FEATURED_PAGE_SIZE = 20;
  let featuredPage = 1;

  function openFeatured(page = 1) {
    featuredPage = Math.max(1, parseInt(page, 10) || 1);
    navigate('featured');
  }

  function goFeaturedPage(page) {
    const total = getDB('articles').length;
    const totalPages = Math.max(1, Math.ceil(total / FEATURED_PAGE_SIZE));
    if (page < 1 || page > totalPages) return;
    featuredPage = page;
    render();
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  function renderFeatured() {
    const articles = getDB('articles').sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
    const total = articles.length;
    const totalPages = Math.max(1, Math.ceil(total / FEATURED_PAGE_SIZE));
    const page = Math.min(totalPages, Math.max(1, featuredPage));
    const start = (page - 1) * FEATURED_PAGE_SIZE;
    const list = articles.slice(start, start + FEATURED_PAGE_SIZE);

    return `
      <div class="featured-page">
        <button class="back-link" onclick="App.navigate('home')">
          <i class="fas fa-arrow-left"></i> 返回首页
        </button>

        <div class="section-header">
          <h2 class="section-title">站长推荐<span class="section-count">共 ${total} 篇</span></h2>
          <span class="featured-sub">每页 ${FEATURED_PAGE_SIZE} 篇 · 第 ${page} / ${totalPages} 页</span>
        </div>

        ${list.length ? `
          <div class="article-grid">
            ${list.map(renderArticleCard).join('')}
          </div>
        ` : `
          <div class="empty-state"><div class="empty-state-icon">📝</div><div class="empty-state-text">暂无推荐文章</div></div>
        `}

        ${totalPages > 1 ? `
          <div class="featured-pager">
            ${renderPager(page, totalPages, 'goFeaturedPage')}
          </div>
        ` : ''}
      </div>
    `;
  }

  function renderArticleCard(a) {
    return `
      <article class="article-card" onclick="App.openArticle('${a.id}')">
        <div class="article-card-cover">
          ${a.pinned ? '<span class="article-card-badge"><i class="fas fa-thumbtack"></i> 置顶</span>' : ''}
          ${a.cover
            ? `<img src="${escapeHtml(a.cover)}" alt="${escapeHtml(a.title)}" loading="lazy" onerror="this.style.display='none'">`
            : '<div class="ph-cover"><i class="fas fa-newspaper"></i></div>'}
        </div>
        <div class="article-card-body">
          <div class="article-card-title">${escapeHtml(a.title)}</div>
          <div class="article-card-excerpt">${escapeHtml(a.excerpt || '')}</div>
          <div class="article-card-footer">
            <span class="footer-main"><i class="fas fa-user"></i> ${a.author}</span>
            <span class="footer-main"><i class="fas fa-eye"></i> ${a.views || 0}</span>
            <span class="footer-time">${timeAgo(a.createdAt)}</span>
          </div>
        </div>
      </article>
    `;
  }

  /* 论坛列表缩略图：无自定义缩略图时用默认图；链接失效也回退默认图 */
  function postThumbHtml(p) {
    const fb = defaultThumb().replace(/'/g, '%27');
    return `<div class="post-thumb"><img src="${escapeHtml(postThumb(p))}" alt="" loading="lazy" decoding="async"
      onload="this.classList.add('is-loaded');this.parentNode.classList.add('loaded')"
      onerror="this.onerror=null;this.src='${fb}'"></div>`;
  }

  function renderSharePostCard(p) {
    return `
      <div class="post-card post-card-media" onclick="App.openPost('${p.id}')">
        ${postThumbHtml(p)}
        <div class="post-card-body">
          <div class="post-card-header">
            <div class="post-card-title"><i class="fas fa-upload post-type-ic"></i>${escapeHtml(p.title)}</div>
            <div class="post-card-tags">
              ${p.unlockPoint > 0 ? `<span class="lock-tag">🔒 ${p.unlockPoint}积分</span>` : `<span class="tag tag-green">免费</span>`}
            </div>
          </div>
          <div class="post-card-meta" style="font-size:0.75rem;color:var(--color-text-muted);">
            <span class="tag">${escapeHtml(p.netdiskType)}</span>
            <span>📂 ${escapeHtml(p.resourceType)}</span>
            ${p.personId ? `<span class="tag tag-blue">👤 ${escapeHtml((getDB('persons').find(x => x.id === p.personId) || {}).name || '名录')}</span>` : ''}
          </div>
          <div class="post-card-footer" style="margin-top:0.5rem;">
            <span>分享者：${renderNameWithLevel(p.userName, getLevelForUser(p.userId), { nameClass: '', size: 14 })}</span>
            <span>${timeAgo(p.createdAt)}</span>
          </div>
        </div>
      </div>
    `;
  }

  function renderDemandPostCard(p) {
    return `
      <div class="post-card post-card-media" onclick="App.openPost('${p.id}')">
        ${postThumbHtml(p)}
        <div class="post-card-body">
          <div class="post-card-header">
            <div class="post-card-title"><i class="fas fa-search post-type-ic"></i>${escapeHtml(p.title)}</div>
            <div class="post-card-tags">
              ${p.rewardPoint > 0 ? `<span class="reward-tag">🏆 ${p.rewardPoint}积分</span>` : '<span class="tag tag-gray">无悬赏</span>'}
            </div>
          </div>
          <div class="post-card-meta" style="font-size:0.75rem;color:var(--color-text-muted);">
            <span class="tag">${escapeHtml(p.resourceType)}</span>
            <span>网盘偏好：${(p.netdiskPref || []).map(escapeHtml).join('/')}</span>
          </div>
          <div class="post-card-footer" style="margin-top:0.5rem;">
            <span>求方：${renderNameWithLevel(p.userName, getLevelForUser(p.userId), { nameClass: '', size: 14 })}</span>
            <span>${p.isFinish ? '<span style="color:var(--color-success);">已结单</span>' : '<span style="color:var(--color-warning);">待接单</span>'}</span>
            <span>${timeAgo(p.createdAt)}</span>
          </div>
        </div>
      </div>
    `;
  }

  // ===== 文章详情 =====
  function openArticle(id) {
    currentRoute = 'article';
    sessionStorage.setItem('currentId', id);
    CACHE.articleDetail = null;
    CACHE.articleComments = { id, list: [], count: 0, loaded: false };
    render();
    api(`/api/articles/${encodeURIComponent(id)}`).then(a => {
      CACHE.articleDetail = a;
      if (currentRoute === 'article' && sessionStorage.getItem('currentId') === id) render();
    }).catch(() => {});
    api(`/api/articles/${encodeURIComponent(id)}/comments`).then(r => {
      if (currentRoute !== 'article' || sessionStorage.getItem('currentId') !== id) return;
      CACHE.articleComments = { id, list: r.comments || [], count: r.count || 0, loaded: true };
      render();
    }).catch(() => {});
  }

  // 文末网盘卡片
  function renderDriveCard(a) {
    if (!a.driveLink && !(a.drivePoint > 0)) return '';
    const head = `
      <div class="drive-card-head">
        <span class="drive-card-icon"><i class="fas fa-cloud-download-alt"></i></span>
        <div>
          <div class="drive-card-title">网盘资源下载</div>
          <div class="drive-card-sub">${escapeHtml(a.driveType || '网盘')} · ${a.drivePoint > 0 ? `需要 ${a.drivePoint} 积分解锁` : '免费获取'}</div>
        </div>
        ${a.drivePoint > 0 && !a.driveLink ? '<span class="drive-lock-badge"><i class="fas fa-lock"></i> 未解锁</span>' : ''}
      </div>`;
    if (a.driveLink) {
      return `
        <div class="drive-card drive-card-ok">
          ${head}
          <div class="drive-card-row">
            <span class="drive-card-label">链接</span>
            <a class="drive-card-link" href="${escapeHtml(a.driveLink)}" target="_blank" rel="noopener nofollow">${escapeHtml(a.driveLink)}</a>
            <button class="btn btn-secondary btn-sm" onclick="App.copyText('${escapeHtml(a.driveLink)}')">复制</button>
          </div>
          ${a.driveCode ? `
            <div class="drive-card-row">
              <span class="drive-card-label">提取码</span>
              <span class="drive-card-code">${escapeHtml(a.driveCode)}</span>
              <button class="btn btn-secondary btn-sm" onclick="App.copyText('${escapeHtml(a.driveCode)}')">复制</button>
            </div>` : ''}
        </div>`;
    }
    const points = getUserPoints();
    return `
      <div class="drive-card drive-card-locked">
        ${head}
        <div class="drive-card-row">
          <span class="drive-card-label">链接</span>
          <span class="drive-card-mask">••••••••••••••••••••••••</span>
        </div>
        <div class="drive-card-unlock">
          <button class="btn btn-primary" onclick="App.unlockArticle('${a.id}')">
            <i class="fas fa-lock-open"></i> 消耗 ${a.drivePoint} 积分解锁链接
          </button>
          <span class="drive-card-hint">当前可用积分：${points.available}</span>
        </div>
      </div>`;
  }

  /* 关联网友帖子的推荐：文章内不再单独解锁，全部引导到帖子下单 */
  function renderViaPostCard(rp) {
    const cost = rp.unlockPoint || 0;
    const isDemand = rp.type === 'demand';
    return `
      <div class="via-post-card">
        <div class="via-post-head">
          <span class="via-post-icon"><i class="fas ${isDemand ? 'fa-search' : 'fa-share-nodes'}"></i></span>
          <div class="via-post-main">
            <div class="via-post-label">网友投稿 · ${isDemand ? '悬赏区' : '资源区'}</div>
            <div class="via-post-title">${escapeHtml(rp.title)}</div>
          </div>
          <span class="via-post-cost">${cost > 0 ? `<i class="fas fa-lock"></i> ${cost} 积分` : '<span class="tag tag-green">免费</span>'}</span>
        </div>
        <div class="via-post-note">
          本篇为网友投稿的推荐导读，网盘与积分都由帖子本身管理。
          ${cost > 0 ? `前往帖子消耗 <b>${cost}</b> 积分解锁后即可查看网盘链接。` : '前往帖子即可直接查看网盘链接。'}
        </div>
        <button class="btn btn-primary via-post-btn" onclick="App.openPost('${rp.id}')">
          <i class="fas fa-arrow-right"></i> 前往帖子${cost > 0 ? '解锁下单' : '查看资源'}
        </button>
      </div>`;
  }

  // 评论区
  function renderComments(id) {
    const cs = (CACHE.articleComments && CACHE.articleComments.id === id)
      ? CACHE.articleComments
      : { list: [], count: (CACHE.articleDetail && CACHE.articleDetail.commentCount) || 0, loaded: false };
    const user = getCurrentUser();
    const items = cs.list.map((c, i) => `
      <div class="comment-item">
        <div class="comment-avatar">${escapeHtml((c.userName || '友').slice(0, 1).toUpperCase())}</div>
        <div class="comment-main">
          <div class="comment-head">
            ${renderNameWithLevel(c.userName || '匿名网友', getLevelForUser(c.userId), { nameClass: 'comment-name', size: 14 })}
            ${i === 0 ? '<span class="comment-first">🏆 首评 +10积分</span>' : ''}
            <span class="comment-time">${timeAgo(c.createdAt)}</span>
          </div>
          <div class="comment-text">${linkifyRaw(c.content)}</div>
        </div>
      </div>`).join('');
    return `
      <div class="comments-section">
        <div class="comments-head">
          <h2 class="section-title">网友评论</h2>
          <span class="comments-count">${cs.count} 条</span>
        </div>
        ${cs.loaded && cs.count === 0 ? `
          <div class="comments-empty">还没有评论，抢到首评可获得 <b>+10 积分</b> 奖励！</div>` : ''}
        ${items ? `<div class="comment-list">${items}</div>` : ''}
        <div class="comment-input-row">
          <div class="comment-avatar comment-avatar-me">${user ? escapeHtml((user.nickname || '友').slice(0, 1).toUpperCase()) : '<i class="fas fa-user"></i>'}</div>
          <textarea id="commentInput" class="comment-input" rows="2" maxlength="500"
            placeholder="${user ? '友善评论，抢首评拿积分…' : '登录后即可参与评论'}"></textarea>
          <button class="btn btn-primary btn-sm comment-submit" onclick="App.postArticleComment('${id}')">发表</button>
        </div>
        ${user ? '' : `<div class="comments-login-hint">需要先 <a onclick="App.showLoginModal()">登录</a> 才能评论 · 每篇文章第一条评论奖励 10 积分</div>`}
      </div>`;
  }

  function renderArticle() {
    const id = sessionStorage.getItem('currentId');
    const a = (CACHE.articleDetail && CACHE.articleDetail.id === id)
      ? CACHE.articleDetail
      : getDB('articles').find(x => x.id === id);
    if (!a) return '<div class="empty-state"><div class="empty-state-text">文章不存在</div></div>';

    const relatedPosts = getDB('posts').filter(p => p.status === 'approved' && p.type === 'share').slice(0, 4);
    const relPost = a.relatedPost || (a.relatedPostId
      ? getDB('posts').find(p => p.id === a.relatedPostId && p.status === 'approved')
      : null);

    return `
      <div class="detail-page">
      <button onclick="App.navigate('home')" style="display:inline-flex;align-items:center;gap:0.5rem;background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.875rem;margin-bottom:1rem;">
        <i class="fas fa-arrow-left"></i> 返回首页
      </button>

      <article style="background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;">
        <div style="aspect-ratio:16/7;overflow:hidden;">
          ${a.cover ? `<img src="${escapeHtml(a.cover)}" alt="${escapeHtml(a.title)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : '<div class="ph-cover"><i class="fas fa-newspaper"></i></div>'}
        </div>
        <div style="padding:2rem;">
          <h1 style="font-size:1.5rem;font-weight:700;color:var(--color-text);margin-bottom:0.75rem;">${escapeHtml(a.title)}</h1>
          <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:1.5rem;display:flex;gap:1rem;">
            <span>📝 ${escapeHtml(a.author || '站长')}</span>
            <span>👁 ${a.views || 0}</span>
            <span>${timeAgo(a.createdAt)}</span>
          </div>
          <div class="article-content">${formatArticleContent(a.content)}</div>
          ${renderDriveCard(a)}
          ${(() => {
            const rp = a.relatedPost || (a.relatedPostId
              ? getDB('posts').find(p => p.id === a.relatedPostId && p.status === 'approved')
              : null);
            if (!rp) return '';
            return `
              <div class="related-post-card" onclick="App.openPost('${rp.id}')">
                <div class="related-post-icon"><i class="fas ${rp.type === 'demand' ? 'fa-search' : 'fa-share-nodes'}"></i></div>
                <div class="related-post-info">
                  <div class="related-post-label">关联帖子 · ${rp.type === 'demand' ? '求资源' : '我分享'}</div>
                  <div class="related-post-title">${escapeHtml(rp.title)}</div>
                </div>
                <i class="fas fa-chevron-right related-post-arrow"></i>
              </div>
            `;
          })()}
        </div>
      </article>

      ${renderComments(id)}

      ${relatedPosts.length > 0 ? `
        <div style="margin-top:2rem;">
          <h2 class="section-title">关联资源</h2>
          <div class="post-list" style="margin-top:1rem;">
            ${relatedPosts.map(renderSharePostCard).join('')}
          </div>
        </div>
      ` : ''}
      </div>
    `;
  }

  // 发表评论（每篇文章第一条评论奖励 10 积分）
  async function postArticleComment(articleId) {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }
    const el = document.getElementById('commentInput');
    const content = (el ? el.value : '').trim();
    if (!content) { toast('先写点什么再发表吧', 'warning'); return; }
    try {
      const r = await api(`/api/articles/${encodeURIComponent(articleId)}/comments`, {
        method: 'POST', body: JSON.stringify({ content })
      });
      toast(r.rewarded ? `评论成功！首评奖励 +${r.reward} 积分 🎉` : '评论发表成功', 'success');
      const c = await api(`/api/articles/${encodeURIComponent(articleId)}/comments`);
      CACHE.articleComments = { id: articleId, list: c.comments || [], count: c.count || 0, loaded: true };
      await loadMe();
      renderNav();
      render();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // 解锁文章网盘链接
  async function unlockArticle(articleId) {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }
    const a = CACHE.articleDetail;
    const cost = (a && a.id === articleId) ? (a.drivePoint || 0) : 0;
    const points = getUserPoints();
    if (cost > 0 && points.available < cost) {
      toast(`积分不足（当前 ${points.available}，需要 ${cost}），先去签到吧！`, 'warning');
      return;
    }
    try {
      const r = await api(`/api/articles/${encodeURIComponent(articleId)}/unlock`, { method: 'POST', body: '{}' });
      if (CACHE.articleDetail && CACHE.articleDetail.id === articleId) {
        CACHE.articleDetail.driveLink = r.link;
        CACHE.articleDetail.driveCode = r.extractCode;
        CACHE.articleDetail.driveLocked = false;
      }
      const item = CACHE.articles.find(x => x.id === articleId);
      if (item) { item.driveLink = r.link; item.driveCode = r.extractCode; item.driveLocked = false; }
      if (CACHE.me) CACHE.me.points = r.points;
      toast('解锁成功，网盘链接已获取！', 'success');
      renderNav();
      render();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ===== 社区论坛 =====
  let forumTab = 'share';

  function renderForum() {
    const cats = getDB('categories');
    const posts = getDB('posts').filter(p => {
      if (p.status !== 'approved') return false;
      if (searchQuery) {
        return (p.title + p.content).toLowerCase().includes(searchQuery);
      }
      return true;
    });

    const demands = posts.filter(p => p.type === 'demand');
    const shares = posts.filter(p => p.type === 'share');

    return `
      <div class="section-header">
        <h2 class="section-title">社区论坛</h2>
      </div>

      <div class="forum-tabs">
        <button class="forum-tab ${forumTab === 'demand' ? 'active' : ''}" onclick="App.switchForumTab('demand')">
          🔍 求资源 (${demands.length})
        </button>
        <button class="forum-tab ${forumTab === 'share' ? 'active' : ''}" onclick="App.switchForumTab('share')">
          📤 我分享 (${shares.length})
        </button>
      </div>

      ${forumTab === 'demand' ? `
        <div class="post-list">
          ${demands.length > 0 ? demands.map(renderDemandPostCard).join('') : `
            <div class="empty-state"><div class="empty-state-icon">🔍</div><div class="empty-state-text">还没有求资源的帖子</div><button class="btn btn-primary" onclick="App.showSubmitModal('demand')">发布求资源</button></div>
          `}
        </div>
      ` : `
        <div class="post-list">
          ${shares.length > 0 ? shares.map(renderSharePostCard).join('') : `
            <div class="empty-state"><div class="empty-state-icon">📤</div><div class="empty-state-text">还没有分享的帖子</div><button class="btn btn-primary" onclick="App.showSubmitModal('share')">发布我分享</button></div>
          `}
        </div>
      `}
    `;
  }

  function switchForumTab(tab) {
    forumTab = tab;
    render();
  }

  // ===== 搜索结果 =====
  function renderSearch() {
    const q = searchQuery;
    if (!q) return '<div class="empty-state"><div class="empty-state-text">请输入关键词</div></div>';

    const hit = (...fields) => fields.some(f => String(f || '').toLowerCase().includes(q));
    const posts = getDB('posts').filter(p => p.status === 'approved' && hit(p.title, p.content, p.userName));
    const articles = getDB('articles').filter(a => hit(a.title, a.excerpt, a.content, a.author));
    const persons = getDB('persons').filter(p => hit(p.name, p.tag, p.bio));
    const works = getDB('works').filter(w => w.status === 'approved' && hit(w.title, w.content, w.userName));
    const total = posts.length + articles.length + persons.length + works.length;

    const block = (title, icon, count, body) => count > 0 ? `
      <div class="search-block">
        <div class="section-header" style="margin-bottom:0.75rem;">
          <h2 class="section-title" style="font-size:1rem;"><i class="fas ${icon}" style="color:var(--color-primary);margin-right:0.375rem;"></i>${title}<span class="section-count">${count} 条</span></h2>
        </div>
        ${body}
      </div>
    ` : '';

    return `
      <div class="section-header">
        <h2 class="section-title">搜索结果</h2>
        <span class="section-count">共 ${total} 条</span>
      </div>
      <div class="search-summary">
        关键词「<b>${escapeHtml(q)}</b>」·
        ${total > 0 ? '在社区帖子、站长推荐、姬查查名录中为你找到以下内容' : '没有找到相关内容，换个关键词试试'}
      </div>

      ${total === 0 ? `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-text">没有找到「${escapeHtml(q)}」相关内容</div>
          <div style="display:flex;gap:0.5rem;justify-content:center;margin-top:1rem;">
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('forum')">去社区逛逛</button>
            <button class="btn btn-secondary btn-sm" onclick="App.navigate('jicha')">去名录看看</button>
          </div>
        </div>
      ` : ''}

      ${block('社区帖子', 'fa-comments', posts.length, `
        <div class="post-list">
          ${posts.map(p => p.type === 'demand' ? renderDemandPostCard(p) : renderSharePostCard(p)).join('')}
        </div>
      `)}

      ${block('站长推荐', 'fa-newspaper', articles.length, `
        <div class="article-grid">
          ${articles.map(renderArticleCard).join('')}
        </div>
      `)}

      ${block('网友作品', 'fa-images', works.length, `
        <div class="masonry">
          ${works.map(w => `
            <div class="masonry-item">
              <div class="work-card" onclick="App.openWork('${w.id}')">
                <div class="work-card-cover">${w.cover ? `<img src="${escapeHtml(w.cover)}" alt="${escapeHtml(w.title)}" onerror="this.style.display='none'">` : '<div class="ph-cover"><i class="fas fa-image"></i></div>'}</div>
                <div class="work-card-body">
                  <div class="work-card-name">${escapeHtml(w.title)}</div>
                  <span class="tag tag-blue" style="font-size:0.625rem;">${escapeHtml(w.netdiskType || '网盘')}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `)}

      ${block('姬查查名录', 'fa-user-friends', persons.length, `
        <div class="masonry">
          ${persons.map(p => `
            <div class="masonry-item">
              <div class="person-card" onclick="App.openPerson('${p.id}')">
                <div class="person-card-avatar">${p.avatar ? `<img src="${escapeHtml(p.avatar)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">` : `<span class="avatar-letter">${escapeHtml((p.name || '?').charAt(0))}</span>`}</div>
                <div class="person-card-info">
                  <div class="person-card-name">${escapeHtml(p.name)}</div>
                  <div class="person-card-tag">${escapeHtml(p.tag || '')}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      `)}
    `;
  }

  // ===== 姬查查名录 =====
  function renderJicha() {
    const persons = getDB('persons');
    const categories = getDB('categories');
    const works = getDB('works').filter(w => w.status === 'approved');

    return `
      <div class="section-header">
        <h2 class="section-title">姬查查名录</h2>
      </div>
      <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:1.5rem;">
        收录网红/明星资料，网友投稿作品免费浏览
      </div>

      ${persons.length > 0 ? `
        <div class="masonry">
          ${persons.map(p => `
            <div class="masonry-item">
              <div class="person-card" onclick="App.openPerson('${p.id}')">
                <div class="person-card-avatar">
                  ${p.avatar
                    ? `<img src="${escapeHtml(p.avatar)}" alt="${escapeHtml(p.name)}" onerror="this.style.display='none'">`
                    : `<span class="avatar-letter">${escapeHtml((p.name || '?').charAt(0))}</span>`}
                </div>
                <div class="person-card-info">
                  <div class="person-card-name">${escapeHtml(p.name)}</div>
                  <div class="person-card-tag">${escapeHtml(p.tag || '')}</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state"><div class="empty-state-icon">👥</div><div class="empty-state-text">名录建设中...</div></div>
      `}
    `;
  }

  function openPerson(id) {
    sessionStorage.setItem('currentPersonId', id);
    currentRoute = 'personDetail';
    render();
  }

  function renderPersonDetail() {
    const id = sessionStorage.getItem('currentPersonId');
    const person = getDB('persons').find(p => p.id === id);
    const works = getDB('works').filter(w => w.personId === id && w.status === 'approved');
    const relPosts = getDB('posts').filter(p => p.personId === id && p.status === 'approved');

    if (!person) return '<div class="empty-state"><div class="empty-state-text">人物不存在</div></div>';

    return `
      <div class="detail-page">
      <button onclick="App.navigate('jicha')" style="display:inline-flex;align-items:center;gap:0.5rem;background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.875rem;margin-bottom:1rem;">
        <i class="fas fa-arrow-left"></i> 返回名录
      </button>

      <div style="background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:1.5rem;margin-bottom:2rem;display:flex;gap:1.5rem;align-items:flex-start;">
        <div style="width:120px;height:120px;border-radius:var(--radius-md);overflow:hidden;flex-shrink:0;">
          ${person.avatar ? `<img src="${escapeHtml(person.avatar)}" alt="${escapeHtml(person.name)}" style="width:100%;height:100%;object-fit:cover;" onerror="this.style.display='none'">` : `<span class="avatar-letter" style="font-size:2.5rem;">${escapeHtml((person.name || '?').charAt(0))}</span>`}
        </div>
        <div style="flex:1;min-width:0;">
          <h1 style="font-size:1.5rem;font-weight:700;color:var(--color-text);margin-bottom:0.375rem;">${person.name}</h1>
          <span class="tag">${person.tag}</span>
          <p style="margin-top:0.75rem;font-size:0.875rem;color:var(--color-text-secondary);line-height:1.6;">${person.bio || '暂无简介'}</p>
          ${person.baiduUrl ? `<a href="${person.baiduUrl}" target="_blank" style="font-size:0.75rem;color:var(--color-info);">百度百科 →</a>` : ''}
        </div>
      </div>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;">
        <h2 class="section-title" style="margin-bottom:0;">网友分享作品 (${works.length})</h2>
        <button class="btn btn-primary btn-sm" onclick="App.showWorkSubmitModal('${person.id}')">
          <i class="fas fa-cloud-upload-alt"></i> 投稿作品
        </button>
      </div>

      ${works.length > 0 ? `
        <div class="masonry">
          ${works.map(w => `
            <div class="masonry-item">
              <div class="work-card" onclick="App.openWork('${w.id}')">
                <div class="work-card-cover">
                  ${w.cover ? `<img src="${escapeHtml(w.cover)}" alt="${escapeHtml(w.title)}" onerror="this.style.display='none'">` : '<div class="ph-cover"><i class="fas fa-image"></i></div>'}
                </div>
                <div class="work-card-body">
                  <div class="work-card-name">${w.title}</div>
                  <span class="tag tag-blue" style="font-size:0.625rem;">${w.netdiskType}</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="empty-state"><div class="empty-state-icon">🎨</div><div class="empty-state-text">还没有作品投稿</div></div>
      `}

      ${relPosts.length ? `
        <div class="section-header" style="margin-top:2rem;">
          <h2 class="section-title" style="font-size:1rem;">相关资源帖 (${relPosts.length})</h2>
        </div>
        <div class="post-list">
          ${relPosts.map(p => p.type === 'demand' ? renderDemandPostCard(p) : renderSharePostCard(p)).join('')}
        </div>
      ` : ''}
      </div>
    `;
  }

  // ===== 网友作品详情 =====
  function openWork(id) {
    sessionStorage.setItem('currentWorkId', id);
    currentRoute = 'workDetail';
    render();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function renderWorkDetail() {
    const id = sessionStorage.getItem('currentWorkId');
    const w = getDB('works').find(x => x.id === id);
    if (!w) {
      return `
        <div class="empty-state">
          <div class="empty-state-icon">🎨</div>
          <div class="empty-state-text">作品不存在或已下架</div>
          <button class="btn btn-primary btn-sm" style="margin-top:1rem;" onclick="App.navigate('jicha')">返回名录</button>
        </div>
      `;
    }
    const person = getDB('persons').find(p => p.id === w.personId);

    return `
      <div class="detail-page">
        <button onclick="${person ? `App.openPerson('${person.id}')` : "App.navigate('jicha')"}" class="ck-back">
          <i class="fas fa-arrow-left"></i> ${person ? `返回 ${escapeHtml(person.name)}` : '返回名录'}
        </button>

        <div class="work-detail">
          ${w.cover ? `<div class="work-detail-cover"><img src="${w.cover}" alt="${escapeHtml(w.title)}"></div>` : ''}
          <div class="work-detail-body">
            <h1 class="work-detail-title">${escapeHtml(w.title)}</h1>
            <div class="work-detail-meta">
              <span class="tag tag-blue">${escapeHtml(w.netdiskType || '网盘')}</span>
              ${person ? `<span class="tag" style="cursor:pointer;" onclick="App.openPerson('${person.id}')">👤 ${escapeHtml(person.name)}</span>` : ''}
              <span class="work-detail-sub">由 ${escapeHtml(w.userName || '网友')} 投稿 · ${timeAgo(w.createdAt)}</span>
            </div>

            ${w.content ? `<div class="work-detail-desc">${escapeHtml(w.content).replace(/\n/g, '<br>')}</div>` : ''}

            <div class="work-detail-link">
              <div class="work-detail-link-label"><i class="fas fa-link"></i> 网盘链接</div>
              ${w.link ? `
                <div class="work-detail-link-row">
                  <input class="form-input" readonly value="${escapeHtml(w.link)}" onclick="this.select()">
                  <button class="btn btn-primary btn-sm" onclick="App.copyText('${String(w.link).replace(/'/g, "\\'")}')">复制链接</button>
                </div>
                ${w.extractCode ? `
                  <div class="work-detail-link-row" style="margin-top:0.5rem;">
                    <input class="form-input" readonly value="提取码：${escapeHtml(w.extractCode)}" onclick="this.select()">
                    <button class="btn btn-secondary btn-sm" onclick="App.copyText('${String(w.extractCode).replace(/'/g, "\\'")}')">复制提取码</button>
                  </div>
                ` : ''}
              ` : `
                <div class="work-detail-empty"><i class="fas fa-hourglass-half"></i> 投稿人暂未填写网盘链接，可稍后再来看看</div>
              `}
            </div>

            <div class="work-detail-tip">
              <i class="fas fa-info-circle"></i> 资源由网友投稿分享，本站不存储任何文件，请自行甄别有效性。
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // ===== 帖子详情 =====
  function openPost(id) {
    sessionStorage.setItem('currentPostId', id);
    currentRoute = 'postDetail';
    CACHE.postDetail = null;
    CACHE.postComments = { id, list: [], count: 0, loaded: false };
    render();
    api(`/api/posts/${encodeURIComponent(id)}`).then(p => {
      CACHE.postDetail = p;
      if (currentRoute === 'postDetail' && sessionStorage.getItem('currentPostId') === id) render();
    }).catch(() => {});
    loadPostComments(id);
  }

  function loadPostComments(id) {
    const target = id || sessionStorage.getItem('currentPostId');
    if (!target) return;
    api(`/api/posts/${encodeURIComponent(target)}/comments`).then(r => {
      if (sessionStorage.getItem('currentPostId') !== target) return;
      CACHE.postComments = { id: target, list: r.comments || [], count: r.count || 0, loaded: true };
      if (currentRoute === 'postDetail') render();
    }).catch(() => {});
  }

  function renderPostComments(p) {
    const cc = (CACHE.postComments && CACHE.postComments.id === p.id) ? CACHE.postComments : { list: [], count: p.commentCount || 0, loaded: false };
    const user = getCurrentUser();
    return `
      <section class="post-comments">
        <div class="pc-head">
          <span><i class="fas fa-comments"></i> 评论区</span>
          <span class="pc-count">${cc.count} 条留言</span>
        </div>
        <div class="pc-list">
          ${cc.list.length ? cc.list.map(c => `
            <div class="pc-item">
              <div class="pc-avatar">${(c.userName || '?').charAt(0)}</div>
              <div class="pc-body">
                <div class="pc-meta">
                  ${renderNameWithLevel(c.userName || '网友', getLevelForUser(c.userId), { nameClass: 'pc-name', size: 14 })}
                  ${c.mentionAdmin ? '<span class="pc-at">@管理员</span>' : ''}
                  <span class="pc-time">${timeAgo(c.createdAt)}</span>
                </div>
                <div class="pc-text">${escapeHtml(c.content)}</div>
              </div>
            </div>
          `).join('') : `<div class="pc-empty">${cc.loaded ? '还没有留言，来说两句吧' : '留言加载中…'}</div>`}
        </div>
        <div class="pc-form">
          <textarea class="form-textarea" id="postCommentInput" rows="3" placeholder="友善交流，禁止直接放网盘链接。需要管理员处理可点「@管理员」。"></textarea>
          <div class="pc-actions">
            <button type="button" class="btn btn-secondary btn-sm" onclick="App.mentionAdmin()">
              <i class="fas fa-at"></i> @管理员
            </button>
            <button type="button" class="btn btn-primary btn-sm" onclick="App.postComment()">
              ${user ? '发表留言' : '登录后留言'}
            </button>
          </div>
        </div>
      </section>
    `;
  }

  async function postComment() {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }
    const el = document.getElementById('postCommentInput');
    const content = (el ? el.value : '').trim();
    if (!content) { toast('请输入留言内容', 'warning'); return; }
    const postId = sessionStorage.getItem('currentPostId');
    try {
      const r = await api(`/api/posts/${encodeURIComponent(postId)}/comments`, {
        method: 'POST', body: JSON.stringify({ content }),
      });
      if (CACHE.postComments && CACHE.postComments.id === postId) {
        CACHE.postComments.list.push(r.comment);
        CACHE.postComments.count = r.count;
      }
      toast(r.comment.mentionAdmin ? '留言已发布，管理员会尽快处理' : '留言已发布', 'success');
      render();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function mentionAdmin() {
    const el = document.getElementById('postCommentInput');
    if (!el) return;
    const at = '@管理员 ';
    if (!el.value.includes(at)) el.value = at + el.value.replace(/^\s+/, '');
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  }

  function renderPostDetail() {
    const id = sessionStorage.getItem('currentPostId');
    const p = (CACHE.postDetail && CACHE.postDetail.id === id)
      ? CACHE.postDetail
      : getDB('posts').find(x => x.id === id);
    if (!p) return '<div class="empty-state"><div class="empty-state-text">帖子不存在</div></div>';

    const user = getCurrentUser();
    const isOwner = !!user && (p.isOwner || p.userId === user.id);
    const isAdminUser = !!(user && user.role === 'admin');
    const canEdit = isOwner || isAdminUser;
    const isUnlocked = user && (CACHE.me.myUnlocked || []).includes(id);
    const canSeeLink = isOwner || isAdminUser || isUnlocked || !(p.unlockPoint > 0);
    const canUnlock = user && !isOwner && !isUnlocked && p.unlockPoint > 0;
    const points = getUserPoints();
    const images = Array.isArray(p.images) ? p.images : [];
    const cover = p.cover || images[0] || '';
    const person = p.person || (p.personId ? getDB('persons').find(x => x.id === p.personId) : null);

    return `
      <div class="detail-page">
      <button onclick="App.navigate('forum')" style="display:inline-flex;align-items:center;gap:0.5rem;background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.875rem;margin-bottom:1rem;">
        <i class="fas fa-arrow-left"></i> 返回论坛
      </button>

      <article style="background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:1.5rem;margin-bottom:1.5rem;">
        ${cover ? `
          <div class="post-cover">
            <img src="${escapeHtml(cover)}" alt="${escapeHtml(p.title)}" onerror="this.parentNode.style.display='none'">
          </div>
        ` : ''}

        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1rem;">
          <div style="flex:1;min-width:0;">
            <h1 style="font-size:1.375rem;font-weight:700;color:var(--color-text);margin-bottom:0.5rem;">
              <i class="fas ${p.type === 'demand' ? 'fa-search' : 'fa-upload'} post-type-ic"></i>${escapeHtml(p.title)}
            </h1>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;">
              ${p.type === 'share' ? `<span class="tag tag-blue">${escapeHtml(p.netdiskType)}</span>` : ''}
              <span class="tag">${escapeHtml(p.resourceType)}</span>
              ${p.type === 'demand' ? `
                ${(p.netdiskPref || []).map(n => `<span class="tag tag-gray">${escapeHtml(n)}</span>`).join('')}
                ${p.rewardPoint > 0 ? `<span class="reward-tag">🏆 ${p.rewardPoint}积分悬赏</span>` : ''}
              ` : ''}
              ${p.type === 'share' && p.unlockPoint > 0 ? `<span class="lock-tag">🔒 ${p.unlockPoint}积分解锁</span>` : ''}
              ${person ? `<span class="tag tag-blue" style="cursor:pointer;" onclick="App.openPerson('${person.id}')">👤 ${escapeHtml(person.name)}</span>` : ''}
            </div>
          </div>
          ${canEdit ? `
            <button class="btn btn-secondary btn-sm" onclick="App.editPost('${p.id}')">
              <i class="fas fa-pen"></i> 编辑
            </button>
          ` : ''}
        </div>

        <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--color-border);">
          发帖人：${renderNameWithLevel(p.userName, getLevelForUser(p.userId), { nameClass: '', size: 15 })} · ${timeAgo(p.createdAt)}
          ${p.editedAt ? ` · 已编辑 ${timeAgo(p.editedAt)}` : ''}
          · 状态：${getStatusLabel(p.status)}
          ${isOwner ? '<span class="owner-badge">我的帖子</span>' : ''}
        </div>

        <div style="line-height:1.8;color:var(--color-text-secondary);font-size:0.9375rem;margin-bottom:1.5rem;white-space:pre-wrap;">${escapeHtml(p.content)}</div>

        ${images.length ? `
          <div class="post-gallery">
            ${images.map((src, i) => `
              <a class="gallery-item" href="${escapeHtml(src)}" target="_blank" rel="noopener noreferrer">
                <img src="${escapeHtml(src)}" alt="预览图 ${i + 1}" loading="lazy" onerror="this.parentNode.style.display='none'">
              </a>
            `).join('')}
          </div>
        ` : ''}

        ${p.type === 'share' ? `
          <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:1.25rem;">
            <h3 style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1rem;">🔑 网盘信息</h3>
            ${canSeeLink ? `
              <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius-sm);padding:1rem;margin-bottom:0.75rem;">
                <div style="font-size:0.75rem;color:var(--color-success);margin-bottom:0.5rem;">
                  ${isOwner ? '✓ 这是你发布的帖子，无需积分即可查看' : isAdminUser ? '✓ 管理员权限，可直接查看' : '✓ 已解锁，查看网盘信息'}
                </div>
                <div style="font-size:0.875rem;color:var(--color-text);word-break:break-all;">
                  <div style="margin-bottom:0.5rem;"><span style="color:var(--color-text-muted);">网盘类型：</span>${escapeHtml(p.netdiskType)}</div>
                  <div style="margin-bottom:0.5rem;"><span style="color:var(--color-text-muted);">下载链接：</span>${escapeHtml(p.link)}</div>
                  ${(p.extractCode || p.unzipCode) ? `
                    <div class="post-codes">
                      ${p.extractCode ? `<span class="post-code-item">提取码：<code>${escapeHtml(p.extractCode)}</code></span>` : ''}
                      ${p.unzipCode ? `<span class="post-code-item">解压码：<code>${escapeHtml(p.unzipCode)}</code></span>` : ''}
                    </div>` : ''}
                </div>
                <button class="btn btn-secondary btn-sm" style="margin-top:0.75rem;" onclick="copyText('${String(p.link || '').replace(/'/g, "\\'")}')"><i class="fas fa-copy"></i> 复制链接</button>
              </div>
            ` : canUnlock ? `
              <div style="background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius-sm);padding:1rem;margin-bottom:0.75rem;">
                <div style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:0.75rem;">🔒 此帖需要积分解锁后查看网盘信息</div>
                <button class="btn btn-primary" onclick="App.unlockPost('${p.id}', ${p.unlockPoint})">
                  🎯 立即解锁 · 消耗 ${p.unlockPoint} 积分（可用 ${points.available}）
                </button>
              </div>
            ` : `
              <div style="background:rgba(251,191,36,0.1);border:1px solid rgba(251,191,36,0.3);border-radius:var(--radius-sm);padding:1rem;margin-bottom:0.75rem;">
                <div style="font-size:0.875rem;color:var(--color-warning);">⚠️ 积分不足！当前可用 ${points.available}，需要 ${p.unlockPoint}</div>
                <button class="btn btn-primary btn-sm" style="margin-top:0.75rem;" onclick="App.doSignin()">
                  <i class="fas fa-calendar-check"></i> 每日签到赚积分
                </button>
              </div>
            `}
          </div>
          <div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:1rem;padding:0.75rem;background:var(--color-input);border-radius:var(--radius-sm);">
            💡 解锁规则：一次扣费，永久可见。解锁后不因网盘链接失效退还积分，请自行判断资源是否需要。
          </div>
        ` : `
          <div style="background:rgba(124,58,237,0.05);border:1px solid rgba(124,58,237,0.2);border-radius:var(--radius-md);padding:1rem;font-size:0.8125rem;color:var(--color-text-muted);">
            💬 评论区仅作线索交流，禁止直接放网盘链接。找到资源后请走「我分享」投稿。
          </div>
        `}
      </article>

      ${p.type === 'demand' && p.rewardPoint > 0 ? `
        <div style="background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:1rem;margin-bottom:1rem;">
          <div class="reward-tag" style="font-size:0.875rem;">🏆 悬赏状态</div>
          <div style="margin-top:0.5rem;font-size:0.8125rem;color:var(--color-text-muted);">
            ${p.isFinish ? '✅ 已结单，悬赏积分已发放' : '⏳ 待接单，悬赏积分已冻结在平台'}
          </div>
          <div style="font-size:0.75rem;color:var(--color-text-placeholder);margin-top:0.375rem;">
            找到资源后可发布「我分享」帖并在评论区 @发帖人。悬赏由管理员手动发放。
          </div>
        </div>
      ` : ''}

      ${renderPostComments(p)}
      </div>
    `;
  }

  async function unlockPost(postId, cost) {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }
    if (getUserPoints().available < cost) {
      toast('积分不足，先去签到吧！', 'warning');
      return;
    }

    try {
      await api(`/api/posts/${encodeURIComponent(postId)}/unlock`, { method: 'POST', body: '{}' });
      await loadMe();
      CACHE.postDetail = await api(`/api/posts/${encodeURIComponent(postId)}`).catch(() => CACHE.postDetail);
      toast(`解锁成功！消耗 ${cost} 积分`, 'success');
      renderNav();
      render();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // ===== 邮箱：找回密码 / 绑定邮箱 =====
  const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  let codeCooldownTimer = null;

  function startCodeCooldown(btnId, seconds) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    let left = seconds || 60;
    btn.disabled = true;
    btn.textContent = left + ' 秒后重发';
    if (codeCooldownTimer) clearInterval(codeCooldownTimer);
    codeCooldownTimer = setInterval(() => {
      left -= 1;
      const b = document.getElementById(btnId);
      if (!b) { clearInterval(codeCooldownTimer); codeCooldownTimer = null; return; }
      if (left <= 0) {
        clearInterval(codeCooldownTimer);
        codeCooldownTimer = null;
        b.disabled = false;
        b.textContent = '获取验证码';
      } else {
        b.textContent = left + ' 秒后重发';
      }
    }, 1000);
  }

  async function sendEmailCode(inputId, purpose, btnId) {
    const email = ((document.getElementById(inputId) || {}).value || '').trim();
    if (!EMAIL_RX.test(email)) { toast('请输入正确的邮箱地址', 'warning'); return; }
    const btn = document.getElementById(btnId);
    if (btn) btn.disabled = true;
    try {
      await api('/api/auth/email/send-code', { method: 'POST', body: JSON.stringify({ email, purpose }) });
      toast('验证码已发送，请查收邮箱（收不到看下垃圾箱）', 'success');
      startCodeCooldown(btnId, 60);
    } catch (e) {
      if (btn) btn.disabled = false;
      toast(e.message, 'error');
    }
  }

  function showResetPasswordModal() {
    openModal(`
      <div style="font-size:0.75rem;color:var(--color-text-muted);line-height:1.7;margin-bottom:1rem;">
        仅支持已绑定邮箱的账号。验证码 10 分钟内有效，重置成功后其它设备的登录状态会自动失效。
      </div>
      <div class="form-group">
        <label class="form-label">绑定邮箱</label>
        <input class="form-input" id="rstEmail" placeholder="你在本站绑定的邮箱" autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label">验证码</label>
        <div style="display:flex;gap:0.5rem;">
          <input class="form-input" id="rstCode" placeholder="6 位数字" inputmode="numeric" maxlength="6" style="flex:1;">
          <button class="btn btn-secondary" id="rstSend" style="white-space:nowrap;" onclick="App.sendEmailCode('rstEmail','reset','rstSend')">获取验证码</button>
        </div>
      </div>
      <div class="form-group">
        <label class="form-label">新密码</label>
        <input class="form-input" id="rstPwd" type="password" placeholder="至少 6 位" autocomplete="new-password">
      </div>
      <div style="font-size:0.75rem;color:var(--color-text-muted);display:flex;flex-direction:column;gap:0.4rem;">
        <span>还没绑定邮箱？先用账号密码登录 → 个人中心 → 安全邮箱 → 立即绑定。</span>
        <span>没有绑定邮箱且已忘记密码？<button style="background:none;border:none;color:var(--color-primary-light);cursor:pointer;padding:0;font-size:0.75rem;" onclick="App.showRequestResetModal()">申请管理员重置密码 →</button></span>
      </div>
    `, { title: '找回密码', width: 420, onConfirm: doResetPassword });
  }

  async function doResetPassword() {
    const email = ((document.getElementById('rstEmail') || {}).value || '').trim();
    const code = ((document.getElementById('rstCode') || {}).value || '').trim();
    const pwd = (document.getElementById('rstPwd') || {}).value || '';
    if (!email || !code || !pwd) { toast('请填写完整', 'warning'); return false; }
    if (pwd.length < 6) { toast('新密码至少 6 位', 'warning'); return false; }
    try {
      const r = await api('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, password: pwd }) });
      setToken(r.token);
      await refresh();
      render();
      toast('密码已重置，已自动登录', 'success');
      return true;
    } catch (e) { toast(e.message, 'error'); return false; }
  }

  function showBindEmailModal() {
    const cur = (CACHE.me && CACHE.me.email) || '';
    openModal(`
      <div style="font-size:0.75rem;color:var(--color-text-muted);line-height:1.7;margin-bottom:1rem;">
        绑定后忘记密码可用邮箱自助找回，换设备也不用担心丢号。<br>
        当前状态：<strong style="color:var(--color-text);">${cur || '未绑定'}</strong>
      </div>
      <div class="form-group">
        <label class="form-label">邮箱地址</label>
        <input class="form-input" id="bndEmail" placeholder="如 yourname@qq.com" value="${cur}" autocomplete="email">
      </div>
      <div class="form-group">
        <label class="form-label">验证码</label>
        <div style="display:flex;gap:0.5rem;">
          <input class="form-input" id="bndCode" placeholder="6 位数字" inputmode="numeric" maxlength="6" style="flex:1;">
          <button class="btn btn-secondary" id="bndSend" style="white-space:nowrap;" onclick="App.sendEmailCode('bndEmail','bind','bndSend')">获取验证码</button>
        </div>
      </div>
      <div style="font-size:0.75rem;color:var(--color-text-muted);">QQ、163、126、Gmail、Outlook 等常用邮箱都能收。</div>
    `, { title: '安全邮箱', width: 420, onConfirm: doBindEmail });
  }

  async function doBindEmail() {
    const email = ((document.getElementById('bndEmail') || {}).value || '').trim();
    const code = ((document.getElementById('bndCode') || {}).value || '').trim();
    if (!EMAIL_RX.test(email)) { toast('请输入正确的邮箱地址', 'warning'); return false; }
    if (!code) { toast('请输入验证码', 'warning'); return false; }
    try {
      await api('/api/auth/bind-email', { method: 'POST', body: JSON.stringify({ email, code }) });
      await loadMe();
      render();
      toast('邮箱绑定成功', 'success');
      return true;
    } catch (e) { toast(e.message, 'error'); return false; }
  }

  // ===== 用户中心 =====
  function renderProfile() {
    const user = getCurrentUser();
    if (!user) return `
      <div class="empty-state">
        <div class="empty-state-icon">👤</div>
        <div class="empty-state-text">请先登录</div>
        <button class="btn btn-primary" onclick="App.showLoginModal()">立即登录</button>
      </div>
    `;

    const me = CACHE.me || {};
    const userEmail = me.email || '';
    const points = me.points || { available: 0, frozen: 0, totalGain: 0 };
    const allPosts = me.myPosts || [];
    const logs = me.logs || [];
    const records = me.signRecords || [];
    const today = new Date();
    const calendar = renderSigninCalendar(records, today);

    return `
      <div class="profile-header">
        <div class="profile-avatar">${user.nickname ? user.nickname.charAt(0).toUpperCase() : 'U'}</div>
        <div class="profile-info">
          ${renderNameWithLevel(user.nickname || '用户', getCurrentUserLevel(), { nameClass: 'profile-name', size: 16 })}
          <div class="profile-id">ID: ${user.id}</div>
          <div class="profile-stats">
            <div class="profile-stat"><span class="profile-stat-value">${allPosts.length}</span><span class="profile-stat-label">我的投稿</span></div>
            <div class="profile-stat"><span class="profile-stat-value">${points.available}</span><span class="profile-stat-label">可用积分</span></div>
            <div class="profile-stat"><span class="profile-stat-value">${records.length}</span><span class="profile-stat-label">累计签到</span></div>
          </div>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="App.showEditProfile()">编辑资料</button>
      </div>

      <div class="point-card">
        <div class="point-balance-label">当前可用积分</div>
        <div class="point-balance-value">${points.available}</div>
        <div class="point-stats-row">
          <div class="point-stat"><div style="font-size:0.6875rem;color:var(--color-text-muted);">冻结中</div><div style="font-size:1rem;font-weight:700;color:var(--color-warning);">${points.frozen}</div></div>
          <div class="point-stat"><div style="font-size:0.6875rem;color:var(--color-text-muted);">累计获得</div><div style="font-size:1rem;font-weight:700;color:var(--color-point);">${points.totalGain}</div></div>
          <div class="point-stat"><div style="font-size:0.6875rem;color:var(--color-text-muted);">今日签到</div><div style="font-size:1rem;font-weight:700;color:${hasSignedToday() ? 'var(--color-success)' : 'var(--color-text-muted)'};">${hasSignedToday() ? '✓ 已签' : '未签'}</div></div>
        </div>
      </div>

      <div class="card" style="padding:1rem 1.25rem;margin-bottom:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;">
          <div>
            <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:0.35rem;">📮 安全邮箱</h3>
            <div style="font-size:0.8125rem;color:${userEmail ? 'var(--color-text)' : 'var(--color-text-muted)'};">
              ${userEmail || '未绑定 · 忘记密码将无法找回账号'}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.showBindEmailModal()">${userEmail ? '更换邮箱' : '立即绑定'}</button>
        </div>
      </div>

      <div class="card" style="padding:1rem 1.25rem;margin-bottom:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:1rem;flex-wrap:wrap;">
          <div>
            <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:0.35rem;">🔑 登录密码</h3>
            <div style="font-size:0.8125rem;color:${(CACHE.me && CACHE.me.mustChangePwd) ? 'var(--color-warning)' : 'var(--color-text-muted)'};">
              ${(CACHE.me && CACHE.me.mustChangePwd) ? '⚠️ 当前为默认重置密码，请立即修改' : '定期修改密码更安全'}
            </div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.showChangePasswordModal(${(CACHE.me && CACHE.me.mustChangePwd) ? 'true' : 'false'})">修改密码</button>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;" class="profile-tabs">
        <div class="card" style="padding:1rem 1.25rem;">
          <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:0.75rem;">📅 本月签到</h3>
          ${calendar}
          <button class="btn btn-primary btn-sm" style="margin-top:0.75rem;width:100%;" onclick="App.doSignin()" ${hasSignedToday() ? 'disabled' : ''}>
            ${hasSignedToday() ? '今日已签到' : '立即签到 (+100~200)'}
          </button>
        </div>

        <div class="card" style="padding:1rem 1.25rem;">
          <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:0.75rem;">📝 积分流水（最近10条）</h3>
          <div style="max-height:240px;overflow-y:auto;">
            ${logs.length > 0 ? logs.slice(0, 10).map(l => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:0.5rem 0;border-bottom:1px solid var(--color-border);font-size:0.8125rem;">
                <div>
                  <div style="color:var(--color-text);">${getPointTypeName(l.type)}</div>
                  <div style="font-size:0.6875rem;color:var(--color-text-muted);">${timeAgo(l.createdAt)}</div>
                </div>
                <div style="font-weight:600;color:${l.point > 0 ? 'var(--color-success)' : 'var(--color-danger)'};">
                  ${l.point > 0 ? '+' : ''}${l.point}
                </div>
              </div>
            `).join('') : '<div style="font-size:0.75rem;color:var(--color-text-muted);text-align:center;padding:1rem;">暂无流水</div>'}
          </div>
        </div>
      </div>

      <div class="card" style="padding:1rem 1.25rem;margin-top:1rem;">
        <h3 style="font-size:0.875rem;font-weight:600;margin-bottom:0.75rem;">📋 我的投稿</h3>
        ${allPosts.length > 0 ? allPosts.map(p => `
          <div style="padding:0.625rem 0;border-bottom:1px solid var(--color-border);display:flex;justify-content:space-between;align-items:center;font-size:0.8125rem;">
            <div style="flex:1;cursor:pointer;" onclick="App.openPost('${p.id}')">
              <div style="color:var(--color-text);">${p.type === 'demand' ? '🔍' : '📤'} ${p.title}</div>
              <div style="font-size:0.6875rem;color:var(--color-text-muted);">${timeAgo(p.createdAt)}</div>
            </div>
            <span class="tag ${getStatusTagClass(p.status)}">${getStatusLabel(p.status)}</span>
          </div>
        `).join('') : '<div style="font-size:0.75rem;color:var(--color-text-muted);text-align:center;padding:1rem;">暂无投稿</div>'}
      </div>
    `;
  }

  function renderSigninCalendar(records, today) {
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const signedDays = new Set(records.filter(r => {
      const d = new Date(r.date);
      return d.getFullYear() === year && d.getMonth() === month;
    }).map(r => new Date(r.date).getDate()));
    const todayDate = today.getDate();
    const todayStr = today.toISOString().slice(0, 10);

    let html = '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:0.25rem;font-size:0.6875rem;">';
    const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
    weekDays.forEach(d => html += `<div style="text-align:center;color:var(--color-text-muted);padding:0.25rem;">${d}</div>`);
    for (let i = 0; i < firstDay; i++) html += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const isSigned = signedDays.has(d);
      const isToday = d === todayDate;
      const dayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      const isFuture = dayStr > todayStr;
      const cls = isSigned ? 'signed' : (isToday ? 'today' : '');
      html += `<div class="signin-day ${cls}" style="${isFuture ? 'opacity:0.3;' : ''}">${isSigned ? '✓' : d}</div>`;
    }
    html += '</div>';
    return html;
  }

  // ===== 登录/注册 =====
  function showLoginModal() {
    const modal = openModal(`
      <div style="display:flex;align-items:center;justify-content:center;gap:0.625rem;margin-bottom:1.25rem;">
        <img src="assets/img/logo.svg" alt="视觉社" width="46" height="46" style="border-radius:13px;box-shadow:var(--shadow-glow);">
        <div style="font-size:1.125rem;font-weight:700;color:var(--color-text);">视觉社 · 账号登录</div>
      </div>
      <div class="form-group">
        <label class="form-label">账号</label>
        <input class="form-input" id="loginUser" placeholder="请输入账号" onblur="App.checkPwdReset()">
      </div>
      <div class="form-group">
        <label class="form-label">密码</label>
        <input class="form-input" id="loginPwd" type="password" placeholder="请输入密码">
        <div id="pwdResetHint" style="display:none;margin-top:0.5rem;padding:0.5rem 0.75rem;border-radius:8px;background:rgba(124,58,237,.12);border:1px solid rgba(124,58,237,.35);font-size:0.75rem;color:var(--color-primary-light);line-height:1.6;">
          🔑 该账号密码已被管理员重置，默认密码为：<strong style="letter-spacing:1px;">a123456</strong>，登录后请及时修改。
        </div>
      </div>
      <div style="display:flex;justify-content:space-between;align-items:center;gap:0.5rem;font-size:0.75rem;">
        <button style="background:none;border:none;color:var(--color-primary-light);cursor:pointer;padding:0;" onclick="document.getElementById('registerTab').style.display='block';document.querySelector('#modalContainer .modal-footer').style.display='none';document.getElementById('loginUser').value='';document.getElementById('loginPwd').value='';">没有账号？立即注册</button>
        <button style="background:none;border:none;color:var(--color-text-muted);cursor:pointer;padding:0;" onclick="App.showResetPasswordModal()">忘记密码？</button>
      </div>
      <div id="registerTab" style="display:none;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--color-border);">
        <h4 style="font-size:0.875rem;font-weight:600;margin-bottom:0.75rem;">注册新账号</h4>
        <div class="form-group">
          <label class="form-label">昵称</label>
          <input class="form-input" id="regNickname" placeholder="显示昵称">
        </div>
        <div class="form-group">
          <label class="form-label">账号</label>
          <input class="form-input" id="regUser" placeholder="登录账号">
        </div>
        <div class="form-group">
          <label class="form-label">密码</label>
          <input class="form-input" id="regPwd" type="password" placeholder="至少6位">
        </div>
        <button class="btn btn-primary" style="width:100%;" onclick="App.doRegister()">注册</button>
      </div>
    `, { title: '登录视觉社', width: 400 });

    setTimeout(() => {
      const footer = document.querySelector('#modalContainer .modal-footer');
      if (footer) {
        footer.innerHTML = `
          <button class="btn btn-secondary" onclick="closeModal()">取消</button>
          <button class="btn btn-primary" onclick="App.doLogin()">登录</button>
        `;
      }
    }, 50);
  }

  async function doLogin() {
    const username = document.getElementById('loginUser').value.trim();
    const pwd = document.getElementById('loginPwd').value;
    if (!username || !pwd) { toast('请输入账号和密码', 'warning'); return; }
    try {
      const r = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password: pwd }) });
      setToken(r.token);
      await refresh();
      closeModal();
      toast(`欢迎回来，${r.user.nickname}！`, 'success');
      render();
      if (r.mustChangePwd) {
        setTimeout(() => {
          showChangePasswordModal(true);
          toast('当前使用默认重置密码，请尽快修改', 'warning');
        }, 400);
      }
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  // 登录页：账号输入后识别是否被管理员重置过密码
  async function checkPwdReset() {
    const hint = document.getElementById('pwdResetHint');
    if (!hint) return;
    const username = (document.getElementById('loginUser').value || '').trim();
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { hint.style.display = 'none'; return; }
    try {
      const r = await api(`/api/auth/pwd-status?username=${encodeURIComponent(username)}`);
      hint.style.display = r.resetDefault ? 'block' : 'none';
    } catch { hint.style.display = 'none'; }
  }

  // 申请管理员重置密码（未绑定邮箱的用户走这条路）
  function showRequestResetModal() {
    openModal(`
      <div style="font-size:0.75rem;color:var(--color-text-muted);line-height:1.7;margin-bottom:1rem;">
        提交申请后请等待管理员处理。处理完成后，你在登录页输入账号时，系统会提示默认重置密码，用它登录后再修改为自己的新密码。
      </div>
      <div class="form-group">
        <label class="form-label">登录账号</label>
        <input class="form-input" id="rqUser" placeholder="你的登录账号（非昵称）" autocomplete="username">
      </div>
      <div style="font-size:0.75rem;color:var(--color-text-muted);">同一账号 10 分钟内只能申请一次。</div>
    `, { title: '申请重置密码', width: 420, onConfirm: doRequestReset });
  }

  async function doRequestReset() {
    const username = ((document.getElementById('rqUser') || {}).value || '').trim();
    if (!username) { toast('请输入登录账号', 'warning'); return false; }
    try {
      const r = await api('/api/auth/request-reset', { method: 'POST', body: JSON.stringify({ username }) });
      toast(r.message || '申请已提交', 'success');
      return true;
    } catch (e) { toast(e.message, 'error'); return false; }
  }

  // 修改密码（默认密码登录后强制修改）
  function showChangePasswordModal(forced) {
    openModal(`
      <div style="font-size:0.75rem;color:var(--color-text-muted);line-height:1.7;margin-bottom:1rem;">
        ${forced
          ? '⚠️ 你当前使用的是管理员重置的默认密码，为保障账号安全，请立即设置新密码。'
          : '修改成功后需要重新登录，其它设备的登录状态也会同步失效。'}
      </div>
      <div class="form-group">
        <label class="form-label">当前密码</label>
        <input class="form-input" id="cpOld" type="password" placeholder="当前密码（默认密码 a123456）" autocomplete="current-password">
      </div>
      <div class="form-group">
        <label class="form-label">新密码</label>
        <input class="form-input" id="cpNew" type="password" placeholder="至少 6 位，不能是 a123456" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label">确认新密码</label>
        <input class="form-input" id="cpNew2" type="password" placeholder="再输入一遍新密码" autocomplete="new-password">
      </div>
    `, { title: '修改密码', width: 420, onConfirm: doChangePassword, closeOnOverlay: false });
  }

  async function doChangePassword() {
    const oldPwd = (document.getElementById('cpOld') || {}).value || '';
    const newPwd = (document.getElementById('cpNew') || {}).value || '';
    const newPwd2 = (document.getElementById('cpNew2') || {}).value || '';
    if (!oldPwd || !newPwd || !newPwd2) { toast('请填写完整', 'warning'); return false; }
    if (newPwd.length < 6) { toast('新密码至少 6 位', 'warning'); return false; }
    if (newPwd !== newPwd2) { toast('两次输入的新密码不一致', 'warning'); return false; }
    if (newPwd === 'a123456') { toast('新密码不能与默认重置密码相同', 'warning'); return false; }
    try {
      const r = await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify({ oldPassword: oldPwd, newPassword: newPwd }) });
      toast(r.message || '密码修改成功', 'success');
      logout();
      return true;
    } catch (e) { toast(e.message, 'error'); return false; }
  }

  async function doRegister() {
    const nickname = document.getElementById('regNickname').value.trim();
    const username = document.getElementById('regUser').value.trim();
    const pwd = document.getElementById('regPwd').value;
    if (!nickname || !username || !pwd) { toast('请填写完整', 'warning'); return; }
    if (pwd.length < 6) { toast('密码至少6位', 'warning'); return; }
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) { toast('账号需为3-20位字母、数字或下划线', 'warning'); return; }
    try {
      const r = await api('/api/auth/register', { method: 'POST', body: JSON.stringify({ username, password: pwd, nickname }) });
      setToken(r.token);
      await refresh();
      closeModal();
      toast('注册成功！赠送500初始积分', 'success');
      render();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function logout() {
    setToken('');
    CACHE.me = null;
    try { await loadBootstrap(); } catch {}
    render();
    toast('已退出登录', 'success');
  }

  function showEditProfile() {
    const user = getCurrentUser();
    if (!user) return;
    openModal(`
      <div class="form-group">
        <label class="form-label">昵称</label>
        <input class="form-input" id="editNickname" value="${escapeHtml(user.nickname || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">头像 URL</label>
        <input class="form-input" id="editAvatar" value="${escapeHtml(user.avatar || '')}" placeholder="https://... 图片直链">
        ${imgHint('选择匹配的头像')}
      </div>
    `, { title: '编辑资料', onConfirm: async () => {
      const nickname = document.getElementById('editNickname').value.trim();
      const avatar = document.getElementById('editAvatar').value.trim();
      if (!nickname) { toast('昵称不能为空', 'warning'); return false; }
      try {
        await api('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ nickname, avatar }) });
        await refresh();
        toast('资料已更新', 'success');
        render();
        return true;
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
    }});
  }

  // ===== 投稿 =====
  const IMG_HOST = 'https://img.scdn.io/';
  function imgHint(text) {
    return `<div class="form-hint">${text || '选择匹配的封面/头像'}，复制链接粘贴在此 → <a href="${IMG_HOST}" target="_blank" rel="noopener noreferrer">${IMG_HOST}</a></div>`;
  }

  // 投稿草稿：关联名录 / 预览图 / 封面
  let draftPersonId = '';
  let draftImages = [''];

  function personOptionsHtml(kw) {
    const q = String(kw || '').trim().toLowerCase();
    const list = getDB('persons').filter(p =>
      !q || [p.name, p.tag, p.bio].some(f => String(f || '').toLowerCase().includes(q))
    ).slice(0, 8);
    if (!list.length) return '<div class="person-option empty">没有匹配的名录</div>';
    return list.map(p => `
      <div class="person-option" onclick="App.pickPerson('${p.id}')">
        <span class="person-option-avatar">${p.avatar ? `<img src="${escapeHtml(p.avatar)}" onerror="this.remove()">` : (p.name || '?').charAt(0)}</span>
        <span class="person-option-name">${escapeHtml(p.name)}</span>
        <span class="person-option-tag">${escapeHtml(p.tag || '')}</span>
      </div>
    `).join('');
  }

  function filterPersonOptions(kw) {
    const box = document.getElementById('postPersonOptions');
    if (!box) return;
    box.innerHTML = personOptionsHtml(kw);
    box.classList.add('show');
  }

  function pickPerson(id) {
    const p = getDB('persons').find(x => x.id === id);
    if (!p) return;
    draftPersonId = id;
    const sel = document.getElementById('personSelected');
    const wrap = document.getElementById('personSearchWrap');
    const box = document.getElementById('postPersonOptions');
    if (sel) {
      sel.style.display = 'flex';
      sel.innerHTML = `
        <span class="person-chip">
          ${p.avatar ? `<img src="${escapeHtml(p.avatar)}" onerror="this.remove()">` : ''}
          <b>${escapeHtml(p.name)}</b>
          <span class="person-chip-tag">${escapeHtml(p.tag || '')}</span>
          <button type="button" onclick="App.clearPerson()" aria-label="取消关联">×</button>
        </span>`;
    }
    if (wrap) wrap.style.display = 'none';
    if (box) { box.classList.remove('show'); box.innerHTML = ''; }
  }

  function clearPerson() {
    draftPersonId = '';
    const sel = document.getElementById('personSelected');
    const wrap = document.getElementById('personSearchWrap');
    const inp = document.getElementById('postPersonInput');
    if (sel) { sel.style.display = 'none'; sel.innerHTML = ''; }
    if (wrap) wrap.style.display = '';
    if (inp) inp.value = '';
  }

  function renderDraftImages() {
    const box = document.getElementById('postImagesBox');
    if (!box) return;
    box.innerHTML = draftImages.map((u, i) => `
      <div class="img-row">
        <div class="img-thumb ${u ? '' : 'empty'}">
          ${u ? `<img src="${escapeHtml(u)}" onerror="this.parentNode.classList.add('bad');this.remove()">` : '<i class="fas fa-image"></i>'}
        </div>
        <input class="form-input" value="${escapeHtml(u)}" placeholder="https://... 图片直链" oninput="App.onDraftImageInput(${i}, this.value)">
        <button type="button" class="img-del" title="删除" onclick="App.removeDraftImage(${i})">×</button>
      </div>
    `).join('') + `
      <button type="button" class="btn btn-secondary btn-sm" onclick="App.addDraftImage()" ${draftImages.length >= 5 ? 'disabled' : ''}>
        + 添加预览图（${draftImages.length}/5）
      </button>`;
  }

  function onDraftImageInput(i, val) {
    draftImages[i] = val;
    const box = document.getElementById('postImagesBox');
    const row = box && box.querySelectorAll('.img-row')[i];
    if (!row) return;
    const thumb = row.querySelector('.img-thumb');
    thumb.classList.remove('bad', 'empty');
    thumb.innerHTML = val.trim()
      ? `<img src="${escapeHtml(val.trim())}" onerror="this.parentNode.classList.add('bad');this.remove()">`
      : '<i class="fas fa-image"></i>';
  }

  function addDraftImage() {
    if (draftImages.length >= 5) return;
    draftImages.push('');
    renderDraftImages();
  }

  function removeDraftImage(i) {
    draftImages.splice(i, 1);
    if (!draftImages.length) draftImages = [''];
    renderDraftImages();
  }

  function collectImages() {
    return draftImages.map(s => String(s || '').trim()).filter(s => /^https?:\/\//i.test(s)).slice(0, 5);
  }

  function showSubmitModal(defaultType = '') {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }

    draftPersonId = '';
    draftImages = [''];
    const cats = getDB('categories');
    const modal = openModal(`
      <div style="display:flex;gap:0.25rem;margin-bottom:1rem;background:var(--color-card);padding:0.25rem;border-radius:var(--radius-sm);">
        <button class="forum-tab ${defaultType !== 'share' ? 'active' : ''}" id="tabDemand" onclick="switchSubmitTab('demand')">🔍 求资源</button>
        <button class="forum-tab ${defaultType === 'share' ? 'active' : ''}" id="tabShare" onclick="switchSubmitTab('share')">📤 我分享</button>
      </div>

      <div id="formDemand" style="${defaultType === 'share' ? 'display:none;' : ''}">
        <div class="form-group">
          <label class="form-label">资源名称 / 需求描述<span class="required">*</span></label>
          <input class="form-input" id="demandTitle" placeholder="描述清楚要找什么">
        </div>
        <div class="form-group">
          <label class="form-label">资源类型<span class="required">*</span></label>
          <select class="form-select" id="demandType">
            ${cats.resourceTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">期望网盘<span class="required">*</span></label>
          <div class="checkbox-group" id="demandNetdisk">
            ${['百度网盘', '阿里云盘', '夸克网盘', '不限'].map(t => `<label class="checkbox-item"><input type="checkbox" value="${t}">${t}</label>`).join('')}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">悬赏积分（0=普通求帖）</label>
          <input class="form-input" id="demandReward" type="number" min="0" max="5000" value="0">
          <div class="form-hint">发帖即冻结对应可用积分，上限 5000</div>
        </div>
        <div class="form-group">
          <label class="form-label">补充说明</label>
          <textarea class="form-textarea" id="demandContent" placeholder="补充细节，比如版本、画质、格式等"></textarea>
        </div>
      </div>

      <div id="formShare" style="${defaultType === 'share' ? '' : 'display:none;'}">
        <div class="form-group">
          <label class="form-label">资源名称<span class="required">*</span></label>
          <input class="form-input" id="shareTitle" placeholder="例如：XX设计素材包完整版">
        </div>
        <div class="form-row form-row-wide-right">
          <div class="form-group">
            <label class="form-label">网盘类型<span class="required">*</span></label>
            <select class="form-select" id="shareNetdisk">
              ${cats.netdiskTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">网盘链接<span class="required">*</span></label>
            <input class="form-input" id="shareLink" placeholder="https://pan.baidu.com/s/...">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">提取码</label>
            <input class="form-input" id="shareExtract" placeholder="如有则填">
          </div>
          <div class="form-group">
            <label class="form-label">解压码 <span class="form-optional">可选</span></label>
            <input class="form-input" id="shareUnpack" placeholder="压缩包解压密码，如有则填">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">资源类型</label>
            <select class="form-select" id="shareType">
              ${cats.resourceTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">查看所需积分</label>
            <input class="form-input" id="shareUnlock" type="number" min="0" max="5000" value="0">
            <div class="form-hint">0 = 免费公开；>0 时他人消耗积分解锁；上限 5000</div>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">资源介绍<span class="required">*</span></label>
          <textarea class="form-textarea" id="shareContent" placeholder="内容简介、版本、画质、格式等"></textarea>
        </div>
      </div>
    `, { title: '发布投稿', onConfirm: () => submitPost(defaultType || currentSubmitType) });
  }

  let currentSubmitType = 'demand';
  function switchSubmitTab(type) {
    currentSubmitType = type;
    document.getElementById('formDemand').style.display = type === 'demand' ? '' : 'none';
    document.getElementById('formShare').style.display = type === 'share' ? '' : 'none';
    document.getElementById('tabDemand').classList.toggle('active', type === 'demand');
    document.getElementById('tabShare').classList.toggle('active', type === 'share');
  }

  async function submitPost(type) {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return false; }
    const points = getUserPoints();

    const images = collectImages();
    if (images.length > 5) { toast('预览图最多 5 张', 'warning'); return false; }
    const cover = ((document.getElementById('postCover') || {}).value || '').trim();
    if (cover && !/^https?:\/\//i.test(cover)) { toast('封面图请填写图片直链（http/https）', 'warning'); return false; }
    const thumb = ((document.getElementById('postThumb') || {}).value || '').trim();
    if (thumb && !/^https?:\/\//i.test(thumb)) { toast('列表缩略图请填写图片直链（http/https）', 'warning'); return false; }
    const personId = draftPersonId;

    if (type === 'demand') {
      const title = document.getElementById('demandTitle').value.trim();
      const resourceType = document.getElementById('demandType').value;
      const netdiskPref = Array.from(document.querySelectorAll('#demandNetdisk input:checked')).map(i => i.value);
      const rewardPoint = parseInt(document.getElementById('demandReward').value) || 0;
      const content = document.getElementById('demandContent').value.trim();

      if (!title) { toast('请填写需求描述', 'warning'); return false; }
      if (netdiskPref.length === 0) { toast('请选择至少一个网盘偏好', 'warning'); return false; }
      if (rewardPoint > 5000) { toast('悬赏上限5000', 'warning'); return false; }
      if (rewardPoint > points.available) { toast(`可用积分不足（当前${points.available}）`, 'error'); return false; }

      try {
        await api('/api/posts', { method: 'POST', body: JSON.stringify({
          type: 'demand', title, content, resourceType, netdiskPref, rewardPoint, personId, images, cover, thumb
        }) });
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
      await refresh();
      toast(rewardPoint > 0 ? `已发布求资源，冻结 ${rewardPoint} 积分，待通过审核后展示` : '已发布求资源，待通过审核后展示', 'success');
    } else {
      const title = document.getElementById('shareTitle').value.trim();
      const netdiskType = document.getElementById('shareNetdisk').value;
      const link = document.getElementById('shareLink').value.trim();
      const extractCode = document.getElementById('shareExtract').value.trim();
      const unzipCode = document.getElementById('shareUnpack').value.trim();
      const resourceType = document.getElementById('shareType').value;
      const unlockPoint = parseInt(document.getElementById('shareUnlock').value) || 0;
      const content = document.getElementById('shareContent').value.trim();

      if (!title || !link || !content) { toast('请填写完整必填项', 'warning'); return false; }
      if (!/^https?:\/\//.test(link)) { toast('请输入有效链接', 'warning'); return false; }
      if (unlockPoint > 5000) { toast('解锁积分上限5000', 'warning'); return false; }

      try {
        await api('/api/posts', { method: 'POST', body: JSON.stringify({
          type: 'share', title, content, resourceType, netdiskType, link, extractCode, unzipCode, unlockPoint, personId, images, cover, thumb
        }) });
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }
      await refresh();
      toast('分享发布成功！待通过审核后展示', 'success');
    }

    render();
    return true;
  }

  /* 作者编辑帖子：保存后重新进入待审核 */
  async function editPost(id) {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }
    const local = getDB('posts').find(x => x.id === id);
    let p = local || (CACHE.postDetail && CACHE.postDetail.id === id ? CACHE.postDetail : null);
    if (!p) {
      try { p = await api(`/api/posts/${encodeURIComponent(id)}`); } catch { toast('帖子不存在', 'error'); return; }
    }
    if (p.userId !== user.id && user.role !== 'admin') { toast('只能编辑自己的帖子', 'warning'); return; }

    const cats = getDB('categories');
    const isShare = p.type === 'share';
    draftPersonId = p.personId || '';
    draftImages = (Array.isArray(p.images) && p.images.length ? p.images.slice(0, 5) : ['']);

    const modal = openModal(`
      <div class="form-group">
        <label class="form-label">标题<span class="required">*</span></label>
        <input class="form-input" id="editTitle" value="${escapeHtml(p.title || '')}">
      </div>
      ${isShare ? `
        <div class="form-row form-row-wide-right">
          <div class="form-group">
            <label class="form-label">网盘类型</label>
            <select class="form-select" id="editNetdisk">
              ${cats.netdiskTypes.map(t => `<option value="${t}" ${t === p.netdiskType ? 'selected' : ''}>${t}</option>`).join('')}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">网盘链接<span class="required">*</span></label>
            <input class="form-input" id="editLink" value="${escapeHtml(p.link || '')}">
          </div>
        </div>
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">提取码</label>
            <input class="form-input" id="editExtract" value="${escapeHtml(p.extractCode || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">解压码 <span class="form-optional">可选</span></label>
            <input class="form-input" id="editUnpack" value="${escapeHtml(p.unzipCode || '')}" placeholder="压缩包解压密码">
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">查看所需积分</label>
          <input class="form-input" id="editUnlock" type="number" min="0" max="5000" value="${p.unlockPoint || 0}">
        </div>
      ` : ''}
      <div class="form-group">
        <label class="form-label">内容<span class="required">*</span></label>
        <textarea class="form-textarea" id="editContent" rows="5">${escapeHtml(p.content || '')}</textarea>
      </div>

      <div class="form-divider"><span>关联与配图</span></div>

      <div class="form-group">
        <label class="form-label">关联名录 <span class="form-optional">可选</span></label>
        <div id="personSearchWrap">
          <input class="form-input" id="postPersonInput" placeholder="搜索站内人物姓名 / 标签" autocomplete="off"
            oninput="App.filterPersonOptions(this.value)" onfocus="App.filterPersonOptions(this.value)">
          <div class="person-options" id="postPersonOptions"></div>
        </div>
        <div class="person-selected" id="personSelected" style="display:none;"></div>
      </div>

      <div class="form-group">
        <label class="form-label">封面图 <span class="form-optional">可选</span></label>
        <input class="form-input" id="postCover" value="${escapeHtml(p.cover || '')}" placeholder="https://... 图片直链">
        ${imgHint('选择匹配的封面')}
      </div>

      <div class="form-group">
        <label class="form-label">列表缩略图 <span class="form-optional">可选</span></label>
        <input class="form-input" id="postThumb" value="${escapeHtml(p.thumb || '')}" placeholder="${escapeHtml(defaultThumb())}">
        <div class="form-hint">论坛列表左侧展示的方图，留空则使用默认缩略图；与封面图相互独立 → <a href="${IMG_HOST}" target="_blank" rel="noopener noreferrer">${IMG_HOST}</a></div>
      </div>

      <div class="form-group">
        <label class="form-label">预览图 <span class="form-optional">1-5 张</span></label>
        <div class="img-list" id="postImagesBox"></div>
        ${imgHint('选择匹配的封面图')}
      </div>
      <div class="form-hint" style="color:var(--color-warning);">
        <i class="fas fa-info-circle"></i> 修改保存后会重新进入审核，通过前不会在论坛展示。
      </div>
    `, {
      title: '编辑帖子', width: 720, closeOnOverlay: false,
      onConfirm: async () => {
        const title = document.getElementById('editTitle').value.trim();
        const content = document.getElementById('editContent').value.trim();
        if (!title || !content) { toast('标题和内容不能为空', 'warning'); return false; }

        const body = {
          title, content,
          personId: draftPersonId,
          images: collectImages(),
          cover: (document.getElementById('postCover').value || '').trim(),
          thumb: (document.getElementById('postThumb').value || '').trim(),
        };
        if (body.thumb && !/^https?:\/\//i.test(body.thumb)) { toast('列表缩略图请填写图片直链（http/https）', 'warning'); return false; }
        if (isShare) {
          body.netdiskType = document.getElementById('editNetdisk').value;
          body.link = document.getElementById('editLink').value.trim();
          body.extractCode = document.getElementById('editExtract').value.trim();
          body.unzipCode = document.getElementById('editUnpack').value.trim();
          body.unlockPoint = parseInt(document.getElementById('editUnlock').value, 10) || 0;
          if (!body.link || !/^https?:\/\//.test(body.link)) { toast('请填写有效的网盘链接', 'warning'); return false; }
        }

        try {
          await api(`/api/posts/${encodeURIComponent(p.id)}`, { method: 'PATCH', body: JSON.stringify(body) });
        } catch (e) {
          toast(e.message, 'error');
          return false;
        }
        await refresh();
        CACHE.postDetail = await api(`/api/posts/${encodeURIComponent(p.id)}`).catch(() => null);
        toast('已提交修改，等待管理员审核', 'success');
        render();
        return true;
      },
    });

    renderDraftImages();
    if (draftPersonId) pickPerson(draftPersonId);
    return modal;
  }

  function showWorkSubmitModal(personId) {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }
    const cats = getDB('categories');

    const modal = openModal(`
      <div class="form-group">
        <label class="form-label">作品名称<span class="required">*</span></label>
        <input class="form-input" id="workTitle" placeholder="例如：XX写真集高清版">
      </div>
      <div class="form-group">
        <label class="form-label">网盘类型<span class="required">*</span></label>
        <select class="form-select" id="workNetdisk">
          ${cats.netdiskTypes.map(t => `<option value="${t}">${t}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">网盘链接<span class="required">*</span></label>
        <input class="form-input" id="workLink" placeholder="https://...">
      </div>
      <div class="form-group">
        <label class="form-label">提取码</label>
        <input class="form-input" id="workExtract" placeholder="如有则填">
      </div>
      <div class="form-group">
        <label class="form-label">封面图 <span class="form-optional">可选</span></label>
        <input class="form-input" id="workCover" placeholder="https://... 图片直链">
        ${imgHint('选择匹配的封面')}
      </div>
      <div class="form-group">
        <label class="form-label">作品简介</label>
        <textarea class="form-textarea" id="workContent" placeholder="作品简介、版本、画质等"></textarea>
      </div>
    `, { title: '投稿该人物作品', onConfirm: async () => {
      const title = document.getElementById('workTitle').value.trim();
      const netdiskType = document.getElementById('workNetdisk').value;
      const link = document.getElementById('workLink').value.trim();
      const extractCode = document.getElementById('workExtract').value.trim();
      const content = document.getElementById('workContent').value.trim();
      const cover = document.getElementById('workCover').value.trim();

      if (!title || !link) { toast('请填写完整', 'warning'); return false; }

      try {
        await api('/api/works', { method: 'POST', body: JSON.stringify({
          personId, title, netdiskType, link, extractCode, content, cover
        }) });
      } catch (e) {
        toast(e.message, 'error');
        return false;
      }

      toast('投稿成功！待审核通过后展示', 'success');
      render();
      return true;
    }});
  }

  // ===== 关于页 / 静态页 =====
  function renderAbout() {
    return `
      <div class="page-layout">
        <div class="main-content">
          <div style="background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:2rem;">
            <h1 style="font-size:1.5rem;font-weight:700;margin-bottom:1rem;">关于视觉社</h1>
            <p style="color:var(--color-text-secondary);line-height:1.8;margin-bottom:1rem;">
              视觉社是一个用户投稿、网盘外链信息交流社区站点。本站定位为轻社区型资源信息交流平台，首页由站长发布精选推荐文章并挂载用户资源卡片；社区分为「求资源」与「我分享」两个固定模板投稿板块；「姬查查」名录收录网红/明星资料并展示网友投稿作品贴；所有用户投稿内容默认审核通过后才公开展示。
            </p>
            <p style="color:var(--color-text-secondary);line-height:1.8;margin-bottom:1rem;">
              站内引入虚拟积分体系，用于悬赏求资源与积分解锁网盘链接。每日签到可获得 100-200 随机积分。
            </p>
            <h2 style="font-size:1rem;font-weight:600;margin:1.5rem 0 0.75rem;">三大板块</h2>
            <ul style="color:var(--color-text-secondary);padding-left:1.25rem;line-height:2;">
              <li><strong style="color:var(--color-primary-light);">📌 站长推荐</strong> - 优质资源文章种草，带关联资源推荐</li>
              <li><strong style="color:var(--color-primary-light);">🔍 求资源 / 📤 我分享</strong> - 固定模板投稿，降低审核成本</li>
              <li><strong style="color:var(--color-primary-light);">👥 姬查查名录</strong> - 网红明星资料 + 网友作品瀑布流</li>
            </ul>
            <h2 style="font-size:1rem;font-weight:600;margin:1.5rem 0 0.75rem;">积分体系</h2>
            <ul style="color:var(--color-text-secondary);padding-left:1.25rem;line-height:2;">
              <li>每日签到 +100~200 随机积分</li>
              <li>新用户注册赠送 500 初始积分</li>
              <li>发布悬赏帖时冻结对应积分</li>
              <li>消耗积分解锁他人网盘信息，一次扣费永久可见</li>
            </ul>
          </div>
        </div>
        <aside class="sidebar">
          <div class="sidebar-card">
            <div class="sidebar-header"><div class="sidebar-title">快速导航</div></div>
            <div class="sidebar-body">
              <div style="display:flex;flex-direction:column;gap:0.5rem;">
                <a onclick="App.navigate('home')" style="cursor:pointer;font-size:0.8125rem;color:var(--color-text-secondary);">🏠 首页</a>
                <a onclick="App.navigate('forum')" style="cursor:pointer;font-size:0.8125rem;color:var(--color-text-secondary);">💬 社区论坛</a>
                <a onclick="App.navigate('jicha')" style="cursor:pointer;font-size:0.8125rem;color:var(--color-text-secondary);">👥 姬查查名录</a>
                <a onclick="App.navigate('profile')" style="cursor:pointer;font-size:0.8125rem;color:var(--color-text-secondary);">👤 用户中心</a>
              </div>
            </div>
          </div>
        </aside>
      </div>
    `;
  }

  function showRule() { openModal(`<div style="max-height:60vh;overflow-y:auto;font-size:0.8125rem;line-height:1.8;color:var(--color-text-secondary);">
    <h3 style="color:var(--color-text);margin-bottom:0.5rem;">社区规则</h3>
    <p>1. 禁止发布盗版付费资源、色情、赌博、诈骗、翻墙资源、政治敏感、毒品枪支等违禁内容</p>
    <p>2. 分享帖禁止直接放链接在评论区，需走「我分享」投稿</p>
    <p>3. 禁止恶意刷积分、批量注册、脚本签到等作弊行为</p>
    <p>4. 尊重版权，若收到投诉 24 小时内下架</p>
    <p>5. 多次违规者永久禁言、清空积分、删除账号</p>
  </div>`, { title: '社区规则', hideFooter: true }); }

  function showDisclaimer() { openModal(`<div style="max-height:60vh;overflow-y:auto;font-size:0.8125rem;line-height:1.8;color:var(--color-text-secondary);">
    <h3 style="color:var(--color-danger);margin-bottom:0.5rem;">免责声明</h3>
    <p>本站为用户投稿、网盘外链信息交流站点，<strong style="color:var(--color-text);">网站本身不存储任何资源文件</strong>，所有资源由网友自行投稿提供。</p>
    <p>本站提供的所有网盘链接均由用户自行投稿，仅供信息交流，不代表本站立场和任何推荐。</p>
    <p>用户自行承担网盘访问风险，包括但不限于链接失效、资源不符预期、网盘安全风险等。</p>
    <p>如存在侵权行为，请联系站长提供版权证明，本站 24 小时内下架相关帖子。</p>
  </div>`, { title: '免责声明', hideFooter: true }); }

  function showPrivacy() { openModal(`<div style="max-height:60vh;overflow-y:auto;font-size:0.8125rem;line-height:1.8;color:var(--color-text-secondary);">
    <h3 style="color:var(--color-text);margin-bottom:0.5rem;">隐私政策</h3>
    <p>本站仅存储用户注册信息（账号、昵称）、积分流水和投稿记录，不收集无关个人信息。</p>
    <p>用户账号、积分与投稿数据保存在本站服务器数据库中，用于多端同步；不会向第三方出售或共享。</p>
    <p>积分属于站内虚拟数值，无任何现金价值，不可提现、转账、买卖。</p>
  </div>`, { title: '隐私政策', hideFooter: true }); }

  function showReport() { openModal(`
    <div class="form-group">
      <label class="form-label">举报类型</label>
      <select class="form-select" id="reportType">
        <option value="copyright">版权侵权</option>
        <option value="illegal">违法违规内容</option>
        <option value="spam">垃圾广告</option>
        <option value="other">其他</option>
      </select>
    </div>
    <div class="form-group">
      <label class="form-label">问题描述</label>
      <textarea class="form-textarea" id="reportContent" placeholder="请描述问题..."></textarea>
    </div>
  `, { title: '举报违规内容', onConfirm: () => {
    toast('举报已提交，感谢您的反馈！', 'success');
    return true;
  }}); }

  // ===== 工具函数 =====
  function timeAgo(ts) {
    const diff = Date.now() - ts;
    const s = Math.floor(diff / 1000);
    if (s < 60) return '刚刚';
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}分钟前`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}小时前`;
    const d = Math.floor(h / 24);
    if (d < 30) return `${d}天前`;
    return new Date(ts).toLocaleDateString('zh-CN');
  }

  function getStatusLabel(s) {
    const map = { pending: '审核中', approved: '已通过', rejected: '已驳回' };
    return map[s] || s;
  }
  function getStatusTagClass(s) {
    const map = { pending: 'tag tag-yellow', approved: 'tag tag-green', rejected: 'tag tag-red' };
    return map[s] || 'tag';
  }

  function getPointTypeName(type) {
    const map = {
      register: '新用户注册', sign: '每日签到', admin_give: '管理员发放',
      unlock_post: '解锁资源', unlock_article: '解锁文章网盘', first_comment: '文章首评奖励',
      demand_freeze: '悬赏冻结', demand_reward: '悬赏兑现',
      demand_unfreeze: '悬赏退回', admin_reset: '管理员调整'
    };
    return map[type] || type;
  }

  // ===== 文章内容格式化 =====
  function escapeHtml(s) {
    return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  // 把文本中的 URL 变成可点击超链接（raw 未转义文本，输出已转义）
  function linkifyRaw(raw) {
    return String(raw).split(/(https?:\/\/[^\s<>"'\)\]]+)/g).map((p, i) =>
      i % 2
        ? `<a href="${escapeHtml(p)}" target="_blank" rel="noopener nofollow">${escapeHtml(p)}</a>`
        : escapeHtml(p)
    ).join('');
  }
  // 对已转义文本做链接化（避免吞掉行尾残留实体）
  function linkifyEscaped(escaped) {
    return escaped.split(/(https?:\/\/[^\s<>&'\)\]]+(?:&amp;[^\s<>&'\)\]]+)*)/g).map((p, i) =>
      i % 2
        ? `<a href="${p}" target="_blank" rel="noopener nofollow">${p}</a>`
        : p
    ).join('');
  }
  // 正文渲染：兼容后台 HTML 内容与纯文本投稿（自动段落 + 超链接 + **加粗** + ==高亮==）
  function formatArticleContent(raw) {
    const s = String(raw || '');
    const applyInline = seg => seg
      .replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>')
      .replace(/==([^=\n]+)==/g, '<mark>$1</mark>');
    if (/<[a-z][\s\S]*>/i.test(s)) {
      // 已是 HTML（后台编辑器产出）：只处理标签外的文本片段，不重复转义
      return s.split(/(<[^>]+>)/g).map(seg =>
        seg.startsWith('<') ? seg
          : applyInline(seg).replace(/(https?:\/\/[^\s<>"'\)\]]+)/g,
            u => `<a href="${u}" target="_blank" rel="noopener nofollow">${u}</a>`)
      ).join('');
    }
    // 纯文本：先转义 → 链接化 → 再插入加粗/高亮标签 → 空行分段、单换行转 <br>
    const escaped = linkifyEscaped(escapeHtml(s));
    return applyInline(escaped)
      .split(/\n{2,}/)
      .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
      .join('');
  }

  function copyText(text) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => toast('已复制到剪贴板', 'success'));
    } else {
      const ta = document.createElement('textarea');
      ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand('copy'); document.body.removeChild(ta);
      toast('已复制到剪贴板', 'success');
    }
  }

  function toast(msg, type = 'success') {
    const container = document.getElementById('toastContainer');
    const t = document.createElement('div');
    t.className = `toast toast-${type}`;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 2500);
  }

  function openModal(content, options = {}) {
    closeModal();
    const container = document.getElementById('modalContainer');
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay show';
    overlay.innerHTML = `
      <div class="modal" style="${options.width ? `max-width:${options.width}px;` : ''}">
        ${options.title !== undefined ? `
          <div class="modal-header">
            <h3 class="modal-title">${options.title}</h3>
            ${options.hideClose ? '' : '<button class="modal-close" onclick="closeModal()"><i class="fas fa-times"></i></button>'}
          </div>
        ` : ''}
        <div class="modal-body">${content}</div>
        ${options.hideFooter ? '' : `
          <div class="modal-footer">
            <button class="btn btn-secondary" onclick="closeModal()">取消</button>
            ${options.onConfirm ? `<button class="btn btn-primary" data-action="confirm">确定</button>` : ''}
          </div>
        `}
      </div>
    `;
    container.appendChild(overlay);

    if (options.onConfirm) {
      setTimeout(() => {
        overlay.querySelector('[data-action="confirm"]')?.addEventListener('click', async () => {
          const result = options.onConfirm();
          if (result && typeof result.then === 'function') {
            if (await result) closeModal();
          } else if (result) {
            closeModal();
          }
        });
      }, 10);
    }

    overlay.addEventListener('click', (e) => {
      // 多选芯片：同步选中态（label 原生切换 checkbox，这里补视觉类）
      const chip = e.target.closest && e.target.closest('.checkbox-item');
      if (chip) {
        const cb = chip.querySelector('input[type="checkbox"]');
        if (cb) setTimeout(() => {
          chip.classList.toggle('selected', cb.checked);
          // 「不限」与其他选项互斥
          if (cb.checked && cb.value === '不限') {
            chip.parentElement.querySelectorAll('.checkbox-item').forEach(it => {
              if (it === chip) return;
              const c = it.querySelector('input');
              if (c) c.checked = false;
              it.classList.remove('selected');
            });
          } else if (cb.checked) {
            const un = [...chip.parentElement.querySelectorAll('.checkbox-item')]
              .find(it => (it.querySelector('input') || {}).value === '不限');
            if (un) {
              const uc = un.querySelector('input');
              if (uc) uc.checked = false;
              un.classList.remove('selected');
            }
          }
        }, 0);
      }
      if (e.target === overlay) closeModal();
    });

    return overlay;
  }

  function closeModal() {
    const container = document.getElementById('modalContainer');
    container.innerHTML = '';
  }

  // ===== 明暗主题 =====
  function syncThemeIcon() {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const light = document.documentElement.getAttribute('data-theme') === 'light';
    btn.innerHTML = light ? '<i class="fas fa-moon"></i>' : '<i class="fas fa-sun"></i>';
    btn.title = light ? '切换到暗色模式' : '切换到亮色模式';
  }
  function toggleTheme() {
    const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('vs-theme', next); } catch (e) {}
    syncThemeIcon();
  }

  // ===== 启动 =====
  async function init() {
    // 初始导航高亮
    const links = document.querySelectorAll('.nav-link');
    links.forEach(l => l.classList.toggle('active', l.dataset.route === 'home'));
    syncThemeIcon();
    try {
      await loadBootstrap();
      if (getToken()) await loadMe();
      await loadLbPreview();
      loadUserLevels().then(() => { render(); renderNav(); });
    } catch (e) {
      console.error(e);
      toast('数据加载失败，请稍后刷新页面', 'error');
    }
    render();
    // 切回页面 / 多端切换时自动同步
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refresh().then(() => render()).catch(() => {});
    });
    document.getElementById('loadingOverlay').style.opacity = '0';
    setTimeout(() => document.getElementById('loadingOverlay').style.display = 'none', 300);
  }

  const publicAPI = {
    init, render, navigate, renderNav, toggleMobileMenu, handleSearch, searchNow,
    showLoginModal, doLogin, doRegister, logout, showEditProfile,
    showBindEmailModal, showResetPasswordModal, sendEmailCode,
    checkPwdReset, showRequestResetModal, showChangePasswordModal,
    showSubmitModal, switchSubmitTab, switchForumTab, showWorkSubmitModal,
    filterPersonOptions, pickPerson, clearPerson, addDraftImage, removeDraftImage, onDraftImageInput,
    openArticle, openPost, openPerson, openWork, unlockPost, doSignin, editPost,
    postArticleComment, mentionAdmin, loadPostComments,
    openCheckin, goCheckinPage, openFeatured, goFeaturedPage,
    postComment, unlockArticle, copyText,
    showRule, showDisclaimer, showPrivacy, showReport, toggleUserMenu, toggleTheme
  };

  // 挂到全局
  window.App = publicAPI;
  window.closeModal = closeModal;
  window.openArticle = openArticle;
  window.openPost = openPost;
  window.openPerson = openPerson;
  window.switchSubmitTab = switchSubmitTab;
  window.copyText = copyText;
  window.toast = toast;
  window.showBannerSlide = showBannerSlide;
  window.startBannerCarousel = startBannerCarousel;

  return publicAPI;
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
