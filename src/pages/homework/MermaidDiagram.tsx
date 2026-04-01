import { useState, useEffect, useRef } from "react";
import mermaid from "mermaid";
import { sanitizeSvg } from '@/lib/sanitizeHtml';

/**
 * 清理 mermaid 代码：移除代码块标记、修复常见语法问题
 */
function cleanMermaidChart(raw: string): string {
  let code = raw.trim();
  // 移除 ```mermaid ... ``` 包裹
  if (code.startsWith('```mermaid')) {
    code = code.replace(/^```mermaid\n?/, '').replace(/```\s*$/, '').trim();
  } else if (code.startsWith('```')) {
    code = code.replace(/^```\n?/, '').replace(/```\s*$/, '').trim();
  }

  // 修复 mindmap 节点中含有破坏语法的特殊字符
  // mermaid mindmap 节点文本中 () [] {} 必须配对，否则会 Syntax Error
  const lines = code.split('\n');
  const isMinmap = lines[0]?.trim() === 'mindmap';
  if (isMinmap) {
    const fixedLines = lines.map((line, idx) => {
      if (idx === 0) return line; // 保留 "mindmap" 声明行
      // 保留 root((...)) 格式
      if (/^\s*root\(\(/.test(line)) return line;

      // 对普通节点行：将未配对的特殊括号替换为全角字符，避免 mermaid 解析错误
      const indent = line.match(/^(\s*)/)?.[1] || '';
      let text = line.slice(indent.length);
      // 如果已经是合法的括号包裹（如 [text] 或 (text)），保留
      if (/^\[.*\]$/.test(text) || /^\(.*\)$/.test(text) || /^\{.*\}$/.test(text)) {
        return line;
      }
      // 替换节点文本中零散的特殊字符
      text = text.replace(/\(/g, '（').replace(/\)/g, '）');
      text = text.replace(/\[/g, '【').replace(/\]/g, '】');
      text = text.replace(/\{/g, '｛').replace(/\}/g, '｝');
      return indent + text;
    });
    code = fixedLines.join('\n');
  }
  return code;
}

/**
 * 将 mermaid mindmap 语法转成简单的树形文本（渲染失败时的 fallback）
 */
function mindmapToText(code: string): string {
  const lines = code.split('\n');
  const result: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === 'mindmap') continue;
    // 提取缩进层级
    const indent = line.search(/\S/);
    const level = Math.floor(indent / 2);
    // 清理括号标记
    let text = trimmed
      .replace(/^root\(\((.+)\)\)$/, '$1')
      .replace(/^\[(.+)\]$/, '$1')
      .replace(/^\((.+)\)$/, '$1')
      .replace(/^\(\((.+)\)\)$/, '$1');
    const prefix = level === 0 ? '📖 ' : level <= 2 ? '◆ ' : '• ';
    result.push(`${'  '.repeat(level)}${prefix}${text}`);
  }
  return result.join('\n');
}

export function MermaidDiagram({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!chart || !ref.current) return;

    let cancelled = false;

    mermaid.initialize({ 
      startOnLoad: false,
      theme: 'default',
      // IMPORTANT: Mermaid output is injected into DOM. Use strict mode to mitigate XSS.
      securityLevel: 'strict',
    });

    const renderDiagram = async () => {
      try {
        setError(null);
        const cleanedChart = cleanMermaidChart(chart);
        
        const id = `mermaid-${Math.random().toString(36).substr(2, 9)}`;
        const { svg } = await mermaid.render(id, cleanedChart);

        if (cancelled) return;

        // Extra hardening: strip obvious script/event-handler vectors
        const hardenedSvg = svg
          .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
          .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
          .replace(/\son\w+\s*=\s*'[^']*'/gi, '');

        // 检测 mermaid 是否返回了错误 SVG（某些版本不 throw 而是渲染错误图）
        if (hardenedSvg.includes('Syntax error') || hardenedSvg.includes('Parse error')) {
          setError('思维导图语法解析失败');
          setSvg('');
        } else {
          setSvg(hardenedSvg);
        }
      } catch (err: any) {
        if (cancelled) return;
        console.error('Mermaid render error:', err);
        setError(err?.message || '思维导图渲染失败');
        setSvg('');
      }
    };

    renderDiagram();
    return () => { cancelled = true; };
  }, [chart]);

  // 渲染失败时显示树形文本 fallback
  if (error) {
    return (
      <div className="mermaid-container p-4 bg-muted/30 rounded-lg overflow-auto">
        <div className="text-sm text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
          <span>⚠️</span>
          <span>思维导图图形渲染失败，以文本形式展示：</span>
        </div>
        <pre className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80 font-sans">
          {mindmapToText(chart)}
        </pre>
      </div>
    );
  }

  return (
    <div 
      ref={ref} 
      className="mermaid-container flex justify-center items-center p-4 bg-muted/30 rounded-lg overflow-auto"
      dangerouslySetInnerHTML={{ __html: sanitizeSvg(svg) }}
    />
  );
}
