/**
 * 文件预览 — 行渲染组件（重写版）
 * 
 * 改进：
 * - 语法高亮（token 级别着色）
 * - Word-level diff 高亮
 * - 改善行号可读性
 * - 更好的视觉层次
 */
import React, { useMemo } from 'react';
import { cn } from '@/lib/utils';
import type { DiffLine, ViewMode } from './diffUtils';
import { highlightLine, tokenColors, type HighlightToken } from './syntaxHighlight';
import { computeWordDiff, mergeSpans, type WordSpan } from './wordDiff';

// ─── 渲染高亮 tokens ───

function renderTokens(tokens: HighlightToken[]) {
  return tokens.map((token, i) => (
    <span key={i} style={{ color: tokenColors[token.type] }}>
      {token.text}
    </span>
  ));
}

// ─── 渲染 word-level diff spans ───

function renderWordSpans(spans: WordSpan[], type: 'added' | 'removed') {
  const merged = mergeSpans(spans);
  return merged.map((span, i) => (
    <span
      key={i}
      className={cn(
        span.changed && type === 'added' && 'bg-[#2ea04366] rounded-sm',
        span.changed && type === 'removed' && 'bg-[#f4706766] rounded-sm',
      )}
    >
      {span.text}
    </span>
  ));
}

// ─── 行号组件 ───

function LineNum({ num, width = 'w-10' }: { num?: number; width?: string }) {
  return (
    <span
      className={cn(
        width,
        'text-right pr-3 text-muted-foreground/50 select-none flex-shrink-0',
        'text-[11px] leading-5 font-mono',
        'border-r border-[#ffffff08]',
      )}
    >
      {num ?? ''}
    </span>
  );
}

// ─── Diff 视图行 ───

export function DiffViewLine({
  line,
  language,
}: {
  line: DiffLine;
  language: string;
}) {
  const bgClass = line.type === 'added'
    ? 'bg-[#1a3a2a]'
    : line.type === 'removed'
    ? 'bg-[#3a1a1a]'
    : '';

  const textClass = line.type === 'added'
    ? 'text-[#7ee787]'
    : line.type === 'removed'
    ? 'text-[#f47067]'
    : '';

  const prefix = line.type === 'added' ? '+' : line.type === 'removed' ? '-' : ' ';
  const prefixColor = line.type === 'added'
    ? 'text-[#7ee787]'
    : line.type === 'removed'
    ? 'text-[#f47067]'
    : 'text-muted-foreground/20';

  // Word-level diff
  const wordDiff = useMemo(() => {
    if (!line.pairedContent || line.type === 'unchanged') return null;
    if (line.type === 'removed') {
      return computeWordDiff(line.content, line.pairedContent);
    } else {
      return computeWordDiff(line.pairedContent, line.content);
    }
  }, [line.content, line.pairedContent, line.type]);

  // 语法高亮（仅对 unchanged 行，diff 行使用特殊着色）
  const tokens = useMemo(() => {
    if (line.type === 'unchanged') {
      return highlightLine(line.content, language);
    }
    return null;
  }, [line.content, line.type, language]);

  const renderContent = () => {
    if (line.type === 'unchanged' && tokens) {
      return renderTokens(tokens);
    }
    if (wordDiff) {
      if (line.type === 'removed') {
        return renderWordSpans(wordDiff.oldSpans, 'removed');
      } else {
        return renderWordSpans(wordDiff.newSpans, 'added');
      }
    }
    return <span className={textClass}>{line.content}</span>;
  };

  return (
    <div className={cn('flex min-h-[20px] hover:brightness-110 transition-[filter] duration-75', bgClass)}>
      <LineNum num={line.oldLineNum} width="w-9" />
      <LineNum num={line.newLineNum} width="w-9" />
      <span className={cn('w-5 text-center select-none flex-shrink-0 text-[12px] leading-5', prefixColor)}>
        {prefix}
      </span>
      <span className={cn('flex-1 min-w-0 px-2 whitespace-pre-wrap leading-5', !wordDiff && textClass)} style={{ overflowWrap: 'anywhere' }}>
        {renderContent()}
      </span>
    </div>
  );
}

// ─── 原始文件视图行 ───

