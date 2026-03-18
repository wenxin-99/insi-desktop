/**
 * scheduledTasks/useScheduledTasks — 状态管理 + CRUD
 */
import { useState, useEffect, useCallback } from "react";
import type { ScheduledTask, TaskLog } from "./types";
import { authHeaders } from "./types";

export function useScheduledTasks() {
  const [tasks, setTasks] = useState<ScheduledTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTask, setEditingTask] = useState<ScheduledTask | null>(null);
  const [showLogs, setShowLogs] = useState<number | null>(null);
  const [logs, setLogs] = useState<TaskLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formTaskType, setFormTaskType] = useState<"webhook" | "automation" | "script">("webhook");
  const [formCron, setFormCron] = useState("0 0 * * * *");
  const [formWebhookUrl, setFormWebhookUrl] = useState("");
  const [formWebhookMethod, setFormWebhookMethod] = useState("POST");
  const [formWebhookHeaders, setFormWebhookHeaders] = useState("");
  const [formWebhookBody, setFormWebhookBody] = useState("");
  const [formAutomationTaskId, setFormAutomationTaskId] = useState("");
  const [formTimeout, setFormTimeout] = useState("30");
  const [formMaxRetries, setFormMaxRetries] = useState("3");
  const [submitting, setSubmitting] = useState(false);

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/scheduled-tasks/tasks", { credentials: "include", headers: authHeaders() });
      if (res.ok) { const data = await res.json(); setTasks(data.tasks); setTotal(data.total); }
    } catch (err) { console.error("Failed to load tasks:", err); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  const loadLogs = async (taskId: number) => {
    setLogsLoading(true);
    try {
      const res = await fetch(`/api/scheduled-tasks/tasks/${taskId}/logs`, { credentials: "include", headers: authHeaders() });
      if (res.ok) { const data = await res.json(); setLogs(data.logs); }
    } catch (err) { console.error("Failed to load logs:", err); }
    finally { setLogsLoading(false); }
  };

  const resetForm = () => {
    setFormName(""); setFormDescription(""); setFormTaskType("webhook");
    setFormCron("0 0 * * * *"); setFormWebhookUrl(""); setFormWebhookMethod("POST");
    setFormWebhookHeaders(""); setFormWebhookBody(""); setFormAutomationTaskId("");
    setFormTimeout("30"); setFormMaxRetries("3"); setEditingTask(null);
  };

  const openEditForm = (task: ScheduledTask) => {
    setEditingTask(task); setFormName(task.name); setFormDescription(task.description || "");
    setFormTaskType(task.taskType); setFormCron(task.cronExpression);
    setFormWebhookUrl(task.webhookUrl || ""); setFormWebhookMethod(task.webhookMethod || "POST");
    setFormWebhookHeaders(task.webhookHeaders || ""); setFormWebhookBody(task.webhookBody || "");
    setFormAutomationTaskId(task.automationTaskId?.toString() || "");
    setFormTimeout(task.timeoutSeconds.toString()); setFormMaxRetries(task.maxRetries.toString());
    setShowForm(true);
  };

  const handleSubmit = async () => {
    if (!formName || !formCron) return;
    setSubmitting(true);
    try {
      const body: any = {
        name: formName, description: formDescription || null, taskType: formTaskType,
        cronExpression: formCron, webhookUrl: formWebhookUrl || null,
        webhookMethod: formWebhookMethod, webhookHeaders: formWebhookHeaders || null,
        webhookBody: formWebhookBody || null,
        automationTaskId: formAutomationTaskId ? parseInt(formAutomationTaskId) : null,
        timeoutSeconds: parseInt(formTimeout) || 30, maxRetries: parseInt(formMaxRetries) || 3,
      };
      const url = editingTask ? `/api/scheduled-tasks/tasks/${editingTask.id}` : "/api/scheduled-tasks/tasks";
      const method = editingTask ? "PUT" : "POST";
      const res = await fetch(url, { method, credentials: "include", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
      if (res.ok) { setShowForm(false); resetForm(); loadTasks(); }
      else { const err = await res.json(); alert(err.error || "操作失败"); }
    } catch (err) { console.error("Submit failed:", err); }
    finally { setSubmitting(false); }
  };

  const handleToggle = async (taskId: number) => {
    try { await fetch(`/api/scheduled-tasks/tasks/${taskId}/toggle`, { method: "POST", credentials: "include", headers: authHeaders() }); loadTasks(); }
    catch (err) { console.error("Toggle failed:", err); }
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm("确定要删除此定时任务吗？")) return;
    try { await fetch(`/api/scheduled-tasks/tasks/${taskId}`, { method: "DELETE", credentials: "include", headers: authHeaders() }); loadTasks(); }
    catch (err) { console.error("Delete failed:", err); }
  };

  const handleRunNow = async (taskId: number) => {
    try { await fetch(`/api/scheduled-tasks/tasks/${taskId}/run`, { method: "POST", credentials: "include", headers: authHeaders() }); setTimeout(loadTasks, 2000); }
    catch (err) { console.error("Run failed:", err); }
  };

  return {
    tasks, total, loading, showForm, setShowForm, editingTask,
    showLogs, setShowLogs, logs, logsLoading,
    formName, setFormName, formDescription, setFormDescription,
    formTaskType, setFormTaskType, formCron, setFormCron,
    formWebhookUrl, setFormWebhookUrl, formWebhookMethod, setFormWebhookMethod,
    formWebhookHeaders, setFormWebhookHeaders, formWebhookBody, setFormWebhookBody,
    formAutomationTaskId, setFormAutomationTaskId,
    formTimeout, setFormTimeout, formMaxRetries, setFormMaxRetries,
    submitting,
    loadTasks, loadLogs, resetForm, openEditForm,
    handleSubmit, handleToggle, handleDelete, handleRunNow,
  };
}
