/**
 * CitationTooltip — 正文内联引用上标 + hover 来源卡片
 *
 * 用法：
 *   <CitationSup index={1} source={{ title: '...', url: '...' }} />
 *
 * 渲染为 [1] 上标，hover 显示来源卡片（favicon + 标题 + 域名），点击跳转。
 */

import { useState, useRef, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface CitationSource {
  title: string;
  url: string;
  snippet?: string;
}

interface CitationSupProps {
  index: number;
  source?: CitationSource;
}

export function CitationSup({ index, source }: CitationSupProps) {
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipAbove, setTooltipAbove] = useState(true);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const containerRef = useRef<HTMLSpanElement>(null);

  const handleEnter = () => {
    clearTimeout(timeoutRef.current);
    // 检测是否靠近视口顶部，决定 tooltip 方向
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipAbove(rect.top > 120);
    }
    setShowTooltip(true);
  };
  const handleLeave = () => {
    timeoutRef.current = setTimeout(() => setShowTooltip(false), 200);
  };

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const domain = source?.url
    ? (() => { try { return new URL(source.url).hostname.replace('www.', ''); } catch { return ''; } })()
    : '';

  return (
    <span
      ref={containerRef}
      className="relative inline"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <a
        href={source?.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'inline-flex items-center justify-center',
          'min-w-[18px] h-[18px] px-[5px] rounded-[4px]',
          'text-[10px] font-semibold leading-none no-underline',
          'bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400',
          'hover:bg-blue-200 dark:hover:bg-blue-800/60',
          'transition-colors cursor-pointer align-super',
          '-translate-y-[2px]',
        )}
        onClick={(e) => {
          if (!source?.url) e.preventDefault();
        }}
      >
        {index}
      </a>

      {/* Tooltip 卡片 */}
      {showTooltip && source && (
        <div
          className={cn(
            'absolute z-50 left-1/2 -translate-x-1/2',
            tooltipAbove ? 'bottom-full mb-2' : 'top-full mt-2',
            'w-[280px] rounded-lg border border-border/60 bg-popover shadow-lg',
            'animate-in fade-in duration-150',
            tooltipAbove ? 'slide-in-from-bottom-1' : 'slide-in-from-top-1',
            'p-2.5',
          )}
          onMouseEnter={handleEnter}
          onMouseLeave={handleLeave}
        >
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block group"
          >
            <div className="flex items-start gap-2">
              {/* Favicon */}
              <div className="w-5 h-5 rounded flex items-center justify-center bg-muted/60 shrink-0 mt-0.5 overflow-hidden">
                {domain && (
                  <img
                    src={`/api/favicon?domain=${encodeURIComponent(domain)}`}
                    alt=""
                    className="w-4 h-4 rounded-sm"
                    loading="lazy"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-medium text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 line-clamp-2 transition-colors">
                    {source.title || domain}
                  </span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-blue-500/50 shrink-0 transition-colors" />
                </div>
                <span className="text-[10px] text-blue-600/50 dark:text-blue-400/40">{domain}</span>
                {source.snippet && (
                  <p className="text-[11px] text-muted-foreground/70 line-clamp-2 mt-1 leading-relaxed">{source.snippet}</p>
                )}
              </div>
            </div>
          </a>
          {/* 小箭头 */}
          {tooltipAbove ? (
            <div className="absolute left-1/2 -translate-x-1/2 -bottom-[5px] w-2.5 h-2.5 rotate-45 border-r border-b border-border/60 bg-popover" />
          ) : (
            <div className="absolute left-1/2 -translate-x-1/2 -top-[5px] w-2.5 h-2.5 rotate-45 border-l border-t border-border/60 bg-popover" />
          )}
        </div>
      )}
    </span>
  );
}

/**
 * 从文本中解析 [N] 引用标记，返回混合的 string | CitationSup 数组
 */
export function parseCitationText(
  text: string,
  sources?: CitationSource[],
): (string | { type: 'citation'; index: number; source?: CitationSource })[] {
  if (!text) return [];
  if (!sources?.length) return [text];

  const parts: (string | { type: 'citation'; index: number; source?: CitationSource })[] = [];
  // 匹配 [1] [2] [3] 格式的引用标记（1-99）
  const regex = /\[(\d{1,2})\]/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    const idx = parseInt(match[1], 10);
    // 只处理有对应来源的编号
    if (idx >= 1 && idx <= sources.length) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      parts.push({ type: 'citation', index: idx, source: sources[idx - 1] });
      lastIndex = regex.lastIndex;
    }
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}
