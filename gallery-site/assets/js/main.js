/**
 * 高清图集资源站 - 公共脚本
 */

// 登录功能
function login() {
  const user = document.getElementById('user').value;
  const pwd = document.getElementById('pwd').value;
  
  if (user === 'admin' && pwd === '123456') {
    localStorage.setItem('admin', 'ok');
    location.href = 'admin.html';
  } else {
    alert('账号或密码错误');
  }
}

// 退出登录
function logout() {
  localStorage.removeItem('admin');
  location.href = 'login.html';
}

// 检查登录状态
function checkAuth() {
  if (!localStorage.getItem('admin')) {
    location.href = 'login.html';
  }
}

// 保存发布
function save() {
  alert('发布成功！');
  location.href = 'index.html';
}

// 购买功能
function handleBuy() {
  alert('跳转支付宝付款，付款成功后显示链接');
  const linkBox = document.getElementById('link');
  if (linkBox) {
    linkBox.classList.remove('hidden');
  }
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', function() {
  // 为购买按钮绑定事件
  const buyBtn = document.getElementById('buy');
  if (buyBtn) {
    buyBtn.addEventListener('click', handleBuy);
  }
  
  // 添加页面加载动画
  document.body.classList.add('loaded');
});

// 防抖函数
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 节流函数
function throttle(func, limit) {
  let inThrottle;
  return function(...args) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
}

// 复制到剪贴板
function copyToClipboard(text) {
  if (navigator.clipboard) {
    navigator.clipboard.writeText(text).then(() => {
      alert('链接已复制到剪贴板');
    });
  } else {
    // 降级方案
    const textarea = document.createElement('textarea');
    textarea.value = text;
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);
    alert('链接已复制到剪贴板');
  }
}
