/**
 * useDesktopSocket — 桌面控制 Socket.IO React Hook
 *
 * 管理与后端 /desktop namespace 的连接状态，
 * 接收桌面截图流和操作状态更新。
 *
 * 注意：这个 hook 管理的是「前端浏览器 ↔ 服务端」的连接，
 * 用于接收桌面截图和状态，不是 Tauri 客户端的连接。
 * Tauri 客户端直接连接 /desktop namespace。
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { getApiBaseUrl } from "@/const";

// ═══════════════════════════════════════════
// 类型
// ═══════════════════════════════════════════

export interface DesktopConnectionInfo {
  platform: "windows" | "macos" | "linux";
  screenWidth: number;
  screenHeight: number;
  scale: number;
  osVersion?: string;
}

export interface DesktopScreenshotData {
  image: string;   // base64
  width: number;
  height: number;
  label?: string;
  timestamp: number;
}

export interface DesktopStep {
  tool: string;
  description: string;
  stepNumber: number;
  timestamp: number;
}

export interface DesktopState {
  /** Tauri 桌面客户端是否已连接到服务端 */
  isConnected: boolean;
  /** 用户是否已授权 AI 控制桌面 */
  isAuthorized: boolean;
  /** 连接信息 */
  connectionInfo: DesktopConnectionInfo | null;
  /** 最新截图 */
  latestScreenshot: DesktopScreenshotData | null;
  /** 截图历史（保留最近 20 张） */
  screenshotHistory: DesktopScreenshotData[];
  /** 当前是否正在执行操作 */
  isOperating: boolean;
  /** 当前活跃任务 ID */
  activeTaskId: string | null;
  /** 操作步骤历史 */
  steps: DesktopStep[];
  /** 当前步数 / 总步数 */
  progress: { current: number; total: number };
  /** 是否正在加载截图 */
  isLoadingScreenshot: boolean;
  /** P2: 执行计划 */
  plan: {
    active: boolean;
    steps: Array<{
      stepNumber: number;
      description: string;
      status: string;
      requiresConfirmation?: boolean;
      result?: string;
      error?: string;
    }>;
    current: number;
    total: number;
    percentage: number;
  };
  /** P2: 录制状态 */
  recording: {
    active: boolean;
    actionCount: number;
  };
  /** P2: 生成的 Playbook */
  generatedPlaybook: any | null;
}

const initialState: DesktopState = {
  isConnected: false,
  isAuthorized: false,
  connectionInfo: null,
  latestScreenshot: null,
  screenshotHistory: [],
  isOperating: false,
  activeTaskId: null,
  steps: [],
  progress: { current: 0, total: 100 },
  isLoadingScreenshot: false,
  plan: { active: false, steps: [], current: 0, total: 0, percentage: 0 },
  recording: { active: false, actionCount: 0 },
  generatedPlaybook: null,
};

const MAX_SCREENSHOT_HISTORY = 20;
const MAX_STEPS_HISTORY = 50;

// ═══════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════

