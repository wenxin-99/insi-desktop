/**
 * DocumentStreamCard — 流式文档生成卡片
 *
 * 文档内容直接在预览面板中逐字出现，用户可以实时看到文档成形。
 * 支持 Markdown 实时渲染 + 骨架屏 + 导出操作。
 *
 * 三阶段：
 *   1. streaming: 文档标题已定 + 内容流式 Markdown 渲染 + 光标动画
 *   2. complete:  完整文档 + 导出（PDF/Word/MD）按钮
 *   3. error:     错误提示
 */
import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import {
  FileText, Download, Copy, Check, Loader2, Sparkles,
  AlertCircle, ChevronDown, ChevronUp, Eye, Code2,
  FileDown, Maximize2, Minimize2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ToolComponentRenderProps, DocGenMeta } from '@/types/toolComponent';

const FORMAT_LABELS: Record<string, string> = {
  markdown: 'Markdown',
  html: 'HTML',
  pdf: 'PDF',
  word: 'Word',
};

const FORMAT_COLORS: Record<string, string> = {
  markdown: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  html: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  pdf: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  word: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
};

export const DocumentStreamCard = memo(function DocumentStreamCard({
  tool, onAction, isLive,
}: ToolComponentRenderProps) {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'preview' | 'source'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const isStreaming = tool.status === 'streaming';
  const isError = tool.status === 'error';
  const meta = tool.meta as DocGenMeta;
  const content = tool.streamedContent || '';
  const charCount = content.length;
  const wordCount = content.replace(/[^\u4e00-\u9fff\w]/g, '').length;

  // 自动滚动到最新内容
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
      toast.success('文档内容已复制');
    } catch {
      toast.error('复制失败');
    }
  }, [content]);

  const handleExport = useCallback((format: string) => {
    // ★ 如果已有下载链接（文档生成流程产出的 .docx），直接下载
    const downloadUrl = (tool as any).result?.downloadUrl;
    if (downloadUrl) {
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `${meta.title || '文档'}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      toast.success('文档下载已开始');
      return;
    }
    // 没有现成链接 → 请求前端生成
    onAction?.('export_document', { format, content, title: meta.title });
  }, [onAction, content, meta.title, tool]);

  const cardClass = isFullscreen
    ? 'fixed inset-0 sm:inset-4 z-[60] bg-card sm:border sm:border-border sm:rounded-2xl shadow-2xl flex flex-col'
    : cn(
      'my-2 rounded-xl border overflow-hidden flex flex-col transition-all duration-300',
      'animate-in fade-in slide-in-from-bottom-2 duration-300',
      isStreaming
        ? 'border-violet-200/50 dark:border-violet-800/40 shadow-sm shadow-violet-100/30 dark:shadow-violet-900/10'
        : isError
          ? 'border-red-200/60 dark:border-red-800/40'
          : 'border-border',
    );

  return (
    <>
      {isFullscreen && <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm" onClick={() => setIsFullscreen(false)} />}
      <div className={cardClass}>
        {/* ── 流式进度条 ── */}
        {isStreaming && (
          <div className="h-[2px] bg-violet-100/80 dark:bg-violet-900/50 overflow-hidden flex-shrink-0">
            <div
              className="h-full bg-gradient-to-r from-violet-400 via-purple-400 to-violet-400"
              style={{
                width: `${Math.min(95, Math.max(5, charCount / 50))}%`,
                transition: 'width 0.3s ease-out',
              }}
            />
          </div>
        )}

        {/* ── 头部 ── */}
        <div className={cn(
          'flex items-center justify-between px-3 py-2 border-b border-border/50 flex-shrink-0',
          isStreaming
            ? 'bg-gradient-to-r from-violet-50/80 to-purple-50/60 dark:from-violet-950/30 dark:to-purple-950/20'
            : 'bg-muted/30',
        )}>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isStreaming ? (
              <Loader2 className="w-4 h-4 text-violet-500 animate-spin flex-shrink-0" />
            ) : isError ? (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            ) : (
              <FileText className="w-4 h-4 text-violet-500 flex-shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-foreground truncate">
                  {meta.title || '文档'}
                </span>
                <span className={cn(
                  'text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
                  FORMAT_COLORS[meta.format] || FORMAT_COLORS.markdown,
                )}>
                  {FORMAT_LABELS[meta.format] || meta.format}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground truncate">
                {isStreaming
                  ? `撰写中... · ${charCount} 字`
                  : `${charCount} 字 · ${wordCount} 字符`}
                {meta.description ? ` · ${meta.description}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* 预览/源码切换 */}
            <div className="flex bg-muted rounded-lg p-0.5 mr-1">
              {(['preview', 'source'] as const).map(tab => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all',
                    activeTab === tab
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {tab === 'preview' ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
                  <span className="hidden sm:inline">{tab === 'preview' ? '预览' : '源码'}</span>
                </button>
              ))}
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* ── 内容区 ── */}
        <div
          ref={contentRef}
          className={cn(
            'overflow-auto',
            isFullscreen ? 'flex-1' : 'max-h-[400px]',
          )}
          style={{ scrollbarWidth: 'thin' }}
        >
          {content ? (
            activeTab === 'preview' ? (
              <div className="px-4 py-3 prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-headings:my-3 prose-pre:my-2 prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5">
                <SafeMarkdown>{content}</SafeMarkdown>
                {/* 流式光标 */}
                {isStreaming && (
                  <span className="inline-block w-[2px] h-[1em] bg-violet-500/60 ml-0.5 animate-pulse align-text-bottom" />
                )}
              </div>
            ) : (
              <pre className="px-4 py-3 text-[12px] leading-5 font-mono text-gray-300 bg-[#0d1117] whitespace-pre-wrap break-all">
                {content}
                {isStreaming && (
                  <span className="inline-block w-[2px] h-[1em] bg-violet-400 ml-[1px] animate-pulse align-text-bottom" />
                )}
              </pre>
            )
          ) : (
            /* 骨架屏 */
            <div className="px-4 py-4 space-y-3">
              <div className="h-6 rounded bg-muted animate-pulse w-1/3" />
              <div className="space-y-1.5">
                {[90, 75, 85, 60, 80, 45, 70].map((w, i) => (
                  <div
                    key={i}
                    className="h-3 rounded bg-muted/60 animate-pulse"
                    style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── 底部操作栏（完成态） ── */}
        {tool.status === 'complete' && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/20 flex-shrink-0">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-violet-500" />
              文档已生成
            </span>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
                <Copy className="w-3 h-3" />
                复制
              </Button>
              {meta.format === 'pdf' && onAction && (
                <Button size="sm" className="h-7 text-xs gap-1 bg-red-600 hover:bg-red-700 text-white" onClick={() => handleExport('pdf')}>
                  <FileDown className="w-3 h-3" />
                  导出 PDF
                </Button>
              )}
              {meta.format === 'word' && onAction && (
                <Button size="sm" className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => handleExport('word')}>
                  <FileDown className="w-3 h-3" />
                  导出 Word
                </Button>
              )}
              {(!meta.format || meta.format === 'markdown' || meta.format === 'html') && (
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => handleExport('markdown')}>
                  <Download className="w-3 h-3" />
                  下载
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── 错误状态 ── */}
        {isError && (
          <div className="px-3.5 py-2.5 bg-red-50/50 dark:bg-red-950/20 border-t border-red-100/50 dark:border-red-900/30 flex-shrink-0">
            <p className="text-xs text-red-600 dark:text-red-400">{tool.error}</p>
          </div>
        )}
      </div>
    </>
  );
});
