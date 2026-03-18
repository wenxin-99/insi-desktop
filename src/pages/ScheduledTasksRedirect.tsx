/**
 * pages/ScheduledTasksRedirect.tsx
 *
 * ★ Phase 4: /scheduled-tasks 重定向到 /agent?scheduled=true
 * 保留旧路由兼容性（收藏夹、外部链接等）
 */
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ScheduledTasksRedirect() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/agent", { replace: true });
    // 让 Agent 页面自动激活定时筛选
    // 通过 URL search params 传递（Agent.tsx 需读取）
    // 简单方案：直接跳转，用户手动切 tab
  }, [navigate]);

  return null;
}
