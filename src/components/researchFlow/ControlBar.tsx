/**
 * researchFlow/ControlBar.tsx — 任务控制栏
 *
 * 运行中始终显示在步骤底部，提供：
 * - 分阶段进度条
 * - 停止、打开沙箱
 * - 接管模式：暂停 AI → 用户输入反馈/指令 → AI 继续（注入 history）
 */
import { useState, useRef, useCallback } from 'react';
import { Square, ExternalLink, Loader2, Hand, Send, X } from 'lucide-react';
import { toast } from 'sonner';
import type { TaskPhase } from './types';
import { PhaseProgress } from './PhaseProgress';

interface ControlBarProps {
  status: string;
  taskId: number;
  onStop: () => void;
  onOpenSandbox?: (taskId: number) => void;
  isStopping?: boolean;
  currentPhase?: TaskPhase;
  phaseProgress?: number;
  /** ★ T7-3: 全局百分比 0-100 */
  totalPercent?: number;
  /** ★ T7-3: 预估剩余时间文本 */
  estimatedTime?: string;
  /** Socket.IO 实例（来自 useSandboxSocket） */
  socket?: any;
}

export function ControlBar({
  status,
  taskId,
  onStop,
  onOpenSandbox,
  isStopping,
  currentPhase = 'search',
  phaseProgress = 0,
  totalPercent,
  estimatedTime,
  socket,
}: ControlBarProps) {
  const [takeoverActive, setTakeoverActive] = useState(false);
  const [takeoverLoading, setTakeoverLoading] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [sendingFeedback, setSendingFeedback] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  if (status !== 'running' && status !== 'pending' && status !== 'processing') return null;

  // ── 接管开关 ──
  const toggleTakeover = async () => {
    setTakeoverLoading(true);
    try {
      const endpoint = takeoverActive ? 'disable' : 'enable';
      const token = localStorage.getItem('auth_token') || '';
      const res = await fetch(`/api/automation/${taskId}/takeover/${endpoint}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (res.ok && data.success) {
        const next = !takeoverActive;
        setTakeoverActive(next);
        if (next) {
          toast.success('已暂停 AI，你可以输入指令引导下一步操作', { duration: 3000 });
          setTimeout(() => inputRef.current?.focus(), 100);
        } else {
          toast.success('已归还控制权，AI 继续执行', { duration: 2000 });
          setFeedbackText('');
        }
      } else {
        toast.error(data.message || '操作失败');
      }
    } catch (err: any) {
      toast.error('接管操作失败: ' + (err.message || '网络错误'));
    } finally {
      setTakeoverLoading(false);
    }
  };

  // ── 发送反馈给 AI ──
  const sendFeedback = () => {
    const text = feedbackText.trim();
    if (!text) return;
    if (!socket) {
      toast.error('Socket 未连接');
      return;
    }

    setSendingFeedback(true);
    socket.emit('takeover_feedback', { taskId, feedback: text });

    const handler = (ack: any) => {
      if (ack.taskId !== taskId) return;
      socket.off('takeover_feedback_ack', handler);
      setSendingFeedback(false);

      if (ack.success) {
        toast.success('指令已发送，AI 将据此继续执行');
        setFeedbackText('');
        setTakeoverActive(false);
        // 自动归还控制权
        fetch(`/api/automation/${taskId}/takeover/disable`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${localStorage.getItem('auth_token') || ''}` },
        }).catch(() => {});
      } else {
        toast.error('发送失败: ' + (ack.error || '未知错误'));
      }
    };
    socket.on('takeover_feedback_ack', handler);

    // 超时兜底
    setTimeout(() => {
      socket.off('takeover_feedback_ack', handler);
      setSendingFeedback(false);
    }, 5000);
  };

  return (
    <div className="pl-7 animate-in fade-in duration-200 space-y-2">
      {/* 阶段进度条 */}
      <PhaseProgress
        currentPhase={currentPhase}
        progress={phaseProgress}
        totalPercent={totalPercent}
        estimatedTime={status === 'pending' ? '启动中...' : estimatedTime}
      />

      {/* 接管反馈输入框 */}
      {takeoverActive && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-orange-50 dark:bg-orange-950/20 border border-orange-200 dark:border-orange-800/40 animate-in slide-in-from-top-2 duration-200">
          <div className="flex-shrink-0">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
            </span>
          </div>
          <input
            ref={inputRef}
            type="text"
            value={feedbackText}
            onChange={e => setFeedbackText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendFeedback(); } }}
            placeholder="输入指令引导 AI（如：先检查 Nginx 配置）"
            className="flex-1 text-xs bg-transparent border-none outline-none placeholder:text-orange-400/60 text-foreground"
            disabled={sendingFeedback}
          />
          <button
            onClick={sendFeedback}
            disabled={!feedbackText.trim() || sendingFeedback}
            className="flex-shrink-0 p-1.5 rounded-lg bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {sendingFeedback ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
          </button>
        </div>
      )}

      {/* 控制按钮 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/60">
        {/* 状态指示 */}
        <div className="flex items-center gap-1.5">
          <span className="relative flex h-2 w-2">
            <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${takeoverActive ? 'bg-orange-400' : 'bg-blue-400'}`} />
            <span className={`relative inline-flex rounded-full h-2 w-2 ${takeoverActive ? 'bg-orange-500' : 'bg-blue-500'}`} />
          </span>
          <span className={`text-[11px] font-medium ${takeoverActive ? 'text-orange-600 dark:text-orange-400' : 'text-blue-600 dark:text-blue-400'}`}>
            {status === 'pending' ? '等待执行' : takeoverActive ? 'AI 已暂停' : '执行中'}
          </span>
        </div>

        <div className="flex-1" />

        {/* 沙箱 */}
        <button
          onClick={() => onOpenSandbox?.(taskId)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-muted-foreground hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/30 transition-all font-medium"
        >
          <ExternalLink className="w-3 h-3" />
          沙箱
        </button>

        {/* 接管 */}
        <button
          onClick={toggleTakeover}
          disabled={takeoverLoading || status === 'pending'}
          className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] transition-all font-medium disabled:opacity-50 ${
            takeoverActive
              ? 'text-orange-600 bg-orange-100 dark:bg-orange-950/40 hover:bg-orange-200 dark:hover:bg-orange-950/60'
              : 'text-muted-foreground hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30'
          }`}
        >
          {takeoverLoading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : takeoverActive ? (
            <X className="w-3 h-3" />
          ) : (
            <Hand className="w-3 h-3" />
          )}
          {takeoverActive ? '归还' : '接管'}
        </button>

        {/* 停止 */}
        <button
          onClick={onStop}
          disabled={isStopping}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all font-medium disabled:opacity-50"
        >
          {isStopping ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : (
            <Square className="w-3 h-3" />
          )}
          停止
        </button>
      </div>

      {/* 提示 */}
      <p className="text-[10px] text-muted-foreground/40 text-center">
        {takeoverActive
          ? '输入指令后发送，AI 将根据你的指引继续执行'
          : '任务执行中你可以继续聊天'}
      </p>
    </div>
  );
}
