/**
 * researchFlow/CollapsedGroup.tsx — 折叠的步骤组
 *
 * 当步骤数量超过阈值时，中间步骤折叠为一行摘要。
 * 显示各分类计数，点击展开全部。
 */
import { ChevronDown } from 'lucide-react';
import type { FlowStep } from './types';
import { STEP_CONFIG } from './types';

interface CollapsedGroupProps {
  steps: FlowStep[];
  onExpand: () => void;
}

export function CollapsedGroup({ steps, onExpand }: CollapsedGroupProps) {
  // 统计各分类数量
  const counts: Record<string, number> = {};
  for (const s of steps) {
    const label = STEP_CONFIG[s.category]?.label || '步骤';
    counts[label] = (counts[label] || 0) + 1;
  }
  const summary = Object.entries(counts)
    .map(([k, v]) => `${k}×${v}`)
    .join('  ');

  return (
    <div className="pl-7 md:pl-10 relative animate-in fade-in duration-200">
      {/* 时间线连接点 */}
      <div className="absolute left-[8px] top-1/2 -translate-y-1/2 w-[2px] h-4 bg-border rounded" />
      <button
        onClick={onExpand}
        className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border border-dashed border-border bg-muted/30 hover:bg-muted/60 hover:border-muted-foreground/30 transition-all text-[11px] text-muted-foreground hover:text-foreground group"
      >
        <span className="flex-1 text-left">
          已折叠 {steps.length} 个步骤 — {summary}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-muted-foreground/70 transition-colors" />
      </button>
    </div>
  );
}
