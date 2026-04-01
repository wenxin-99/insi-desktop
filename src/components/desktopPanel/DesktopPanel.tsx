/**
 * DesktopPanel — 聊天内桌面控制面板
 *
 * 显示在聊天界面中，展示：
 *   - 桌面连接状态
 *   - 实时桌面截图预览（可点击放大）
 *   - 操作进度
 *   - 暂停/停止/查看日志按钮
 */
import React, { useState, useCallback } from "react";

interface DesktopScreenshotData {
  image: string;
  width: number;
  height: number;
  label?: string;
  timestamp: number;
}

interface DesktopPanelProps {
  isConnected: boolean;
  isAuthorized?: boolean;
  connectionInfo: {
    platform: string;
    screenWidth: number;
    screenHeight: number;
    scale: number;
    osVersion?: string;
  } | null;
  latestScreenshot: DesktopScreenshotData | null;
  isOperating: boolean;
  progress: { current: number; total: number };
  steps: Array<{ tool: string; description: string; stepNumber: number; timestamp: number }>;
  onCancel: () => void;
  onAuthorize?: () => void;
  onRevoke?: () => void;
}

// ═══════════════════════════════════════════
// 子组件：截图预览
// ═══════════════════════════════════════════

function ScreenshotPreview({
  screenshot,
  expanded,
  onToggle,
}: {
  screenshot: DesktopScreenshotData;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div
      onClick={onToggle}
      style={{
        cursor: "pointer",
        borderRadius: 8,
        overflow: "hidden",
        border: "1px solid var(--border-color, #e0e0e0)",
        position: "relative",
      }}
    >
      <img
        src={`data:image/webp;base64,${screenshot.image}`}
        alt="Desktop screenshot"
        style={{
          width: "100%",
          maxHeight: expanded ? "none" : 300,
          objectFit: "contain",
          display: "block",
          backgroundColor: "#000",
        }}
      />
      {!expanded && (
        <div
          style={{
            position: "absolute",
            bottom: 8,
            right: 8,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          {screenshot.width}×{screenshot.height} — 点击放大
        </div>
      )}
      {screenshot.label && (
        <div
          style={{
            position: "absolute",
            top: 8,
            left: 8,
            background: "rgba(0,0,0,0.6)",
            color: "#fff",
            padding: "2px 8px",
            borderRadius: 4,
            fontSize: 12,
          }}
        >
          {screenshot.label}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// 子组件：操作日志
// ═══════════════════════════════════════════

function StepLog({
  steps,
  visible,
}: {
  steps: Array<{ tool: string; description: string; stepNumber: number; timestamp: number }>;
  visible: boolean;
}) {
  if (!visible || steps.length === 0) return null;

  return (
    <div
      style={{
        maxHeight: 200,
        overflow: "auto",
        background: "var(--bg-secondary, #f5f5f5)",
        borderRadius: 6,
        padding: "8px 12px",
        fontSize: 13,
        lineHeight: "20px",
        fontFamily: "monospace",
      }}
    >
      {steps.map((step, i) => (
        <div key={i} style={{ marginBottom: 4, color: "var(--text-secondary, #666)" }}>
          <span style={{ color: "var(--text-tertiary, #999)", marginRight: 8 }}>
            #{step.stepNumber}
          </span>
          <span style={{ color: "var(--primary-color, #4f46e5)", marginRight: 4 }}>
            {step.tool}
          </span>
          {step.description}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════

export default function DesktopPanel({
  isConnected,
  isAuthorized = false,
  connectionInfo,
  latestScreenshot,
  isOperating,
  progress,
  steps,
  onCancel,
  onAuthorize,
  onRevoke,
}: DesktopPanelProps) {
  const [expanded, setExpanded] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const toggleExpanded = useCallback(() => setExpanded(v => !v), []);
  const toggleLog = useCallback(() => setShowLog(v => !v), []);

  // 平台图标
  const platformIcon: Record<string, string> = {
    windows: "🪟",
    macos: "🍎",
    linux: "🐧",
  };

  const platformLabel = connectionInfo
    ? `${platformIcon[connectionInfo.platform] || "💻"} ${connectionInfo.platform === "macos" ? "macOS" : connectionInfo.platform === "windows" ? "Windows" : "Linux"}${connectionInfo.osVersion ? " " + connectionInfo.osVersion : ""}`
    : "";

  const screenLabel = connectionInfo
    ? `${connectionInfo.screenWidth}×${connectionInfo.screenHeight}${connectionInfo.scale > 1 ? ` @${connectionInfo.scale}x` : ""}`
    : "";

  const progressPct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <div
      style={{
        border: `1px solid ${isConnected ? "var(--primary-color, #4f46e5)" : "var(--border-color, #e0e0e0)"}`,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        background: "var(--bg-primary, #fff)",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 18 }}>💻</span>
          <span style={{ fontWeight: 600, fontSize: 15 }}>桌面控制</span>
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: "50%",
              backgroundColor: isConnected ? "#22c55e" : "#ef4444",
              display: "inline-block",
            }}
          />
          <span style={{ fontSize: 13, color: "var(--text-secondary, #666)" }}>
            {isConnected ? `已连接 ${platformLabel}` : "未连接"}
          </span>
        </div>

        {isConnected && screenLabel && (
          <span style={{ fontSize: 12, color: "var(--text-tertiary, #999)" }}>
            {screenLabel}
          </span>
        )}
      </div>

      {/* 未连接提示 */}
      {!isConnected && (
        <div
          style={{
            padding: "20px 16px",
            textAlign: "center",
            color: "var(--text-secondary, #666)",
            fontSize: 14,
          }}
        >
          <p style={{ marginBottom: 8 }}>桌面客户端未连接</p>
          <p style={{ fontSize: 13, marginBottom: 12 }}>
            请下载并启动 <strong>Insi Desktop Agent</strong>，登录后自动连接
          </p>
          <a
            href="https://insights.ren/desktop/download"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-block",
              padding: "8px 20px",
              background: "var(--primary-color, #4f46e5)",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: 14,
              fontWeight: 500,
            }}
          >
            下载桌面客户端
          </a>
        </div>
      )}

      {/* 已连接但未授权 → 显示授权按钮 */}
      {isConnected && !isAuthorized && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 14px",
            marginBottom: 12,
            background: "var(--bg-secondary, #fffbe6)",
            borderRadius: 8,
            border: "1px solid #fadb14",
            fontSize: 13,
          }}
        >
          <span>⚠️ AI 桌面控制需要您的授权</span>
          <button
            onClick={onAuthorize}
            style={{
              padding: "5px 16px",
              background: "#22c55e",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            ✓ 授权
          </button>
        </div>
      )}

      {/* 已授权 → 显示状态 + 撤销 */}
      {isConnected && isAuthorized && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "6px 14px",
            marginBottom: 12,
            background: "var(--bg-secondary, #f0fdf4)",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <span style={{ color: "#16a34a" }}>✓ 已授权 AI 控制桌面</span>
          <button
            onClick={onRevoke}
            style={{
              padding: "3px 10px",
              background: "transparent",
              color: "var(--text-tertiary, #999)",
              border: "1px solid var(--border-color, #e0e0e0)",
              borderRadius: 4,
              cursor: "pointer",
              fontSize: 12,
            }}
          >
            撤销
          </button>
        </div>
      )}

      {/* 截图预览 */}
      {isConnected && latestScreenshot && (
        <ScreenshotPreview
          screenshot={latestScreenshot}
          expanded={expanded}
          onToggle={toggleExpanded}
        />
      )}

      {/* 操作进度 */}
      {isOperating && (
        <div style={{ marginTop: 12 }}>
          {/* 进度条 */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div
              style={{
                flex: 1,
                height: 4,
                background: "var(--bg-secondary, #f0f0f0)",
                borderRadius: 2,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: "100%",
                  background: "var(--primary-color, #4f46e5)",
                  borderRadius: 2,
                  transition: "width 0.3s",
                }}
              />
            </div>
            <span style={{ fontSize: 12, color: "var(--text-secondary, #666)", minWidth: 70 }}>
              步骤 {progress.current}/{progress.total}
            </span>
          </div>

          {/* 控制按钮 */}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={onCancel}
              style={{
                padding: "6px 16px",
                border: "1px solid #ef4444",
                borderRadius: 6,
                background: "transparent",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              ⏹ 停止
            </button>
            <button
              onClick={toggleLog}
              style={{
                padding: "6px 16px",
                border: "1px solid var(--border-color, #e0e0e0)",
                borderRadius: 6,
                background: "transparent",
                color: "var(--text-secondary, #666)",
                cursor: "pointer",
                fontSize: 13,
                display: "flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              👀 {showLog ? "隐藏" : "查看"}操作日志
            </button>
          </div>
        </div>
      )}

      {/* 操作日志 */}
      {showLog && (
        <div style={{ marginTop: 8 }}>
          <StepLog steps={steps} visible={showLog} />
        </div>
      )}
    </div>
  );
}
