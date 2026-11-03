/* ============================================
   视觉社 · 核心应用逻辑
   数据由后端 API 提供（/api/*），前端内存缓存
   ============================================ */

const App = (() => {
  // ===== 数据层 =====
  const TOKEN_KEY = 'vision_token';
  const CACHE = {
    articles: [], posts: [], persons: [], works: [], banner: [],
    categories: { resourceTypes: [], netdiskTypes: [], personTags: [] },
    me: null, articleDetail: null, postDetail: null
  };

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
    CACHE.me = data.me || null;
  }

  async function loadMe() {
    if (!getToken()) { CACHE.me = null; return; }
    try {
      const data = await api('/api/auth/me');
      CACHE.me = {
        user: data.user,
        points: data.points,
        signedToday: !!data.signedToday,
        myUnlocked: data.myUnlocked || [],
        myPosts: data.myPosts || [],
        logs: data.logs || [],
        signRecords: data.signRecords || []
      };
    } catch { CACHE.me = null; }
  }

  async function refresh() { await loadBootstrap(); await loadMe(); }

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


  // ===== 签到系统 =====
  async function doSignin() {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }
    if (hasSignedToday()) { toast('今日已签到，明天再来吧', 'warning'); return; }

    try {
      const r = await api('/api/auth/signin', { method: 'POST', body: '{}' });
      await loadMe();
      showSigninResult(r.reward);
      renderNav();
      render();
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  function hasSignedToday() { return !!(CACHE.me && CACHE.me.signedToday); }

  function showSigninResult(point) {
    const modal = openModal(`
      <div class="signin-result">
        <div class="signin-result-icon"><i class="fas fa-gift"></i></div>
        <div class="signin-result-title">🎉 签到成功！</div>
        <div class="signin-result-points">+${point}</div>
        <div class="signin-result-sub">今日已获得签到积分</div>
      </div>
    `, { hideFooter: true, hideClose: true });
    setTimeout(() => closeModal(modal), 2000);
  }

  // ===== 导航 =====
  let currentRoute = 'home';
  let searchQuery = '';

  function navigate(route) {
    currentRoute = route;
    const links = document.querySelectorAll('.nav-link');
    links.forEach(l => l.classList.toggle('active', l.dataset.route === route));

    const root = document.getElementById('appRoot');
    root.classList.remove('fade-in');
    void root.offsetWidth;
    root.classList.add('fade-in');

    render();
    if (route === 'profile' && getToken()) {
      loadMe().then(() => { if (currentRoute === 'profile') { renderNav(); render(); } }).catch(() => {});
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function toggleMobileMenu() {
    const menu = document.getElementById('mobileMenu');
    menu.style.display = menu.style.display === 'flex' ? 'none' : 'flex';
  }

  function handleSearch(q) {
    searchQuery = q.trim().toLowerCase();
    if (currentRoute !== 'forum' && currentRoute !== 'home') return;
    render();
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
            <span class="user-name">${user.nickname || '用户'}</span>
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
  }

  // ===== 首页 =====
  function renderHome() {
    const banners = getDB('banner');
    const articles = getDB('articles').sort((a, b) => (b.pinned - a.pinned) || (b.createdAt - a.createdAt));
    const posts = getDB('posts').filter(p => p.status === 'approved');
    const latestShares = posts.filter(p => p.type === 'share').slice(0, 5);
    const latestDemands = posts.filter(p => p.type === 'demand').slice(0, 5);

    return `
      ${renderBanner(banners)}

      <div class="page-layout">
        <div class="main-content">
          <div class="section-header">
            <h2 class="section-title">站长推荐<span class="section-count">${articles.length} 篇</span></h2>
          </div>
          <div class="article-grid">
            ${articles.length > 0 ? articles.map(renderArticleCard).join('') : `
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
          <div class="sidebar-card">
            <div class="sidebar-header">
              <div class="sidebar-title"><i class="fas fa-check-circle"></i> 最新通过审核</div>
            </div>
            <div class="sidebar-body">
              ${latestShares.length > 0 ? latestShares.slice(0, 4).map(p => `
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
              ${latestDemands.length > 0 ? latestDemands.slice(0, 4).map(p => `
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
              欢迎来到视觉社！本站为用户投稿、网盘外链信息交流站点。<br><br>
              ⚠️ 本站不存储任何资源文件，所有资源由网友自行投稿，请注意甄别资源有效性。<br><br>
              🎯 每日签到100-200积分，积分解锁优质分享帖。
            </div>
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

  function renderArticleCard(a) {
    return `
      <article class="article-card" onclick="App.openArticle('${a.id}')">
        <div class="article-card-cover">
          ${a.pinned ? '<span class="article-card-badge"><i class="fas fa-thumbtack"></i> 置顶</span>' : ''}
          <img src="${a.cover}" alt="${a.title}" loading="lazy">
        </div>
        <div class="article-card-body">
          <div class="article-card-title">${a.title}</div>
          <div class="article-card-excerpt">${a.excerpt || ''}</div>
          <div class="article-card-footer">
            <span class="footer-main"><i class="fas fa-user"></i> ${a.author}</span>
            <span class="footer-main"><i class="fas fa-eye"></i> ${a.views || 0}</span>
            <span class="footer-time">${timeAgo(a.createdAt)}</span>
          </div>
        </div>
      </article>
    `;
  }

  function renderSharePostCard(p) {
    return `
      <div class="post-card" onclick="App.openPost('${p.id}')">
        <div class="post-card-header">
          <div class="post-card-title">📤 ${p.title}</div>
          <div class="post-card-tags">
            ${p.unlockPoint > 0 ? `<span class="lock-tag">🔒 ${p.unlockPoint}积分</span>` : `<span class="tag tag-green">免费</span>`}
          </div>
        </div>
        <div class="post-card-meta" style="font-size:0.75rem;color:var(--color-text-muted);">
          <span class="tag">${p.netdiskType}</span>
          <span>📂 ${p.resourceType}</span>
        </div>
        <div class="post-card-footer" style="margin-top:0.5rem;">
          <span>分享者：${p.userName}</span>
          <span>${timeAgo(p.createdAt)}</span>
        </div>
      </div>
    `;
  }

  function renderDemandPostCard(p) {
    return `
      <div class="post-card" onclick="App.openPost('${p.id}')">
        <div class="post-card-header">
          <div class="post-card-title">🔍 ${p.title}</div>
          <div class="post-card-tags">
            ${p.rewardPoint > 0 ? `<span class="reward-tag">🏆 ${p.rewardPoint}积分</span>` : '<span class="tag tag-gray">无悬赏</span>'}
          </div>
        </div>
        <div class="post-card-meta" style="font-size:0.75rem;color:var(--color-text-muted);">
          <span class="tag">${p.resourceType}</span>
          <span>网盘偏好：${(p.netdiskPref || []).join('/')}</span>
        </div>
        <div class="post-card-footer" style="margin-top:0.5rem;">
          <span>求方：${p.userName}</span>
          <span>${p.isFinish ? '<span style="color:var(--color-success);">已结单</span>' : '<span style="color:var(--color-warning);">待接单</span>'}</span>
          <span>${timeAgo(p.createdAt)}</span>
        </div>
      </div>
    `;
  }

  // ===== 文章详情 =====
  function openArticle(id) {
    currentRoute = 'article';
    sessionStorage.setItem('currentId', id);
    CACHE.articleDetail = null;
    render();
    api(`/api/articles/${encodeURIComponent(id)}`).then(a => {
      CACHE.articleDetail = a;
      if (currentRoute === 'article' && sessionStorage.getItem('currentId') === id) render();
    }).catch(() => {});
  }

  function renderArticle() {
    const id = sessionStorage.getItem('currentId');
    const a = (CACHE.articleDetail && CACHE.articleDetail.id === id)
      ? CACHE.articleDetail
      : getDB('articles').find(x => x.id === id);
    if (!a) return '<div class="empty-state"><div class="empty-state-text">文章不存在</div></div>';

    const relatedPosts = getDB('posts').filter(p => p.status === 'approved' && p.type === 'share').slice(0, 4);

    return `
      <div class="detail-page">
      <button onclick="App.navigate('home')" style="display:inline-flex;align-items:center;gap:0.5rem;background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.875rem;margin-bottom:1rem;">
        <i class="fas fa-arrow-left"></i> 返回首页
      </button>

      <article style="background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);overflow:hidden;">
        <div style="aspect-ratio:16/7;overflow:hidden;">
          <img src="${a.cover}" alt="${a.title}" style="width:100%;height:100%;object-fit:cover;">
        </div>
        <div style="padding:2rem;">
          <h1 style="font-size:1.5rem;font-weight:700;color:var(--color-text);margin-bottom:0.75rem;">${a.title}</h1>
          <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:1.5rem;display:flex;gap:1rem;">
            <span>📝 ${a.author}</span>
            <span>👁 ${a.views || 0}</span>
            <span>${timeAgo(a.createdAt)}</span>
          </div>
          <div style="line-height:1.8;color:var(--color-text-secondary);" class="article-content">${a.content}</div>
        </div>
      </article>

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

  // ===== 社区论坛 =====
  let forumTab = 'demand';

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
                  <img src="${p.avatar}" alt="${p.name}">
                </div>
                <div class="person-card-info">
                  <div class="person-card-name">${p.name}</div>
                  <div class="person-card-tag">${p.tag}</div>
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

    if (!person) return '<div class="empty-state"><div class="empty-state-text">人物不存在</div></div>';

    return `
      <div class="detail-page">
      <button onclick="App.navigate('jicha')" style="display:inline-flex;align-items:center;gap:0.5rem;background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.875rem;margin-bottom:1rem;">
        <i class="fas fa-arrow-left"></i> 返回名录
      </button>

      <div style="background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:1.5rem;margin-bottom:2rem;display:flex;gap:1.5rem;align-items:flex-start;">
        <div style="width:120px;height:120px;border-radius:var(--radius-md);overflow:hidden;flex-shrink:0;">
          <img src="${person.avatar}" alt="${person.name}" style="width:100%;height:100%;object-fit:cover;">
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
              <div class="work-card" onclick="App.openPost('${w.id}')">
                <div class="work-card-cover">
                  <img src="${w.cover}" alt="${w.title}">
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
      </div>
    `;
  }

  // ===== 帖子详情 =====
  function openPost(id) {
    sessionStorage.setItem('currentPostId', id);
    currentRoute = 'postDetail';
    CACHE.postDetail = null;
    render();
    api(`/api/posts/${encodeURIComponent(id)}`).then(p => {
      CACHE.postDetail = p;
      if (currentRoute === 'postDetail' && sessionStorage.getItem('currentPostId') === id) render();
    }).catch(() => {});
  }

  function renderPostDetail() {
    const id = sessionStorage.getItem('currentPostId');
    const p = (CACHE.postDetail && CACHE.postDetail.id === id)
      ? CACHE.postDetail
      : getDB('posts').find(x => x.id === id);
    if (!p) return '<div class="empty-state"><div class="empty-state-text">帖子不存在</div></div>';

    const user = getCurrentUser();
    const isUnlocked = user && (CACHE.me.myUnlocked || []).includes(id);
    const canUnlock = user && !isUnlocked && p.unlockPoint > 0;
    const points = getUserPoints();

    return `
      <div class="detail-page">
      <button onclick="App.navigate('forum')" style="display:inline-flex;align-items:center;gap:0.5rem;background:none;border:none;color:var(--color-text-muted);cursor:pointer;font-size:0.875rem;margin-bottom:1rem;">
        <i class="fas fa-arrow-left"></i> 返回论坛
      </button>

      <article style="background:var(--color-card);border:1px solid var(--color-border);border-radius:var(--radius-lg);padding:1.5rem;margin-bottom:1.5rem;">
        ${p.type === 'share' ? `
          <div style="border-radius:var(--radius-md);overflow:hidden;margin-bottom:1.25rem;">
            <img src="${p.cover}" alt="${p.title}" style="width:100%;max-height:400px;object-fit:cover;">
          </div>
        ` : ''}

        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;margin-bottom:1rem;">
          <div style="flex:1;">
            <h1 style="font-size:1.375rem;font-weight:700;color:var(--color-text);margin-bottom:0.5rem;">${p.type === 'demand' ? '🔍 ' : '📤 '}${p.title}</h1>
            <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
              ${p.type === 'share' ? `<span class="tag tag-blue">${p.netdiskType}</span>` : ''}
              <span class="tag">${p.resourceType}</span>
              ${p.type === 'demand' ? `
                ${(p.netdiskPref || []).map(n => `<span class="tag tag-gray">${n}</span>`).join('')}
                ${p.rewardPoint > 0 ? `<span class="reward-tag">🏆 ${p.rewardPoint}积分悬赏</span>` : ''}
              ` : ''}
              ${p.type === 'share' && p.unlockPoint > 0 ? `<span class="lock-tag">🔒 ${p.unlockPoint}积分解锁</span>` : ''}
            </div>
          </div>
        </div>

        <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:1rem;padding-bottom:1rem;border-bottom:1px solid var(--color-border);">
          发帖人：${p.userName} · ${timeAgo(p.createdAt)} · 状态：${getStatusLabel(p.status)}
        </div>

        <div style="line-height:1.8;color:var(--color-text-secondary);font-size:0.9375rem;margin-bottom:1.5rem;white-space:pre-wrap;">${p.content}</div>

        ${p.type === 'share' ? `
          <div style="background:var(--color-bg);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:1.25rem;">
            <h3 style="font-size:0.875rem;color:var(--color-text-muted);margin-bottom:1rem;">🔑 网盘信息</h3>
            ${isUnlocked || p.unlockPoint === 0 ? `
              <div style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);border-radius:var(--radius-sm);padding:1rem;margin-bottom:0.75rem;">
                <div style="font-size:0.75rem;color:var(--color-success);margin-bottom:0.5rem;">✓ 已解锁，查看网盘信息</div>
                <div style="font-size:0.875rem;color:var(--color-text);word-break:break-all;">
                  <div style="margin-bottom:0.5rem;"><span style="color:var(--color-text-muted);">网盘类型：</span>${p.netdiskType}</div>
                  <div style="margin-bottom:0.5rem;"><span style="color:var(--color-text-muted);">下载链接：</span>${p.link}</div>
                  ${p.extractCode ? `<div><span style="color:var(--color-text-muted);">提取码：</span><code style="background:var(--color-input);padding:0.125rem 0.375rem;border-radius:4px;">${p.extractCode}</code></div>` : ''}
                </div>
                <button class="btn btn-secondary btn-sm" style="margin-top:0.75rem;" onclick="copyText('${p.link}')"><i class="fas fa-copy"></i> 复制链接</button>
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
          <div class="profile-name">${user.nickname || '用户'}</div>
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
      <div class="form-group">
        <label class="form-label">账号</label>
        <input class="form-input" id="loginUser" placeholder="请输入账号">
      </div>
      <div class="form-group">
        <label class="form-label">密码</label>
        <input class="form-input" id="loginPwd" type="password" placeholder="请输入密码">
      </div>
      <div style="display:flex;gap:0.5rem;font-size:0.75rem;">
        <button style="background:none;border:none;color:var(--color-primary-light);cursor:pointer;padding:0;" onclick="document.getElementById('registerTab').style.display='block';document.querySelector('#modalContainer .modal-footer').style.display='none';document.getElementById('loginUser').value='';document.getElementById('loginPwd').value='';">没有账号？立即注册</button>
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
    } catch (e) {
      toast(e.message, 'error');
    }
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
        <input class="form-input" id="editNickname" value="${user.nickname || ''}">
      </div>
    `, { title: '编辑资料', onConfirm: async () => {
      const nickname = document.getElementById('editNickname').value.trim();
      if (!nickname) { toast('昵称不能为空', 'warning'); return false; }
      try {
        await api('/api/auth/profile', { method: 'PATCH', body: JSON.stringify({ nickname }) });
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
  function showSubmitModal(defaultType = '') {
    const user = getCurrentUser();
    if (!user) { showLoginModal(); return; }

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
        <div class="form-group">
          <label class="form-label">提取码</label>
          <input class="form-input" id="shareExtract" placeholder="如有则填">
        </div>
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
          type: 'demand', title, content, resourceType, netdiskPref, rewardPoint
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
      const resourceType = document.getElementById('shareType').value;
      const unlockPoint = parseInt(document.getElementById('shareUnlock').value) || 0;
      const content = document.getElementById('shareContent').value.trim();

      if (!title || !link || !content) { toast('请填写完整必填项', 'warning'); return false; }
      if (!/^https?:\/\//.test(link)) { toast('请输入有效链接', 'warning'); return false; }
      if (unlockPoint > 5000) { toast('解锁积分上限5000', 'warning'); return false; }

      try {
        await api('/api/posts', { method: 'POST', body: JSON.stringify({
          type: 'share', title, content, resourceType, netdiskType, link, extractCode, unlockPoint
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
        <label class="form-label">作品简介</label>
        <textarea class="form-textarea" id="workContent" placeholder="作品简介、版本、画质等"></textarea>
      </div>
    `, { title: '投稿该人物作品', onConfirm: async () => {
      const title = document.getElementById('workTitle').value.trim();
      const netdiskType = document.getElementById('workNetdisk').value;
      const link = document.getElementById('workLink').value.trim();
      const extractCode = document.getElementById('workExtract').value.trim();
      const content = document.getElementById('workContent').value.trim();

      if (!title || !link) { toast('请填写完整', 'warning'); return false; }

      try {
        await api('/api/works', { method: 'POST', body: JSON.stringify({
          personId, title, netdiskType, link, extractCode, content
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
      unlock_post: '解锁资源', demand_freeze: '悬赏冻结', demand_reward: '悬赏兑现',
      demand_unfreeze: '悬赏退回', admin_reset: '管理员调整'
    };
    return map[type] || type;
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
      if (e.target === overlay) closeModal();
    });

    return overlay;
  }

  function closeModal() {
    const container = document.getElementById('modalContainer');
    container.innerHTML = '';
  }

  // ===== 启动 =====
  async function init() {
    // 初始导航高亮
    const links = document.querySelectorAll('.nav-link');
    links.forEach(l => l.classList.toggle('active', l.dataset.route === 'home'));
    try {
      await loadBootstrap();
      if (getToken()) await loadMe();
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
    init, render, navigate, renderNav, toggleMobileMenu, handleSearch,
    showLoginModal, doLogin, doRegister, logout, showEditProfile,
    showSubmitModal, switchSubmitTab, showWorkSubmitModal,
    openArticle, openPost, openPerson, unlockPost, doSignin,
    showRule, showDisclaimer, showPrivacy, showReport, toggleUserMenu
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
