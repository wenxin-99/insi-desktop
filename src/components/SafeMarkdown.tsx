import { useMemo, memo, lazy, Suspense, useState, useEffect, useRef } from "react";
import { CodeBlock } from "@/components/CodeBlock";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
// ★ rehypeRaw 已移除 — 它是代码块内容被吞掉的根因
// rehypeRaw 会把代码块内的 <replace>/<search>/<div> 等标签当作真实 HTML 解析，
// 导致代码块内容被静默丢弃。移除后代码块 100% 安全。
// 代价：Markdown 中的裸 HTML 标签不再渲染为真实 DOM（显示为转义文本），
// 但对代码分析场景无影响。
import "katex/dist/katex.min.css";
import { smartFixLatex } from "@/lib/latexUtils";
import { detectLanguage } from "@/lib/languageDetector";

// Mermaid 组件懒加载（~200KB，仅在需要时才加载）
const MermaidBlock = lazy(() => import("@/components/MermaidBlock").then(m => ({ default: m.MermaidBlock })));

interface SafeMarkdownProps {
  children: string;
  className?: string;
  /** 流式输出中：启用渲染节流，跳过代码高亮 */
  streaming?: boolean;
}

/** 从标题文本生成稳定的 ID（用于目录跳转） */
function headingToId(text: string): string {
  return `toc-${text.replace(/\s+/g, '-').replace(/[^\w\u4e00-\u9fff-]/g, '').toLowerCase()}`;
}

/** 提取 React children 的纯文本 */
function extractText(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) return children.map(extractText).join('');
  if (children?.props?.children) return extractText(children.props.children);
  return '';
}

/**
 * GitHub 风格 Callout 类型映射
 */
