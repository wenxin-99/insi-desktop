/**
 * MessageTableOfContents — 消息内目录导航（v2 增强版）
 *
 * 从 AI 回复的 Markdown 中提取 ## / ### / #### 标题，
 * 生成浮动目录按钮，点击展开后可快速跳转。
 *
 * v2 改进：
 * - IntersectionObserver 自动高亮当前可见标题
 * - 进度指示（当前位置 / 总数）
 * - 高亮闪烁 + 平滑滚动
 * - 面板内当前项自动滚到可见区域
 *
 * 仅在标题数量 >= 3 时显示。
 */

import { useState, useEffect, useRef, useCallback, memo } from 'react';
import { List, ChevronRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface MessageTableOfContentsProps {
  /** Markdown 源文本 */
  content: string;
  /** 包含消息内容的容器 ref */
  containerRef?: React.RefObject<HTMLDivElement | null>;
}

export const MessageTableOfContents = memo(function MessageTableOfContents({
  content,
  containerRef,
}: MessageTableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // 从 markdown 源文本提取标题
  useEffect(() => {
    const headingRegex = /^(#{2,4})\s+(.+)$/gm;
    const items: TocItem[] = [];
    let match;

    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length; // 2=h2, 3=h3, 4=h4
      const text = match[2].replace(/[*_`#]/g, '').trim();
      const id = `toc-${text.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').toLowerCase()}`;
      items.push({ id, text, level });
    }

    setTocItems(items);
  }, [content]);

  // IntersectionObserver 追踪当前可见标题
  useEffect(() => {
    if (tocItems.length < 3) return;
    
    // 等 DOM 就绪
    const timer = setTimeout(() => {
      observerRef.current?.disconnect();

      const container = containerRef?.current || document.body;
      const observer = new IntersectionObserver(
        (entries) => {
          // 找到最上方的可见 heading
          const visible = entries
            .filter(e => e.isIntersecting)
            .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
          if (visible.length > 0) {
            const el = visible[0].target;
            setActiveId(el.getAttribute('data-toc-id') || el.id || null);
          }
        },
        {
          rootMargin: '-10% 0px -70% 0px',
          threshold: 0.1,
        }
      );

      tocItems.forEach((item) => {
        const el = container.querySelector(`[data-toc-id="${CSS.escape(item.id)}"]`);
        if (el) observer.observe(el);
      });

      observerRef.current = observer;
    }, 300);

    return () => {
      clearTimeout(timer);
      observerRef.current?.disconnect();
    };
  }, [tocItems, containerRef]);

  // 当前激活项自动滚到 nav 可见区域
  useEffect(() => {
    if (!isOpen || !activeId || !navRef.current) return;
    const activeBtn = navRef.current.querySelector(`[data-toc-nav="${activeId}"]`);
    if (activeBtn) {
      activeBtn.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  }, [activeId, isOpen]);

  // 跳转到指定标题
  const handleClick = useCallback((id: string) => {
    const container = containerRef?.current || document;
    const heading = container.querySelector(`[data-toc-id="${CSS.escape(id)}"]`);
    if (heading) {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveId(id);
      // 高亮闪烁效果
      heading.classList.add('toc-highlight');
      setTimeout(() => heading.classList.remove('toc-highlight'), 2000);
    }
  }, [containerRef]);

  // 不够多的标题不显示目录
  if (tocItems.length < 3) return null;

  // 当前进度
  const activeIndex = activeId ? tocItems.findIndex(i => i.id === activeId) : -1;
  const minLevel = Math.min(...tocItems.map(i => i.level));

  return (
    <div className="relative inline-block">
      {/* 目录按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-md transition-all',
          isOpen
            ? 'text-primary bg-primary/10 border border-primary/20'
            : 'text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted'
        )}
        title="目录导航"
      >
        <List className="w-3.5 h-3.5" />
        <span>{tocItems.length} 章节</span>
        {activeIndex >= 0 && (
          <span className="text-[10px] text-muted-foreground tabular-nums">
            ({activeIndex + 1}/{tocItems.length})
          </span>
        )}
      </button>

      {/* 目录弹窗 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* 目录面板 */}
          <div className="absolute left-0 top-9 z-50 w-64 max-h-80 bg-background/95 backdrop-blur-sm border border-border rounded-xl shadow-lg overflow-hidden animate-in slide-in-from-top-1 fade-in duration-150">
            {/* 标题栏 */}
            <div className="flex items-center justify-between px-3 py-2 border-b border-border/50 bg-muted/30">
              <span className="text-xs font-medium text-foreground">目录</span>
              <div className="flex items-center gap-2">
                {/* 进度条 */}
                <div className="w-16 h-1 rounded-full bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary transition-all duration-300"
                    style={{ width: `${activeIndex >= 0 ? ((activeIndex + 1) / tocItems.length) * 100 : 0}%` }}
                  />
                </div>
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* 目录列表 */}
            <nav ref={navRef} className="py-1 overflow-y-auto max-h-64">
              {tocItems.map((item) => {
                const isActive = activeId === item.id;
                const indent = (item.level - minLevel) * 14;
                return (
                  <button
                    key={item.id}
                    data-toc-nav={item.id}
                    onClick={() => handleClick(item.id)}
                    className={cn(
                      'flex items-center gap-1.5 w-full text-left py-1.5 text-[12px] leading-snug transition-all duration-150',
                      isActive
                        ? 'text-primary font-medium bg-primary/5 border-l-2 border-primary'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent/40 border-l-2 border-transparent',
                    )}
                    style={{ paddingLeft: `${indent + 12}px`, paddingRight: '12px' }}
                    title={item.text}
                  >
                    <ChevronRight className={cn(
                      'w-2.5 h-2.5 flex-shrink-0 transition-transform',
                      isActive && 'text-primary rotate-90'
                    )} />
                    <span className="truncate">{item.text}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </>
      )}
    </div>
  );
});
