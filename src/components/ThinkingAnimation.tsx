import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Lightbulb, Brain, PenLine, CheckCircle2, Clock } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThinkingAnimationProps {
  elapsedTime: number;
  /** 当前思考阶段（可选，从外部传入以获得更精确的阶段判断） */
  thinkingStage?: 'idle' | 'reasoning' | 'generating' | 'error';
  /** 是否有操作日志（有的话说明已进入分析阶段） */
  hasOperations?: boolean;
}

// ═══════ 三段式阶段配置 ═══════
const PHASES = [
  { id: "understand", label: "理解问题", icon: Lightbulb, color: "#f59e0b" },
  { id: "analyze",   label: "分析推理", icon: Brain,     color: "#8b5cf6" },
  { id: "generate",  label: "生成回答", icon: PenLine,   color: "#3b82f6" },
] as const;

type PhaseId = typeof PHASES[number]['id'];

// ═══════ 多样化状态文案池 ═══════
const STATUS_TEXTS: Record<PhaseId, string[]> = {
  understand: [
    '正在理解你的问题...',
    '解析问题关键信息...',
    '识别问题意图...',
    '梳理问题要点...',
  ],
  analyze: [
    '深度分析推理中...',
    '检索相关知识...',
    '多角度分析中...',
    '构建推理链路...',
  ],
  generate: [
    '正在生成回答...',
    '组织语言输出...',
    '整合分析结果...',
    '精炼回答内容...',
  ],
};

/**
 * AI思考动画组件 — 三段式阶段进度
 * 替代原有的"三个弹跳圆点"，让用户清楚知道AI走到哪一步
 */
export function ThinkingAnimation({ elapsedTime, thinkingStage, hasOperations }: ThinkingAnimationProps) {
  const { t } = useTranslation();

  // 根据时间和外部状态推断当前阶段
  const { currentPhase, completedPhases } = useMemo(() => {
    let current: PhaseId = 'understand';
    const completed: PhaseId[] = [];

    if (thinkingStage === 'reasoning') {
      current = 'analyze';
      completed.push('understand');
    } else if (thinkingStage === 'generating') {
      current = 'generate';
      completed.push('understand', 'analyze');
    } else if (hasOperations) {
      current = 'analyze';
      completed.push('understand');
    } else {
      // 纯时间推断
      if (elapsedTime < 1.5) {
        current = 'understand';
      } else if (elapsedTime < 6) {
        current = 'analyze';
        completed.push('understand');
      } else {
        current = 'generate';
        completed.push('understand', 'analyze');
      }
    }

    return { currentPhase: current, completedPhases: completed };
  }, [elapsedTime, thinkingStage, hasOperations]);

  // 当前阶段的提示文案（每阶段随机选一条，阶段切换时才变化）
  const statusText = useMemo(() => {
    const texts = STATUS_TEXTS[currentPhase];
    const idx = Math.floor(Math.random() * texts.length);
    return texts[idx];
  }, [currentPhase]);

  return (
    <div className="py-2">
      {/* 三段式阶段进度 */}
      <div className="flex items-center gap-1 mb-3">
        {PHASES.map((phase, idx) => {
          const Icon = phase.icon;
          const isActive = currentPhase === phase.id;
          const isCompleted = completedPhases.includes(phase.id);

          return (
            <div key={phase.id} className="flex items-center gap-1 flex-1 min-w-0">
              {/* 阶段节点 */}
              <div className={cn(
                "flex items-center gap-1.5 px-2 py-1 rounded-lg transition-all duration-500",
                isActive && "bg-primary/5 dark:bg-white/5"
              )}
                style={isActive ? { boxShadow: `0 0 12px -2px ${phase.color}30` } : undefined}
              >
                <div className="relative shrink-0">
                  {isActive ? (
                    <div className="relative">
                      <Icon className="w-3.5 h-3.5" style={{ color: phase.color }} />
                      <div
                        className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full animate-pulse"
                        style={{ background: phase.color }}
                      />
                    </div>
                  ) : isCompleted ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                  ) : (
                    <div className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/20" />
                  )}
                </div>
                <span className={cn(
                  "text-[11px] font-medium transition-colors duration-300 whitespace-nowrap",
                  isActive && "text-foreground",
                  isCompleted && "text-muted-foreground",
                  !isActive && !isCompleted && "text-muted-foreground/40"
                )}>
                  {phase.label}
                </span>
              </div>

              {/* 连接线 */}
              {idx < PHASES.length - 1 && (
                <div className="flex-1 h-px mx-0.5 relative min-w-[12px]">
                  <div className="absolute inset-0 bg-border rounded-full" />
                  {(isCompleted || isActive) && (
                    <div
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: isCompleted ? '100%' : '50%',
                        background: `linear-gradient(90deg, ${phase.color}80, ${PHASES[idx + 1]?.color || phase.color}60)`,
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {/* 已用时间 */}
        {elapsedTime > 0 && (
          <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground/50 ml-1 shrink-0">
            <Clock className="w-3 h-3" />
            {elapsedTime.toFixed(1)}s
          </div>
        )}
      </div>

      {/* 当前状态文字 + 旋转指示器 */}
      <div className="flex items-center gap-2.5">
        <div className="relative shrink-0">
          <div
            className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: PHASES.find(p => p.id === currentPhase)?.color || '#3b82f6', borderTopColor: 'transparent' }}
          />
        </div>
        <span className="text-sm text-muted-foreground">{statusText}</span>
      </div>
    </div>
  );
}
