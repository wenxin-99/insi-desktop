/**
 * automationCard/stepUtils — 步骤分类、图标、格式化工具
 */
import {
  Bot, XCircle, Navigation, LogIn, Eye,
  MousePointer, Keyboard, Send, FileText,
} from "lucide-react";
import type { SandboxEvent } from "./types";

// ============ 步骤图标映射 ============

export function getStepIcon(type: string) {
  switch (type) {
    case "navigate": return <Navigation className="h-3 w-3 text-blue-500" />;
    case "login":    return <LogIn className="h-3 w-3 text-green-500" />;
    case "captcha":  return <Eye className="h-3 w-3 text-purple-500" />;
    case "click":    return <MousePointer className="h-3 w-3 text-orange-500" />;
    case "type":     return <Keyboard className="h-3 w-3 text-cyan-500" />;
    case "post":     return <Send className="h-3 w-3 text-emerald-500" />;
    case "thought":  return <Bot className="h-3 w-3 text-yellow-500" />;
    case "error":    return <XCircle className="h-3 w-3 text-red-500" />;
    default:         return <FileText className="h-3 w-3 text-gray-500" />;
  }
}

// ============ 步骤分类 ============

export function classifyStep(event: SandboxEvent): string {
  const { type, payload } = event;

  if (type === "browser_navigate") return "navigate";

  if (type === "agent_thinking") {
    const thought = (payload.thought || "").toLowerCase();
    if (thought.includes("登录") || thought.includes("login")) return "login";
    if (thought.includes("验证码") || thought.includes("captcha")) return "captcha";
    if (thought.includes("发帖") || thought.includes("发布") || thought.includes("post")) return "post";
    if (thought.includes("点击") || thought.includes("click")) return "click";
    return "thought";
  }

  if (type === "agent_step") {
    const content = (payload.content || "").toLowerCase();
    if (content.includes("登录成功") || content.includes("login")) return "login";
    if (content.includes("验证码")) return "captcha";
    if (content.includes("click") || content.includes("点击")) return "click";
    if (content.includes("type") || content.includes("input") || content.includes("fill") || content.includes("输入")) return "type";
    if (content.includes("navigate") || content.includes("导航")) return "navigate";
    if (content.includes("发帖") || content.includes("发布") || content.includes("post")) return "post";
    return "action";
  }

  return "action";
}

// ============ 步骤内容格式化 ============

export function formatStepContent(event: SandboxEvent): string {
  const { type, payload } = event;
  if (type === "browser_navigate") return `导航到 ${payload.url}`;
  if (type === "agent_thinking") return payload.thought || "思考中...";
  if (type === "agent_step") return payload.content || `步骤 #${payload.stepNumber}`;
  if (type === "task_status") return `状态: ${payload.status} ${payload.message || ""}`;
  if (type === "task_progress") return `进度: ${payload.progress}% - ${payload.currentStep || ""}`;
  return JSON.stringify(payload).substring(0, 100);
}

// ============ 时间格式化 ============

export function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "刚刚";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}分钟前`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}小时前`;
  const diffDay = Math.floor(diffHour / 24);
  return `${diffDay}天前`;
}
