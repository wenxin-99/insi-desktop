import { useState, useEffect, useRef, memo } from 'react';
import { Copy, Check, Maximize2, Minimize2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { sanitizeSvg } from '@/lib/sanitizeHtml';

interface MermaidBlockProps {
  code: string;
}

/**
 * Mermaid 图表渲染组件
 * 
 * 支持流程图(flowchart)、时序图(sequenceDiagram)、类图(classDiagram)、
 * 甘特图(gantt)、饼图(pie)、ER图(erDiagram)、状态图(stateDiagram) 等。
 * 
 * 特性：
 * - 延迟加载 mermaid 库（~200KB），不影响首屏
 * - 渲染失败时显示源代码 fallback
 * - 支持展开/收起和复制源代码
 * - 深色模式自适应
 */
export const MermaidBlock = memo(function MermaidBlock({ code }: MermaidBlockProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const renderIdRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const currentRenderId = ++renderIdRef.current;

    async function renderMermaid() {
      try {
        setIsLoading(true);
        setError(null);

        // 动态导入 mermaid（首次使用时才加载）
        const mermaid = (await import('mermaid')).default;
        
        // 检测深色模式
        const isDark = document.documentElement.classList.contains('dark');
        
        mermaid.initialize({
          startOnLoad: false,
          theme: isDark ? 'dark' : 'default',
          securityLevel: 'strict',
          fontFamily: 'ui-sans-serif, system-ui, sans-serif',
          flowchart: { 
            useMaxWidth: true,
            htmlLabels: true,
            curve: 'basis'
          },
          sequence: { useMaxWidth: true },
          gantt: { useMaxWidth: true },
        });

        if (cancelled || currentRenderId !== renderIdRef.current) return;

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        const { svg } = await mermaid.render(id, code.trim());
        
        if (cancelled || currentRenderId !== renderIdRef.current) return;
        
        setSvgContent(svg);
        setIsLoading(false);
      } catch (err: any) {
        if (cancelled || currentRenderId !== renderIdRef.current) return;
        console.warn('[MermaidBlock] Render failed:', err.message);
        setError(err.message || '图表渲染失败');
        setIsLoading(false);
      }
    }

    renderMermaid();
    return () => { cancelled = true; };
  }, [code]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  // 渲染失败时的 fallback：显示源代码
  if (error) {
    return (
      <div className="my-3 rounded-lg border border-yellow-200 dark:border-yellow-800 bg-yellow-50 dark:bg-yellow-900/20 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 bg-yellow-100 dark:bg-yellow-900/30 text-sm">
          <span className="text-yellow-700 dark:text-yellow-400">⚠️ Mermaid 图表渲染失败</span>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
        <pre className="p-3 text-xs overflow-x-auto text-yellow-800 dark:text-yellow-200">
          <code>{code}</code>
        </pre>
      </div>
    );
  }

  return (
    <div className="my-3 rounded-lg border border-border bg-muted/30 overflow-hidden">
      {/* 头部栏 */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
          </svg>
          <span>Mermaid 图表</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => setIsExpanded(!isExpanded)}>
            {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={handleCopy}>
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
          </Button>
        </div>
      </div>

      {/* 图表内容 */}
      <div 
        ref={containerRef}
        className={`flex items-center justify-center overflow-auto bg-white dark:bg-gray-900 transition-all ${
          isExpanded ? 'max-h-none p-6' : 'max-h-[500px] p-4'
        }`}
      >
        {isLoading ? (
          <div className="flex items-center gap-2 py-8 text-muted-foreground">
            <div className="animate-spin w-4 h-4 border-2 border-primary border-t-transparent rounded-full" />
            <span className="text-sm">正在渲染图表...</span>
          </div>
        ) : svgContent ? (
          <div 
            className="mermaid-svg w-full [&>svg]:mx-auto [&>svg]:max-w-full"
            dangerouslySetInnerHTML={{ __html: sanitizeSvg(svgContent) }} 
          />
        ) : null}
      </div>
    </div>
  );
});
