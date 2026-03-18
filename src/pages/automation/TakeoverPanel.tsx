/**
 * Phase 4.3: 增强型人工接管面板
 *
 * 功能：
 *   - 一键接管/退出接管
 *   - 浏览器实时操作（点击/打字/滚动/导航）
 *   - ★ 接管结束时输入反馈（告诉 Agent 你做了什么）
 *   - ★ 快捷反馈按钮（常见操作预设）
 *   - ★ 接管状态指示器
 *
 * 使用方式：嵌入 AutomationSandbox 或 TaskCard 中
 *
 * ```tsx
 * <TakeoverPanel
 *   taskId={taskId}
 *   socket={sandbox.socket}
 *   isRunning={task.status === 'running'}
 *   apiFetch={apiFetch}
 * />
 * ```
 */
import { useState, useCallback, useRef, useEffect } from "react";
import {
  Hand, Play, MessageSquare, Send, Loader2,
  ArrowRight, CheckCircle2, AlertCircle,
  Mouse, Keyboard, RotateCcw, Navigation,
} from "lucide-react";

// ============ 快捷反馈预设 ============

const QUICK_FEEDBACKS = [
  { label: "已手动登录", value: "我已经手动完成了登录操作，请从当前页面继续执行任务" },
  { label: "已解决验证码", value: "我已经手动输入了验证码并点击了提交，请继续执行" },
  { label: "已选择正确选项", value: "我已经在页面上选择了正确的选项/类别，请继续发帖" },
  { label: "已导航到目标页面", value: "我已经手动导航到了正确的页面，请从当前页面继续操作" },
  { label: "已填写表单", value: "我已经手动填写了部分表单内容，请检查当前页面并继续" },
  { label: "请重新分析页面", value: "页面状态已改变，请重新分析当前页面后继续执行任务" },
];

// ============ Props ============

interface TakeoverPanelProps {
  taskId: number;
  socket: any;  // Socket.IO socket
  isRunning: boolean;
  apiFetch: (path: string, options?: RequestInit) => Promise<any>;
  /** 当前接管状态回调 */
  onTakeoverChange?: (active: boolean) => void;
}

// ============ 组件 ============

