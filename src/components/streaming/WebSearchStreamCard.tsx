/**
 * WebSearchStreamCard — 流式联网搜索卡片
 *
 * 三阶段渲染：
 *   1. streaming: 搜索动画 + 查询词显示 + 结果逐条滑入
 *   2. complete:  完整搜索结果列表 + 可折叠
 *   3. error:     错误提示
 */
import { useState, useEffect, useRef, memo } from 'react';
import {
  Globe, Search, ExternalLink, ChevronDown, ChevronUp,
  Loader2, Zap, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolComponentRenderProps, SearchResultItem } from '@/types/toolComponent';

export const WebSearchStreamCard = memo(function WebSearchStreamCard({
  tool, isLive,
}: ToolComponentRenderProps) {
  const [expanded, setExpanded] = useState(true);
  const resultsRef = useRef<HTMLDivElement>(null);
  const isStreaming = tool.status === 'streaming';
  const isError = tool.status === 'error';
  const meta = tool.meta as { query: string; isMultiRound?: boolean };
  const results = tool.searchResults || [];
  const currentQuery = tool.currentQuery || meta.query;
  const searchRound = tool.searchRound || 1;

  // 流式阶段自动滚动到最新结果
  useEffect(() => {
    if (isStreaming && resultsRef.current) {
      resultsRef.current.scrollTop = resultsRef.current.scrollHeight;
    }
  }, [results.length, isStreaming]);

  // ★ P1-2: 搜索完成后保留紧凑摘要行（详细来源由底部 WebSearchSources 展示，不重复）
  if (tool.status === 'complete') {
    if (results.length === 0) return null;
    return (
      <div className={cn(
        'my-2 rounded-xl border overflow-hidden',
        'border-border/40',
      )}>
        <div className="flex items-center gap-2.5 px-3.5 py-2 bg-muted/30">
          <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-foreground">
                搜索完成 · {results.length} 条结果
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground truncate mt-0.5">
              {currentQuery}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      'my-2 rounded-xl border overflow-hidden transition-all duration-300',
      'animate-in fade-in slide-in-from-bottom-2 duration-300',
      isStreaming
        ? 'border-blue-200/60 dark:border-blue-800/40 shadow-sm shadow-blue-100/50 dark:shadow-blue-900/20'
        : isError
          ? 'border-red-200/60 dark:border-red-800/40'
          : 'border-border',
    )}>
      {/* ── 顶部进度条（流式中） ── */}
      {isStreaming && (
        <div className="h-[3px] bg-blue-100/80 dark:bg-blue-900/50 overflow-hidden">
          <div
            className="h-full w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            style={{ animation: 'searchSlide 1.5s ease-in-out infinite' }}
          />
        </div>
      )}

      {/* ── 头部 ── */}
      <div
        className={cn(
          'flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none transition-colors',
          isStreaming
            ? 'bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40'
            : 'bg-muted/30 hover:bg-muted/50',
        )}
        onClick={() => !isStreaming && setExpanded(e => !e)}
      >
        {/* 图标 */}
        <div className="relative flex-shrink-0">
          <div className={cn(
            'w-8 h-8 rounded-lg flex items-center justify-center shadow-sm',
            isStreaming
              ? 'bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/60 dark:to-indigo-900/60'
              : isError
                ? 'bg-red-100 dark:bg-red-900/30'
                : 'bg-green-100 dark:bg-green-900/30',
          )}>
            {isStreaming ? (
              <Search className="w-4 h-4 text-blue-600 dark:text-blue-400 animate-pulse" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4 text-red-500" />
            ) : (
              <Globe className="w-4 h-4 text-green-600 dark:text-green-400" />
            )}
          </div>
          {searchRound > 1 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-[10px] font-bold text-white flex items-center justify-center leading-none shadow-sm">
              {searchRound}
            </span>
          )}
        </div>

        {/* 信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className={cn(
              'text-xs font-semibold',
              isStreaming ? 'text-blue-700 dark:text-blue-300' : 'text-foreground',
            )}>
              {isStreaming
                ? (searchRound > 1 ? `第 ${searchRound} 次搜索` : '联网搜索中')
                : isError
                  ? '搜索失败'
                  : `搜索完成 · ${results.length} 条结果`}
            </span>
            {isStreaming && <Zap className="w-3 h-3 text-amber-500" />}
          </div>
          <p className={cn(
            'text-[11px] truncate mt-0.5',
            isStreaming ? 'text-blue-600/60 dark:text-blue-400/50' : 'text-muted-foreground',
          )}>
            {currentQuery}
          </p>
        </div>

        {/* 展开/折叠（完成态） */}
        {!isStreaming && results.length > 0 && (
          <div className="text-muted-foreground/40">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </div>
        )}
      </div>

      {/* ── 搜索结果列表 ── */}
      <div
        ref={resultsRef}
        className={cn(
          'transition-all duration-300 ease-out',
          (isStreaming || expanded) && results.length > 0
            ? 'max-h-[400px] opacity-100 overflow-y-auto'
            : results.length === 0 && isStreaming
              ? 'max-h-[80px] opacity-100 overflow-hidden'
              : 'max-h-0 opacity-0 overflow-hidden',
        )}
        style={{ scrollbarWidth: 'thin' }}
      >
        {results.length > 0 ? (
          <div className="divide-y divide-border/30">
            {results.map((item, idx) => (
              <SearchResultRow key={`${item.url}-${idx}`} item={item} index={idx} isNew={isStreaming && idx === results.length - 1} />
            ))}
          </div>
        ) : isStreaming ? (
          /* 骨架屏 */
          <div className="px-4 py-3 space-y-2.5">
            {[65, 80, 50].map((w, i) => (
              <div key={i} className="flex gap-2 items-center animate-pulse" style={{ animationDelay: `${i * 150}ms` }}>
                <div className="w-4 h-4 rounded bg-muted flex-shrink-0" />
                <div className="flex-1 space-y-1">
                  <div className="h-3 rounded bg-muted" style={{ width: `${w}%` }} />
                  <div className="h-2 rounded bg-muted/50" style={{ width: `${w - 20}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* ── 底部状态条 ── */}
      {isStreaming && results.length > 0 && (
        <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50/50 dark:bg-blue-950/20 border-t border-blue-100/50 dark:border-blue-900/30">
          <Loader2 className="w-3 h-3 text-blue-500 animate-spin" />
          <span className="text-[10px] text-blue-500/70">正在获取更多结果...</span>
        </div>
      )}

      {/* ── 错误信息 ── */}
      {isError && tool.error && (
        <div className="px-3.5 py-2.5 bg-red-50/50 dark:bg-red-950/20 border-t border-red-100/50 dark:border-red-900/30">
          <p className="text-xs text-red-600 dark:text-red-400">{tool.error}</p>
        </div>
      )}
    </div>
  );
});

/** 单条搜索结果行 */
function SearchResultRow({ item, index, isNew }: { item: SearchResultItem; index: number; isNew: boolean }) {
  const domain = (() => {
    try { return new URL(item.url).hostname.replace('www.', ''); } catch { return ''; }
  })();

  return (
    <a
      href={item.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex gap-2.5 px-3.5 py-2.5 hover:bg-muted/50 transition-colors group',
        isNew && 'animate-in fade-in slide-in-from-bottom-1 duration-300',
      )}
    >
      {/* Favicon — ★ 使用服务端代理获取（/api/favicon?domain=xxx），支持 Google S2 走代理 */}
      <div className="w-5 h-5 rounded flex items-center justify-center bg-muted/60 flex-shrink-0 mt-0.5 overflow-hidden">
        {domain ? (
          <img
            src={item.favicon || `/api/favicon?domain=${encodeURIComponent(domain)}`}
            alt=""
            className="w-4 h-4 rounded-sm"
            loading="lazy"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              // 如果代理也失败了，隐藏 img 显示 Globe
              img.style.display = 'none';
              const parent = img.parentElement;
              if (parent && !parent.querySelector('svg')) {
                parent.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-muted-foreground/50"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>';
              }
            }}
          />
        ) : (
          <Globe className="w-3 h-3 text-muted-foreground/50" />
        )}
      </div>

      {/* 内容 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate transition-colors">
            {item.title}
          </span>
          <ExternalLink className="w-3 h-3 text-muted-foreground/30 group-hover:text-blue-500/50 flex-shrink-0 transition-colors" />
        </div>
        <p className="text-[10px] text-blue-600/50 dark:text-blue-400/40 truncate mt-0.5">{domain}</p>
        {item.snippet && (
          <p className="text-[11px] text-muted-foreground/70 line-clamp-2 mt-0.5 leading-relaxed">{item.snippet}</p>
        )}
      </div>

      {/* 序号 */}
      <span className="text-[9px] text-muted-foreground/30 font-mono flex-shrink-0 mt-0.5">{index + 1}</span>
    </a>
  );
}
