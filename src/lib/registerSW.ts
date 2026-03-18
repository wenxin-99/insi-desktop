/**
 * registerSW — Service Worker 注册（仅生产环境）
 *
 * ★ 修复：不再在 controllerchange 时自动 reload（会导致刷新链）
 *   改为 toast 提示用户，用户操作时自然刷新生效。
 */

/** 全局刷新冷却：10s 内最多 reload 一次，防止 SW + chunk error 连锁刷新 */
const RELOAD_COOLDOWN_KEY = 'sw_last_reload';
function canReload(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_COOLDOWN_KEY) || '0');
    return Date.now() - last > 10000;
  } catch { return true; }
}
function markReload() {
  try { sessionStorage.setItem(RELOAD_COOLDOWN_KEY, String(Date.now())); } catch {}
}

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (import.meta.env.DEV) return;

  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      console.log("[SW] Registered, scope:", reg.scope);

      // ── 新版本检测 ──
      reg.addEventListener("updatefound", () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener("statechange", () => {
          if (nw.state === "installed" && navigator.serviceWorker.controller) {
            console.log("[SW] New version installed, will activate on next navigation");
            // ★ 不再自动 skipWaiting + reload
            // 新 SW 会在下次导航时自然接管
          }
        });
      });

      // ── 定期检查更新（每 30 分钟） ──
      setInterval(() => {
        reg.update().catch(() => {});
      }, 30 * 60 * 1000);

    } catch (e) {
      console.warn("[SW] Registration failed:", e);
    }
  });
}

/** 供 chunk error handler 使用的安全 reload */
export function safeReload() {
  if (canReload()) {
    markReload();
    window.location.reload();
  } else {
    console.log('[SW] Reload cooldown active, skipping');
  }
}
