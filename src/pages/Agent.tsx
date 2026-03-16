/**
 * pages/Agent.tsx — Agent 任务中心
 *
 * 路由：/agent         — 任务列表
 *       /agent/:taskId — 任务详情
 *
 * 布局：
 *   顶部：标题 + 筛选器 + 新建按钮
 *   主体：卡片网格 / 表格
 *   详情：全屏沉浸式（步骤时间线 + 沙箱面板）
 */
import { useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import {
  Plus, Filter, LayoutGrid, TableProperties, Loader2,
  Cpu, Globe, Search, Code2, ChevronLeft, ChevronRight,
  Sparkles, RefreshCw, Inbox, Timer,
} from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { useAgent } from "./agent/useAgent";
import { AgentTaskCard } from "./agent/AgentTaskCard";
import { AgentTaskDetail } from "./agent/AgentTaskDetail";
import { AgentScheduleDetail } from "./agent/AgentScheduleDetail";
import { AgentCreateModal } from "./agent/AgentCreateModal";
import { TYPE_LABELS, TYPE_COLORS, STATUS_LABELS, STATUS_COLORS } from "./agent/types";
import type { AgentType, AgentStatus } from "./agent/types";

const TYPE_FILTERS: Array<{ value: AgentType | undefined; label: string; icon: any }> = [
  { value: undefined, label: "全部", icon: Cpu },
  { value: "automation", label: "自动化", icon: Globe },
  { value: "research", label: "调研", icon: Search },
  { value: "codeact", label: "代码", icon: Code2 },
  { value: "general", label: "通用", icon: Sparkles },
];

const STATUS_FILTERS: Array<{ value: AgentStatus | undefined; label: string }> = [
  { value: undefined, label: "全部状态" },
  { value: "running", label: "执行中" },
  { value: "completed", label: "已完成" },
  { value: "failed", label: "失败" },
  { value: "pending", label: "排队中" },
];

export default function Agent() {
  const [, navigate] = useLocation();
  const [matchDetail, paramsDetail] = useRoute("/agent/:taskId");
  const a = useAgent();

  // URL 参数同步
  useEffect(() => {
    if (matchDetail && paramsDetail?.taskId) {
      a.setSelectedTaskId(paramsDetail.taskId);
    } else {
      a.setSelectedTaskId(null);
    }
  }, [matchDetail, paramsDetail?.taskId]);

  // ★ Phase 4: 读取 ?scheduled=true 自动切换到定时筛选
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("scheduled") === "true") {
      a.setFilterScheduled(true);
      a.setFilterType(undefined);
    }
  }, []);

  // ── 详情视图 ──
  if (a.selectedTaskId && a.detail) {
    const detailTask = a.detail as any;

    // ★ Phase 4: 定时模板任务 → AgentScheduleDetail
    if (detailTask.isTemplate === 1) {
      return (
        <DashboardLayout>
          <AgentScheduleDetail
            task={detailTask}
            schedule={a.scheduleInfo}
            runs={a.scheduleRuns}
            runsTotal={a.scheduleRunsTotal}
            onBack={() => navigate("/agent")}
            onViewRun={(childId) => navigate(`/agent/${childId}`)}
            onToggleSchedule={() => a.handleToggleSchedule(a.selectedTaskId!)}
            onRunNow={() => a.handleRunScheduleNow(a.selectedTaskId!)}
            onDeleteSchedule={() => { a.handleDeleteSchedule(a.selectedTaskId!); navigate("/agent"); }}
          />
        </DashboardLayout>
      );
    }

    // 一次性任务 / 子任务 → AgentTaskDetail
    return (
      <DashboardLayout>
        <AgentTaskDetail
          task={detailTask}
          steps={a.steps}
          onBack={() => {
            // ★ 如果是子任务，返回到父任务（模板）详情
            if (detailTask.parentTaskId) {
              navigate(`/agent/${detailTask.parentTaskId}`);
            } else {
              navigate("/agent");
            }
          }}
          onCancel={() => a.handleCancel(a.selectedTaskId!)}
          onPause={() => a.handlePause(a.selectedTaskId!)}
          onResume={() => a.handleResume(a.selectedTaskId!)}
          onRetry={() => a.handleRetry(a.selectedTaskId!)}
          onDelete={() => { a.handleDelete(a.selectedTaskId!); navigate("/agent"); }}
        />
      </DashboardLayout>
    );
  }

  // ── 列表视图 ──
  const totalPages = Math.ceil(a.total / a.LIMIT);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

          {/* ── 头部 ── */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Cpu className="w-6 h-6 text-primary" />
                Agent 任务中心
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                管理所有自动化、调研、代码执行任务
              </p>
            </div>
            <button
              onClick={() => a.setShowCreateModal(true)}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 transition-all flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" />
              新建任务
            </button>
          </div>

          {/* ── 筛选栏 ── */}
          <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
            {/* 类型筛选 — ★ Phase 3: 新增定时 tab */}
            <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
              {TYPE_FILTERS.map(f => {
                const Icon = f.icon;
                const isActive = a.filterType === f.value && a.filterScheduled === undefined;
                return (
                  <button
                    key={f.label}
                    onClick={() => { a.setFilterType(f.value); a.setFilterScheduled(undefined); a.setPage(0); }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isActive ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {f.label}
                  </button>
                );
              })}
              {/* ★ 定时 tab */}
              <button
                onClick={() => { a.setFilterType(undefined); a.setFilterScheduled(true); a.setPage(0); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  a.filterScheduled === true ? "bg-blue-100 text-blue-700 shadow-sm dark:bg-blue-900/40 dark:text-blue-300" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Timer className="w-3.5 h-3.5" />
                定时
              </button>
            </div>

            <div className="flex items-center gap-2">
              {/* 状态筛选 */}
              <select
                value={a.filterStatus || ""}
                onChange={e => { a.setFilterStatus(e.target.value as AgentStatus || undefined); a.setPage(0); }}
                className="text-xs px-3 py-1.5 rounded-lg border bg-background"
              >
                {STATUS_FILTERS.map(f => (
                  <option key={f.label} value={f.value || ""}>{f.label}</option>
                ))}
              </select>

              {/* 视图切换 */}
              <div className="flex items-center gap-0.5 bg-muted/50 rounded-lg p-0.5">
                <button
                  onClick={() => a.setViewMode("card")}
                  className={`p-1.5 rounded-md ${a.viewMode === "card" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => a.setViewMode("table")}
                  className={`p-1.5 rounded-md ${a.viewMode === "table" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
                >
                  <TableProperties className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 刷新 */}
              <button onClick={() => a.refetch()} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground">
                <RefreshCw className={`w-4 h-4 ${a.isLoading ? "animate-spin" : ""}`} />
              </button>
            </div>
          </div>

          {/* ── 任务列表 ── */}
          {a.isLoading && a.tasks.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 opacity-30" />
              <p className="text-sm">加载中...</p>
            </div>
          ) : a.tasks.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Inbox className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="text-lg font-medium mb-1">暂无任务</p>
              <p className="text-sm mb-4">点击「新建任务」开始使用 Agent</p>
              <button
                onClick={() => a.setShowCreateModal(true)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90"
              >
                <Plus className="w-4 h-4 inline mr-1" />新建任务
              </button>
            </div>
          ) : a.viewMode === "card" ? (
            /* 卡片网格 */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {a.tasks.map(task => (
                <AgentTaskCard
                  key={task.id}
                  task={task}
                  onView={() => navigate(`/agent/${task.id}`)}
                  onCancel={() => a.handleCancel(task.id)}
                  onPause={() => a.handlePause(task.id)}
                  onResume={() => a.handleResume(task.id)}
                  onRetry={() => a.handleRetry(task.id)}
                  onDelete={() => a.handleDelete(task.id)}
                  onToggleSchedule={task.isTemplate ? () => a.handleToggleSchedule(task.id) : undefined}
                  onRunNow={task.isTemplate ? () => a.handleRunScheduleNow(task.id) : undefined}
                  onDeleteSchedule={task.isTemplate ? () => a.handleDeleteSchedule(task.id) : undefined}
                />
              ))}
            </div>
          ) : (
            /* 表格视图 */
            <div className="rounded-xl border bg-card overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground">任务</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">类型</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-24">状态</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-16">步骤</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-16">费用</th>
                    <th className="text-left px-4 py-3 font-medium text-muted-foreground w-32">创建时间</th>
                  </tr>
                </thead>
                <tbody>
                  {a.tasks.map(task => (
                    <tr
                      key={task.id}
                      onClick={() => navigate(`/agent/${task.id}`)}
                      className="border-b last:border-0 hover:bg-muted/30 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <p className="truncate max-w-xs">{task.prompt}</p>
                          {task.isTemplate === 1 && (
                            <span className="flex-shrink-0 text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300">
                              <Timer className="w-3 h-3 inline -mt-px mr-0.5" />定时
                            </span>
                          )}
                        </div>
                        {!task.isTemplate && task.errorMsg && (task.status === "failed" || task.status === "cancelled") && <p className="text-xs text-red-500 truncate">{task.errorMsg}</p>}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${TYPE_COLORS[task.type]}`}>
                          {TYPE_LABELS[task.type]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[task.status]}`}>
                          {STATUS_LABELS[task.status]}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{task.totalSteps}</td>
                      <td className="px-4 py-3 text-muted-foreground">{parseFloat(task.totalCost) > 0 ? `${task.totalCost}🐟` : "-"}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{new Date(task.createdAt).toLocaleString("zh-CN")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* ── 分页 ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-6">
              <button
                onClick={() => a.setPage(Math.max(0, a.page - 1))}
                disabled={a.page === 0}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-muted-foreground px-3">
                {a.page + 1} / {totalPages}
              </span>
              <button
                onClick={() => a.setPage(Math.min(totalPages - 1, a.page + 1))}
                disabled={a.page >= totalPages - 1}
                className="p-2 rounded-lg hover:bg-muted disabled:opacity-30"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* ── 创建弹窗 ── */}
        <AgentCreateModal
          open={a.showCreateModal}
          onClose={() => a.setShowCreateModal(false)}
          onCreate={a.handleCreate}
          onCreateScheduled={a.handleCreateScheduled}
          isCreating={a.isCreating}
          isCreatingScheduled={a.isCreatingScheduled}
        />
      </div>
    </DashboardLayout>
  );
}
