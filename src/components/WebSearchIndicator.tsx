/**
 * WebSearchIndicator — 联网搜索状态指示器
 *
 * 两种模式：
 * 1. 搜索进行中：显示搜索查询词 + 脉冲动画
 * 2. 搜索完成后：折叠的来源引用列表（附在消息末尾）
 */

import { useState } from 'react';
import { Globe, ChevronDown, ChevronUp, ExternalLink, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════ 搜索/抓取进行中状态 ═══════

interface SearchingIndicatorProps {
  query: string;
}

export function SearchingIndicator({ query }: SearchingIndicatorProps) {
  const isUrlFetch = query.startsWith('📄');
  const displayText = isUrlFetch ? query.replace('📄 ', '') : query;
  const Icon = isUrlFetch ? FileText : Globe;
  const colorScheme = isUrlFetch
    ? { bg: 'bg-emerald-50/80 dark:bg-emerald-950/30', border: 'border-emerald-100 dark:border-emerald-900/40', icon: 'text-emerald-500 dark:text-emerald-400', text: 'text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-400 dark:bg-emerald-500', ping: 'bg-emerald-400' }
    : { bg: 'bg-blue-50/80 dark:bg-blue-950/30', border: 'border-blue-100 dark:border-blue-900/40', icon: 'text-blue-500 dark:text-blue-400', text: 'text-blue-700 dark:text-blue-300', dot: 'bg-blue-400 dark:bg-blue-500', ping: 'bg-blue-400' };

  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 rounded-lg border animate-in fade-in slide-in-from-top-1 duration-300", colorScheme.bg, colorScheme.border)}>
      <div className="relative flex-shrink-0">
        <Icon className={cn("h-4 w-4", colorScheme.icon)} />
        <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
          <span className={cn("absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping", colorScheme.ping)} />
          <span className={cn("relative inline-flex h-2 w-2 rounded-full", colorScheme.dot.split(' ')[0])} />
        </span>
      </div>
      <span className={cn("text-xs", colorScheme.text)}>
        {isUrlFetch ? '正在阅读网页: ' : '正在搜索: '}
        <span className="font-medium">{displayText}</span>
      </span>
      <div className="flex gap-0.5 ml-auto">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            className={cn("w-1 h-1 rounded-full animate-pulse", colorScheme.dot)}
            style={{ animationDelay: `${i * 200}ms` }}
          />
        ))}
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

  return (
    <div className={cn('mt-3', className)}>
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className={cn(
          'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium',
          'transition-all duration-200',
          'text-muted-foreground hover:text-foreground',
          'bg-muted/60 hover:bg-muted border border-border/50',
        )}
      >
        <Globe className="h-3 w-3" />
        <span>参考来源 ({sources.length})</span>
        {expanded
          ? <ChevronUp className="h-3 w-3" />
          : <ChevronDown className="h-3 w-3" />
        }
      </button>

      {expanded && (
        <div className="mt-2 space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
          {sources.map((src, i) => (
            <a
              key={i}
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'flex items-start gap-2 px-3 py-1.5 rounded-lg text-xs',
                'text-muted-foreground hover:text-foreground hover:bg-accent/50',
                'transition-colors group',
              )}
            >
              <span className="text-[10px] font-mono text-muted-foreground/60 mt-0.5 flex-shrink-0">
                {i + 1}.
              </span>
              <span className="flex-1 min-w-0 truncate group-hover:underline">
                {src.title || src.url}
              </span>
              <ExternalLink className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-60 transition-opacity mt-0.5" />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
