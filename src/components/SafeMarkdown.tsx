import { useMemo, memo, lazy, Suspense, useRef } from "react";
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

// SVG 内联渲染组件懒加载（仅当检测到 ```svg 代码块时加载）
const InlineSVGBlock = lazy(() => import("@/components/InlineSVGBlock").then(m => ({ default: m.InlineSVGBlock })));

// InsightCard 富文本卡片懒加载（仅当检测到 ```insight-card 代码块时加载）
const InsightCard = lazy(() => import("@/components/InsightCard").then(m => ({ default: m.InsightCard })));

// ChartBlock 数据可视化懒加载（仅当检测到 ```chart 代码块时加载）
const ChartBlock = lazy(() => import("@/components/ChartBlock").then(m => ({ default: m.ChartBlock })));

// MindMapBlock 思维导图懒加载（仅当检测到 ```mindmap 代码块时加载）
const MindMapBlock = lazy(() => import("@/components/MindMapBlock").then(m => ({ default: m.MindMapBlock })));

// TimelineBlock 时间轴懒加载（仅当检测到 ```timeline 代码块时加载）
const TimelineBlock = lazy(() => import("@/components/TimelineBlock").then(m => ({ default: m.TimelineBlock })));

// KanbanBlock 看板懒加载（仅当检测到 ```kanban 代码块时加载）
const KanbanBlock = lazy(() => import("@/components/KanbanBlock").then(m => ({ default: m.KanbanBlock })));

// TabsBlock 标签页懒加载（仅当检测到 ```tabs 代码块时加载）
const TabsBlock = lazy(() => import("@/components/TabsBlock").then(m => ({ default: m.TabsBlock })));

// DiffBlock 对比视图懒加载（仅当检测到 ```diff 代码块时加载）
const DiffBlock = lazy(() => import("@/components/DiffBlock").then(m => ({ default: m.DiffBlock })));

// QuizBlock 互动测验懒加载（仅当检测到 ```quiz 代码块时加载）
const QuizBlock = lazy(() => import("@/components/QuizBlock").then(m => ({ default: m.QuizBlock })));

// SlideBlock 幻灯片懒加载（仅当检测到 ```slide 代码块时加载）
const SlideBlock = lazy(() => import("@/components/SlideBlock").then(m => ({ default: m.SlideBlock })));

// ComparisonBlock 对比表格懒加载（仅当检测到 ```comparison 代码块时加载）
const ComparisonBlock = lazy(() => import("@/components/ComparisonBlock").then(m => ({ default: m.ComparisonBlock })));

// LiveDataCard 实时数据卡片懒加载（仅当检测到 ```live-data 代码块时加载）
const LiveDataCard = lazy(() => import("@/components/LiveDataCard").then(m => ({ default: m.LiveDataCard })));

// CodePlayground 代码沙箱懒加载（仅当检测到 ```playground 代码块时加载）
const CodePlayground = lazy(() => import("@/components/CodePlayground").then(m => ({ default: m.CodePlayground })));

// CitationCard 引用来源卡片懒加载（仅当检测到 ```citations 代码块时加载）
const CitationCard = lazy(() => import("@/components/CitationCard").then(m => ({ default: m.CitationCard })));

// MathBlock 数学推导懒加载（仅当检测到 ```math-steps 代码块时加载）
const MathBlock = lazy(() => import("@/components/MathBlock").then(m => ({ default: m.MathBlock })));

// ProgressTracker 进度追踪懒加载（仅当检测到 ```progress 代码块时加载）
const ProgressTracker = lazy(() => import("@/components/ProgressTracker").then(m => ({ default: m.ProgressTracker })));

// DecisionCard 决策助手懒加载（仅当检测到 ```decision 代码块时加载）
const DecisionCard = lazy(() => import("@/components/DecisionCard").then(m => ({ default: m.DecisionCard })));

// CalendarEvent 日历事件懒加载（仅当检测到 ```calendar 代码块时加载）
const CalendarEvent = lazy(() => import("@/components/CalendarEvent").then(m => ({ default: m.CalendarEvent })));

// MapBlock 地图标注懒加载（仅当检测到 ```map 代码块时加载）
const MapBlock = lazy(() => import("@/components/MapBlock").then(m => ({ default: m.MapBlock })));

// FilePreviewCard 文件预览卡片懒加载（仅当检测到 ```file-preview 代码块时加载）
const FilePreviewCard = lazy(() => import("@/components/FilePreviewCard").then(m => ({ default: m.FilePreviewCard })));

// TranslationCard 双语对照翻译卡片懒加载（仅当检测到 ```translation 代码块时加载）
const TranslationCard = lazy(() => import("@/components/TranslationCard").then(m => ({ default: m.TranslationCard })));

