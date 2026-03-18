import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ChevronUp, Brain, CheckCircle2, Loader2, Circle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { ThinkingStep } from '@/types/thinking';

export type { ThinkingStep };

type ThinkingProcessPanelProps = {
  steps: ThinkingStep[];
  className?: string;
};

export function ThinkingProcessPanel({ steps, className }: ThinkingProcessPanelProps) {
  const { t } = useTranslation();
  const [isExpanded, setIsExpanded] = useState(true);
  // 默认展开所有有details的步骤
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(() => {
    const initialExpanded = new Set<string>();
    steps.forEach(step => {
      if (step.details) {
        initialExpanded.add(step.id);
      }
    });
    return initialExpanded;
  });

  const toggleStep = (stepId: string) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const formatDuration = (startTime: number, endTime?: number) => {
    if (!endTime) return '...';
    const duration = Math.max(0, (endTime - startTime) / 1000);
    if (duration < 0.001) return '<1ms';
    if (duration < 1) return `${(duration * 1000).toFixed(0)}ms`;
    return `${duration.toFixed(1)}s`;
  };

  const getStatusIcon = (status: ThinkingStep['status']) => {
    switch (status) {
      case 'pending':
        return <Circle className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />;
      case 'running':
        return <Loader2 className="h-3 w-3 md:h-4 md:w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-3 w-3 md:h-4 md:w-4 text-green-500" />;
      case 'error':
        return <Circle className="h-3 w-3 md:h-4 md:w-4 text-red-500 fill-red-500" />;
    }
  };

  const renderStep = (step: ThinkingStep, level = 0) => {
    const hasSubsteps = step.substeps && step.substeps.length > 0;
    const hasDetails = !!step.details;
    const isExpandable = hasSubsteps || hasDetails;
    const isStepExpanded = expandedSteps.has(step.id);

    return (
      <div key={step.id} className={cn("border-l-2 border-border", level > 0 && "ml-4 md:ml-6")}>
        <div className="flex items-start gap-2 md:gap-3 py-1.5 md:py-2 pl-3 md:pl-4">
          {/* 状态图标 */}
          <div className="flex-shrink-0 mt-0.5">
            {getStatusIcon(step.status)}
          </div>

          {/* 步骤内容 */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <button
                onClick={() => isExpandable && toggleStep(step.id)}
                className={cn(
                  "text-xs md:text-sm font-medium text-foreground transition-colors text-left",
                  isExpandable && "cursor-pointer hover:text-primary"
                )}
              >
                {step.name}
              </button>
              <span className="text-[10px] md:text-xs text-muted-foreground font-mono flex-shrink-0">
                {formatDuration(step.startTime, step.endTime)}
              </span>
            </div>

            {/* 详细信息 */}
            {step.details && isStepExpanded && (
              <div className="mt-1.5 text-[11px] md:text-xs text-muted-foreground bg-muted/30 rounded-md px-2.5 py-1.5 leading-relaxed whitespace-pre-wrap">
                {step.details}
              </div>
            )}

            {/* 子步骤 */}
            {hasSubsteps && isStepExpanded && (
              <div className="mt-1">
                {step.substeps!.map(substep => renderStep(substep, level + 1))}
              </div>
            )}
          </div>

          {/* 展开图标 */}
          {isExpandable && (
            <button
              onClick={() => toggleStep(step.id)}
              className="flex-shrink-0 p-0.5 hover:bg-accent rounded"
            >
              {isStepExpanded ? (
                <ChevronUp className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-3 w-3 md:h-4 md:w-4 text-muted-foreground" />
              )}
            </button>
          )}
        </div>
      </div>
    );
  };

  if (steps.length === 0) {
    return null;
  }

  return (
    <Card className={cn("", className)}>
      <CardHeader className="p-3 md:p-4 pb-2 md:pb-3">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center justify-between w-full group"
        >
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 md:h-5 md:w-5 text-primary" />
            <h3 className="text-sm md:text-base font-semibold">{t("chat.thinkingProcess")}</h3>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 md:h-8 md:w-8 p-0"
          >
            {isExpanded ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            )}
          </Button>
        </button>
      </CardHeader>

      {isExpanded && (
        <CardContent className="p-3 md:p-4 pt-0 space-y-0">
          {steps.map(step => renderStep(step))}
        </CardContent>
      )}
    </Card>
  );
}
