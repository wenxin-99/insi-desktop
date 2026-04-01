/**
 * researchFlow/PhaseProgress.tsx — 分阶段进度条 v2
 *
 * 改进：
 * - 渐变进度条 + 脉冲动画
 * - 阶段完成 ✓ 标记
 * - 当前阶段高亮光晕
 * - 百分比 + ETA 统一顶栏
 */
import type { TaskPhase, PhaseInfo } from './types';
import { RESEARCH_PHASES } from './types';

interface PhaseProgressProps {
  currentPhase: TaskPhase;
  progress: number;       // 0-100 当前阶段内的进度
  estimatedTime?: string; // 预估剩余时间
  totalPercent?: number;  // 全局百分比 0-100
}

const PHASE_ICONS: Record<TaskPhase, string> = {
  search: '🔍',
  analyze: '🧠',
  write: '✍️',
};

export function PhaseProgress({ currentPhase, progress, estimatedTime, totalPercent }: PhaseProgressProps) {
  const currentIdx = RESEARCH_PHASES.findIndex(p => p.key === currentPhase);
  const displayPercent = totalPercent !== undefined ? Math.min(99, Math.max(0, Math.round(totalPercent))) : undefined;

  return (
    <div className="space-y-1.5">
      {/* 顶部进度数字 */}
      {(displayPercent !== undefined || estimatedTime) && (
        <div className="flex items-center justify-between">
          {displayPercent !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-bold text-[13px] text-blue-600 dark:text-blue-400">
                {displayPercent}%
              </span>
              {/* 微型进度条 */}
              <div className="w-16 h-1 rounded-full bg-blue-100 dark:bg-blue-900/40 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${displayPercent}%`,
                    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
                  }}
                />
              </div>
            </div>
          )}
          {estimatedTime && (
            <span className="text-[10px] text-muted-foreground/70 flex items-center gap-1">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
              </svg>
              预计还需 {estimatedTime}
            </span>
          )}
        </div>
      )}

      {/* 三段式进度条 */}
      <div className="flex items-center gap-1 w-full">
        {RESEARCH_PHASES.map((phase, i) => {
          const isActive = phase.key === currentPhase;
          const isDone = i < currentIdx;
          return (
            <div key={phase.key} className="relative flex-1">
              <div
                className="h-[6px] rounded-full overflow-hidden transition-colors duration-300 relative"
                style={{
                  background: isDone
                    ? 'linear-gradient(90deg, #22c55e, #4ade80)'
                    : isActive
                    ? 'var(--phase-track, #e2e8f0)'
                    : 'var(--phase-inactive, #f1f5f9)',
                  boxShadow: isActive ? '0 0 8px rgba(59,130,246,0.15)' : undefined,
                }}
              >
                {isActive && (
                  <>
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out relative"
                      style={{
                        width: `${Math.min(100, Math.max(5, progress))}%`,
                        background: 'linear-gradient(90deg, #3b82f6, #6366f1, #8b5cf6)',
                      }}
                    />
                    {/* 脉冲光标 */}
                    <div
                      className="absolute top-0 h-full w-3 rounded-full animate-pulse"
                      style={{
                        left: `${Math.min(95, Math.max(2, progress))}%`,
                        background: 'radial-gradient(circle, rgba(99,102,241,0.6) 0%, transparent 70%)',
                      }}
                    />
                  </>
                )}
              </div>
              {/* 阶段标签 */}
              <div className="flex items-center justify-center gap-0.5 mt-1">
                {isDone && (
                  <svg className="w-3 h-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                <span
                  className={`text-[9px] font-medium transition-colors ${
                    isActive
                      ? 'text-blue-600 dark:text-blue-400'
                      : isDone
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : 'text-muted-foreground/40'
                  }`}
                >
                  {PHASE_ICONS[phase.key]} {phase.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* 当前阶段描述 */}
      <div className="text-[10px] text-muted-foreground/50 text-center">
        {currentPhase === 'search' && '正在搜索和收集相关资料...'}
        {currentPhase === 'analyze' && '正在分析和归纳搜索结果...'}
        {currentPhase === 'write' && '正在撰写研究报告...'}
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
