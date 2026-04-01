/**
 * DesktopStatusIndicator — 侧栏桌面连接状态指示器
 *
 * 🔴 未连接（点击下载客户端）
 * 🟡 连接中...
 * 🟢 已连接 (Windows 11, 1920x1080)
 */
import React from "react";

interface Props {
  isConnected: boolean;
  connectionInfo: {
    platform: string;
    screenWidth: number;
    screenHeight: number;
    osVersion?: string;
  } | null;
  onClick?: () => void;
}

export default function DesktopStatusIndicator({ isConnected, connectionInfo, onClick }: Props) {
  const platformName = connectionInfo?.platform === "macos" ? "macOS"
    : connectionInfo?.platform === "windows" ? "Windows"
    : connectionInfo?.platform === "linux" ? "Linux"
    : "";

  const label = isConnected && connectionInfo
    ? `${platformName}${connectionInfo.osVersion ? " " + connectionInfo.osVersion : ""}, ${connectionInfo.screenWidth}×${connectionInfo.screenHeight}`
    : "未连接";

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 13,
        color: "var(--text-secondary, #666)",
        transition: "background 0.15s",
      }}
      title={isConnected ? `桌面已连接: ${label}` : "桌面未连接，点击下载客户端"}
      onMouseEnter={e => (e.currentTarget.style.background = "var(--bg-hover, #f5f5f5)")}
      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
    >
      <span style={{ fontSize: 16 }}>💻</span>
      <span
        style={{
          width: 8,
          height: 8,
          borderRadius: "50%",
          backgroundColor: isConnected ? "#22c55e" : "#ef4444",
          flexShrink: 0,
        }}
      />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {isConnected ? `桌面 · ${label}` : "桌面 · 未连接"}
      </span>
    </div>
  );
}
