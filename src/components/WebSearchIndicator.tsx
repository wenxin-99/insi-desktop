/**
 * WebSearchIndicator — 联网搜索状态指示器 (v2)
 *
 * 三种模式：
 * 1. 单次搜索进行中：显示搜索查询词 + 动画
 * 2. 多轮迭代搜索：显示搜索进度 + 已搜索次数
 * 3. 搜索完成后：折叠的来源引用列表
 */

import { useState, useEffect } from 'react';
import { Globe, ChevronDown, ChevronUp, ExternalLink, FileText, Search, Zap, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════ 搜索进行中状态 ═══════

interface SearchingIndicatorProps {
  query: string;
}

export function SearchingIndicator({ query }: SearchingIndicatorProps) {
  const isUrlFetch = query.startsWith('📄');
  const isMultiRound = query.startsWith('🔄');
  const [dots, setDots] = useState('');

  useEffect(() => {
    const t = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 400);
    return () => clearInterval(t);
  }, []);

  // ── 多轮搜索模式 ──
  if (isMultiRound) {
    const cleanQuery = query.replace('🔄 ', '');
    const countMatch = cleanQuery.match(/\[(\d+)\]\s*(.*)/);
    const analyzeMatch = cleanQuery.match(/已搜索\s*(\d+)\s*次/);

    const searchCount = countMatch ? parseInt(countMatch[1]) : analyzeMatch ? parseInt(analyzeMatch[1]) : 0;
    const currentQuery = countMatch ? countMatch[2] : '';
    const isAnalyzing = !!analyzeMatch;

    return (
      <div className="overflow-hidden rounded-xl border border-blue-200/60 dark:border-blue-800/40 bg-gradient-to-r from-blue-50/90 via-indigo-50/60 to-blue-50/90 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-blue-950/40 animate-in fade-in slide-in-from-top-2 duration-300">
        <div className="h-[3px] bg-blue-100/80 dark:bg-blue-900/50 overflow-hidden">
          <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-blue-500 to-transparent"
            style={{ animation: 'searchSlide 1.5s ease-in-out infinite' }} />
        </div>

        <div className="px-3.5 py-2.5">
          <div className="flex items-center gap-2.5">
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/60 dark:to-indigo-900/60 flex items-center justify-center shadow-sm">
                <Search className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
              </div>
              {searchCount > 1 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-gradient-to-r from-indigo-500 to-blue-600 text-[10px] font-bold text-white flex items-center justify-center leading-none shadow-sm">
                  {searchCount}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              {isAnalyzing ? (
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">深度搜索</span>
                  <span className="text-[11px] text-blue-500/70 dark:text-blue-400/60">
                    · 已完成 {searchCount} 次搜索，正在判断{dots}
                  </span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">第 {searchCount} 次搜索</span>
                    <Zap className="w-3 h-3 text-amber-500" />
                  </div>
                  {currentQuery && (
                    <p className="text-[11px] text-blue-600/60 dark:text-blue-400/50 truncate mt-0.5">{currentQuery}</p>
                  )}
                </>
              )}
            </div>

            <Loader2 className="w-3.5 h-3.5 text-blue-400 dark:text-blue-500 animate-spin flex-shrink-0" />
          </div>
        </div>
      </div>
    );
  }

  // ── 单次搜索 / URL 抓取 ──
  const displayText = isUrlFetch ? query.replace('📄 ', '') : query;
  const Icon = isUrlFetch ? FileText : Globe;

  const c = isUrlFetch
    ? { border: 'border-emerald-200/60 dark:border-emerald-800/40', bg: 'from-emerald-50/90 to-teal-50/80 dark:from-emerald-950/40 dark:to-teal-950/30', bar: 'via-emerald-500', barBg: 'bg-emerald-100/80 dark:bg-emerald-900/50', iconBg: 'from-emerald-100 to-teal-100 dark:from-emerald-900/60 dark:to-teal-900/60', icon: 'text-emerald-600 dark:text-emerald-400', title: 'text-emerald-700 dark:text-emerald-300', sub: 'text-emerald-600/60 dark:text-emerald-400/50', loader: 'text-emerald-400 dark:text-emerald-500' }
    : { border: 'border-blue-200/60 dark:border-blue-800/40', bg: 'from-blue-50/90 to-sky-50/80 dark:from-blue-950/40 dark:to-sky-950/30', bar: 'via-blue-500', barBg: 'bg-blue-100/80 dark:bg-blue-900/50', iconBg: 'from-blue-100 to-sky-100 dark:from-blue-900/60 dark:to-sky-900/60', icon: 'text-blue-600 dark:text-blue-400', title: 'text-blue-700 dark:text-blue-300', sub: 'text-blue-600/60 dark:text-blue-400/50', loader: 'text-blue-400 dark:text-blue-500' };

  return (
    <div className={cn('overflow-hidden rounded-xl border bg-gradient-to-r animate-in fade-in slide-in-from-top-2 duration-300', c.border, c.bg)}>
      <div className={cn('h-[3px] overflow-hidden', c.barBg)}>
        <div className={cn('h-full w-1/3 bg-gradient-to-r from-transparent to-transparent', c.bar)}
          style={{ animation: 'searchSlide 1.5s ease-in-out infinite' }} />
      </div>

      <div className="px-3.5 py-2.5 flex items-center gap-2.5">
        <div className={cn('w-7 h-7 rounded-lg bg-gradient-to-br flex items-center justify-center flex-shrink-0 shadow-sm', c.iconBg)}>
          <Icon className={cn('w-3.5 h-3.5', c.icon)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className={cn('text-xs font-semibold', c.title)}>
            {isUrlFetch ? '正在阅读网页' : '联网搜索中'}
          </div>
          <p className={cn('text-[11px] truncate mt-0.5', c.sub)}>{displayText}</p>
        </div>

        <Loader2 className={cn('w-3.5 h-3.5 animate-spin flex-shrink-0', c.loader)} />
      </div>
    </div>
  );
}

// ═══════ 搜索来源列表 ═══════

interface WebSearchSourcesProps {
  sources: Array<{ title: string; url: string }>;
  query?: string;
  className?: string;
}

export function WebSearchSources({ sources, query, className }: WebSearchSourcesProps) {
  const [expanded, setExpanded] = useState(false);

  if (!sources || sources.length === 0) return null;

  const getDomain = (url: string) => {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
  };

  return (
    <div className={cn('mt-3', className)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-[11px] font-medium',
          'transition-all duration-200',
          'text-muted-foreground hover:text-foreground',
          'bg-muted/50 hover:bg-muted border border-border/40 hover:border-border/60',
          'hover:shadow-sm',
        )}
      >
        <Globe className="h-3 w-3 text-blue-500" />
        <span>参考来源</span>
        <span className="px-1.5 py-0.5 rounded-md bg-blue-100/80 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 text-[10px] font-semibold">
          {sources.length}
        </span>
        {expanded ? <ChevronUp className="h-3 w-3 ml-0.5" /> : <ChevronDown className="h-3 w-3 ml-0.5" />}
      </button>

      {expanded && (
        <div className="mt-2 rounded-xl border border-border/40 bg-muted/20 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
          {sources.map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-center gap-2.5 px-3 py-2 text-xs',
                'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                'transition-colors group',
                i > 0 && 'border-t border-border/30',
              )}
            >
              <img
                src={`https://www.google.com/s2/favicons?domain=${getDomain(src.url)}&sz=16`}
                alt="" className="w-4 h-4 rounded-sm flex-shrink-0"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <span className="flex-1 min-w-0 truncate group-hover:underline">
                {src.title || getDomain(src.url)}
              </span>
              <span className="text-[10px] text-muted-foreground/50 flex-shrink-0 hidden sm:inline">
                {getDomain(src.url)}
              </span>
              <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-50 transition-opacity" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