// SmartTable 自动检测表格类型并升级渲染（对比表→卡片，指标表→网格）
import { SmartTable } from "@/components/SmartTable";
import { CitationSup, parseCitationText } from "@/components/CitationTooltip";
import type { CitationSource } from "@/components/CitationTooltip";

interface SafeMarkdownProps {
  children: string;
  className?: string;
  /** 流式输出中：启用渲染节流，跳过代码高亮 */
  streaming?: boolean;
  /** P0-3: 搜索来源列表，用于内联引用 [1][2] 渲染 */
  webSearchSources?: CitationSource[];
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
 * ★ 优化①: 流式模式下不再二次节流，直接透传 useChatStream 的 33ms 提交。
 * 原来 useChatStream(50ms) + SafeMarkdown(80-200ms) 双重节流导致感知延迟 130-250ms。
 * 现在单层 33ms，感知延迟 <50ms，接近 ChatGPT/Claude 水平。
 * 
 * 非流式模式仍然直接透传（零开销）。
 */
function useThrottledContent(content: string, streaming?: boolean): string {
  // ★ 优化①: 流式和非流式都直接透传，节流完全交给 useChatStream 一层处理
  return content;
}

/**
 * SafeMarkdown 组件（v3 - 流式性能优化版）
 *
 * v3→v4 改进：
 * 1. 流式节流改为单层：useChatStream 33ms 提交，SafeMarkdown 直接透传（消除双重延迟）
 * 2. 代码块在流式输出时跳过语法高亮 + 语言检测，结束后再高亮
 * 3. markdownComponents 引用完全稳定（streaming flag 通过 ref 传入）
 * 4. 保留 v2 全部功能：Mermaid / Callout / 锚点 / 表格增强
 */
/**
 * P0-3: 递归处理 React children，将文本中的 [N] 标记替换为 CitationSup 组件
 */
function processCitationChildren(children: any, sources: CitationSource[]): any {
  if (!children) return children;
  if (typeof children === 'string') {
    const parts = parseCitationText(children, sources);
    if (parts.length === 1 && typeof parts[0] === 'string') return children;
    return parts.map((part, i) => {
      if (typeof part === 'string') return part;
      return <CitationSup key={`cite-${i}-${part.index}`} index={part.index} source={part.source} />;
    });
  }
  if (Array.isArray(children)) {
    return children.flatMap((child: any, i: number) => {
      if (typeof child === 'string') {
        const parts = parseCitationText(child, sources);
        if (parts.length === 1 && typeof parts[0] === 'string') return [child];
        return parts.map((part, j) => {
          if (typeof part === 'string') return part;
          return <CitationSup key={`cite-${i}-${j}-${part.index}`} index={part.index} source={part.source} />;
        });
      }
      return [child];
    });
  }
  return children;
}

export const SafeMarkdown = memo(function SafeMarkdown({
  children,
  className = "",
  streaming = false,
  webSearchSources,
}: SafeMarkdownProps) {
  // 节流后的内容
  const displayContent = useThrottledContent(children, streaming);

  const processedContent = useMemo(() => {
    let content = displayContent || "";

    // ★ 流式中跳过重量级 regex 处理（smartFixLatex 多遍扫描 + protectNonHtmlTags 逐行处理）
    // remark-math 已经能处理标准 $...$ 和 $$...$$ 语法
    // smartFixLatex 只处理 \(...\) 和裸命令等边缘场景，延迟到流式结束后一次性处理
    if (!streaming) {
      content = smartFixLatex(content);
      content = protectNonHtmlTags(content);
    }

    return content;
  }, [displayContent, streaming]);

  const hasMermaid = useMemo(() => /```mermaid/i.test(processedContent), [processedContent]);

  // 用 ref 传递 streaming 状态，避免 markdownComponents 因 streaming 变化而重建
  const streamingRef = useRef(streaming);
  streamingRef.current = streaming;

  // P0-3: 用 ref 传递 webSearchSources，避免 markdownComponents 重建
  const sourcesRef = useRef(webSearchSources);
  sourcesRef.current = webSearchSources;

  const markdownComponents = useMemo(() => ({
    p({ node, children, ...props }: any) {
      // P0-3: 在段落文本中查找 [N] 引用标记，替换为 CitationSup 组件
      const sources = sourcesRef.current;
      const processedChildren = sources?.length
        ? processCitationChildren(children, sources)
        : children;
      return (
        <div
          className="markdown-paragraph whitespace-pre-wrap break-words max-w-full overflow-wrap-anywhere"
          style={{ wordBreak: "break-word" }}
          {...props}
        >
          {processedChildren}
        </div>
      );
    },
    strong({ node, children, ...props }: any) {
      const sources = sourcesRef.current;
      const processed = sources?.length ? processCitationChildren(children, sources) : children;
      return <strong className="font-bold" {...props}>{processed}</strong>;
    },
    em({ node, children, ...props }: any) {
      const sources = sourcesRef.current;
      const processed = sources?.length ? processCitationChildren(children, sources) : children;
      return <em className="italic" {...props}>{processed}</em>;
    },
    code({ node, className, children, ...props }: any) {
      const inline = !className;
      const match = /language-([\w-]+)/.exec(className || "");
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

      // Mermaid：★ 流式中显示骨架+源码预览，完成后自动渲染图表
      if (language === 'mermaid') {
        if (streamingRef.current) {
          // 流式中：显示带源码预览的骨架卡片
          return (
            <div className="my-3 rounded-lg border border-border bg-muted/30 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                  </svg>
                  <span>Mermaid 图表</span>
                  <span className="text-[11px] text-blue-500 font-medium">生成中...</span>
                </div>
              </div>
              <div className="relative">
                <pre className="p-3 text-xs leading-relaxed font-mono text-muted-foreground whitespace-pre overflow-x-auto max-h-[200px]">
                  <code>{codeContent}</code>
                </pre>
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-indigo-300 via-indigo-500 to-indigo-300 animate-pulse" />
                </div>
              </div>
            </div>
          );
        }
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

      // SVG：内联渲染为可视化图形（★ 流式中也渲染，InlineSVGBlock 内部防抖）
      if (language === 'svg' && codeContent.includes('<svg')) {
        return (
          <Suspense fallback={
            <div className="flex items-center gap-2 py-4 text-muted-foreground text-sm">
              <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
              渲染 SVG 图形...
            </div>
          }>
            <InlineSVGBlock code={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // InsightCard：结构化分析卡片（```insight-card + JSON）
      // ★ comparison 类型自动转发到新 ComparisonBlock（兼容旧格式 AI 输出）
      if (language === 'insight-card' && codeContent.includes('{')) {
        // 检测是否是 comparison 类型 → 转换格式后走 ComparisonBlock
        if (/"type"\s*:\s*"comparison"/.test(codeContent)) {
          try {
            const oldData = JSON.parse(codeContent);
            if (oldData.type === 'comparison' && (oldData.rows || oldData.labelA)) {
              // 旧格式 → 新格式转换
              const newJson = JSON.stringify({
                title: oldData.title || `${oldData.labelA} vs ${oldData.labelB}`,
                items: [oldData.labelA || 'A', oldData.labelB || 'B'],
                dimensions: (oldData.rows || []).map((r: any) => ({
                  name: r.dim,
                  values: [r.a, r.b],
                  winner: r.winner === 'a' ? 0 : r.winner === 'b' ? 1 : undefined,
                })),
              });
              return (
                <Suspense fallback={<div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />}>
                  <ComparisonBlock jsonStr={newJson} streaming={streamingRef.current} />
                </Suspense>
              );
            }
          } catch { /* JSON 未完成，走骨架 */ }
        }
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-24" />
          }>
            <InsightCard jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // ChartBlock：数据可视化图表（```chart + JSON）
      if (language === 'chart' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[300px]" />
          }>
            <ChartBlock jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // MindMapBlock：思维导图（```mindmap + 缩进文本）
      if (language === 'mindmap' && codeContent.trim()) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />
          }>
            <MindMapBlock content={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // TimelineBlock：时间轴（```timeline + JSON）
      if (language === 'timeline' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />
          }>
            <TimelineBlock jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // KanbanBlock：看板视图（```kanban + JSON）
      if (language === 'kanban' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[240px]" />
          }>
            <KanbanBlock jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // TabsBlock：标签页切换（```tabs + JSON）
      if (language === 'tabs' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />
          }>
            <TabsBlock jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // DiffBlock：代码/文本对比（```diff + unified diff 内容）
      // ★ 仅当内容包含 +/- 开头行时渲染为 DiffBlock，否则走普通代码高亮
      if (language === 'diff' && /^[+-]/m.test(codeContent)) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[160px]" />
          }>
            <DiffBlock content={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // QuizBlock：互动测验（```quiz + JSON）
      if (language === 'quiz' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[300px]" />
          }>
            <QuizBlock jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // SlideBlock：幻灯片演示（```slide + JSON）
      if (language === 'slide' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse aspect-[16/9]" />
          }>
            <SlideBlock jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // ComparisonBlock：对比表格（```comparison + JSON）
      if (language === 'comparison' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />
          }>
            <ComparisonBlock jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // LiveDataCard：天气/股票/汇率实时数据（```live-data + JSON）
      if (language === 'live-data' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[160px]" />
          }>
            <LiveDataCard jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // CodePlayground：代码沙箱（```playground + JSON）
      if (language === 'playground' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[240px]" />
          }>
            <CodePlayground jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // CitationCard：引用来源（```citations + JSON）
      if (language === 'citations' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />
          }>
            <CitationCard jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // MathBlock：数学推导步骤（```math-steps + JSON）
      if (language === 'math-steps' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[240px]" />
          }>
            <MathBlock jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // ProgressTracker：进度追踪（```progress + JSON）
      if (language === 'progress' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />
          }>
            <ProgressTracker jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // DecisionCard：决策助手（```decision + JSON）
      if (language === 'decision' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />
          }>
            <DecisionCard jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // CalendarEvent：日历事件（```calendar + JSON）
      if (language === 'calendar' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />
          }>
            <CalendarEvent jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // MapBlock：地图标注（```map + JSON）
      if (language === 'map' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[300px]" />
          }>
            <MapBlock jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // FilePreviewCard：文件预览（```file-preview + JSON）
      if (language === 'file-preview' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-3 animate-pulse h-[60px]" />
          }>
            <FilePreviewCard jsonStr={codeContent} streaming={streamingRef.current} />
          </Suspense>
        );
      }

      // TranslationCard：双语对照翻译（```translation + JSON）
      if (language === 'translation' && codeContent.includes('{')) {
        return (
          <Suspense fallback={
            <div className="my-3 rounded-xl border border-border/30 bg-muted/20 p-4 animate-pulse h-[200px]" />
          }>
            <TranslationCard jsonStr={codeContent} streaming={streamingRef.current} />
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
        <code
          className={`${className || ''} bg-amber-100/70 dark:bg-amber-900/30 text-amber-900 dark:text-amber-200 px-1.5 py-0.5 rounded text-[0.875em] font-mono border border-amber-200/50 dark:border-amber-800/30 cursor-pointer hover:bg-amber-200/70 dark:hover:bg-amber-800/40 transition-colors`}
          onClick={() => {
            const text = String(children);
            navigator.clipboard.writeText(text).then(() => {
              // 轻量 toast 提示（避免引入 sonner 依赖）
              const tip = document.createElement('div');
              tip.textContent = '已复制';
              tip.className = 'fixed top-4 left-1/2 -translate-x-1/2 z-[9999] px-3 py-1.5 rounded-lg bg-foreground/90 text-background text-xs font-medium shadow-lg animate-in fade-in slide-in-from-top-2 duration-200';
              document.body.appendChild(tip);
              setTimeout(() => { tip.style.opacity = '0'; tip.style.transition = 'opacity 0.3s'; setTimeout(() => tip.remove(), 300); }, 1200);
            }).catch(() => {});
          }}
          title="点击复制"
          {...props}
        >
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
      // P0-3: 列表项中也可能包含 [N] 引用标记
      const sources = sourcesRef.current;
      const processedChildren = sources?.length
        ? processCitationChildren(children, sources)
        : children;
      return <li className="leading-relaxed" {...props}>{processedChildren}</li>;
    },

    table({ node, children, ...props }: any) {
      return <SmartTable node={node} streaming={streamingRef.current} {...props}>{children}</SmartTable>;
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
      const isExternal = href && (href.startsWith('http://') || href.startsWith('https://'));
      return (
        <a
          href={href}
          className="text-primary underline underline-offset-2 hover:text-primary/80 inline-flex items-baseline gap-0.5"
          target={isExternal ? "_blank" : undefined}
          rel={isExternal ? "noopener noreferrer" : undefined}
          {...props}
        >
          {children}
          {isExternal && (
            <svg className="inline-block w-3 h-3 shrink-0 opacity-40 -translate-y-[1px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          )}
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
        rehypePlugins={[[rehypeKatex, {
          // ★ KaTeX 错误容错：解析失败不 crash，显示原始公式 + 红色提示
          throwOnError: false,
          errorColor: '#ef4444',
          // 严格模式关闭（允许不标准的 LaTeX 语法）
          strict: false,
          // 信任所有 KaTeX 命令（允许 \text, \color 等）
          trust: true,
          // 全局宏定义
          macros: {
            '\\R': '\\mathbb{R}',
            '\\N': '\\mathbb{N}',
            '\\Z': '\\mathbb{Z}',
            '\\Q': '\\mathbb{Q}',
            '\\C': '\\mathbb{C}',
          },
        }]]}
        components={markdownComponents}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
});
