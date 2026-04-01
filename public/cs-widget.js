/**
 * AI 客服 Widget 嵌入脚本
 *
 * 使用方式: 在任意网页中添加:
 *   <script src="https://your-domain.com/cs-widget.js" data-server="https://your-domain.com"></script>
 *
 * 自动在页面右下角生成客服图标 + 聊天弹窗（iframe 方式隔离样式）
 */
(function() {
  'use strict';

  var serverUrl = '';
  var scripts = document.getElementsByTagName('script');
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.indexOf('cs-widget') !== -1) {
      serverUrl = scripts[i].getAttribute('data-server') || '';
      break;
    }
  }
  if (!serverUrl) {
    // 自动检测: 脚本 src 的 origin
    for (var i = 0; i < scripts.length; i++) {
      if (scripts[i].src && scripts[i].src.indexOf('cs-widget') !== -1) {
        try { serverUrl = new URL(scripts[i].src).origin; } catch(e) {}
        break;
      }
    }
  }
  if (!serverUrl) { console.warn('[CS Widget] No server URL configured'); return; }

  var isOpen = false;
  var iframe = null;

  // ── 创建悬浮按钮 ──
  var btn = document.createElement('div');
  btn.id = 'cs-widget-btn';
  btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
  btn.style.cssText = 'position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;' +
    'background:linear-gradient(135deg,#06b6d4,#3b82f6);cursor:pointer;display:flex;align-items:center;' +
    'justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,0.2);z-index:999998;transition:transform 0.2s;';
  btn.onmouseenter = function() { btn.style.transform = 'scale(1.1)'; };
  btn.onmouseleave = function() { btn.style.transform = 'scale(1)'; };
  btn.onclick = function() { toggleWidget(); };
  document.body.appendChild(btn);

  // ── 创建聊天容器 ──
  var container = document.createElement('div');
  container.id = 'cs-widget-container';
  container.style.cssText = 'position:fixed;bottom:92px;right:24px;width:400px;height:600px;max-height:80vh;' +
    'border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.15);z-index:999999;' +
    'display:none;transition:opacity 0.2s,transform 0.2s;opacity:0;transform:translateY(10px);' +
    'background:white;';
  document.body.appendChild(container);

  // ── 移动端适配 ──
  if (window.innerWidth <= 640) {
    container.style.cssText = container.style.cssText.replace('width:400px', 'width:calc(100vw - 16px)');
    container.style.cssText = container.style.cssText.replace('height:600px', 'height:calc(100vh - 120px)');
    container.style.cssText = container.style.cssText.replace('right:24px', 'right:8px');
    container.style.cssText = container.style.cssText.replace('bottom:92px', 'bottom:88px');
  }

  function toggleWidget() {
    isOpen = !isOpen;
    if (isOpen) {
      container.style.display = 'block';
      // 延迟一帧让 transition 生效
      requestAnimationFrame(function() {
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
      });
      // 懒加载 iframe
      if (!iframe) {
        iframe = document.createElement('iframe');
        iframe.src = serverUrl + '/customer-service?widget=1';
        iframe.style.cssText = 'width:100%;height:100%;border:none;';
        iframe.allow = 'microphone'; // 语音客服需要
        container.appendChild(iframe);
      }
      // 更新按钮图标为关闭
      btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
    } else {
      container.style.opacity = '0';
      container.style.transform = 'translateY(10px)';
      setTimeout(function() { container.style.display = 'none'; }, 200);
      btn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>';
    }
  }

  // ── 监听 iframe postMessage ──
  window.addEventListener('message', function(e) {
    if (e.origin !== serverUrl) return;
    try {
      var data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
      if (data.type === 'cs-widget-close') { toggleWidget(); }
      if (data.type === 'cs-widget-resize') {
        container.style.height = Math.min(data.height || 600, window.innerHeight * 0.8) + 'px';
      }
    } catch(err) {}
  });
})();
