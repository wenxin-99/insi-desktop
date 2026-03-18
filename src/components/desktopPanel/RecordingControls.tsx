/**
 * RecordingControls — 操作录制控件
 *
 * 显示：
 *   - 录制状态指示器（红色脉动圆点）
 *   - 已录制步数
 *   - 停止录制 + 保存 Playbook 按钮
 */
import React, { useState, useCallback } from "react";

interface Props {
  isRecording: boolean;
  actionCount: number;
  onStopAndSave: () => Promise<void>;
}

export default function RecordingControls({ isRecording, actionCount, onStopAndSave }: Props) {
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      await onStopAndSave();
    } finally {
      setSaving(false);
    }
  }, [onStopAndSave]);

  if (!isRecording && actionCount === 0) return null;

  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "8px 14px",
      borderRadius: 8,
      background: isRecording ? "rgba(239,68,68,0.06)" : "var(--bg-secondary, #f5f5f5)",
      border: `1px solid ${isRecording ? "rgba(239,68,68,0.2)" : "var(--border-color, #e0e0e0)"}`,
      fontSize: 13,
    }}>
      {/* 录制指示器 */}
      {isRecording && (
        <span style={{
          width: 8, height: 8, borderRadius: "50%",
          background: "#ef4444",
          animation: "recPulse 1.2s infinite",
          flexShrink: 0,
        }} />
      )}

      <span style={{ color: "var(--text-secondary, #666)" }}>
        {isRecording
          ? `录制中 · ${actionCount} 步操作`
          : `已录制 ${actionCount} 步`
        }
      </span>

      {/* 保存按钮 */}
      {actionCount >= 3 && (
        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            marginLeft: "auto",
            padding: "4px 12px",
            borderRadius: 6,
            border: "1px solid var(--primary-color, #4f46e5)",
            background: "transparent",
            color: "var(--primary-color, #4f46e5)",
            cursor: saving ? "not-allowed" : "pointer",
            fontSize: 12,
            fontWeight: 500,
            opacity: saving ? 0.5 : 1,
          }}
        >
          {saving ? "保存中..." : "💾 保存为 Playbook"}
        </button>
      )}

      <style>{`
        @keyframes recPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}