export default function TakeoverPanel({
  taskId, socket, isRunning, apiFetch, onTakeoverChange,
}: TakeoverPanelProps) {
  const [active, setActive] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const feedbackInputRef = useRef<HTMLTextAreaElement>(null);

  // 监听服务端接管状态变更
  useEffect(() => {
    if (!socket) return;
    const handleTakeoverStatus = (data: any) => {
      if (data.taskId === taskId) {
        setActive(data.active);
        onTakeoverChange?.(data.active);
      }
    };
    socket.on("takeover_status", handleTakeoverStatus);
    return () => { socket.off("takeover_status", handleTakeoverStatus); };
  }, [socket, taskId, onTakeoverChange]);

  // ═══ 切换接管 ═══
  const toggleTakeover = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const endpoint = active ? "disable" : "enable";
      const res = await apiFetch(`/tasks/${taskId}/takeover/${endpoint}`, { method: "POST" });
      if (res.success !== false) {
        const next = !active;
        setActive(next);
        onTakeoverChange?.(next);

        // 退出接管时显示反馈输入
        if (!next) {
          setShowFeedback(true);
          setFeedbackSent(false);
          setTimeout(() => feedbackInputRef.current?.focus(), 100);
        }
      } else {
        setError(res.error || "操作失败");
      }
    } catch (err: any) {
      setError(err.message || "网络错误");
    } finally {
      setLoading(false);
    }
  }, [active, taskId, apiFetch, onTakeoverChange]);

  // ═══ 发送反馈 ═══
  const sendFeedback = useCallback(async (text: string) => {
    if (!text.trim()) return;
    setSubmittingFeedback(true);
    try {
      await apiFetch(`/tasks/${taskId}/takeover/feedback`, {
        method: "POST",
        body: JSON.stringify({ feedback: text.trim() }),
      });
      setFeedbackSent(true);
      setFeedbackText("");
      // 3秒后隐藏反馈区域
      setTimeout(() => {
        setShowFeedback(false);
        setFeedbackSent(false);
      }, 3000);
    } catch (err: any) {
      setError(`反馈发送失败: ${err.message}`);
    } finally {
      setSubmittingFeedback(false);
    }
  }, [taskId, apiFetch]);

  // ═══ 快捷反馈 ═══
  const handleQuickFeedback = useCallback((value: string) => {
    sendFeedback(value);
  }, [sendFeedback]);

  // 非运行状态不显示
  if (!isRunning) return null;

  return (
    <div className="border-t border-gray-100 bg-gray-50/50">
      {/* 接管控制栏 */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          {active ? (
            <div className="flex items-center gap-1.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
              </span>
              <span className="text-xs font-medium text-amber-700">接管中</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 text-gray-400">
              <Hand className="w-3.5 h-3.5" />
              <span className="text-xs">人工接管</span>
            </div>
          )}
        </div>

        <button
          onClick={toggleTakeover}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            active
              ? "bg-green-500 hover:bg-green-600 text-white"
              : "bg-amber-100 hover:bg-amber-200 text-amber-700"
          } ${loading ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          {loading ? (
            <Loader2 className="w-3 h-3 animate-spin" />
          ) : active ? (
            <><Play className="w-3 h-3" /> 恢复自动化</>
          ) : (
            <><Hand className="w-3 h-3" /> 接管操作</>
          )}
        </button>
      </div>

      {/* 接管模式提示 */}
      {active && (
        <div className="px-3 pb-2">
          <div className="flex items-center gap-3 text-[10px] text-gray-400">
            <span className="flex items-center gap-0.5"><Mouse className="w-3 h-3" /> 点击操作</span>
            <span className="flex items-center gap-0.5"><Keyboard className="w-3 h-3" /> 键盘输入</span>
            <span className="flex items-center gap-0.5"><Navigation className="w-3 h-3" /> 滚动浏览</span>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mx-3 mb-2 flex items-center gap-1.5 text-xs text-red-600 bg-red-50 px-2.5 py-1.5 rounded-lg">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* 反馈面板（退出接管后显示） */}
      {showFeedback && !active && (
        <div className="px-3 pb-3 space-y-2">
          {feedbackSent ? (
            <div className="flex items-center gap-2 text-xs text-green-600 bg-green-50 px-3 py-2 rounded-lg">
              <CheckCircle2 className="w-4 h-4" />
              反馈已发送，Agent 正在根据你的操作继续执行
            </div>
          ) : (
            <>
              <div className="text-xs text-gray-500 font-medium">告诉 AI 你做了什么（可选）：</div>

              {/* 快捷反馈按钮 */}
              <div className="flex flex-wrap gap-1.5">
                {QUICK_FEEDBACKS.map((qf, i) => (
                  <button
                    key={i}
                    onClick={() => handleQuickFeedback(qf.value)}
                    disabled={submittingFeedback}
                    className="px-2 py-1 text-[10px] bg-white border border-gray-200 rounded-md text-gray-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-colors"
                  >
                    {qf.label}
                  </button>
                ))}
              </div>

              {/* 自定义反馈输入 */}
              <div className="flex gap-2">
                <textarea
                  ref={feedbackInputRef}
                  value={feedbackText}
                  onChange={e => setFeedbackText(e.target.value)}
                  placeholder="描述你的操作，如：我已经手动登录了..."
                  rows={2}
                  className="flex-1 px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg resize-none focus:outline-none focus:ring-1 focus:ring-blue-300 focus:border-blue-300"
                  onKeyDown={e => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      sendFeedback(feedbackText);
                    }
                  }}
                />
                <button
                  onClick={() => sendFeedback(feedbackText)}
                  disabled={!feedbackText.trim() || submittingFeedback}
                  className="self-end px-3 py-1.5 bg-blue-500 text-white rounded-lg text-xs font-medium hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  {submittingFeedback ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                  发送
                </button>
              </div>

              {/* 跳过反馈 */}
              <button
                onClick={() => { setShowFeedback(false); setFeedbackSent(false); }}
                className="text-[10px] text-gray-400 hover:text-gray-600"
              >
                跳过，让 AI 自行分析页面 →
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
