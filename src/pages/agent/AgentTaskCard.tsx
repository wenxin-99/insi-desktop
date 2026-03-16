/**
 * pages/agent/AgentTaskCard.tsx — Agent 任务卡片
 *
 * ★ Phase 3: 定时任务卡片差异化展示
 *   - 蓝色边框 + 右上角 cron 徽章
 *   - 底部统计：执行次数/成功率/下次执行
 *   - 操作按钮：暂停/恢复调度 + 立即执行
 */
import {
  Globe, Code2, Search, Cpu, Timer,
  Clock, CheckCircle, XCircle, Pause, Loader2, Ban,
  Play, Square, RotateCcw, Coins, ChevronRight,
  Trash2, Zap,
} from "lucide-react";
import { TYPE_LABELS, TYPE_COLORS, STATUS_LABELS, STATUS_COLORS, isScheduledTask, cronToHuman } from "./types";
import type { AgentTask, AgentType, AgentStatus } from "./types";

const TYPE_ICONS: Record<AgentType, any> = {
  automation: Globe,
  research: Search,
  codeact: Code2,
  general: Cpu,
};

const STATUS_ICONS: Record<AgentStatus, any> = {
  pending: Clock,
  running: Loader2,
  paused: Pause,
  completed: CheckCircle,
  failed: XCircle,
  cancelled: Ban,
};

interface Props {
  task: AgentTask;
  /** 定时调度信息（从列表接口附带或单独查询） */
  scheduleInfo?: {
    cronExpression: string;
    totalRuns: number;
    successRuns: number;
    nextRunAt: string | null;
    status: string;
  } | null;
  onView: () => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onDelete?: () => void;
  /** ★ Phase 3: 定时任务操作 */
  onToggleSchedule?: () => void;
  onRunNow?: () => void;
  onDeleteSchedule?: () => void;
}

