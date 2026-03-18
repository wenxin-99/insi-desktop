/**
 * automationCard/TaskProgress — 纯气泡流式步骤展示
 *
 * 与 researchFlow 完全统一的风格，无 Card 包裹。
 * 控制按钮（暂停/停止）收纳到底部迷你控制条。
 */
import { useState, useEffect, useRef, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Bot, Loader2, CheckCircle2, XCircle, Clock,
  ChevronDown, ChevronUp, Pause, Play, Square,
  Lightbulb, Globe, Terminal, Eye,
  Keyboard, Send, LogIn, ExternalLink, MousePointer,
} from "lucide-react";
import { toast } from "sonner";

import type { TaskProgressProps, StepItem } from "./types";
import { callTaskControl } from "./types";

// ═══════ 气泡系统 ═══════

type BubbleCategory = 'think' | 'browse' | 'command' | 'observe' | 'login' | 'post' | 'input';

const BUBBLE_CONFIG: Record<BubbleCategory, {
  label: string; color: string; bgColor: string; borderColor: string;
  darkBgColor: string; darkBorderColor: string; icon: React.ElementType;
}> = {
  think:   { label: '思考', color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a', darkBgColor: 'rgba(120,53,15,0.12)', darkBorderColor: 'rgba(253,230,138,0.15)', icon: Lightbulb },
  browse:  { label: '浏览', color: '#6366f1', bgColor: '#eef2ff', borderColor: '#c7d2fe', darkBgColor: 'rgba(67,56,202,0.12)', darkBorderColor: 'rgba(199,210,254,0.15)', icon: Globe },
  command: { label: '终端', color: '#0891b2', bgColor: '#ecfeff', borderColor: '#a5f3fc', darkBgColor: 'rgba(14,116,144,0.12)', darkBorderColor: 'rgba(165,243,252,0.15)', icon: Terminal },
  observe: { label: '分析', color: '#059669', bgColor: '#ecfdf5', borderColor: '#a7f3d0', darkBgColor: 'rgba(6,95,70,0.12)',   darkBorderColor: 'rgba(167,243,208,0.15)', icon: Eye },
  login:   { label: '登录', color: '#3b82f6', bgColor: '#eff6ff', borderColor: '#bfdbfe', darkBgColor: 'rgba(30,64,175,0.12)', darkBorderColor: 'rgba(191,219,254,0.15)', icon: LogIn },
  post:    { label: '发布', color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#ddd6fe', darkBgColor: 'rgba(91,33,182,0.12)', darkBorderColor: 'rgba(221,214,254,0.15)', icon: Send },
  input:   { label: '输入', color: '#0891b2', bgColor: '#ecfeff', borderColor: '#a5f3fc', darkBgColor: 'rgba(14,116,144,0.12)', darkBorderColor: 'rgba(165,243,252,0.15)', icon: Keyboard },
};

interface FlowStep {
  id: string;
  category: BubbleCategory;
  title: string;
  detail?: string;
  elapsed: string;
}

// ── 转换 ──
function toFlowStep(step: StepItem, baseTime: number): FlowStep {
  const catMap: Record<string, BubbleCategory> = {
    navigate: 'browse', login: 'login', captcha: 'observe',
    click: 'command', type: 'input', post: 'post',
    thought: 'think', error: 'observe', action: 'command',
  };
  const s = Math.max(0, Math.round((step.timestamp - baseTime) / 1000));
  const elapsed = s < 60 ? `${s}s` : `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, '0')}s`;
  return {
    id: `auto-${step.id}`,
    category: catMap[step.type] || 'think',
    title: step.content,
    detail: step.content,
    elapsed,
  };
}

// ── 气泡外壳 ──
function BubbleShell({ category, elapsed, children }: {
  category: BubbleCategory; elapsed: string; children: React.ReactNode;
}) {
  const cfg = BUBBLE_CONFIG[category];
  const Icon = cfg.icon;
  return (
    <div className="group relative pl-7 md:pl-10 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div
        className="absolute left-[-2px] md:left-[-5px] top-[3px] w-[20px] h-[20px] md:w-[28px] md:h-[28px] rounded-full flex items-center justify-center border-2 z-10"
        style={{ borderColor: cfg.borderColor }}
      >
        <div
          className="w-[20px] h-[20px] md:w-[28px] md:h-[28px] rounded-full flex items-center justify-center"
          style={{ background: cfg.bgColor }}
        >
          <Icon className="w-2.5 h-2.5 md:w-4 md:h-4" style={{ color: cfg.color }} />
        </div>
      </div>
      <div
        className="rounded-xl px-3 py-2 border transition-colors"
        style={{
          background: `var(--step-bg, ${cfg.bgColor})`,
          borderColor: `var(--step-border, ${cfg.borderColor})`,
          '--step-bg': cfg.bgColor,
          '--step-border': cfg.borderColor,
        } as React.CSSProperties}
      >
        <style>{`
          .dark [style*="--step-bg"] {
            --step-bg: ${cfg.darkBgColor} !important;
            --step-border: ${cfg.darkBorderColor} !important;
          }
        `}</style>
        <div className="flex items-center justify-between mb-0.5">
          <span className="text-[10px] md:text-[12px] font-semibold uppercase tracking-wide" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
          <span className="text-[9px] text-muted-foreground/60 tabular-nums">{elapsed}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── 单步气泡 ──
function AutoStepBubble({ step }: { step: FlowStep }) {
  const [expanded, setExpanded] = useState(false);
  const isTerminal = step.category === 'command' || step.category === 'input';
  const text = step.detail || step.title;
  const isLong = text.length > 100;

  if (isTerminal) {
    return (
      <BubbleShell category={step.category} elapsed={step.elapsed}>
        <div
          className="bg-gray-900 dark:bg-gray-950 rounded-md px-2.5 py-1.5 font-mono text-[11px] leading-5 cursor-pointer hover:brightness-110 transition-all"
          onClick={() => isLong && setExpanded(!expanded)}
        >
          <span className="text-emerald-400">$ </span>
          <span className="text-gray-200 break-all">
            {expanded || !isLong ? text : text.slice(0, 80) + '...'}
          </span>
          {isLong && (
            <span className="text-gray-500 text-[9px] ml-1 inline-flex items-center gap-0.5">
              {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
            </span>
          )}
        </div>
      </BubbleShell>
    );
  }

  return (
    <BubbleShell category={step.category} elapsed={step.elapsed}>
      <p className="text-[12px] text-foreground/70 leading-relaxed line-clamp-3">
        {text}
      </p>
    </BubbleShell>
  );
}

// ── 折叠组 ──
function CollapsedSteps({ steps, onExpand }: { steps: FlowStep[]; onExpand: () => void }) {
  const counts: Record<string, number> = {};
  for (const s of steps) {
    const label = BUBBLE_CONFIG[s.category]?.label || '步骤';
    counts[label] = (counts[label] || 0) + 1;
  }
  const summary = Object.entries(counts).map(([k, v]) => `${k}×${v}`).join('  ');

  return (
    <div className="pl-7 md:pl-10 relative animate-in fade-in duration-200">
      <div className="absolute left-[8px] top-1/2 -translate-y-1/2 w-[2px] h-4 bg-border rounded" />
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-border bg-muted/30 hover:bg-muted/60 hover:border-muted-foreground/30 transition-all text-[11px] text-muted-foreground hover:text-foreground group"
      >
        <span className="flex-1 text-left">已折叠 {steps.length} 个步骤 — {summary}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
      </button>
    </div>
  );
}

// ═══════ 折叠阈值 ═══════
const COLLAPSE_THRESHOLD = 5;
const VISIBLE_HEAD = 2;
const VISIBLE_TAIL = 3;

// ═══════ 主组件 ═══════

export function TaskProgress({
  steps, taskId, taskName, siteName, status,
  isConnected = false, progress = 0, currentStep = "",
  taskSummary = null, contentInfo = null,
  initialLoaded = false, thinking = "", browserUrl = "",
  browserScreenshot = "",
}: TaskProgressProps) {
  const [collapsed, setCollapsed] = useState(true);
  const [userExpanded, setUserExpanded] = useState(false);
  const [expandedPreview, setExpandedPreview] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isFinished = ["completed", "failed", "cancelled"].includes(status);
  const isRunning = status === "running" || status === "pending";

  // ═══ 转换步骤 ═══
  const baseTime = steps.length > 0 ? steps[0].timestamp : Date.now();
  const lastTime = steps.length > 0 ? steps[steps.length - 1].timestamp : Date.now();
  const flowSteps = useMemo<FlowStep[]>(() => steps.map(s => toFlowStep(s, baseTime)), [steps, baseTime]);

  // ═══ 折叠逻辑 ═══
  const renderItems = useMemo(() => {
    if (!collapsed || flowSteps.length <= COLLAPSE_THRESHOLD + 1) {
      return flowSteps.map(s => ({ type: 'step' as const, step: s }));
    }
    const head = flowSteps.slice(0, VISIBLE_HEAD);
    const tail = flowSteps.slice(-VISIBLE_TAIL);
    const middle = flowSteps.slice(VISIBLE_HEAD, flowSteps.length - VISIBLE_TAIL);
    const items: Array<{ type: 'step'; step: FlowStep } | { type: 'collapsed'; steps: FlowStep[] }> = [];
    head.forEach(s => items.push({ type: 'step', step: s }));
    if (middle.length > 0) items.push({ type: 'collapsed', steps: middle });
    tail.forEach(s => items.push({ type: 'step', step: s }));
    return items;
  }, [flowSteps, collapsed]);

  // 自动滚动
  useEffect(() => {
    if (bottomRef.current && !isFinished) {
      bottomRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [flowSteps.length, isFinished]);

  // 完成后自动折叠
  useEffect(() => {
    if (isFinished && !userExpanded) setCollapsed(true);
  }, [isFinished, userExpanded]);

  // ═══ 时间格式化 ═══
  const formatDuration = (ms: number): string => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, '0')}s`;
  };
  const duration = formatDuration(lastTime - baseTime);

  // ═══ 完成信息 ═══
  const publishedUrl = contentInfo?.publishedUrl || taskSummary?.contentInfo?.publishedUrl || taskSummary?.finalUrl;
  const publishStatus = contentInfo?.publishStatus || taskSummary?.contentInfo?.publishStatus;
  const postTitle = contentInfo?.title || taskSummary?.contentInfo?.title || taskSummary?.finalTitle;
  const contentLength = contentInfo?.content?.length || taskSummary?.contentInfo?.contentLength || 0;
  const contentPreview = contentInfo?.content?.substring(0, 150) || taskSummary?.contentInfo?.contentPreview || "";

  // ═══ 渲染 ═══
  return (
    <div className="w-full space-y-2">
      {/* ═══ 步骤时间线 ═══ */}
      {flowSteps.length > 0 && (
        <div className="relative">
          <div className="absolute left-[8px] md:left-[9px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-border via-border to-transparent" />
          <div className="space-y-2">
            {renderItems.map((item) => {
              if (item.type === 'collapsed') {
                return (
                  <CollapsedSteps
                    key="collapsed"
                    steps={item.steps}
                    onExpand={() => { setCollapsed(false); setUserExpanded(true); }}
                  />
                );
              }
              return <AutoStepBubble key={item.step.id} step={item.step} />;
            })}

            {/* 运行中加载指示器 */}
            {isRunning && (
              <div className="pl-7 md:pl-10 relative animate-in fade-in duration-200">
                <div className="absolute left-[-2px] md:left-[-5px] top-[3px] w-[20px] h-[20px] md:w-[28px] md:h-[28px] rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center z-10">
                  <Loader2 className="w-2.5 h-2.5 md:w-4 md:h-4 animate-spin text-blue-500" />
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-[11px] text-blue-500 dark:text-blue-400 animate-pulse">
                    {thinking || currentStep || '执行中...'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 等待中（无步骤） */}
      {flowSteps.length === 0 && isRunning && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/60">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          <span className="text-[12px] text-muted-foreground">正在启动自动化任务...</span>
        </div>
      )}

      {/* 当前思考（实时气泡） */}
      {isRunning && thinking && (
        <div className="pl-7">
          <div className="rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-800/20 px-3 py-2">
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] text-amber-500 mt-0.5">💡</span>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70 line-clamp-2 leading-relaxed">
                {thinking}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ═══ 内联浏览器预览（移动端替代浮动沙箱卡片） ═══ */}
      {browserScreenshot && isRunning && (
        <div className="rounded-xl border border-blue-200/50 dark:border-blue-800/30 bg-blue-50/30 dark:bg-blue-950/10 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-1.5 border-b border-blue-200/30 dark:border-blue-800/20">
            <Globe className="w-3 h-3 text-blue-500" />
            <span className="text-[10px] font-medium text-blue-600 dark:text-blue-400">浏览器实况</span>
            {isConnected && (
              <span className="flex items-center gap-1 ml-auto">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[9px] text-green-600 dark:text-green-400">已连接</span>
              </span>
            )}
          </div>
          <div className="relative">
            <img
              src={`data:image/jpeg;base64,${browserScreenshot}`}
              alt="浏览器预览"
              className="w-full h-auto max-h-[200px] object-cover object-top"
              draggable={false}
            />
            {browserUrl && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-2.5 py-1">
                <span className="text-[10px] text-white/70 font-mono truncate block">{browserUrl}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ 运行中控制条 ═══ */}
      {(status === "running" || status === "paused" || status === "pending") && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/30 border border-border/60">
          {status === "running" && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500 shrink-0" />}
          {status === "paused" && <Pause className="w-3.5 h-3.5 text-yellow-500 shrink-0" />}
          {status === "pending" && <Clock className="w-3.5 h-3.5 text-gray-400 shrink-0" />}
          <span className="text-[11px] text-muted-foreground truncate flex-1">
            {status === "paused" ? "任务已暂停" : status === "pending" ? "等待执行..." : currentStep || "执行中..."}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {status === "running" && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                onClick={async () => { try { await callTaskControl(taskId, "pause"); toast.success("已暂停"); } catch (e: any) { toast.error(e.message); } }}>
                <Pause className="h-3 w-3 mr-0.5" /> 暂停
              </Button>
            )}
            {status === "paused" && (
              <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-green-600 hover:text-green-700 hover:bg-green-50"
                onClick={async () => { try { await callTaskControl(taskId, "resume"); toast.success("已继续"); } catch (e: any) { toast.error(e.message); } }}>
                <Play className="h-3 w-3 mr-0.5" /> 继续
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-6 px-2 text-[10px] text-red-500 hover:text-red-600 hover:bg-red-50"
              onClick={async () => {
                if (!confirm("确定要停止该任务吗？")) return;
                try { await callTaskControl(taskId, "cancel"); toast.success("已停止"); } catch (e: any) { toast.error(e.message); }
              }}>
              <Square className="h-3 w-3 mr-0.5" /> 停止
            </Button>
          </div>
        </div>
      )}

      {/* ═══ 完成/失败总结 ═══ */}
      {isFinished && (
        <div className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border ${
          (status === 'completed' || publishStatus === 'published')
            ? 'bg-emerald-50/50 dark:bg-emerald-950/10 border-emerald-200/50'
            : 'bg-red-50/50 dark:bg-red-950/10 border-red-200/50'
        }`}>
          {(status === 'completed' || publishStatus === 'published')
            ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            : <XCircle className="w-4 h-4 text-red-500 shrink-0" />}
          <span className={`text-sm font-medium ${
            (status === 'completed' || publishStatus === 'published') ? 'text-emerald-700 dark:text-emerald-400' : 'text-red-700 dark:text-red-400'
          }`}>
            {publishStatus === 'published' ? '发布成功' : status === 'completed' ? '任务完成' : '任务失败'}
          </span>
          <div className="ml-auto flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {duration}</span>
            <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> {flowSteps.length}步</span>
          </div>
        </div>
      )}

      {/* 发布详情（完成后显示） */}
      {isFinished && status === 'completed' && (postTitle || publishedUrl || contentPreview) && (
        <div className="rounded-xl border border-green-200/50 dark:border-green-800/30 bg-green-50/30 dark:bg-green-950/10 px-4 py-3 space-y-2">
          {postTitle && (
            <div className="flex items-start gap-2">
              <Bot className="h-3.5 w-3.5 text-green-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground">帖子标题</div>
                <div className="text-sm font-medium truncate">{postTitle}</div>
              </div>
            </div>
          )}
          {publishedUrl && (
            <div className="flex items-start gap-2">
              <ExternalLink className="h-3.5 w-3.5 text-blue-600 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground">发布地址</div>
                <a href={publishedUrl} target="_blank" rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-700 hover:underline truncate block">
                  {publishedUrl}
                </a>
              </div>
            </div>
          )}
          {contentPreview && (
            <div className="flex items-start gap-2">
              <Bot className="h-3.5 w-3.5 text-gray-500 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[10px] text-muted-foreground">
                  内容摘要{contentLength > 0 && ` (${contentLength}字)`}
                </div>
                <p
                  className={`text-xs text-foreground/70 mt-0.5 cursor-pointer hover:text-foreground/90 transition-colors ${expandedPreview ? '' : 'line-clamp-2'}`}
                  onClick={() => setExpandedPreview(v => !v)}
                  title={expandedPreview ? '点击收起' : '点击展开'}
                >
                  {contentPreview.replace(/[#*>`\-]/g, '').trim()}{!expandedPreview && contentPreview.length >= 150 ? '...' : ''}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
