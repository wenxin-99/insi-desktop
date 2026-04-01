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
 * - ★ 智能色彩增强：检测单色 SVG 自动注入高对比样式
 */
import { useState, useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { Eye, Code2, Copy, Check, Download, Maximize2, Minimize2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface InlineSVGBlockProps {
  code: string;
  /** 是否正在流式输入中（由 SafeMarkdown 传入） */
  streaming?: boolean;
}

/* ────────────────────────────────────────────
 * 分析 SVG 是否为"单色/低色彩"信息卡片类型
 * 这类 SVG 通常由 LLM 生成，使用灰色系，缺乏视觉层次
 * ──────────────────────────────────────────── */
function analyzeSvgStyle(svgCode: string) {
  const textCount  = (svgCode.match(/<text[\s>]/g) || []).length;
  const circleCount = (svgCode.match(/<circle[\s>]/g) || []).length;
  const rectCount  = (svgCode.match(/<rect[\s>]/g) || []).length;

  // 检测是否有丰富的自定义颜色（排除灰色系）
  const fillMatches = svgCode.match(/fill=["']#[0-9a-fA-F]{3,8}["']/g) || [];
  let colorfulCount = 0;
  for (const f of fillMatches) {
    const hex = f.match(/#([0-9a-fA-F]{3,8})/)?.[1] || '';
    const full = hex.length === 3
      ? hex[0]+hex[0]+hex[1]+hex[1]+hex[2]+hex[2]
      : hex;
    if (full.length < 6) continue;
    const r = parseInt(full.slice(0,2), 16);
    const g = parseInt(full.slice(2,4), 16);
    const b = parseInt(full.slice(4,6), 16);
    const span = Math.max(r,g,b) - Math.min(r,g,b);
    if (span >= 35) colorfulCount++;
  }

  const isMonochrome = colorfulCount < 3;
  const isInfoCard = textCount > 5 && (circleCount >= 3 || rectCount >= 3);

  return { isMonochrome, isInfoCard, textCount, circleCount, rectCount };
}

/* ────────────────────────────────────────────
 * JS 后处理：直接操作 SVG DOM，处理 inline style
 * 和 CSS 选择器覆盖不到的场景
 * ──────────────────────────────────────────── */
function buildPostProcessScript(): string {
  return `
  (function() {
    try {
      var isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      var svg = document.querySelector('svg');
      if (!svg) return;

      /* — 判断灰色 hex — */
      function isGray(hex) {
        if (!hex || hex === 'none' || hex === 'transparent') return true;
        hex = hex.trim().toLowerCase();
        var namedGrays = ['white','black','gray','grey','darkgray','darkgrey','lightgray','lightgrey','silver','gainsboro','whitesmoke'];
        if (namedGrays.indexOf(hex) >= 0) return true;
        var m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
        if (!m) {
          var m3 = hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
          if (m3) m = [null, m3[1]+m3[1], m3[2]+m3[2], m3[3]+m3[3]];
        }
        if (!m) return true;
        var r=parseInt(m[1],16), g=parseInt(m[2],16), b=parseInt(m[3],16);
        return (Math.max(r,g,b) - Math.min(r,g,b)) < 35;
      }

      function getFill(el) {
        return el.style.fill || el.getAttribute('fill') || '';
      }

      /* — 统计是否已有丰富色彩 — */
      var allFills = svg.querySelectorAll('[fill]');
      var richCount = 0;
      for (var i = 0; i < allFills.length; i++) {
        if (!isGray(allFills[i].getAttribute('fill'))) richCount++;
      }
      if (richCount >= 3) return; // 已有色彩，不干预

      /* — 调色板 — */
      var palette = {
        title:     isDark ? '#f1f5f9' : '#1e1b4b',
        body:      isDark ? '#cbd5e1' : '#334155',
        sub:       isDark ? '#94a3b8' : '#64748b',
        dot:       isDark ? '#818cf8' : '#6366f1',
        line:      isDark ? '#4f46e5' : '#a5b4fc',
        badgeBg:   isDark ? '#1e1b4b' : '#eef2ff',
        badgeBd:   isDark ? '#3730a3' : '#c7d2fe',
        cardBg:    isDark ? '#0f172a' : '#ffffff',
        cardBd:    isDark ? '#1e293b' : '#e0e7ff',
      };

      /* 1) 文字增强 */
      var texts = svg.querySelectorAll('text');
      for (var i = 0; i < texts.length; i++) {
        var t = texts[i];
        var fill = getFill(t);
        if (fill && !isGray(fill)) continue; // 有颜色的跳过
        var fs = parseFloat(t.getAttribute('font-size') || t.style.fontSize || '14');
        if (fs >= 18) {
          t.style.fill = palette.title;
          if (!t.getAttribute('font-weight') && !t.style.fontWeight) t.style.fontWeight = '700';
        } else if (fs >= 14) {
          t.style.fill = palette.body;
          if (!t.getAttribute('font-weight') && !t.style.fontWeight) t.style.fontWeight = '500';
        } else {
          t.style.fill = palette.sub;
        }
      }

      /* 2) 步骤指示圆 */
      var circles = svg.querySelectorAll('circle');
      for (var i = 0; i < circles.length; i++) {
        var c = circles[i];
        var r = parseFloat(c.getAttribute('r') || '0');
        if (r > 20) continue;
        var fill = getFill(c);
        if (fill && !isGray(fill)) continue;
        c.style.fill = palette.dot;
      }

      /* 3) 连线增强 */
      var lines = svg.querySelectorAll('line');
      for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        var stroke = l.style.stroke || l.getAttribute('stroke') || '';
        if (stroke && !isGray(stroke)) continue;
        l.style.stroke = palette.line;
        if (!l.getAttribute('stroke-width')) l.style.strokeWidth = '2';
        if (!l.getAttribute('stroke-dasharray')) l.style.strokeDasharray = '4 3';
      }

      /* 4) badge 矩形 */
      var rects = svg.querySelectorAll('rect');
      for (var i = 0; i < rects.length; i++) {
        var rect = rects[i];
        var rx = parseFloat(rect.getAttribute('rx') || '0');
        var w = parseFloat(rect.getAttribute('width') || '0');
        var h = parseFloat(rect.getAttribute('height') || '0');
        var fill = getFill(rect);
        if (!isGray(fill)) continue;

        // 外层容器大矩形
        if (i === 0 && w > 400 && h > 200) {
          rect.style.fill = palette.cardBg;
          rect.style.stroke = palette.cardBd;
          rect.style.strokeWidth = '1.5';
          if (rx < 8) { rect.setAttribute('rx', '12'); rect.setAttribute('ry', '12'); }
          continue;
        }
        // badge 小矩形
        if (rx > 0 && w < 200 && h < 50) {
          rect.style.fill = palette.badgeBg;
          rect.style.stroke = palette.badgeBd;
          rect.style.strokeWidth = '1';
        }
      }

    } catch(e) { /* 静默 */ }
  })();
  `;
}

export const InlineSVGBlock = memo(function InlineSVGBlock({ code, streaming }: InlineSVGBlockProps) {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [height, setHeight] = useState(280);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const instanceId = useRef(`svg-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);

  // ★ 流式防抖：streaming 期间每 500ms 更新一次 iframe，避免高频重载
  const [renderCode, setRenderCode] = useState(code);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (!streaming) {
      // 非流式 / 流式结束：立即用最新代码渲染
      setRenderCode(code);
      if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = undefined; }
      return;
    }
    // 流式中：防抖 500ms（第一帧立即渲染）
    if (!renderCode) { setRenderCode(code); return; }
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setRenderCode(code), 500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [code, streaming]);

  // 分析 SVG 特征（用防抖后的代码）
  const analysis = useMemo(() => analyzeSvgStyle(renderCode), [renderCode]);

  // 构建安全的 iframe 文档（用防抖后的 renderCode）
  const iframeDoc = useMemo(() => {
    const sanitized = renderCode
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/\bon\w+\s*=\s*["'][^"']*["']/gi, '');

    const postProcessJS = analysis.isMonochrome ? buildPostProcessScript() : '';
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
    /* 加载 web 字体以改善中文渲染 */
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif;
  }
  svg { 
    max-width: 100%; 
    height: auto; 
    display: block;
  }
  /* 基础暗色模式 fallback */
  @media (prefers-color-scheme: dark) {
    svg text:not([fill]) { fill: #e2e8f0; }
  }
</style>
</head>
<body>${sanitized}
<script>
  // 自动计算高度
  new ResizeObserver(function() {
    var h = document.body.scrollHeight;
    window.parent.postMessage({ type: 'svg-height', id: '${iid}', height: h }, '*');
  }).observe(document.body);

  ${postProcessJS}
</script>
</body></html>`;
  }, [renderCode, analysis]);

  // 监听 iframe 高度消息
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

  // ★ 信息卡片类 SVG 用纯净白底，非信息卡用棋盘格（透明指示）
  const previewBg = (analysis.isInfoCard || analysis.isMonochrome)
    ? 'bg-white dark:bg-slate-950'
    : 'bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)] bg-[length:16px_16px]';

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
                {streaming ? ' · 生成中...' : analysis.isMonochrome ? ' · 已增强' : ''}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
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
              className={cn('flex items-center justify-center p-4', previewBg)}
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
              {streaming && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary/30 via-primary to-primary/30 animate-pulse" style={{ width: '100%' }} />
                </div>
              )}
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