export function useDesktopSocket() {
  const [state, setState] = useState<DesktopState>(initialState);
  const socketRef = useRef<Socket | null>(null);

  // ── 连接管理 ──
  useEffect(() => {
    // 连接到主 Socket.IO（不是 /desktop namespace）
    // 桌面状态通过 sandbox_event 推送
    const baseUrl = getApiBaseUrl() || window.location.origin;
    const token = localStorage.getItem("auth_token");
    const socket = io(baseUrl, {
      path: "/socket.io",
      transports: ["websocket", "polling"],
      withCredentials: true,
      ...(token ? { auth: { token } } : {}),
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[DesktopSocket] Connected to server");
    });

    socket.on("disconnect", () => {
      console.log("[DesktopSocket] Disconnected");
    });

    // 监听桌面状态变更事件
    socket.on("desktop_status", (data: {
      connected: boolean;
      authorized?: boolean;
      clientInfo?: DesktopConnectionInfo;
    }) => {
      setState(prev => ({
        ...prev,
        isConnected: data.connected,
        isAuthorized: data.authorized ?? prev.isAuthorized,
        connectionInfo: data.clientInfo || prev.connectionInfo,
      }));
    });

    // 监听 sandbox_event 中的桌面事件
    socket.on("sandbox_event", (event: {
      type: string;
      taskId: number;
      timestamp: number;
      payload: any;
    }) => {
      if (event.type === "desktop_screenshot") {
        const screenshotData: DesktopScreenshotData = {
          image: event.payload.screenshot,
          width: event.payload.width,
          height: event.payload.height,
          label: event.payload.label,
          timestamp: event.timestamp,
        };
        setState(prev => ({
          ...prev,
          latestScreenshot: screenshotData,
          screenshotHistory: [
            screenshotData,
            ...prev.screenshotHistory,
          ].slice(0, MAX_SCREENSHOT_HISTORY),
          isLoadingScreenshot: false,
        }));
      }
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  // ── 查询桌面连接状态 ──
  const checkDesktopStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/desktop/status", {
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        setState(prev => ({
          ...prev,
          isConnected: data.connected,
          isAuthorized: data.authorized || false,
          connectionInfo: data.clientInfo || null,
        }));
      }
    } catch (err) {
      console.warn("[DesktopSocket] Failed to check status:", err);
    }
  }, []);

  // 初始化时检查一次
  useEffect(() => {
    checkDesktopStatus();
    // 定期检查（30 秒）
    const interval = setInterval(checkDesktopStatus, 30_000);
    return () => clearInterval(interval);
  }, [checkDesktopStatus]);

  // ── 从 SSE 流中接收桌面事件 ──
  const handleSSEDesktopEvent = useCallback((eventData: {
    type: string;
    image?: string;
    width?: number;
    height?: number;
    [key: string]: any;
  }) => {
    if (eventData.type === "desktop_screenshot" && eventData.image) {
      const screenshotData: DesktopScreenshotData = {
        image: eventData.image,
        width: eventData.width || 0,
        height: eventData.height || 0,
        timestamp: Date.now(),
      };
      setState(prev => ({
        ...prev,
        latestScreenshot: screenshotData,
        screenshotHistory: [
          screenshotData,
          ...prev.screenshotHistory,
        ].slice(0, MAX_SCREENSHOT_HISTORY),
        isLoadingScreenshot: false,
        isOperating: true,
      }));
    }

    // P2: 计划进度
    if (eventData.type === "desktop_plan_progress") {
      setState(prev => ({
        ...prev,
        plan: {
          ...prev.plan,
          active: true,
          current: eventData.current || 0,
          total: eventData.total || 0,
          percentage: eventData.percentage || 0,
        },
      }));
    }

    // P2: Playbook 生成
    if (eventData.type === "desktop_playbook_generated") {
      setState(prev => ({
        ...prev,
        generatedPlaybook: eventData.playbook || null,
        recording: { ...prev.recording, active: false },
      }));
    }
  }, []);

  // ── 操作控制 ──
  const cancelOperations = useCallback(async () => {
    try {
      await fetch("/api/desktop/cancel", {
        method: "POST",
        credentials: "include",
      });
      setState(prev => ({ ...prev, isOperating: false }));
    } catch (err) {
      console.warn("[DesktopSocket] Cancel failed:", err);
    }
  }, []);

  // P2: 保存 Playbook 到数据库
  const savePlaybook = useCallback(async () => {
    const playbook = state.generatedPlaybook;
    if (!playbook) return;

    try {
      const res = await fetch("/api/desktop/playbook/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ playbook, name: playbook.name }),
      });
      const data = await res.json();
      if (data.success) {
        setState(prev => ({ ...prev, generatedPlaybook: null }));
      }
      return data;
    } catch (err) {
      console.warn("[DesktopSocket] Save playbook failed:", err);
    }
  }, [state.generatedPlaybook]);

  // P2: 回滚
  const rollbackToStep = useCallback(async (stepNumber: number) => {
    try {
      await fetch("/api/desktop/rollback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ stepNumber }),
      });
    } catch (err) {
      console.warn("[DesktopSocket] Rollback failed:", err);
    }
  }, []);

  // P2: 停止录制并保存
  const stopRecordingAndSave = useCallback(async () => {
    try {
      const res = await fetch("/api/desktop/recording/stop", {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.playbook) {
        setState(prev => ({
          ...prev,
          generatedPlaybook: data.playbook,
          recording: { active: false, actionCount: 0 },
        }));
      }
      return data;
    } catch (err) {
      console.warn("[DesktopSocket] Stop recording failed:", err);
    }
  }, []);

  // ── 授权控制 ──
  const authorizeDesktop = useCallback(async () => {
    try {
      const res = await fetch("/api/desktop/authorize", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setState(prev => ({ ...prev, isAuthorized: true }));
        }
        return data;
      }
    } catch (err) {
      console.warn("[DesktopSocket] Authorize failed:", err);
    }
  }, []);

  const revokeDesktopAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/desktop/revoke", {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setState(prev => ({ ...prev, isAuthorized: false }));
      }
    } catch (err) {
      console.warn("[DesktopSocket] Revoke failed:", err);
    }
  }, []);

  const resetState = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOperating: false,
      activeTaskId: null,
      steps: [],
      progress: { current: 0, total: 100 },
      plan: { active: false, steps: [], current: 0, total: 0, percentage: 0 },
      recording: { active: false, actionCount: 0 },
      generatedPlaybook: null,
    }));
  }, []);

  return {
    ...state,
    checkDesktopStatus,
    handleSSEDesktopEvent,
    cancelOperations,
    resetState,
    savePlaybook,
    rollbackToStep,
    stopRecordingAndSave,
    authorizeDesktop,
    revokeDesktopAuth,
  };
}
