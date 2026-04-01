/**
 * HighlightedCode.tsx — Shiki 高亮代码组件
 *
 * 统一封装 Shiki WASM 高亮引擎，覆盖：
 * - CodeBlock.tsx（聊天消息代码块）
 * - CanvasEditor.tsx（Artifact 代码编辑器）
 * - sandboxPanel/CodeEditor.tsx（PlainCodeView 回退）
 *
 * 特性：
 * - Shiki 未就绪时使用 fallback（传入的 fallbackHtml 或纯 escapeHtml）
 * - 异步高亮完成后平滑切换（opacity 过渡）
 * - 缓存：相同 code+lang 不重复高亮
 */

import { useState, useEffect, useRef, memo } from 'react';
import { highlightCode, normalizeLang, preloadShiki } from '@/lib/shikiHighlighter';

interface HighlightedCodeProps {
  code: string;
  language: string;
  /** 外部提供的 fallback HTML（如 Prism/tokenize 输出） */
  fallbackHtml?: string;
  /** 是否为流式模式（流式时不触发 Shiki） */
  streaming?: boolean;
  /** 自定义 class */
  className?: string;
  /** 自定义 style */
  style?: React.CSSProperties;
}

// 简单 HTML 转义
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// 高亮结果缓存（LRU-ish，最多 50 条）
const highlightCache = new Map<string, string>();
const MAX_CACHE = 50;

function getCacheKey(code: string, lang: string): string {
  // 用 djb2 hash + 长度 + 语言做 key，避免碰撞
  let hash = 5381;
  for (let i = 0; i < code.length; i++) {
    hash = ((hash << 5) + hash + code.charCodeAt(i)) & 0x7fffffff;
  }
  return `${lang}:${code.length}:${hash}`;
}

// 启动时预热
if (typeof window !== 'undefined') {
  preloadShiki();
}

export const HighlightedCode = memo(function HighlightedCode({
  code,
  language,
  fallbackHtml,
  streaming = false,
  className,
  style,
}: HighlightedCodeProps) {
  const [shikiHtml, setShikiHtml] = useState<string | null>(null);
  const lastCodeRef = useRef('');
  const lastLangRef = useRef('');

  const normalized = normalizeLang(language);

  useEffect(() => {
    // 流式中不触发 Shiki
    if (streaming) return;
    // plaintext 不需要高亮
    if (normalized === 'plaintext') return;
    // 相同内容不重复高亮
    if (code === lastCodeRef.current && normalized === lastLangRef.current && shikiHtml) return;

    lastCodeRef.current = code;
    lastLangRef.current = normalized;

    // 检查缓存
    const cacheKey = getCacheKey(code, normalized);
    const cached = highlightCache.get(cacheKey);
    if (cached) {
      setShikiHtml(cached);
      return;
    }

    let cancelled = false;

    highlightCode(code, normalized).then(({ html, fromShiki }) => {
      if (cancelled) return;
      if (fromShiki && html) {
        // 写入缓存
        if (highlightCache.size >= MAX_CACHE) {
          const firstKey = highlightCache.keys().next().value;
          if (firstKey) highlightCache.delete(firstKey);
        }
        highlightCache.set(cacheKey, html);
        setShikiHtml(html);
      }
    });

    return () => { cancelled = true; };
  }, [code, normalized, streaming]);

  // 最终渲染的 HTML
  const displayHtml = shikiHtml || fallbackHtml || escapeHtml(code);

  return (
    <code
      className={className}
      style={{
        ...style,
        transition: streaming ? 'none' : 'opacity 0.15s ease-in-out',
      }}
      dangerouslySetInnerHTML={{ __html: displayHtml }}
    />
  );
});

/**
 * 仅返回高亮 HTML 字符串（用于 CanvasEditor / PlainCodeView 等需要 dangerouslySetInnerHTML 的场景）
 */
export function useShikiHighlight(code: string, language: string, fallbackHtml: string, streaming?: boolean): string {
  const [html, setHtml] = useState(fallbackHtml);
  const lastRef = useRef({ code: '', lang: '' });

  const normalized = normalizeLang(language);

  useEffect(() => {
    if (streaming || normalized === 'plaintext') {
      setHtml(fallbackHtml);
      return;
    }

    // ★ 立即显示 fallback（避免 Shiki 异步期间显示旧内容）
    const isNewContent = code !== lastRef.current.code || normalized !== lastRef.current.lang;
    if (isNewContent) {
      setHtml(fallbackHtml);
    }
    lastRef.current = { code, lang: normalized };

    const cacheKey = getCacheKey(code, normalized);
    const cached = highlightCache.get(cacheKey);
    if (cached) {
      setHtml(cached);
      return;
    }

    let cancelled = false;
    highlightCode(code, normalized).then(({ html: h, fromShiki }) => {
      if (cancelled) return;
      if (fromShiki && h) {
        if (highlightCache.size >= MAX_CACHE) {
          const firstKey = highlightCache.keys().next().value;
          if (firstKey) highlightCache.delete(firstKey);
        }
        highlightCache.set(cacheKey, h);
        setHtml(h);
      }
    });

    return () => { cancelled = true; };
  }, [code, normalized, fallbackHtml, streaming]);

  return html;
}
