/**
 * MobileSandboxSheet — 移动端沙箱底部抽屉
 *
 * 拆分自原 524 行。子模块：
 *   mobileSandbox/SandboxFAB.tsx - 可拖拽浮动按钮（~140 行）
 *
 * 仅在 < xl (1280px) 屏幕渲染，桌面端仍使用 RightSidePanel
 */

import { useState, useEffect, useRef, useCallback, memo } from "react";
import { Globe, Code2, Terminal as TerminalIcon, X, Wifi, WifiOff, Loader2, Maximize2, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrowserPreview } from "@/components/sandboxPanel/BrowserPreview";
import { CodeEditor } from "@/components/sandboxPanel/CodeEditor";
import { TerminalView } from "@/components/sandboxPanel/TerminalView";
import { TaskInstructionInput } from "@/components/sandboxPanel/TaskInstructionInput";
import type { BrowserState, CodeState, TerminalState } from "@/hooks/useSandboxSocket";
import type { Socket } from "socket.io-client";
import { SandboxFAB } from "./mobileSandbox/SandboxFAB";

interface MobileSandboxSheetProps {
  browser: BrowserState;
  code: CodeState;
  terminal: TerminalState;
  activeTab: "browser" | "code" | "terminal";
  onTabChange: (tab: "browser" | "code" | "terminal") => void;
  isConnected: boolean;
  taskId?: number | null;
  socket?: Socket | null;
  isActive: boolean;
  pendingConfirmation?: { action: string; description: string; screenshot: string; timeoutMs: number; timestamp: number } | null;
  onConfirmationResolved?: () => void;
  cursorPosition?: { x: number; y: number } | null;
}

const TABS = [
  { id: "browser" as const, label: "浏览器", icon: Globe, color: "#3b82f6" },
  { id: "code" as const, label: "代码", icon: Code2, color: "#a855f7" },
  { id: "terminal" as const, label: "终端", icon: TerminalIcon, color: "#22c55e" },
] as const;

type SheetHeight = "closed" | "peek" | "half" | "full";
const SHEET_HEIGHTS: Record<SheetHeight, string> = {
  closed: "0vh", peek: "0vh", half: "55dvh", full: "92dvh",
};

export const MobileSandboxSheet = memo(function MobileSandboxSheet({
  browser, code, terminal, activeTab, onTabChange, isConnected, taskId, socket, isActive,
  pendingConfirmation, onConfirmationResolved, cursorPosition,
}: MobileSandboxSheetProps) {
  const [sheetHeight, setSheetHeight] = useState<SheetHeight>("closed");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const dragStartRef = useRef<{ y: number; height: SheetHeight } | null>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  useEffect(() => { if (!isActive) setSheetHeight("closed"); }, [isActive]);

  const openSheet = useCallback(() => setSheetHeight("half"), []);
  const closeSheet = useCallback(() => { setSheetHeight("closed"); setIsFullscreen(false); }, []);
  const toggleFullscreen = useCallback(() => {
    if (sheetHeight === "full") { setSheetHeight("half"); setIsFullscreen(false); }
    else { setSheetHeight("full"); setIsFullscreen(true); }
  }, [sheetHeight]);

  // Drag gesture
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartRef.current = { y: e.touches[0].clientY, height: sheetHeight };
  }, [sheetHeight]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragStartRef.current || !sheetRef.current) return;
    const deltaY = e.touches[0].clientY - dragStartRef.current.y;
    if (deltaY > 80) {
      if (dragStartRef.current.height === "full") { setSheetHeight("half"); setIsFullscreen(false); }
      else { setSheetHeight("closed"); }
      dragStartRef.current = null;
    } else if (deltaY < -60 && dragStartRef.current.height === "half") {
      setSheetHeight("full"); setIsFullscreen(true); dragStartRef.current = null;
    }
  }, []);

  const handleTouchEnd = useCallback(() => { dragStartRef.current = null; }, []);

  const isOpen = sheetHeight === "half" || sheetHeight === "full";

  return (
    <>
      {/* FAB */}
      {isActive && !isOpen && (
        <SandboxFAB browser={browser} terminal={terminal} isConnected={isConnected} onClick={openSheet} />
      )}

      {/* Backdrop */}
      {isOpen && (
        <div className="xl:hidden fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] transition-opacity duration-300" onClick={closeSheet} />
      )}

      {/* Sheet */}
      <div
        ref={sheetRef}
        className={cn("xl:hidden fixed bottom-0 left-0 right-0 z-50 flex flex-col transition-all duration-300 ease-out", !isOpen && "pointer-events-none")}
        style={{
          height: SHEET_HEIGHTS[sheetHeight], borderRadius: "16px 16px 0 0", background: "#0f172a",
          boxShadow: isOpen ? "0 -8px 40px rgba(0,0,0,0.4)" : "none",
          opacity: isOpen ? 1 : 0, transform: isOpen ? "translateY(0)" : "translateY(100%)",
        }}
      >
        {/* Drag handle */}
        <div className="flex items-center justify-center py-2 cursor-grab active:cursor-grabbing"
          onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header: Tabs + Actions */}
        <div className="flex items-center justify-between px-3 pb-2 shrink-0">
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isTabActive = activeTab === tab.id;
              return (
                <button key={tab.id} onClick={() => onTabChange(tab.id)}
                  className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200",
                    isTabActive ? "bg-white/10 text-white shadow-sm" : "text-white/40 hover:text-white/70")}>
                  <Icon className="w-3.5 h-3.5" style={isTabActive ? { color: tab.color } : undefined} />
                  <span>{tab.label}</span>
                  {tab.id === "browser" && browser.isLoading && <Loader2 className="w-3 h-3 animate-spin text-blue-400" />}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-1">
            <div className="flex items-center gap-1 px-2 py-1 rounded-md bg-white/5">
              {isConnected ? <Wifi className="w-3 h-3 text-green-400" /> : <WifiOff className="w-3 h-3 text-red-400" />}
            </div>
            <button onClick={toggleFullscreen} className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors">
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button onClick={closeSheet} className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/5 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* URL bar */}
        {activeTab === "browser" && browser.url && (
          <div className="mx-3 mb-2 flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 text-[11px] text-white/40 font-mono truncate">
            <Globe className="w-3 h-3 shrink-0 text-white/20" /><span className="truncate">{browser.url}</span>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-hidden rounded-t-lg mx-1">
          {activeTab === "browser" && <BrowserPreview browser={browser} taskId={taskId} socket={socket} pendingConfirmation={pendingConfirmation} onConfirmationResolved={onConfirmationResolved} cursorPosition={cursorPosition} />}
          {activeTab === "code" && <CodeEditor code={code} />}
          {activeTab === "terminal" && <TerminalView terminal={terminal} />}
        </div>

        {/* ★ P3⑩：移动端指令输入（替代不可用的截图点击交互） */}
        <div className="shrink-0 mx-1 mb-1">
          <TaskInstructionInput taskId={taskId ?? null} socket={socket ?? null} isRunning={!!taskId && isConnected} forceDark />
        </div>
      </div>
    </>
  );
});

export default MobileSandboxSheet;
