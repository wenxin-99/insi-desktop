/**
 * Service Worker — 离线缓存 + 静态资源加速
 *
 * 策略：
 *   ┌────────────────────┬──────────────────────┐
 *   │ 请求类型            │ 策略                  │
 *   ├────────────────────┼──────────────────────┤
 *   │ 导航请求 (HTML)     │ Network-first → 离线  │
 *   │ 静态资源 (JS/CSS)   │ Cache-first → Network │
 *   │ 图片/字体           │ Cache-first → Network │
 *   │ API 请求            │ Network-only          │
 *   │ Socket.IO           │ 直接放行               │
 *   └────────────────────┴──────────────────────┘
 *
 * 放置位置：项目根目录 public/sw.js
 * Vite 会在 build 时自动复制到 dist/public/sw.js
 */

const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const OFFLINE_PAGE = '/offline.html';

// 预缓存的离线页面
const PRECACHE_URLS = [
  OFFLINE_PAGE,
];

// ═══ Install: 预缓存离线页面 ═══
self.addEventListener('install', (event) => {
  console.log('[SW] Install');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => console.warn('[SW] Precache failed:', err))
  );
});

// ═══ Activate: 清理旧版本缓存 ═══
self.addEventListener('activate', (event) => {
  console.log('[SW] Activate');
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== STATIC_CACHE)
          .map(key => {
            console.log('[SW] Deleting old cache:', key);
            return caches.delete(key);
          })
      )
    ).then(() => self.clients.claim())
  );
});

// ═══ 接收前端消息 ═══
self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    console.log('[SW] Skip waiting, activating immediately');
    self.skipWaiting();
  }
});

// ═══ Fetch: 分策略处理请求 ═══
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // 忽略非 HTTP(S) 请求（chrome-extension:// 等）
  if (!url.protocol.startsWith('http')) return;

  // ★ 跨域请求：直接放行，不拦截（外部图片、CDN 等）
  // SW 拦截跨域 fetch 会触发 CSP connect-src 检查，且 opaque 响应无法缓存
  if (url.origin !== self.location.origin) return;

  // Socket.IO / WebSocket: 直接放行
  if (url.pathname.startsWith('/socket.io')) return;

  // API 请求: Network-only（不缓存动态数据）
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/trpc/')) {
    return; // 使用浏览器默认行为
  }

  // 导航请求 (HTML): Network-first → 离线回退页
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => caches.match(OFFLINE_PAGE).then(r => r || new Response('离线中，请检查网络连接', {
          status: 503,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        })))
    );
    return;
  }

  // 静态资源 (JS/CSS/字体/图片): Cache-first → Network
  // Vite 生成的文件名含 hash，天然适合长缓存
  const isStaticAsset =
    url.pathname.startsWith('/assets/') ||
    /\.(js|css|woff2?|ttf|otf|eot|svg|png|jpg|jpeg|gif|webp|ico)(\?.*)?$/.test(url.pathname);

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(response => {
          // 仅缓存成功的同源响应
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }
          const clone = response.clone();
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, clone);
          });
          return response;
        }).catch(() => {
          // 静态资源加载失败，返回空响应（不中断页面）
          return new Response('', { status: 408 });
        });
      })
    );
    return;
  }

  // 其他同源请求: Network-first → cache fallback → 空响应
  // ★ 修复: caches.match 可能返回 undefined，respondWith 必须收到有效 Response
  event.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then(cached =>
        cached || new Response('', { status: 504 })
      )
    )
  );
});
