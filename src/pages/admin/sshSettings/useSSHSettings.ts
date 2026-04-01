/**
 * sshSettings/useSSHSettings — 状态管理与所有操作
 */
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { type SSHConfigItem, type SSHFormData, DEFAULT_SSH_FORM, authHeaders } from "./types";

export function useSSHSettings() {
  const { toast } = useToast();
  const [configs, setConfigs] = useState<SSHConfigItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ id: number; success: boolean; message: string; info?: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<SSHFormData>(DEFAULT_SSH_FORM);

  // 沙箱相关
  const [sandboxAction, setSandboxAction] = useState<{ id: number; action: string } | null>(null);
  const [sandboxLogs, setSandboxLogs] = useState<{ id: number; logs: string } | null>(null);
  const [expandedSandbox, setExpandedSandbox] = useState<number | null>(null);
  const [deployProgress, setDeployProgress] = useState<{ step: number; totalSteps: number; label: string; percent: number } | null>(null);
  const [diagResult, setDiagResult] = useState<{ id: number; checks: any[]; overall: string } | null>(null);
  const [diagnosing, setDiagnosing] = useState(false);
  const [deployPolling, setDeployPolling] = useState<number | null>(null);

  // ════════ 数据加载 ════════

  const fetchConfigs = async () => {
    try {
      const res = await fetch("/api/ssh/configs", { credentials: "include", headers: authHeaders() });
      const data = await res.json();
      setConfigs(data.configs || []);
    } catch {
      toast({ title: "加载失败", description: "无法获取 SSH 配置列表", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchConfigs(); }, []);

  // ════════ SSH CRUD ════════

  const resetForm = () => {
    setForm(DEFAULT_SSH_FORM);
    setEditingId(null);
    setShowForm(false);
  };

  const handleSave = async () => {
    if (!form.name || !form.host || !form.username) {
      toast({ title: "请填写必填项", description: "名称、主机地址和用户名不能为空", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const url = editingId ? `/api/ssh/configs/${editingId}` : "/api/ssh/configs";
      const method = editingId ? "PUT" : "POST";
      const payload: any = { ...form };
      if (editingId) {
        if (!payload.password) delete payload.password;
        if (!payload.privateKey) delete payload.privateKey;
        if (!payload.passphrase) delete payload.passphrase;
      }
      const res = await fetch(url, {
        method,
        headers: authHeaders({ "Content-Type": "application/json" }),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: editingId ? "更新成功" : "创建成功" });
      resetForm();
      fetchConfigs();
    } catch (err: any) {
      toast({ title: "保存失败", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此 SSH 配置吗？")) return;
    try {
      await fetch(`/api/ssh/configs/${id}`, { method: "DELETE", credentials: "include", headers: authHeaders() });
      toast({ title: "已删除" });
      fetchConfigs();
    } catch (err: any) {
      toast({ title: "删除失败", description: err.message, variant: "destructive" });
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/ssh/configs/${id}/test`, { method: "POST", headers: authHeaders(), credentials: "include" });
      const data = await res.json();
      setTestResult({ id, ...data });
    } catch (err: any) {
      setTestResult({ id, success: false, message: err.message });
    } finally {
      setTestingId(null);
    }
  };

  const handleSetDefault = async (id: number) => {
    try {
      await fetch(`/api/ssh/configs/${id}/set-default`, { method: "POST", headers: authHeaders(), credentials: "include" });
      toast({ title: "已设为默认配置" });
      fetchConfigs();
    } catch (err: any) {
      toast({ title: "设置失败", description: err.message, variant: "destructive" });
    }
  };

  const handleEdit = (config: SSHConfigItem) => {
    setForm({
      name: config.name, host: config.host, port: config.port,
      username: config.username, authType: config.authType,
      password: "", privateKey: "", passphrase: "",
      connectTimeout: config.connectTimeout,
    });
    setEditingId(config.id);
    setShowForm(true);
  };

  // ════════ 沙箱操作 ════════

  const handleSandboxToggle = async (configId: number, enabled: boolean) => {
    try {
      const res = await fetch(`/api/ssh/configs/${configId}/sandbox/toggle`, {
        method: "POST", headers: authHeaders({ "Content-Type": "application/json" }),
        credentials: "include", body: JSON.stringify({ enabled, wsPort: 3100, maxTasks: 3 }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: enabled ? "已启用沙箱模式" : "已关闭沙箱模式" });
        fetchConfigs();
      } else throw new Error(data.error);
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    }
  };

  // 轮询部署日志
  useEffect(() => {
    if (!deployPolling) return;
    const configId = deployPolling;
    let stopped = false;
    const poll = async () => {
      while (!stopped) {
        try {
          const res = await fetch(`/api/ssh/configs/${configId}/sandbox/logs?lines=80`, { credentials: "include", headers: authHeaders() });
          const data = await res.json();
          try {
            const pRes = await fetch(`/api/ssh/configs/${configId}/sandbox/progress`, { credentials: "include", headers: authHeaders() });
            const pData = await pRes.json();
            if (pData.progress) setDeployProgress(pData.progress);
          } catch {}
          if (!stopped) setSandboxLogs({ id: configId, logs: data.logs || "⏳ 等待部署日志..." });
          if (!data.deploying) {
            if (!stopped) { fetchConfigs(); setSandboxAction(null); setDeployPolling(null); }
            return;
          }
        } catch {}
        await new Promise(r => setTimeout(r, 3000));
      }
    };
    poll();
    return () => { stopped = true; };
  }, [deployPolling]);

  const handleSandboxAction = async (configId: number, action: "deploy" | "start" | "stop" | "restart" | "check") => {
    setSandboxAction({ id: configId, action });
    try {
      const res = await fetch(`/api/ssh/configs/${configId}/sandbox/${action}`, {
        method: "POST", headers: authHeaders(), credentials: "include",
      });
      const data = await res.json();
      if (action === "deploy") {
        setSandboxLogs({ id: configId, logs: "⏳ 部署已启动，正在获取日志..." });
        setDeployPolling(configId);
        toast({ title: "部署已开始", description: "后台执行中，日志将自动更新" });
        return;
      }
      if (data.success || data.status) {
        toast({ title: action === "check" ? "检查完成" : "操作成功" });
      } else if (data.error) {
        toast({ title: "操作失败", description: data.error, variant: "destructive" });
      }
      fetchConfigs();
      if (["start", "stop", "restart"].includes(action)) setTimeout(() => fetchConfigs(), 3000);
    } catch (err: any) {
      toast({ title: "操作失败", description: err.message, variant: "destructive" });
    } finally {
      if (action !== "deploy") setSandboxAction(null);
    }
  };

  const handleCancelDeploy = async (configId: number) => {
    try {
      const res = await fetch(`/api/ssh/configs/${configId}/sandbox/cancel-deploy`, {
        method: "POST", credentials: "include", headers: authHeaders(),
      });
      const data = await res.json();
      toast({ title: data.success ? "取消请求已发送" : "取消失败", description: data.message });
    } catch (err: any) {
      toast({ title: "取消失败", description: err.message, variant: "destructive" });
    }
  };

  const handleDiagnose = async (configId: number) => {
    setDiagnosing(true);
    setDiagResult(null);
    try {
      const res = await fetch(`/api/ssh/configs/${configId}/sandbox/diagnose`, {
        method: "POST", credentials: "include", headers: authHeaders(),
      });
      const data = await res.json();
      setDiagResult({ id: configId, ...data });
    } catch (err: any) {
      toast({ title: "诊断失败", description: err.message, variant: "destructive" });
    } finally {
      setDiagnosing(false);
    }
  };

  const handleViewLogs = async (configId: number) => {
    try {
      const res = await fetch(`/api/ssh/configs/${configId}/sandbox/logs?lines=80`, { credentials: "include", headers: authHeaders() });
      const data = await res.json();
      setSandboxLogs({ id: configId, logs: data.logs || "(无日志)" });
    } catch (err: any) {
      setSandboxLogs({ id: configId, logs: `获取日志失败: ${err.message}` });
    }
  };

  return {
    configs, loading, showForm, setShowForm, editingId,
    testingId, testResult, saving, form, setForm,
    sandboxAction, sandboxLogs, setSandboxLogs,
    expandedSandbox, setExpandedSandbox,
    deployProgress, diagResult, setDiagResult, diagnosing,
    resetForm, handleSave, handleDelete, handleTest,
    handleSetDefault, handleEdit,
    handleSandboxToggle, handleSandboxAction,
    handleCancelDeploy, handleDiagnose, handleViewLogs,
  };
}
