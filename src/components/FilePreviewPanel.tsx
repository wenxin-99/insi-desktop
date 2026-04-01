/**
 * FilePreviewPanel — 文件预览面板（完全重写）
 *
 * P0: 去重、修复命名、改善行号/padding
 * P1: 语法高亮、文件类型图标、复制按钮
 * P2: 多文件 Tab、Word-level diff、最近文件历史
 * P3: Minimap、内置搜索、虚拟滚动、JSON/Markdown 智能渲染
 */
import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import {
  FileText, FilePlus, X, Code, Copy, Check,
  ChevronDown, Search,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import { detectLanguage, computeDiff, parseContent, getFileExtension, getFileIconColor } from './filePreview/diffUtils';
import type { DiffLine, ViewMode } from './filePreview/diffUtils';
import {
  DiffViewLine, OriginalViewLine, ModifiedViewLine,
  SyntaxLine, TabButton,
} from './filePreview/LineRenderers';
import { SearchBar } from './filePreview/SearchBar';
import { Minimap } from './filePreview/Minimap';
import { FileTabBar, type FileTab } from './filePreview/FileTabBar';

// ─── Types ───

export interface PreviewFile {
  name: string;
  content: string;
  isLive: boolean;
}

interface FilePreviewPanelProps {
  /** 当前活跃文件 */
  fileName?: string;
  content?: string;
  isLive?: boolean;
  onClose?: () => void;
  /** 多文件 Tab 支持 */
  files?: PreviewFile[];
  activeFileIndex?: number;
  onFileSelect?: (index: number) => void;
  onFileClose?: (index: number) => void;
  /** 最近预览的文件（关闭后可恢复） */
  recentFiles?: PreviewFile[];
  onRestoreFile?: (file: PreviewFile) => void;
  /** 是否嵌入 RightSidePanel（控制 padding） */
  embedded?: boolean;
}

// ─── 文件图标 ───

function FileIcon({ fileName, isLive }: { fileName?: string; isLive?: boolean }) {
  const ext = getFileExtension(fileName);
  const color = getFileIconColor(ext);

  if (isLive) {
    return (
      <div className="relative flex-shrink-0">
        <FilePlus className={cn('h-4 w-4', color)} />
        <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
      </div>
    );
  }

  return <FileText className={cn('h-4 w-4 flex-shrink-0', color)} />;
}

// ─── 虚拟滚动 Hook ───

function useVirtualScroll(
  totalCount: number,
  containerRef: React.RefObject<HTMLDivElement | null>,
  itemHeight: number = 20,
  overscan: number = 20,
) {
  const [range, setRange] = useState({ start: 0, end: 100 });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      const scrollTop = el.scrollTop;
      const viewHeight = el.clientHeight;
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
      const end = Math.min(totalCount, Math.ceil((scrollTop + viewHeight) / itemHeight) + overscan);
      setRange({ start, end });
    };

    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);

    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [totalCount, containerRef, itemHeight, overscan]);

  const totalHeight = totalCount * itemHeight;
  const offsetY = range.start * itemHeight;

  return { range, totalHeight, offsetY };
}

// ─── JSON 树形展示 ───

