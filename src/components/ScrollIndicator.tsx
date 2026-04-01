import { useEffect, useState } from "react";
import { ChevronUp } from "lucide-react";

interface ScrollIndicatorProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
}

export function ScrollIndicator({ containerRef }: ScrollIndicatorProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight;
      const clientHeight = container.clientHeight;

      // 计算当前页码（假设每页高度为clientHeight）
      const page = Math.floor(scrollTop / clientHeight) + 1;
      const total = Math.ceil(scrollHeight / clientHeight);

      setCurrentPage(page);
      setTotalPages(total);
      setShowScrollTop(scrollTop > 300);
    };

    container.addEventListener("scroll", handleScroll);
    handleScroll(); // 初始化

    return () => container.removeEventListener("scroll", handleScroll);
  }, [containerRef]);

  const scrollToTop = () => {
    containerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="fixed right-4 bottom-20 flex flex-col items-center gap-2 z-50">
      {/* 页码指示器 */}
      {totalPages > 1 && (
        <div className="bg-black/70 text-white text-xs px-3 py-1 rounded-full backdrop-blur-sm">
          {currentPage} / {totalPages}
        </div>
      )}

      {/* 回到顶部按钮 */}
      {showScrollTop && (
        <button
          onClick={scrollToTop}
          className="bg-black text-white p-3 rounded-full shadow-lg hover:bg-gray-800 transition-colors"
          aria-label="回到顶部"
        >
          <ChevronUp className="w-5 h-5" />
        </button>
      )}
    </div>
  );
}
