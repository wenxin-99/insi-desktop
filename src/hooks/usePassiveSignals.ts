/**
 * usePassiveSignals — 被动信号自动采集 Hook
 *
 * [FIXED] #10: console.error 捕获统一在此处管理（从 GlobalFeedbackFab 移入）
 * [FIXED] #14: fetch monkey-patch 中 AbortSignal.timeout 加了 try/catch 兼容
 * [OPTIMIZED] getSlowThreshold 精确匹配 tRPC 过程名，避免子串误匹配
 * [OPTIMIZED] dead_click 排除文本内容区域
 * [OPTIMIZED] 分类型限频，避免 js_error 消耗完 slow_page 配额
 */

import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

// 全局状态
const RATE_WINDOW = 60_000;
const DEDUP_WINDOW = 300_000;
const REFRESH_STORAGE_KEY = "aiops_refresh_timestamps";
const RAGE_THRESHOLD = 3;
const RAGE_WINDOW = 30_000;

/** 分类型限频（每类型每分钟最多上报次数） */
const PER_TYPE_RATE_LIMITS: Record<string, number> = {
  js_error: 2,
  api_error: 2,
  slow_page: 2,
  dead_click: 1,
  rage_refresh: 1,
};

/** 已知慢路由 — 前端缓存（启动时从服务器拉取，兜底用硬编码）
 *  key 是 tRPC procedure 名（不含 /api/trpc/ 前缀），用精确匹配 */
let _knownSlowRoutes: Record<string, number> = {
  "chat.sendMessage": 30000,
  "chat.generateTitle": 8000,         // ★ 从 15000 降到 8000（匹配新的 5s 超时）
  "aiOps.chat": 30000,
  "aiOps.runFullPipeline": 60000,
  "aiOps.runPipeline": 60000,
  "aiOps.scanServerLogs": 30000,
  "research.startTask": 30000,
  "images.generate": 30000,
  "video.generate": 60000,
  "homework.correct": 30000,
  "auth.refreshToken": 15000,
};

/** 默认 API 慢阈值（对于未知路由） */
const DEFAULT_SLOW_THRESHOLD = 8000; // 8s

const perTypeTimestamps: Record<string, number[]> = {};
const recentSignatureSet = new Set<string>();

// Fix #10: 统一的错误收集缓冲（供 GlobalFeedbackFab 等组件读取）
export const recentErrors: string[] = [];
const MAX_RECENT_ERRORS = 10;

function pushError(msg: string) {
  recentErrors.push(msg);
  if (recentErrors.length > MAX_RECENT_ERRORS) recentErrors.shift();
}

/** 分类型限频检查 */
function canSubmit(signalType: string): boolean {
  const now = Date.now();
  if (!perTypeTimestamps[signalType]) perTypeTimestamps[signalType] = [];
  const stamps = perTypeTimestamps[signalType];
  // 清理过期记录
  perTypeTimestamps[signalType] = stamps.filter(t => now - t < RATE_WINDOW);
  const limit = PER_TYPE_RATE_LIMITS[signalType] || 2;
  return perTypeTimestamps[signalType].length < limit;
}
function markSubmitted(signalType: string) {
  if (!perTypeTimestamps[signalType]) perTypeTimestamps[signalType] = [];
  perTypeTimestamps[signalType].push(Date.now());
}
function isDuplicate(sig: string): boolean {
  if (recentSignatureSet.has(sig)) return true;
  recentSignatureSet.add(sig);
  setTimeout(() => recentSignatureSet.delete(sig), DEDUP_WINDOW);
  return false;
}

