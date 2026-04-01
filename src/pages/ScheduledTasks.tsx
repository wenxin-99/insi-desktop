/**
 * ScheduledTasks — 定时任务页面
 *
 * 拆分自原 524 行。子模块：
 *   scheduledTasks/types.tsx          - 类型 + Cron 预设 + 工具函数 + 小组件
 *   scheduledTasks/useScheduledTasks.ts - 状态管理 + CRUD
 *   scheduledTasks/TaskForm.tsx        - 创建/编辑表单
 */
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Play, Pause, Trash2, Edit, RefreshCw, Loader2, Calendar, History } from "lucide-react";
import { TaskTypeIcon, StatusBadge, RunStatusIcon, cronToHuman, formatDate } from "./scheduledTasks/types";
import { useScheduledTasks } from "./scheduledTasks/useScheduledTasks";
import { TaskForm } from "./scheduledTasks/TaskForm";
import DashboardLayout from '@/components/DashboardLayout';

export default function ScheduledTasks() {
  const s = useScheduledTasks();

  return (
    <DashboardLayout>
    <PageLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Clock className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">定时任务</h1>
              <p className="text-sm text-muted-foreground">管理您的定时任务，接入网站或应用进行自动化操作</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={s.loadTasks} disabled={s.loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${s.loading ? "animate-spin" : ""}`} /> 刷新
            </Button>
            <Button size="sm" onClick={() => { s.resetForm(); s.setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-1" /> 新建任务
            </Button>
          </div>
        </div>

        {/* Form */}
        {s.showForm && (
          <TaskForm
            isEditing={!!s.editingTask}
            formName={s.formName} setFormName={s.setFormName}
            formDescription={s.formDescription} setFormDescription={s.setFormDescription}
            formTaskType={s.formTaskType} setFormTaskType={s.setFormTaskType}
            formCron={s.formCron} setFormCron={s.setFormCron}
            formWebhookUrl={s.formWebhookUrl} setFormWebhookUrl={s.setFormWebhookUrl}
            formWebhookMethod={s.formWebhookMethod} setFormWebhookMethod={s.setFormWebhookMethod}
            formWebhookHeaders={s.formWebhookHeaders} setFormWebhookHeaders={s.setFormWebhookHeaders}
            formWebhookBody={s.formWebhookBody} setFormWebhookBody={s.setFormWebhookBody}
            formAutomationTaskId={s.formAutomationTaskId} setFormAutomationTaskId={s.setFormAutomationTaskId}
            formTimeout={s.formTimeout} setFormTimeout={s.setFormTimeout}
            formMaxRetries={s.formMaxRetries} setFormMaxRetries={s.setFormMaxRetries}
            submitting={s.submitting}
            onSubmit={s.handleSubmit}
            onCancel={() => { s.setShowForm(false); s.resetForm(); }}
          />
        )}

        {/* Task List */}
        {s.loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
        ) : s.tasks.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">暂无定时任务</p>
            <p className="text-sm mt-1">点击"新建任务"或在对话中描述需求来创建</p>
          </div>
        ) : (
          <div className="space-y-3">
            {s.tasks.map((task) => (
              <div key={task.id} className="border rounded-xl bg-card overflow-hidden">
                <div className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${task.status === "active" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <TaskTypeIcon type={task.taskType} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="font-medium truncate">{task.name}</span>
                      <StatusBadge status={task.status} />
                      {task.source === "chat" && <Badge variant="outline" className="text-xs">对话创建</Badge>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {cronToHuman(task.cronExpression)}</span>
                      <span>下次: {formatDate(task.nextRunAt)}</span>
                      <span className="flex items-center gap-1"><RunStatusIcon status={task.lastRunStatus} />{task.totalRuns > 0 && <span>{task.successRuns}/{task.totalRuns} 成功</span>}</span>
                    </div>
                    {task.description && <p className="text-xs text-muted-foreground mt-1 truncate">{task.description}</p>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => s.handleRunNow(task.id)} title="立即执行"><Play className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => s.handleToggle(task.id)} title={task.status === "active" ? "暂停" : "恢复"}>
                      {task.status === "active" ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 text-green-500" />}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { s.setShowLogs(s.showLogs === task.id ? null : task.id); if (s.showLogs !== task.id) s.loadLogs(task.id); }} title="执行日志"><History className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => s.openEditForm(task)} title="编辑"><Edit className="w-4 h-4" /></Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => s.handleDelete(task.id)} title="删除"><Trash2 className="w-4 h-4" /></Button>
                  </div>
                </div>

                {/* Logs Panel */}
                {s.showLogs === task.id && (
                  <div className="border-t bg-muted/30 p-4">
                    <h4 className="text-sm font-medium mb-3 flex items-center gap-1.5"><History className="w-4 h-4" /> 最近执行记录</h4>
                    {s.logsLoading ? (
                      <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin" /></div>
                    ) : s.logs.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">暂无执行记录</p>
                    ) : (
                      <div className="space-y-2">
                        {s.logs.slice(0, 10).map((log) => (
                          <div key={log.id} className="flex items-center gap-3 text-sm p-2 rounded-lg bg-background">
                            <RunStatusIcon status={log.status} />
                            <span className="text-xs text-muted-foreground w-32">{formatDate(log.startedAt)}</span>
                            <span className="text-xs">{log.durationMs ? `${log.durationMs}ms` : "-"}</span>
                            {log.httpStatusCode && <Badge variant="outline" className="text-xs">HTTP {log.httpStatusCode}</Badge>}
                            {log.errorMessage && <span className="text-xs text-red-500 truncate flex-1">{log.errorMessage}</span>}
                            {log.status === "success" && !log.errorMessage && <span className="text-xs text-green-600">成功</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Stats */}
        {s.tasks.length > 0 && (
          <div className="grid grid-cols-3 gap-4">
            <div className="border rounded-xl p-4 text-center"><div className="text-2xl font-bold text-primary">{s.tasks.filter((t) => t.status === "active").length}</div><div className="text-xs text-muted-foreground mt-1">运行中</div></div>
            <div className="border rounded-xl p-4 text-center"><div className="text-2xl font-bold text-green-600">{s.tasks.reduce((a, t) => a + t.successRuns, 0)}</div><div className="text-xs text-muted-foreground mt-1">总成功次数</div></div>
            <div className="border rounded-xl p-4 text-center"><div className="text-2xl font-bold text-red-500">{s.tasks.reduce((a, t) => a + t.failedRuns, 0)}</div><div className="text-xs text-muted-foreground mt-1">总失败次数</div></div>
          </div>
        )}
      </div>
    </PageLayout>
    </DashboardLayout>
  );
}
