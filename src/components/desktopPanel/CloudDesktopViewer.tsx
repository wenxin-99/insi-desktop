/**
 * CloudDesktopViewer.tsx — 云端桌面查看器
 *
 * 在聊天消息流中内联显示：
 *   1. noVNC iframe（如果有 viewerUrl）→ 实时交互式桌面
 *   2. 截图回退（如果 noVNC 不可用）→ 静态截图流
 *   3. 操作状态指示
 */

import { useState, useCallback, useEffect, useRef, memo } from "react";
import { Monitor, Maximize2, Minimize2, X, Loader2, ScreenShare, MousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CloudDesktopViewerProps {
  /** noVNC 查看器 URL（iframe 嵌入） */
  viewerUrl?: string;
  /** 最新截图 base64 */
  screenshot?: string;
  /** 屏幕尺寸 */
  screenWidth?: number;
  screenHeight?: number;
  /** 状态 */
  status: "creating" | "ready" | "operating" | "done" | "error";
  statusMessage?: string;
  /** 操作步骤 */
  steps: Array<{ tool: string; description: string; timestamp: number }>;
  onClose?: () => void;
}

export const CloudDesktopViewer = memo(function CloudDesktopViewer({
  viewerUrl, screenshot, screenWidth = 1280, screenHeight = 720,
  status, statusMessage, steps, onClose,
}: CloudDesktopViewerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showVnc, setShowVnc] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // 有 viewerUrl 时默认显示 VNC
  useEffect(() => {
    if (viewerUrl) setShowVnc(true);
  }, [viewerUrl]);

  if (status === "creating") {
    return (
      <div className="my-3 rounded-xl border bg-background p-6 flex flex-col items-center gap-3">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{statusMessage || "正在创建云端桌面..."}</p>
        <p className="text-[10px] text-muted-foreground/50">首次启动约需 10-20 秒</p>
      </div>
    );
  }

  const containerCls = isFullscreen
    ? "fixed inset-4 z-50 bg-background border rounded-xl shadow-2xl flex flex-col"
    : "my-3 rounded-xl border bg-background overflow-hidden flex flex-col";

  return (
    <>
      {isFullscreen && <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsFullscreen(false)} />}

      <div className={containerCls}>
        {/* 标题栏 */}
        <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
          <div className="flex gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-60" />
            <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-400 opacity-60" />
          </div>
          <Monitor className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground flex-1">
            {status === "ready" || status === "operating" ? "Cloud Desktop" : ""}
            {status === "operating" && " — AI 操作中..."}
          </span>

          {/* VNC/截图切换 */}
          {viewerUrl && (
            <Button
              variant="ghost" size="sm" className="h-6 px-2 text-[10px] gap-1"
              onClick={() => setShowVnc(!showVnc)}
            >
              {showVnc ? <ScreenShare className="w-3 h-3" /> : <MousePointer className="w-3 h-3" />}
              {showVnc ? "截图模式" : "交互模式"}
            </Button>
          )}

          <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </Button>
          {onClose && (
            <button onClick={onClose} className="p-0.5 hover:bg-muted rounded">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* 桌面显示区 */}
        <div className={`relative bg-gray-900 ${isFullscreen ? "flex-1" : "aspect-video max-h-[400px]"}`}>
          {showVnc && viewerUrl ? (
            <iframe
              ref={iframeRef}
              src={viewerUrl}
              className="w-full h-full border-0"
              sandbox="allow-scripts allow-same-origin"
              title="Cloud Desktop"
            />
          ) : screenshot ? (
            <img
              src={`data:image/jpeg;base64,${screenshot}`}
              alt="Desktop Screenshot"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground/30">
              <Monitor className="w-16 h-16" />
            </div>
          )}

          {/* 操作中覆盖层 */}
          {status === "operating" && (
            <div className="absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded-full bg-black/60 text-white text-[10px]">
              <Loader2 className="w-3 h-3 animate-spin" />
              AI 操作中
            </div>
          )}
        </div>

        {/* 操作步骤 */}
        {steps.length > 0 && (
          <div className="max-h-[120px] overflow-y-auto px-3 py-2 space-y-1 border-t">
            {steps.map((step, i) => (
              <div key={i} className={`text-[11px] flex items-center gap-2 ${i === steps.length - 1 ? "text-foreground" : "text-muted-foreground/60"}`}>
                <span className="w-4 text-center text-[10px] opacity-40">{i + 1}</span>
                <span className="font-mono">{step.tool.replace("desktop_", "")}</span>
                {step.description && <span className="truncate">{step.description}</span>}
              </div>
            ))}
          </div>
        )}

        {/* 状态栏 */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-t text-[10px] text-muted-foreground">
          <span>Cloud Desktop {screenWidth}x{screenHeight}</span>
          {status === "error" && <span className="text-red-500">{statusMessage}</span>}
          {status === "done" && <span className="text-green-500">操作完成</span>}
        </div>
      </div>
    </>
  );
});
