/**
 * CodePlayground — ```playground 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为可编辑的代码 + iframe 实时预览。
 * 仅支持 HTML/CSS/JS（客户端沙箱执行，不支持 Node/Python）。
 *
 * JSON Schema:
 * {
 *   "title": "CSS Flexbox 演示",
 *   "language": "html",
 *   "code": "<div style=\"display:flex\">...</div>",
 *   "editable": true
 * }
 */

import { memo, useState, useEffect, useRef, useCallback } from 'react';
import { Play, Maximize2, Minimize2, Code2, RotateCcw, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ highlight.js CDN 动态加载 ═══════

let hljsLoaded = false;
let hljsLoadPromise: Promise<void> | null = null;

function loadHighlightJS(): Promise<void> {
  if (hljsLoaded) return Promise.resolve();
  if (hljsLoadPromise) return hljsLoadPromise;
  hljsLoadPromise = new Promise<void>((resolve, reject) => {
    // CSS
    if (!document.querySelector('link[href*="highlight"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/vs2015.min.css';
      document.head.appendChild(link);
    }
    // JS
    if ((window as any).hljs) { hljsLoaded = true; resolve(); return; }
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js';
    script.onload = () => { hljsLoaded = true; resolve(); };
    script.onerror = () => reject(new Error('Failed to load highlight.js'));
    document.head.appendChild(script);
  });
  return hljsLoadPromise;
}

// ═══════ 类型定义 ═══════

interface PlaygroundData {
  title?: string;
  language?: string;  // html | css | js — 默认 html
  code: string;
  editable?: boolean; // 默认 true
}

interface CodePlaygroundProps {
  jsonStr: string;
  streaming?: boolean;
}

/** 将代码包装成完整 HTML 文档 */
function wrapHtml(code: string, lang?: string): string {
  if (lang === 'css') {
    return `<!DOCTYPE html><html><head><style>${code}</style></head><body><div id="demo">CSS 预览区域</div></body></html>`;
  }
  if (lang === 'js' || lang === 'javascript') {
    return `<!DOCTYPE html><html><head></head><body><div id="output"></div><script>${code}<\/script></body></html>`;
  }
  // html — 如果已包含 <html> 或 <!DOCTYPE，直接使用
  if (/<html|<!doctype/i.test(code)) return code;
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>*{margin:0;box-sizing:border-box}body{font-family:system-ui,-apple-system,sans-serif;padding:12px}</style></head><body>${code}</body></html>`;
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

/** 行号栏 */
function LineNumbers({ code, height }: { code: string; height: string }) {
  const lineCount = (code.match(/\n/g) || []).length + 1;
  return (
    <div className={cn(
      'select-none text-right pr-2 pl-3 py-3 text-[10px] leading-relaxed text-[#6c7086] font-mono overflow-hidden flex-shrink-0',
      height
    )}>
      {Array.from({ length: lineCount }, (_, i) => (
        <div key={i}>{i + 1}</div>
      ))}
    </div>
  );
}

function CodePlaygroundInner({ jsonStr, streaming }: CodePlaygroundProps) {
  const [editedCode, setEditedCode] = useState<string | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [previewSrcDoc, setPreviewSrcDoc] = useState('');
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLPreElement>(null);

  let parsed: PlaygroundData | null = null;
  {
    const r = safeParseJson<any>(jsonStr);
    parsed = r.data;
  }

  const code = editedCode ?? parsed?.code ?? '';
  const lang = parsed?.language || 'html';
  const editable = parsed?.editable !== false;
  const title = parsed?.title || 'HTML 预览';

  const htmlContent = wrapHtml(code, lang);

  // ★ highlight.js 语法高亮（代码变化时重新高亮）
  useEffect(() => {
    loadHighlightJS().then(() => {
      const hljs = (window as any).hljs;
      if (!hljs) return;
      const langMap: Record<string, string> = { html: 'xml', js: 'javascript', ts: 'typescript' };
      const hljsLang = langMap[lang] || lang;
      try {
        const result = hljs.highlight(code, { language: hljsLang, ignoreIllegals: true });
        setHighlightedHtml(result.value);
      } catch {
        setHighlightedHtml(null);
      }
    }).catch(() => setHighlightedHtml(null));
  }, [code, lang]);

  // ★ 编辑模式滚动同步（textarea ↔ 高亮层）
  const handleEditorScroll = useCallback((e: React.UIEvent<HTMLTextAreaElement>) => {
    if (highlightRef.current) {
      highlightRef.current.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
      highlightRef.current.scrollLeft = (e.target as HTMLTextAreaElement).scrollLeft;
    }
  }, []);

  // 非编辑模式或初始状态：自动同步预览
  useEffect(() => {
    if (!editable || editedCode === null) {
      setPreviewSrcDoc(htmlContent);
    }
  }, [htmlContent, editable, editedCode]);

  // Escape 退出全屏
  useEffect(() => {
    if (!fullscreen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setFullscreen(false); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [fullscreen]);

  const handleRun = () => {
    // ★ 追加不可见注释强制 srcDoc 值变化，使 iframe 重新加载
    setPreviewSrcDoc(htmlContent + `<!-- run:${Date.now()} -->`);
  };

  const handleReset = () => {
    setEditedCode(null);
    // reset 后 useEffect 会自动同步 previewSrcDoc
  };

  // ★ Tab 缩进 + Ctrl/Cmd+Enter 运行
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const val = ta.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      setEditedCode(newVal);
      // 恢复光标位置
      requestAnimationFrame(() => { ta.selectionStart = ta.selectionEnd = start + 2; });
    }
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleRun();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  // ═══════ 流式骨架 ═══════
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Code2 className="w-4 h-4 text-emerald-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '代码沙箱生成中...'}</h3>
          </div>
          <div className="space-y-2">
            <div className="h-24 rounded bg-muted animate-pulse" />
            <div className="h-24 rounded bg-muted animate-pulse" style={{ animationDelay: '100ms' }} />
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-300 via-emerald-500 to-emerald-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // ═══════ 解析失败降级 ═══════
  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>代码沙箱数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const containerClass = fullscreen
    ? 'fixed inset-0 z-50 bg-background flex flex-col'
    : 'my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm';

  return (
    <div className={containerClass}>
      {/* ═══════ 标题栏 ═══════ */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Code2 className="w-4 h-4 text-emerald-500" />
          <h3 className="text-xs font-medium">{title}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded uppercase">{lang}</span>
        </div>
        <div className="flex items-center gap-1">
          {editable && (
            <>
              <button onClick={handleRun} className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 rounded hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors" title="运行 (Ctrl+Enter)">
                <Play className="w-3 h-3" />运行
              </button>
              {editedCode !== null && (
                <button onClick={handleReset} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="重置">
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}
            </>
          )}
          <button onClick={handleCopy} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="复制代码">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button onClick={() => setFullscreen(!fullscreen)} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title={fullscreen ? '退出全屏' : '全屏'}>
            {fullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className={cn('flex', fullscreen ? 'flex-1 overflow-hidden' : '', 'flex-col sm:flex-row')}>
        {/* ═══════ 代码区 ═══════ */}
        {editable ? (
          <div className="sm:w-1/2 border-b sm:border-b-0 sm:border-r border-border relative flex bg-[#1e1e2e] overflow-hidden">
            <LineNumbers code={code} height={fullscreen ? 'h-full' : 'h-[180px]'} />
            <div className="flex-1 relative">
              {/* ★ 高亮层（在 textarea 下方渲染语法着色） */}
              {highlightedHtml && (
                <pre
                  ref={highlightRef}
                  className={cn(
                    'absolute inset-0 font-mono text-xs leading-relaxed py-3 pr-3 m-0 pointer-events-none overflow-hidden whitespace-pre',
                    fullscreen ? 'h-full' : 'h-[180px]'
                  )}
                  style={{ background: 'transparent' }}
                  aria-hidden="true"
                ><code dangerouslySetInnerHTML={{ __html: highlightedHtml }} /></pre>
              )}
              <textarea
                ref={textareaRef}
                value={code}
                onChange={e => setEditedCode(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={handleEditorScroll}
                className={cn(
                  'relative w-full font-mono text-xs leading-relaxed py-3 pr-3 bg-transparent resize-none focus:outline-none',
                  fullscreen ? 'h-full' : 'h-[180px]',
                  highlightedHtml ? 'text-transparent caret-[#cdd6f4]' : 'text-[#cdd6f4]'
                )}
                spellCheck={false}
                placeholder="// Ctrl+Enter 运行"
              />
            </div>
          </div>
        ) : (
          <div className="sm:w-1/2 border-b sm:border-b-0 sm:border-r border-border overflow-auto flex bg-[#1e1e2e]">
            <LineNumbers code={code} height={fullscreen ? 'h-full' : 'max-h-[180px]'} />
            <pre className={cn('py-3 pr-3 font-mono text-xs leading-relaxed flex-1', fullscreen ? 'h-full' : 'max-h-[180px]')}>
              {highlightedHtml
                ? <code dangerouslySetInnerHTML={{ __html: highlightedHtml }} />
                : <code className="text-[#cdd6f4]">{code}</code>
              }
            </pre>
          </div>
        )}

        {/* ═══════ 预览区 ═══════ */}
        <div className={cn('sm:w-1/2 bg-white dark:bg-zinc-900', fullscreen ? 'flex-1' : '')}>
          <iframe
            srcDoc={previewSrcDoc}
            className={cn('w-full border-0', fullscreen ? 'h-full' : 'h-[180px]')}
            sandbox="allow-scripts allow-modals"
            title="preview"
          />
        </div>
      </div>
    </div>
  );
}

export const CodePlayground = memo(CodePlaygroundInner);