function JsonTreeView({ content }: { content: string }) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const parsed = useMemo(() => {
    try {
      return JSON.parse(content);
    } catch {
      return null;
    }
  }, [content]);

  if (!parsed) {
    return <pre className="p-3 text-sm text-red-400">JSON 解析失败</pre>;
  }

  const toggle = (path: string) => {
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  const renderValue = (val: any, path: string, depth: number): React.ReactNode => {
    const indent = depth * 16;

    if (val === null) return <span style={{ color: '#569cd6' }}>null</span>;
    if (typeof val === 'boolean') return <span style={{ color: '#569cd6' }}>{String(val)}</span>;
    if (typeof val === 'number') return <span style={{ color: '#b5cea8' }}>{val}</span>;
    if (typeof val === 'string') return <span style={{ color: '#ce9178' }}>"{val.length > 100 ? val.slice(0, 100) + '...' : val}"</span>;

    if (Array.isArray(val)) {
      const isCollapsed = collapsed.has(path);
      if (val.length === 0) return <span style={{ color: '#808080' }}>[]</span>;
      return (
        <span>
          <span
            onClick={() => toggle(path)}
            className="cursor-pointer hover:bg-white/5 rounded px-0.5"
            style={{ color: '#808080' }}
          >
            {isCollapsed ? '▶' : '▼'} [{isCollapsed ? `${val.length} items` : ''}
          </span>
          {!isCollapsed && (
            <div style={{ paddingLeft: indent + 16 }}>
              {val.map((item, i) => (
                <div key={i}>
                  <span style={{ color: '#808080' }}>{i}: </span>
                  {renderValue(item, `${path}[${i}]`, depth + 1)}
                  {i < val.length - 1 && <span style={{ color: '#808080' }}>,</span>}
                </div>
              ))}
            </div>
          )}
          {!isCollapsed && <span style={{ color: '#808080' }}>]</span>}
        </span>
      );
    }

    if (typeof val === 'object') {
      const keys = Object.keys(val);
      const isCollapsed = collapsed.has(path);
      if (keys.length === 0) return <span style={{ color: '#808080' }}>{'{}'}</span>;
      return (
        <span>
          <span
            onClick={() => toggle(path)}
            className="cursor-pointer hover:bg-white/5 rounded px-0.5"
            style={{ color: '#808080' }}
          >
            {isCollapsed ? '▶' : '▼'} {'{'}{isCollapsed ? `${keys.length} keys` : ''}
          </span>
          {!isCollapsed && (
            <div style={{ paddingLeft: indent + 16 }}>
              {keys.map((key, i) => (
                <div key={key}>
                  <span style={{ color: '#9cdcfe' }}>"{key}"</span>
                  <span style={{ color: '#808080' }}>: </span>
                  {renderValue(val[key], `${path}.${key}`, depth + 1)}
                  {i < keys.length - 1 && <span style={{ color: '#808080' }}>,</span>}
                </div>
              ))}
            </div>
          )}
          {!isCollapsed && <span style={{ color: '#808080' }}>{'}'}</span>}
        </span>
      );
    }

    return <span>{String(val)}</span>;
  };

  return (
    <div className="p-3 text-[12px] font-mono leading-5 overflow-auto">
      {renderValue(parsed, 'root', 0)}
    </div>
  );
}

// ─── Markdown 预览 ───

function MarkdownPreview({ content }: { content: string }) {
  return (
    <div className="p-4 text-sm leading-relaxed text-muted-foreground max-w-none">
      <SafeMarkdown>{content}</SafeMarkdown>
    </div>
  );
}

// ═══════════ 主组件 ═══════════

