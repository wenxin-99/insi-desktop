/**
 * scheduledTasks/types — 类型定义、Cron 预设、工具函数
 */
import { Globe, Bot, Code, Zap, CheckCircle, XCircle, AlertTriangle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export interface ScheduledTask {
  id: number; name: string; description: string | null;
  taskType: "webhook" | "automation" | "script";
  cronExpression: string; timezone: string;
  webhookUrl: string | null; webhookMethod: string | null;
  webhookHeaders: string | null; webhookBody: string | null;
  automationTaskId: number | null; scriptContent: string | null;
  status: "active" | "paused" | "disabled";
  maxRetries: number; timeoutSeconds: number;
  lastRunAt: string | null; lastRunStatus: string | null; nextRunAt: string | null;
  totalRuns: number; successRuns: number; failedRuns: number;
  source: string; createdAt: string; updatedAt: string; isScheduled: boolean;
}

export interface TaskLog {
  id: number; taskId: number; status: string;
  startedAt: string; finishedAt: string | null;
  durationMs: number | null; httpStatusCode: number | null;
  responseBody: string | null; errorMessage: string | null; retryCount: number;
}

export const CRON_PRESETS = [
  { label: "每分钟", value: "0 * * * * *" },
  { label: "每5分钟", value: "0 */5 * * * *" },
  { label: "每15分钟", value: "0 */15 * * * *" },
  { label: "每30分钟", value: "0 */30 * * * *" },
  { label: "每小时", value: "0 0 * * * *" },
  { label: "每2小时", value: "0 0 */2 * * *" },
  { label: "每天 8:00", value: "0 0 8 * * *" },
  { label: "每天 12:00", value: "0 0 12 * * *" },
  { label: "每天 18:00", value: "0 0 18 * * *" },
  { label: "每天 22:00", value: "0 0 22 * * *" },
  { label: "工作日 9:00", value: "0 0 9 * * 1-5" },
  { label: "每周一 9:00", value: "0 0 9 * * 1" },
  { label: "每月1日 0:00", value: "0 0 0 1 * *" },
];

export function cronToHuman(cron: string): string {
  const preset = CRON_PRESETS.find(p => p.value === cron);
  if (preset) return preset.label;
  const parts = cron.split(" ");
  if (parts.length !== 6) return cron;
  const [sec, min, hour, day, month, week] = parts;
  if (sec === "0" && min === "*" && hour === "*") return "每分钟";
  if (sec === "0" && min.startsWith("*/") && hour === "*") return `每${min.slice(2)}分钟`;
  if (sec === "0" && min === "0" && hour.startsWith("*/")) return `每${hour.slice(2)}小时`;
  if (sec === "0" && min === "0" && !hour.includes("*") && day === "*" && month === "*") {
    if (week === "*") return `每天 ${hour}:00`;
    if (week === "1-5") return `工作日 ${hour}:00`;
  }
  return cron;
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  return new Date(dateStr).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function authHeaders(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  return token ? { Authorization: "Bearer " + token } : {};
}

// ════════ 小型展示组件 ════════

export function TaskTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "webhook": return <Globe className="w-4 h-4" />;
    case "automation": return <Bot className="w-4 h-4" />;
    case "script": return <Code className="w-4 h-4" />;
    default: return <Zap className="w-4 h-4" />;
  }
}

export function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "active": return <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">运行中</Badge>;
    case "paused": return <Badge className="bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400">已暂停</Badge>;
    case "disabled": return <Badge className="bg-gray-100 text-gray-500">已禁用</Badge>;
    default: return <Badge>{status}</Badge>;
  }
}

export function RunStatusIcon({ status }: { status: string | null }) {
  switch (status) {
    case "success": return <CheckCircle className="w-4 h-4 text-green-500" />;
    case "failed": return <XCircle className="w-4 h-4 text-red-500" />;
    case "timeout": return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
    case "running": return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
    default: return <span className="text-gray-400 text-xs">-</span>;
  }
}
