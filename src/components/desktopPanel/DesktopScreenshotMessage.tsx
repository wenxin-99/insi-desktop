/**
 * DesktopScreenshotMessage — 聊天消息中的内嵌桌面截图
 *
 * 当 AI 进行桌面操作时，截图会作为消息内容的一部分显示。
 * 支持点击放大、缩略图模式。
 */
import React, { useState, useCallback } from "react";

interface Props {
  image: string;   // base64
  width: number;
  height: number;
  label?: string;
}

export default function DesktopScreenshotMessage({ image, width, height, label }: Props) {
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded(v => !v), []);

  // 计算缩略图尺寸（最大宽度 480px）
  const maxWidth = expanded ? 800 : 480;
  const ratio = Math.min(1, maxWidth / width);
  const displayW = Math.round(width * ratio);
  const displayH = Math.round(height * ratio);

  return (
    <div style={{ margin: "8px 0" }}>
      {label && (
        <div style={{
          fontSize: 12,
          color: "var(--text-tertiary, #999)",
          marginBottom: 4,
          display: "flex",
          alignItems: "center",
          gap: 4,
        }}>
          📸 {label}
        </div>
      )}
      <div
        onClick={toggleExpanded}
        style={{
          cursor: "pointer",
          borderRadius: 8,
          overflow: "hidden",
          border: "1px solid var(--border-color, #e0e0e0)",
          display: "inline-block",
          position: "relative",
          transition: "all 0.2s",
        }}
      >
        <img
          src={`data:image/webp;base64,${image}`}
          alt="Desktop screenshot"
          width={displayW}
          height={displayH}
          style={{
            display: "block",
            backgroundColor: "#1a1a24",
          }}
          loading="lazy"
        />
        <div style={{
          position: "absolute",
          bottom: 4,
          right: 4,
          background: "rgba(0,0,0,0.6)",
          color: "#fff",
          padding: "2px 6px",
          borderRadius: 4,
          fontSize: 11,
        }}>
          {width}×{height}
          {!expanded && " · 点击放大"}
        </div>
      </div>
    </div>
  );
}
