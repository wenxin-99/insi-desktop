/**
 * AICursor.tsx — AI 光标轨迹可视化
 *
 * 对标 Operator 的 AI 光标：在浏览器截图上显示
 * AI 的鼠标光标位置，平滑动画移动到下一个目标。
 * 
 * x, y 是百分比坐标（0-100），相对于截图容器。
 */
import { useEffect, useRef } from "react";

interface Props {
  position: { x: number; y: number } | null;
}

export function AICursor({ position }: Props) {
  const cursorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!cursorRef.current || !position) return;
    cursorRef.current.style.left = `${position.x}%`;
    cursorRef.current.style.top = `${position.y}%`;
    cursorRef.current.style.opacity = "1";
  }, [position]);

  if (!position) return null;

  return (
    <>
      <style>{`
        @keyframes cursor-trail-fade {
          0% { opacity: 0.6; transform: translate(-50%,-50%) scale(1); }
          100% { opacity: 0; transform: translate(-50%,-50%) scale(2); }
        }
        .ai-cursor {
          position: absolute;
          z-index: 15;
          pointer-events: none;
          transition: left 0.3s cubic-bezier(0.22,1,0.36,1), top 0.3s cubic-bezier(0.22,1,0.36,1);
          transform: translate(-2px, -2px);
          filter: drop-shadow(0 1px 3px rgba(0,0,0,0.3));
        }
        .ai-cursor-trail {
          position: absolute;
          z-index: 14;
          pointer-events: none;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: rgba(6,182,212,0.5);
          animation: cursor-trail-fade 0.6s ease-out forwards;
          transform: translate(-50%,-50%);
        }
      `}</style>
      {/* 光标 SVG */}
      <div ref={cursorRef} className="ai-cursor" style={{ left: `${position.x}%`, top: `${position.y}%` }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
          <path d="M5 3l14 8-6.5 2L9 19.5 5 3z" fill="#06b6d4" stroke="#fff" strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
        {/* 标签 */}
        <span style={{
          position: "absolute", top: "18px", left: "12px",
          fontSize: "9px", fontWeight: 500,
          color: "#fff", background: "rgba(6,182,212,0.85)",
          padding: "1px 5px", borderRadius: "4px",
          whiteSpace: "nowrap", lineHeight: "14px",
        }}>
          Insi
        </span>
      </div>
    </>
  );
}
