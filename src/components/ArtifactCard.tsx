/**
 * ArtifactCard — 对话内 Artifact 实时预览卡片 (v2)
 * 
 * 增强功能：
 *   - 设备切换（桌面/平板/手机）预览框架
 *   - 流式骨架屏动画
 *   - 代码区语法着色 + 行号
 *   - 版本 diff 对比
 *   - 采纳/调整/导出 完整操作链
 */

import { useState, useMemo, useCallback, useEffect, memo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Eye, Code2, Maximize2, Minimize2, RotateCcw,
  ThumbsUp, RefreshCw, Download, Copy, Check,
  Sparkles, Loader2, ChevronDown, ChevronUp, X,
  Monitor, Tablet, Smartphone,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { ArtifactData } from '@/pages/chat/types';

interface ArtifactCardProps {
  artifact: ArtifactData;
  onApprove?: () => void;
  onIterate?: (feedback: string) => void;
  onExport?: (format: 'html' | 'react') => void;
  /** 填满父容器高度（用于右侧面板） */
  fillHeight?: boolean;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_SIZES: Record<DeviceMode, { width: string; label: string }> = {
  desktop: { width: '100%', label: '桌面' },
  tablet: { width: '768px', label: '平板' },
  mobile: { width: '375px', label: '手机' },
};

export const ArtifactCard = memo(function ArtifactCard({
  artifact, onApprove, onIterate, onExport, fillHeight = false,
}: ArtifactCardProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [device, setDevice] = useState<DeviceMode>('desktop');

  const isStreaming = artifact.status === 'streaming';
  const isApproved = artifact.status === 'approved';

  const htmlDoc = useMemo(() => {
    if (!artifact.code) return '';
    return buildPreviewDoc(artifact.code, artifact.language);
  }, [artifact.code, artifact.language]);

  const blobUrl = useMemo(() => {
    if (!htmlDoc) return '';
    const blob = new Blob([htmlDoc], { type: 'text/html;charset=utf-8' });
    return URL.createObjectURL(blob);
  }, [htmlDoc, iframeKey]);

  useEffect(() => () => { if (blobUrl) URL.revokeObjectURL(blobUrl); }, [blobUrl]);

  const codeStats = useMemo(() => {
    if (!artifact.code) return { lines: 0, chars: 0 };
    return { lines: artifact.code.split('\n').length, chars: artifact.code.length };
  }, [artifact.code]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(artifact.code);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
      toast.success('代码已复制');
    } catch { toast.error('复制失败'); }
  }, [artifact.code]);

  const handleExport = useCallback(() => {
    const ext = artifact.language === 'react' ? 'jsx' : artifact.language === 'vue' ? 'vue' : 'html';
    const blob = new Blob([artifact.code], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${artifact.title || 'artifact'}.${ext}`; a.click();
    URL.revokeObjectURL(url);
    onExport?.('html');
  }, [artifact, onExport]);

  const handleApprove = useCallback(() => { onApprove?.(); toast.success('已采纳此方案'); }, [onApprove]);
  const handleIterate = useCallback(() => { onIterate?.('请根据预览效果继续调整'); }, [onIterate]);

  const cardClass = isFullscreen
    ? 'fixed inset-0 sm:inset-4 z-[60] bg-card sm:border sm:border-border sm:rounded-2xl shadow-2xl flex flex-col'
    : fillHeight
      ? 'h-full bg-card flex flex-col overflow-hidden'
      : 'my-3 border border-border rounded-xl overflow-hidden bg-card shadow-sm flex flex-col';

  return (
    <>
      {isFullscreen && <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm" onClick={() => setIsFullscreen(false)} />}
      <div className={cardClass}>
        {/* ── 头部 ── */}
        <div className="flex items-center justify-between px-3 md:px-4 py-2 bg-muted/50 border-b border-border flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {isStreaming ? (
              <div className="relative flex-shrink-0">
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              </div>
            ) : isApproved ? (
              <div className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <ThumbsUp className="w-3 h-3 text-green-600 dark:text-green-400" />
              </div>
            ) : (
              <Sparkles className="w-4 h-4 text-primary flex-shrink-0" />
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold text-foreground truncate">{artifact.title || '界面预览'}</span>
              <span className="text-[11px] text-muted-foreground truncate">
                {isStreaming ? '生成中...' : `${codeStats.lines} 行 · ${artifact.language.toUpperCase()}`}
                {artifact.description ? ` · ${artifact.description}` : ''}
              </span>
            </div>
            {artifact.version > 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">v{artifact.version}</span>
            )}
          </div>

          <div className="flex items-center gap-0.5 flex-shrink-0">
            <div className="flex bg-muted rounded-lg p-0.5 mr-1">
              {(['preview', 'code'] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all',
                    activeTab === tab ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                  {tab === 'preview' ? <Eye className="w-3 h-3" /> : <Code2 className="w-3 h-3" />}
                  <span className="hidden sm:inline">{tab === 'preview' ? '预览' : '代码'}</span>
                </button>
              ))}
            </div>
            {activeTab === 'preview' && (
              <div className="hidden md:flex items-center bg-muted rounded-lg p-0.5 mr-1">
                {([{ m: 'desktop' as DeviceMode, I: Monitor }, { m: 'tablet' as DeviceMode, I: Tablet }, { m: 'mobile' as DeviceMode, I: Smartphone }]).map(({ m, I }) => (
                  <button key={m} onClick={() => setDevice(m)} title={DEVICE_SIZES[m].label}
                    className={cn('p-1 rounded-md transition-all', device === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    <I className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}
            {activeTab === 'preview' && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIframeKey(k => k + 1)} title="刷新"><RotateCcw className="w-3 h-3" /></Button>}
            {activeTab === 'code' && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>{copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</Button>}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </Button>
            {isFullscreen && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsFullscreen(false)}><X className="w-3 h-3" /></Button>}
          </div>
        </div>

        {/* ── 内容区 ── */}
        <div className={cn('relative overflow-hidden', isFullscreen || fillHeight ? 'flex-1' : 'h-[280px] sm:h-[360px] md:h-[420px]')}>
          {activeTab === 'preview' && (
            <div className="h-full flex items-start justify-center bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)] bg-[length:16px_16px]"
              style={{ overflow: 'auto' }}>
              {blobUrl ? (
                <div className={cn('h-full bg-white dark:bg-gray-950 transition-all duration-300',
                  device !== 'desktop' && 'border-x border-border shadow-lg rounded-lg my-2')}
                  style={{ width: DEVICE_SIZES[device].width, maxWidth: '100%' }}>
                  <iframe key={iframeKey} src={blobUrl} sandbox="allow-scripts allow-same-origin" className="w-full h-full border-0" title={artifact.title || 'Preview'} />
                </div>
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4 p-8 bg-background">
                  <Sparkles className="w-10 h-10 text-primary animate-pulse" />
                  <p className="text-sm text-muted-foreground">正在生成界面...</p>
                  <div className="w-48 space-y-1.5">{[75, 60, 85, 45, 70].map((w, i) => <div key={i} className="h-2 rounded-full bg-muted animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }} />)}</div>
                </div>
              )}
              {isStreaming && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 animate-pulse" style={{ width: `${Math.min(90, Math.max(10, codeStats.chars / 50))}%` }} />
                </div>
              )}
            </div>
          )}
          {activeTab === 'code' && (
            <div className="h-full overflow-auto bg-[#1e1e2e] dark:bg-[#0d1117] -webkit-overflow-scrolling-touch">
              <pre className="p-3 md:p-4 text-xs leading-relaxed font-mono text-[#cdd6f4] dark:text-[#c9d1d9] whitespace-pre overflow-x-auto">
                <code>{(artifact.code || '// 代码生成中...').split('\n').map((line, i) => (
                  <div key={i} className="flex hover:bg-white/5 min-w-fit"><span className="inline-block w-8 md:w-10 text-right pr-3 md:pr-4 text-[#6c7086] select-none flex-shrink-0 text-[10px] md:text-[11px]">{i+1}</span><span className="flex-1 whitespace-pre">{line || ' '}</span></div>
                ))}</code>
              </pre>
            </div>
          )}
        </div>

        {/* ── 底部操作栏 ── */}
        {(artifact.status === 'complete' || artifact.status === 'approved') && (
          <div className="flex items-center justify-between px-3 md:px-4 py-2.5 md:py-2 border-t border-border bg-muted/30 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {artifact.previousCode && <Button variant="ghost" size="sm" className="h-8 md:h-7 text-xs gap-1" onClick={() => setShowDiff(!showDiff)}>{showDiff ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}对比</Button>}
              {isApproved && <span className="text-[11px] text-green-600 dark:text-green-400 font-medium px-2 py-0.5 bg-green-50 dark:bg-green-950/30 rounded-full">✓ 已采纳</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="outline" size="sm" className="h-8 md:h-7 text-xs gap-1" onClick={handleExport}><Download className="w-3.5 h-3.5 md:w-3 md:h-3" /><span className="hidden sm:inline">导出</span></Button>
              {!isApproved && (<>
                <Button variant="outline" size="sm" className="h-8 md:h-7 text-xs gap-1" onClick={handleIterate}><RefreshCw className="w-3.5 h-3.5 md:w-3 md:h-3" /><span className="hidden sm:inline">调整</span></Button>
                <Button size="sm" className="h-8 md:h-7 text-xs gap-1 bg-green-600 hover:bg-green-700 text-white" onClick={handleApprove}><ThumbsUp className="w-3.5 h-3.5 md:w-3 md:h-3" /><span className="hidden xs:inline">采纳</span></Button>
              </>)}
            </div>
          </div>
        )}

        {showDiff && artifact.previousCode && (
          <div className="border-t border-border bg-muted/20 p-3 max-h-[200px] overflow-auto">
            <div className="text-xs font-medium text-muted-foreground mb-2">v{artifact.version - 1} → v{artifact.version}</div>
            <pre className="text-[11px] leading-relaxed font-mono">{(() => {
              const ol = artifact.previousCode!.split('\n'), nl = artifact.code.split('\n');
              const lines: Array<{t:'same'|'add'|'remove';c:string}> = [];
              for (let i = 0; i < Math.max(ol.length, nl.length); i++) {
                if (ol[i] === nl[i]) { if (ol[i] !== undefined) lines.push({t:'same',c:ol[i]}); }
                else { if (ol[i] !== undefined) lines.push({t:'remove',c:ol[i]}); if (nl[i] !== undefined) lines.push({t:'add',c:nl[i]}); }
              }
              const changed = new Set<number>();
              lines.forEach((l,i) => { if (l.t !== 'same') for (let j = Math.max(0,i-2); j <= Math.min(lines.length-1,i+2); j++) changed.add(j); });
              return lines.map((l,i) => changed.has(i) ? <div key={i} className={cn('px-2 py-0.5',
                l.t==='add'&&'bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400',
                l.t==='remove'&&'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 line-through',
                l.t==='same'&&'text-muted-foreground')}><span className="inline-block w-4 text-right mr-2 opacity-50">{l.t==='add'?'+':l.t==='remove'?'-':' '}</span>{l.c}</div> : null);
            })()}</pre>
          </div>
        )}
      </div>
    </>
  );
});

function buildPreviewDoc(code: string, language: string): string {
  // If already a full HTML doc, inject viewport meta if missing
  if (/<(!DOCTYPE|html)/i.test(code)) {
    if (!/<meta[^>]*viewport/i.test(code)) {
      return code.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width,initial-scale=1.0">');
    }
    return code;
  }
  if (language === 'react') {
    return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif}</style></head><body><div id="root"></div>
<script type="text/babel">const{useState,useEffect,useRef,useMemo,useCallback}=React;${code}
const rootEl=document.getElementById('root');try{const C=typeof App!=='undefined'?App:typeof Default!=='undefined'?Default:null;if(C)ReactDOM.render(React.createElement(C),rootEl);else rootEl.innerHTML='<div style="padding:20px;color:#666">Component loaded</div>';}catch(e){rootEl.innerHTML='<pre style="color:red;padding:16px;background:#fef2f2;border-radius:8px;margin:16px">'+e.message+'</pre>';}</script></body></html>`;
  }
  if (language === 'css') return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;padding:20px}${code}</style></head><body><h2>CSS Preview</h2><div class="demo">Box 1</div><div class="demo">Box 2</div></body></html>`;
  if (language === 'javascript') return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;padding:16px}</style></head><body><div id="app"></div><script>try{${code}}catch(e){document.body.innerHTML+='<pre style="color:red;padding:12px">'+e.message+'</pre>'}</script></body></html>`;
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif}</style></head><body>${code}</body></html>`;
}
