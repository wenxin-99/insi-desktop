/**
 * FileGenStreamCard — 流式文件创建/修改卡片
 *
 * 文件内容直接在卡片中逐行出现，modify 时自动显示变更对比。
 * 比 CodeStreamCard 更轻量，用于通用文件操作（非纯代码场景）。
 *
 * 三阶段：
 *   1. streaming: 文件名 + 操作类型 + 内容流式显示
 *   2. complete:  完整内容 + 应用/下载按钮
 *   3. error:     错误提示
 */
import { useState, useEffect, useRef, memo, useCallback } from 'react';
import {
  File, FilePlus, FilePen, FileX, Copy, Check,
  Loader2, Sparkles, AlertCircle, ChevronDown, ChevronUp,
  Download, FileCheck,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ToolComponentRenderProps, FileGenMeta } from '@/types/toolComponent';

const ACTION_CONFIG = {
  create: { icon: FilePlus, label: '新建', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  modify: { icon: FilePen, label: '修改', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  delete: { icon: FileX, label: '删除', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
};

export const FileGenStreamCard = memo(function FileGenStreamCard({
  tool, onAction, isLive,
}: ToolComponentRenderProps) {
  const [copied, setCopied] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const contentRef = useRef<HTMLPreElement>(null);
  const isStreaming = tool.status === 'streaming';
  const isError = tool.status === 'error';
  const meta = tool.meta as FileGenMeta;
  const content = tool.streamedContent || '';
  const lines = content.split('\n');
  const config = ACTION_CONFIG[meta.action] || ACTION_CONFIG.create;
  const ActionIcon = config.icon;

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
      toast.success('文件内容已复制');
    } catch {
      toast.error('复制失败');
    }
  }, [content]);

  const handleApply = useCallback(() => {
    onAction?.('apply_file', { fileName: meta.fileName, content, action: meta.action });
    toast.success(`文件操作已应用: ${meta.fileName}`);
  }, [onAction, meta, content]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = meta.fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`已下载 ${meta.fileName}`);
  }, [content, meta.fileName]);

  // 文件扩展名
  const ext = meta.fileName.split('.').pop()?.toUpperCase() || 'FILE';

  return (
    <div className={cn(
      'my-2 rounded-xl border overflow-hidden transition-all duration-300',
      'animate-in fade-in slide-in-from-bottom-2 duration-300',
      isStreaming
        ? 'border-sky-200/50 dark:border-sky-800/40 shadow-sm'
        : isError
          ? 'border-red-200/60 dark:border-red-800/40'
          : 'border-border',
    )}>
      {/* ── 进度条 ── */}
      {isStreaming && (
        <div className="h-[2px] bg-sky-100/80 dark:bg-sky-900/50 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-sky-400 via-blue-400 to-sky-400"
            style={{
              width: `${Math.min(95, Math.max(5, content.length / 30))}%`,
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      )}

      {/* ── 头部 ── */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 border-b border-border/50',
        isStreaming
          ? 'bg-gradient-to-r from-sky-50/80 to-blue-50/60 dark:from-sky-950/30 dark:to-blue-950/20'
          : 'bg-muted/30',
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isStreaming ? (
            <Loader2 className="w-4 h-4 text-sky-500 animate-spin flex-shrink-0" />
          ) : isError ? (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          ) : (
            <ActionIcon className={cn('w-4 h-4 flex-shrink-0', config.color)} />
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground truncate">{meta.fileName}</span>
              <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0', config.bg, config.color)}>
                {config.label}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              {isStreaming
                ? `${ext} · 写入中...`
                : `${ext} · ${lines.length} 行`}
              {meta.description ? ` · ${meta.description}` : ''}
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

      {/* ── 内容区 ── */}
      <div className={cn(
        'transition-all duration-300 overflow-hidden',
        collapsed ? 'max-h-0' : 'max-h-[400px]',
      )}>
        {content ? (
          <pre
            ref={contentRef}
            className="overflow-auto max-h-[350px] bg-[#0d1117] text-[12px] leading-5 font-mono px-3 py-2 text-gray-300 whitespace-pre-wrap break-all"
            style={{ scrollbarWidth: 'thin' }}
          >
            {content}
            {isStreaming && (
              <span className="inline-block w-[2px] h-[1em] bg-sky-400 ml-[1px] animate-pulse align-text-bottom" />
            )}
          </pre>
        ) : (
          <div className="px-4 py-3 space-y-1.5">
            {[70, 55, 80, 40].map((w, i) => (
              <div key={i} className="h-3 rounded bg-muted/50 animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        )}
      </div>

      {/* ── 底部操作栏 ── */}
      {tool.status === 'complete' && !collapsed && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/20">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-sky-500" />
            文件已生成
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleDownload}>
              <Download className="w-3 h-3" />
              下载
            </Button>
            {onAction && (
              <Button size="sm" className="h-7 text-xs gap-1 bg-sky-600 hover:bg-sky-700 text-white" onClick={handleApply}>
                <FileCheck className="w-3 h-3" />
                应用
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── 错误 ── */}
      {isError && (
        <div className="px-3.5 py-2.5 bg-red-50/50 dark:bg-red-950/20 border-t border-red-100/50 dark:border-red-900/30">
          <p className="text-xs text-red-600 dark:text-red-400">{tool.error}</p>
        </div>
      )}
    </div>
  );
});
