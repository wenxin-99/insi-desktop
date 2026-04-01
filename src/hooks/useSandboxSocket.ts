/**
 * useSandboxSocket - Socket.io React Hook
 * 
 * 管理与后端 Socket.io 的连接，接收沙箱事件并维护状态。
 * 为沙箱面板的三个 Tab（浏览器、终端、思考过程）提供实时数据。
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { researchTaskRegistry } from "@/lib/researchTaskRegistry";

// ============ 类型定义 ============

export type SandboxEventType =
  | "browser_navigate"
  | "browser_screenshot"
  | "browser_loading"
  | "code_update"
  | "terminal_output"
  | "terminal_command"
  | "agent_thinking"
  | "agent_searching"
  | "agent_step"
  | "task_status"
  | "task_progress"
  | "desktop_screenshot"
  | "desktop_step"
  | "desktop_status";

export interface SandboxEvent {
  type: SandboxEventType;
  taskId: number;
  timestamp: number;
  payload: Record<string, any>;
}

export interface BrowserState {
  url: string;
  title: string;
  screenshot: string; // base64 JPEG
  isLoading: boolean;
  history: Array<{ url: string; title: string; timestamp: number }>;
}

export interface CodeState {
  code: string;
  language: string;
  filename: string;
  history: Array<{ code: string; language: string; filename: string; timestamp: number }>;
}

export interface TerminalState {
  lines: TerminalLine[];
}

export interface TerminalLine {
  content: string;
  timestamp: number;
  type: "command" | "output";
}

export interface AgentStepEvent {
  timestamp: number;
  payload: {
    stepType: string;
    content: string;
    stepNumber: number;
  };
}

export interface SandboxState {
  browser: BrowserState;
  code: CodeState;
  terminal: TerminalLine[];
  isConnected: boolean;
  activeTab: "browser" | "code" | "terminal";
  taskStatus: string;
  taskProgress: number;
  thinking: string;
  steps: AgentStepEvent[];
  currentStep: string;
  progress: number;
}

// ============ Hook ============

export interface TaskCompletedData {
  taskId: number;
  resultSummary: {
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
    };
    completedAt: string;
  };
  taskName: string;
}

let _onTaskCompletedCallback: ((data: TaskCompletedData) => void) | null = null;

export function setOnTaskCompletedCallback(cb: ((data: TaskCompletedData) => void) | null) {
  _onTaskCompletedCallback = cb;
}

// 多账号顺序执行时，前一个任务完成后通知前端切换到下一个任务
let _onNextTaskCallback: ((data: { nextTaskId: number; nextUsername: string; nextTaskName: string; currentIndex: number; totalTasks: number }) => void) | null = null;

export function setOnNextTaskCallback(cb: typeof _onNextTaskCallback) {
  _onNextTaskCallback = cb;
}

// ★ 多账号批次全部完成后的汇总回调
let _onBatchCompleteCallback: ((data: { totalTasks: number; successCount: number; failCount: number; batchResults: Array<{ taskId: number; username: string; success: boolean; error?: string }> }) => void) | null = null;

export function setOnBatchCompleteCallback(cb: typeof _onBatchCompleteCallback) {
  _onBatchCompleteCallback = cb;
}

export function useSandboxSocket(taskId: number | null) {
  const socketRef = useRef<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);

  const [browser, setBrowser] = useState<BrowserState>({
    url: "",
    title: "",
    screenshot: "",
    isLoading: false,
    history: [],
  });

  const [code, setCode] = useState<CodeState>({
    code: "// 等待 Insi 执行...\n// 搜索结果和报告将在此显示",
    language: "markdown",
    filename: "output",
    history: [],
  });

  // terminal 直接作为 TerminalLine[] 数组，方便 Automation.tsx 使用 .length 和 .map()
  const [terminalLines, setTerminal] = useState<TerminalLine[]>([
    {
      content: "\x1b[32m$ \x1b[0m自动化沙箱终端已就绪\r\n",
      timestamp: Date.now(),
      type: "output",
    },
  ]);
  const terminal: TerminalState = { lines: terminalLines };
  
  // 终端输出批量更新：缓冲高频消息，用 requestAnimationFrame 批量写入 state
  const MAX_TERMINAL_LINES = 500;
  const terminalBatchRef = useRef<TerminalLine[]>([]);
  const terminalRafRef = useRef<number | null>(null);
  
  const flushTerminalBatch = useCallback(() => {
    terminalRafRef.current = null;
    const batch = terminalBatchRef.current;
    if (batch.length === 0) return;
    terminalBatchRef.current = [];
    
    setTerminal((prev) => {
      const merged = [...prev, ...batch];
      // 超过上限时只保留最新的行
      if (merged.length > MAX_TERMINAL_LINES) {
        return merged.slice(-MAX_TERMINAL_LINES);
      }
      return merged;
    });
  }, []);
  
  const pushTerminalLine = useCallback((line: TerminalLine) => {
    terminalBatchRef.current.push(line);
    // 使用 rAF 合并同一帧内的多次推送
    if (terminalRafRef.current === null) {
      terminalRafRef.current = requestAnimationFrame(flushTerminalBatch);
    }
  }, [flushTerminalBatch]);

  const [activeTab, setActiveTab] = useState<"browser" | "code" | "terminal">("browser");
  const [taskStatus, setTaskStatus] = useState("");
  const [taskProgress, setTaskProgress] = useState(0);
  
  // Agent 思考过程和步骤
  const [thinking, setThinking] = useState("");
  const [steps, setSteps] = useState<AgentStepEvent[]>([]);
  const [currentStep, setCurrentStep] = useState("");
  const [progress, setProgress] = useState(0);

  // 点击指示器（浏览器预览上的点击动画）
  const [clickIndicator, setClickIndicator] = useState<{ x: number; y: number; description: string; key: number } | null>(null);
  // ★ P1④：AI 光标位置 + 操作预告
  const [cursorPosition, setCursorPosition] = useState<{ x: number; y: number } | null>(null);
  const [agentActionPreview, setAgentActionPreview] = useState<{ action: string; description: string } | null>(null);
  // 截图超时提示
  const [screenshotTimeout, setScreenshotTimeout] = useState(false);
  // ★ 关键操作确认
  const [pendingConfirmation, setPendingConfirmation] = useState<{
    action: string; description: string; screenshot: string; timeoutMs: number; timestamp: number;
  } | null>(null);

  // 处理沙箱事件
  const loadingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const handleSandboxEvent = useCallback((event: SandboxEvent) => {
    switch (event.type) {
      case "browser_navigate":
        setBrowser((prev) => ({
          ...prev,
          url: event.payload.url,
          isLoading: true,
        }));
        setActiveTab("browser");
        // 30秒后自动清除 loading 状态，防止因断连导致永远 loading
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
          setBrowser((prev) => prev.isLoading ? { ...prev, isLoading: false } : prev);
        }, 30000);
        break;

      case "browser_loading":
        setBrowser((prev) => ({
          ...prev,
          url: event.payload.url,
          isLoading: true,
        }));
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
          setBrowser((prev) => prev.isLoading ? { ...prev, isLoading: false } : prev);
        }, 30000);
        break;

      case "browser_screenshot":
        if (loadingTimeoutRef.current) { clearTimeout(loadingTimeoutRef.current); loadingTimeoutRef.current = null; }
        setBrowser((prev) => ({
          ...prev,
          screenshot: event.payload.screenshot,
          url: event.payload.url,
          title: event.payload.title || "",
          isLoading: false,
          history: [
            ...prev.history,
            {
              url: event.payload.url,
              title: event.payload.title || "",
              timestamp: event.timestamp,
            },
          ],
        }));
        setActiveTab("browser");
        break;

      case "code_update":
        setCode((prev) => ({
          code: event.payload.code,
          language: event.payload.language,
          filename: event.payload.filename || "output",
          history: [
            ...prev.history,
            {
              code: event.payload.code,
              language: event.payload.language,
              filename: event.payload.filename || "output",
              timestamp: event.timestamp,
            },
          ],
        }));
        if (event.payload.filename === "research_report.md") {
          setActiveTab("code");
        }
        break;

      case "terminal_command":
        pushTerminalLine({
          content: `\x1b[36m$ ${event.payload.command}\x1b[0m\r\n`,
          timestamp: event.timestamp,
          type: "command" as const,
        });
        setActiveTab("terminal");
        break;

      case "terminal_output":
        pushTerminalLine({
          content: event.payload.output,
          timestamp: event.timestamp,
          type: "output" as const,
        });
        // SSH 输出时切到 terminal tab（含 SSH 连接成功信息）
        if (event.payload.output?.includes('SSH 已连接') || event.payload.output?.includes('ssh root@')) {
          setActiveTab("terminal");
        }
        break;

      case "agent_thinking":
        setThinking(event.payload.thought || "");
        break;

      case "agent_searching":
        setActiveTab("browser");
        break;

      case "agent_step":
        // 记录 Agent 步骤
        setSteps((prev) => [
          ...prev,
          {
            timestamp: event.timestamp,
            payload: {
              stepType: event.payload.stepType || "step",
              content: event.payload.content || "",
              stepNumber: event.payload.stepNumber || 0,
            },
          },
        ]);
        // 清除当前思考状态（步骤完成了）
        setThinking("");
        break;

      case "task_status":
        if (event.payload.status === "completed_summary") {
          // 任务完成总结事件 - 触发回调向聊天流追加运营总结
          if (_onTaskCompletedCallback) {
            _onTaskCompletedCallback({
              taskId: event.taskId,
              resultSummary: event.payload.resultSummary,
              taskName: event.payload.taskName || '',
            });
          }
          // 不更新 taskStatus，避免覆盖正常的 completed 状态
          break;
        }
        if (event.payload.status === "batch_complete") {
          // ★ 多账号批次全部完成 — 触发批量汇总回调
          if (_onBatchCompleteCallback) {
            _onBatchCompleteCallback(event.payload);
          }
          break;
        }
        setTaskStatus(event.payload.status);
        // 任务结束时清除 loading 状态 + 研究任务追踪
        if (event.payload.status === "completed" || event.payload.status === "failed") {
          setBrowser((prev) => prev.isLoading ? { ...prev, isLoading: false } : prev);
          if (loadingTimeoutRef.current) { clearTimeout(loadingTimeoutRef.current); loadingTimeoutRef.current = null; }
          // 清除研究任务追踪徽章
          researchTaskRegistry.completeByTaskId(event.taskId);
        }
        break;

      case "task_progress":
        setTaskProgress(event.payload.progress);
        setProgress(event.payload.progress);
        if (event.payload.currentStep) {
          setCurrentStep(event.payload.currentStep);
        }
        break;

      case "next_task" as any:
        // 多账号顺序执行：前一个任务完成，通知前端切换到下一个任务
        if (_onNextTaskCallback && event.payload.nextTaskId) {
          console.log(`[SandboxSocket] Switching to next task: ${event.payload.nextTaskId} (${event.payload.nextUsername})`);
          _onNextTaskCallback(event.payload);
        }
        break;

      case "browser_click_indicator" as any:
        // 显示点击动画（用 key 确保每次都触发新动画）
        setClickIndicator({
          x: event.payload.x,
          y: event.payload.y,
          description: event.payload.description || "",
          key: Date.now(),
        });
        // 800ms 后自动隐藏
        setTimeout(() => setClickIndicator(null), 800);
        break;

      case "screenshot_status" as any:
        if (event.payload.status === "timeout") {
          setScreenshotTimeout(true);
          // 30 秒后自动清除提示（截图可能恢复）
          setTimeout(() => setScreenshotTimeout(false), 30000);
        } else if (event.payload.status === "recovered") {
          setScreenshotTimeout(false);
        }
        break;

      case "cursor_move" as any:
        setCursorPosition({ x: event.payload.x, y: event.payload.y });
        setTimeout(() => setCursorPosition(prev =>
          prev?.x === event.payload.x && prev?.y === event.payload.y ? null : prev
        ), 3000);
        break;

      case "agent_action_preview" as any:
        setAgentActionPreview({ action: event.payload.action, description: event.payload.description });
        setTimeout(() => setAgentActionPreview(null), 3000);
        break;

      case "confirmation_required" as any:
        setPendingConfirmation({
          action: event.payload.action || "",
          description: event.payload.description || "",
          screenshot: event.payload.screenshot || "",
          timeoutMs: event.payload.timeoutMs || 60000,
          timestamp: Date.now(),
        });
        break;
    }
  }, []);

  // 连接 Socket.io
  // taskId 变化时重置状态（切换到新任务时清空旧状态）
  useEffect(() => {
    if (!taskId) return;
    // 重置所有状态到初始值
    setBrowser({ url: "about:blank", title: "", screenshot: "", isLoading: false, history: [] });
    setCode({ code: "// 等待 Insi 执行...\n// 搜索结果和报告将在此显示", language: "markdown", filename: "output", history: [] });
    setTerminal([{ content: "\x1b[32m$ \x1b[0m自动化沙箱终端已就绪\r\n", timestamp: Date.now(), type: "output" }]);
    setActiveTab("browser");
    setTaskStatus("pending");
    setTaskProgress(0);
    setThinking("");
    setSteps([]);
    setCurrentStep("");
    setProgress(0);
  }, [taskId]);

  useEffect(() => {
    if (!taskId) return;

    // 连接到后端 Socket.io（需要带 cookie 认证）
    const authToken = localStorage.getItem('auth_token') || '';
    const socket = io({
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,   // ★ 必须：让浏览器发送 cookie
      auth: authToken ? { token: authToken } : undefined,  // ★ token 认证备选
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setIsConnected(true);
      // 加入任务房间
      socket.emit("join_task", taskId);
    });

    socket.on("disconnect", (reason) => {
      setIsConnected(false);
    });

    socket.on("sandbox_event", (event: SandboxEvent) => {
      handleSandboxEvent(event);
    });

    socket.on("connect_error", (error) => {
      console.warn("[SandboxSocket] Connection error:", error.message);
    });

    return () => {
      if (socket) {
        socket.emit("leave_task", taskId);
        socket.disconnect();
      }
      socketRef.current = null;
      // 清理终端批量更新定时器
      if (terminalRafRef.current !== null) {
        cancelAnimationFrame(terminalRafRef.current);
        terminalRafRef.current = null;
      }
      // 清理 loading 超时定时器
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = null;
      }
    };
  }, [taskId, handleSandboxEvent]);

  return {
    browser,
    code,
    terminal,
    isConnected,
    activeTab,
    setActiveTab,
    taskStatus,
    taskProgress,
    // 新增：Agent 思考过程和步骤
    thinking,
    steps,
    currentStep,
    progress,
    socket: socketRef.current,
    // 新增：点击指示器 + 截图超时状态
    clickIndicator,
    screenshotTimeout,
    // ★ 关键操作确认
    pendingConfirmation,
    setPendingConfirmation,
    // ★ P1④：AI 光标 + 操作预告
    cursorPosition,
    agentActionPreview,
  };
}
