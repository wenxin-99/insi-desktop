/**
 * CanvasEditor — Canvas 可编辑代码区
 *
 * 替换 ArtifactCard 的只读 <pre>，支持：
 * - 行号显示
 * - 基础语法高亮（CSS token 着色）
 * - Tab 缩进
 * - 选中文本后弹出浮动操作菜单
 * - ★ 右侧可见滚动条
 * - ★ 行号 + 代码同步滚动
 */

import { useState, useRef, useEffect, useCallback, useMemo, memo } from 'react';
import { Wand2, MessageSquare, Bug, FileCode, Minimize2, Languages, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useShikiHighlight } from '@/components/HighlightedCode';

interface CanvasEditorProps {
  code: string;
  onChange: (code: string) => void;
  onSelectionAction?: (action: string, selectedText: string, selectionRange: { start: number; end: number }) => void;
  readOnly?: boolean;
  language?: string;
  className?: string;
  style?: React.CSSProperties;
}

const SELECTION_ACTIONS = [
  { id: 'explain', icon: MessageSquare, label: '解释这段代码' },
  { id: 'fix', icon: Bug, label: '修复问题' },
  { id: 'simplify', icon: Minimize2, label: '简化' },
  { id: 'rewrite', icon: Wand2, label: '重写优化' },
];

