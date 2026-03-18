/**
 * researchFlow/StepBubble.tsx — 单步气泡渲染
 *
 * 每种步骤类型一个专用气泡，用分类色块 + 图标区分。
 * 整体嵌在左侧时间线竖线内。
 *
 * 改进点：
 * - 浏览气泡展示实际截图缩略图
 * - 终端气泡支持展开/收起
 * - 完善 dark mode
 */
import { useState } from 'react';
import { Search, Eye, Globe, Lightbulb, Terminal, Code2, BookOpen, Zap, ChevronDown, ChevronUp } from 'lucide-react';
import type { FlowStep, StepCategory } from './types';
import { STEP_CONFIG } from './types';

// ── 分类图标映射 ──
const CATEGORY_ICON: Record<StepCategory, React.ElementType> = {
  think: Lightbulb,
  search: Search,
  browse: Globe,
  command: Terminal,
  code: Code2,
  observe: Eye,
  summary: BookOpen,
  progress: Zap,
};

// ── 通用外壳 ──
function StepShell({
  category,
  elapsed,
  isActive,
  children,
}: {
  category: StepCategory;
  elapsed: string;
  isActive?: boolean;
  children: React.ReactNode;
}) {
  const cfg = STEP_CONFIG[category];
  const Icon = CATEGORY_ICON[category];
  return (
    <div className="group relative pl-7 md:pl-10 animate-in fade-in slide-in-from-bottom-1 duration-300">
      {/* 时间线圆点 */}
      <div
        className="absolute left-[-2px] md:left-[-5px] top-[3px] w-[20px] h-[20px] md:w-[28px] md:h-[28px] rounded-full flex items-center justify-center border-2 z-10"
        style={{
          background: isActive ? cfg.color : undefined,
          borderColor: isActive ? cfg.color : cfg.borderColor,
          boxShadow: isActive ? `0 0 0 3px ${cfg.color}20` : undefined,
        }}
      >
        <div
          className="w-[20px] h-[20px] md:w-[28px] md:h-[28px] rounded-full flex items-center justify-center"
          style={{
            background: isActive ? cfg.color : cfg.bgColor,
          }}
        >
          <Icon className="w-2.5 h-2.5 md:w-4 md:h-4" style={{ color: isActive ? '#fff' : cfg.color }} />
        </div>
      </div>
      {/* 气泡内容 */}
      <div
        className="rounded-xl px-3 py-2 border transition-colors"
        style={{
          background: `var(--step-bg, ${cfg.bgColor})`,
          borderColor: `var(--step-border, ${cfg.borderColor})`,
          // @ts-ignore CSS custom properties for dark mode
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
          <span
            className="text-[10px] md:text-[12px] font-semibold uppercase tracking-wide"
            style={{ color: cfg.color }}
          >
            {cfg.label}
          </span>
          <span className="text-[9px] text-muted-foreground/60 tabular-nums">{elapsed}</span>
        </div>
        {children}
      </div>
    </div>
  );
}

// ── 格式化时间 ──
function fmtElapsed(ms: number, baseTime: number): string {
  const s = Math.max(0, Math.round((ms - baseTime) / 1000));
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, '0')}s`;
}

// ══════ 各类步骤气泡 ══════

export function SearchBubble({
  step,
  baseTime,
}: {
  step: FlowStep;
  baseTime: number;
}) {
  const elapsed = fmtElapsed(step.timestamp, baseTime);
  return (
    <StepShell category="search" elapsed={elapsed}>
      <p className="text-[12.5px] text-foreground/80 font-mono leading-relaxed truncate">
        {step.title}
      </p>
      {step.detail && step.detail !== step.title && (
        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">{step.detail}</p>
      )}
    </StepShell>
  );
}

export function BrowseBubble({
  step,
  baseTime,
  onOpenSandbox,
}: {
  step: FlowStep;
  baseTime: number;
  onOpenSandbox?: (taskId: number) => void;
}) {
  const elapsed = fmtElapsed(step.timestamp, baseTime);
  const hasScreenshot = !!(step.screenshotBase64 || step.screenshot);

  return (
    <StepShell category="browse" elapsed={elapsed}>
      <div className="flex items-start gap-2.5">
        {/* 截图缩略图：有截图显示实际截图，无截图显示占位 */}
        <div
          className="w-20 h-14 rounded-md border border-indigo-200/60 dark:border-indigo-700/30 shrink-0 overflow-hidden cursor-pointer group/thumb relative"
          onClick={() => onOpenSandbox?.(0)}
        >
          {hasScreenshot ? (
            <>
              <img
                src={`data:image/jpeg;base64,${step.screenshotBase64 || step.screenshot}`}
                alt=""
                className="w-full h-full object-cover object-top group-hover/thumb:brightness-90 transition-all"
                draggable={false}
              />
              <div className="absolute inset-0 bg-black/0 group-hover/thumb:bg-black/10 transition-colors flex items-center justify-center">
                <span className="opacity-0 group-hover/thumb:opacity-100 text-[8px] text-white bg-black/50 px-1.5 py-0.5 rounded-full transition-opacity">
                  查看
                </span>
              </div>
            </>
          ) : (
            <div className="w-full h-full bg-white/60 dark:bg-white/5 flex items-center justify-center">
              <Globe className="w-4 h-4 text-indigo-300 dark:text-indigo-600" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] text-foreground/80 font-medium truncate">{step.title}</p>
          {step.url && (
            <p className="text-[10.5px] text-muted-foreground/60 font-mono truncate mt-0.5">{step.url}</p>
          )}
        </div>
      </div>
    </StepShell>
  );
}

export function ThinkBubble({
  step,
  baseTime,
}: {
  step: FlowStep;
  baseTime: number;
}) {
  const elapsed = fmtElapsed(step.timestamp, baseTime);
  return (
    <StepShell category="think" elapsed={elapsed}>
      <p className="text-[12px] text-foreground/70 leading-relaxed line-clamp-3">
        {step.detail || step.title}
      </p>
    </StepShell>
  );
}

export function ObserveBubble({
  step,
  baseTime,
}: {
  step: FlowStep;
  baseTime: number;
}) {
  const elapsed = fmtElapsed(step.timestamp, baseTime);
  return (
    <StepShell category="observe" elapsed={elapsed}>
      <p className="text-[12px] text-foreground/70 leading-relaxed line-clamp-2">
        {step.detail || step.title}
      </p>
    </StepShell>
  );
}

export function CommandBubble({
  step,
  baseTime,
  onOpenSandbox,
}: {
  step: FlowStep;
  baseTime: number;
  onOpenSandbox?: (taskId: number) => void;
}) {
  const elapsed = fmtElapsed(step.timestamp, baseTime);
  const cmdText = step.detail || step.title;
  const isLong = cmdText.length > 100;
  const [expanded, setExpanded] = useState(false);

  return (
    <StepShell category="command" elapsed={elapsed}>
      <div
        className="bg-gray-900 dark:bg-gray-950 rounded-md px-2.5 py-1.5 font-mono text-[11px] leading-5 cursor-pointer hover:brightness-110 transition-all"
        onClick={() => isLong ? setExpanded(!expanded) : onOpenSandbox?.(0)}
      >
        <span className="text-emerald-400">$ </span>
        <span className="text-gray-200 break-all">
          {expanded || !isLong ? cmdText : cmdText.slice(0, 80) + '...'}
        </span>
        {isLong && (
          <span className="text-gray-500 text-[9px] ml-1 inline-flex items-center gap-0.5">
            {expanded ? <ChevronUp className="w-2.5 h-2.5" /> : <ChevronDown className="w-2.5 h-2.5" />}
          </span>
        )}
      </div>
    </StepShell>
  );
}

export function WritingBubble({
  step,
  baseTime,
  progress,
}: {
  step: FlowStep;
  baseTime: number;
  progress: number;
}) {
  const elapsed = fmtElapsed(step.timestamp, baseTime);
  return (
    <StepShell category="summary" elapsed={elapsed} isActive>
      <div className="space-y-1.5">
        <p className="text-[12px] text-foreground/70">{step.title || '正在撰写研究报告...'}</p>
        <div className="h-1.5 rounded-full bg-purple-100 dark:bg-purple-900/30 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${Math.min(95, Math.max(10, progress))}%`,
              background: 'linear-gradient(90deg, #7c3aed, #a78bfa)',
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground/50">预计还需 ~1 分钟</p>
      </div>
    </StepShell>
  );
}

// ══════ 统一渲染入口 ══════

export function StepBubble({
  step,
  baseTime,
  isLast,
  progress,
  onOpenSandbox,
}: {
  step: FlowStep;
  baseTime: number;
  isLast: boolean;
  progress: number;
  onOpenSandbox?: (taskId: number) => void;
}) {
  switch (step.category) {
    case 'search':
      return <SearchBubble step={step} baseTime={baseTime} />;
    case 'browse':
      return <BrowseBubble step={step} baseTime={baseTime} onOpenSandbox={onOpenSandbox} />;
    case 'think':
      return <ThinkBubble step={step} baseTime={baseTime} />;
    case 'observe':
      return <ObserveBubble step={step} baseTime={baseTime} />;
    case 'command':
      return <CommandBubble step={step} baseTime={baseTime} onOpenSandbox={onOpenSandbox} />;
    case 'summary':
      return <WritingBubble step={step} baseTime={baseTime} progress={progress} />;
    default:
      return <ThinkBubble step={step} baseTime={baseTime} />;
  }
}