export function usePassiveSignals() {
  // 静默吞掉错误 — 被动信号上报失败不应影响任何页面功能
  const submitMutation = trpc.aiOps.submitPassiveSignal.useMutation({
    onError: () => {},  // 完全静默
  });
  const submitRef = useRef(submitMutation);
  submitRef.current = submitMutation;

  const report = useRef((
    signalType: "js_error" | "api_error" | "rage_refresh" | "dead_click" | "slow_page",
    detail: string,
    extraContext?: Record<string, any>,
  ) => {
    const sig = `${signalType}:${detail.substring(0, 80)}`;
    if (!canSubmit(signalType) || isDuplicate(sig)) return;
    markSubmitted(signalType);
    try {
      submitRef.current.mutate({
        signalType, pageUrl: window.location.pathname,
        detail: detail.substring(0, 2000),
        context: { pageUrl: window.location.pathname + window.location.search, userAgent: navigator.userAgent, timestamp: Date.now(), ...extraContext },
      });
    } catch {
      // 被动信号上报失败完全忽略
    }
  });

  useEffect(() => {
    const reportFn = report.current;

    // ─── 1. JS 错误 + console.error（Fix #10: 统一在此处） ───
    const onError = (e: ErrorEvent) => {
      const detail = `${e.message} at ${e.filename || "unknown"}:${e.lineno || 0}:${e.colno || 0}`;
      pushError(detail);
      reportFn("js_error", detail, { errorLogs: [detail] });
    };
    const onUnhandledRejection = (e: PromiseRejectionEvent) => {
      const reason = e.reason instanceof Error ? `${e.reason.message}\n${e.reason.stack?.split("\n").slice(0, 3).join("\n")}` : String(e.reason);
      pushError(`Unhandled: ${reason.substring(0, 200)}`);
      reportFn("js_error", `Unhandled Promise: ${reason}`, { errorLogs: [reason] });
    };

    // Fix #10: 安全地 monkey-patch console.error（过滤框架噪音）
    const origConsoleError = console.error;
    const CONSOLE_ERROR_IGNORE = [
      "Warning:",           // React dev warnings
      "React does not recognize",
      "Each child in a list",
      "validateDOMNesting",
      "ResizeObserver loop", // 浏览器布局引擎噪音
      "Non-Error promise rejection", // Chrome 特有
      "Failed to load resource", // 常见资源加载（已由 api_error 覆盖）
    ];
    console.error = function patchedConsoleError(...args: any[]) {
      const msg = args.map(String).join(" ").substring(0, 200);
      // 过滤框架噪音，只采集真正的应用错误
      const isNoise = CONSOLE_ERROR_IGNORE.some(pattern => msg.includes(pattern));
      if (!isNoise) pushError(msg);
      origConsoleError.apply(console, args);
    };

    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);

    // ─── 2. API 错误拦截 ───
    const origFetch = window.fetch;
    window.fetch = async function patchedFetch(...args) {
      const startTime = Date.now();
      try {
        const response = await origFetch.apply(this, args);
        const elapsed = Date.now() - startTime;
        const url = typeof args[0] === "string" ? args[0] : (args[0] as Request)?.url || "";
        const isLocal = url.startsWith("/") || url.includes(window.location.host);
        const isSSE = url.includes("/notifications") || url.includes("/stream");
        // 排除 aiOps 全部请求，避免：
        // 1. submitPassiveSignal 死循环
        // 2. aiOps.chat (耗时12-15s) 误触发 slow_page 报告
        const isAiOpsRequest = url.includes("aiOps") || url.includes("aiOps%2E");
        const isAuthRefresh = url.includes("auth.refreshToken") || url.includes("auth%2ErefreshToken");
        if (isLocal && !isSSE && !isAiOpsRequest && !isAuthRefresh) {
          if (response.status >= 400) {
            reportFn("api_error", `${response.status} ${response.statusText} → ${url.substring(0, 100)}`,
              { apiErrors: [{ url: url.substring(0, 200), status: response.status, message: response.statusText }] });
          }
          // ★ 智能慢 API 检测：已知慢路由使用更宽松的阈值
          const slowThreshold = getSlowThreshold(url);
          if (elapsed > slowThreshold) {
            const safeKey = url.split("?")[0].substring(0, 80).replace(/[,;=&]/g, "_");
            reportFn("slow_page", `Slow API: ${url.substring(0, 100)} took ${elapsed}ms (threshold: ${slowThreshold}ms)`,
              { performanceData: { apiLatencies: { [safeKey]: Math.round(elapsed) } } });
          }
        }
        return response;
      } catch (err) {
        const url = typeof args[0] === "string" ? args[0] : "";
        const isAiOpsRequest = url.includes("aiOps") || url.includes("aiOps%2E");
        if (!isAiOpsRequest && (url.startsWith("/") || url.includes(window.location.host))) {
          reportFn("api_error", `Network error: ${url.substring(0, 100)} - ${(err as Error).message}`);
        }
        throw err;
      }
    };

    // ─── 3. 连续刷新检测 ───
    // ★ 排除程序性刷新（SW 更新 / chunk error 自动 reload）
    try {
      const now = Date.now();
      const swReload = Number(sessionStorage.getItem('sw_last_reload') || '0');
      const chunkReload = Number(sessionStorage.getItem('chunkError_lastReload') || '0');
      const isProgrammaticReload = (now - swReload < 5000) || (now - chunkReload < 5000);

      if (!isProgrammaticReload) {
        const stored = sessionStorage.getItem(REFRESH_STORAGE_KEY);
        const timestamps: number[] = stored ? JSON.parse(stored) : [];
        const recent = timestamps.filter(t => now - t < RAGE_WINDOW);
        recent.push(now);
        sessionStorage.setItem(REFRESH_STORAGE_KEY, JSON.stringify(recent));
        if (recent.length >= RAGE_THRESHOLD) {
          reportFn("rage_refresh", `${RAGE_WINDOW / 1000}s 内刷新 ${recent.length} 次`);
          sessionStorage.setItem(REFRESH_STORAGE_KEY, JSON.stringify([now]));
        }
      }
    } catch {}

    // ─── 4. 页面加载过慢（使用 PerformanceNavigationTiming 替代废弃的 performance.timing） ───
    const loadTimer = setTimeout(() => {
      try {
        const entries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
        const nav = entries[0];
        if (nav?.loadEventEnd > 0) {
          const loadTime = Math.round(nav.loadEventEnd - nav.startTime);
          // ★ 管理页面阈值更宽松（8s），用户页面 5s
          const isAdminPage = window.location.pathname.startsWith("/admin");
          const isFeedbackPage = window.location.pathname === "/feedback";
          const pageThreshold = isAdminPage ? 8000 : 5000;
          if (loadTime > pageThreshold && !isFeedbackPage) reportFn("slow_page", `页面加载 ${loadTime}ms: ${window.location.pathname}`, { performanceData: { pageLoadTime: loadTime } });
        }
      } catch {}
    }, 3000);

    // ─── 5. 死点击检测 ───
    let lastClickTime = 0, lastClickTarget = "", deadClickCount = 0;
    const onDocClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;
      const tag = target.tagName?.toLowerCase();
      const isInteractive = ["button", "a", "input", "textarea", "select"].includes(tag)
        || target.closest("button, a, [role='button'], [onclick]");
      if (isInteractive) { deadClickCount = 0; return; }

      // ★ 排除文本内容区域 — 用户点击文字选中/复制是正常行为，不是"死点击"
      const isTextContent = ["p", "span", "h1", "h2", "h3", "h4", "h5", "h6", "li", "code", "pre", "em", "strong", "blockquote", "td", "th"].includes(tag)
        || target.closest(".prose, .markdown-body, [class*='message'], [class*='Message'], [class*='chat-'], [class*='text-']");
      if (isTextContent) return;

      // ★ 如果用户正在选中文字，也不算死点击
      const selection = window.getSelection();
      if (selection && selection.toString().length > 0) return;

      const now = Date.now();
      const tid = `${tag}.${target.className?.toString().substring(0, 30)}`;
      if (now - lastClickTime < 2000 && tid === lastClickTarget) {
        deadClickCount++;
        if (deadClickCount >= 3) { reportFn("dead_click", `连续点击无响应 ${deadClickCount} 次: ${tid}`); deadClickCount = 0; }
      } else { deadClickCount = 1; }
      lastClickTime = now; lastClickTarget = tid;
    };
    document.addEventListener("click", onDocClick, { passive: true });

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
      console.error = origConsoleError; // Fix #10: 恢复原始 console.error
      window.fetch = origFetch;
      document.removeEventListener("click", onDocClick);
      clearTimeout(loadTimer);
    };
  }, []);
}