/* ── 轻量语法着色 ── */
const TOKEN_RULES: Array<{ re: RegExp; cls: string }> = [
  // 注释
  { re: /\/\/[^\n]*/g, cls: 'ce-cmt' },
  { re: /\/\*[\s\S]*?\*\//g, cls: 'ce-cmt' },
  { re: /<!--[\s\S]*?-->/g, cls: 'ce-cmt' },
  // 字符串
  { re: /"(?:[^"\\]|\\.)*"/g, cls: 'ce-str' },
  { re: /'(?:[^'\\]|\\.)*'/g, cls: 'ce-str' },
  { re: /`(?:[^`\\]|\\.)*`/g, cls: 'ce-str' },
  // HTML 标签名
  { re: /&lt;\/?([a-zA-Z][\w-]*)/g, cls: 'ce-tag' },
  // JS 关键字
  { re: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|this|async|await|try|catch|throw|typeof|true|false|null|undefined|void|switch|case|break|default|continue)\b/g, cls: 'ce-kw' },
  // CSS 属性
  { re: /\b(display|position|margin|padding|border|background|color|font|width|height|top|left|right|bottom|flex|grid|gap|overflow|transition|animation|transform|opacity|z-index|box-shadow|border-radius|cursor|text-align|align-items|justify-content|max-width|min-height|font-size|font-weight|line-height|text-decoration)(?=\s*:)/g, cls: 'ce-css' },
  // 数字 + 单位
  { re: /\b\d+\.?\d*(px|em|rem|%|vh|vw|s|ms|deg)?\b/g, cls: 'ce-num' },
  // hex 颜色
  { re: /#[0-9a-fA-F]{3,8}\b/g, cls: 'ce-num' },
];

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function tokenize(code: string): string {
  const esc = escapeHtml(code);
  // Mark tokens with placeholder, then replace
  type Span = { start: number; end: number; cls: string };
  const spans: Span[] = [];

  for (const rule of TOKEN_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(esc)) !== null) {
      // 检查是否与已有 span 重叠
      const s = m.index, e = m.index + m[0].length;
      const overlap = spans.some(sp => !(e <= sp.start || s >= sp.end));
      if (!overlap) spans.push({ start: s, end: e, cls: rule.cls });
    }
  }

  // 按位置排序
  spans.sort((a, b) => a.start - b.start);

  // 构建输出
  let result = '';
  let cursor = 0;
  for (const sp of spans) {
    if (sp.start > cursor) result += esc.slice(cursor, sp.start);
    result += `<span class="${sp.cls}">${esc.slice(sp.start, sp.end)}</span>`;
    cursor = sp.end;
  }
  if (cursor < esc.length) result += esc.slice(cursor);
  return result;
}

export function CanvasEditor({
  code,
  onChange,
  onSelectionAction,
  readOnly = false,
  language = '',
  className,
  style,
}: CanvasEditorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lineRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number; y: number; text: string; start: number; end: number;
  } | null>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lines = (code || '').split('\n');

  // 语法高亮：tokenize 作为 fallback，Shiki 异步升级
  const tokenizeFallback = useMemo(() => {
    if (lines.length > 8000) return escapeHtml(code || '');
    return tokenize(code || '');
  }, [code]);

  const highlighted = useShikiHighlight(code || '', language, tokenizeFallback);

  // 同步行号滚动
  const handleScroll = useCallback(() => {
    if (scrollRef.current && lineRef.current) {
      lineRef.current.scrollTop = scrollRef.current.scrollTop;
    }
  }, []);

  // 双击进入编辑模式
  const handleDoubleClick = useCallback(() => {
    if (readOnly) return;
    setIsEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [readOnly]);

  // Tab 缩进
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart, end = ta.selectionEnd;
      onChange(code.substring(0, start) + '  ' + code.substring(end));
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
    }
    if (e.key === 'Escape') setIsEditing(false);
  }, [code, onChange]);

  // 选中文本操作菜单
  const handleMouseUp = useCallback(() => {
    if (!onSelectionAction || readOnly) return;
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setSelectionPopup(null); return; }
      const text = sel.toString().trim();
      if (text.length < 4) { setSelectionPopup(null); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      setSelectionPopup({
        x: rect.left + rect.width / 2,
        y: Math.max(rect.top, 50),
        text,
        start: 0, end: 0,
      });
    }, 200);
  }, [onSelectionAction, readOnly]);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-canvas-popup]')) setSelectionPopup(null); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className={cn('relative flex h-full', className)} style={style}>
      {/* ★ 语法高亮 CSS（内联避免全局污染） */}
      <style dangerouslySetInnerHTML={{ __html: `
        .ce-cmt{color:#6c7086;font-style:italic}
        .ce-str{color:#a6e3a1}
        .ce-tag{color:#89b4fa}
        .ce-kw{color:#cba6f7}
        .ce-css{color:#89dceb}
        .ce-num{color:#fab387}
        .ce-wrap{counter-reset:ln}
        .ce-scroll::-webkit-scrollbar{width:8px;height:8px}
        .ce-scroll::-webkit-scrollbar-track{background:transparent}
        .ce-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px}
        .ce-scroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.25)}
        .ce-scroll::-webkit-scrollbar-corner{background:transparent}
      `}} />

      {/* 行号 */}
      <div
        ref={lineRef}
        className="flex-shrink-0 overflow-hidden select-none bg-[#1e1e2e] dark:bg-[#0d1117] border-r border-white/5"
        style={{ width: lines.length > 999 ? 56 : 44 }}
      >
        <div className="py-3 px-1">
          {lines.map((_, i) => (
            <div key={i} className="text-right pr-2 text-[11px] leading-[20px] text-[#6c7086] font-mono">
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* 代码区 */}
      <div className="flex-1 min-w-0 relative">
        {isEditing && !readOnly ? (
          /* 编辑模式：textarea */
          <textarea
            ref={textareaRef}
            value={code || ''}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={() => setIsEditing(false)}
            spellCheck={false}
            className="w-full h-full resize-none border-0 outline-none p-3 font-mono text-xs leading-[20px] bg-[#1e1e2e] dark:bg-[#0d1117] text-[#cdd6f4] dark:text-[#c9d1d9] caret-blue-400"
            style={{ tabSize: 2 }}
          />
        ) : (
          /* 查看模式：语法高亮 + 可见滚动条 */
          <div
            ref={scrollRef}
            className="ce-scroll h-full overflow-auto"
            onScroll={handleScroll}
            onDoubleClick={handleDoubleClick}
            onMouseUp={handleMouseUp}
          >
            <pre className="p-3 m-0 font-mono text-xs leading-[20px] text-[#cdd6f4] dark:text-[#c9d1d9] bg-[#1e1e2e] dark:bg-[#0d1117] whitespace-pre-wrap break-words min-h-full"
              dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
            />
          </div>
        )}
      </div>

      {/* 选中文本浮动操作菜单 */}
      {selectionPopup && onSelectionAction && (
        <div
          data-canvas-popup
          className="fixed z-[100] flex items-center gap-0.5 px-1 py-0.5 rounded-lg border border-border bg-popover shadow-xl animate-in fade-in-0 zoom-in-95 duration-150"
          style={{ left: selectionPopup.x, top: selectionPopup.y, transform: 'translate(-50%, -100%)' }}
        >
          {SELECTION_ACTIONS.map((action) => (
            <button
              key={action.id}
              onClick={() => {
                onSelectionAction(action.id, selectionPopup.text, { start: selectionPopup.start, end: selectionPopup.end });
                setSelectionPopup(null);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-foreground/80 hover:text-foreground hover:bg-accent rounded-md transition-colors whitespace-nowrap"
              title={action.label}
            >
              <action.icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{action.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

