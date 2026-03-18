/**
 * AutomationTaskCard — 聊天内嵌的自动化任务卡片
 * 
 * 负责：Socket.io 连接、步骤收集、状态管理
 * ★ 支持多账号顺序执行：自动跟踪后续任务
 * 渲染交给 TaskProgress 子组件
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";

import type { SandboxEvent, StepItem, TaskSummary, ContentInfo } from "./automationCard/types";
import { classifyStep, formatStepContent } from "./automationCard/stepUtils";
import { TaskProgress } from "./automationCard/TaskProgress";

interface TaskInfo {
  taskId: number;
  username: string;
  taskName: string;
}

interface AutomationTaskCardProps {
  taskId: number;
  taskName: string;
  siteName: string;
  allTasks?: TaskInfo[];
}

export function AutomationTaskCard({ taskId, taskName, siteName, allTasks }: AutomationTaskCardProps) {
  // ★ 多账号跟踪状态
  const [activeTaskId, setActiveTaskId] = useState(taskId);
  const [activeTaskIndex, setActiveTaskIndex] = useState(0);
  const [completedTasks, setCompletedTasks] = useState<Array<{ taskId: number; username: string; success: boolean; summary?: TaskSummary; content?: ContentInfo }>>([]);
  const isMultiTask = allTasks && allTasks.length > 1;

  const [status, setStatus] = useState<string>("");
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState<string>("启动中...");
  const [steps, setSteps] = useState<StepItem[]>([]);
  const [thinking, setThinking] = useState<string>("");
  const [isConnected, setIsConnected] = useState(false);
  const [browserUrl, setBrowserUrl] = useState<string>("");
  const [browserScreenshot, setBrowserScreenshot] = useState<string>("");
  const [taskSummary, setTaskSummary] = useState<TaskSummary | null>(null);
  const [contentInfo, setContentInfo] = useState<ContentInfo | null>(null);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const stepCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const switchingRef = useRef(false);

  // 通用 fetch headers
  const authHeaders = () => {
    const token = localStorage.getItem("auth_token");
    return token ? { Authorization: "Bearer " + token } : {};
  };

  // ★ 重置卡片状态（切换到新任务时）
  const resetForNewTask = useCallback(() => {
    setStatus("");
    setProgress(0);
    setCurrentStep("启动中...");
    setSteps([]);
    setThinking("");
    setBrowserUrl("");
    setBrowserScreenshot("");
    setTaskSummary(null);
    setContentInfo(null);
    stepCountRef.current = 0;
    startTimeRef.current = Date.now();
  }, []);

  // ★ 切换到下一个任务
  const switchToNextTask = useCallback((completedTaskId: number, summary: TaskSummary | null, content: ContentInfo | null) => {
    if (!isMultiTask || switchingRef.current) return;

    const currentIdx = allTasks!.findIndex(t => t.taskId === completedTaskId);
    const currentInfo = allTasks![currentIdx];
    
    // 记录已完成的任务
    setCompletedTasks(prev => {
      if (prev.some(t => t.taskId === completedTaskId)) return prev;
      return [...prev, {
        taskId: completedTaskId,
        username: currentInfo?.username || `账号${currentIdx + 1}`,
        success: true,
        summary: summary || undefined,
        content: content || undefined,
      }];
    });

    // 如果还有后续任务，自动切换
    if (currentIdx < allTasks!.length - 1) {
      switchingRef.current = true;
      const nextTask = allTasks![currentIdx + 1];
      console.log(`[AutomationCard] Switching from task #${completedTaskId} to #${nextTask.taskId} (${nextTask.username})`);

      // 先离开旧 room
      if (socketRef.current) {
        socketRef.current.emit("leave_task", completedTaskId);
      }

      // 延迟切换让后端有时间启动下一个任务
      setTimeout(() => {
        resetForNewTask();
        setActiveTaskId(nextTask.taskId);
        setActiveTaskIndex(currentIdx + 1);
        setCurrentStep(`正在启动账号 ${nextTask.username}...`);
        switchingRef.current = false;
      }, 2000);
    }
  }, [isMultiTask, allTasks, resetForNewTask]);

  // 初始化时从 API 加载任务状态（刷新后恢复）
  useEffect(() => {
    if (!activeTaskId) return;
    
    const loadTaskState = async () => {
      try {
        const res = await fetch(`/api/automation/tasks/${activeTaskId}`, {
          credentials: "include",
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const task = data.task;
          
          if (task.status) setStatus(task.status);
          if (task.progress != null) setProgress(task.progress);
          
          if (task.resultSummary) {
            try { setTaskSummary(JSON.parse(task.resultSummary)); } catch {}
          }
          
          if (data.contents?.length > 0) setContentInfo(data.contents[0]);
          
          if (data.steps?.length > 0) {
            const restoredSteps: StepItem[] = data.steps.map((s: any, idx: number) => ({
              id: idx + 1,
              type: s.type || "action",
              content: s.content || `步骤 #${s.stepNumber}`,
              timestamp: new Date(s.createdAt).getTime(),
              duration: s.durationMs ? (s.durationMs / 1000) : undefined,
            }));
            setSteps(restoredSteps);
            stepCountRef.current = restoredSteps.length;
          }
          
          if (["completed", "failed", "cancelled"].includes(task.status)) {
            // ★ 多账号场景：如果当前任务已完成，尝试切换到下一个
            if (isMultiTask) {
              const summary = task.resultSummary ? JSON.parse(task.resultSummary) : null;
              const content = data.contents?.[0] || null;
              switchToNextTask(activeTaskId, summary, content);
            } else {
              setCurrentStep(task.status === "completed" ? "任务完成" : "任务结束");
            }
          } else if (task.currentStep) {
            setCurrentStep(task.currentStep);
          }
        }
      } catch {}
      finally { setInitialLoaded(true); }
    };
    
    loadTaskState();
  }, [activeTaskId]);

  // 添加步骤
  const addStep = useCallback((event: SandboxEvent) => {
    stepCountRef.current += 1;
    const stepType = classifyStep(event);
    const content = formatStepContent(event);
    const elapsed = ((event.timestamp - startTimeRef.current) / 1000).toFixed(1);

    setSteps(prev => {
      if (prev.length > 0 && prev[prev.length - 1].content === content) return prev;
      const newStep: StepItem = {
        id: stepCountRef.current,
        type: stepType,
        content,
        timestamp: event.timestamp,
        duration: parseFloat(elapsed),
      };
      const updated = [...prev, newStep];
      if (updated.length > 50) updated.splice(0, updated.length - 50);
      return updated;
    });
  }, []);

  // 加载任务完成数据
  const loadCompletionData = useCallback(async () => {
    try {
      const res = await fetch(`/api/automation/tasks/${activeTaskId}`, {
        credentials: "include",
        headers: authHeaders(),
      });
      if (res.ok) {
        const data = await res.json();
        const task = data.task;
        if (task.status) setStatus(task.status);
        if (task.progress != null) setProgress(task.progress);
        let summary: TaskSummary | null = null;
        let content: ContentInfo | null = null;
        if (task.resultSummary) {
          try { summary = JSON.parse(task.resultSummary); setTaskSummary(summary); } catch {}
        }
        if (data.contents?.length > 0) { content = data.contents[0]; setContentInfo(content); }

        // ★ 多账号场景：任务完成后自动切换到下一个
        if (isMultiTask && ["completed", "failed", "cancelled"].includes(task.status)) {
          switchToNextTask(activeTaskId, summary, content);
        }
      }
    } catch {}
  }, [activeTaskId, isMultiTask, switchToNextTask]);

  // 处理沙箱事件
  const handleSandboxEvent = useCallback((event: SandboxEvent) => {
    // ★ 忽略非当前任务的事件
    if (event.taskId !== activeTaskId) {
      // 但如果是 next_task 事件且来自当前任务，处理切换
      if ((event.type as any) === "next_task" && event.payload?.nextTaskId) {
        console.log(`[AutomationCard] Received next_task from #${event.taskId}, switching to #${event.payload.nextTaskId}`);
        return;
      }
      return;
    }

    switch (event.type) {
      case "browser_screenshot":
        setBrowserUrl(event.payload.url || "");
        if (event.payload.screenshot) {
          setBrowserScreenshot(event.payload.screenshot);
        }
        break;
      case "browser_navigate":
        setBrowserUrl(event.payload.url || "");
        if (event.payload.screenshot) {
          setBrowserScreenshot(event.payload.screenshot);
        }
        addStep(event);
        break;
      case "agent_thinking":
        setThinking(event.payload.thought || "");
        break;
      case "agent_step":
        setThinking("");
        addStep(event);
        break;
      case "task_status":
        setStatus(event.payload.status);
        if (event.payload.message) setCurrentStep(event.payload.message);
        if (["completed", "failed", "cancelled"].includes(event.payload.status)) {
          loadCompletionData();
        }
        break;
      case "task_progress":
        setProgress(event.payload.progress || 0);
        if (event.payload.currentStep) setCurrentStep(event.payload.currentStep);
        break;
      case "browser_loading":
        setBrowserUrl(event.payload.url || "");
        break;
    }
  }, [activeTaskId, addStep, loadCompletionData]);

  // 连接 Socket.io — ★ 当 activeTaskId 变化时重新连接
  useEffect(() => {
    if (!activeTaskId) return;

    const authToken = localStorage.getItem('auth_token') || '';
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      auth: authToken ? { token: authToken } : undefined,
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      socket.emit("join_task", activeTaskId);
    });

    socket.on("disconnect", () => setIsConnected(false));

    socket.on("sandbox_event", (event: SandboxEvent) => {
      handleSandboxEvent(event);
    });

    return () => {
      socket.emit("leave_task", activeTaskId);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [activeTaskId, handleSandboxEvent]);

  // 轮询任务状态（socket 备份）
  useEffect(() => {
    if (["completed", "failed", "cancelled"].includes(status)) {
      // ★ 多账号场景：当前任务完成后不停止轮询，可能需要切换
      if (!isMultiTask) return;
      // 已经是最后一个任务了才停
      const idx = allTasks!.findIndex(t => t.taskId === activeTaskId);
      if (idx >= allTasks!.length - 1) return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/automation/tasks/${activeTaskId}`, {
          credentials: "include",
          headers: authHeaders(),
        });
        if (res.ok) {
          const data = await res.json();
          const task = data.task;
          setStatus(task.status);
          setProgress(task.progress || 0);
          if (task.currentStep) setCurrentStep(task.currentStep);
          if (["completed", "failed", "cancelled"].includes(task.status)) {
            if (task.resultSummary) {
              try { setTaskSummary(JSON.parse(task.resultSummary)); } catch {}
            }
            if (data.contents?.length > 0) setContentInfo(data.contents[0]);
            
            // ★ 多账号场景：触发切换
            if (isMultiTask) {
              const summary = task.resultSummary ? JSON.parse(task.resultSummary) : null;
              switchToNextTask(activeTaskId, summary, data.contents?.[0] || null);
            }
          }
        }
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTaskId, status, isMultiTask, allTasks, switchToNextTask]);

  // ★ 多账号进度指示器
  const multiTaskHeader = isMultiTask ? (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className="text-xs text-muted-foreground">批量执行：</span>
      <div className="flex items-center gap-1">
        {allTasks!.map((t, idx) => {
          const isCompleted = completedTasks.some(ct => ct.taskId === t.taskId);
          const isActive = t.taskId === activeTaskId;
          const isPending = !isCompleted && !isActive;
          return (
            <div
              key={t.taskId}
              className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                isActive ? "bg-blue-100 text-blue-700 ring-1 ring-blue-300 dark:bg-blue-900/30 dark:text-blue-300" :
                isCompleted ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" :
                "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500"
              }`}
              title={`任务 #${t.taskId}`}
            >
              {isCompleted && <span>✓</span>}
              {isActive && <span className="inline-block w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />}
              {t.username}
            </div>
          );
        })}
      </div>
      <span className="text-xs text-muted-foreground ml-auto">
        {completedTasks.length}/{allTasks!.length}
      </span>
    </div>
  ) : null;

  return (
    <div>
      {multiTaskHeader}
      <TaskProgress
        steps={steps}
        taskId={activeTaskId}
        taskName={isMultiTask ? `${allTasks![activeTaskIndex]?.username || taskName}` : taskName}
        siteName={siteName}
        status={status}
        isConnected={isConnected}
        progress={progress}
        currentStep={currentStep}
        taskSummary={taskSummary}
        contentInfo={contentInfo}
        initialLoaded={initialLoaded}
        thinking={thinking}
        browserUrl={browserUrl}
        browserScreenshot={browserScreenshot}
      />
    </div>
  );
}
