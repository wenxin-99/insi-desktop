/**
 * DiffBlock — ```diff 代码块渲染组件
 *
 * AI 输出 unified diff 格式，前端渲染为带颜色的增删对比视图。
 * 支持标准 unified diff 语法：以 +/- 开头的行。
 *
 * 输入格式：
 * ```diff
 * - const old = fetchData();
 * + const data = await fetchData();
 * - console.log(old);
 * + console.log(data);
 *   // unchanged line
 * ```
 */

import { memo, useState } from 'react';
import { FileDiff, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DiffBlockProps {
  content: string;
  streaming?: boolean;
}

interface DiffLine {
  type: 'add' | 'remove' | 'context' | 'header';
  content: string;
  lineNum?: { old?: number; new?: number };
}

function parseDiff(raw: string): { lines: DiffLine[]; stats: { added: number; removed: number } } {
  const lines: DiffLine[] = [];
  let oldLine = 1;
  let newLine = 1;
  let added = 0;
  let removed = 0;

  // ★ 去除尾部空行（避免产生多余 context 行）
  const trimmed = raw.replace(/\n+$/, '');

  for (const line of trimmed.split('\n')) {
    // diff header lines (--- / +++ / @@ / diff --git)
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ') || line.startsWith('index ')) {
      lines.push({ type: 'header', content: line });
      continue;
    }

    // Hunk header: @@ -1,5 +1,7 @@
    if (line.startsWith('@@')) {
      const match = line.match(/@@ -(\d+)/);
      if (match) {
        oldLine = parseInt(match[1]);
        const matchNew = line.match(/\+(\d+)/);
        if (matchNew) newLine = parseInt(matchNew[1]);
      }
      lines.push({ type: 'header', content: line });
      continue;
    }

    if (line.startsWith('+')) {
      lines.push({ type: 'add', content: line.slice(1), lineNum: { new: newLine } });
      newLine++;
      added++;
    } else if (line.startsWith('-')) {
      lines.push({ type: 'remove', content: line.slice(1), lineNum: { old: oldLine } });
      oldLine++;
      removed++;
    } else {
      // Context line (may start with ' ' or just be plain)
      const text = line.startsWith(' ') ? line.slice(1) : line;
      lines.push({ type: 'context', content: text, lineNum: { old: oldLine, new: newLine } });
      oldLine++;
      newLine++;
    }
  }

  return { lines, stats: { added, removed } };
}

function DiffBlockInner({ content, streaming }: DiffBlockProps) {
  const [copied, setCopied] = useState(false);

  if (!content.trim()) {
    if (streaming) {
      return (
        <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
          <div className="px-4 pt-4 pb-3">
            <div className="flex items-center gap-2 mb-3">
              <FileDiff className="w-4 h-4 text-orange-500 animate-pulse" />
              <span className="text-sm font-medium">对比生成中...</span>
            </div>
            <div className="space-y-1.5">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="h-5 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 80}ms` }} />
              ))}
            </div>
          </div>
        </div>
      );
    }
    return null;
  }

  const { lines, stats } = parseDiff(content);

  const handleCopy = async () => {
    try {
      // 复制改动后的代码（仅 + 行和 context 行）
      const newCode = lines
        .filter(l => l.type === 'add' || l.type === 'context')
        .map(l => l.content)
        .join('\n');
      await navigator.clipboard.writeText(newCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <FileDiff className="w-4 h-4 text-orange-500" />
          <span className="text-xs font-medium text-foreground">代码对比</span>
          <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">+{stats.added}</span>
          <span className="text-[10px] text-red-600 dark:text-red-400 font-medium">-{stats.removed}</span>
        </div>
        <button
          onClick={handleCopy}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
          title="复制修改后代码"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Diff 内容 */}
      <div className="overflow-x-auto text-xs font-mono">
        {lines.map((line, i) => {
          if (line.type === 'header') {
            return (
              <div key={i} className="px-3 py-1 bg-blue-50/50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400 border-b border-border/30 select-none">
                {line.content}
              </div>
            );
          }

          const bgClass = line.type === 'add'
            ? 'bg-emerald-50/70 dark:bg-emerald-950/20'
            : line.type === 'remove'
            ? 'bg-red-50/70 dark:bg-red-950/20'
            : '';

          const textClass = line.type === 'add'
            ? 'text-emerald-800 dark:text-emerald-300'
            : line.type === 'remove'
            ? 'text-red-800 dark:text-red-300'
            : 'text-foreground/70';

          const prefix = line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' ';

          const prefixClass = line.type === 'add'
            ? 'text-emerald-500'
            : line.type === 'remove'
            ? 'text-red-500'
            : 'text-transparent';

          return (
            <div key={i} className={cn('flex border-b border-border/20 hover:brightness-95 dark:hover:brightness-110 transition-all', bgClass)}>
              {/* 行号 */}
              <div className="flex-shrink-0 w-[70px] flex text-muted-foreground/50 select-none border-r border-border/20">
                <span className="w-[35px] text-right pr-1.5 py-0.5">
                  {line.lineNum?.old || ''}
                </span>
                <span className="w-[35px] text-right pr-1.5 py-0.5">
                  {line.lineNum?.new || ''}
                </span>
              </div>
              {/* +/- 前缀 */}
              <span className={cn('flex-shrink-0 w-4 text-center py-0.5 select-none font-bold', prefixClass)}>
                {prefix}
              </span>
              {/* 代码内容 */}
              <span className={cn('flex-1 py-0.5 pr-3 whitespace-pre', textClass)}>
                {line.content}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const DiffBlock = memo(DiffBlockInner);
