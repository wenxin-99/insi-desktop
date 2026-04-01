/**
 * CodeStreamCard — 流式代码生成/编辑卡片
 *
 * 代码直接在带语法高亮的编辑器中逐行出现，
 * 用户可以实时看到 AI 正在编写的代码。
 *
 * 三阶段：
 *   1. streaming: 代码逐行流入 + 行号 + 语法高亮 + 光标动画
 *   2. complete:  完整代码 + 复制/应用/查看 diff 按钮
 *   3. error:     错误提示 + 已生成部分代码
 */
import { useState, useEffect, useRef, useMemo, memo, useCallback } from 'react';
import {
  Code2, Copy, Check, FileCode, Pencil, RotateCcw,
  ChevronDown, ChevronUp, Loader2, Sparkles, AlertCircle,
  FileDiff, FileCheck, FileX, Download,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import type { ToolComponentRenderProps, CodeGenMeta } from '@/types/toolComponent';

const ACTION_ICONS = {
  create: FileCheck,
  modify: FileDiff,
  refactor: RotateCcw,
};

const ACTION_LABELS = {
  create: '创建文件',
  modify: '修改文件',
  refactor: '重构代码',
};

const ACTION_COLORS = {
  create: 'text-green-600 dark:text-green-400',
  modify: 'text-amber-600 dark:text-amber-400',
  refactor: 'text-blue-600 dark:text-blue-400',
};

export const CodeStreamCard = memo(function CodeStreamCard({
  tool, onAction, isLive,
}: ToolComponentRenderProps) {
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);
  const isStreaming = tool.status === 'streaming';
  const isError = tool.status === 'error';
  const meta = tool.meta as CodeGenMeta;
  const code = tool.streamedContent || '';
  const lines = code.split('\n');
  const lineCount = lines.length;

  // 自动滚动到最新代码行
  useEffect(() => {
    if (isStreaming && codeRef.current) {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [code, isStreaming]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('代码已复制');
    } catch {
      toast.error('复制失败');
    }
  }, [code]);

  const handleApply = useCallback(() => {
    onAction?.('apply_code', { fileName: meta.fileName, code });
    toast.success(`已应用到 ${meta.fileName}`);
  }, [onAction, meta.fileName, code]);

  const ActionIcon = ACTION_ICONS[meta.action] || FileCode;
  const actionLabel = ACTION_LABELS[meta.action] || '生成代码';
  const actionColor = ACTION_COLORS[meta.action] || 'text-primary';

  // 简单的语言高亮 class
  const langClass = useMemo(() => {
    const map: Record<string, string> = {
      typescript: 'language-typescript',
      javascript: 'language-javascript',
      python: 'language-python',
      html: 'language-html',
      css: 'language-css',
      json: 'language-json',
      sql: 'language-sql',
      tsx: 'language-tsx',
      jsx: 'language-jsx',
    };
    return map[meta.language?.toLowerCase()] || 'language-text';
  }, [meta.language]);

  return (
    <div className={cn(
      'my-2 rounded-xl border overflow-hidden transition-all duration-300',
      'animate-in fade-in slide-in-from-bottom-2 duration-300',
      isStreaming
        ? 'border-emerald-200/50 dark:border-emerald-800/40 shadow-sm shadow-emerald-100/30 dark:shadow-emerald-900/10'
        : isError
          ? 'border-red-200/60 dark:border-red-800/40'
          : 'border-border',
    )}>
      {/* ── 流式进度条 ── */}
      {isStreaming && (
        <div className="h-[2px] bg-emerald-100/80 dark:bg-emerald-900/50 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-emerald-400 via-teal-400 to-emerald-400"
            style={{
              width: `${Math.min(95, Math.max(5, code.length / 30))}%`,
              transition: 'width 0.3s ease-out',
            }}
          />
        </div>
      )}

      {/* ── 头部 ── */}
      <div className={cn(
        'flex items-center justify-between px-3 py-2 border-b border-border/50',
        isStreaming
          ? 'bg-gradient-to-r from-emerald-50/80 to-teal-50/60 dark:from-emerald-950/30 dark:to-teal-950/20'
          : 'bg-muted/30',
      )}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {isStreaming ? (
            <div className="relative flex-shrink-0">
              <Loader2 className="w-4 h-4 text-emerald-500 animate-spin" />
            </div>
          ) : isError ? (
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
          ) : (
            <ActionIcon className={cn('w-4 h-4 flex-shrink-0', actionColor)} />
          )}
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-semibold text-foreground truncate">
                {meta.fileName}
              </span>
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium flex-shrink-0',
                meta.action === 'create'
                  ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                  : meta.action === 'modify'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                    : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
              )}>
                {actionLabel}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground truncate">
              {isStreaming
                ? `${meta.language?.toUpperCase() || 'CODE'} · 编写中...`
                : `${meta.language?.toUpperCase() || 'CODE'} · ${lineCount} 行 · ${code.length} 字符`}
              {meta.description ? ` · ${meta.description}` : ''}
            </span>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {!isStreaming && (
            <>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>
                {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
              </Button>
              {meta.oldCode && (
                <Button
                  variant="ghost" size="sm"
                  className={cn('h-7 w-7 p-0', showDiff && 'text-primary bg-primary/10')}
                  onClick={() => setShowDiff(!showDiff)}
                  title="查看变更"
                >
                  <FileDiff className="w-3 h-3" />
                </Button>
              )}
            </>
          )}
          <Button
            variant="ghost" size="sm"
            className="h-7 w-7 p-0"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronDown className="w-3 h-3" /> : <ChevronUp className="w-3 h-3" />}
          </Button>
        </div>
      </div>

      {/* ── 代码区域 ── */}
      <div className={cn(
        'transition-all duration-300 ease-out overflow-hidden',
        collapsed ? 'max-h-0' : isStreaming ? 'max-h-[500px]' : 'max-h-[600px]',
      )}>
        {/* Diff 视图 */}
        {showDiff && meta.oldCode && !isStreaming ? (
          <DiffView oldCode={meta.oldCode} newCode={code} />
        ) : (
          /* 代码视图 */
          <pre
            ref={codeRef}
            className={cn(
              'overflow-auto bg-[#0d1117] text-[12px] leading-5 font-mono',
              isStreaming ? 'max-h-[400px]' : 'max-h-[500px]',
            )}
            style={{ scrollbarWidth: 'thin' }}
          >
            <code className={langClass}>
              {lines.map((line, i) => (
                <div key={i} className="flex hover:bg-white/5 transition-colors">
                  {/* 行号 */}
                  <span className="inline-block w-10 text-right pr-3 select-none text-gray-600/60 flex-shrink-0 text-[11px]">
                    {i + 1}
                  </span>
                  {/* 代码内容 */}
                  <span className="flex-1 text-gray-300 whitespace-pre-wrap break-all pr-4">
                    {line}
                    {/* 流式光标（最后一行） */}
                    {isStreaming && i === lines.length - 1 && (
                      <span className="inline-block w-[2px] h-[1em] bg-emerald-400 ml-[1px] animate-pulse align-text-bottom" />
                    )}
                  </span>
                </div>
              ))}
            </code>
          </pre>
        )}
      </div>

      {/* ── 底部操作栏（完成态） ── */}
      {tool.status === 'complete' && !collapsed && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/50 bg-muted/20">
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-500" />
            代码已生成
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={handleCopy}>
              <Copy className="w-3 h-3" />
              复制
            </Button>
            {onAction && (
              <Button size="sm" className="h-7 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleApply}>
                <FileCheck className="w-3 h-3" />
                应用
              </Button>
            )}
          </div>
        </div>
      )}

      {/* ── 错误状态 ── */}
      {isError && (
        <div className="px-3.5 py-2.5 bg-red-50/50 dark:bg-red-950/20 border-t border-red-100/50 dark:border-red-900/30">
          <p className="text-xs text-red-600 dark:text-red-400">{tool.error}</p>
        </div>
      )}
    </div>
  );
});

