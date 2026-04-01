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
  Monitor, Tablet, Smartphone, ChevronLeft, ChevronRight,
  Pencil, Undo2,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { CanvasEditor } from '@/components/canvas/CanvasEditor';
import { ProseEditor } from '@/components/canvas/ProseEditor';
import { CanvasToolbar } from '@/components/canvas/CanvasToolbar';
import { ExportDropdown } from '@/components/canvas/ExportDropdown';
import type { ArtifactData } from '@/types/artifact';

interface ArtifactCardProps {
  artifact: ArtifactData;
  onApprove?: () => void;
  onIterate?: (feedback: string) => void;
  onExport?: (format: 'html' | 'react') => void;
  /** Canvas 快捷操作回调（发送 AI 指令到聊天） */
  onCanvasAction?: (prompt: string) => void;
  /** 用户手动编辑代码后的回调 */
  onCodeChange?: (code: string) => void;
  /** 关闭按钮回调（移动端全屏时显示） */
  onClose?: () => void;
  /** 填满父容器高度（用于右侧面板） */
  fillHeight?: boolean;
}

type DeviceMode = 'desktop' | 'tablet' | 'mobile';

const DEVICE_SIZES: Record<DeviceMode, { width: string; label: string }> = {
  desktop: { width: '100%', label: '桌面' },
  tablet: { width: '768px', label: '平板' },
  mobile: { width: '375px', label: '手机' },
};

// ★ 文档类型检测（使用 ProseEditor 而非 iframe 预览）
const PROSE_LANGUAGES = new Set(['markdown', 'document', 'essay', 'report', 'md']);
function isProseType(language: string): boolean {
  return PROSE_LANGUAGES.has(language?.toLowerCase() || '');
}