export function AgentTaskCard({
  task, scheduleInfo, onView, onCancel, onPause, onResume, onRetry, onDelete,
  onToggleSchedule, onRunNow, onDeleteSchedule,
}: Props) {
  const TypeIcon = TYPE_ICONS[task.type] || Cpu;
  const StatusIcon = STATUS_ICONS[task.status] || Clock;
  const isRunning = task.status === "running";
  const isFailed = task.status === "failed" || task.status === "cancelled";
  const isScheduled = isScheduledTask(task);
  const progress = task.totalSteps > 0
    ? Math.min(100, Math.floor((task.totalSteps / (task.config?.maxSteps || 30)) * 100))
    : 0;

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60_000) return "刚刚";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
    return `${Math.floor(diff / 86400_000)} 天前`;
  };

  // ★ 定时任务的状态标签语义不同
  const scheduleStatusLabel = isScheduled
    ? (task.status === "running" ? "运行中" : task.status === "paused" ? "已暂停" : STATUS_LABELS[task.status])
    : STATUS_LABELS[task.status];
  const scheduleStatusColor = isScheduled
    ? (task.status === "running" ? "bg-blue-100 text-blue-700" : STATUS_COLORS[task.status])
    : STATUS_COLORS[task.status];

  // ★ 成功率
  const successRate = scheduleInfo && scheduleInfo.totalRuns > 0
    ? Math.round((scheduleInfo.successRuns / scheduleInfo.totalRuns) * 100)
    : null;

  return (
    <div
      className={`group relative rounded-2xl border bg-card p-4 transition-all hover:shadow-lg hover:border-primary/30 cursor-pointer ${
        isScheduled ? "border-2 border-blue-300 dark:border-blue-700" :
        isRunning ? "ring-2 ring-cyan-400/30" : ""
      }`}
      onClick={onView}
    >
      {/* ★ 定时任务 cron 徽章 */}
      {isScheduled && scheduleInfo && (
        <div className="absolute -top-px right-3 px-2 py-0.5 rounded-b-md text-[10px] font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/60 dark:text-blue-300">
          <Timer className="w-3 h-3 inline mr-0.5 -mt-px" />
          {cronToHuman(scheduleInfo.cronExpression)}
        </div>
      )}

      {/* 进度条（仅非定时的 running 任务） */}
      {isRunning && !isScheduled && (
        <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gray-200 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* 头部：类型 + 状态 */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-1.5 rounded-lg ${TYPE_COLORS[task.type]}`}>
            <TypeIcon className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-medium text-muted-foreground">{TYPE_LABELS[task.type]}</span>
        </div>
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${scheduleStatusColor}`}>
          <StatusIcon className={`w-3 h-3 ${isRunning && !isScheduled ? "animate-spin" : ""}`} />
          {scheduleStatusLabel}
        </span>
      </div>

      {/* Prompt 预览 */}
      <p className="text-sm font-medium line-clamp-2 mb-2 min-h-[2.5rem]">
        {task.prompt.substring(0, 120)}{task.prompt.length > 120 ? "..." : ""}
      </p>

      {/* 错误信息（仅在失败/取消状态下显示，且非定时模板） */}
      {!isScheduled && task.errorMsg && (task.status === "failed" || task.status === "cancelled") && (
        <p className="text-xs text-red-500 line-clamp-1 mb-2">
          <XCircle className="w-3 h-3 inline mr-1" />{task.errorMsg}
        </p>
      )}

      {/* 底部：元信息 + 操作 */}
      <div className="flex items-center justify-between mt-auto pt-2 border-t border-border/50">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {isScheduled && scheduleInfo ? (
            <>
              <span>已执行 {scheduleInfo.totalRuns} 次</span>
              {successRate !== null && <span>成功率 {successRate}%</span>}
              {scheduleInfo.nextRunAt && (
                <span>下次: {new Date(scheduleInfo.nextRunAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
              )}
            </>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />{timeAgo(task.createdAt)}
              </span>
              {task.totalSteps > 0 && (
                <span>{task.totalSteps} 步</span>
              )}
              {parseFloat(task.totalCost) > 0 && (
                <span className="flex items-center gap-0.5">
                  <Coins className="w-3 h-3" />{task.totalCost}
                </span>
              )}
            </>
          )}
        </div>

        {/* 快捷操作按钮 */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          {isScheduled && task.status !== "cancelled" && task.status !== "failed" ? (
            <>
              {/* 定时任务操作（仅活跃/暂停状态） */}
              {onRunNow && (
                <button onClick={onRunNow} className="p-1 rounded hover:bg-blue-100" title="立即执行一次">
                  <Zap className="w-3.5 h-3.5 text-blue-600" />
                </button>
              )}
              {onToggleSchedule && (
                <button onClick={onToggleSchedule} className="p-1 rounded hover:bg-yellow-100" title={task.status === "paused" ? "恢复调度" : "暂停调度"}>
                  {task.status === "paused" ? <Play className="w-3.5 h-3.5 text-green-600" /> : <Pause className="w-3.5 h-3.5 text-yellow-600" />}
                </button>
              )}
              {onDeleteSchedule && (
                <button onClick={onDeleteSchedule} className="p-1 rounded hover:bg-red-100" title="删除定时任务">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
            </>
          ) : (
            <>
              {/* 一次性任务操作 */}
              {isRunning && (
                <>
                  <button onClick={onPause} className="p-1 rounded hover:bg-yellow-100" title="暂停">
                    <Pause className="w-3.5 h-3.5 text-yellow-600" />
                  </button>
                  <button onClick={onCancel} className="p-1 rounded hover:bg-red-100" title="取消">
                    <Square className="w-3.5 h-3.5 text-red-600" />
                  </button>
                </>
              )}
              {task.status === "paused" && (
                <button onClick={onResume} className="p-1 rounded hover:bg-green-100" title="恢复">
                  <Play className="w-3.5 h-3.5 text-green-600" />
                </button>
              )}
              {isFailed && (
                <>
                  <button onClick={onRetry} className="p-1 rounded hover:bg-blue-100" title="重试">
                    <RotateCcw className="w-3.5 h-3.5 text-blue-600" />
                  </button>
                  {onDelete && (
                    <button onClick={onDelete} className="p-1 rounded hover:bg-red-100" title="删除">
                      <Trash2 className="w-3.5 h-3.5 text-red-500" />
                    </button>
                  )}
                </>
              )}
              {task.status === "completed" && onDelete && (
                <button onClick={onDelete} className="p-1 rounded hover:bg-red-100" title="删除">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
              {task.status === "cancelled" && onDelete && (
                <button onClick={onDelete} className="p-1 rounded hover:bg-red-100" title="删除">
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                </button>
              )}
            </>
          )}
          <button onClick={onView} className="p-1 rounded hover:bg-gray-100" title="查看详情">
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
