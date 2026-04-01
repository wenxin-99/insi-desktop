import { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronUp, Loader2, Sparkles, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";

interface ThinkingStep {
  id: string;
  content: string;
  timestamp: number;
}

interface ThinkingStepsProps {
  steps: ThinkingStep[];
  isThinking: boolean; // 是否还在思考中
  startTime?: number; // 思考开始时间（毫秒时间戳）
  onToggle?: () => void;
}

export function ThinkingSteps({ steps, isThinking, startTime, onToggle }: ThinkingStepsProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true); // 默认展开
  const [userToggled, setUserToggled] = useState(false); // 用户是否手动操作过
  const [displayedSteps, setDisplayedSteps] = useState<ThinkingStep[]>([]);
  const [elapsedTime, setElapsedTime] = useState(0); // 已用时间（秒）
  // 使用ref记录每个步骤到达客户端的时间，避免服务器/客户端时钟不同步问题
  const stepArrivalTimesRef = useRef<Map<string, number>>(new Map());
  const localStartTimeRef = useRef<number | null>(null);

  // 当startTime变化时，记录本地开始时间
  useEffect(() => {
    if (startTime) {
      localStartTimeRef.current = Date.now();
      stepArrivalTimesRef.current.clear();
    }
  }, [startTime]);

  // 重新开始思考时自动展开并重置用户操作标记
  useEffect(() => {
    if (isThinking) {
      setIsExpanded(true);
      setUserToggled(false);
    }
  }, [isThinking]);

  // 记录每个步骤到达客户端的时间
  useEffect(() => {
    steps.forEach(step => {
      if (!stepArrivalTimesRef.current.has(step.id)) {
        stepArrivalTimesRef.current.set(step.id, Date.now());
      }
    });
  }, [steps]);

  // 流式显示步骤：逐个添加步骤到显示列表
  useEffect(() => {
    if (steps.length === 0) {
      setDisplayedSteps([]);
      return;
    }

    // 如果新步骤比已显示的多，逐个添加
    if (steps.length > displayedSteps.length) {
      const timer = setTimeout(() => {
        setDisplayedSteps(steps.slice(0, displayedSteps.length + 1));
      }, 100); // 每100ms显示一个新步骤

      return () => clearTimeout(timer);
    } else {
      // 如果步骤数量减少（重置），立即更新
      setDisplayedSteps(steps);
    }
  }, [steps, displayedSteps.length]);

  // 计算已用时间
  useEffect(() => {
    const effectiveStartTime = localStartTimeRef.current || startTime;
    if (!effectiveStartTime) return;

    if (isThinking) {
      // 思考中：每100ms更新一次时间
      const timer = setInterval(() => {
        const elapsed = (Date.now() - effectiveStartTime) / 1000;
        setElapsedTime(Math.max(0, Math.round(elapsed * 10) / 10)); // 确保不为负数
      }, 100);

      return () => clearInterval(timer);
    } else {
      // 思考完成：使用最后一个步骤的客户端到达时间
      if (steps.length > 0) {
        const lastStep = steps[steps.length - 1];
        const lastArrivalTime = stepArrivalTimesRef.current.get(lastStep.id) || Date.now();
        const elapsed = (lastArrivalTime - effectiveStartTime) / 1000;
        setElapsedTime(Math.max(0, Math.round(elapsed * 10) / 10));
      }
    }
  }, [isThinking, startTime, steps]);

  // 思考完成后自动折叠（除非用户手动操作过）
  useEffect(() => {
    if (!isThinking && steps.length > 0 && !userToggled) {
      const timer = setTimeout(() => {
        setIsExpanded(false);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [isThinking, steps.length, userToggled]);

  const handleToggle = () => {
    setUserToggled(true); // 用户手动操作后不再自动折叠
    setIsExpanded(!isExpanded);
    onToggle?.();
  };

  // 计算步骤的相对时间戳（使用客户端到达时间）
  const getStepElapsedTime = (step: ThinkingStep) => {
    const effectiveStartTime = localStartTimeRef.current || startTime;
    if (!effectiveStartTime) return null;
    const arrivalTime = stepArrivalTimesRef.current.get(step.id);
    if (!arrivalTime) return null;
    const elapsed = (arrivalTime - effectiveStartTime) / 1000;
    const result = Math.max(0, Math.round(elapsed * 10) / 10); // 确保不为负数
    return result;
  };

  if (steps.length === 0 && !isThinking) {
    return null;
  }

  // 为步骤序号生成渐变色
  const getStepGradient = (index: number) => {
    const colors = [
      'from-blue-500 to-cyan-500',
      'from-purple-500 to-pink-500',
      'from-orange-500 to-red-500',
      'from-green-500 to-emerald-500',
      'from-indigo-500 to-purple-500',
      'from-yellow-500 to-orange-500',
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="mb-2 md:mb-3 rounded-lg md:rounded-xl border border-border/50 bg-gradient-to-br from-muted/40 via-muted/30 to-muted/20 backdrop-blur-sm overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
      {/* 头部：思考状态 */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 md:px-4 py-2 md:py-3 hover:bg-muted/40 transition-all duration-200 group"
      >
        <div className="flex items-center gap-2 md:gap-3">
          {isThinking ? (
            <>
              <div className="relative">
                <Loader2 className="h-4 w-4 md:h-5 md:w-5 animate-spin text-primary" />
                <div className="absolute inset-0 h-4 w-4 md:h-5 md:w-5 animate-ping opacity-20">
                  <Sparkles className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                </div>
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs md:text-sm font-semibold text-foreground bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  {t('chat.thinking.inProgress', '正在思考...')}
                </span>
                {elapsedTime > 0 && (
                  <span className="text-[10px] md:text-xs text-muted-foreground">
                    {t('chat.thinking.elapsed', { time: elapsedTime, defaultValue: `已用时 ${elapsedTime} 秒` })}
                  </span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="relative">
                <div className="h-4 w-4 md:h-5 md:w-5 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm">
                  <div className="h-2 w-2 md:h-2.5 md:w-2.5 rounded-full bg-white" />
                </div>
                <div className="absolute inset-0 h-4 w-4 md:h-5 md:w-5 rounded-full bg-green-400 animate-ping opacity-20" />
              </div>
              <div className="flex flex-col items-start">
                <span className="text-xs md:text-sm font-semibold text-foreground">
                  {t('chat.thinking.completed', '思考完成')}
                </span>
                <span className="text-[10px] md:text-xs text-muted-foreground">
                  {t('chat.thinking.stepsCount', { count: steps.length, defaultValue: `${steps.length} 个步骤` })}
                  {elapsedTime > 0 && ` · ${t('chat.thinking.duration', { time: elapsedTime, defaultValue: `耗时 ${elapsedTime} 秒` })}`}
                </span>
              </div>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isExpanded ? (
            <ChevronUp className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 md:h-4 md:w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          )}
        </div>
      </button>

      {/* 步骤列表 */}
      {isExpanded && displayedSteps.length > 0 && (
        <div className="px-2 md:px-4 pb-2 md:pb-4 space-y-2 md:space-y-3 border-t border-border/30 pt-2 md:pt-4">
          {displayedSteps.map((step, index) => {
            const stepElapsedTime = getStepElapsedTime(step);
            
            return (
              <div
                key={step.id}
                className="flex items-start gap-2 md:gap-3 animate-in fade-in slide-in-from-left-2 duration-500 hover:translate-x-0.5 md:hover:translate-x-1 transition-transform"
                style={{ animationDelay: `${index * 80}ms` }}
              >
                {/* 步骤序号 - 渐变色圆圈 */}
                <div className="flex-shrink-0 relative group/step">
                  <div className={`w-5 h-5 md:w-7 md:h-7 rounded-full bg-gradient-to-br ${getStepGradient(index)} flex items-center justify-center shadow-sm group-hover/step:shadow-md transition-shadow`}>
                    <span className="text-[10px] md:text-xs font-bold text-white">{index + 1}</span>
                  </div>
                  {/* 连接线（除了最后一个步骤） */}
                  {index < displayedSteps.length - 1 && !isThinking && (
                    <div className="absolute top-5 md:top-7 left-1/2 -translate-x-1/2 w-0.5 h-4 md:h-6 bg-gradient-to-b from-border/50 to-transparent" />
                  )}
                  {index === displayedSteps.length - 1 && isThinking && (
                    <div className="absolute top-5 md:top-7 left-1/2 -translate-x-1/2 w-0.5 h-4 md:h-6 bg-gradient-to-b from-border/50 to-transparent animate-pulse" />
                  )}
                </div>
                
                {/* 步骤内容 - 卡片式设计 */}
                <div className="flex-1 min-w-0 bg-background/50 rounded-md md:rounded-lg px-2 py-1.5 md:px-3 md:py-2.5 border border-border/30 hover:border-border/60 transition-all duration-200 hover:shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs md:text-sm text-foreground/90 leading-relaxed flex-1">{step.content}</p>
                    
                    {/* 时间线标签 */}
                    {stepElapsedTime !== null && stepElapsedTime >= 0 && (
                      <div className="flex-shrink-0 flex items-center gap-1 px-1.5 py-0.5 md:px-2 md:py-1 rounded-full bg-primary/10 text-primary">
                        <Clock className="h-2.5 w-2.5 md:h-3 md:w-3" />
                        <span className="text-[10px] md:text-xs font-medium whitespace-nowrap">
                          {stepElapsedTime}s
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {/* 思考中的脉动指示器 */}
          {isThinking && (
            <div className="flex items-center justify-center gap-2 mt-2 md:mt-4 py-1 md:py-2">
              <div className="flex gap-1 md:gap-1.5">
                <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-gradient-to-r from-primary to-primary/70 animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-gradient-to-r from-primary to-primary/70 animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="h-1.5 w-1.5 md:h-2 md:w-2 rounded-full bg-gradient-to-r from-primary to-primary/70 animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
