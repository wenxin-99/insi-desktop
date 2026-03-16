import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Prism from "prismjs";

// 导入Prism.js核心样式
import "prismjs/themes/prism-tomorrow.css";

// 导入常用编程语言支持
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-python";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-json";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-tsx";

interface VirtualCodeBlockProps {
  code: string;
  language: string;
  lineHeight: number; // 行高（px）
  containerHeight: number; // 容器高度（px）
  showLineNumbers?: boolean; // 是否显示行号
  onLineClick?: (lineNumber: number) => void; // 点击行号的回调
}

/**
 * 虚拟滚动代码块组件
 * 只渲染可见区域的代码行，大幅提升超长代码块的性能
 */
export function VirtualCodeBlock({
  code,
  language,
  lineHeight,
  containerHeight,
  showLineNumbers = true,
  onLineClick,
}: VirtualCodeBlockProps) {
  const [scrollTop, setScrollTop] = useState(0);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const codeRef = useRef<HTMLElement>(null);

  // 将代码分割成行
  const lines = useMemo(() => code.split('\n'), [code]);
  const totalLines = lines.length;
  const totalHeight = totalLines * lineHeight;

  // 计算可见区域的行范围
  const { startIndex, endIndex, visibleLines } = useMemo(() => {
    const visibleCount = Math.ceil(containerHeight / lineHeight);
    const bufferSize = 50; // 上下各渲染50行缓冲区
    
    const start = Math.max(0, Math.floor(scrollTop / lineHeight) - bufferSize);
    const end = Math.min(totalLines, start + visibleCount + bufferSize * 2);
    
    return {
      startIndex: start,
      endIndex: end,
      visibleLines: lines.slice(start, end),
    };
  }, [scrollTop, lineHeight, containerHeight, totalLines, lines]);

  // 计算偏移量（让可见内容显示在正确位置）
  const offsetY = startIndex * lineHeight;

  // 滚动事件处理（节流）
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    setScrollTop(target.scrollTop);
  }, []);

  // 对可见代码应用语法高亮
  useEffect(() => {
    if (!codeRef.current || !language || language === "text") return;

    try {
      // 使用Prism高亮可见代码
      Prism.highlightElement(codeRef.current);
    } catch (error) {
      console.warn(`Failed to highlight code with Prism: ${language}`, error);
    }
  }, [visibleLines, language, startIndex, endIndex]);

  // 生成可见代码文本
  const visibleCode = visibleLines.join('\n');

  return (
    <div
      ref={containerRef}
      className="relative overflow-y-auto overflow-x-auto"
      style={{
        height: containerHeight,
        maxHeight: containerHeight,
      }}
      onScroll={handleScroll}
    >
      {/* 占位容器（撑开滚动条） */}
      <div style={{ height: totalHeight, position: 'relative' }}>
        {/* 可见内容 */}
        <div
          style={{
            position: 'absolute',
            top: offsetY,
            left: 0,
            right: 0,
            display: 'grid',
            gridTemplateColumns: showLineNumbers ? 'auto 1fr' : '1fr',
            gap: 0,
          }}
        >
          {showLineNumbers && (
            <div
              className="line-numbers"
              style={{
                padding: '0.75rem 0.5rem 0.75rem 0.75rem',
                textAlign: 'right',
                userSelect: 'none',
                borderRight: '1px solid rgba(128, 128, 128, 0.2)',
                color: 'rgba(128, 128, 128, 0.6)',
                minWidth: totalLines > 999 ? '3.5rem' : totalLines > 99 ? '3rem' : '2.5rem',
                background: 'rgba(0, 0, 0, 0.05)',
              }}
            >
              {visibleLines.map((_, index) => {
                const lineNumber = startIndex + index + 1;
                return (
                  <div
                    key={lineNumber}
                    onClick={() => {
                      setHighlightedLine(lineNumber);
                      if (onLineClick) {
                        onLineClick(lineNumber);
                      }
                      window.location.hash = `L${lineNumber}`;
                    }}
                    style={{
                      lineHeight: `${lineHeight}px`,
                      height: `${lineHeight}px`,
                      cursor: 'pointer',
                      backgroundColor:
                        highlightedLine === lineNumber
                          ? 'rgba(255, 255, 0, 0.15)'
                          : 'transparent',
                      padding: '0 0.25rem',
                      marginLeft: '-0.25rem',
                      marginRight: '-0.25rem',
                    }}
                    className="hover:bg-white/10 transition-colors"
                  >
                    {lineNumber}
                  </div>
                );
              })}
            </div>
          )}
          <pre
            className="!mt-0 !mb-0 bg-black/5 dark:bg-white/5 p-3"
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              overflowWrap: 'anywhere',
              fontSize: 'var(--code-font-size, 14px)',
              margin: 0,
              background: 'transparent',
            }}
          >
            <code ref={codeRef} className={`language-${language}`}>
              {visibleCode}
            </code>
          </pre>
        </div>
      </div>

      {/* 性能指示器（开发模式） */}
      {process.env.NODE_ENV === 'development' && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white text-xs px-2 py-1 rounded opacity-70">
          虚拟滚动: {startIndex + 1}-{endIndex} / {totalLines}
        </div>
      )}
    </div>
  );
}
