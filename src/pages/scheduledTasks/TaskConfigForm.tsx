import { useState, useEffect, useCallback } from "react";

import PageLayout from "../components/PageLayout";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  Clock, Plus, Play, Pause, Trash2, Edit, RefreshCw, ChevronDown, ChevronUp,
  Globe, Bot, Code, CheckCircle, XCircle, AlertTriangle, Loader2, Calendar,
  ArrowLeft, MoreVertical, History, Zap
} from "lucide-react";

interface ScheduledTask {
  id: number;
  name: string;
  description: string | null;
  taskType: "webhook" | "automation" | "script";

export function TaskConfigForm(props: any) {
  const { t, data } = props;
  return (
    <>
  return (
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
            <Button variant="outline" size="sm" onClick={loadTasks} disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> 刷新
            </Button>
            <Button size="sm" onClick={() => { resetForm(); setShowForm(true); }}>
              <Plus className="w-4 h-4 mr-1" /> 新建任务
            </Button>
          </div>
        </div>

        {/* Create/Edit Form */}
        {showForm && (
          <div className="border rounded-xl p-6 bg-card space-y-4 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingTask ? "编辑任务" : "创建定时任务"}</h2>
              <Button variant="ghost" size="sm" onClick={() => { setShowForm(false); resetForm(); }}>
                <XCircle className="w-4 h-4" />
              </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">任务名称 *</label>
                <Input value={formName} onChange={e => setFormName(e.target.value)} placeholder="例如：每日数据同步" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">任务类型</label>
                <div className="flex gap-2">
                  {[
                    { value: "webhook" as const, label: "Webhook", icon: Globe },
                    { value: "automation" as const, label: "自动化沙箱", icon: Bot },
                    { value: "script" as const, label: "脚本", icon: Code },
                  ].map(t => (
                    <button key={t.value}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${formTaskType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                      onClick={() => setFormTaskType(t.value)}>
                      <t.icon className="w-4 h-4" /> {t.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">任务描述</label>
              <Input value={formDescription} onChange={e => setFormDescription(e.target.value)} placeholder="描述任务的用途" />
            </div>

            {/* Cron Expression */}
            <div className="space-y-2">
              <label className="text-sm font-medium">执行频率 *</label>
              <div className="flex flex-wrap gap-2 mb-2">
                {CRON_PRESETS.map(p => (
                  <button key={p.value}
                    className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${formCron === p.value ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-accent text-muted-foreground"}`}
                    onClick={() => setFormCron(p.value)}>
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <Input value={formCron} onChange={e => setFormCron(e.target.value)} placeholder="0 0 * * * *" className="font-mono text-sm" />
                <span className="text-xs text-muted-foreground whitespace-nowrap">秒 分 时 日 月 周</span>
              </div>
            </div>

            {/* Webhook Config */}
            {formTaskType === "webhook" && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <h3 className="text-sm font-medium flex items-center gap-1.5"><Globe className="w-4 h-4" /> Webhook 配置</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs text-muted-foreground">请求方法</label>
                    <select value={formWebhookMethod} onChange={e => setFormWebhookMethod(e.target.value)}
                      className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                      <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
                    </select>
                  </div>
                  <div className="md:col-span-3 space-y-1">
                    <label className="text-xs text-muted-foreground">URL *</label>
                    <Input value={formWebhookUrl} onChange={e => setFormWebhookUrl(e.target.value)} placeholder="https://your-api.com/webhook" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">请求头 (JSON)</label>
                  <Input value={formWebhookHeaders} onChange={e => setFormWebhookHeaders(e.target.value)} placeholder='{"Authorization": "Bearer xxx"}' className="font-mono text-xs" />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">请求体 (JSON)</label>
                  <textarea value={formWebhookBody} onChange={e => setFormWebhookBody(e.target.value)}
                    placeholder='{"action": "sync", "data": {}}' rows={3}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none" />
                </div>
              </div>
            )}

            {/* Automation Config */}
            {formTaskType === "automation" && (
              <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
                <h3 className="text-sm font-medium flex items-center gap-1.5"><Bot className="w-4 h-4" /> 自动化沙箱配置</h3>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">关联自动化任务 ID</label>
                  <Input value={formAutomationTaskId} onChange={e => setFormAutomationTaskId(e.target.value)} placeholder="输入自动化任务ID" type="number" />
                </div>
              </div>
            )}

            {/* Advanced Settings */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">超时时间（秒）</label>
                <Input value={formTimeout} onChange={e => setFormTimeout(e.target.value)} type="number" />
              </div>
              <div className="space-y-1">
                <label className="text-xs text-muted-foreground">最大重试次数</label>
                <Input value={formMaxRetries} onChange={e => setFormMaxRetries(e.target.value)} type="number" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>取消</Button>
              <Button onClick={handleSubmit} disabled={submitting || !formName || !formCron}>
                {submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
                {editingTask ? "保存修改" : "创建任务"}
              </Button>
            </div>
          </div>
        )}

    </>
  );
}