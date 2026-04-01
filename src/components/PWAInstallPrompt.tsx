/**
 * PWAInstallPrompt — 应用安装引导
 *
 * 策略：
 *   - 第 2 次访问后才提示（不打扰新用户）
 *   - 关闭后 7 天内不再弹出
 *   - standalone 模式自动隐藏
 *   - iOS Safari 显示手动添加引导
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { X, Download, Share, Sparkles } from "lucide-react";

const STORAGE_KEY = "pwa_install";
const DISMISS_DAYS = 7;

interface PWAState { visitCount: number; dismissedAt: number | null; installed: boolean }

function getState(): PWAState {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : { visitCount: 0, dismissedAt: null, installed: false }; }
  catch { return { visitCount: 0, dismissedAt: null, installed: false }; }
}
function saveState(s: PWAState) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(s)); } catch {} }
function isStandalone() { return window.matchMedia("(display-mode: standalone)").matches || (window.navigator as any).standalone === true; }
function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream; }

export function PWAInstallPrompt() {
  const [show, setShow] = useState(false);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const deferredRef = useRef<any>(null);

  useEffect(() => {
    if (isStandalone()) return;
    const state = getState();
    state.visitCount++;
    saveState(state);

    const handler = (e: Event) => {
      e.preventDefault();
      deferredRef.current = e;
      if (state.installed || state.visitCount < 2) return;
      if (state.dismissedAt && Date.now() - state.dismissedAt < DISMISS_DAYS * 86400000) return;
      setShow(true);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS Safari
    if (isIOS() && !state.installed && state.visitCount >= 2 &&
        (!state.dismissedAt || Date.now() - state.dismissedAt >= DISMISS_DAYS * 86400000)) {
      setTimeout(() => setShowIOSGuide(true), 3000);
    }

    const onInstalled = () => { const s = getState(); s.installed = true; saveState(s); setShow(false); setShowIOSGuide(false); };
    window.addEventListener("appinstalled", onInstalled);
    return () => { window.removeEventListener("beforeinstallprompt", handler); window.removeEventListener("appinstalled", onInstalled); };
  }, []);

  const handleInstall = useCallback(async () => {
    const p = deferredRef.current;
    if (!p) return;
    p.prompt();
    const r = await p.userChoice;
    if (r.outcome === "accepted") { const s = getState(); s.installed = true; saveState(s); }
    deferredRef.current = null;
    setShow(false);
  }, []);

  const handleDismiss = useCallback(() => {
    const s = getState(); s.dismissedAt = Date.now(); saveState(s);
    setShow(false); setShowIOSGuide(false);
  }, []);

  if (show) return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
        <div className="h-1" style={{ background: "linear-gradient(to right, #2563eb, #0891b2)" }} />
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-lg" style={{ background: "linear-gradient(135deg, #2563eb, #0891b2)" }}>
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-sm">安装 Paper Insights</h3>
                <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-muted transition-colors -mr-1"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">添加到桌面，像原生应用一样使用，加载更快</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button onClick={handleDismiss} className="flex-1 px-3 py-2 text-sm rounded-xl border border-border hover:bg-muted transition-colors">以后再说</button>
            <button onClick={handleInstall} className="flex-1 px-3 py-2 text-sm rounded-xl text-white font-medium flex items-center justify-center gap-1.5 transition-all hover:shadow-lg active:scale-[0.98]" style={{ background: "linear-gradient(to right, #2563eb, #0891b2)" }}>
              <Download className="w-3.5 h-3.5" />立即安装
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (showIOSGuide) return (
    <div className="fixed bottom-4 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-border/50 overflow-hidden">
        <div className="h-1" style={{ background: "linear-gradient(to right, #2563eb, #0891b2)" }} />
        <div className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, #2563eb, #0891b2)" }}>
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h3 className="font-semibold text-sm">添加到主屏幕</h3>
            </div>
            <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-muted"><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 font-bold text-[10px]">1</span>
              <span>点击底部 <Share className="w-3.5 h-3.5 inline text-blue-600 -mt-0.5" /> 分享按钮</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 font-bold text-[10px]">2</span>
              <span>选择「添加到主屏幕」</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center text-blue-600 font-bold text-[10px]">3</span>
              <span>点击右上角「添加」</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return null;
}
