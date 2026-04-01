/**
 * mobileSandbox/SandboxFAB — 可拖拽浮动按钮
 * 从 MobileSandboxSheet.tsx 第 78-319 行提取（~240 行）
 *
 * 特性：
 *   - Touch + Mouse 拖拽支持
 *   - 松手自动吸附到最近边缘
 *   - 位置持久化到 localStorage
 *   - 点击/拖拽阈值区分（6px）
 */
import { useState, useRef, useEffect, useCallback, memo } from "react";
import { Globe, Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { BrowserState, TerminalState } from "@/hooks/useSandboxSocket";

const FAB_POSITION_KEY = "sandbox-fab-position";
const DRAG_THRESHOLD = 6;
const EDGE_MARGIN = 8;
const FAB_WIDTH = 160;
const FAB_HEIGHT = 52;

function loadFabPosition(): { x: number; y: number } | null {
  try { const saved = localStorage.getItem(FAB_POSITION_KEY); if (saved) return JSON.parse(saved); } catch {}
  return null;
}

function saveFabPosition(x: number, y: number) {
  try { localStorage.setItem(FAB_POSITION_KEY, JSON.stringify({ x, y })); } catch {}
}

interface SandboxFABProps {
  browser: BrowserState;
  terminal: TerminalState;
  isConnected: boolean;
  onClick: () => void;
}

export const SandboxFAB = memo(function SandboxFAB({ browser, terminal, isConnected, onClick }: SandboxFABProps) {
  const hasScreenshot = !!browser.screenshot;
  const terminalLineCount = terminal.lines.length;

  const fabRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<{ x: number; y: number }>(() => {
    const saved = loadFabPosition();
    if (saved) return saved;
    return {
      x: (typeof window !== "undefined" ? window.innerWidth : 400) - FAB_WIDTH - EDGE_MARGIN,
      y: (typeof window !== "undefined" ? window.innerHeight : 700) - 140,
    };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isSnapping, setIsSnapping] = useState(false);
  const dragState = useRef<{ startX: number; startY: number; startPosX: number; startPosY: number; moved: boolean } | null>(null);

  const getViewport = useCallback(() => ({
    w: typeof window !== "undefined" ? window.innerWidth : 400,
    h: typeof window !== "undefined" ? window.innerHeight : 700,
  }), []);

  const clampPosition = useCallback((x: number, y: number) => {
    const { w, h } = getViewport();
    return { x: Math.max(EDGE_MARGIN, Math.min(w - FAB_WIDTH - EDGE_MARGIN, x)), y: Math.max(60, Math.min(h - FAB_HEIGHT - 20, y)) };
  }, [getViewport]);

  const snapToEdge = useCallback((x: number, y: number) => {
    const { w } = getViewport();
    const snappedX = x + FAB_WIDTH / 2 < w / 2 ? EDGE_MARGIN : w - FAB_WIDTH - EDGE_MARGIN;
    return clampPosition(snappedX, y);
  }, [getViewport, clampPosition]);

  // Touch events
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    dragState.current = { startX: touch.clientX, startY: touch.clientY, startPosX: position.x, startPosY: position.y, moved: false };
  }, [position]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!dragState.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - dragState.current.startX;
    const dy = touch.clientY - dragState.current.startY;
    if (!dragState.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) { dragState.current.moved = true; setIsDragging(true); }
    if (dragState.current.moved) { e.preventDefault(); setPosition(clampPosition(dragState.current.startPosX + dx, dragState.current.startPosY + dy)); }
  }, [clampPosition]);

  const handleTouchEnd = useCallback(() => {
    if (!dragState.current) return;
    if (dragState.current.moved) {
      setIsSnapping(true);
      const snapped = snapToEdge(position.x, position.y);
      setPosition(snapped); saveFabPosition(snapped.x, snapped.y);
      setTimeout(() => setIsSnapping(false), 300);
    } else { onClick(); }
    setIsDragging(false); dragState.current = null;
  }, [position, snapToEdge, onClick]);

  // Mouse events
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragState.current = { startX: e.clientX, startY: e.clientY, startPosX: position.x, startPosY: position.y, moved: false };
    const handleMouseMove = (ev: MouseEvent) => {
      if (!dragState.current) return;
      const dx = ev.clientX - dragState.current.startX;
      const dy = ev.clientY - dragState.current.startY;
      if (!dragState.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD) { dragState.current.moved = true; setIsDragging(true); }
      if (dragState.current.moved) setPosition(clampPosition(dragState.current.startPosX + dx, dragState.current.startPosY + dy));
    };
    const handleMouseUp = () => {
      if (!dragState.current) return;
      if (dragState.current.moved) {
        setIsSnapping(true);
        const snapped = snapToEdge(position.x, position.y);
        setPosition(snapped); saveFabPosition(snapped.x, snapped.y);
        setTimeout(() => setIsSnapping(false), 300);
      } else { onClick(); }
      setIsDragging(false); dragState.current = null;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, [position, clampPosition, snapToEdge, onClick]);

  // Resize handler
  useEffect(() => {
    const handleResize = () => setPosition((prev) => clampPosition(prev.x, prev.y));
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [clampPosition]);

  return (
    <div
      ref={fabRef}
      className={cn(
        "xl:hidden fixed z-40 flex items-center gap-2 pl-2 pr-3 py-2 rounded-2xl shadow-lg border border-white/10 select-none",
        isDragging ? "cursor-grabbing scale-105 shadow-2xl" : "cursor-grab",
        isSnapping && "transition-all duration-300 ease-out",
        !isDragging && !isSnapping && "transition-shadow duration-200",
      )}
      style={{
        left: position.x, top: position.y,
        background: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)",
        boxShadow: isDragging
          ? "0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08) inset"
          : "0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(255,255,255,0.05) inset",
        touchAction: "none", willChange: isDragging ? "transform, left, top" : "auto",
      }}
      onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
    >
      {hasScreenshot ? (
        <div className="w-9 h-9 rounded-lg overflow-hidden border border-white/10 flex-shrink-0 pointer-events-none">
          <img src={`data:image/jpeg;base64,${browser.screenshot}`} alt="" className="w-full h-full object-cover object-top" draggable={false} />
        </div>
      ) : (
        <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 pointer-events-none">
          <Globe className="w-4 h-4 text-blue-400" />
        </div>
      )}
      <div className="flex flex-col items-start min-w-0 pointer-events-none">
        <span className="text-[11px] font-medium text-white/90 truncate max-w-[100px]">{browser.title || "沙箱运行中"}</span>
        <div className="flex items-center gap-1.5">
          <div className={cn("w-1.5 h-1.5 rounded-full", isConnected ? "bg-green-400 animate-pulse" : "bg-red-400")} />
          <span className="text-[10px] text-white/40">{browser.isLoading ? "加载中..." : terminalLineCount > 0 ? `${terminalLineCount} 条输出` : "就绪"}</span>
        </div>
      </div>
    </div>
  );
});
