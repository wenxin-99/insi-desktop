/**
 * TaskInstructionInput.tsx — 任务中途指令输入
 *
 * 对标 ChatGPT Agent "任务执行中聊天追加指令"：
 * 在沙箱面板底部显示输入框，用户输入后通过 Socket 发送，
 * AI 在下一步开始前读取并调整行为，无需接管浏览器。
 */
import { useState, useCallback, useRef } from "react";
import { Send, Loader2, MessageSquarePlus } from "lucide-react";
import type { Socket } from "socket.io-client";

interface Props {
  taskId: number | null;
  socket: Socket | null;
  isRunning: boolean;
  /** 强制深色样式（用于 MobileSandboxSheet 等硬编码深色背景容器） */
  forceDark?: boolean;
}

export function TaskInstructionInput({ taskId, socket, isRunning, forceDark }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const send = useCallback(() => {
    if (!text.trim() || !socket || !taskId || sending) return;
    setSending(true);
    socket.emit("task_instruction", { taskId, instruction: text.trim() });
    // 清空 + 短暂提示
    setText("");
    setSent(true);
    setSending(false);
    setTimeout(() => setSent(false), 2000);
    inputRef.current?.focus();
  }, [text, socket, taskId, sending]);

  if (!isRunning || !taskId) return null;

  return (
    <div className={`flex items-center gap-2 px-3 py-2 border-t ${forceDark ? "border-white/10 bg-white/5" : "border-border/50 bg-muted/20"}`}>
      <MessageSquarePlus className={`w-3.5 h-3.5 flex-shrink-0 ${forceDark ? "text-white/30" : "text-muted-foreground/50"}`} />
      <input
        ref={inputRef}
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
        placeholder={sent ? "✓ 指令已发送，AI 将在下一步调整" : "追加指令（如：换一家、改用中文...）"}
        className={`flex-1 bg-transparent text-sm outline-none min-w-0 ${forceDark ? "text-white/90 placeholder:text-white/30" : "text-foreground placeholder:text-muted-foreground/40"}`}
        disabled={sending}
      />
      <button
        onClick={send}
        disabled={!text.trim() || sending}
        className={`p-1.5 rounded-lg transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0 ${forceDark ? "text-white/40 hover:text-cyan-400 hover:bg-white/10" : "text-muted-foreground hover:text-primary hover:bg-primary/10"}`}
      >
        {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
