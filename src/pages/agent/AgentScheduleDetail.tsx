/**
 * pages/agent/AgentScheduleDetail.tsx — 定时任务详情页
 *
 * 布局：
 *   顶栏：返回 + 任务摘要 + 操作按钮
 *   调度配置面板：cron、状态、统计
 *   执行历史：子任务列表，点击进入标准 AgentTaskDetail
 */
import { useState } from "react";
import {
  ArrowLeft, Pause, Play, Trash2, Zap, Timer,
  Clock, CheckCircle, XCircle, Loader2, Ban,
  ChevronRight, Calendar, BarChart3, History, Cpu,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TYPE_LABELS, TYPE_COLORS, STATUS_LABELS, STATUS_COLORS, cronToHuman } from "./types";
import type { AgentTask, AgentSchedule } from "./types";

interface Props {
  task: AgentTask;
  schedule: AgentSchedule | null;
  runs: AgentTask[];
  runsTotal: number;
  onBack: () => void;
  onViewRun: (taskId: string) => void;
  onToggleSchedule: () => void;
  onRunNow: () => void;
  onDeleteSchedule: () => void;
}

export function AgentScheduleDetail({
  task, schedule, runs, runsTotal,
  onBack, onViewRun, onToggleSchedule, onRunNow, onDeleteSchedule,
}: Props) {
  const isActive = task.status === "running";
  const isPaused = task.status === "paused";
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ★ 套餐选择（读取系统套餐列表）
  const packagesQuery = trpc.modelPackage.getAll.useQuery();
  const packages = packagesQuery.data || [];
  const taskConfig = typeof task.config === "string" ? JSON.parse(task.config || "{}") : (task.config || {});
  const [selectedPackageId, setSelectedPackageId] = useState<number>(taskConfig._schedulePackageId || 0);
  const updateConfigMut = trpc.agent.updateScheduleConfig.useMutation();

  const handlePackageChange = (pkgId: number) => {
    setSelectedPackageId(pkgId);
    updateConfigMut.mutate({ taskId: task.id, schedulePackageId: pkgId });
  };

  const successRate = schedule && schedule.totalRuns > 0
    ? Math.round((schedule.successRuns / schedule.totalRuns) * 100)
    : null;

  const timeAgo = (dateStr: string | null) => {
    if (!dateStr) return "-";
    const diff = Date.now() - new Date(dateStr).getTime();
    if (diff < 60_000) return "刚刚";
    if (diff < 3600_000) return `${Math.floor(diff / 60_000)} 分钟前`;
    if (diff < 86400_000) return `${Math.floor(diff / 3600_000)} 小时前`;
    return `${Math.floor(diff / 86400_000)} 天前`;
  };

  const fmtDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("zh-CN", {
      month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* ── 顶栏 ── */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm">{task.prompt.substring(0, 60)}{task.prompt.length > 60 ? "..." : ""}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[task.type]}`}>
                {TYPE_LABELS[task.type]}
              </span>
              {schedule && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                  <Timer className="w-3 h-3 inline mr-0.5 -mt-px" />
                  {cronToHuman(schedule.cronExpression)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
              {schedule && (
                <>
                  <span>{schedule.totalRuns} 次执行</span>
                  {successRate !== null && <span>成功率 {successRate}%</span>}
                </>
              )}
              <span className="font-mono text-[10px] opacity-50">#{task.id.substring(0, 8)}</span>
            </div>
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2">
          <button
            onClick={onRunNow}
            className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200 transition-colors dark:bg-blue-900/40 dark:text-blue-300"
          >
            <Zap className="w-3.5 h-3.5 inline mr-1" />立即执行
          </button>
          <button
            onClick={onToggleSchedule}
            className={`px-3 py-1.5 text-xs rounded-xl transition-colors ${
              isActive
                ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {isActive ? <><Pause className="w-3.5 h-3.5 inline mr-1" />暂停</> : <><Play className="w-3.5 h-3.5 inline mr-1" />恢复</>}
          </button>
          {confirmDelete ? (
            <div className="flex items-center gap-1">
              <button
                onClick={onDeleteSchedule}
                className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-xl hover:bg-red-700"
              >
                确认删除
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1.5 text-xs bg-muted text-muted-foreground rounded-xl hover:bg-muted/80"
              >
                取消
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-xl hover:bg-red-200 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5 inline mr-1" />删除
            </button>
          )}
        </div>
      </div>

      {/* ── 主体 ── */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-4xl mx-auto p-6 space-y-6">

          {/* ── 调度配置面板 ── */}
          {schedule && (
            <div className="rounded-2xl border bg-card p-5">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-500" />
                调度配置
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">Cron 表达式</p>
                  <p className="text-sm font-mono">{schedule.cronExpression}</p>
                  <p className="text-xs text-blue-600 mt-0.5">{cronToHuman(schedule.cronExpression)}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">状态</p>
                  <p className={`text-sm font-medium ${
                    schedule.status === "active" ? "text-green-600" :
                    schedule.status === "paused" ? "text-yellow-600" : "text-gray-500"
                  }`}>
                    {schedule.status === "active" ? "运行中" : schedule.status === "paused" ? "已暂停" : "已禁用"}
                  </p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">下次执行</p>
                  <p className="text-sm">{fmtDate(schedule.nextRunAt)}</p>
                </div>
                <div className="bg-muted/40 rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">上次执行</p>
                  <p className="text-sm">{timeAgo(schedule.lastRunAt)}</p>
                  {schedule.lastRunStatus && (
                    <p className={`text-xs mt-0.5 ${schedule.lastRunStatus === "success" ? "text-green-600" : "text-red-500"}`}>
                      {schedule.lastRunStatus === "success" ? "成功" : "失败"}
                    </p>
                  )}
                </div>
              </div>

              {/* ★ 执行套餐选择 */}
              <div className="mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">执行套餐</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={selectedPackageId}
                      onChange={e => handlePackageChange(Number(e.target.value))}
                      className="text-xs px-3 py-1.5 rounded-lg border bg-background min-w-[180px]"
                    >
                      <option value={0}>默认（系统配置）</option>
                      {packages.map((pkg: any) => (
                        <option key={pkg.id} value={pkg.id}>{pkg.name}</option>
                      ))}
                    </select>
                    {updateConfigMut.isPending && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
                    {updateConfigMut.isSuccess && <CheckCircle className="w-3 h-3 text-green-500" />}
                  </div>
                </div>
              </div>

              {/* 统计条 */}
              <div className="flex items-center gap-6 mt-4 pt-4 border-t border-border/50">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    总计 <span className="font-medium text-foreground">{schedule.totalRuns}</span> 次
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  <span className="text-sm text-green-600">{schedule.successRuns}</span>
                </div>
                <div className="flex items-center gap-1">
                  <XCircle className="w-3.5 h-3.5 text-red-500" />
                  <span className="text-sm text-red-500">{schedule.failedRuns}</span>
                </div>
                {successRate !== null && (
                  <div className="ml-auto">
                    <div className="flex items-center gap-2">
                      <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            successRate >= 90 ? "bg-green-500" : successRate >= 60 ? "bg-yellow-500" : "bg-red-500"
                          }`}
                          style={{ width: `${successRate}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground">{successRate}%</span>
                    </div>
                  </div>
                )}
              </div>
              {/* ★ 最近执行结果迷你图 */}
              {runs.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">最近 {Math.min(runs.length, 14)} 次执行</p>
                  <div className="flex items-end gap-1 h-8">
                    {runs.slice(0, 14).reverse().map((run, i) => (
                      <div key={run.id} className="flex-1 flex flex-col items-center gap-0.5" title={`${new Date(run.createdAt).toLocaleString("zh-CN")} — ${STATUS_LABELS[run.status]}`}>
                        <div
                          className={`w-full rounded-sm transition-all ${
                            run.status === "completed" ? "bg-green-400" :
                            run.status === "failed" ? "bg-red-400" :
                            run.status === "running" ? "bg-blue-400 animate-pulse" :
                            "bg-gray-300"
                          }`}
                          style={{ height: run.status === "completed" ? "100%" : run.status === "failed" ? "60%" : "40%" }}
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[10px] text-muted-foreground">旧</span>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-400" />成功</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-red-400" />失败</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">新</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── 任务描述 ── */}
          <div className="rounded-2xl border bg-card p-5">
            <h3 className="font-bold text-sm mb-2">任务描述</h3>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{task.prompt}</p>
          </div>

          {/* ── 执行历史 ── */}
          <div className="rounded-2xl border bg-card">
            <div className="flex items-center justify-between px-5 py-4 border-b">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <History className="w-4 h-4 text-amber-500" />
                执行历史
                <span className="text-xs text-muted-foreground font-normal">共 {runsTotal} 次</span>
              </h3>
            </div>

            {runs.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Clock className="w-10 h-10 mx-auto mb-3 opacity-15" />
                <p className="text-sm">暂无执行记录</p>
                <p className="text-xs mt-1">定时任务触发后，执行记录将显示在这里</p>
              </div>
            ) : (
              <div className="divide-y">
                {runs.map((run, idx) => {
                  const StatusIcon =
                    run.status === "completed" ? CheckCircle :
                    run.status === "failed" ? XCircle :
                    run.status === "running" ? Loader2 :
                    run.status === "cancelled" ? Ban : Clock;

                  const statusColor =
                    run.status === "completed" ? "text-green-600" :
                    run.status === "failed" ? "text-red-500" :
                    run.status === "running" ? "text-blue-500 animate-spin" :
                    "text-gray-400";

                  const dur = run.updatedAt && run.createdAt
                    ? Math.floor((new Date(run.updatedAt).getTime() - new Date(run.createdAt).getTime()) / 1000)
                    : 0;

                  return (
                    <div
                      key={run.id}
                      onClick={() => onViewRun(run.id)}
                      className="flex items-center gap-4 px-5 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <span className="text-xs text-muted-foreground w-8 text-right">#{runsTotal - idx}</span>
                      <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${STATUS_COLORS[run.status]}`}>
                            {STATUS_LABELS[run.status]}
                          </span>
                          {run.totalSteps > 0 && (
                            <span className="text-xs text-muted-foreground">{run.totalSteps} 步</span>
                          )}
                          {dur > 0 && (
                            <span className="text-xs text-muted-foreground">
                              {dur > 60 ? `${Math.floor(dur / 60)}m ${dur % 60}s` : `${dur}s`}
                            </span>
                          )}
                        </div>
                        {run.errorMsg && run.status === "failed" && (
                          <p className="text-xs text-red-500 truncate mt-0.5">{run.errorMsg}</p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground flex-shrink-0">{fmtDate(run.createdAt)}</span>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
