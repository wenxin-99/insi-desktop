/**
 * ProseEditor — 文本 Canvas 编辑器
 *
 * 用于非代码类 Artifact（markdown/document/text/essay/report），
 * 支持查看模式（SafeMarkdown 渲染）和编辑模式（textarea 原始 Markdown）。
 *
 * 功能：
 * - 查看模式：SafeMarkdown 所见即所得渲染
 * - 编辑模式（双击/按钮切换）：textarea 原始 Markdown 编辑
 * - 选中文本浮动菜单：改写 / 精简 / 扩展 / 翻译 / 正式化 / 口语化
 */

import { useState, useRef, useCallback, useEffect, memo } from 'react';
import {
  Pencil, Eye, Wand2, Minimize2, Maximize2,
  Languages, GraduationCap, MessageCircle, Scissors,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { SafeMarkdown } from '@/components/SafeMarkdown';

interface ProseEditorProps {
  content: string;
  onChange: (content: string) => void;
  onSelectionAction?: (action: string, selectedText: string, range: { start: number; end: number }) => void;
  readOnly?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

const SELECTION_ACTIONS = [
  { id: 'rewrite', icon: Wand2, label: '改写' },
  { id: 'shorten', icon: Scissors, label: '精简' },
  { id: 'expand', icon: Maximize2, label: '扩展' },
  { id: 'translate', icon: Languages, label: '翻译' },
  { id: 'formal', icon: GraduationCap, label: '正式化' },
  { id: 'casual', icon: MessageCircle, label: '口语化' },
];

export const ProseEditor = memo(function ProseEditor({
  content,
  onChange,
  onSelectionAction,
  readOnly = false,
  className,
  style,
}: ProseEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [selectionPopup, setSelectionPopup] = useState<{
    x: number; y: number; text: string; start: number; end: number;
  } | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const popupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 双击进入编辑模式
  const handleDoubleClick = useCallback(() => {
    if (readOnly) return;
    setIsEditing(true);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }, [readOnly]);

  // 切换编辑/查看
  const toggleEdit = useCallback(() => {
    if (readOnly) return;
    setIsEditing(prev => {
      if (!prev) requestAnimationFrame(() => textareaRef.current?.focus());
      return !prev;
    });
  }, [readOnly]);

  // 自动调整 textarea 高度
  useEffect(() => {
    if (isEditing && textareaRef.current) {
      const ta = textareaRef.current;
      ta.style.height = 'auto';
      ta.style.height = ta.scrollHeight + 'px';
    }
  }, [isEditing, content]);

  // 选中文本浮动菜单（查看模式下）
  const handleMouseUp = useCallback(() => {
    if (!onSelectionAction) return;
    if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    popupTimeoutRef.current = setTimeout(() => {
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) { setSelectionPopup(null); return; }
      const text = sel.toString().trim();
      if (text.length < 4) { setSelectionPopup(null); return; }
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      // ★ 不用 indexOf 定位（同文本多次出现会找错位置），
      // 选中文本直接传给 AI 即可，不需要精确偏移量
      setSelectionPopup({
        x: rect.left + rect.width / 2,
        y: Math.max(rect.top, 50),
        text,
        start: 0,
        end: text.length,
      });
    }, 200);
  }, [onSelectionAction]);

  // 点击其他地方关闭弹窗 + 清理 timeout
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (selectionPopup) {
        const target = e.target as HTMLElement;
        if (!target.closest('.prose-selection-popup')) {
          setSelectionPopup(null);
        }
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      if (popupTimeoutRef.current) clearTimeout(popupTimeoutRef.current);
    };
  }, [selectionPopup]);

  // Esc 退出编辑
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
    // Tab 插入缩进
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newContent = content.substring(0, start) + '  ' + content.substring(end);
      onChange(newContent);
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
    }
  }, [content, onChange]);

  return (
    <div
      ref={containerRef}
      className={cn('relative flex flex-col h-full', className)}
      style={style}
    >
      {/* 模式切换条 */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border bg-muted/20 flex-shrink-0">
        <div className="flex bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setIsEditing(false)}
            className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all',
              !isEditing ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}
          >
            <Eye className="w-3 h-3" />
            <span className="hidden sm:inline">预览</span>
          </button>
          <button
            onClick={toggleEdit}
            disabled={readOnly}
            className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all',
              isEditing ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground',
              readOnly && 'opacity-40 cursor-not-allowed')}
          >
            <Pencil className="w-3 h-3" />
            <span className="hidden sm:inline">编辑</span>
          </button>
        </div>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {content.split('\n').length} 行 · {content.length} 字符
        </span>
      </div>

      {/* 内容区 */}
      <div className="flex-1 overflow-auto min-h-0">
        {isEditing ? (
          /* 编辑模式：原始 Markdown */
          <textarea
            ref={textareaRef}
            value={content}
            onChange={e => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            className={cn(
              'w-full h-full min-h-[300px] p-4 bg-background text-foreground',
              'text-sm leading-relaxed font-mono resize-none',
              'outline-none border-none',
              'placeholder:text-muted-foreground/50'
            )}
            placeholder="在此编辑 Markdown 内容..."
            spellCheck={false}
          />
        ) : (
          /* 查看模式：SafeMarkdown 渲染 */
          <div
            className="p-4 sm:p-6 prose-content"
            onDoubleClick={handleDoubleClick}
            onMouseUp={handleMouseUp}
          >
            <SafeMarkdown className="prose-editor-view [&_h1]:text-xl [&_h2]:text-lg [&_h3]:text-base [&_p]:leading-relaxed [&_p]:mb-3 [&_li]:leading-relaxed">
              {content || '*空文档 — 双击开始编辑*'}
            </SafeMarkdown>
          </div>
        )}
      </div>

      {/* 选中文本浮动操作菜单 */}
      {selectionPopup && !isEditing && (
        <div
          className="prose-selection-popup fixed z-[9999] animate-in fade-in slide-in-from-bottom-2 duration-150"
          style={{
            left: selectionPopup.x,
            top: selectionPopup.y - 8,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="flex items-center gap-0.5 px-1 py-0.5 rounded-lg bg-popover border border-border shadow-xl">
            {SELECTION_ACTIONS.map(action => (
              <button
                key={action.id}
                onClick={() => {
                  onSelectionAction?.(action.id, selectionPopup.text, {
                    start: selectionPopup.start,
                    end: selectionPopup.end,
                  });
                  setSelectionPopup(null);
                }}
                className="flex items-center gap-1 px-2 py-1.5 rounded-md text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors whitespace-nowrap"
                title={action.label}
              >
                <action.icon className="w-3 h-3" />
                <span className="hidden sm:inline">{action.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
