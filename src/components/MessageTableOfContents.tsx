import { useState, useEffect, memo } from 'react';
import { List, ChevronRight, X } from 'lucide-react';

interface TocItem {
  id: string;
  text: string;
  level: number;
}

interface MessageTableOfContentsProps {
  /** Markdown 源文本 */
  content: string;
  /** 包含消息内容的容器 ref */
  containerRef?: React.RefObject<HTMLDivElement>;
}

/**
 * 消息内目录导航
 * 
 * 从 AI 回复的 Markdown 中提取 ## / ### 标题，
 * 生成浮动目录按钮，点击展开后可快速跳转。
 * 
 * 仅在标题数量 >= 3 时显示。
 */
export const MessageTableOfContents = memo(function MessageTableOfContents({
  content,
  containerRef,
}: MessageTableOfContentsProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [tocItems, setTocItems] = useState<TocItem[]>([]);

  // 从 markdown 源文本提取标题
  useEffect(() => {
    const headingRegex = /^(#{2,4})\s+(.+)$/gm;
    const items: TocItem[] = [];
    let match;
    
    while ((match = headingRegex.exec(content)) !== null) {
      const level = match[1].length; // 2=h2, 3=h3, 4=h4
      const text = match[2].replace(/[*_`#]/g, '').trim();
      const id = `heading-${text.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').toLowerCase()}`;
      items.push({ id, text, level });
    }
    
    setTocItems(items);
  }, [content]);

  // 不够多的标题不显示目录
  if (tocItems.length < 3) return null;

  const handleClick = (id: string) => {
    // 在消息容器内找到对应标题
    const container = containerRef?.current || document;
    const heading = container.querySelector(`[data-toc-id="${id}"]`);
    if (heading) {
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
      // 高亮闪烁效果
      heading.classList.add('toc-highlight');
      setTimeout(() => heading.classList.remove('toc-highlight'), 2000);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative inline-block">
      {/* 目录按钮 */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1 px-2 py-1 text-xs text-muted-foreground hover:text-foreground bg-muted/50 hover:bg-muted rounded-md transition-colors"
        title="目录导航"
      >
        <List className="w-3.5 h-3.5" />
        <span>{tocItems.length} 个章节</span>
      </button>

      {/* 目录弹窗 */}
      {isOpen && (
        <>
          {/* 背景遮罩 */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          
          {/* 目录面板 */}
          <div className="absolute left-0 top-8 z-50 w-64 max-h-80 overflow-y-auto bg-background border border-border rounded-lg shadow-lg">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border">
              <span className="text-sm font-medium">目录</span>
              <button onClick={() => setIsOpen(false)} className="p-0.5 hover:bg-muted rounded">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <nav className="py-1">
              {tocItems.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleClick(item.id)}
                  className="flex items-center gap-1.5 w-full text-left px-3 py-1.5 text-sm hover:bg-muted transition-colors"
                  style={{ paddingLeft: `${(item.level - 2) * 16 + 12}px` }}
                >
                  <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                  <span className="truncate">{item.text}</span>
                </button>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
});
