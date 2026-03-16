/**
 * PlanViewer — 执行计划查看器
 *
 * 显示 Planner 生成的多步计划：
 *   - 每步状态图标（✅❌⏳⬜↩️）
 *   - 进度条
 *   - 回滚按钮
 *   - 截图快照预览
 */
import React from "react";

interface PlanStep {
  stepNumber: number;
  description: string;
  status: "pending" | "running" | "success" | "failed" | "skipped" | "rolled_back";
  requiresConfirmation?: boolean;
  result?: string;
  error?: string;
}

interface Props {
  steps: PlanStep[];
  currentStep: number;
  totalSteps: number;
  percentage: number;
  onRollback?: (stepNumber: number) => void;
  onSkip?: () => void;
  onPause?: () => void;
  isPaused?: boolean;
}

const statusIcons: Record<string, string> = {
  pending: "⬜",
  running: "⏳",
  success: "✅",
  failed: "❌",
  skipped: "⏭️",
  rolled_back: "↩️",
};

const statusColors: Record<string, string> = {
  pending: "#888",
  running: "#f59e0b",
  success: "#22c55e",
  failed: "#ef4444",
  skipped: "#8888a0",
  rolled_back: "#a78bfa",
};

export default function PlanViewer({
  steps, currentStep, totalSteps, percentage,
  onRollback, onSkip, onPause, isPaused,
}: Props) {
  if (steps.length === 0) return null;

  return (
    <div style={{
      border: "1px solid var(--border-color, #e0e0e0)",
      borderRadius: 12,
      padding: 16,
      marginBottom: 12,
      background: "var(--bg-primary, #fff)",
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 16 }}>📋</span>
          <span style={{ fontWeight: 600, fontSize: 14 }}>执行计划</span>
          <span style={{ fontSize: 12, color: "var(--text-secondary, #666)" }}>
            {currentStep}/{totalSteps} ({percentage}%)
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {onPause && (
            <button onClick={onPause} style={smallBtnStyle}>
              {isPaused ? "▶ 继续" : "⏸ 暂停"}
            </button>
          )}
          {onSkip && (
            <button onClick={onSkip} style={smallBtnStyle}>
              ⏭ 跳过
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4, background: "var(--bg-secondary, #f0f0f0)",
        borderRadius: 2, overflow: "hidden", marginBottom: 12,
      }}>
        <div style={{
          width: `${percentage}%`, height: "100%",
          background: "var(--primary-color, #4f46e5)",
          borderRadius: 2, transition: "width 0.3s",
        }} />
      </div>

      {/* Steps */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {steps.map((step) => (
          <div
            key={step.stepNumber}
            style={{
              display: "flex", alignItems: "flex-start", gap: 8,
              padding: "6px 8px", borderRadius: 6,
              background: step.status === "running" ? "rgba(245,158,11,0.08)" : "transparent",
              transition: "background 0.2s",
            }}
          >
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>
              {statusIcons[step.status] || "⬜"}
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 13, fontWeight: step.status === "running" ? 600 : 400,
                color: statusColors[step.status] || "var(--text-primary, #333)",
              }}>
                {step.stepNumber}. {step.description}
                {step.requiresConfirmation && <span style={{ fontSize: 11, color: "#f59e0b", marginLeft: 4 }}>⚠️ 需确认</span>}
              </div>
              {step.result && step.status === "success" && (
                <div style={{ fontSize: 11, color: "var(--text-tertiary, #999)", marginTop: 2 }}>
                  {step.result.slice(0, 60)}
                </div>
              )}
              {step.error && step.status === "failed" && (
                <div style={{ fontSize: 11, color: "#ef4444", marginTop: 2 }}>
                  {step.error.slice(0, 60)}
                </div>
              )}
            </div>
            {/* 回滚按钮（仅已完成的步骤可回滚） */}
            {onRollback && (step.status === "success" || step.status === "failed") && (
              <button
                onClick={() => onRollback(step.stepNumber)}
                title={`回滚到步骤 ${step.stepNumber}`}
                style={{
                  ...smallBtnStyle,
                  fontSize: 11, padding: "2px 6px",
                  opacity: 0.6,
                }}
              >
                ↩️
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const smallBtnStyle: React.CSSProperties = {
  padding: "4px 10px",
  border: "1px solid var(--border-color, #e0e0e0)",
  borderRadius: 6,
  background: "transparent",
  color: "var(--text-secondary, #666)",
  cursor: "pointer",
  fontSize: 12,
};
