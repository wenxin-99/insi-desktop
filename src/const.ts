export { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";

// ═══════════ Tauri 桌面客户端检测 ═══════════
/** 是否在 Tauri 桌面客户端中运行 */
export const isTauri = () =>
  typeof window !== "undefined" && !!(window as any).__TAURI_INTERNALS__;

/** 服务端基础 URL — Tauri 环境使用绝对地址，浏览器使用相对路径 */
export const getApiBaseUrl = () => {
  if (isTauri()) {
    return "https://insights.ren";
  }
  return "";
};

// Generate login URL at runtime so redirect URI reflects the current origin.
export const getLoginUrl = () => {
  const oauthPortalUrl = import.meta.env.VITE_OAUTH_PORTAL_URL;
  const appId = import.meta.env.VITE_APP_ID;
  
  // Check if OAuth is configured — fallback to forum login page
  if (!oauthPortalUrl || !appId) {
    console.warn("OAuth is not configured. VITE_OAUTH_PORTAL_URL or VITE_APP_ID is missing. Falling back to /forum-login.");
    return "/forum-login";
  }
  
  // Tauri 环境下 origin 是 tauri://localhost，OAuth 回调需要用服务端地址
  const origin = isTauri() ? "https://insights.ren" : window.location.origin;
  const redirectUri = `${origin}/api/oauth/callback`;
  const state = btoa(redirectUri);
  const url = new URL(`${oauthPortalUrl}/app-auth`);
  url.searchParams.set("appId", appId);
  url.searchParams.set("redirectUri", redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("type", "signIn");
  return url.toString();
};
