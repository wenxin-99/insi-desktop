/**
 * ChatAgentPanel.tsx — 对话内 Agent 操作面板
 *
 * 在聊天消息流中内联显示 Agent 的浏览器操作：
 *   - 实时截图（带 URL 标题栏模拟）
 *   - 操作步骤流（导航→点击→填写→...）
 *   - 用户确认弹层（敏感操作前）
 *   - 会话状态指示器
 *
 * 通过 SSE 事件驱动：
 *   agent_step → 新增一步操作记录 + 更新截图
 *   agent_confirm → 弹出确认对话框
 *   agent_status → 更新状态指示
 */

import { useState, useCallback, useEffect, useRef } from "react";
import { Globe, MousePointer, FormInput, Send, ArrowDown, CheckCircle, AlertTriangle, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";

// ═══════════ 类型 ═══════════

export interface AgentStep {
  action: string;
  actionDescription: string;
  observation: string;
  screenshot?: string;
  currentUrl: string;
  pageTitle: string;
  stepNumber: number;
  durationMs: number;
  timestamp: number;
}

export interface AgentConfirmation {
  message: string;
  screenshot?: string;
  pendingAction: { toolName: string; args: any; toolCallId: string };
}

export type AgentModeStatus = "inactive" | "active" | "confirming" | "done" | "error";

// ═══════════ 主组件 ═══════════

interface ChatAgentPanelProps {
  steps: AgentStep[];
  status: AgentModeStatus;
  confirmation: AgentConfirmation | null;
  onConfirm: () => void;
  onReject: () => void;
  onClose: () => void;
  error?: string;
}

const ACTION_ICONS: Record<string, typeof Globe> = {
  agent_browse: Globe,
  agent_click: MousePointer,
  agent_fill: FormInput,
  agent_submit: Send,
  agent_scroll: ArrowDown,
  agent_done: CheckCircle,
};

const ACTION_LABELS: Record<string, string> = {
  agent_browse: "打开网页",
  agent_click: "点击",
  agent_fill: "填写",
  agent_submit: "提交",
  agent_scroll: "滚动",
  agent_done: "完成",
};

export function ChatAgentPanel({
  steps, status, confirmation, onConfirm, onReject, onClose, error,
}: ChatAgentPanelProps) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const latestScreenshot = steps.filter(s => s.screenshot).at(-1)?.screenshot;
  const latestUrl = steps.at(-1)?.currentUrl || "";
  const latestTitle = steps.at(-1)?.pageTitle || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚到底部
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [steps.length]);

  if (status === "inactive" && steps.length === 0) return null;

  return (
    <div className="my-3 rounded-xl border bg-background overflow-hidden shadow-sm">
      {/* 浏览器地址栏模拟 */}
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        <div className="flex gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-red-400 opacity-60" />
          <div className="w-2.5 h-2.5 rounded-full bg-amber-400 opacity-60" />
          <div className="w-2.5 h-2.5 rounded-full bg-green-400 opacity-60" />
        </div>
        <div className="flex-1 flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-background border text-xs text-muted-foreground truncate">
          <Globe className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{latestUrl || "Agent 浏览器"}</span>
        </div>
        {status === "active" && (
          <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin flex-shrink-0" />
        )}
        {status === "done" && (
          <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
        )}
        <button onClick={onClose} className="p-0.5 hover:bg-muted rounded" title="关闭 Agent 面板">
          <X className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* 截图区域 */}
      {latestScreenshot && (
        <div className="relative">
          <img
            src={`data:image/jpeg;base64,${latestScreenshot}`}
            alt={latestTitle || "Agent 截图"}
            className="w-full h-auto max-h-[360px] object-contain bg-gray-100 dark:bg-gray-900"
          />
          {latestTitle && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2">
              <p className="text-white text-xs truncate">{latestTitle}</p>
            </div>
          )}
        </div>
      )}

      {/* 确认弹层 */}
      {confirmation && status === "confirming" && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">需要确认</p>
              <p className="text-sm text-amber-700 dark:text-amber-300">{confirmation.message}</p>
              <div className="flex gap-2 mt-3">
                <Button size="sm" onClick={onConfirm} className="bg-amber-600 hover:bg-amber-700 text-white">
                  确认执行
                </Button>
                <Button size="sm" variant="outline" onClick={onReject}>
                  取消
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 错误状态 */}
      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-950/30 border-b border-red-200 dark:border-red-800">
          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* 操作步骤时间线 */}
      {steps.length > 0 && (
        <div ref={scrollRef} className="max-h-[200px] overflow-y-auto px-3 py-2 space-y-1.5">
          {steps.map((step, idx) => {
            const Icon = ACTION_ICONS[step.action] || Globe;
            const label = ACTION_LABELS[step.action] || step.action;
            const isExpanded = expandedStep === idx;
            const isLatest = idx === steps.length - 1;

            return (
              <button
                key={idx}
                onClick={() => setExpandedStep(isExpanded ? null : idx)}
                className={[
                  "w-full text-left flex items-start gap-2 px-2 py-1.5 rounded-lg transition-colors",
                  isLatest ? "bg-blue-50 dark:bg-blue-950/30" : "hover:bg-muted/50",
                ].join(" ")}
              >
                <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${isLatest ? "text-blue-500" : "text-muted-foreground"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium">{label}</span>
                    {step.actionDescription && (
                      <span className="text-[11px] text-muted-foreground truncate">{step.actionDescription}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground/60 ml-auto flex-shrink-0">{step.durationMs}ms</span>
                  </div>
                  {isExpanded && (
                    <p className="text-[11px] text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-5">
                      {step.observation}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* 底部状态栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-t text-[10px] text-muted-foreground">
        <span>Agent · {steps.length} 步操作</span>
        {status === "active" && <span className="text-blue-500">执行中...</span>}
        {status === "done" && <span className="text-green-500">已完成</span>}
      </div>
    </div>
  );
}

// ═══════════ Hook: 管理 Agent SSE 事件 ═══════════

export function useAgentMode() {
  const [steps, setSteps] = useState<AgentStep[]>([]);
  const [status, setStatus] = useState<AgentModeStatus>("inactive");
  const [confirmation, setConfirmation] = useState<AgentConfirmation | null>(null);
  const [error, setError] = useState<string | undefined>();

  const handleSSEEvent = useCallback((event: { type: string; [key: string]: any }) => {
    switch (event.type) {
      case "agent_step":
        setSteps(prev => [...prev, {
          action: event.action,
          actionDescription: event.actionDescription || "",
          observation: event.observation || "",
          screenshot: event.screenshot,
          currentUrl: event.currentUrl || "",
          pageTitle: event.pageTitle || "",
          stepNumber: event.stepNumber || prev.length + 1,
          durationMs: event.durationMs || 0,
          timestamp: Date.now(),
        }]);
        setStatus("active");
        break;

      case "agent_confirm":
        setConfirmation({
          message: event.message,
          screenshot: event.screenshot,
          pendingAction: event.pendingAction,
        });
        setStatus("confirming");
        break;

      case "agent_status":
        if (event.status === "done") {
          setStatus("done");
          setConfirmation(null);
        } else if (event.status === "error") {
          setStatus("error");
          setError(event.error);
        } else if (event.status === "active") {
          setStatus("active");
        }
        break;
    }
  }, []);

  const handleConfirm = useCallback(() => {
    // 通知后端继续执行（通过发送新消息 "确认" 触发）
    setConfirmation(null);
    setStatus("active");
    // 实际确认通过用户在聊天中回复 "确认" / "继续" 来触发
  }, []);

  const handleReject = useCallback(() => {
    setConfirmation(null);
    setStatus("done");
  }, []);

  const handleClose = useCallback(() => {
    setSteps([]);
    setStatus("inactive");
    setConfirmation(null);
    setError(undefined);
  }, []);

  const reset = useCallback(() => {
    setSteps([]);
    setStatus("inactive");
    setConfirmation(null);
    setError(undefined);
  }, []);

  return {
    steps,
    status,
    confirmation,
    error,
    handleSSEEvent,
    handleConfirm,
    handleReject,
    handleClose,
    reset,
  };
}
