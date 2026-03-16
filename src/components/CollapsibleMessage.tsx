import { useState, useRef, useEffect, memo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface CollapsibleMessageProps {
  children: React.ReactNode;
  /** 折叠高度阈值（像素），超过此高度自动折叠。默认 600 */
  maxCollapsedHeight?: number;
}

/**
 * 长消息自动折叠组件
 * 
 * AI 回复超过指定高度时自动折叠，显示渐变遮罩和"展开全文"按钮。
 * 展开后可以收起。
 * 
 * 特性：
 * - 自动检测内容高度，仅在需要时启用
 * - 底部渐变遮罩，提示有更多内容
 * - 展开/收起时平滑过渡
 * - 不影响已经很短的消息
 */
export const CollapsibleMessage = memo(function CollapsibleMessage({ 
  children, 
  maxCollapsedHeight = 600 
}: CollapsibleMessageProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const [needsCollapse, setNeedsCollapse] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [contentHeight, setContentHeight] = useState(0);

  useEffect(() => {
    if (!contentRef.current) return;
    
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const height = entry.contentRect.height;
        setContentHeight(height);
        if (height > maxCollapsedHeight + 100) {
          // 只在超过阈值+100px时才折叠（避免刚好在边界的抖动）
          setNeedsCollapse(true);
        }
      }
    });
    
    observer.observe(contentRef.current);
    return () => observer.disconnect();
  }, [maxCollapsedHeight]);

  // 不需要折叠时直接渲染
  if (!needsCollapse) {
    return <div ref={contentRef}>{children}</div>;
  }

  return (
    <div className="relative">
      <div
        ref={contentRef}
        className="transition-[max-height] duration-300 ease-in-out overflow-hidden"
        style={{ 
          maxHeight: isExpanded ? `${contentHeight + 50}px` : `${maxCollapsedHeight}px`
        }}
      >
        {children}
      </div>
      
      {/* 渐变遮罩（仅折叠时显示） */}
      {!isExpanded && (
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-muted via-muted/80 to-transparent pointer-events-none rounded-b-lg" />
      )}
      
      {/* 展开/收起按钮 */}
      <div className={`flex justify-center ${isExpanded ? 'mt-2' : '-mt-2 relative z-10'}`}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium text-primary bg-background border border-border rounded-full shadow-sm hover:bg-muted transition-colors"
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4" />
              收起
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4" />
              展开全文
            </>
          )}
        </button>
      </div>
    </div>
  );
});
