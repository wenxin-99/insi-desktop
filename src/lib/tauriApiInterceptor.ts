/**
 * Tauri API 拦截器
 *
 * 问题：前端代码大量使用相对路径 fetch('/api/...') 和 axios('/api/...')，
 * 在浏览器环境中这些相对路径会解析到当前 origin（即服务端地址），一切正常。
 * 但在 Tauri 桌面客户端中，origin 是 tauri://localhost，没有后端服务，请求全部 404。
 *
 * 方案：在应用初始化时，对 window.fetch 和 axios 做全局拦截，
 * 当检测到 Tauri 环境时，自动将 /api/ 开头的相对路径替换为 https://insights.ren/api/...
 *
 * 必须在 main.tsx 中尽早调用 installTauriApiInterceptor()。
 */

import axios from "axios";

const TAURI_SERVER_BASE = "https://insights.ren";

/** 检测是否在 Tauri 环境 */
function isTauriEnv(): boolean {
  return typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;
}

/** 将相对 API 路径转换为绝对路径（仅 Tauri 环境生效） */
function rewriteUrl(url: string): string {
  // 只处理以 /api/ 开头的相对路径
  if (url.startsWith("/api/") || url.startsWith("/api?")) {
    return `${TAURI_SERVER_BASE}${url}`;
  }
  // 处理 /uploads/ 等静态资源路径
  if (url.startsWith("/uploads/")) {
    return `${TAURI_SERVER_BASE}${url}`;
  }
  // 处理 /socket.io 路径
  if (url.startsWith("/socket.io")) {
    return `${TAURI_SERVER_BASE}${url}`;
  }
  return url;
}

/** 安装全局拦截器 */
export function installTauriApiInterceptor() {
  if (!isTauriEnv()) {
    return; // 浏览器环境不需要拦截
  }

  console.log("[TauriInterceptor] Tauri detected, installing API interceptors...");

  // ═══════════ 1. Patch window.fetch ═══════════
  const originalFetch = window.fetch.bind(window);

  window.fetch = function patchedFetch(
    input: RequestInfo | URL,
    init?: RequestInit
  ): Promise<Response> {
    let finalInput = input;

    if (typeof input === "string") {
      finalInput = rewriteUrl(input);
    } else if (input instanceof Request) {
      const rewritten = rewriteUrl(input.url);
      if (rewritten !== input.url) {
        // 创建一个新 Request，替换 URL
        finalInput = new Request(rewritten, input);
      }
    } else if (input instanceof URL) {
      const rewritten = rewriteUrl(input.toString());
      if (rewritten !== input.toString()) {
        finalInput = new URL(rewritten);
      }
    }

    // 确保跨域请求带上 Authorization header
    if (finalInput !== input || (typeof finalInput === "string" && finalInput.startsWith(TAURI_SERVER_BASE))) {
      const token = localStorage.getItem("auth_token");
      if (token) {
        const headers = new Headers(init?.headers || {});
        if (!headers.has("Authorization")) {
          headers.set("Authorization", `Bearer ${token}`);
        }
        init = { ...init, headers };
      }
    }

    return originalFetch(finalInput, init);
  };

  // ═══════════ 2. Patch axios defaults ═══════════
  axios.interceptors.request.use((config) => {
    if (config.url && (config.url.startsWith("/api/") || config.url.startsWith("/api?"))) {
      config.url = rewriteUrl(config.url);
    }
    if (config.url && config.url.startsWith("/uploads/")) {
      config.url = rewriteUrl(config.url);
    }

    // 确保带上 auth token
    const token = localStorage.getItem("auth_token");
    if (token && config.url?.startsWith(TAURI_SERVER_BASE)) {
      config.headers = config.headers || {};
      if (!config.headers["Authorization"]) {
        config.headers["Authorization"] = `Bearer ${token}`;
      }
    }

    return config;
  });

  console.log("[TauriInterceptor] API interceptors installed. All /api/ requests → " + TAURI_SERVER_BASE);
}
