/**
 * automation/types — 共享类型定义
 */

export interface SiteAccount {
  id: number; siteName: string; siteUrl: string; loginUrl: string;
  username: string; status: string; lastLoginAt: string | null;
  lastLoginSuccess: boolean | null; loginFailCount: number;
  notes: string | null; createdAt: string;
}

export interface AutomationTask {
  id: number; siteAccountId: number; taskType: string; name: string;
  instruction: string; status: string; progress: number;
  currentStep: string | null; totalSteps: number;
  startedAt: string | null; completedAt: string | null;
  errorMessage: string | null; createdAt: string;
}

export interface TaskStep {
  id: number; stepNumber: number; type: string; content: string;
  screenshotUrl: string | null; selector: string | null;
  inputText: string | null; durationMs: number | null;
  success: boolean; errorMessage: string | null; createdAt: string;
}

export interface Template {
  id: string;
  category: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  taskType: string;
  buildInstruction: (account: SiteAccount) => string;
  estimatedSteps: number;
  tags: string[];
  color: string;
}

/** 带认证的 fetch 封装 */
const API_BASE = "/api/automation";

export async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const authHeaders: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders, ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "请求失败");
  }
  return res.json();
}