const CALLOUT_TYPES: Record<string, { icon: string; label: string; colors: string }> = {
  NOTE:      { icon: '\u2139\ufe0f',  label: '注意',   colors: 'border-blue-400 bg-blue-50 dark:bg-blue-950/30 text-blue-900 dark:text-blue-200' },
  TIP:       { icon: '\u{1f4a1}', label: '提示',   colors: 'border-green-400 bg-green-50 dark:bg-green-950/30 text-green-900 dark:text-green-200' },
  IMPORTANT: { icon: '\u2757', label: '重要',   colors: 'border-purple-400 bg-purple-50 dark:bg-purple-950/30 text-purple-900 dark:text-purple-200' },
  WARNING:   { icon: '\u26a0\ufe0f',  label: '警告',   colors: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-950/30 text-yellow-900 dark:text-yellow-200' },
  CAUTION:   { icon: '\u{1f534}', label: '危险',   colors: 'border-red-400 bg-red-50 dark:bg-red-950/30 text-red-900 dark:text-red-200' },
};

// ═══════ 流式渲染节流间隔(ms) ═══════
const STREAM_THROTTLE_MS = 80;

// ═══════ 非标准 XML 标签保护 ═══════
//
// 移除 rehypeRaw 后，代码块内的 HTML/XML 标签不会再被吞掉（protectCodeFenceHtml 不再需要）。
// 但代码块外的非标准标签（<replace>、<search> 等 AI 格式标签）会被 remark 当作 HTML 块
// 静默丢弃（不是渲染为 DOM，而是直接忽略）。需要转义使其可见。
//
function protectNonHtmlTags(markdown: string): string {
  // 标准 HTML 标签白名单（不转义——这些在无 rehypeRaw 时也会被忽略，但不影响）
  const HTML_TAGS = new Set([
    'a','abbr','address','area','article','aside','audio','b','bdi','bdo','blockquote',
    'br','button','canvas','caption','cite','code','col','colgroup','data','datalist',
    'dd','del','details','dfn','dialog','div','dl','dt','em','embed','fieldset',
    'figcaption','figure','footer','form','h1','h2','h3','h4','h5','h6','header',
    'hr','i','iframe','img','input','ins','kbd','label','legend','li','link',
    'main','map','mark','menu','meta','meter','nav','noscript','object','ol',
    'optgroup','option','output','p','picture','pre','progress','q','rp','rt',
    'ruby','s','samp','script','section','select','small','source','span','strong',
    'style','sub','summary','sup','table','tbody','td','template','textarea','tfoot',
    'th','thead','time','title','tr','track','u','ul','var','video','wbr',
  ]);

  // 逐行处理：跳过代码围栏内的内容
  const lines = markdown.split('\n');
  const result: string[] = [];
  let inFence = false;
  let fenceMarker = '';

  for (const line of lines) {
    if (!inFence) {
      const openMatch = line.match(/^(`{3,})(\w*.*)$/);
      if (openMatch) {
        inFence = true;
        fenceMarker = openMatch[1];
        result.push(line);
      } else {
        // 代码块外：转义非标准 HTML 标签，防止被 remark 静默丢弃
        result.push(line.replace(/<(\/?)([a-zA-Z][a-zA-Z0-9_-]*)((?:\s[^>]*)?)>/g, (match, slash, tag, attrs) => {
          const lower = tag.toLowerCase();
          if (HTML_TAGS.has(lower)) return match;
          return match.replace(/</g, '&lt;').replace(/>/g, '&gt;');
        }));
      }
    } else {
      if (line.trimEnd() === fenceMarker) {
        inFence = false;
        fenceMarker = '';
      }
      result.push(line); // 代码块内：原样保留
    }
  }
  return result.join('\n');
}


/**
 * 流式场景的渲染节流 hook
 *
 * streaming=true 时，以固定间隔批量更新，从 ~60fps 降至 ~12fps ReactMarkdown 解析。
 * streaming=false 时直接透传（零开销）。
 */
function useThrottledContent(content: string, streaming?: boolean): string {
  const [throttled, setThrottled] = useState(content);
  const latestRef = useRef(content);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastUpdateRef = useRef(0);

  latestRef.current = content;

  useEffect(() => {
    if (!streaming) {
      setThrottled(content);
      return;
    }

    const now = Date.now();
    const elapsed = now - lastUpdateRef.current;

    if (elapsed >= STREAM_THROTTLE_MS) {
      lastUpdateRef.current = now;
      setThrottled(content);
    } else if (!timerRef.current) {
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        lastUpdateRef.current = Date.now();
        setThrottled(latestRef.current);
      }, STREAM_THROTTLE_MS - elapsed);
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [content, streaming]);

  // 流式结束时，确保最终内容完整同步
  useEffect(() => {
    if (!streaming) {
      setThrottled(latestRef.current);
    }
  }, [streaming]);

  return streaming ? throttled : content;
}

/**
 * SafeMarkdown 组件（v3 - 流式性能优化版）
 *
 * v3 改进：
 * 1. streaming 模式下节流渲染，~80ms 更新一次 ReactMarkdown（而非每 rAF 帧）
 * 2. 代码块在流式输出时跳过 Prism 高亮 + 语言检测，结束后再高亮
 * 3. markdownComponents 引用完全稳定（streaming flag 通过 ref 传入）
 * 4. 保留 v2 全部功能：Mermaid / Callout / 锚点 / 表格增强
 */
export const SafeMarkdown = memo(function SafeMarkdown({
  children,
  className = "",
  streaming = false,
}: SafeMarkdownProps) {
  // 节流后的内容
  const displayContent = useThrottledContent(children, streaming);

  const processedContent = useMemo(() => {
    let content = smartFixLatex(displayContent || "");
    // ★ 转义代码块外的非标准 XML 标签（<replace>, <search> 等 AI 格式标签）
    // 无 rehypeRaw 时这些标签会被 remark 静默忽略，需要转义使其可见
    content = protectNonHtmlTags(content);
    return content;
  }, [displayContent]);

  const hasMermaid = useMemo(() => /```mermaid/i.test(processedContent), [processedContent]);

  // 用 ref 传递 streaming 状态，避免 markdownComponents 因 streaming 变化而重建
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;

  const markdownComponents = useMemo(() => ({
    p({ node, children, ...props }: any) {
      return (
        <div
          className="markdown-paragraph whitespace-pre-wrap break-words max-w-full overflow-wrap-anywhere"
          style={{ wordBreak: "break-word" }}
          {...props}
        >
          {children}
        </div>
      );
    },
    strong({ node, children, ...props }: any) {
      return <strong className="font-bold" {...props}>{children}</strong>;
    },
    em({ node, children, ...props }: any) {
      return <em className="italic" {...props}>{children}</em>;
    },
    code({ node, className, children, ...props }: any) {
      const inline = !className;
      const match = /language-(\w+)/.exec(className || "");
      let language = match ? match[1] : "";
      // 防御性：children 可能为 undefined/null/数组/React 元素，确保转为字符串
      const rawChildren = Array.isArray(children) ? children.join('') : (children ?? '');
      let codeContent = String(rawChildren).replace(/\n$/, "");

      // ★ 回退：如果 children 为空但 HAST node 有文本内容，从 node 提取
      // ReactMarkdown 某些版本在处理含 HTML 标签的 code 块时可能丢失 children
      if (!codeContent && node?.children) {
        const nodeText = node.children
          .map((c: any) => {
            if (c.type === 'text') return c.value || '';
            if (c.type === 'element' && c.children) {
              return c.children.map((gc: any) => gc.value || '').join('');
            }
            return '';
          })
          .join('');
        if (nodeText) {
          codeContent = nodeText.replace(/\n$/, "");
          console.log('[SafeMarkdown] Recovered code from node:', language, codeContent.length, 'chars');
        }
      }

      // ★ 最后回退：如果仍为空，尝试从 node.data / node.properties 中提取
      if (!codeContent && node?.data?.meta) {
        codeContent = String(node.data.meta);
      }

      // DEBUG: 帮助定位空代码块问题
      if (!codeContent && language) {
        console.warn('[SafeMarkdown] Empty code block!', { language, childrenType: typeof children, childrenLen: rawChildren.length, nodeChildCount: node?.children?.length });
      }

      // Mermaid：流式中跳过渲染，等结束后再画
      if (language === 'mermaid' && !streamingRef.current) {
        return (
          <Suspense fallback={
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              加载图表组件...
            </div>
          }>
            <MermaidBlock code={codeContent} />
          </Suspense>
        );
      }

      // 流式中跳过语言检测（正则开销大且内容不完整，检测不准确）
      if ((!language || language === "text") && !streamingRef.current) {
        const detectedLang = detectLanguage(codeContent);
        if (detectedLang) language = detectedLang;
      }

      const highlightMatch = /language-\w+\{([\d,-]+)\}/.exec(className || "");
      const highlightLines = highlightMatch ? highlightMatch[1] : undefined;

      return !inline ? (
        <CodeBlock
          language={language}
          highlightLines={highlightLines}
          streaming={streamingRef.current}
        >
          {codeContent}
        </CodeBlock>
      ) : (
        <code className={`${className || ''} bg-amber-100/70 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded text-[0.875em] font-mono border border-amber-200/50 dark:border-amber-800/30`} {...props}>
          {children}
        </code>
      );
    },

    h1({ node, children, ...props }: any) {
      const text = extractText(children);
      const id = headingToId(text);
      return <h1 id={id} data-toc-id={id} className="text-2xl font-bold mt-6 mb-3 scroll-mt-4 toc-heading" {...props}>{children}</h1>;
    },
    h2({ node, children, ...props }: any) {
      const text = extractText(children);
      const id = headingToId(text);
      return <h2 id={id} data-toc-id={id} className="text-xl font-bold mt-5 mb-2 scroll-mt-4 toc-heading" {...props}>{children}</h2>;
    },
    h3({ node, children, ...props }: any) {
      const text = extractText(children);
      const id = headingToId(text);
      return <h3 id={id} data-toc-id={id} className="text-lg font-semibold mt-4 mb-2 scroll-mt-4 toc-heading" {...props}>{children}</h3>;
    },
    h4({ node, children, ...props }: any) {
      const text = extractText(children);
      const id = headingToId(text);
      return <h4 id={id} data-toc-id={id} className="text-base font-semibold mt-3 mb-1.5 scroll-mt-4" {...props}>{children}</h4>;
    },

    ul({ node, children, ...props }: any) {
      return <ul className="list-disc pl-6 my-2 space-y-1" {...props}>{children}</ul>;
    },
    ol({ node, children, ...props }: any) {
      return <ol className="list-decimal pl-6 my-2 space-y-1" {...props}>{children}</ol>;
    },
    li({ node, children, ...props }: any) {
      return <li className="leading-relaxed" {...props}>{children}</li>;
    },

    table({ node, children, ...props }: any) {
      return (
        <div className="table-scroll-wrapper relative overflow-x-auto my-4 rounded-lg border border-border">
          <div className="md:hidden absolute right-0 top-0 bottom-0 w-8 pointer-events-none bg-gradient-to-l from-background to-transparent z-10 table-scroll-hint" />
          <table className="min-w-full border-collapse text-sm" {...props}>
            {children}
          </table>
        </div>
      );
    },
    thead({ node, children, ...props }: any) {
      return <thead className="bg-muted" {...props}>{children}</thead>;
    },
    th({ node, children, ...props }: any) {
      return <th className="px-3 py-2 font-semibold text-left whitespace-nowrap border-b border-border" {...props}>{children}</th>;
    },
    td({ node, children, ...props }: any) {
      return <td className="px-3 py-2 border-t border-border" {...props}>{children}</td>;
    },
    tr({ node, children, ...props }: any) {
      return <tr className="hover:bg-muted/40 transition-colors" {...props}>{children}</tr>;
    },

    blockquote({ node, children, ...props }: any) {
      const childText = extractText(children);
      const calloutMatch = childText.match(/^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i);

      if (calloutMatch) {
        const type = calloutMatch[1].toUpperCase();
        const callout = CALLOUT_TYPES[type];
        if (callout) {
          return (
            <div className={`callout-block my-3 rounded-lg border-l-4 p-3 ${callout.colors}`} {...props}>
              <div className="flex items-center gap-2 font-semibold text-sm mb-1">
                <span>{callout.icon}</span>
                <span>{callout.label}</span>
              </div>
              <div className="text-sm callout-content [&>div:first-child]:mt-0">
                {children}
              </div>
            </div>
          );
        }
      }

      return (
        <blockquote className="border-l-4 border-primary/40 pl-4 my-3 text-muted-foreground italic" {...props}>
          {children}
        </blockquote>
      );
    },

    a({ node, children, href, ...props }: any) {
      return (
        <a
          href={href}
          className="text-primary underline underline-offset-2 hover:text-primary/80"
          target="_blank"
          rel="noopener noreferrer"
          {...props}
        >
          {children}
        </a>
      );
    },

    hr({ node, ...props }: any) {
      return <hr className="my-4 border-border" {...props} />;
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [hasMermaid]);

  return (
    <div className={`markdown-content ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});
