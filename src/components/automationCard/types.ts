/**
 * automationCard — 共享类型定义
 */

export interface SandboxEvent {
  type: string;
  taskId: number;
  timestamp: number;
  payload: Record<string, any>;
}

export interface StepItem {
  id: number;
  type: string;
  content: string;
  timestamp: number;
  duration?: number;
}

export interface TaskSummary {
  totalSteps: number;
  completed: boolean;
  finalUrl: string;
  finalTitle: string;
  contentInfo?: {
    title: string;
    contentPreview: string;
    contentLength: number;
    publishStatus: string;
    publishedUrl: string;
    publishedAt: string;
  };
  completedAt?: string;
}

export interface ContentInfo {
  id: number;
  title?: string;
  content?: string;
  contentType?: string;
  publishStatus?: string;
  publishedUrl?: string;
  publishedAt?: string;
}

export interface TaskProgressProps {
  steps: StepItem[];
  taskId: number;
  taskName: string;
  siteName: string;
  status: string;
  isConnected?: boolean;
  progress?: number;
  currentStep?: string;
  taskSummary?: TaskSummary | null;
  contentInfo?: ContentInfo | null;
  initialLoaded?: boolean;
  thinking?: string;
  browserUrl?: string;
  browserScreenshot?: string;
}

/** 任务控制 API */
export async function callTaskControl(taskId: number, action: 'pause' | 'resume' | 'cancel') {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`/api/automation/tasks/${taskId}/${action}`, {
    method: 'POST',
    credentials: 'include',
    headers: token ? { 'Authorization': 'Bearer ' + token } : {},
  });
  if (!res.ok) throw new Error(`控制任务失败: ${res.status}`);
  return res.json();
}
