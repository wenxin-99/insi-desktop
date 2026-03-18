/**
 * scheduledTasks/TaskForm — 创建/编辑定时任务表单
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Globe, Bot, Code, XCircle, Loader2 } from "lucide-react";
import { CRON_PRESETS } from "./types";

interface TaskFormProps {
  isEditing: boolean;
  formName: string; setFormName: (v: string) => void;
  formDescription: string; setFormDescription: (v: string) => void;
  formTaskType: "webhook" | "automation" | "script"; setFormTaskType: (v: "webhook" | "automation" | "script") => void;
  formCron: string; setFormCron: (v: string) => void;
  formWebhookUrl: string; setFormWebhookUrl: (v: string) => void;
  formWebhookMethod: string; setFormWebhookMethod: (v: string) => void;
  formWebhookHeaders: string; setFormWebhookHeaders: (v: string) => void;
  formWebhookBody: string; setFormWebhookBody: (v: string) => void;
  formAutomationTaskId: string; setFormAutomationTaskId: (v: string) => void;
  formTimeout: string; setFormTimeout: (v: string) => void;
  formMaxRetries: string; setFormMaxRetries: (v: string) => void;
  submitting: boolean;
  onSubmit: () => void;
  onCancel: () => void;
}

export function TaskForm(p: TaskFormProps) {
  return (
    <div className="border rounded-xl p-6 bg-card space-y-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{p.isEditing ? "编辑任务" : "创建定时任务"}</h2>
        <Button variant="ghost" size="sm" onClick={p.onCancel}><XCircle className="w-4 h-4" /></Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">任务名称 *</label>
          <Input value={p.formName} onChange={(e) => p.setFormName(e.target.value)} placeholder="例如：每日数据同步" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">任务类型</label>
          <div className="flex gap-2">
            {([
              { value: "webhook" as const, label: "Webhook", icon: Globe },
              { value: "automation" as const, label: "自动化沙箱", icon: Bot },
              { value: "script" as const, label: "脚本", icon: Code },
            ] as const).map((t) => (
              <button key={t.value}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition-colors ${p.formTaskType === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-accent"}`}
                onClick={() => p.setFormTaskType(t.value)}>
                <t.icon className="w-4 h-4" /> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">任务描述</label>
        <Input value={p.formDescription} onChange={(e) => p.setFormDescription(e.target.value)} placeholder="描述任务的用途" />
      </div>

      {/* Cron Expression */}
      <div className="space-y-2">
        <label className="text-sm font-medium">执行频率 *</label>
        <div className="flex flex-wrap gap-2 mb-2">
          {CRON_PRESETS.map((preset) => (
            <button key={preset.value}
              className={`px-2.5 py-1 rounded-full text-xs border transition-colors ${p.formCron === preset.value ? "border-primary bg-primary/10 text-primary font-medium" : "border-border hover:bg-accent text-muted-foreground"}`}
              onClick={() => p.setFormCron(preset.value)}>{preset.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Input value={p.formCron} onChange={(e) => p.setFormCron(e.target.value)} placeholder="0 0 * * * *" className="font-mono text-sm" />
          <span className="text-xs text-muted-foreground whitespace-nowrap">秒 分 时 日 月 周</span>
        </div>
      </div>

      {/* Webhook Config */}
      {p.formTaskType === "webhook" && (
        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
          <h3 className="text-sm font-medium flex items-center gap-1.5"><Globe className="w-4 h-4" /> Webhook 配置</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="space-y-1">
              <label className="text-xs text-muted-foreground">请求方法</label>
              <select value={p.formWebhookMethod} onChange={(e) => p.setFormWebhookMethod(e.target.value)} className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm">
                <option>GET</option><option>POST</option><option>PUT</option><option>DELETE</option>
              </select>
            </div>
            <div className="md:col-span-3 space-y-1">
              <label className="text-xs text-muted-foreground">URL *</label>
              <Input value={p.formWebhookUrl} onChange={(e) => p.setFormWebhookUrl(e.target.value)} placeholder="https://your-api.com/webhook" />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">请求头 (JSON)</label>
            <Input value={p.formWebhookHeaders} onChange={(e) => p.setFormWebhookHeaders(e.target.value)} placeholder='{"Authorization": "Bearer xxx"}' className="font-mono text-xs" />
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">请求体 (JSON)</label>
            <textarea value={p.formWebhookBody} onChange={(e) => p.setFormWebhookBody(e.target.value)} placeholder='{"action": "sync"}' rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-none" />
          </div>
        </div>
      )}

      {/* Automation Config */}
      {p.formTaskType === "automation" && (
        <div className="space-y-3 p-4 rounded-lg border bg-muted/30">
          <h3 className="text-sm font-medium flex items-center gap-1.5"><Bot className="w-4 h-4" /> 自动化沙箱配置</h3>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">关联自动化任务 ID</label>
            <Input value={p.formAutomationTaskId} onChange={(e) => p.setFormAutomationTaskId(e.target.value)} placeholder="输入自动化任务ID" type="number" />
          </div>
        </div>
      )}

      {/* Advanced */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1"><label className="text-xs text-muted-foreground">超时时间（秒）</label><Input value={p.formTimeout} onChange={(e) => p.setFormTimeout(e.target.value)} type="number" /></div>
        <div className="space-y-1"><label className="text-xs text-muted-foreground">最大重试次数</label><Input value={p.formMaxRetries} onChange={(e) => p.setFormMaxRetries(e.target.value)} type="number" /></div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={p.onCancel}>取消</Button>
        <Button onClick={p.onSubmit} disabled={p.submitting || !p.formName || !p.formCron}>
          {p.submitting && <Loader2 className="w-4 h-4 mr-1 animate-spin" />}
          {p.isEditing ? "保存修改" : "创建任务"}
        </Button>
      </div>
    </div>
  );
}
