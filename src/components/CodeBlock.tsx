import { useState, useEffect, useRef, useMemo, memo, useCallback } from "react";
import { Copy, Check, Download, ChevronDown, ChevronUp, WrapText, Hash, Terminal } from "lucide-react";
import { toast } from "sonner";

import { VirtualCodeBlock } from "./VirtualCodeBlock";
import { streamingHighlightToHtml } from '@/lib/streamingHighlight'; // ★ 流式轻量高亮
import { highlightCode, normalizeLang, preloadShiki } from '@/lib/shikiHighlighter'; // ★ Shiki WASM 高亮
import { CodeCanvas, isRunnableInBrowser, inferLanguage } from '@/components/codeCanvas';
import { ExportDropdown } from '@/components/canvas/ExportDropdown';

// ★ 空闲时预热 Shiki
if (typeof window !== 'undefined') preloadShiki();

// ═══════ 语言图标和配色映射 ═══════
const LANG_META: Record<string, { icon: string; color: string; label?: string }> = {
  javascript: { icon: "JS",  color: "#f7df1e", label: "JavaScript" },
  typescript: { icon: "TS",  color: "#3178c6", label: "TypeScript" },
  python:     { icon: "PY",  color: "#3776ab", label: "Python" },
  java:       { icon: "JV",  color: "#ed8b00", label: "Java" },
  go:         { icon: "GO",  color: "#00add8", label: "Go" },
  rust:       { icon: "RS",  color: "#dea584", label: "Rust" },
  c:          { icon: "C",   color: "#a8b9cc", label: "C" },
  cpp:        { icon: "C+",  color: "#00599c", label: "C++" },
  csharp:     { icon: "C#",  color: "#239120", label: "C#" },
  php:        { icon: "PHP", color: "#777bb4", label: "PHP" },
  ruby:       { icon: "RB",  color: "#cc342d", label: "Ruby" },
  swift:      { icon: "SW",  color: "#f05138", label: "Swift" },
  kotlin:     { icon: "KT",  color: "#7f52ff", label: "Kotlin" },
  dart:       { icon: "DT",  color: "#0175c2", label: "Dart" },
  sql:        { icon: "SQL", color: "#e38d13", label: "SQL" },
  bash:       { icon: "SH",  color: "#4eaa25", label: "Shell" },
  json:       { icon: "{ }", color: "#a0a0a0", label: "JSON" },
  yaml:       { icon: "YML", color: "#cb171e", label: "YAML" },
  html:       { icon: "< >", color: "#e34f26", label: "HTML" },
  css:        { icon: "CSS", color: "#1572b6", label: "CSS" },
  jsx:        { icon: "JSX", color: "#61dafb", label: "React JSX" },
  tsx:        { icon: "TSX", color: "#61dafb", label: "React TSX" },
  markdown:   { icon: "MD",  color: "#888888", label: "Markdown" },
  scala:      { icon: "SC",  color: "#dc322f", label: "Scala" },
  lua:        { icon: "LUA", color: "#000080", label: "Lua" },
  r:          { icon: "R",   color: "#276dc3", label: "R" },
  julia:      { icon: "JL",  color: "#9558b2", label: "Julia" },
  haskell:    { icon: "HS",  color: "#5e5086", label: "Haskell" },
  perl:       { icon: "PL",  color: "#39457e", label: "Perl" },
  objectivec: { icon: "OC",  color: "#438eff", label: "Objective-C" },
  matlab:     { icon: "MAT", color: "#e16737", label: "MATLAB" },
  diff:       { icon: "±",   color: "#41b883", label: "Diff" },
  text:       { icon: "TXT", color: "#666666", label: "Text" },
};

