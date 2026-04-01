/**
 * NotificationContext — 全局通知系统
 *
 * ★ 修复：
 *   1. 使用 useSSEReconnect 自动重连（指数退避），替代裸 EventSource
 *   2. 过滤 type:"connected" 握手消息，不计入未读数
 *   3. 正确处理所有通知类型（包括 video_generation_* 等）
 */

import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { useSSEReconnect } from "@/hooks/useSSEReconnect";
import { shouldShowNotification, getNotificationSettings } from "@/hooks/useNotificationSettings";

interface Notification {
  type: string;
  title?: string;
  message?: string;
  data?: any;
  timestamp?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: () => void;
  clearNotifications: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

/** 不计入通知列表/未读数的消息类型 */
const IGNORED_TYPES = new Set(["connected", "thinking_step_update"]);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // ★ 使用 useSSEReconnect：自动指数退避重连 + 网络恢复时自动恢复
  useSSEReconnect("/api/notifications/stream", {
    enabled: isAuthenticated,
    maxRetries: 15,
    initialDelay: 2000,
    maxDelay: 60000,
    onOpen: () => {
      console.log("[Notifications] Connected to notification stream");
    },
    onMessage: (event) => {
      try {
        const notification: Notification = JSON.parse(event.data);

        // ★ 过滤握手消息和内部消息，不计入通知列表
        if (IGNORED_TYPES.has(notification.type)) {
          return;
        }

        // ★ 检查用户通知偏好：关闭的类型静默处理（不弹 toast，不计入未读）
        const settings = getNotificationSettings();
        if (!shouldShowNotification(notification.type, settings)) {
          return;
        }

        // 添加到通知列表
        setNotifications((prev) => [notification, ...prev].slice(0, 50));
        setUnreadCount((prev) => prev + 1);

        // 根据类型弹 toast
        const title = notification.title || "";
        const description = notification.message || "";

        switch (notification.type) {
          case "low_balance":
            toast.warning(title, { description });
            break;
          case "system":
            toast.info(title, { description });
            break;
          case "transaction":
            toast.success(title, { description });
            break;
          case "video_generation_success":
            toast.success(title || "视频生成完成", { description });
            break;
          case "video_generation_failed":
            toast.error(title || "视频生成失败", { description });
            break;
          case "feedback_received":
            toast.success(title || "反馈通知", { description });
            break;
          case "research_complete":
            toast.success(title || "研究完成", { description });
            break;
          case "info":
          default:
            if (title || description) {
              toast(title, { description });
            }
            break;
        }
      } catch (error) {
        console.error("[Notifications] Error parsing notification:", error);
      }
    },
    onError: () => {
      // useSSEReconnect 会自动处理重连，这里只做日志
      console.warn("[Notifications] SSE connection error, will auto-reconnect");
    },
  });

  const markAsRead = useCallback(() => {
    setUnreadCount(0);
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
  }, []);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        markAsRead,
        clearNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error("useNotifications must be used within a NotificationProvider");
  }
  return context;
}
