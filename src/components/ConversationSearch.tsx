import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { Search, MessageSquare, FileText, X, ArrowRight } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface ConversationSearchProps {
  /** 选中某个对话时的回调 */
  onSelect: (conversationId: number) => void;
  /** 是否允许打开（比如未登录时禁止） */
  enabled?: boolean;
}

/**
 * 对话搜索组件（Ctrl+K / Cmd+K 快捷键）
 * 
 * 功能：
 * - 全局键盘快捷键 Ctrl+K / Cmd+K 呼出
 * - 搜索对话标题 + 消息内容
 * - 高亮匹配关键词
 * - 键盘方向键 + Enter 选择
 * - 防抖搜索（300ms）
 * - ESC 关闭
 */
export const ConversationSearch = memo(function ConversationSearch({ 
  onSelect, 
  enabled = true 
}: ConversationSearchProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // 防抖搜索
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setSelectedIndex(0);
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  // tRPC 查询
  const { data: results, isLoading } = trpc.conversation.search.useQuery(
    { query: debouncedQuery, limit: 15 },
    { enabled: debouncedQuery.length > 0 && isOpen }
  );

  // 全局快捷键 Ctrl+K / Cmd+K
  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled]);

  // 打开时聚焦输入框
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setDebouncedQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // 选中对话
  const handleSelect = useCallback((id: number) => {
    setIsOpen(false);
    onSelect(id);
  }, [onSelect]);

  // 键盘导航
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    const items = results || [];
    if (e.key === 'Escape') {
      setIsOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => Math.min(prev + 1, items.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && items.length > 0) {
      e.preventDefault();
      handleSelect(items[selectedIndex].id);
    }
  }, [results, selectedIndex, handleSelect]);

  // 滚动选中项到可视区域
  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.children[selectedIndex] as HTMLElement;
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  /** 高亮匹配的关键词 */
  const highlightMatch = (text: string, q: string) => {
    if (!q || !text) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase());
    if (idx === -1) return text;
    return (
      <>
        {text.slice(0, idx)}
        <mark className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">{text.slice(idx, idx + q.length)}</mark>
        {text.slice(idx + q.length)}
      </>
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* 背景遮罩 */}
      <div 
        className="fixed inset-0 bg-black/50 z-50 animate-in fade-in duration-150"
        onClick={() => setIsOpen(false)}
      />
      
      {/* 搜索对话框 */}
      <div className="fixed left-1/2 top-[15%] -translate-x-1/2 w-[90vw] max-w-lg z-50 animate-in fade-in slide-in-from-top-4 duration-200">
        <div className="bg-background border border-border rounded-xl shadow-2xl overflow-hidden">
          
          {/* 搜索输入 */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="搜索对话标题或内容..."
              className="flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
              autoComplete="off"
              spellCheck={false}
            />
            {query && (
              <button onClick={() => setQuery('')} className="p-1 hover:bg-muted rounded">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
            <kbd className="hidden md:inline-flex px-1.5 py-0.5 text-xs font-mono text-muted-foreground bg-muted rounded border border-border">
              ESC
            </kbd>
          </div>

          {/* 搜索结果 */}
          <div ref={listRef} className="max-h-[50vh] overflow-y-auto">
            {!debouncedQuery && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                输入关键词搜索对话标题和消息内容
              </div>
            )}
            
            {debouncedQuery && isLoading && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                <div className="animate-spin w-5 h-5 border-2 border-primary border-t-transparent rounded-full mx-auto mb-2" />
                搜索中...
              </div>
            )}
            
            {debouncedQuery && !isLoading && results && results.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                没有找到匹配的对话
              </div>
            )}

            {results?.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => handleSelect(item.id)}
                className={`w-full text-left px-4 py-3 flex items-start gap-3 transition-colors border-b border-border/50 last:border-b-0 ${
                  idx === selectedIndex 
                    ? 'bg-primary/10' 
                    : 'hover:bg-muted/50'
                }`}
              >
                {/* 图标 */}
                <div className="flex-shrink-0 mt-0.5">
                  {item.matchType === 'title' ? (
                    <MessageSquare className="w-4 h-4 text-primary" />
                  ) : (
                    <FileText className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                
                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium truncate">
                    {highlightMatch(item.title, debouncedQuery)}
                  </div>
                  {item.preview && (
                    <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {highlightMatch(item.preview, debouncedQuery)}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground/60 mt-1">
                    {new Date(item.updatedAt).toLocaleDateString('zh-CN')}
                  </div>
                </div>

                {/* 跳转箭头 */}
                {idx === selectedIndex && (
                  <ArrowRight className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                )}
              </button>
            ))}
          </div>

          {/* 底部提示 */}
          <div className="px-4 py-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/30">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">↑↓</kbd>
                导航
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">Enter</kbd>
                打开
              </span>
            </div>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">Ctrl</kbd>
              +
              <kbd className="px-1 py-0.5 bg-muted rounded border border-border font-mono">K</kbd>
              搜索
            </span>
          </div>
        </div>
      </div>
    </>
  );
});