export const ArtifactCard = memo(function ArtifactCard({
  artifact, onApprove, onIterate, onExport, onCanvasAction, onCodeChange, onClose, fillHeight = false,
}: ArtifactCardProps) {
  const [activeTab, setActiveTab] = useState<'preview' | 'code'>('preview');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [copied, setCopied] = useState(false);
  const [showDiff, setShowDiff] = useState(false);
  const [device, setDevice] = useState<DeviceMode>('desktop');
  // ★ T9-1: 版本历史
  const [viewingVersionIdx, setViewingVersionIdx] = useState<number | null>(null);
  // ★ Canvas 编辑模式
  const [isEditing, setIsEditing] = useState(false);
  const [editedCode, setEditedCode] = useState<string | null>(null); // null = 未编辑，使用原始代码
  const [showCanvasToolbar, setShowCanvasToolbar] = useState(true);

  const isStreaming = artifact.status === 'streaming';
  const isApproved = artifact.status === 'approved';

  // ★ Gap 1: 运行时错误捕获
  const [runtimeError, setRuntimeError] = useState<{ error: string; source?: string; line?: number; stack?: string } | null>(null);

  // 监听 iframe postMessage 的错误报告
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'artifact-error') {
        setRuntimeError({
          error: e.data.error,
          source: e.data.source,
          line: e.data.line,
          stack: e.data.stack,
        });
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  // 代码变化时清除旧错误
  useEffect(() => { setRuntimeError(null); }, [artifact.code, iframeKey]);

  // ★ T9-1: 版本列表 = 历史版本 + 当前版本
  const versions: Array<{ version: number; code: string; timestamp: number }> = useMemo(() => {
    const hist = (artifact as any).versions || [];
    if (artifact.code && artifact.status !== 'streaming') {
      // Fix #4: 用 version 号做稳定标识，避免 Date.now() 导致无限重渲染
      const alreadyInHist = hist.some((v: any) => v.version === artifact.version);
      if (!alreadyInHist) {
        return [...hist, { version: artifact.version, code: artifact.code, timestamp: artifact.version * 1000 }];
      }
      return hist;
    }
    return hist;
  }, [(artifact as any).versions, artifact.code, artifact.version, artifact.status]);

  // 当前展示的代码（用户编辑 > 历史版本 > 最新）
  const displayCode = useMemo(() => {
    if (editedCode !== null) return editedCode;
    if (viewingVersionIdx !== null && versions[viewingVersionIdx]) {
      return versions[viewingVersionIdx].code;
    }
    return artifact.code;
  }, [editedCode, viewingVersionIdx, versions, artifact.code]);

  // 用户编辑代码
  const handleCodeEdit = useCallback((newCode: string) => {
    setEditedCode(newCode);
    onCodeChange?.(newCode);
  }, [onCodeChange]);

  // 应用用户编辑（更新预览）
  const applyEdit = useCallback(() => {
    if (editedCode !== null) {
      setIframeKey(k => k + 1);
      toast.success('代码已更新到预览');
    }
  }, [editedCode]);

  // 撤销用户编辑
  const revertEdit = useCallback(() => {
    setEditedCode(null);
    setIsEditing(false);
    toast.success('已还原为 AI 生成的代码');
  }, []);

  // Canvas 选中文本 AI 操作
  const handleSelectionAction = useCallback((action: string, selectedText: string, range: { start: number; end: number }) => {
    if (!onCanvasAction) return;
    const actionLabels: Record<string, string> = {
      explain: '请解释这段代码',
      fix: '请修复这段代码的问题',
      simplify: '请简化这段代码',
      rewrite: '请重写优化这段代码',
    };
    const prefix = actionLabels[action] || '请处理这段代码';
    onCanvasAction(`${prefix}：\n\`\`\`\n${selectedText}\n\`\`\``);
  }, [onCanvasAction]);

  // 新版本到来时重置编辑状态
  useEffect(() => { setViewingVersionIdx(null); setEditedCode(null); setIsEditing(false); }, [artifact.version]);

  const displayVersion = viewingVersionIdx !== null && versions[viewingVersionIdx]
    ? versions[viewingVersionIdx].version : artifact.version;

  const htmlDoc = useMemo(() => {
    if (!displayCode) return '';
    // ★ 文档类型使用 ProseEditor，无需构建 HTML 预览
    if (isProseType(artifact.language)) return '';
    return buildPreviewDoc(displayCode, artifact.language);
  }, [displayCode, artifact.language]);

  // ★ 使用 srcdoc 代替 blob URL — 完全避免继承父页面 CSP
  // srcdoc 创建独立文档上下文，不受服务器 HTTP CSP header 影响
  const iframeDoc = useMemo(() => {
    if (!htmlDoc) return '';
    return htmlDoc;
  }, [htmlDoc, iframeKey]);

  const codeStats = useMemo(() => {
    if (!displayCode) return { lines: 0, chars: 0 };
    return { lines: displayCode.split('\n').length, chars: displayCode.length };
  }, [displayCode]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(displayCode);
      setCopied(true); setTimeout(() => setCopied(false), 2000);
      toast.success('代码已复制');
    } catch { toast.error('复制失败'); }
  }, [displayCode]);

  // ★ T9-3: 语言 → 文件后缀 + MIME 映射
  const LANG_EXT: Record<string, { ext: string; mime: string }> = {
    html: { ext: 'html', mime: 'text/html;charset=utf-8' },
    react: { ext: 'jsx', mime: 'text/javascript;charset=utf-8' },
    vue: { ext: 'vue', mime: 'text/html;charset=utf-8' },
    css: { ext: 'css', mime: 'text/css;charset=utf-8' },
    javascript: { ext: 'js', mime: 'text/javascript;charset=utf-8' },
    mermaid: { ext: 'mmd', mime: 'text/plain;charset=utf-8' },
    svg: { ext: 'svg', mime: 'image/svg+xml;charset=utf-8' },
    markdown: { ext: 'md', mime: 'text/markdown;charset=utf-8' },
    document: { ext: 'md', mime: 'text/markdown;charset=utf-8' },
    essay: { ext: 'md', mime: 'text/markdown;charset=utf-8' },
    report: { ext: 'md', mime: 'text/markdown;charset=utf-8' },
    md: { ext: 'md', mime: 'text/markdown;charset=utf-8' },
  };

  const handleExport = useCallback(() => {
    const { ext, mime } = LANG_EXT[artifact.language] || LANG_EXT.html;
    const safeName = (artifact.title || 'artifact').replace(/[<>:"/\\|?*]/g, '_');

    // 单文件：直接 Blob 下载
    const blob = new Blob([displayCode], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.${ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`已下载 ${safeName}.${ext}`);
    onExport?.('html');
  }, [artifact, onExport]);

  const handleApprove = useCallback(() => { onApprove?.(); toast.success('已采纳此方案'); }, [onApprove]);
  const handleIterate = useCallback(() => { onIterate?.('请根据预览效果继续调整'); }, [onIterate]);

  // ★ iOS Safari 核心修复：
  // Safari 不能正确处理嵌套的 flex-1 + min-height:0
  // 但 height:0 + flex-grow:1 可以——它给元素一个显式的 0 基准高度
  // 然后 flex-grow 从这个确定值开始扩展，Safari 能正确计算
  const flexFillStyle: React.CSSProperties = { height: 0, flexGrow: 1 };

  const cardClass = isFullscreen
    ? 'fixed inset-0 sm:inset-4 z-[60] bg-card sm:border sm:border-border sm:rounded-2xl shadow-2xl flex flex-col'
    : fillHeight
      ? 'bg-card flex flex-col overflow-hidden'
      : 'my-3 border border-border rounded-xl overflow-hidden bg-card shadow-sm flex flex-col';

  return (
    <>
      {isFullscreen && <div className="fixed inset-0 z-[55] bg-black/50 backdrop-blur-sm" onClick={() => setIsFullscreen(false)} />}
      <div className={cardClass} style={fillHeight && !isFullscreen ? flexFillStyle : undefined}>
        {/* ── 头部 ── fillHeight 模式下只显示紧凑工具栏（外层面板已有标题） */}
        <div className={cn(
          "flex items-center justify-between border-b border-border flex-shrink-0",
          fillHeight ? "px-2 py-1.5 bg-muted/30" : "px-3 md:px-4 py-2 bg-muted/50"
        )}>
          {/* 左侧：非 fillHeight 显示标题，fillHeight 只显示 tab 切换 */}
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {!fillHeight && (
              <>
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
              </>
            )}
            {fillHeight && (
              <span className="text-[11px] text-muted-foreground">
                {isStreaming ? '生成中...' : `${codeStats.lines} 行 · ${artifact.language.toUpperCase()}`}
              </span>
            )}
            {artifact.version > 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium flex-shrink-0">v{displayVersion}</span>
            )}
            {/* ★ T9-1: 版本切换按钮 */}
            {versions.length > 1 && !isStreaming && (
              <div className="flex items-center gap-0.5 flex-shrink-0">
                <button
                  onClick={() => {
                    if (viewingVersionIdx === null) setViewingVersionIdx(versions.length - 2);
                    else if (viewingVersionIdx > 0) setViewingVersionIdx(viewingVersionIdx - 1);
                  }}
                  disabled={viewingVersionIdx === 0}
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                  title="上一版本"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <span className="text-[10px] text-muted-foreground font-mono min-w-[32px] text-center">
                  {displayVersion}/{versions[versions.length - 1].version}
                </span>
                <button
                  onClick={() => {
                    if (viewingVersionIdx !== null && viewingVersionIdx < versions.length - 1) {
                      setViewingVersionIdx(viewingVersionIdx + 1);
                    }
                    if (viewingVersionIdx === versions.length - 1) setViewingVersionIdx(null);
                  }}
                  disabled={viewingVersionIdx === null || viewingVersionIdx >= versions.length - 1}
                  className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors"
                  title="下一版本"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
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
            {activeTab === 'preview' && !isProseType(artifact.language) && (
              <div className="hidden md:flex items-center bg-muted rounded-lg p-0.5 mr-1">
                {([{ m: 'desktop' as DeviceMode, I: Monitor }, { m: 'tablet' as DeviceMode, I: Tablet }, { m: 'mobile' as DeviceMode, I: Smartphone }]).map(({ m, I }) => (
                  <button key={m} onClick={() => setDevice(m)} title={DEVICE_SIZES[m].label}
                    className={cn('p-1 rounded-md transition-all', device === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                    <I className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            )}
            {activeTab === 'preview' && !isProseType(artifact.language) && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIframeKey(k => k + 1)} title="刷新"><RotateCcw className="w-3 h-3" /></Button>}
            {activeTab === 'code' && (
              <>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCopy}>{copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}</Button>
                {!isStreaming && (
                  <>
                    {editedCode !== null && (
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={revertEdit} title="还原为AI代码"><Undo2 className="w-3 h-3" /></Button>
                    )}
                    <Button variant="ghost" size="sm" className={cn("h-7 w-7 p-0", isEditing && "text-primary bg-primary/10")}
                      onClick={() => setIsEditing(!isEditing)} title={isEditing ? "退出编辑" : "编辑代码"}>
                      <Pencil className="w-3 h-3" />
                    </Button>
                  </>
                )}
              </>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </Button>
            {isFullscreen && <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setIsFullscreen(false)}><X className="w-3 h-3" /></Button>}
            {onClose && (
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground" onClick={onClose}>
                <X className="w-3.5 h-3.5" />
                <span className="sm:hidden">关闭</span>
              </Button>
            )}
          </div>
        </div>

        {/* ── 内容区 ── 
             ★ iOS Safari 修复：不用 relative + absolute inset-0 嵌套
             直接让此 div 本身成为滚动容器（flex-1 + overflow-auto）
             overflow 属性会强制浏览器给 flex 子项分配真实像素高度
        */}
        {activeTab === 'preview' && (
          <div
            className={cn('overflow-hidden', !isFullscreen && !fillHeight && 'h-[280px] sm:h-[360px] md:h-[420px]')}
            style={isFullscreen || fillHeight ? flexFillStyle : undefined}
          >
            {isProseType(artifact.language) ? (
              /* ★ 文档类型：ProseEditor 所见即所得 */
              <ProseEditor
                content={displayCode || ''}
                onChange={handleCodeEdit}
                onSelectionAction={onCanvasAction ? (action, text, range) => {
                  const actionLabels: Record<string, string> = {
                    rewrite: '请改写以下文字',
                    shorten: '请精简以下文字',
                    expand: '请扩展以下文字',
                    translate: '请翻译以下文字',
                    formal: '请将以下文字改为正式语气',
                    casual: '请将以下文字改为口语化',
                  };
                  const prefix = actionLabels[action] || '请处理以下文字';
                  onCanvasAction(`${prefix}：\n\n${text}`);
                } : undefined}
                readOnly={isStreaming}
                className="h-full"
              />
            ) : (
              /* 代码类型：iframe 预览 */
              <div className="h-full w-full flex items-start justify-center overflow-auto bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#fff_0%_50%)] dark:bg-[repeating-conic-gradient(#1f2937_0%_25%,#111827_0%_50%)] bg-[length:16px_16px]">
                {iframeDoc ? (
                  <div className={cn('h-full bg-white dark:bg-gray-950 transition-all duration-300',
                    device !== 'desktop' && 'border-x border-border shadow-lg rounded-lg my-2')}
                    style={{ width: DEVICE_SIZES[device].width, maxWidth: '100%' }}>
                    <iframe key={iframeKey} srcDoc={iframeDoc}
                      sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox"
                      referrerPolicy="no-referrer"
                      className="w-full h-full border-0" title={artifact.title || 'Preview'} />
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
          </div>
        )}
        {activeTab === 'code' && (
          <div
            className={cn('flex overflow-hidden bg-[#1e1e2e] dark:bg-[#0d1117]', !isFullscreen && !fillHeight && 'h-[280px] sm:h-[360px] md:h-[420px]')}
            style={isFullscreen || fillHeight ? flexFillStyle : undefined}
          >
            <CanvasEditor
              code={displayCode || '// 代码生成中...'}
              onChange={handleCodeEdit}
              onSelectionAction={onCanvasAction ? handleSelectionAction : undefined}
              readOnly={isStreaming || !isEditing}
              language={artifact.language}
              className="flex-1 min-w-0"
            />
            {/* Canvas 快捷工具栏（编辑模式 + 有 AI 回调时显示） */}
            {!isStreaming && isEditing && onCanvasAction && (
              <CanvasToolbar
                onAction={onCanvasAction}
                language={artifact.language}
                className="flex-shrink-0"
              />
            )}
          </div>
        )}

        {/* ★ Canvas 编辑状态提示条 */}
        {editedCode !== null && activeTab === 'code' && (
          <div className="flex items-center justify-between px-3 py-1.5 border-t border-amber-500/20 bg-amber-50/80 dark:bg-amber-950/20 flex-shrink-0">
            <span className="text-[11px] text-amber-700 dark:text-amber-400 font-medium">{isProseType(artifact.language) ? '文档已手动编辑（未保存到对话）' : '代码已手动编辑（未保存到对话）'}</span>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2 text-amber-700 dark:text-amber-400" onClick={revertEdit}>还原</Button>
              <Button size="sm" className="h-6 text-[11px] px-2 bg-amber-600 hover:bg-amber-700 text-white" onClick={applyEdit}>应用到预览</Button>
            </div>
          </div>
        )}

        {/* ★ Gap 1: 运行时错误提示条 */}
        {runtimeError && !isStreaming && (
          <div className="flex items-center gap-2 px-3 py-2 border-t border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 flex-shrink-0">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <div className="w-4 h-4 rounded-full bg-red-100 dark:bg-red-900/50 flex items-center justify-center flex-shrink-0">
                <span className="text-red-500 text-[10px] font-bold">!</span>
              </div>
              <span className="text-[11px] text-red-700 dark:text-red-300 truncate">
                {runtimeError.error}
                {runtimeError.line ? ` (行${runtimeError.line})` : ''}
              </span>
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              {runtimeError.stack && (
                <Button variant="ghost" size="sm" className="h-6 text-[10px] px-2 text-red-600 dark:text-red-400"
                  onClick={() => toast.info(runtimeError.stack || '', { duration: 8000 })}>
                  详情
                </Button>
              )}
              {onIterate && (
                <Button size="sm" className="h-6 text-[10px] px-2 bg-red-600 hover:bg-red-700 text-white gap-1"
                  onClick={() => onIterate(`运行时错误，请修复：\n${runtimeError.error}${runtimeError.stack ? '\n\nStack:\n' + runtimeError.stack : ''}`)}>
                  AI 修复
                </Button>
              )}
              <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400"
                onClick={() => setRuntimeError(null)}>
                <X className="w-3 h-3" />
              </Button>
            </div>
          </div>
        )}

        {/* ── 底部操作栏 ── */}
        {(artifact.status === 'complete' || artifact.status === 'approved') && (
          <div className="flex items-center justify-between px-3 md:px-4 py-2.5 md:py-2 border-t border-border bg-muted/30 flex-shrink-0">
            <div className="flex items-center gap-1.5">
              {artifact.previousCode && <Button variant="ghost" size="sm" className="h-8 md:h-7 text-xs gap-1" onClick={() => setShowDiff(!showDiff)}>{showDiff ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}对比</Button>}
              {isApproved && <span className="text-[11px] text-green-600 dark:text-green-400 font-medium px-2 py-0.5 bg-green-50 dark:bg-green-950/30 rounded-full">✓ 已采纳</span>}
            </div>
            <div className="flex items-center gap-1.5">
              <ExportDropdown
                code={displayCode}
                language={artifact.language}
                title={artifact.title || "artifact"}
                showPng={artifact.language === "html"}
                buttonClassName="inline-flex items-center gap-1 h-8 md:h-7 px-2.5 rounded-md text-xs font-medium border bg-background hover:bg-muted transition-colors"
              />
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
  // ★ Gap 1: 错误捕获脚本 — 必须在 securityScript 之前，保存 parent 引用
  // securityScript 会覆盖 window.parent，所以先保存真实引用用于 postMessage
  const errorCaptureScript = `<script>
(function(){var _rp=window.parent;var _errs=[];
window.onerror=function(m,s,l,c,e){
  var err={type:'artifact-error',error:m,source:(s||'').split('/').pop(),line:l,col:c,stack:e&&e.stack?e.stack.substring(0,500):''};
  _errs.push(err);if(_errs.length<=3)try{_rp.postMessage(err,'*')}catch(x){}
  return false;
};
window.onunhandledrejection=function(e){
  var m=e.reason?((e.reason.message||e.reason)+'').substring(0,300):'Promise rejected';
  var err={type:'artifact-error',error:'Unhandled Promise: '+m,source:'promise',line:0,stack:e.reason&&e.reason.stack?e.reason.stack.substring(0,500):''};
  _errs.push(err);if(_errs.length<=3)try{_rp.postMessage(err,'*')}catch(x){}
};
})();
</script>`;

  // ★ T9-4: 安全脚本 — 阻止 artifact 代码访问父窗口（在错误捕获之后）
  const securityScript = `<script>try{Object.defineProperty(window,'top',{get:function(){return window}});Object.defineProperty(window,'parent',{get:function(){return window}});}catch(e){}</script>`;

  // ★ 最先处理：从输入代码中彻底移除所有 CSP meta 标签
  // AI 生成的 CSP 往往过于严格，会阻止我们注入的 CDN 资源加载
  code = stripCspMeta(code);

  // ★ Gap 2: ESM bare import 重写（在所有分支之前处理）
  code = rewriteBareImports(code);

  // ★ 自动检测并注入常用图标库 CDN（解决预览中图标不显示的问题）
  const iconCdnLinks = detectAndInjectIconCDNs(code);

  // ★ Gap 2: 检测 type="module" 并注入 importmap
  const importMapTag = code.includes('type="module"') || code.includes("type='module'")
    ? buildImportMap() : '';

  let result: string;

  // ★ SVG 优先判定 —— 必须在 HTML 透传之前，否则被 <!DOCTYPE> 检测拦截
  if (language === 'svg' || (code.includes('<svg') && !code.includes('<div') && !code.includes('<script'))) {
    // 提取纯 SVG：如果 LLM 用 HTML 包了 SVG，剥掉外壳
    let svgCode = code;
    const svgMatch = code.match(/<svg[\s\S]*<\/svg>/i);
    if (svgMatch) svgCode = svgMatch[0];

    result = `<!DOCTYPE html><html><head><meta charset="UTF-8">${errorCaptureScript}${securityScript}
<style>*{box-sizing:border-box;margin:0;padding:0}body{display:flex;justify-content:center;align-items:center;min-height:100vh;padding:16px;background:transparent;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif}svg{max-width:100%;height:auto}</style>
</head><body>${svgCode}
<script>
(function(){try{
var isDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;
var svg=document.querySelector('svg');if(!svg)return;
function isGray(hex){if(!hex||hex==='none'||hex==='transparent')return true;hex=hex.trim().toLowerCase();
var ng=['white','black','gray','grey','darkgray','darkgrey','lightgray','lightgrey','silver','gainsboro','whitesmoke'];
if(ng.indexOf(hex)>=0)return true;
var m=hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
if(!m){var m3=hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);if(m3)m=[null,m3[1]+m3[1],m3[2]+m3[2],m3[3]+m3[3]];}
if(!m)return true;var r=parseInt(m[1],16),g=parseInt(m[2],16),b=parseInt(m[3],16);
return(Math.max(r,g,b)-Math.min(r,g,b))<35;}
function gf(el){return el.style.fill||el.getAttribute('fill')||'';}
var af=svg.querySelectorAll('[fill]'),rc=0;
for(var i=0;i<af.length;i++){if(!isGray(af[i].getAttribute('fill')))rc++;}
if(rc>=3)return;
var P={t:isDark?'#f1f5f9':'#1e1b4b',b:isDark?'#cbd5e1':'#334155',s:isDark?'#94a3b8':'#64748b',
d:isDark?'#818cf8':'#6366f1',l:isDark?'#4f46e5':'#a5b4fc',
bb:isDark?'#1e1b4b':'#eef2ff',bd:isDark?'#3730a3':'#c7d2fe',
cb:isDark?'#0f172a':'#ffffff',cd:isDark?'#1e293b':'#e0e7ff'};
var ts=svg.querySelectorAll('text');
for(var i=0;i<ts.length;i++){var t=ts[i],f=gf(t);if(f&&!isGray(f))continue;
var fs=parseFloat(t.getAttribute('font-size')||t.style.fontSize||'14');
if(fs>=18){t.style.fill=P.t;if(!t.getAttribute('font-weight')&&!t.style.fontWeight)t.style.fontWeight='700';}
else if(fs>=14){t.style.fill=P.b;if(!t.getAttribute('font-weight')&&!t.style.fontWeight)t.style.fontWeight='500';}
else{t.style.fill=P.s;}}
var cs=svg.querySelectorAll('circle');
for(var i=0;i<cs.length;i++){var c=cs[i],r=parseFloat(c.getAttribute('r')||'0');
if(r>20)continue;var f=gf(c);if(f&&!isGray(f))continue;c.style.fill=P.d;}
var ls=svg.querySelectorAll('line');
for(var i=0;i<ls.length;i++){var l=ls[i],st=l.style.stroke||l.getAttribute('stroke')||'';
if(st&&!isGray(st))continue;l.style.stroke=P.l;
if(!l.getAttribute('stroke-width'))l.style.strokeWidth='2';
if(!l.getAttribute('stroke-dasharray'))l.style.strokeDasharray='4 3';}
var rs=svg.querySelectorAll('rect');
for(var i=0;i<rs.length;i++){var rect=rs[i],rx=parseFloat(rect.getAttribute('rx')||'0'),
w=parseFloat(rect.getAttribute('width')||'0'),h=parseFloat(rect.getAttribute('height')||'0'),f=gf(rect);
if(!isGray(f))continue;
if(i===0&&w>400&&h>200){rect.style.fill=P.cb;rect.style.stroke=P.cd;rect.style.strokeWidth='1.5';
if(rx<8){rect.setAttribute('rx','12');rect.setAttribute('ry','12');}continue;}
if(rx>0&&w<200&&h<50){rect.style.fill=P.bb;rect.style.stroke=P.bd;rect.style.strokeWidth='1';}}
}catch(e){}})();
</script></body></html>`;
  } else
  // If already a full HTML doc, inject viewport meta if missing
  if (/<(!DOCTYPE|html)/i.test(code)) {
    let doc = code;
    if (!/<meta[^>]*viewport/i.test(doc)) {
      doc = doc.replace(/<head([^>]*)>/i, '<head$1><meta name="viewport" content="width=device-width,initial-scale=1.0">');
    }
    // 注入安全脚本 + 图标库到 <head> 最前面
    doc = doc.replace(/<head([^>]*)>/i, `<head$1>${errorCaptureScript}${securityScript}${importMapTag}${iconCdnLinks}`);
    result = doc;
  } else if (language === 'react') {
    result = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">${errorCaptureScript}${securityScript}${importMapTag}${iconCdnLinks}
<script src="https://cdnjs.cloudflare.com/ajax/libs/react/18.2.0/umd/react.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/react-dom/18.2.0/umd/react-dom.production.min.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/babel-standalone/7.23.9/babel.min.js"></script>
<script src="https://cdn.tailwindcss.com"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/recharts/2.15.3/Recharts.min.js"></script>
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif}</style></head><body><div id="root"></div>
<script type="text/babel">const{useState,useEffect,useRef,useMemo,useCallback}=React;${code}
const rootEl=document.getElementById('root');try{const C=typeof App!=='undefined'?App:typeof Default!=='undefined'?Default:null;if(C)ReactDOM.render(React.createElement(C),rootEl);else rootEl.innerHTML='<div style="padding:20px;color:#666">Component loaded</div>';}catch(e){rootEl.innerHTML='<pre style="color:red;padding:16px;background:#fef2f2;border-radius:8px;margin:16px">'+e.message+'</pre>';}</script></body></html>`;
  } else if (language === 'mermaid') {
    // ★ Mermaid 图表渲染
    const escapedCode = code.replace(/`/g, '\\`').replace(/<\/script>/g, '<\\/script>');
    result = `<!DOCTYPE html><html><head><meta charset="UTF-8">${errorCaptureScript}${securityScript}
<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;display:flex;justify-content:center;padding:16px;background:transparent}#mermaid-container{width:100%;overflow-x:auto}#mermaid-container svg{max-width:100%;height:auto}</style>
</head><body><div id="mermaid-container"><div id="graph"></div></div>
<script src="https://cdnjs.cloudflare.com/ajax/libs/mermaid/11.4.1/mermaid.min.js"></script>
<script>
const dark=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;
mermaid.initialize({startOnLoad:false,theme:dark?'dark':'default',fontFamily:'system-ui,-apple-system,sans-serif',securityLevel:'loose'});
mermaid.render('g',\`${escapedCode}\`).then(({svg})=>{document.getElementById('graph').innerHTML=svg;}).catch(e=>{document.getElementById('graph').innerHTML='<pre style="color:red;padding:16px">'+e.message+'</pre>';});
</script></body></html>`;
  } else if (language === 'css') {
    result = `<!DOCTYPE html><html><head><meta charset="UTF-8">${errorCaptureScript}${securityScript}${importMapTag}${iconCdnLinks}<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;padding:20px}${code}</style></head><body><h2>CSS Preview</h2><div class="demo">Box 1</div><div class="demo">Box 2</div></body></html>`;
  } else if (language === 'javascript') {
    result = `<!DOCTYPE html><html><head><meta charset="UTF-8">${errorCaptureScript}${securityScript}${importMapTag}${iconCdnLinks}<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui;padding:16px}</style></head><body><div id="app"></div><script>try{${code}}catch(e){document.body.innerHTML+='<pre style="color:red;padding:12px">'+e.message+'</pre>'}</script></body></html>`;
  } else {
    result = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">${errorCaptureScript}${securityScript}${importMapTag}${iconCdnLinks}<script src="https://cdn.tailwindcss.com"></script><style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:system-ui,-apple-system,sans-serif}</style></head><body>${code}</body></html>`;
  }

  // ★ 最终兜底：确保输出中不残留任何 CSP
  result = stripCspMeta(result);

  // ★ SVG 智能色彩增强 —— 对所有包含 <svg 的输出注入后处理脚本
  // 脚本自带安全守卫：已有 ≥3 个非灰色 fill 的 SVG 自动跳过
  if (result.includes('<svg')) {
    const svgEnhanceScript = `<script>
(function(){try{
var isDark=window.matchMedia&&window.matchMedia('(prefers-color-scheme:dark)').matches;
var svg=document.querySelector('svg');if(!svg)return;
function isGray(hex){if(!hex||hex==='none'||hex==='transparent')return true;hex=hex.trim().toLowerCase();
var ng=['white','black','gray','grey','darkgray','darkgrey','lightgray','lightgrey','silver','gainsboro','whitesmoke'];
if(ng.indexOf(hex)>=0)return true;
var m=hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/);
if(!m){var m3=hex.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);if(m3)m=[null,m3[1]+m3[1],m3[2]+m3[2],m3[3]+m3[3]];}
if(!m)return true;var r=parseInt(m[1],16),g=parseInt(m[2],16),b=parseInt(m[3],16);
return(Math.max(r,g,b)-Math.min(r,g,b))<35;}
function gf(el){return el.style.fill||el.getAttribute('fill')||'';}
var af=svg.querySelectorAll('[fill]'),rc=0;
for(var i=0;i<af.length;i++){if(!isGray(af[i].getAttribute('fill')))rc++;}
if(rc>=3)return;
var P={t:isDark?'#f1f5f9':'#1e1b4b',b:isDark?'#cbd5e1':'#334155',s:isDark?'#94a3b8':'#64748b',
d:isDark?'#818cf8':'#6366f1',l:isDark?'#4f46e5':'#a5b4fc',
bb:isDark?'#1e1b4b':'#eef2ff',bd:isDark?'#3730a3':'#c7d2fe',
cb:isDark?'#0f172a':'#ffffff',cd:isDark?'#1e293b':'#e0e7ff'};
var ts=svg.querySelectorAll('text');
for(var i=0;i<ts.length;i++){var t=ts[i],f=gf(t);if(f&&!isGray(f))continue;
var fs=parseFloat(t.getAttribute('font-size')||t.style.fontSize||'14');
if(fs>=18){t.style.fill=P.t;if(!t.getAttribute('font-weight')&&!t.style.fontWeight)t.style.fontWeight='700';}
else if(fs>=14){t.style.fill=P.b;if(!t.getAttribute('font-weight')&&!t.style.fontWeight)t.style.fontWeight='500';}
else{t.style.fill=P.s;}}
var cs=svg.querySelectorAll('circle');
for(var i=0;i<cs.length;i++){var c=cs[i],r=parseFloat(c.getAttribute('r')||'0');
if(r>20)continue;var f=gf(c);if(f&&!isGray(f))continue;c.style.fill=P.d;}
var ls=svg.querySelectorAll('line');
for(var i=0;i<ls.length;i++){var l=ls[i],st=l.style.stroke||l.getAttribute('stroke')||'';
if(st&&!isGray(st))continue;l.style.stroke=P.l;
if(!l.getAttribute('stroke-width'))l.style.strokeWidth='2';
if(!l.getAttribute('stroke-dasharray'))l.style.strokeDasharray='4 3';}
var rs=svg.querySelectorAll('rect');
for(var i=0;i<rs.length;i++){var rect=rs[i],rx=parseFloat(rect.getAttribute('rx')||'0'),
w=parseFloat(rect.getAttribute('width')||'0'),h=parseFloat(rect.getAttribute('height')||'0'),f=gf(rect);
if(!isGray(f))continue;
if(i===0&&w>400&&h>200){rect.style.fill=P.cb;rect.style.stroke=P.cd;rect.style.strokeWidth='1.5';
if(rx<8){rect.setAttribute('rx','12');rect.setAttribute('ry','12');}continue;}
if(rx>0&&w<200&&h<50){rect.style.fill=P.bb;rect.style.stroke=P.bd;rect.style.strokeWidth='1';}}
}catch(e){}})();
</script>`;
    result = result.replace('</body>', svgEnhanceScript + '</body>');
  }

  return result;
}

/** 
 * 移除 HTML 中所有可能携带 CSP 的标签
 * 核弹级清理：移除所有 http-equiv meta + 任何提及 security-policy 的 meta
 * preview iframe 中不需要任何 http-equiv 功能
 */
function stripCspMeta(html: string): string {
  return html
    // 1. 移除所有 <meta http-equiv=...> 标签（不论值是什么）
    .replace(/<meta\s[^>]*http-equiv[^>]*>/gi, '')
    // 2. 兜底：移除任何含 security-policy 文本的 meta 标签（包括 name= 变体）
    .replace(/<meta\s[^>]*security-policy[^>]*>/gi, '');
}

/**
 * ★ Gap 2: ESM bare import 重写
 * 将 `import X from "react"` 重写为 `import X from "https://esm.sh/react@18"`
 * 只处理非相对路径（不以 ./ ../ http 开头的）
 */
const ESM_PACKAGE_MAP: Record<string, string> = {
  'react': 'https://esm.sh/react@18',
  'react-dom': 'https://esm.sh/react-dom@18',
  'react-dom/client': 'https://esm.sh/react-dom@18/client',
  'react/jsx-runtime': 'https://esm.sh/react@18/jsx-runtime',
  'lodash': 'https://esm.sh/lodash-es',
  'lodash-es': 'https://esm.sh/lodash-es',
  'd3': 'https://esm.sh/d3@7',
  'three': 'https://esm.sh/three@0.160.0',
  'chart.js': 'https://esm.sh/chart.js@4',
  'chart.js/auto': 'https://esm.sh/chart.js@4/auto',
  'echarts': 'https://esm.sh/echarts@5',
  'recharts': 'https://esm.sh/recharts@2',
  'lucide-react': 'https://esm.sh/lucide-react',
  'framer-motion': 'https://esm.sh/framer-motion',
  'papaparse': 'https://esm.sh/papaparse',
  'mathjs': 'https://esm.sh/mathjs',
  'dayjs': 'https://esm.sh/dayjs',
  'axios': 'https://esm.sh/axios',
  'zustand': 'https://esm.sh/zustand',
  'classnames': 'https://esm.sh/classnames',
  'clsx': 'https://esm.sh/clsx',
  'uuid': 'https://esm.sh/uuid',
  'nanoid': 'https://esm.sh/nanoid',
};

function rewriteBareImports(code: string): string {
  // 匹配 import ... from "package" 或 import "package"（非相对/非URL）
  return code.replace(
    /(\bimport\s+(?:[\s\S]*?\s+from\s+|))(["'])([^"'./][^"']*)\2/g,
    (match, prefix, quote, pkg) => {
      // 已经是完整 URL
      if (/^https?:\/\//.test(pkg)) return match;
      // 查已知映射
      const mapped = ESM_PACKAGE_MAP[pkg];
      if (mapped) return `${prefix}${quote}${mapped}${quote}`;
      // 未知包 → 通用 esm.sh 转换
      return `${prefix}${quote}https://esm.sh/${pkg}${quote}`;
    }
  );
}

/**
 * ★ Gap 2: 为 <script type="module"> 生成 importmap
 * 浏览器原生 importmap 优先级高于 esm.sh 重写
 */
function buildImportMap(): string {
  const imports: Record<string, string> = {};
  for (const [pkg, url] of Object.entries(ESM_PACKAGE_MAP)) {
    imports[pkg] = url;
  }
  return `<script type="importmap">${JSON.stringify({ imports })}</script>`;
}

/**
 * 检测代码中使用的图标库并返回对应的 CDN <link> 标签
 * 只注入代码中用到但未自行引入的库，避免重复加载
 */
function detectAndInjectIconCDNs(code: string): string {
  const links: string[] = [];

  // Font Awesome 6 (fa-xxx, fas/far/fab/fal/fad 类名)
  if (/\bfa[srlbd]?\s+fa-|\bfa-(?:brands|solid|regular)\b|class="[^"]*\bfa\s/.test(code)) {
    if (!/font-awesome|fontawesome/i.test(code)) {
      links.push('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" crossorigin="anonymous">');
    }
  }

  // Bootstrap Icons (bi bi-xxx)
  if (/\bbi\s+bi-|\bbi-[a-z]/.test(code)) {
    if (!/bootstrap-icons/i.test(code)) {
      links.push('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/bootstrap-icons/1.11.3/font/bootstrap-icons.min.css" crossorigin="anonymous">');
    }
  }

  // Google Material Icons
  if (/\bmaterial-icons\b|\bmaterial-symbols/.test(code)) {
    if (!/fonts\.googleapis\.com\/icon|fonts\.googleapis\.com\/css.*Material/i.test(code)) {
      links.push('<link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons|Material+Icons+Outlined|Material+Icons+Round" crossorigin="anonymous">');
    }
  }

  // Remix Icon (ri-xxx)
  if (/\bri-[a-z]/.test(code)) {
    if (!/remixicon/i.test(code)) {
      links.push('<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/remixicon/4.2.0/remixicon.min.css" crossorigin="anonymous">');
    }
  }

  // Ionicons (ion-icon)
  if (/\bion-icon\b|ionicons/i.test(code)) {
    if (!/unpkg\.com\/ionicons|cdn.*ionicons/i.test(code)) {
      links.push('<script type="module" src="https://unpkg.com/ionicons@7.1.0/dist/ionicons/ionicons.esm.js"></script>');
    }
  }

  return links.length > 0 ? '\n' + links.join('\n') + '\n' : '';
}