// ═══════ 从首行注释提取文件路径 ═══════
function extractFilePath(code: string): string | null {
  const firstLine = code.split('\n')[0]?.trim();
  if (!firstLine) return null;
  const patterns = [
    /^(?:\/\/|#)\s*(.+\.\w{1,10})$/,
    /^\/\*\s*(.+\.\w{1,10})\s*\*\/$/,
    /^(?:\/\/|#)\s*([\w\-./]+\/[\w\-./]+)$/,
  ];
  for (const p of patterns) {
    const m = firstLine.match(p);
    if (m) return m[1];
  }
  return null;
}

// ═══════ 高效 HTML 转义（避免 DOMParser 开销） ═══════
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface CodeBlockProps {
  language?: string;
  children: string;
  highlightLines?: string;
  /** 流式输出中：跳过语法高亮，使用轻量 tokenizer */
  streaming?: boolean;
}

export const CodeBlock = memo(function CodeBlock({
  language = "text",
  children: rawChildren,
  highlightLines,
  streaming = false,
}: CodeBlockProps) {
  // 防御性：确保 children 始终为字符串
  const children = typeof rawChildren === 'string' ? rawChildren : String(rawChildren ?? '');

  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [highlightedLine, setHighlightedLine] = useState<number | null>(null);
  const [wordWrap, setWordWrap] = useState(false);
  const [showLineNumbers] = useState(typeof window !== 'undefined' && window.innerWidth >= 768);
  const [showCanvas, setShowCanvas] = useState(false);
  const canRun = isRunnableInBrowser(language);
  const preRef = useRef<HTMLPreElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 追踪上次成功高亮的内容，避免相同内容重复高亮
  const lastHighlightedCodeRef = useRef<string>("");

  const languageMap: Record<string, string> = {
    js: "javascript", ts: "typescript", py: "python", rb: "ruby",
    sh: "bash", yml: "yaml", md: "markdown", kt: "kotlin",
    objc: "objectivec", "objective-c": "objectivec", "obj-c": "objectivec",
    hs: "haskell",
  };

  const prismLanguage = useMemo(() => languageMap[language] || language, [language]);
  const langMeta = LANG_META[prismLanguage];
  const filePath = useMemo(() => extractFilePath(children), [children]);

  const lineCount = useMemo(() => children.split('\n').length, [children]);
  const shouldShowCollapseButton = lineCount > 20;
  const useVirtualScroll = lineCount > 1000;
  const lineHeight = typeof window !== 'undefined' && window.innerWidth <= 768 ? 18 : 21;
  const containerHeight = isCollapsed ? 300 : 600;
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

  // IntersectionObserver 延迟加载
  useEffect(() => {
    if (!containerRef.current) return;
    setIsVisible(true);
    const observer = new IntersectionObserver(
      (entries) => { entries.forEach((entry) => { if (entry.isIntersecting && !isVisible) setIsVisible(true); }); },
      { rootMargin: '100px', threshold: 0.1 }
    );
    observer.observe(containerRef.current);
    return () => { containerRef.current && observer.unobserve(containerRef.current); };
  }, [isVisible]);

  // ═══════ Shiki 高亮（流式时完全跳过） ═══════
  useEffect(() => {
    if (!isVisible) return;
    if (!prismLanguage || prismLanguage === "text") { setHighlightedHtml(null); return; }

    // ★ 流式输出时：不做 Shiki 高亮，直接返回
    if (streaming) return;

    // ★ XML/Markup 含 <replace>/<search> 等 AI 修改标签时跳过
    if ((prismLanguage === 'xml' || prismLanguage === 'markup' || prismLanguage === 'html') &&
        /<(?:replace|search|replacement)\b/i.test(children)) {
      setHighlightedHtml(null);
      return;
    }

    // 如果内容和上次高亮的完全一样，跳过
    if (lastHighlightedCodeRef.current === children) return;

    if (highlightTimerRef.current) clearTimeout(highlightTimerRef.current);

    // 非流式：使用较短的防抖
    highlightTimerRef.current = setTimeout(() => {
      highlightCode(children, prismLanguage).then(({ html, fromShiki }) => {
        if (fromShiki && html) {
          setHighlightedHtml(html);
          lastHighlightedCodeRef.current = children;
        } else {
          setHighlightedHtml(null);
        }
      }).catch(() => setHighlightedHtml(null));
    }, 50);

    return () => { highlightTimerRef.current && clearTimeout(highlightTimerRef.current); };
  }, [isVisible, prismLanguage, children, streaming]);

  // 流式结束时立即触发高亮（从 streaming→false 的过渡）
  useEffect(() => {
    if (!streaming && isVisible && prismLanguage && prismLanguage !== "text") {
      // ★ 同样跳过含 AI 修改标签的 XML
      if ((prismLanguage === 'xml' || prismLanguage === 'markup' || prismLanguage === 'html') &&
          /<(?:replace|search|replacement)\b/i.test(children)) {
        return;
      }
      if (lastHighlightedCodeRef.current !== children) {
        highlightCode(children, prismLanguage).then(({ html, fromShiki }) => {
          if (fromShiki && html) {
            setHighlightedHtml(html);
            lastHighlightedCodeRef.current = children;
          }
        }).catch(() => {});
      }
    }
  }, [streaming, isVisible, prismLanguage, children]);

  // 初始化折叠（桌面端超过20行自动折叠 —— 仅非流式时）
  useEffect(() => {
    if (shouldShowCollapseButton && !streaming) setIsCollapsed(window.innerWidth >= 768);
  }, [shouldShowCollapseButton, streaming]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopied(false), 2000);
    } catch { toast.error("复制失败"); }
  }, [children]);

  const handleDownload = useCallback(() => {
    try {
      let content = children;
      let filename = filePath?.split('/').pop()?.replace(/\.\w+$/, '') || `code-${Date.now()}`;
      let ext = filePath?.split('.').pop() || prismLanguage || "txt";
      if (prismLanguage === "diff" || prismLanguage === "patch") {
        ext = "patch"; filename = `fix-${Date.now()}`;
        if (!content.startsWith("---") && !content.startsWith("diff")) content = `--- a/file\n+++ b/file\n${content}`;
      }
      const blob = new Blob([content], { type: "text/plain" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = `${filename}.${ext}`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
    } catch { toast.error("下载失败"); }
  }, [children, filePath, prismLanguage]);

  // ★ 保留最后一次流式高亮结果，作为 Shiki 加载前的桥接
  // 避免 streaming→false 时从"轻量高亮有颜色"→"escapeHtml 纯白"→"Shiki 有颜色"的色彩闪烁
  const lastStreamingHtmlRef = useRef<string>('');

  // ═══════ 渲染 HTML ═══════
  // 流式时：轻量 tokenizer 高亮（~80% 精度，极快）
  // 非流式：Shiki WASM 完整高亮（VS Code 同款）
  // 过渡期：保留流式高亮结果作为桥接
  const renderedHtml = useMemo(() => {
    if (streaming) {
      // ★ 流式中：使用手写 tokenizer 做实时语法高亮
      const html = streamingHighlightToHtml(children, prismLanguage);
      lastStreamingHtmlRef.current = html; // 保存供过渡期使用
      return html;
    }
    if (highlightedHtml) {
      // ★ Shiki 输出已经是安全的 HTML
      // 安全检查：高亮后纯文本长度远小于源码 → 内容被吞了
      const textOnly = highlightedHtml.replace(/<[^>]*>/g, '');
      if (children.length > 10 && textOnly.length < children.length * 0.3) {
        console.warn('[CodeBlock] Shiki output too short, falling back', {
          lang: prismLanguage, srcLen: children.length, highlightTextLen: textOnly.length
        });
        return lastStreamingHtmlRef.current || escapeHtml(children);
      }
      return highlightedHtml;
    }
    // ★ Shiki 未就绪：用流式高亮桥接（而非跳到纯 escapeHtml）
    if (lastStreamingHtmlRef.current) {
      return lastStreamingHtmlRef.current;
    }
    return escapeHtml(children);
  }, [streaming, highlightedHtml, children, prismLanguage]);

  // ═══════ 行号（流式时跳过生成，避免大量 DOM 操作） ═══════
  const lineNumbers = useMemo(() => {
    // 流式中且行数超过 50 时跳过行号渲染，减少 DOM 节点
    if (streaming && lineCount > 50) return null;
    if (!showLineNumbers) return null;

    return children.split('\n').map((_, index) => (
      <div
        key={index}
        onClick={() => !streaming && setHighlightedLine(prev => prev === index + 1 ? null : index + 1)}
        style={{
          lineHeight: 'var(--code-line-height, 1.5)',
          cursor: streaming ? 'default' : 'pointer',
          padding: '0 4px',
          borderRadius: '3px',
          backgroundColor: highlightedLine === index + 1 ? 'rgba(99,102,241,0.12)' : 'transparent',
          color: highlightedLine === index + 1 ? 'rgba(129,140,248,0.8)' : undefined,
          transition: streaming ? 'none' : 'all 0.15s ease',
        }}
        className={streaming ? '' : 'hover:text-gray-400'}
      >
        {index + 1}
      </div>
    ));
  }, [children, showLineNumbers, highlightedLine, streaming, lineCount]);

  // 语言主题色
  const accentColor = langMeta?.color || '#888888';

  return (
    <div
      ref={containerRef}
      className="relative group my-2 md:my-3 rounded-xl overflow-hidden"
      style={{
        contain: 'layout style',
        boxShadow: `0 2px 16px rgba(0,0,0,0.18), 0 0 0 1px rgba(255,255,255,0.04) inset, 0 0 20px -4px ${accentColor}18`,
      }}
    >
      {/* 顶部语言色线 */}
      <div
        style={{
          height: '2px',
          background: `linear-gradient(90deg, ${accentColor}CC 0%, ${accentColor}40 70%, transparent 100%)`,
        }}
      />

      {/* 顶部工具栏 */}
      <div
        className="flex items-center justify-between px-3 md:px-4 py-2 md:py-2.5"
        style={{
          background: 'linear-gradient(180deg, #2a2a2e 0%, #232327 100%)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        {/* 左侧：语言图标 + 文件路径/语言名 */}
        <div className="flex items-center gap-2 md:gap-2.5 min-w-0">
          {langMeta ? (
            <span
              className="shrink-0 inline-flex items-center justify-center rounded-md px-1.5 py-0.5 leading-none"
              style={{
                background: langMeta.color + '20',
                color: langMeta.color,
                border: `1px solid ${langMeta.color}30`,
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, monospace',
                fontSize: isMobile ? '10px' : '11px',
                fontWeight: 700,
                letterSpacing: '0.02em',
              }}
            >
              {langMeta.icon}
            </span>
          ) : (
            <Terminal className="w-3.5 h-3.5 text-gray-500 shrink-0" />
          )}

          <span className="text-xs md:text-sm font-mono truncate" style={{ color: 'rgba(255,255,255,0.50)' }}>
            {filePath || langMeta?.label || prismLanguage || "text"}
          </span>

          {/* 行数（流式中也显示，但不频繁更新） */}
          {lineCount > 5 && (
            <span className="hidden md:inline-flex items-center gap-0.5 text-[11px]" style={{ color: 'rgba(255,255,255,0.20)' }}>
              <Hash className="w-3 h-3" />
              {lineCount}
            </span>
          )}
        </div>

        {/* 右侧：操作按钮 */}
        <div className="flex items-center gap-0.5 md:gap-1">
          {/* 自动换行（流式时隐藏，减少交互干扰） */}
          {!streaming && (
            <button
              onClick={() => setWordWrap(w => !w)}
              className={`hidden md:inline-flex items-center justify-center w-7 h-7 rounded-md transition-all duration-150 ${
                wordWrap
                  ? 'bg-white/10 text-gray-200 shadow-[0_0_0_1px_rgba(255,255,255,0.1)]'
                  : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
              }`}
              title={wordWrap ? "取消换行" : "自动换行"}
            >
              <WrapText className="w-3.5 h-3.5" />
            </button>
          )}

          {/* 折叠/展开（流式时隐藏） */}
          {shouldShowCollapseButton && !streaming && (
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors duration-150"
              title={isCollapsed ? "展开代码" : "折叠代码"}
            >
              {isCollapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            </button>
          )}

          {/* 复制 */}
          <button
            onClick={handleCopy}
            className={`inline-flex items-center gap-1 h-7 px-2 md:px-2.5 rounded-md text-xs font-medium transition-all duration-200 ${
              copied
                ? 'bg-emerald-500/15 text-emerald-400'
                : 'text-gray-400 hover:text-gray-200 hover:bg-white/8'
            }`}
            style={{
              border: copied ? '1px solid rgba(16,185,129,0.25)' : '1px solid transparent',
            }}
          >
            <span className="relative w-3.5 h-3.5 shrink-0">
              <Copy
                className="w-3.5 h-3.5 absolute inset-0 transition-all duration-300"
                style={{
                  opacity: copied ? 0 : 1,
                  transform: copied ? 'scale(0.5) rotate(12deg)' : 'scale(1) rotate(0deg)',
                }}
              />
              <Check
                className="w-3.5 h-3.5 absolute inset-0 transition-all duration-300"
                style={{
                  opacity: copied ? 1 : 0,
                  transform: copied ? 'scale(1) rotate(0deg)' : 'scale(0.5) rotate(-12deg)',
                }}
              />
            </span>
            <span className="hidden md:inline">{copied ? "已复制" : "复制"}</span>
          </button>

          {/* ★ P2-2: 复制文件路径 */}
          {filePath && !streaming && (
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(filePath);
                  toast.success(`已复制路径: ${filePath}`);
                } catch { toast.error("复制路径失败"); }
              }}
              className="hidden md:inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
              title={`复制路径: ${filePath}`}
            >
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
              </svg>
              <span>路径</span>
            </button>
          )}

          {/* 导出（多格式，流式时隐藏） */}
          {!streaming && (
            <ExportDropdown
              code={children}
              language={language}
              title={`code`}
              rawExt={language === "python" ? "py" : language === "typescript" ? "ts" : language === "javascript" ? "js" : language}
              buttonClassName="hidden md:inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors duration-150"
            />
          )}

          {/* ★ Run 按钮（Python/JS/TS） */}
          {canRun && !streaming && (
            <button
              onClick={() => setShowCanvas(!showCanvas)}
              className={`inline-flex items-center gap-1 h-7 px-2 md:px-2.5 rounded-md text-xs font-medium transition-colors duration-150 ${
                showCanvas
                  ? 'bg-green-500/15 text-green-400 border border-green-500/25'
                  : 'text-gray-400 hover:text-green-400 hover:bg-green-500/10'
              }`}
              style={{ border: showCanvas ? undefined : '1px solid transparent' }}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{showCanvas ? "收起" : "Run"}</span>
            </button>
          )}
        </div>
      </div>

      {/* ════════════════════════════════════════
          代码内容区
          ════════════════════════════════════════ */}
      <div className="relative">
        {useVirtualScroll && isVisible && !streaming ? (
          <div className="bg-black/5 dark:bg-white/5 rounded-b-xl">
            <VirtualCodeBlock
              code={children}
              language={prismLanguage}
              lineHeight={lineHeight}
              containerHeight={containerHeight}
              showLineNumbers={showLineNumbers}
              onLineClick={(lineNumber) => setHighlightedLine(lineNumber)}
            />
          </div>
        ) : (
          <>
            <div
              className={`
                !mt-0 !mb-0 !rounded-t-none overflow-x-auto overflow-y-auto code-block-with-lines
                ${isCollapsed && !streaming ? 'max-h-[300px]' : streaming ? '' : 'max-h-[600px]'}
                rounded-b-xl
                ${streaming ? '' : 'transition-[max-height] duration-300 ease-in-out'}
              `}
              style={{
                background: '#1b1b1f',
                maxWidth: '100%',
                display: 'grid',
                gridTemplateColumns: (showLineNumbers && lineNumbers) ? 'auto 1fr' : '1fr',
                gap: '0',
                fontSize: isMobile ? '11px' : '13px',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace',
                minHeight: isCollapsed && !streaming ? '100px' : 'auto',
                gridAutoRows: 'min-content',
              }}
            >
              {/* ═══ 行号列 ═══ */}
              {showLineNumbers && lineNumbers && (
                <div
                  className="select-none"
                  style={{
                    padding: isMobile ? '12px 4px 12px 8px' : '16px 8px 16px 12px',
                    textAlign: 'right',
                    borderRight: '1px solid rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.20)',
                    fontSize: isMobile ? '10px' : '12px',
                    minWidth: isMobile
                      ? (lineCount > 99 ? '2rem' : '1.5rem')
                      : (lineCount > 999 ? '3.5rem' : lineCount > 99 ? '3rem' : '2.5rem'),
                  }}
                >
                  {lineNumbers}
                </div>
              )}

              {/* ═══ 代码内容 ═══ */}
              <div className="relative overflow-x-auto">
                {!wordWrap && (
                  <div
                    className="md:hidden absolute right-0 top-0 bottom-0 w-8 pointer-events-none z-10"
                    style={{ background: 'linear-gradient(to left, #1b1b1f, transparent)', opacity: 0.7 }}
                  />
                )}
                <pre
                  ref={preRef}
                  className="code-block-pre"
                  style={{
                    margin: 0,
                    padding: isMobile ? '12px' : '16px',
                    whiteSpace: wordWrap ? 'pre-wrap' : 'pre',
                    wordBreak: wordWrap ? 'break-all' : undefined,
                    overflowX: wordWrap ? 'hidden' : 'auto',
                    background: 'transparent',
                    maxWidth: '100%',
                    width: wordWrap ? '100%' : 'max-content',
                    minWidth: '100%',
                    minHeight: 'fit-content',
                    height: 'auto',
                  }}
                  data-line={highlightLines}
                >
                  <code
                    className={`language-${prismLanguage}`}
                    style={{
                      color: '#d4d4d8',
                      opacity: 1,
                      // ★ 流式高亮 → Shiki 高亮切换时平滑过渡
                      transition: streaming ? 'none' : 'opacity 0.15s ease-in-out',
                    }}
                    dangerouslySetInnerHTML={{ __html: renderedHtml }}
                  />
                </pre>
              </div>
            </div>

            {/* ═══ 折叠状态：底部渐变 + "展开全部"按钮（流式时不显示） ═══ */}
            {isCollapsed && shouldShowCollapseButton && !streaming && (
              <div
                className="absolute bottom-0 left-0 right-0 flex items-end justify-center cursor-pointer"
                style={{
                  height: '72px',
                  background: 'linear-gradient(to bottom, transparent 0%, #1b1b1f 75%)',
                  borderRadius: '0 0 12px 12px',
                }}
                onClick={() => setIsCollapsed(false)}
              >
                <button className="mb-2.5 inline-flex items-center gap-1.5 px-3 py-1 text-[11px] font-medium text-gray-400 hover:text-gray-200 bg-white/[0.06] hover:bg-white/[0.10] border border-white/[0.08] rounded-full transition-all duration-200 backdrop-blur-sm">
                  <ChevronDown className="w-3 h-3" />
                  展开全部 · {lineCount} 行
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ★ Code Canvas 执行面板 */}
      {showCanvas && canRun && (
        <div className="border-t border-white/[0.06]">
          <CodeCanvas
            code={children}
            language={inferLanguage(language)}
            fileName={`code.${language === "python" ? "py" : language === "typescript" ? "ts" : "js"}`}
            onFixError={(ctx) => {
              window.dispatchEvent(new CustomEvent("code-canvas:fix-error", { detail: ctx }));
            }}
            autoExpandConsole
          />
        </div>
      )}
    </div>
  );
});
