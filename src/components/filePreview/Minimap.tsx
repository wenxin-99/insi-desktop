/**
 * 文件预览 — Minimap 缩略导航
 * 显示文件的鸟瞰图，标记 diff 变更位置和当前可视区域
 *
 * 重要：所有 hooks 必须在条件 return 之前调用
 */
import React, { useRef, useCallback, useEffect, useState } from 'react';
import type { DiffLine } from './diffUtils';

interface MinimapProps {
  totalLines: number;
  diffLines?: DiffLine[];
  searchMatches?: Set<number>;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  lineHeight?: number;
  visible?: boolean;
}

export function Minimap({
  totalLines,
  diffLines,
  searchMatches,
  scrollRef,
  lineHeight = 20,
  visible = true,
}: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [viewState, setViewState] = useState({ top: 0, height: 0 });

  // 判断是否应该显示（用变量，不做 early return）
  const shouldShow = visible && totalLines >= 100;
  const MINIMAP_WIDTH = 50;
  const containerHeight = scrollRef.current?.clientHeight || 400;
  const totalHeight = totalLines * lineHeight;

  // ─── Hook 1: 绘制 minimap ───
  useEffect(() => {
    if (!shouldShow) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = MINIMAP_WIDTH * dpr;
    canvas.height = containerHeight * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, MINIMAP_WIDTH, containerHeight);

    const pixelsPerLine = containerHeight / Math.max(totalLines, 1);

    if (diffLines) {
      diffLines.forEach((line, i) => {
        const y = i * pixelsPerLine;
        const h = Math.max(pixelsPerLine, 1);
        if (line.type === 'added') {
          ctx.fillStyle = 'rgba(126, 231, 135, 0.6)';
          ctx.fillRect(0, y, MINIMAP_WIDTH, h);
        } else if (line.type === 'removed') {
          ctx.fillStyle = 'rgba(244, 112, 103, 0.5)';
          ctx.fillRect(0, y, MINIMAP_WIDTH, h);
        } else {
          const indent = line.content.match(/^\s*/)?.[0].length || 0;
          const contentLen = Math.min(line.content.length - indent, 80);
          const barWidth = (contentLen / 80) * (MINIMAP_WIDTH - 4);
          ctx.fillStyle = 'rgba(200, 200, 200, 0.12)';
          ctx.fillRect(2 + (indent / 80) * 10, y, barWidth, Math.max(h - 0.5, 0.5));
        }
      });
    } else {
      for (let i = 0; i < totalLines; i++) {
        const y = i * pixelsPerLine;
        const h = Math.max(pixelsPerLine - 0.5, 0.5);
        ctx.fillStyle = 'rgba(200, 200, 200, 0.1)';
        ctx.fillRect(2, y, MINIMAP_WIDTH * 0.6, h);
      }
    }

    if (searchMatches && searchMatches.size > 0) {
      ctx.fillStyle = 'rgba(250, 204, 21, 0.8)';
      searchMatches.forEach(lineNum => {
        const y = (lineNum - 1) * pixelsPerLine;
        ctx.fillRect(0, y, MINIMAP_WIDTH, Math.max(pixelsPerLine, 2));
      });
    }
  }, [shouldShow, totalLines, diffLines, searchMatches, containerHeight]);

  // ─── Hook 2: 追踪滚动位置 ───
  useEffect(() => {
    if (!shouldShow) return;
    const el = scrollRef.current;
    if (!el) return;

    const updateView = () => {
      const scrollTop = el.scrollTop;
      const clientHeight = el.clientHeight;
      const scrollHeight = Math.max(el.scrollHeight, 1);
      setViewState({
        top: (scrollTop / scrollHeight) * containerHeight,
        height: Math.max((clientHeight / scrollHeight) * containerHeight, 20),
      });
    };

    updateView();
    el.addEventListener('scroll', updateView, { passive: true });
    return () => el.removeEventListener('scroll', updateView);
  }, [shouldShow, scrollRef, containerHeight]);

  // ─── Hook 3: 点击跳转 ───
  const handleClick = useCallback((e: React.MouseEvent) => {
    const el = scrollRef.current;
    const container = containerRef.current;
    if (!el || !container) return;
    const rect = container.getBoundingClientRect();
    const clickY = e.clientY - rect.top;
    const ratio = clickY / containerHeight;
    el.scrollTo({ top: Math.max(0, ratio * el.scrollHeight - el.clientHeight / 2), behavior: 'smooth' });
  }, [scrollRef, containerHeight]);

  // ════ 条件渲染放在所有 hooks 之后 ════
  if (!shouldShow) return null;

  return (
    <div
      ref={containerRef}
      className="absolute right-0 top-0 bottom-0 w-[50px] cursor-pointer opacity-40 hover:opacity-70 transition-opacity z-10"
      onClick={handleClick}
    >
      <canvas
        ref={canvasRef}
        className="w-full h-full"
        style={{ width: MINIMAP_WIDTH, height: containerHeight }}
      />
      <div
        className="absolute right-0 w-full bg-white/10 border border-white/15 rounded-sm pointer-events-none"
        style={{ top: viewState.top, height: viewState.height }}
      />
    </div>
  );
}
