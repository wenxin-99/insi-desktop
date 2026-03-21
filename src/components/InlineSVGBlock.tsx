/**
 * InlineSVGBlock.tsx — 对话内 SVG 内联渲染卡片
 *
 * 在 SafeMarkdown 中检测到 ```svg 代码块时，
 * 用此组件替代 CodeBlock，将 SVG 渲染为可视化图形。
 *
 * 安全策略：
 * - 使用 srcdoc iframe sandbox（无 allow-same-origin）
 * - 禁止 script 执行（纯 SVG 不需要）
 * - 自动适配暗色模式
 *
 * 功能：
 * - 预览/代码 Tab 切换
 * - 全屏查看
 * - 复制 SVG / 下载 SVG
 * - 自适应高度
 */
import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { Eye, Code2, Copy, Check, Download, Maximize2, Minimize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InlineSVGBlockProps {
  code: string;
}

export const InlineSVGBlock = memo(function InlineSVGBlock({ code }: InlineSVGBlockProps) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(280);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  // ★ 唯一实例 ID，防止多个 InlineSVGBlock 的 postMessage 互相干扰
  const instanceId = useRef(`svg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

  // 构建安全的 iframe 文档
  const iframeDoc = useMemo(() => {
    // 清理可能的 XSS：移除 script 标签、event handlers
    const sanitized = code
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');

    const iid = instanceId.current;
    return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { 
    background: transparent; 
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 100%;
  }
  svg { 
    max-width: 100%; 
    height: auto; 
    display: block;
  }
  @media (prefers-color-scheme: dark) {
    svg text { fill: #e5e5e5; }
    svg line, svg path, svg rect, svg circle, svg ellipse { 
      /* 不覆盖有 fill/stroke 的元素 */
    }
  }
</style>
</head>
<body>${sanitized}
<script>
  // 自动计算高度并通知父窗口（携带实例 ID 防止多实例冲突）
  new ResizeObserver(() => {
    const h = document.body.scrollHeight;
    window.parent.postMessage({ type: 'svg-height', id: '${iid}', height: h }, '*');
  }).observe(document.body);
</script>
</body></html>`;
  }, [code]);

  // 监听 iframe 高度消息（仅响应自己实例的 ID）
  useEffect(() => {
    const iid = instanceId.current;
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'svg-height' && e.data.id === iid && typeof e.data.height === 'number') {
        setHeight(Math.min(Math.max(e.data.height + 16, 100), 800));
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('SVG 已复制');
    } catch { toast.error('复制失败'); }
  }, [code]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([code], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'diagram.svg';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('SVG 已下载');
  }, [code]);

  // 提取 SVG 的 viewBox 判断尺寸信息
  const svgInfo = useMemo(() => {
    const vbMatch = code.match(/viewBox=["']([\d.\s-]+)["']/);
    if (vbMatch) {
      const parts = vbMatch[1].trim().split(/\s+/).map(Number);
      if (parts.length === 4) return { w: parts[2], h: parts[3] };
    }
    return null;
  }, [code]);

  const lines = code.split('\n').length;

  const cardClass = fullscreen
    ? 'fixed inset-0 sm:inset-4 z-[60] bg-card sm:border sm:border-border sm:rounded-2xl shadow-2xl flex flex-col'
    : 'my-3 border border-border rounded-xl overflow-hidden bg-card shadow-sm flex flex-col';

  return (
    <>
      {fullscreen && (
        <div
          className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm"
          onClick={() => setFullscreen(false)}
        />
      )}
      <div className={cardClass}>
        {/* 头部 */}
        <div className="flex items-center justify-between px-3 py-2 bg-muted/50 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded-md bg-primary/10 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-primary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
              </svg>
            </div>
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-foreground">SVG 图形</span>
              <span className="text-[11px] text-muted-foreground">
                {lines} 行{svgInfo ? ` · ${svgInfo.w}×${svgInfo.h}` : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            {/* 预览/代码 切换 */}
            <div className="flex bg-muted rounded-lg p-0.5 mr-1">
              {(['preview', 'code'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all',
                    tab === t
                      ? 'bg-background shadow-sm text-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  {t === 'preview' ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
                  <span className="hidden sm:inline">{t === 'preview' ? '预览' : '代码'}</span>
                </button>
              ))}
            </div>

            {/* 操作按钮 */}
            <button
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              onClick={handleCopy}
              title="复制 SVG"
            >
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-muted-foreground" />}
            </button>
            <button
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              onClick={handleDownload}
              title="下载 SVG"
            >
              <Download className="w-3 h-3 text-muted-foreground" />
            </button>
            <button
              className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
              onClick={() => setFullscreen(!fullscreen)}
              title={fullscreen ? '退出全屏' : '全屏'}
            >
              {fullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </button>
            {fullscreen && (
              <button
                className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
                onClick={() => setFullscreen(false)}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* 内容区 */}
        <div className={cn(
          'relative overflow-hidden',
          fullscreen ? 'flex-1' : ''
        )}>
          {tab === 'preview' && (
            <div
              className="flex items-center justify-center bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)] bg-[length:16px_16px] p-4"
              style={{ minHeight: fullscreen ? '100%' : `${height}px` }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={iframeDoc}
                sandbox="allow-scripts"
                className="w-full border-0 bg-transparent"
                style={{ height: fullscreen ? '100%' : `${height}px` }}
                title="SVG Preview"
              />
            </div>
          )}
          {tab === 'code' && (
            <div className="overflow-auto bg-[#1e1e2e] dark:bg-[#0d1117]" style={{ maxHeight: fullscreen ? '100%' : '400px' }}>
              <pre className="p-3 text-xs leading-relaxed font-mono text-[#cdd6f4] dark:text-[#c9d1d9] whitespace-pre overflow-x-auto">
                <code>
                  {code.split('\n').map((line, i) => (
                    <div key={i} className="flex hover:bg-white/5 min-w-fit">
                      <span className="inline-block w-8 text-right pr-3 text-[#6c7086] select-none flex-shrink-0 text-[10px]">
                        {i + 1}
                      </span>
                      <span className="flex-1 whitespace-pre">{line || ' '}</span>
                    </div>
                  ))}
                </code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </>
  );
});
