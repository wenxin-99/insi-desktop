/**
 * researchFlow/PhaseProgress.tsx — 分阶段进度条
 *
 * 搜索 → 分析 → 撰写 三段式进度，替代模糊百分比。
 * 当前阶段有动画，完成阶段变绿。
 */
import type { TaskPhase, PhaseInfo } from './types';
import { RESEARCH_PHASES } from './types';

interface PhaseProgressProps {
  currentPhase: TaskPhase;
  progress: number;       // 0-100 当前阶段内的进度
  estimatedTime?: string; // 预估剩余时间
}

export function PhaseProgress({ currentPhase, progress, estimatedTime }: PhaseProgressProps) {
  const currentIdx = RESEARCH_PHASES.findIndex(p => p.key === currentPhase);

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-0.5 w-full">
        {RESEARCH_PHASES.map((phase, i) => {
          const isActive = phase.key === currentPhase;
          const isDone = i < currentIdx;
          return (
            <div key={phase.key} className="relative" style={{ width: `${phase.weight * 100}%` }}>
              <div
                className="h-[5px] rounded-full overflow-hidden transition-colors duration-300"
                style={{
                  background: isDone
                    ? '#22c55e'
                    : isActive
                    ? 'var(--phase-track, #e2e8f0)'
                    : 'var(--phase-inactive, #f1f5f9)',
                }}
              >
                {isActive && (
                  <div
                    className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{
                      width: `${Math.min(100, Math.max(5, progress))}%`,
                      background: 'linear-gradient(90deg, #3b82f6, #6366f1)',
                    }}
                  />
                )}
              </div>
              <span
                className={`text-[9px] mt-0.5 block text-center font-medium transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400'
                    : isDone
                    ? 'text-emerald-600 dark:text-emerald-400'
                    : 'text-muted-foreground/40'
                }`}
              >
                {phase.label}
              </span>
            </div>
          );
        })}
      </div>
      {/* 阶段描述 + 预估时间 */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60">
        <span>
          {currentPhase === 'search' && '搜索相关资料'}
          {currentPhase === 'analyze' && '分析搜索结果'}
          {currentPhase === 'write' && '撰写研究报告'}
        </span>
        {estimatedTime && <span>{estimatedTime}</span>}
      </div>

      {/* Dark mode variables */}
      <style>{`
        .dark [style*="--phase-track"] {
          --phase-track: rgba(30, 41, 59, 0.8) !important;
          --phase-inactive: rgba(30, 41, 59, 0.4) !important;
        }
      `}</style>
    </div>
  );
}