export function FilePreviewPanel({
  fileName,
  content,
  isLive,
  onClose,
  files,
  activeFileIndex = 0,
  onFileSelect,
  onFileClose,
  recentFiles,
  onRestoreFile,
  embedded = false,
}: FilePreviewPanelProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('diff');
  const [copied, setCopied] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchMatches, setSearchMatches] = useState<Set<number>>(new Set());
  const [activeMatchIdx, setActiveMatchIdx] = useState(-1);
  const [activeMatchLine, setActiveMatchLine] = useState(-1);
  const [renderMode, setRenderMode] = useState<'code' | 'json' | 'markdown'>('code');

  // 防御性：确保 content 始终为字符串
  const safeContent = typeof content === 'string' ? content : String(content ?? '');
  const language = detectLanguage(fileName, safeContent);
  const ext = getFileExtension(fileName);

  // 自动选择渲染模式
  useEffect(() => {
    if (ext === 'json') setRenderMode('code'); // 默认代码视图，可切换
    else if (ext === 'md' || ext === 'markdown') setRenderMode('code');
    else setRenderMode('code');
  }, [ext]);

  // Parse diff
  const parsed = useMemo(() => parseContent(safeContent), [safeContent]);
  const diffResult = useMemo(() => {
    if (!parsed.hasDiff) return null;
    return computeDiff(parsed.oldCode.split('\n'), parsed.newCode.split('\n'));
  }, [parsed]);

  // Stats
  const stats = useMemo(() => {
    if (!diffResult) return { added: 0, removed: 0 };
    return {
      added: diffResult.filter(l => l.type === 'added').length,
      removed: diffResult.filter(l => l.type === 'removed').length,
    };
  }, [diffResult]);

  // Original lines
  const originalLines = useMemo(() => {
    if (!diffResult) return [];
    const oldLines = parsed.oldCode.split('\n');
    const removedSet = new Set<number>();
    diffResult.forEach(d => {
      if (d.type === 'removed' && d.oldLineNum) removedSet.add(d.oldLineNum);
    });
    return oldLines.map((line, i) => ({
      content: line, lineNum: i + 1, isRemoved: removedSet.has(i + 1),
    }));
  }, [diffResult, parsed]);

  // Modified lines
  const modifiedLines = useMemo(() => {
    if (!diffResult) return [];
    const newLines = parsed.newCode.split('\n');
    const addedSet = new Set<number>();
    diffResult.forEach(d => {
      if (d.type === 'added' && d.newLineNum) addedSet.add(d.newLineNum);
    });
    return newLines.map((line, i) => ({
      content: line, lineNum: i + 1, isAdded: addedSet.has(i + 1),
    }));
  }, [diffResult, parsed]);

  // All lines for plain view
  const lines = useMemo(() => safeContent.split('\n'), [safeContent]);

  // Virtual scroll (plain mode, >500 lines)
  const useVirtual = !parsed.hasDiff && lines.length > 500;
  const { range, totalHeight, offsetY } = useVirtualScroll(
    useVirtual ? lines.length : 0,
    scrollRef,
    20,
    30,
  );

  // Auto-scroll when live
  useEffect(() => {
    if (isLive && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [safeContent, isLive]);

  // Ctrl+F handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setShowSearch(true);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Copy handler
  const handleCopy = useCallback(async (text?: string) => {
    const textToCopy = text || safeContent;
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard fail silently */ }
  }, [safeContent]);

  // Copy new code (diff mode)
  const handleCopyNewCode = useCallback(() => {
    if (parsed.hasDiff) handleCopy(parsed.newCode);
    else handleCopy();
  }, [parsed, handleCopy]);

  // Scroll to line
  const scrollToLine = useCallback((lineNum: number) => {
    if (scrollRef.current) {
      const targetY = (lineNum - 1) * 20;
      scrollRef.current.scrollTo({ top: targetY - 100, behavior: 'smooth' });
    }
  }, []);

  // Search matches handler
  const handleMatchesChange = useCallback((matches: Set<number>, activeIdx: number, activeLine: number) => {
    setSearchMatches(matches);
    setActiveMatchIdx(activeIdx);
    setActiveMatchLine(activeLine);
  }, []);

  const hasDiffView = parsed.hasDiff && diffResult && !isLive;

  // ─── 空状态 ───
  if (!fileName && !safeContent) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex flex-col items-center justify-center flex-1 text-muted-foreground py-16">
          <Code className="h-10 w-10 mb-3 opacity-20" />
          <p className="text-sm">等待文件内容...</p>
          <p className="text-xs mt-1 opacity-50">AI 生成文件时将自动显示在此处</p>
        </div>
        {/* 最近文件历史 */}
        {recentFiles && recentFiles.length > 0 && (
          <div className="border-t border-border p-3">
            <p className="text-[11px] text-muted-foreground/60 mb-2">最近预览</p>
            {recentFiles.slice(0, 5).map((f, i) => (
              <button
                key={`${f.name}-${i}`}
                onClick={() => onRestoreFile?.(f)}
                className="flex items-center gap-2 w-full px-2 py-1.5 rounded text-left hover:bg-muted/50 transition-colors"
              >
                <FileIcon fileName={f.name} />
                <span className="text-xs font-mono truncate">{f.name}</span>
                <span className="text-[10px] text-muted-foreground/40 ml-auto">
                  {f.content.split('\n').length}行
                </span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── 当前显示行数 ───
  const displayLineCount = hasDiffView
    ? viewMode === 'original'
      ? originalLines.length
      : viewMode === 'modified'
      ? modifiedLines.length
      : diffResult!.length
    : lines.length;

  return (
    <div className="flex flex-col h-full">
      {/* ═══════ 多文件 Tab 栏 ═══════ */}
      {files && files.length > 1 && (
        <FileTabBar
          files={files}
          activeIndex={activeFileIndex}
          onSelect={(i) => onFileSelect?.(i)}
          onClose={(i) => onFileClose?.(i)}
        />
      )}

      {/* ═══════ 文件头部 ═══════ */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-[#161b22] flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <FileIcon fileName={fileName} isLive={isLive} />
          <span className="text-sm font-mono font-medium truncate text-foreground">
            {fileName || '未知文件'}
          </span>
          {ext && (
            <span className={cn(
              'text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded',
              'bg-muted/50',
              getFileIconColor(ext),
            )}>
              {ext}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {isLive && (
            <span className="text-[10px] text-green-400 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              编写中
            </span>
          )}
          <span className="text-[10px] text-muted-foreground/40 tabular-nums">
            {displayLineCount} 行
          </span>
          {/* 渲染模式切换（JSON/Markdown） */}
          {(ext === 'json' || ext === 'md') && (
            <button
              onClick={() => setRenderMode(renderMode === 'code' ? (ext === 'json' ? 'json' : 'markdown') : 'code')}
              className="px-1.5 py-0.5 rounded text-[10px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
              title={renderMode === 'code' ? '切换到预览模式' : '切换到代码模式'}
            >
              {renderMode === 'code' ? '预览' : '代码'}
            </button>
          )}
          {/* 搜索按钮 */}
          <button
            onClick={() => setShowSearch(!showSearch)}
            className="p-1 rounded hover:bg-muted/50 transition-colors"
            title="搜索 (Ctrl+F)"
          >
            <Search className="h-3.5 w-3.5 text-muted-foreground/60" />
          </button>
          {/* 复制按钮 */}
          <button
            onClick={() => handleCopy()}
            className="p-1 rounded hover:bg-muted/50 transition-colors"
            title="复制全部"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-400" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground/60" />
            )}
          </button>
          {onClose && (
            <button onClick={onClose} className="p-1 rounded hover:bg-muted/50 transition-colors">
              <X className="h-3.5 w-3.5 text-muted-foreground/60" />
            </button>
          )}
        </div>
      </div>

      {/* ═══════ Diff 模式 Tab ═══════ */}
      {hasDiffView && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-[#161b22] flex-shrink-0">
          <TabButton
            active={viewMode === 'diff'} label="差异"
            count={stats.added + stats.removed}
            onClick={() => setViewMode('diff')} color="blue"
          />
          <TabButton
            active={viewMode === 'original'} label="原始"
            count={stats.removed}
            onClick={() => setViewMode('original')} color="red"
          />
          <TabButton
            active={viewMode === 'modified'} label="已修改"
            count={stats.added}
            onClick={() => setViewMode('modified')} color="green"
          />

          <div className="ml-auto flex items-center gap-2 text-[10px]">
            {stats.removed > 0 && (
              <span className="text-[#f47067] font-mono">-{stats.removed}</span>
            )}
            {stats.added > 0 && (
              <span className="text-[#7ee787] font-mono">+{stats.added}</span>
            )}
            {/* 复制新代码快捷按钮 */}
            <button
              onClick={handleCopyNewCode}
              className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50 transition-colors"
              title="复制新代码"
            >
              <Copy className="h-3 w-3" /> 复制新代码
            </button>
          </div>
        </div>
      )}

      {/* ═══════ 搜索栏 ═══════ */}
      <SearchBar
        lines={lines}
        visible={showSearch}
        onClose={() => setShowSearch(false)}
        onMatchesChange={handleMatchesChange}
        onScrollToLine={scrollToLine}
      />

      {/* ═══════ 文件内容 ═══════ */}
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={scrollRef}
          className="h-full overflow-auto font-mono text-[12px] leading-5 py-1 bg-[#1e1e1e] dark:bg-[#0d1117] text-[#d4d4d4]"
        >
          {/* JSON 树形视图 */}
          {renderMode === 'json' && <JsonTreeView content={safeContent} />}

          {/* Markdown 预览 */}
          {renderMode === 'markdown' && <MarkdownPreview content={safeContent} />}

          {/* 代码视图 */}
          {renderMode === 'code' && (
            <>
              {hasDiffView ? (
                <>
                  {viewMode === 'diff' && diffResult!.map((line, i) => (
                    <DiffViewLine key={i} line={line} language={language} />
                  ))}

                  {viewMode === 'original' && originalLines.map((line, i) => (
                    <OriginalViewLine
                      key={i}
                      line={line.content}
                      lineNum={line.lineNum}
                      isRemoved={line.isRemoved}
                      language={language}
                    />
                  ))}

                  {viewMode === 'modified' && modifiedLines.map((line, i) => (
                    <ModifiedViewLine
                      key={i}
                      line={line.content}
                      lineNum={line.lineNum}
                      isAdded={line.isAdded}
                      language={language}
                    />
                  ))}
                </>
              ) : useVirtual ? (
                /* 虚拟滚动（>500行） */
                <div style={{ height: totalHeight, position: 'relative' }}>
                  <div style={{ transform: `translateY(${offsetY}px)` }}>
                    {lines.slice(range.start, range.end).map((line, i) => {
                      const lineNum = range.start + i + 1;
                      return (
                        <SyntaxLine
                          key={lineNum}
                          line={line}
                          lineNum={lineNum}
                          language={language}
                          isSearchMatch={searchMatches.has(lineNum)}
                          isActiveMatch={lineNum === activeMatchLine}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : (
                /* 普通渲染 */
                lines.map((line, i) => (
                  <SyntaxLine
                    key={i}
                    line={line}
                    lineNum={i + 1}
                    language={language}
                    isSearchMatch={searchMatches.has(i + 1)}
                    isActiveMatch={(i + 1) === activeMatchLine}
                  />
                ))
              )}

              {isLive && (
                <div className="flex items-center gap-1 pl-14 py-1 text-blue-400/60">
                  <span className="inline-block w-2 h-4 bg-blue-400/60 animate-pulse rounded-sm" />
                </div>
              )}
            </>
          )}
        </div>

        {/* Minimap */}
        <Minimap
          totalLines={displayLineCount}
          diffLines={hasDiffView && viewMode === 'diff' ? diffResult! : undefined}
          searchMatches={searchMatches.size > 0 ? searchMatches : undefined}
          scrollRef={scrollRef}
          visible={displayLineCount >= 100}
        />
      </div>
    </div>
  );
}
