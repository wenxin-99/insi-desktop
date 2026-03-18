import { trpc } from "@/lib/trpc";
import "./i18n"; // 初始化i18n
import { UNAUTHED_ERR_MSG } from '@shared/const';
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { httpBatchLink, TRPCClientError } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import { getLoginUrl } from "./const";
import "./index.css";

// ═══════════ 部署更新自动刷新 ═══════════
// 全局捕获动态 import 失败（Vite 重新 build 后旧 chunk hash 不存在）
window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || String(event.reason || '');
  if (
    msg.includes('Failed to fetch dynamically imported module') ||
    msg.includes('Importing a module script failed') ||
    msg.includes('error loading dynamically imported module')
  ) {
    const key = 'chunkError_lastReload';
    const lastReload = Number(sessionStorage.getItem(key) || '0');
    // ★ 与 SW 共享冷却：10s 内最多 reload 一次
    const swLastReload = Number(sessionStorage.getItem('sw_last_reload') || '0');
    const lastAnyReload = Math.max(lastReload, swLastReload);
    if (Date.now() - lastAnyReload > 10000) {
      console.log('[main] Dynamic import chunk error, auto-reloading...');
      sessionStorage.setItem(key, String(Date.now()));
      event.preventDefault();
      window.location.reload();
    } else {
      console.log('[main] Chunk error but reload cooldown active, skipping');
    }
  }
});

// ═══════════ OAuth 回调 token 捕获 ═══════════
// OAuth 登录后通过 URL hash 传递 token（hash 不发送到服务器，安全）
(() => {
  const hash = window.location.hash;
  if (hash.startsWith('#auth_token=')) {
    const token = decodeURIComponent(hash.slice('#auth_token='.length));
    if (token) {
      localStorage.setItem('auth_token', token);
      console.log('[Auth] Saved auth_token from OAuth callback');
    }
    // 清除 hash，避免泄露 token 到浏览器历史
    history.replaceState(null, '', window.location.pathname + window.location.search);
  }
})();

const queryClient = new QueryClient();

const redirectToLoginIfUnauthorized = (error: unknown) => {
  if (!(error instanceof TRPCClientError)) return;
  if (typeof window === "undefined") return;

  const isUnauthorized = error.message === UNAUTHED_ERR_MSG;

  if (!isUnauthorized) return;

  // Prevent infinite redirect: skip if already on login page
  const currentPath = window.location.pathname;
  if (currentPath === "/forum-login") return;

  const loginUrl = getLoginUrl();
  // Extra safety: never redirect to empty string or current page
  if (!loginUrl || loginUrl === currentPath) {
    window.location.href = "/forum-login";
    return;
  }

  window.location.href = loginUrl;
};

queryClient.getQueryCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.query.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Query Error]", error);
  }
});

queryClient.getMutationCache().subscribe(event => {
  if (event.type === "updated" && event.action.type === "error") {
    const error = event.mutation.state.error;
    redirectToLoginIfUnauthorized(error);
    console.error("[API Mutation Error]", error);
  }
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        // 从 localStorage 获取 token
        const token = localStorage.getItem('auth_token');
        
        const headers: Record<string, string> = {
          ...(init?.headers as Record<string, string> || {}),
        };
        
        // 如果有 token，添加到 Authorization 请求头
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }
        
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
          headers,
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </trpc.Provider>
  </HelmetProvider>
);

// ═══════════ PWA Service Worker 注册 ═══════════
import { registerServiceWorker } from "@/lib/registerSW";
registerServiceWorker();
