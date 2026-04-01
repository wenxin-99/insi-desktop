/**
 * DataAnalysisStreamCard — 流式数据分析卡片
 *
 * AI 的分析结果直接在面板中逐字呈现。支持：
 *   - 纯文字分析/洞察
 *   - Markdown 表格实时成形
 *   - 分析结论流式输出
 *
 * 三阶段：
 *   1. streaming: 分析指示器 + 结果逐字出现
 *   2. complete:  完整分析结果 + 复制/导出
 *   3. error:     错误提示
 */
import { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  BarChart3, TrendingUp, Copy, Check, Loader2,
  Sparkles, AlertCircle, ChevronDown, ChevronUp,
  Download, Table,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ToolComponentRenderProps, DataAnalysisMeta } from '@/types/toolComponent';

const TYPE_CONFIG = {
  summary: { icon: BarChart3, label: '数据摘要', accent: 'amber' },
  chart: { icon: TrendingUp, label: '图表分析', accent: 'blue' },
  table: { icon: Table, label: '表格分析', accent: 'teal' },
  insight: { icon: Sparkles, label: '数据洞察', accent: 'purple' },
};

export const DataAnalysisStreamCard = memo(function DataAnalysisStreamCard({
  tool, onAction, isLive,
}: ToolComponentRenderProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const isStreaming = tool.status === 'streaming';
  const isError = tool.status === 'error';
  const meta = tool.meta as DataAnalysisMeta;
  const content = tool.streamedContent || '';
  const analysisType = meta.analysisType || 'summary';
  const config = TYPE_CONFIG[analysisType] || TYPE_CONFIG.summary;
  const TypeIcon = config.icon;
  const accent = config.accent;

  // 自动滚动
  useEffect(() => {
    if (isStreaming && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('分析结果已复制');
    } catch {
      toast.error('复制失败');
    }
  }, [content]);

  // 动态 accent 色
  const accentStyles = {
    amber: {
      border: 'border-amber-200/50 dark:border-amber-800/40',
      bar: 'from-amber-400 via-orange-400 to-amber-400',
      bg: 'from-amber-50/80 to-orange-50/60 dark:from-amber-950/30 dark:to-orange-950/20',
      barBg: 'bg-amber-100/80 dark:bg-amber-900/50',
      icon: 'text-amber-500',
      tag: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
      cursor: 'bg-amber-500/60',
      sparkle: 'text-amber-500',
    },
    blue: {
      border: 'border-blue-200/50 dark:border-blue-800/40',
      bar: 'from-blue-400 via-cyan-400 to-blue-400',
      bg: 'from-blue-50/80 to-cyan-50/60 dark:from-blue-950/30 dark:to-cyan-950/20',
      barBg: 'bg-blue-100/80 dark:bg-blue-900/50',
      icon: 'text-blue-500',
      tag: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
      cursor: 'bg-blue-500/60',
      sparkle: 'text-blue-500',
    },
    teal: {
      border: 'border-teal-200/50 dark:border-teal-800/40',
      bar: 'from-teal-400 via-emerald-400 to-teal-400',
      bg: 'from-teal-50/80 to-emerald-50/60 dark:from-teal-950/30 dark:to-emerald-950/20',
      barBg: 'bg-teal-100/80 dark:bg-teal-900/50',
      icon: 'text-teal-500',
      tag: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
      cursor: 'bg-teal-500/60',
      sparkle: 'text-teal-500',
    },
    purple: {
      border: 'border-purple-200/50 dark:border-purple-800/40',
      bar: 'from-purple-400 via-violet-400 to-purple-400',
      bg: 'from-purple-50/80 to-violet-50/60 dark:from-purple-950/30 dark:to-violet-950/20',
      barBg: 'bg-purple-100/80 dark:bg-purple-900/50',
      icon: 'text-purple-500',
      tag: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
      cursor: 'bg-purple-500/60',
      sparkle: 'text-purple-500',
    },
  }[accent] || {
    border: 'border-border', bar: 'from-primary to-primary', bg: 'bg-muted/30',
    barBg: 'bg-muted', icon: 'text-primary', tag: 'bg-muted text-foreground',
    cursor: 'bg-primary/60', sparkle: 'text-primary',
  };

  return (
    <div className={cn(
      'my-2 rounded-xl border overflow-hidden transition-all duration-300',
      'animate-in fade-in slide-in-from-bottom-2 duration-300',
      isStreaming ? accentStyles.border + ' shadow-sm' : isError ? 'border-red-200/60 dark:border-red-800/40' : 'border-border',
    )}>
      {/* 进度条 */}
      {isStreaming && (
        <div className={cn('h-[2px] overflow-hidden', accentStyles.barBg)}>
          <div
            className={cn('h-full bg-gradient-to-r', accentStyles.bar)}
            style={{
              width: `${Math.min(95, Math.max(5, content.length / 40))}%`,
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      )}

      {/* 头部 */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 border-b border-border/50',
        isStreaming ? cn('bg-gradient-to-r', accentStyles.bg) : 'bg-muted/30',
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isStreaming ? (
            <Loader2 className={cn('w-4 h-4 animate-spin flex-shrink-0', accentStyles.icon)} />
          ) : isError ? (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          ) : (
            <TypeIcon className={cn('w-4 h-4 flex-shrink-0', accentStyles.icon)} />
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground truncate">{meta.title || '数据分析'}</span>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', accentStyles.tag)}>
                {config.label}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              {isStreaming ? '分析中...' : `分析完成 · ${content.length} 字`}
              {meta.dataSource ? ` · ${meta.dataSource}` : ''}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          {!isStreaming && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setCollapsed(!collapsed)}>
            {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* 内容 */}
      <div className={cn(
        'transition-all duration-300 overflow-hidden',
        collapsed ? 'max-h-0' : 'max-h-[500px]',
      )}>
        {content ? (
          <div
            ref={contentRef}
            className="overflow-auto max-h-[450px] px-4 py-3 prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-headings:my-2 prose-table:my-2 prose-pre:my-1"
            style={{ scrollbarWidth: 'thin' }}
          >
            <SafeMarkdown>{content}</SafeMarkdown>
            {isStreaming && (
              <span className={cn('inline-block w-[2px] h-[1em] ml-0.5 animate-pulse align-text-bottom', accentStyles.cursor)} />
            )}
          </div>
        ) : (
          /* 骨架屏 - 数据分析风格 */
          <div className="px-4 py-4 space-y-3">
            <div className="flex gap-2">
              {[40, 30, 25].map((w, i) => (
                <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse flex-1" style={{ animationDelay: `${i * 120}ms` }} />
              ))}
            </div>
            <div className="space-y-1.5">
              {[80, 65, 90, 50].map((w, i) => (
                <div key={i} className="h-3 rounded bg-muted/50 animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 底部 */}
      {tool.status === 'complete' && !collapsed && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/20">
          <span className={cn('text-[11px] text-muted-foreground flex items-center gap-1')}>
            <Sparkles className={cn('w-3 h-3', accentStyles.sparkle)} />
            分析完成
          </span>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
            <Copy className="w-3 h-3" />
            复制结果
          </Button>
        </div>
      )}

      {isError && (
        <div className="px-3.5 py-2.5 bg-red-50/50 dark:bg-red-950/20 border-t border-red-100/50 dark:border-red-900/30">
          <p className="text-xs text-red-600 dark:text-red-400">{tool.error}</p>
        </div>
      )}
    </div>
  );
});
