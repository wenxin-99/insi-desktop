/**
 * useNotificationSettings — 通知偏好设置
 *
 * localStorage 持久化 + 跨组件同步（同页面 + 跨 tab）。
 * NotificationContext 读取此设置决定是否弹 toast / 计入未读。
 */
import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'notification_settings';

export interface NotificationSettings {
  /** 总开关：关闭后所有弹窗通知静默（SSE 仍保持连接） */
  enabled: boolean;
  /** 任务完成通知：深度研究完成、视频生成完成/失败 */
  taskNotify: boolean;
  /** 账户通知：余额不足、交易记录 */
  accountNotify: boolean;
  /** 系统通知：系统消息、反馈回复、一般信息 */
  systemNotify: boolean;
}

const DEFAULTS: NotificationSettings = {
  enabled: true,
  taskNotify: true,
  accountNotify: true,
  systemNotify: true,
};

/** 通知类型 → 设置项映射 */
const TYPE_TO_CATEGORY: Record<string, keyof NotificationSettings> = {
  research_complete: 'taskNotify',
  video_generation_success: 'taskNotify',
  video_generation_failed: 'taskNotify',
  low_balance: 'accountNotify',
  transaction: 'accountNotify',
  system: 'systemNotify',
  info: 'systemNotify',
  feedback_received: 'systemNotify',
};

function readSettings(): NotificationSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

const SYNC_EVENT = 'notification-settings-changed';

function broadcastChange() {
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/**
 * 判断某个通知类型是否应该展示给用户
 */
export function shouldShowNotification(type: string, settings?: NotificationSettings): boolean {
  const s = settings || readSettings();
  if (!s.enabled) return false;
  const category = TYPE_TO_CATEGORY[type];
  if (!category) return true; // 未知类型默认展示
  return s[category] as boolean;
}

/**
 * 直接读取当前设置（非 Hook，供 NotificationContext 内部调用）
 */
export function getNotificationSettings(): NotificationSettings {
  return readSettings();
}

/**
 * 通知设置 Hook
 */
export function useNotificationSettings() {
  const [settings, setSettingsState] = useState<NotificationSettings>(readSettings);

  useEffect(() => {
    const handleSync = () => setSettingsState(readSettings());
    window.addEventListener(SYNC_EVENT, handleSync);
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) handleSync();
    };
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(SYNC_EVENT, handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<NotificationSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      broadcastChange();
      return next;
    });
  }, []);

  return { notificationSettings: settings, updateNotificationSettings: updateSettings };
}
