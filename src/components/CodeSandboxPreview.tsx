/**
 * CodeSandboxPreview.tsx
 *
 * 前端代码沙盒预览 — sandboxed iframe 实时渲染 HTML/CSS/JS
 * 安全隔离: sandbox="allow-scripts", Blob URL 加载
 */

import { useState, useMemo, useRef, useCallback, useEffect, memo } from 'react';
import { Button } from '@/components/ui/button';
import { Play, X, Maximize2, Minimize2, RotateCcw, Eye } from 'lucide-react';

interface CodeSandboxPreviewProps {
  code: string;
  fileName: string;
  language?: string;
}

/** 判断代码是否可以预览 */
export function isPreviewableCode(fileName: string, language?: string, code?: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const lang = (language || '').toLowerCase();
  
  // 明确可预览的类型
  if (ext === 'html' || ext === 'htm' || lang === 'html') return true;
  
  // TS/TSX/JSX 文件包含 JSX 语法（看起来像 HTML 但不能直接在浏览器运行），不预览
  if (['ts', 'tsx', 'jsx', 'vue', 'svelte'].includes(ext)) return false;
  
  // CSS 独立可预览
  if (ext === 'css' || lang === 'css') return true;
  
  // 纯 JS 且包含 DOM 操作的可预览
  if ((ext === 'js' || lang === 'javascript') && code) {
    return /document\.|\.innerHTML|\.style\.|\.className|\.append|querySelector|getElementById|createElement/.test(code);
  }
  
  // 内容本身就是 HTML 文档（必须有 DOCTYPE 或 <html 标签，排除 JSX 片段）
  if (code && /<!DOCTYPE\s+html|<html[\s>]/i.test(code)) return true;
  
  return false;
}

export const CodeSandboxPreview = memo(function CodeSandboxPreview({ code, fileName, language }: CodeSandboxPreviewProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isFs, setIsFs] = useState(false);
  const [key, setKey] = useState(0);

  const html = useMemo(() => _buildDoc(code, fileName, language), [code, fileName, language]);
  const blobUrl = useMemo(() => {
    const b = new Blob([html], { type: 'text/html;charset=utf-8' });
    return URL.createObjectURL(b);
  }, [html, key]);

  useEffect(() => () => URL.revokeObjectURL(blobUrl), [blobUrl]);

  if (!isOpen) return (
    <button onClick={() => setIsOpen(true)}
      className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:hover:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 rounded-md transition-colors">
      <Play className="w-3 h-3" />预览
    </button>
  );

  const cls = isFs
    ? 'fixed inset-4 z-50 bg-card border border-border rounded-xl shadow-2xl flex flex-col'
    : 'mt-2 border border-border rounded-lg overflow-hidden bg-card flex flex-col';

  return (
    <>
      {isFs && <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsFs(false)} />}
      <div className={cls}>
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Eye className="w-3.5 h-3.5" /><span>实时预览</span>
            <span className="font-mono opacity-60">{fileName}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setKey(k => k + 1)} title="刷新"><RotateCcw className="w-3 h-3" /></Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsFs(!isFs)} title={isFs ? '退出全屏' : '全屏'}>
              {isFs ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => { setIsOpen(false); setIsFs(false); }} title="关闭"><X className="w-3 h-3" /></Button>
          </div>
        </div>
        <div className={`flex-1 bg-white ${isFs ? '' : 'h-[350px]'}`}>
          <iframe key={key} src={blobUrl} sandbox="allow-scripts" className="w-full h-full border-0" title="Code Preview" />
        </div>
      </div>
    </>
  );
});

function _buildDoc(code: string, fn: string, lang?: string): string {
  const ext = fn.split('.').pop()?.toLowerCase() || '';
  const l = (lang || '').toLowerCase();

  if ((ext === 'html' || ext === 'htm' || l === 'html') && /<(!DOCTYPE|html)/i.test(code)) return code;
  if (ext === 'html' || ext === 'htm' || l === 'html' || /<(div|span|p|h[1-6]|form|table|ul|section|header|footer|main)/i.test(code))
    return _wrap(code, '', '');
  if (ext === 'css' || l === 'css')
    return _wrap('<div style="padding:20px;font-family:system-ui,sans-serif"><h2>CSS 预览</h2><div class="demo">Box 1</div><div class="demo">Box 2</div><button class="demo-btn">Button</button></div>', code, '');
  if (ext === 'js' || l === 'javascript')
    return _wrap('<div id="app"></div>', '', code);
  return _wrap(code, '', '');
}

function _wrap(body: string, css: string, js: string): string {
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif;padding:16px;color:#333}${css}</style></head>
<body>${body}${js ? `<script>try{${js}}catch(e){document.body.innerHTML+='<pre style="color:red;padding:12px;background:#fff0f0;border-radius:8px;margin-top:12px">'+e.message+'</pre>'}</script>` : ''}</body></html>`;
}
