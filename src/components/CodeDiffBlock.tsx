/**
 * CodeDiffBlock.tsx (v2)
 *
 * 集成三大增强:
 * 1. InlineHighlight — word-level 行内字符高亮
 * 2. FileVersionPanel — 点击「历史」查看/回滚版本
 * 3. CodeSandboxPreview — 前端代码 iframe 预览
 */

import { useState, useMemo, useCallback, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, Check, ChevronDown, ChevronUp, FileCode, Minus, Plus, GitBranch, History } from 'lucide-react';
import { toast } from 'sonner';
import type { CodeDiff, DiffLine, InlineSegment } from '@/lib/diffParser';
import { computeDiffLines } from '@/lib/diffParser';
import { fileVersionStore } from '@/lib/fileVersionStore';
import { FileVersionPanel } from './FileVersionPanel';
import { CodeSandboxPreview, isPreviewableCode } from './CodeSandboxPreview';

interface CodeDiffBlockProps {
  diff: CodeDiff;
  defaultExpanded?: boolean;
  conversationId?: string | number;
  messageIndex?: number;
}

export const CodeDiffBlock = memo(function CodeDiffBlock({
  diff, defaultExpanded = true, conversationId, messageIndex,
}: CodeDiffBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [copiedNew, setCopiedNew] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const diffLines = useMemo(() => computeDiffLines(diff), [diff]);
  const stats = useMemo(() => {
    let a = 0, r = 0;
    for (const l of diffLines) { if (l.type === 'added') a++; if (l.type === 'removed') r++; }
    return { added: a, removed: r };
  }, [diffLines]);
  const fileExt = diff.file.match(/\.(\w+)$/)?.[1] || 'text';
  const canPreview = useMemo(() => isPreviewableCode(diff.file, fileExt, diff.replacement), [diff.file, fileExt, diff.replacement]);

  // 自动记录版本
  useEffect(() => {
    if (conversationId && diff.file && diff.replacement) {
      fileVersionStore.addVersion(conversationId, diff.file, diff.search, diff.replacement, diff.reason || '代码修改', messageIndex);
    }
  }, [conversationId, diff.file, diff.search, diff.replacement, diff.reason, messageIndex]);

  const handleCopyNew = useCallback(async () => {
    try { await navigator.clipboard.writeText(diff.replacement); setCopiedNew(true); setTimeout(() => setCopiedNew(false), 2000); }
    catch { toast.error('复制失败'); }
  }, [diff.replacement]);

  return (
    <div className="my-3 rounded-lg border border-border overflow-hidden bg-card shadow-sm">
      {/* 头部 */}
      <div className="flex items-center justify-between px-3 py-2.5 bg-muted/50 border-b border-border cursor-pointer hover:bg-muted/70 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}>
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <FileCode className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <span className="text-sm font-mono font-medium text-foreground truncate">{diff.file}</span>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {stats.removed > 0 && <span className="inline-flex items-center gap-0.5 text-xs font-mono text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 px-1.5 py-0.5 rounded"><Minus className="w-3 h-3" />{stats.removed}</span>}
            {stats.added > 0 && <span className="inline-flex items-center gap-0.5 text-xs font-mono text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/30 px-1.5 py-0.5 rounded"><Plus className="w-3 h-3" />{stats.added}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" onClick={e => e.stopPropagation()}>
          {conversationId && (
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => setShowHistory(!showHistory)} title="版本历史">
              <History className="w-3.5 h-3.5" /><span className="ml-1 hidden md:inline">历史</span>
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={handleCopyNew}>
            {copiedNew ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="ml-1 hidden md:inline">复制新代码</span>
          </Button>
          <div onClick={() => setIsExpanded(!isExpanded)} className="cursor-pointer p-1">
            {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </div>
        </div>
      </div>

      {/* 修改原因 */}
      {diff.reason && isExpanded && (
        <div className="px-3 py-2 bg-blue-50/50 dark:bg-blue-950/20 border-b border-border">
          <div className="flex items-start gap-2">
            <GitBranch className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
            <span className="text-xs text-blue-700 dark:text-blue-300 leading-relaxed">{diff.reason}</span>
          </div>
        </div>
      )}

      {/* 版本历史面板 */}
      {showHistory && conversationId && (
        <div className="border-b border-border"><FileVersionPanel convId={conversationId} filePath={diff.file} onClose={() => setShowHistory(false)} /></div>
      )}

      {/* Diff 内容 */}
      {isExpanded && (
        <div className="overflow-x-auto" style={{ maxHeight: 500, overflowY: 'auto' }}>
          <table className="w-full border-collapse font-mono text-[13px] leading-[1.5]">
            <tbody>{diffLines.map((line, i) => <DiffLineRow key={i} line={line} />)}</tbody>
          </table>
        </div>
      )}

      {/* 底部 */}
      {isExpanded && (
        <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border-t border-border">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-mono">{fileExt}</span><span>•</span>
            <span>{diff.search.split('\n').length} 行 → {diff.replacement.split('\n').length} 行</span>
          </div>
          {canPreview && <CodeSandboxPreview code={diff.replacement} fileName={diff.file} language={fileExt} />}
        </div>
      )}
    </div>
  );
});

// ── DiffLineRow（带行内高亮）──

const DiffLineRow = memo(function DiffLineRow({ line }: { line: DiffLine }) {
  const bg: Record<string, string> = { removed: 'bg-red-50/80 dark:bg-red-950/30', added: 'bg-green-50/80 dark:bg-green-950/30', context: '', separator: 'bg-muted/50' };
  const tc: Record<string, string> = { removed: 'text-red-800 dark:text-red-300', added: 'text-green-800 dark:text-green-300', context: 'text-foreground/80', separator: 'text-muted-foreground italic' };
  const pc: Record<string, string> = { removed: 'text-red-500 dark:text-red-400', added: 'text-green-500 dark:text-green-400', context: 'text-transparent', separator: 'text-muted-foreground' };
  const pch: Record<string, string> = { removed: '-', added: '+', context: ' ', separator: '~' };

  return (
    <tr className={`${bg[line.type]} border-b border-border/30 hover:brightness-95 dark:hover:brightness-110 transition-all`}>
      <td className="px-2 py-0 text-right text-xs text-muted-foreground/60 select-none w-[40px] border-r border-border/20">{line.lineNumber || ''}</td>
      <td className={`px-1 py-0 text-center select-none w-[20px] font-bold ${pc[line.type]}`}>{pch[line.type]}</td>
      <td className={`px-2 py-0.5 whitespace-pre ${tc[line.type]}`}>
        {line.inlineSegments ? <InlineHL segs={line.inlineSegments} lt={line.type} /> : line.content}
      </td>
    </tr>
  );
});

// ── InlineHighlight (word-level) ──

const InlineHL = memo(function InlineHL({ segs, lt }: { segs: InlineSegment[]; lt: string }) {
  return <span>{segs.map((s, i) => s.type === 'equal'
    ? <span key={i}>{s.text}</span>
    : <span key={i} className={lt === 'removed' ? 'bg-red-200/80 dark:bg-red-800/50 rounded-sm px-[1px]' : 'bg-green-200/80 dark:bg-green-800/50 rounded-sm px-[1px]'}>{s.text}</span>
  )}</span>;
});

// ── CodeDiffGroup ──

interface CodeDiffGroupProps {
  diffs: CodeDiff[];
  conversationId?: string | number;
  messageIndex?: number;
}

export function CodeDiffGroup({ diffs, conversationId, messageIndex }: CodeDiffGroupProps) {
  if (!diffs.length) return null;
  const grouped = useMemo(() => {
    const m = new Map<string, CodeDiff[]>();
    for (const d of diffs) { if (!m.has(d.file)) m.set(d.file, []); m.get(d.file)!.push(d); }
    return m;
  }, [diffs]);

  return (
    <div className="space-y-2 my-4">
      <div className="flex items-center gap-2 px-1 mb-2">
        <div className="flex items-center gap-1.5 text-sm font-medium text-foreground"><GitBranch className="w-4 h-4" /><span>代码修改</span></div>
        <span className="text-xs text-muted-foreground">{diffs.length} 处修改 • {grouped.size} 个文件</span>
      </div>
      {diffs.map((d, i) => <CodeDiffBlock key={`${d.file}-${i}`} diff={d} defaultExpanded={diffs.length <= 3} conversationId={conversationId} messageIndex={messageIndex} />)}
    </div>
  );
}
