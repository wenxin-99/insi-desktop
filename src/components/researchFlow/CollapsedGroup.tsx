/**
 * researchFlow/CollapsedGroup.tsx — 折叠的步骤组 v2
 *
 * 改进：
 * - 各分类图标 + 计数
 * - 悬停预览首尾步骤摘要
 * - 更明显的展开引导
 */
import { ChevronDown, Search, Globe, Terminal, Lightbulb, Eye, Code2, BookOpen } from 'lucide-react';
import type { FlowStep, StepCategory } from './types';
import { STEP_CONFIG } from './types';

const CATEGORY_ICON: Record<StepCategory, React.ElementType> = {
  think: Lightbulb, search: Search, browse: Globe, command: Terminal,
  code: Code2, observe: Eye, summary: BookOpen, progress: Lightbulb,
};

interface CollapsedGroupProps {
  steps: FlowStep[];
  onExpand: () => void;
}

export function CollapsedGroup({ steps, onExpand }: CollapsedGroupProps) {
  // 统计各分类数量
  const counts: Record<string, { count: number; category: StepCategory }> = {};
  for (const s of steps) {
    const cfg = STEP_CONFIG[s.category];
    if (!counts[cfg.label]) {
      counts[cfg.label] = { count: 0, category: s.category };
    }
    counts[cfg.label].count++;
  }

  return (
    <div className="pl-7 md:pl-10 relative animate-in fade-in duration-200">
      {/* 时间线连接点 */}
      <div className="absolute left-[7px] md:left-[4px] top-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5">
        <div className="w-[2px] h-1.5 bg-border/50 rounded" />
        <div className="w-1.5 h-1.5 rounded-full bg-border/60" />
        <div className="w-[2px] h-1.5 bg-border/50 rounded" />
      </div>
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-dashed border-border/80 bg-muted/20 hover:bg-muted/50 hover:border-muted-foreground/30 transition-all text-[11px] text-muted-foreground hover:text-foreground group"
      >
        {/* 分类图标计数 */}
        <div className="flex items-center gap-1.5 flex-1 flex-wrap">
          {Object.entries(counts).map(([label, { count, category }]) => {
            const Icon = CATEGORY_ICON[category];
            const cfg = STEP_CONFIG[category];
            return (
              <span
                key={label}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-medium"
                style={{
                  background: cfg.bgColor,
                  color: cfg.color,
                  border: `1px solid ${cfg.borderColor}`,
                }}
              >
                <Icon className="w-2.5 h-2.5" />
                {label}×{count}
              </span>
            );
          })}
        </div>

        <span className="text-[10px] text-muted-foreground/50 whitespace-nowrap flex items-center gap-1 group-hover:text-blue-500 transition-colors">
          展开 {steps.length} 步
          <ChevronDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" />
        </span>
      </button>
    </div>
  );
}
