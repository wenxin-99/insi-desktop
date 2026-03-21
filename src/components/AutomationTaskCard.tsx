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
  const [helpNeeded, setHelpNeeded] = useState<{ reason: string; category: string } | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const stepCountRef = useRef(0);
  const startTimeRef = useRef(Date.now());
  const switchingRef = useRef(false);
  // ★ 初始加载后如果任务已终态，跳过 socket 连接和轮询
  const isTerminalRef = useRef(false);

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
  // ★ 用 loadedOnceRef 防止 setActiveTaskId 触发的级联重载，但保证首次加载完整执行
  const loadedOnceRef = useRef(false);
  useEffect(() => {
    if (!activeTaskId) return;
    if (loadedOnceRef.current) return; // 只执行一次
    loadedOnceRef.current = true;
    
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

          // ★ 恢复浏览器截图（刷新后保留最后一帧画面）
          if (data.lastScreenshot) {
            setBrowserScreenshot(data.lastScreenshot);
            if (task.currentStep) setBrowserUrl(task.currentStep);
          }
          
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
            if (isMultiTask) {
              // ★ 历史卡片优化：直接跳到最后一个任务的最终状态，不逐个 switchToNextTask
              const lastTask = allTasks![allTasks!.length - 1];
              const lastIsThis = lastTask.taskId === activeTaskId;
              
              if (!lastIsThis) {
                // 直接加载最后一个任务的状态
                try {
                  const lastRes = await fetch(`/api/automation/tasks/${lastTask.taskId}`, {
                    credentials: "include",
                    headers: authHeaders(),
                  });
                  if (lastRes.ok) {
                    const lastData = await lastRes.json();
                    const lastTaskData = lastData.task;
                    if (["completed", "failed", "cancelled"].includes(lastTaskData.status)) {
                      // 所有任务都已终态 — 直接标记整批完成，不触发逐个切换
                      isTerminalRef.current = true;
                      // 构建已完成列表
                      const completed = allTasks!.map(t => ({
                        taskId: t.taskId,
                        username: t.username,
                        success: true, // 简化，详情可展开查看
                      }));
                      setCompletedTasks(completed);
                      setActiveTaskId(lastTask.taskId);
                      setActiveTaskIndex(allTasks!.length - 1);
                      setStatus(lastTaskData.status);
                      setProgress(lastTaskData.progress || 100);
                      setCurrentStep(lastTaskData.status === "completed" ? "任务完成" : "任务结束");
                      if (lastTaskData.resultSummary) {
                        try { setTaskSummary(JSON.parse(lastTaskData.resultSummary)); } catch {}
                      }
                      if (lastData.contents?.length > 0) setContentInfo(lastData.contents[0]);
                      return; // 跳过下面的 switchToNextTask
                    }
                  }
                } catch { /* fall through to switchToNextTask */ }
              }
              
              // 最后一个任务不在终态或加载失败，走正常切换逻辑
              const summary = task.resultSummary ? JSON.parse(task.resultSummary) : null;
              const content = data.contents?.[0] || null;
              switchToNextTask(activeTaskId, summary, content);
              const idx = allTasks!.findIndex(t => t.taskId === activeTaskId);
              if (idx >= allTasks!.length - 1) {
                isTerminalRef.current = true;
              }
            } else {
              setCurrentStep(task.status === "completed" ? "任务完成" : "任务结束");
              isTerminalRef.current = true;
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
        // ★ 忽略 completed_summary（它只是附加数据，不应覆盖真实的 completed/failed 状态）
        if (event.payload.status === "completed_summary" || event.payload.status === "batch_complete") {
          // 从 completed_summary 中提取数据
          if (event.payload.status === "completed_summary" && event.payload.resultSummary) {
            setTaskSummary(event.payload.resultSummary);
            if (event.payload.resultSummary.contentInfo) {
              setContentInfo(event.payload.resultSummary.contentInfo);
            }
          }
          break;
        }
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
      // ★ AI 请求用户协同
      case "help_needed" as any:
        setHelpNeeded({ reason: event.payload.reason || '', category: event.payload.category || 'other' });
        break;
      // ★ 接管状态变化（用户接管/归还）
      case "takeover_status" as any:
        if (!event.payload.active) {
          setHelpNeeded(null); // 归还后清除求助状态
        }
        break;
    }
  }, [activeTaskId, addStep, loadCompletionData]);

  // 连接 Socket.io — ★ 当 activeTaskId 变化时重新连接
  // ★ 等初始加载完成，如果任务已终态则跳过连接
  useEffect(() => {
    if (!activeTaskId) return;
    if (!initialLoaded) return; // 等初始加载完成再决定是否连接
    if (isTerminalRef.current) return; // 任务已结束，不需要 socket

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
  }, [activeTaskId, initialLoaded, handleSandboxEvent]);

  // 轮询任务状态（socket 备份）
  useEffect(() => {
    if (!initialLoaded) return; // 等初始加载完成
    if (isTerminalRef.current) return; // ★ 任务已结束，不需要轮询

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
        if (!res.ok) {
          // ★ 任务不存在（已清理/404）→ 停止轮询
          if (res.status === 404) { clearInterval(interval); isTerminalRef.current = true; }
          return;
        }
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
      } catch {}
    }, 5000);

    return () => clearInterval(interval);
  }, [activeTaskId, status, initialLoaded, isMultiTask, allTasks, switchToNextTask]);

  // ★ 多账号进度指示器
  const multiTaskHeader = isMultiTask ? (
    <div className="flex items-center gap-2 mb-2 px-1">
      <span className="text-xs text-muted-foreground">批量执行：</span>
      <div className="flex items-center gap-1">
        {allTasks!.map((t, idx) => {
          const isCompleted = completedTasks.some(ct => ct.taskId === t.taskId)
            || (t.taskId === activeTaskId && ['completed', 'failed', 'cancelled'].includes(status));
          const isActive = t.taskId === activeTaskId && !isCompleted;
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
        helpNeeded={helpNeeded}
        socket={socketRef.current}
        onDismissHelp={() => setHelpNeeded(null)}
      />
    </div>
  );
}
