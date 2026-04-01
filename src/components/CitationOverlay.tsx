/**
 * CitationOverlay — 内联引用角标渲染器
 *
 * 在已渲染的 Markdown 内容中，将 [1] [2] 等文本替换为可交互的蓝色上标角标。
 * Hover 显示来源标题和域名，点击跳转。
 *
 * 用法：
 *   <div ref={containerRef}>
 *     <SafeMarkdown>...</SafeMarkdown>
 *   </div>
 *   <CitationOverlay containerRef={containerRef} sources={webSearchSources} />
 */

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface Source {
  title: string;
  url: string;
}

interface CitationOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  sources: Source[];
}

function getDomain(url: string) {
  try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

export function CitationOverlay({ containerRef, sources }: CitationOverlayProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; source: Source; index: number } | null>(null);
  const processedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || !sources || sources.length === 0) return;
    // 防止重复处理
    if (processedRef.current) return;
    processedRef.current = true;

    // 使用 TreeWalker 遍历所有文本节点
    const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT, null);
    const textNodes: Text[] = [];
    let node: Node | null;
    while ((node = walker.nextNode())) {
      if (node.textContent && /\[\d{1,2}\]/.test(node.textContent)) {
        textNodes.push(node as Text);
      }
    }

    // 替换文本节点中的 [N] 为 <span> 角标
    for (const textNode of textNodes) {
      const text = textNode.textContent || '';
      const parts = text.split(/(\[\d{1,2}\])/g);
      if (parts.length <= 1) continue;

      const fragment = document.createDocumentFragment();
      for (const part of parts) {
        const match = part.match(/^\[(\d{1,2})\]$/);
        if (match) {
          const idx = parseInt(match[1]) - 1; // 1-based → 0-based
          const source = sources[idx];
          if (source) {
            const badge = document.createElement('a');
            badge.href = source.url;
            badge.target = '_blank';
            badge.rel = 'noopener noreferrer';
            badge.className = 'citation-badge';
            badge.setAttribute('data-cite-index', String(idx));
            badge.textContent = match[1];
            badge.title = `${source.title}\n${getDomain(source.url)}`;
            fragment.appendChild(badge);
          } else {
            fragment.appendChild(document.createTextNode(part));
          }
        } else {
          fragment.appendChild(document.createTextNode(part));
        }
      }
      textNode.parentNode?.replaceChild(fragment, textNode);
    }
  }, [containerRef, sources]);

  // 重置处理标记（源或内容变化时）
  useEffect(() => {
    processedRef.current = false;
  }, [sources]);

  return null;
}

/**
 * 全局 CSS 样式（需在 App 层注入一次或内联）
 */
export const citationStyles = `
.citation-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.1em;
  height: 1.1em;
  padding: 0 0.2em;
  margin: 0 0.1em;
  font-size: 0.7em;
  font-weight: 600;
  line-height: 1;
  color: rgb(59, 130, 246);
  background: rgba(59, 130, 246, 0.08);
  border: 1px solid rgba(59, 130, 246, 0.2);
  border-radius: 0.3em;
  text-decoration: none;
  vertical-align: super;
  cursor: pointer;
  transition: all 0.15s ease;
  font-feature-settings: "tnum";
}
.citation-badge:hover {
  background: rgba(59, 130, 246, 0.18);
  border-color: rgba(59, 130, 246, 0.4);
  color: rgb(37, 99, 235);
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(59, 130, 246, 0.15);
}
.dark .citation-badge {
  color: rgb(147, 197, 253);
  background: rgba(59, 130, 246, 0.12);
  border-color: rgba(59, 130, 246, 0.25);
}
.dark .citation-badge:hover {
  background: rgba(59, 130, 246, 0.25);
  border-color: rgba(59, 130, 246, 0.45);
  color: rgb(191, 219, 254);
}
`;
