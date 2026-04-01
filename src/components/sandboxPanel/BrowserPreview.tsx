/**
 * sandboxPanel/BrowserPreview.tsx — 浏览器预览（方案A：跟随主题 + 科技点缀）
 *
 * 背景用 bg-background，科技感通过：
 * - 地址栏微光边框
 * - 空状态全息动画（但颜色用 muted）
 * - 截图外发光
 */
import { useState, useEffect, useRef } from "react";
import {
  Globe, Loader2, Maximize2, ExternalLink,
  ZoomIn, ZoomOut, Gamepad2, Hand, Send, Shield,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import type { BrowserState } from "@/hooks/useSandboxSocket";
import { ConfirmationOverlay } from "./ConfirmationOverlay";
import { AICursor } from "./AICursor";
import { HelpNeededBanner } from "./HelpNeededBanner";

export function BrowserPreview({ browser, taskId, socket, clickIndicator, screenshotTimeout, pendingConfirmation, onConfirmationResolved, cursorPosition, browserTabs, helpNeeded, onHelpDismiss }: {
  browser: BrowserState; taskId?: number | null; socket?: Socket | null;
  clickIndicator?: { x: number; y: number; description: string; key: number } | null;
  screenshotTimeout?: boolean;
  pendingConfirmation?: { action: string; description: string; screenshot: string; timeoutMs: number; timestamp: number } | null;
  onConfirmationResolved?: () => void;
  cursorPosition?: { x: number; y: number } | null;
  browserTabs?: Array<{ index: number; url: string; title: string; active: boolean }>;
  helpNeeded?: { reason: string; category: string } | null;
  onHelpDismiss?: () => void;
}) {
  const [zoom, setZoom] = useState(1);
  const [isImageExpanded, setIsImageExpanded] = useState(false);
  const [takeoverActive, setTakeoverActive] = useState(false);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // ── taskId 切换时重置接管状态 ──
  useEffect(() => {
    setTakeoverActive(false);
    setTakeoverLoading(false);
    setShowFeedback(false);
    setFeedbackText("");
  }, [taskId]);

  // ── 监听 socket 的 takeover_status 事件（服务端主动通知） ──
  useEffect(() => {
    if (!socket) return;
    const statusHandler = (event: any) => {
      if (event.type === "takeover_status" && event.taskId === taskId) {
        setTakeoverActive(event.payload.active);
        if (!event.payload.active) {
          setShowFeedback(false);
          setFeedbackText("");
        }
      }
    };
    // 接管操作错误（如浏览器页面已断开）
    const errorHandler = (data: { taskId: number; error: string }) => {
      if (data.taskId === taskId) {
        console.warn(`[BrowserPreview] Takeover error for task ${taskId}:`, data.error);
        // 如果是页面断开的错误，退出接管模式
        if (data.error.includes("已断开") || data.error.includes("已关闭") || data.error.includes("重新连接")) {
          setTakeoverActive(false);
          setShowFeedback(false);
        }
        alert(`操作失败：${data.error}`);
      }
    };
    socket.on("sandbox_event", statusHandler);
    socket.on("takeover_error", errorHandler);
    return () => {
      socket.off("sandbox_event", statusHandler);
      socket.off("takeover_error", errorHandler);
    };
  }, [socket, taskId]);

  const screenshotSrc = browser.screenshotBase64
    ? `data:image/jpeg;base64,${browser.screenshotBase64}`
    : browser.screenshot
    ? `data:image/jpeg;base64,${browser.screenshot}`
    : null;
  const displayUrl = browser.url || "about:blank";

  // ── 接管逻辑（保持不变） ──
  const toggleTakeover = async () => {
    if (!taskId) return;
    if (takeoverActive) { setShowFeedback(true); return; }
    setTakeoverLoading(true);
    try {
      const res = await fetch(`/api/automation/tasks/${taskId}/takeover/enable`, {
        method: "POST", credentials: "include",
        headers: { ...(localStorage.getItem("auth_token") ? { Authorization: "Bearer " + localStorage.getItem("auth_token") } : {}) },
      });
      const data = await res.json();
      if (data.success) { setTakeoverActive(true); setTimeout(() => imgRef.current?.focus(), 100); }
      else alert(`接管失败：${data.error || data.message || "未知错误"}`);
    } catch (err: any) { alert(`接管失败：${err.message || ''}`); }
    finally { setTakeoverLoading(false); }
  };
  const releaseTakeover = async (withFeedback: boolean) => {
    if (!taskId) return; setFeedbackSending(true);
    try {
      if (withFeedback && feedbackText.trim() && socket) socket.emit("takeover_feedback", { taskId, feedback: feedbackText.trim() });
      await fetch(`/api/automation/tasks/${taskId}/takeover/disable`, {
        method: "POST", credentials: "include",
        headers: { ...(localStorage.getItem("auth_token") ? { Authorization: "Bearer " + localStorage.getItem("auth_token") } : {}) },
      });
      setTakeoverActive(false); setShowFeedback(false); setFeedbackText("");
    } catch (err: any) { console.error(err); } finally { setFeedbackSending(false); }
  };
  const handleTakeoverClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!takeoverActive || !imgRef.current || !socket) return;
    e.preventDefault(); e.stopPropagation();
    const img = imgRef.current; const rect = img.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * (img.naturalWidth || 1280));
    const y = Math.round(((e.clientY - rect.top) / rect.height) * (img.naturalHeight || 720));
    socket.emit("takeover_action", { taskId, action: "click", payload: { x, y } }); img.focus();
  };
  const handleTakeoverDblClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!takeoverActive || !imgRef.current || !socket) return;
    e.preventDefault(); e.stopPropagation();
    const img = imgRef.current; const rect = img.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * (img.naturalWidth || 1280));
    const y = Math.round(((e.clientY - rect.top) / rect.height) * (img.naturalHeight || 720));
    socket.emit("takeover_action", { taskId, action: "dblclick", payload: { x, y } });
  };
  const [navUrl, setNavUrl] = useState("");
  const [isNavigating, setIsNavigating] = useState(false);
  useEffect(() => { if (browser.url && browser.url !== "about:blank") { setNavUrl(""); setIsNavigating(false); } }, [browser.url]);
  const handleNavigate = () => {
    if (!navUrl.trim() || !socket || !taskId) return;
    let url = navUrl.trim(); if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    setIsNavigating(true); socket.emit("takeover_action", { taskId, action: "navigate", payload: { url } });
    setTimeout(() => setIsNavigating(false), 5000);
  };
  const handleTakeoverKeyDown = (e: React.KeyboardEvent) => {
    if (!takeoverActive || !socket) return; e.preventDefault(); e.stopPropagation();
    if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) return;
    const keyMap: Record<string, string> = {
      'Enter':'Enter','Backspace':'Backspace','Delete':'Delete','Tab':'Tab','Escape':'Escape',
      'ArrowUp':'ArrowUp','ArrowDown':'ArrowDown','ArrowLeft':'ArrowLeft','ArrowRight':'ArrowRight',
      'Home':'Home','End':'End','PageUp':'PageUp','PageDown':'PageDown',' ':'Space',
    };
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) socket.emit("takeover_action", { taskId, action: "type", payload: { text: e.key } });
    else if ((e.ctrlKey || e.metaKey) && e.key.length === 1) socket.emit("takeover_action", { taskId, action: "press", payload: { key: `Control+${e.key.toLowerCase()}` } });
    else socket.emit("takeover_action", { taskId, action: "press", payload: { key: keyMap[e.key] || e.key } });
  };
  const handleTakeoverWheel = (e: React.WheelEvent) => {
    if (!takeoverActive || !socket || !imgRef.current) return; e.preventDefault();
    const img = imgRef.current; const rect = img.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * (img.naturalWidth || 1280));
    const y = Math.round(((e.clientY - rect.top) / rect.height) * (img.naturalHeight || 720));
    socket.emit("takeover_action", { taskId, action: "scroll", payload: { x, y, deltaX: e.deltaX, deltaY: e.deltaY } });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <style>{`
        @keyframes orbit { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes subtle-glow {
          0%,100% { opacity: 0.3; }
          50% { opacity: 0.6; }
        }
        .orbit-ring { animation: orbit linear infinite; }
      `}</style>

      {/* ★ 多 Tab 栏（2+ Tab 时显示） */}
      {browserTabs && browserTabs.length > 1 && (
        <div className="flex items-center gap-0.5 px-2 py-1 bg-muted/30 border-b border-border/30 overflow-x-auto scrollbar-hide">
          {browserTabs.map((tab) => (
            <button
              key={tab.index}
              className={`flex items-center gap-1 px-2 py-1 rounded-md text-[10px] max-w-[140px] min-w-0 transition-all shrink-0 ${
                tab.active
                  ? "bg-background border border-border/60 shadow-sm text-foreground font-medium"
                  : "text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50"
              }`}
              title={tab.url}
            >
              <Globe className="w-2.5 h-2.5 shrink-0" />
              <span className="truncate">{tab.title || (() => { try { return new URL(tab.url).hostname; } catch { return `Tab ${tab.index}`; } })()}</span>
            </button>
          ))}
        </div>
      )}

      {/* 地址栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20">
        <div className="flex gap-1 shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400/60" />
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-400/60" />
        </div>
        {isNavigating && <Loader2 className="w-3 h-3 animate-spin text-cyan-500 shrink-0" />}
        <div className="flex-1 flex items-center gap-1 rounded-md px-2 py-0.5 border border-border/60 bg-background min-w-0 transition-colors focus-within:border-cyan-500/30">
          {browser.isLoading && <Loader2 className="w-3 h-3 animate-spin text-cyan-500 mr-1 shrink-0" />}
          {takeoverActive ? (
            <input className="flex-1 bg-transparent text-foreground font-mono text-[11px] outline-none min-w-0"
              placeholder="输入网址..." value={navUrl || displayUrl}
              onChange={(e) => setNavUrl(e.target.value)}
              onFocus={() => { if (!navUrl) setNavUrl(displayUrl === "about:blank" ? "" : displayUrl); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleNavigate(); } e.stopPropagation(); }} />
          ) : (
            <span className="truncate text-muted-foreground/60 font-mono text-[11px]">{displayUrl}</span>
          )}
        </div>
        <div className="flex items-center gap-0.5 shrink-0">
          {screenshotSrc && (
            <>
              <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground/50 hover:text-muted-foreground"><ZoomOut className="w-3.5 h-3.5" /></button>
              <span className="text-[9px] font-mono text-muted-foreground/40 min-w-[28px] text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={() => setZoom(z => Math.min(3, z + 0.25))} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground/50 hover:text-muted-foreground"><ZoomIn className="w-3.5 h-3.5" /></button>
              <button onClick={() => setIsImageExpanded(true)} className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground/50 hover:text-muted-foreground"><Maximize2 className="w-3.5 h-3.5" /></button>
            </>
          )}
          {browser.url && browser.url !== "about:blank" && (
            <a href={browser.url} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground/50 hover:text-muted-foreground"><ExternalLink className="w-3.5 h-3.5" /></a>
          )}
        </div>
      </div>

      {/* 内容区 */}
      <div className="flex-1 relative overflow-auto bg-muted/10">
        {/* ★ AI 求助通知（验证码/登录失败等） */}
        {helpNeeded && (
          <HelpNeededBanner
            reason={helpNeeded.reason}
            category={helpNeeded.category}
            onDismiss={() => onHelpDismiss?.()}
            onTakeover={taskId && screenshotSrc ? toggleTakeover : undefined}
          />
        )}
        {screenshotSrc ? (
          <div className="p-2 flex items-start justify-center min-h-full">
            <img ref={imgRef} src={screenshotSrc} alt={browser.title || "Preview"}
              className={`max-w-full rounded-lg shadow-lg transition-transform duration-200 ${takeoverActive ? "cursor-default ring-2 ring-orange-500 ring-offset-2 ring-offset-background" : "cursor-pointer"}`}
              style={{
                transform: takeoverActive ? undefined : `scale(${zoom})`, transformOrigin: "top center",
                ...(takeoverActive ? { userSelect: 'none' as const, width: '100%', height: 'auto' } : {}),
              }}
              tabIndex={0}
              onClick={(e) => { if (takeoverActive) handleTakeoverClick(e); else { if (zoom < 2) setZoom(z => z + 0.5); else setZoom(1); } }}
              onDoubleClick={(e) => { if (takeoverActive) handleTakeoverDblClick(e); }}
              onContextMenu={(e) => { if (takeoverActive) e.preventDefault(); }}
              onWheel={handleTakeoverWheel} onKeyDown={handleTakeoverKeyDown}
              onMouseDown={(e) => { if (takeoverActive) { e.preventDefault(); imgRef.current?.focus(); } }}
              draggable={false} />
            
            {/* ★ P1④：AI 光标 */}
            {!takeoverActive && cursorPosition && <AICursor position={cursorPosition} />}

            {/* ═══ 点击指示器动画 ═══ */}
            {clickIndicator && (
              <div
                key={clickIndicator.key}
                className="absolute pointer-events-none z-10"
                style={{ left: `${clickIndicator.x}%`, top: `${clickIndicator.y}%`, transform: 'translate(-50%, -50%)' }}
              >
                {/* 光标图标 */}
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" className="drop-shadow-lg" style={{ animation: 'cursor-appear 0.3s ease-out' }}>
                  <path d="M5 3l14 8-6.5 2L9 19.5 5 3z" fill="white" stroke="#333" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
                {/* 扩散波纹 */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 rounded-full border-2 border-blue-500/60 animate-ping" />
                </div>
                <div className="absolute inset-0 flex items-center justify-center" style={{ animationDelay: '150ms' }}>
                  <div className="w-5 h-5 rounded-full bg-blue-500/20 animate-ping" />
                </div>
                {/* 操作描述标签 */}
                {clickIndicator.description && (
                  <div className="absolute top-7 left-4 px-2 py-0.5 bg-black/70 text-white text-[10px] rounded whitespace-nowrap backdrop-blur-sm"
                    style={{ animation: 'fade-in 0.2s ease-out 0.1s both' }}>
                    {clickIndicator.description}
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          /* ═══ 空状态 ═══ */
          <div className="flex flex-col items-center justify-center h-full px-8">
            {screenshotTimeout ? (
              /* 截图超时状态 */
              <>
                <div className="relative mb-4">
                  <div className="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
                    <Globe className="w-8 h-8 text-amber-500/40" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  </div>
                </div>
                <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mb-1">沙箱画面暂时不可用</p>
                <p className="text-xs text-muted-foreground/60 text-center mb-3 max-w-[240px]">
                  连接不稳定导致画面延迟，但请放心任务仍在正常执行，后续沙箱稳定后画面会跟上
                </p>
                {displayUrl !== "about:blank" && (
                  <div className="text-[10px] text-muted-foreground/40 font-mono truncate max-w-full px-4">
                    当前页面：{displayUrl}
                  </div>
                )}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/20 mt-3">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-50" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-500" />
                  </span>
                  <span className="text-[10px] font-mono text-amber-500/60">TASK RUNNING</span>
                </div>
              </>
            ) : (
              /* 正常等待状态 */
              <>
                <div className="relative mb-6">
                  <div className="w-20 h-20 rounded-full bg-muted/30 flex items-center justify-center">
                    <Globe className="w-10 h-10 text-muted-foreground/15" />
                  </div>
                  <div className="absolute inset-[-8px] rounded-full orbit-ring" style={{ border: '1px dashed', borderColor: 'var(--border)', opacity: 0.3, animationDuration: '12s' }} />
                  <div className="absolute inset-[-18px] rounded-full orbit-ring" style={{ border: '1px dashed', borderColor: 'var(--border)', opacity: 0.15, animationDuration: '20s', animationDirection: 'reverse' }} />
                </div>
                <p className="text-sm font-medium text-foreground/50 mb-1">Insi 正在准备中</p>
                <p className="text-xs text-muted-foreground/40 text-center mb-4">
                  首张截图将在 Insi 开始浏览网页后出现
                </p>
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/30 border border-border/50">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-500 opacity-50" />
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-500" />
                  </span>
                  <span className="text-[10px] font-mono text-muted-foreground/40">SYSTEM READY</span>
                </div>
              </>
            )}
          </div>
        )}

        {/* ★ 关键操作确认弹层 */}
        {pendingConfirmation && (
          <ConfirmationOverlay
            taskId={taskId ?? null}
            socket={socket ?? null}
            confirmation={pendingConfirmation}
            onResolved={() => onConfirmationResolved?.()}
          />
        )}

        {/* 接管控制 */}
        {taskId && screenshotSrc && (
          <>
            {showFeedback && (
              <div className="absolute inset-x-0 bottom-0 z-20 bg-background/95 backdrop-blur-sm border-t border-border p-3 space-y-2">
                <p className="text-xs text-muted-foreground">📝 描述你的操作（可选），Insi 将参考反馈继续</p>
                <textarea className="w-full text-sm border border-border rounded-lg p-2 resize-none bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
                  rows={2} placeholder="例如：我找到了一篇相关论文..." value={feedbackText}
                  onChange={(e) => setFeedbackText(e.target.value)} autoFocus />
                <div className="flex gap-2 justify-end">
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-muted hover:bg-muted/80 text-foreground transition-colors"
                    onClick={() => releaseTakeover(false)} disabled={feedbackSending}>跳过</button>
                  <button className="text-xs px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 flex items-center gap-1 transition-colors"
                    onClick={() => releaseTakeover(true)} disabled={feedbackSending || !feedbackText.trim()}>
                    {feedbackSending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                    提交并归还
                  </button>
                </div>
              </div>
            )}
            {!showFeedback && (
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
                <button className={`flex items-center text-sm px-4 py-2 rounded-full shadow-lg transition-all border ${
                  takeoverActive
                    ? "bg-orange-500/10 border-orange-500/30 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20"
                    : "bg-cyan-500/10 border-cyan-500/30 text-cyan-600 dark:text-cyan-400 hover:bg-cyan-500/20"
                }`} onClick={toggleTakeover} disabled={takeoverLoading}>
                  {takeoverLoading ? <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    : takeoverActive ? <Hand className="w-4 h-4 mr-2" /> : <Gamepad2 className="w-4 h-4 mr-2" />}
                  {takeoverActive ? "归还控制" : "接管操作"}
                </button>
              </div>
            )}
          </>
        )}

        {/* 截图超时提示横幅（覆盖在截图上方） */}
        {screenshotTimeout && screenshotSrc && (
          <div className="absolute top-0 inset-x-0 z-10 flex items-center gap-2 px-3 py-1.5 bg-amber-500/90 text-white text-xs backdrop-blur-sm">
            <Loader2 className="w-3 h-3 animate-spin shrink-0" />
            <span>画面可能延迟，任务仍在正常执行</span>
          </div>
        )}

        {/* 加载遮罩 */}
        {browser.isLoading && screenshotSrc && (
          <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] flex items-center justify-center">
            <div className="flex items-center gap-2 bg-background/90 border border-border px-4 py-2 rounded-lg shadow-lg">
              <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
              <span className="text-sm text-muted-foreground">加载中...</span>
            </div>
          </div>
        )}
      </div>

      {/* 标题栏 */}
      {browser.title && (
        <div className="px-3 py-1.5 bg-muted/20 border-t border-border/50 text-[10px] font-mono text-muted-foreground/40 truncate">
          {browser.title}
        </div>
      )}

      {/* 全屏弹窗 */}
      {isImageExpanded && screenshotSrc && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-8 cursor-pointer" onClick={() => setIsImageExpanded(false)}>
          <img src={screenshotSrc} alt="Expanded" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={(e) => e.stopPropagation()} />
          <button onClick={() => setIsImageExpanded(false)} className="absolute top-4 right-4 text-white/60 hover:text-white bg-black/40 rounded-full p-2">✕</button>
        </div>
      )}
    </div>
  );
}
