/**
 * MentionMenu — @ 引用历史消息菜单
 * 
 * 输入框中键入 @ 后弹出最近 10 条消息，选择后引用注入到 prompt。
 */

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { User, Bot } from 'lucide-react';
import type { ChatMessage, QuotedReference } from '../../types';

interface MentionMenuProps {
  visible: boolean;
  query: string; // @ 后面的筛选文字
  messages: ChatMessage[];
  onSelect: (ref: QuotedReference) => void;
  onClose: () => void;
}

/** 安全提取消息文本内容（处理 multimodal content array） */
function getTextContent(m: ChatMessage): string {
  return typeof m.content === 'string' ? m.content : '';
}

export const MentionMenu = memo(function MentionMenu({
  visible, query, messages, onSelect, onClose,
}: MentionMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  // 取最近 10 条非 system 消息（倒序，最新在上）
  const candidates = messages
    .filter((m) => m.role !== 'system' && getTextContent(m).trim())
    .slice(-20)
    .reverse()
    .filter((m) => {
      if (!query) return true;
      return getTextContent(m).toLowerCase().includes(query.toLowerCase());
    })
    .slice(0, 10);

  // 用 ref 保持最新引用，避免 useEffect 键盘 handler 闭包过期
  const candidatesRef = useRef(candidates);
  candidatesRef.current = candidates;
  const selectedIndexRef = useRef(selectedIndex);
  selectedIndexRef.current = selectedIndex;

  useEffect(() => {
    setSelectedIndex(0);
  }, [query, visible]);

  const handleSelect = useCallback((msg: ChatMessage) => {
    const text = getTextContent(msg);
    const snippet = text.length > 120 ? text.slice(0, 120) + '…' : text;
    onSelect({
      type: 'message',
      label: `${msg.role === 'user' ? '我' : 'AI'}：${snippet}`,
      messageContent: text,
      messageRole: msg.role,
    });
    onClose();
  }, [onSelect, onClose]);

  const handleSelectRef = useRef(handleSelect);
  handleSelectRef.current = handleSelect;

  // 键盘导航
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      const cands = candidatesRef.current;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, cands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter' && cands.length > 0) {
        e.preventDefault();
        e.stopPropagation();
        handleSelectRef.current(cands[selectedIndexRef.current]);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handler, true);
    return () => window.removeEventListener('keydown', handler, true);
  }, [visible, onClose]);

  if (!visible || candidates.length === 0) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div className="fixed inset-0 z-40" onClick={onClose} />
      
      <div
        ref={menuRef}
        className="absolute bottom-full left-0 right-0 mb-1 z-50 max-h-64 overflow-y-auto bg-background border border-border rounded-lg shadow-lg"
      >
        <div className="px-3 py-1.5 text-[11px] text-muted-foreground border-b border-border">
          引用历史消息
        </div>
        {candidates.map((msg, idx) => {
          const text = getTextContent(msg);
          const snippet = text.length > 80 ? text.slice(0, 80) + '…' : text;
          return (
            <button
              key={msg.id || idx}
              className={`flex items-start gap-2 w-full text-left px-3 py-2 text-sm transition-colors ${
                idx === selectedIndex ? 'bg-primary/10' : 'hover:bg-muted'
              }`}
              onClick={() => handleSelect(msg)}
              onMouseEnter={() => setSelectedIndex(idx)}
            >
              <div className="flex-shrink-0 mt-0.5">
                {msg.role === 'user'
                  ? <User className="w-3.5 h-3.5 text-blue-500" />
                  : <Bot className="w-3.5 h-3.5 text-green-500" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {msg.role === 'user' ? '我' : 'AI'}
                </span>
                <div className="text-xs text-foreground/80 line-clamp-2 mt-0.5">
                  {snippet}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </>
  );
});
