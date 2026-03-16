/**
 * automation/useAutomation — 状态管理与业务逻辑
 */
import { useState, useEffect, useCallback } from "react";
import { type SiteAccount, type AutomationTask, type TaskStep, apiFetch } from "./types";

export function useAutomation() {
  const [accounts, setAccounts] = useState<SiteAccount[]>([]);
  const [tasks, setTasks] = useState<AutomationTask[]>([]);
  const [activeTab, setActiveTab] = useState<"tasks" | "accounts">("tasks");
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editAccount, setEditAccount] = useState<SiteAccount | null>(null);
  const [viewingTaskId, setViewingTaskId] = useState<number | null>(null);
  const [taskDetail, setTaskDetail] = useState<{ task: AutomationTask; steps: TaskStep[]; account: any } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [ar, tr] = await Promise.all([apiFetch("/accounts"), apiFetch("/tasks")]);
      setAccounts(ar.accounts || []);
      setTasks(tr.tasks || []);
      setError(null);
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // 运行中任务轮询
  useEffect(() => {
    if (!tasks.some(t => t.status === "running")) return;
    const interval = setInterval(loadData, 5000);
    return () => clearInterval(interval);
  }, [tasks, loadData]);

  // 任务详情轮询
  useEffect(() => {
    if (!viewingTaskId) return;
    const refresh = async () => {
      try { setTaskDetail(await apiFetch(`/tasks/${viewingTaskId}`)); } catch {}
    };
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [viewingTaskId]);

  // ════════ Handlers ════════

  const handleSaveAccount = async (data: any) => {
    try {
      if (editAccount) await apiFetch(`/accounts/${editAccount.id}`, { method: "PUT", body: JSON.stringify(data) });
      else await apiFetch("/accounts", { method: "POST", body: JSON.stringify(data) });
      setShowAccountModal(false); setEditAccount(null); loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleDeleteAccount = async (id: number) => {
    if (!confirm("确定删除此账号？")) return;
    await apiFetch(`/accounts/${id}`, { method: "DELETE" }); loadData();
  };

  const handleSaveTask = async (data: any) => {
    try {
      await apiFetch("/tasks", { method: "POST", body: JSON.stringify(data) });
      setShowTemplateModal(false); loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handleStartTask = async (id: number) => {
    await apiFetch(`/tasks/${id}/start`, { method: "POST" });
    setViewingTaskId(id);
    try { setTaskDetail(await apiFetch(`/tasks/${id}`)); } catch {}
    loadData();
  };

  const handleRetryTask = async (task: AutomationTask) => {
    try {
      const res = await apiFetch("/tasks", { method: "POST", body: JSON.stringify({
        siteAccountId: task.siteAccountId, taskType: task.taskType,
        name: task.name, instruction: task.instruction,
        targetUrls: [], searchKeywords: [], contentStyle: "professional",
      })});
      await apiFetch(`/tasks/${res.task?.id}/start`, { method: "POST" });
      loadData();
    } catch (e: any) { alert(e.message); }
  };

  const handlePauseTask = (id: number) => apiFetch(`/tasks/${id}/pause`, { method: "POST" }).then(loadData);
  const handleCancelTask = (id: number) => apiFetch(`/tasks/${id}/cancel`, { method: "POST" }).then(loadData);
  const handleDeleteTask = (id: number) => {
    if (!confirm("确定删除此任务？")) return;
    apiFetch(`/tasks/${id}`, { method: "DELETE" }).then(loadData);
  };

  const completedCount = tasks.filter(t => t.status === "completed").length;
  const runningCount = tasks.filter(t => t.status === "running").length;

  return {
    accounts, tasks, activeTab, setActiveTab,
    showAccountModal, setShowAccountModal,
    showTemplateModal, setShowTemplateModal,
    editAccount, setEditAccount,
    viewingTaskId, setViewingTaskId,
    taskDetail, setTaskDetail,
    loading, error,
    completedCount, runningCount,
    loadData,
    handleSaveAccount, handleDeleteAccount,
    handleSaveTask, handleStartTask, handleRetryTask,
    handlePauseTask, handleCancelTask, handleDeleteTask,
  };
}