/** 简单 Diff 对比视图 */
function DiffView({ oldCode, newCode }: { oldCode: string; newCode: string }) {
  const oldLines = oldCode.split('\n');
  const newLines = newCode.split('\n');
  const maxLen = Math.max(oldLines.length, newLines.length);

  const diffLines: Array<{ type: 'same' | 'add' | 'remove'; content: string }> = [];
  for (let i = 0; i < maxLen; i++) {
    const ol = oldLines[i];
    const nl = newLines[i];
    if (ol === nl) {
      if (ol !== undefined) diffLines.push({ type: 'same', content: ol });
    } else {
      if (ol !== undefined) diffLines.push({ type: 'remove', content: ol });
      if (nl !== undefined) diffLines.push({ type: 'add', content: nl });
    }
  }

  // 只展示变更行周围的上下文
  const contextLines = new Set<number>();
  diffLines.forEach((l, i) => {
    if (l.type !== 'same') {
      for (let j = Math.max(0, i - 2); j <= Math.min(diffLines.length - 1, i + 2); j++) {
        contextLines.add(j);
      }
    }
  });

  return (
    <div className="overflow-auto max-h-[400px] bg-[#0d1117] text-[11px] leading-5 font-mono" style={{ scrollbarWidth: 'thin' }}>
      {diffLines.map((line, i) => {
        if (!contextLines.has(i)) return null;
        return (
          <div
            key={i}
            className={cn(
              'flex px-2 py-0.5',
              line.type === 'add' && 'bg-green-950/40 text-green-300',
              line.type === 'remove' && 'bg-red-950/40 text-red-300 line-through opacity-70',
              line.type === 'same' && 'text-gray-500',
            )}
          >
            <span className="inline-block w-6 text-right mr-2 opacity-40 select-none">
              {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
            </span>
            <span className="flex-1 whitespace-pre-wrap break-all">{line.content}</span>
          </div>
        );
      })}
    </div>
  );
}
