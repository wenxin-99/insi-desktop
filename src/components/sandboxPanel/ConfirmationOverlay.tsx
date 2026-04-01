/**
 * ConfirmationOverlay.tsx — 关键操作确认弹层
 *
 * 对标 OpenAI Operator "User Confirmations" 体验：
 * AI 执行不可逆操作前暂停，展示操作描述 + 当前截图，
 * 用户选择确认或拒绝。带倒计时自动确认避免死锁。
 */
import { useState, useEffect, useCallback } from "react";
import {
  ShieldAlert, Check, X, Clock, Loader2,
} from "lucide-react";
import type { Socket } from "socket.io-client";

interface Props {
  taskId: number | null;
  socket: Socket | null;
  confirmation: {
    action: string;
    description: string;
    screenshot: string;
    timeoutMs: number;
    timestamp: number;
  } | null;
  onResolved: () => void;
}

export function ConfirmationOverlay({ taskId, socket, confirmation, onResolved }: Props) {
  const [countdown, setCountdown] = useState(0);
  const [resolving, setResolving] = useState(false);

  // 倒计时
  useEffect(() => {
    if (!confirmation) return;
    const totalSecs = Math.ceil(confirmation.timeoutMs / 1000);
    const elapsed = Math.floor((Date.now() - confirmation.timestamp) / 1000);
    setCountdown(Math.max(0, totalSecs - elapsed));

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          // 超时自动确认
          onResolved();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [confirmation, onResolved]);

  const respond = useCallback(
    (confirmed: boolean) => {
      if (!socket || !taskId || resolving) return;
      setResolving(true);
      socket.emit("confirmation_response", { taskId, confirmed });
      // 短暂延迟后关闭（让服务端先收到）
      setTimeout(() => {
        setResolving(false);
        onResolved();
      }, 300);
    },
    [socket, taskId, resolving, onResolved],
  );

  if (!confirmation) return null;

  return (
    <div className="absolute inset-0 z-30 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background border border-border rounded-2xl shadow-2xl max-w-sm w-full overflow-hidden">
        {/* 头部 */}
        <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
          <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-medium text-amber-800 dark:text-amber-200">
              需要确认操作
            </div>
            <div className="text-xs text-amber-600 dark:text-amber-400">
              AI 即将执行不可逆操作
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1 text-xs text-amber-500 flex-shrink-0">
            <Clock className="w-3 h-3" />
            <span>{countdown}s</span>
          </div>
        </div>

        {/* 操作描述 */}
        <div className="px-4 py-3 space-y-2">
          <div className="text-sm text-foreground font-medium">
            {confirmation.description}
          </div>

          {/* 缩略截图预览 */}
          {confirmation.screenshot && (
            <div className="rounded-lg overflow-hidden border border-border">
              <img
                src={
                  confirmation.screenshot.startsWith("data:")
                    ? confirmation.screenshot
                    : `data:image/jpeg;base64,${confirmation.screenshot}`
                }
                alt="当前页面"
                className="w-full h-auto max-h-32 object-cover object-top"
              />
            </div>
          )}

          {/* 倒计时进度条 */}
          <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded-full transition-all duration-1000 ease-linear"
              style={{
                width: `${(countdown / Math.ceil(confirmation.timeoutMs / 1000)) * 100}%`,
              }}
            />
          </div>
          <div className="text-[10px] text-muted-foreground text-center">
            {countdown > 0
              ? `${countdown} 秒后自动确认执行`
              : "即将自动确认..."}
          </div>
        </div>

        {/* 按钮 */}
        <div className="flex gap-2 px-4 pb-4">
          <button
            onClick={() => respond(false)}
            disabled={resolving}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border border-border text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            {resolving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <X className="w-4 h-4" />
            )}
            拒绝
          </button>
          <button
            onClick={() => respond(true)}
            disabled={resolving}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors shadow-sm disabled:opacity-50"
          >
            {resolving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            确认执行
          </button>
        </div>
      </div>
    </div>
  );
}
