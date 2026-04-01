import { Brain, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export type SimulatedStep = {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed';
  duration?: number; // 以毫秒为单位
};

type ThinkingProcessCardProps = {
  steps: SimulatedStep[];
  className?: string;
};

export function ThinkingProcessCard({ steps, className }: ThinkingProcessCardProps) {
  const formatDuration = (ms?: number) => {
    if (ms === undefined) return '';
    const seconds = ms / 1000;
    if (seconds < 1) return `${ms}ms`;
    return `${seconds.toFixed(1)}s`;
  };

  const getStatusIcon = (status: SimulatedStep['status']) => {
    switch (status) {
      case 'pending':
        return <div className="h-4 w-4 rounded-full border-2 border-muted-foreground/30" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    }
  };

  if (steps.length === 0) {
    return null;
  }

  return (
    <Card className={cn("border border-border bg-background shadow-sm", className)}>
      <CardHeader className="p-4 pb-3">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          <h3 className="text-base font-semibold">AI 思考流程</h3>
        </div>
      </CardHeader>

      <CardContent className="p-4 pt-0 space-y-3">
        {steps.map((step, index) => (
          <div key={step.id} className="flex items-start gap-3">
            {/* 状态图标 */}
            <div className="flex-shrink-0 mt-0.5">
              {getStatusIcon(step.status)}
            </div>

            {/* 步骤内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={cn(
                  "text-sm font-medium",
                  step.status === 'completed' && "text-foreground",
                  step.status === 'running' && "text-primary",
                  step.status === 'pending' && "text-muted-foreground"
                )}>
                  {step.name}
                </span>
                {step.duration !== undefined && (
                  <span className="text-xs text-muted-foreground font-mono flex-shrink-0">
                    {formatDuration(step.duration)}
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
