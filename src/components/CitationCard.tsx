/**
 * CitationCard — ```citations 代码块渲染组件
 *
 * 深度研究完成后的参考来源展示，Perplexity 风格。
 *
 * JSON Schema:
 * {
 *   "sources": [
 *     {
 *       "title": "文章标题",
 *       "url": "https://...",
 *       "domain": "example.com",
 *       "snippet": "摘要...",
 *       "reliability": "high" | "medium" | "low",
 *       "publishDate": "2025-01"
 *     }
 *   ]
 * }
 */

import { memo, useState } from 'react';
import { BookOpen, ExternalLink, ChevronDown, ChevronUp, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════

interface CitationSource {
  title: string;
  url: string;
  domain?: string;
  snippet?: string;
  reliability?: 'high' | 'medium' | 'low';
  publishDate?: string;
}

interface CitationData {
  title?: string;
  sources: CitationSource[];
}

interface CitationCardProps {
  jsonStr: string;
  streaming?: boolean;
}

// ═══════ 可信度配置 ═══════

const RELIABILITY_CONFIG = {
  high: {
    icon: ShieldCheck,
    label: '高可信',
    colors: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800',
  },
  medium: {
    icon: Shield,
    label: '中等',
    colors: 'text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
  },
  low: {
    icon: ShieldAlert,
    label: '待验证',
    colors: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800',
  },
};

/** 从 URL 提取域名 */
function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/** favicon URL */
function faviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

function CitationCardInner({ jsonStr, streaming }: CitationCardProps) {
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  let parsed: CitationData | null = null;
  {
    const r = safeParseJson<any>(jsonStr);
    // ★ 兼容裸数组：AI 可能直接输出 sources 数组
    if (Array.isArray(r.data)) {
      parsed = { sources: r.data };
    } else {
      parsed = r.data;
    }
  }

  // ═══════ 流式骨架 ═══════
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-4 h-4 text-blue-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '引用来源加载中...'}</h3>
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-5 h-5 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
                <div className="flex-1 h-10 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 80 + 40}ms` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-300 via-blue-500 to-blue-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // ═══════ 解析失败降级 ═══════
  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>引用来源格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const sources = parsed.sources || [];
  const INITIAL_COUNT = 5;
  const displaySources = showAll ? sources : sources.slice(0, INITIAL_COUNT);

  const toggleItem = (idx: number) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* ═══════ 标题栏 ═══════ */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <BookOpen className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-medium">{parsed.title || '参考来源'}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {sources.length} 条
          </span>
        </div>
      </div>

      {/* ═══════ 来源列表 ═══════ */}
      <div className="divide-y divide-border">
        {displaySources.map((src, idx) => {
          const domain = src.domain || extractDomain(src.url || '');
          const reliability = src.reliability ? RELIABILITY_CONFIG[src.reliability] : null;
          const expanded = expandedItems.has(idx);

          return (
            <div key={idx} className="px-4 py-2.5 hover:bg-muted/20 transition-colors group">
              <div className="flex items-start gap-2.5">
                {/* 序号 */}
                <span className="flex-shrink-0 w-5 h-5 rounded-full bg-muted text-[10px] font-semibold flex items-center justify-center text-muted-foreground">
                  {idx + 1}
                </span>

                <div className="flex-1 min-w-0">
                  {/* 标题行 */}
                  <div className="flex items-start gap-2">
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-medium text-foreground hover:text-blue-600 dark:hover:text-blue-400 transition-colors line-clamp-1 flex-1"
                      title={src.title}
                    >
                      {src.title}
                    </a>
                    <a
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-muted-foreground hover:text-blue-500 transition-colors sm:opacity-0 sm:group-hover:opacity-100"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>

                  {/* 域名 + 日期 + 可信度 */}
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <div className="flex items-center gap-1">
                      <img
                        src={faviconUrl(domain)}
                        alt=""
                        className="w-3 h-3 rounded-sm"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <span className="text-[10px] text-muted-foreground">{domain}</span>
                    </div>
                    {src.publishDate && (
                      <span className="text-[10px] text-muted-foreground">{src.publishDate}</span>
                    )}
                    {reliability && (
                      <span className={cn('inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full border', reliability.colors)}>
                        <reliability.icon className="w-2.5 h-2.5" />
                        {reliability.label}
                      </span>
                    )}
                  </div>

                  {/* 摘要 */}
                  {src.snippet && (
                    <div className="mt-1">
                      <p
                        className={cn(
                          'text-[11px] text-muted-foreground leading-relaxed cursor-pointer',
                          expanded ? '' : 'line-clamp-2'
                        )}
                        onClick={() => toggleItem(idx)}
                      >
                        {src.snippet}
                      </p>
                      {src.snippet.length > 100 && (
                        <button
                          onClick={() => toggleItem(idx)}
                          className="text-[10px] text-blue-500 hover:text-blue-600 mt-0.5"
                        >
                          {expanded ? '收起' : '展开'}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══════ 展开更多 ═══════ */}
      {sources.length > INITIAL_COUNT && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full flex items-center justify-center gap-1 py-2 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/20 border-t border-border transition-colors"
        >
          {showAll ? (
            <>收起 <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>查看全部 {sources.length} 条来源 <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </div>
  );
}

export const CitationCard = memo(CitationCardInner);