export function OriginalViewLine({
  line,
  lineNum,
  isRemoved,
  language,
}: {
  line: string;
  lineNum: number;
  isRemoved: boolean;
  language: string;
}) {
  const tokens = useMemo(() => {
    if (!isRemoved) return highlightLine(line, language);
    return null;
  }, [line, isRemoved, language]);

  return (
    <div className={cn(
      'flex min-h-[20px] hover:brightness-110 transition-[filter] duration-75',
      isRemoved ? 'bg-[#3a1a1a]' : '',
    )}>
      <LineNum num={lineNum} />
      <span className={cn(
        'flex-1 min-w-0 px-2 whitespace-pre-wrap leading-5',
        isRemoved ? 'text-[#f47067]' : '',
      )} style={{ overflowWrap: 'anywhere' }}>
        {isRemoved ? line : (tokens ? renderTokens(tokens) : line)}
      </span>
    </div>
  );
}

// ─── 已修改文件视图行 ───

export function ModifiedViewLine({
  line,
  lineNum,
  isAdded,
  language,
}: {
  line: string;
  lineNum: number;
  isAdded: boolean;
  language: string;
}) {
  const tokens = useMemo(() => {
    if (!isAdded) return highlightLine(line, language);
    return null;
  }, [line, isAdded, language]);

  return (
    <div className={cn(
      'flex min-h-[20px] hover:brightness-110 transition-[filter] duration-75',
      isAdded ? 'bg-[#1a3a2a]' : '',
    )}>
      <LineNum num={lineNum} />
      <span className={cn(
        'flex-1 min-w-0 px-2 whitespace-pre-wrap leading-5',
        isAdded ? 'text-[#7ee787]' : '',
      )} style={{ overflowWrap: 'anywhere' }}>
        {isAdded ? line : (tokens ? renderTokens(tokens) : line)}
      </span>
    </div>
  );
}

// ─── 普通语法高亮行（非 diff） ───

export function SyntaxLine({
  line,
  lineNum,
  language,
  isSearchMatch,
  isActiveMatch,
}: {
  line: string;
  lineNum: number;
  language: string;
  isSearchMatch?: boolean;
  isActiveMatch?: boolean;
}) {
  const tokens = useMemo(() => highlightLine(line, language), [line, language]);

  // Diff 语言特殊处理（保留原有逻辑）
  if (language === 'diff') {
    if (line.startsWith('+') || /[─—]{2,}.*(替换为|新代码)/.test(line)) {
      return (
        <div className="flex">
          <LineNum num={lineNum} />
          <span className="flex-1 min-w-0 bg-[#1a3a2a] text-[#7ee787] px-2 whitespace-pre-wrap leading-5" style={{ overflowWrap: 'anywhere' }}>{line}</span>
        </div>
      );
    }
    if (line.startsWith('-') || /[─—]{2,}.*(旧代码|原代码)/.test(line)) {
      return (
        <div className="flex">
          <LineNum num={lineNum} />
          <span className="flex-1 min-w-0 bg-[#3a1a1a] text-[#f47067] px-2 whitespace-pre-wrap leading-5" style={{ overflowWrap: 'anywhere' }}>{line}</span>
        </div>
      );
    }
  }

  return (
    <div className={cn(
      'flex hover:bg-[#ffffff04] transition-colors duration-75',
      isActiveMatch && 'bg-yellow-500/20 ring-1 ring-inset ring-yellow-500/40',
      isSearchMatch && !isActiveMatch && 'bg-yellow-500/8',
    )}>
      <LineNum num={lineNum} />
      <span className="flex-1 min-w-0 px-2 whitespace-pre-wrap leading-5" style={{ overflowWrap: 'anywhere' }}>
        {renderTokens(tokens)}
      </span>
    </div>
  );
}

// ─── Tab 切换按钮 ───

export function TabButton({
  active, label, count, onClick, color,
}: {
  active: boolean;
  label: string;
  count?: number;
  onClick: () => void;
  color: 'blue' | 'red' | 'green';
}) {
  const colorMap = {
    blue: {
      active: 'bg-blue-500/20 text-blue-300 border-blue-400/60',
      inactive: 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 border-transparent',
    },
    red: {
      active: 'bg-red-500/15 text-red-300 border-red-400/60',
      inactive: 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 border-transparent',
    },
    green: {
      active: 'bg-green-500/15 text-green-300 border-green-400/60',
      inactive: 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 border-transparent',
    },
  };

  const cls = active ? colorMap[color].active : colorMap[color].inactive;

  return (
    <button
      onClick={onClick}
      className={cn(
        'px-2.5 py-1 text-[11px] font-medium rounded border transition-all duration-150',
        cls,
      )}
    >
      {label}
      {count !== undefined && count > 0 && (
        <span className="ml-1 opacity-70">({count})</span>
      )}
    </button>
  );
}