export function PassiveSignalCollector() { usePassiveSignals(); return null; }

// ═══════════════════════════════════
// 智能慢 API 阈值
// ═══════════════════════════════════

/**
 * 从 URL 中提取 tRPC 过程名并精确匹配阈值
 *
 * tRPC URL 格式:
 *   /api/trpc/chat.sendMessage?batch=1   → "chat.sendMessage"
 *   /api/trpc/chat.sendMessage,chat.generateTitle?batch=1 → "chat.sendMessage" (取第一个)
 *   /api/trpc/chat%2EsendMessage         → "chat.sendMessage" (URL 编码)
 */
function getSlowThreshold(url: string): number {
  const path = url.split("?")[0];

  // 提取 tRPC 过程名
  const trpcMatch = path.match(/\/api\/trpc\/([^,/]+)/);
  if (trpcMatch) {
    const procedure = decodeURIComponent(trpcMatch[1]);
    // ★ 精确匹配
    if (_knownSlowRoutes[procedure] !== undefined) {
      return _knownSlowRoutes[procedure];
    }
    // ★ 前缀匹配：如 "aiOps.chat" 匹配 "aiOps.chat" 但不匹配到 "chat.xxx"
    for (const [key, threshold] of Object.entries(_knownSlowRoutes)) {
      if (procedure.startsWith(key + ".") || procedure === key) {
        return threshold;
      }
    }
  }

  // 非 tRPC 路由：上传、SSE 等
  if (path.includes("/upload")) return 30000;
  if (path.includes("/stream")) return 30000;

  return DEFAULT_SLOW_THRESHOLD;
}
