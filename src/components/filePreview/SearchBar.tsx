/**
 * 文件预览 — 内置搜索栏
 * Ctrl+F 触发，支持高亮匹配 + 上下跳转
 */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import { X, ChevronUp, ChevronDown, Search as SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SearchBarProps {
  lines: string[];
  visible: boolean;
  onClose: () => void;
  /** 当前高亮的匹配行号集合 */
  onMatchesChange: (matches: Set<number>, activeIndex: number, activeLineNum: number) => void;
  /** 滚动到指定行 */
  onScrollToLine: (lineNum: number) => void;
}

export function SearchBar({ lines, visible, onClose, onMatchesChange, onScrollToLine }: SearchBarProps) {
  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<number[]>([]);
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // 搜索
  useEffect(() => {
    if (!query.trim()) {
      setMatches([]);
      onMatchesChange(new Set(), -1, -1);
      return;
    }
    const q = query.toLowerCase();
    const found: number[] = [];
    lines.forEach((line, i) => {
      if (line.toLowerCase().includes(q)) {
        found.push(i + 1); // 1-indexed line number
      }
    });
    setMatches(found);
    setActiveIdx(0);
    onMatchesChange(new Set(found), 0, found[0] ?? -1);
    if (found.length > 0) onScrollToLine(found[0]);
  }, [query, lines]);

  // Focus input when visible
  useEffect(() => {
    if (visible) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery('');
      setMatches([]);
      onMatchesChange(new Set(), -1, -1);
    }
  }, [visible]);

  const goTo = useCallback((dir: 'next' | 'prev') => {
    if (matches.length === 0) return;
    let newIdx: number;
    if (dir === 'next') {
      newIdx = (activeIdx + 1) % matches.length;
    } else {
      newIdx = (activeIdx - 1 + matches.length) % matches.length;
    }
    setActiveIdx(newIdx);
    onMatchesChange(new Set(matches), newIdx, matches[newIdx]);
    onScrollToLine(matches[newIdx]);
  }, [matches, activeIdx, onMatchesChange, onScrollToLine]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goTo(e.shiftKey ? 'prev' : 'next');
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [goTo, onClose]);

  if (!visible) return null;

  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-[#1e1e2e] flex-shrink-0">
      <SearchIcon className="h-3.5 w-3.5 text-muted-foreground/60 flex-shrink-0" />
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="搜索..."
        className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/40 min-w-0"
      />
      {query && (
        <span className="text-[10px] text-muted-foreground/60 flex-shrink-0 tabular-nums">
          {matches.length > 0
            ? `${activeIdx + 1}/${matches.length}`
            : '无匹配'}
        </span>
      )}
      <button
        onClick={() => goTo('prev')}
        disabled={matches.length === 0}
        className="p-0.5 rounded hover:bg-muted/50 disabled:opacity-30 transition-colors"
      >
        <ChevronUp className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => goTo('next')}
        disabled={matches.length === 0}
        className="p-0.5 rounded hover:bg-muted/50 disabled:opacity-30 transition-colors"
      >
        <ChevronDown className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={onClose}
        className="p-0.5 rounded hover:bg-muted/50 transition-colors"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
