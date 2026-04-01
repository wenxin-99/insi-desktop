/**
 * pages/agent/types.ts — Agent 任务中心类型定义
 *
 * ★ Phase 1: 新增 scheduleId, parentTaskId, isTemplate, schedule 字段
 */

export type AgentType = "automation" | "research" | "codeact" | "general";
export type AgentStatus = "pending" | "running" | "paused" | "completed" | "failed" | "cancelled";

export interface AgentTask {
  id: string;
  userId: number;
  type: AgentType;
  status: AgentStatus;
  prompt: string;
  images: string[] | null;
  config: any;
  result: any;
  totalSteps: number;
  totalCost: string;
  sandboxId: string | null;
  errorMsg: string | null;
  // ★ Phase 1: 定时调度字段
  scheduleId: number | null;
  parentTaskId: string | null;
  isTemplate: number; // 0 or 1
  createdAt: string;
  updatedAt: string;
}

/** 定时调度配置（从 getScheduleRuns 返回） */
export interface AgentSchedule {
  id: number;
  templateTaskId: string;
  cronExpression: string;
  timezone: string;
  status: "active" | "paused" | "disabled";
  webhookUrl: string | null;
  webhookMethod: string | null;
  nextRunAt: string | null;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  totalRuns: number;
  successRuns: number;
  failedRuns: number;
  maxRetries: number;
  timeoutSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface AgentStep {
  id: number;
  taskId: string;
  stepNumber: number;
  type: string; // thought / action / error / complete / summary
  toolName: string | null;
  toolInput: string | null;
  observation: string | null;
  metadata: any;
  createdAt: string;
}

export const TYPE_LABELS: Record<AgentType, string> = {
  automation: "浏览器自动化",
  research: "深度调研",
  codeact: "代码执行",
  general: "通用 Agent",
};

export const TYPE_COLORS: Record<AgentType, string> = {
  automation: "bg-blue-100 text-blue-700",
  research: "bg-purple-100 text-purple-700",
  codeact: "bg-emerald-100 text-emerald-700",
  general: "bg-gray-100 text-gray-700",
};

export const STATUS_LABELS: Record<AgentStatus, string> = {
  pending: "排队中",
  running: "执行中",
  paused: "已暂停",
  completed: "已完成",
  failed: "失败",
  cancelled: "已取消",
};

export const STATUS_COLORS: Record<AgentStatus, string> = {
  pending: "bg-yellow-100 text-yellow-700",
  running: "bg-cyan-100 text-cyan-700",
  paused: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
  cancelled: "bg-gray-100 text-gray-500",
};

// ★ Phase 1: Cron 可读化
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

/** 辅助：判断任务是否为定时模板 */
export function isScheduledTask(task: AgentTask): boolean {
  return task.isTemplate === 1 || task.scheduleId != null;
}
