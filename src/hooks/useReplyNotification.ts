/**
 * useReplyNotification — AI 回复完成时通知用户
 *
 * 功能：
 *   1. 标签页标题闪烁（用户切到别的标签页时）
 *   2. 浏览器桌面通知（需要用户授权）
 *   3. 深度研究模式完成时额外强调
 *
 * 用法：
 *   useReplyNotification({ isStreaming, isResearchMode });
 *
 * 触发条件：
 *   - isStreaming 从 true → false（回复完成）
 *   - 且页面不可见（document.hidden === true）
 */

import { useEffect, useRef, useCallback } from 'react';

interface UseReplyNotificationOptions {
  /** 是否正在流式传输 */
  isStreaming: boolean;
  /** 是否是深度研究模式 */
  isResearchMode?: boolean;
}

// ═══ 标签页标题闪烁 ═══

const ORIGINAL_TITLE = typeof document !== 'undefined' ? document.title : '';
let flashTimer: ReturnType<typeof setInterval> | null = null;

function startTitleFlash(message: string) {
  stopTitleFlash(); // 先清理旧的
  let show = true;
  flashTimer = setInterval(() => {
    document.title = show ? `💬 ${message}` : ORIGINAL_TITLE;
    show = !show;
  }, 1000);
}

function stopTitleFlash() {
  if (flashTimer) {
    clearInterval(flashTimer);
    flashTimer = null;
  }
  if (typeof document !== 'undefined') {
    document.title = ORIGINAL_TITLE;
  }
}

// ═══ 浏览器桌面通知 ═══

function requestNotificationPermission() {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission === 'default') {
    Notification.requestPermission().catch(() => {});
  }
}

function showBrowserNotification(title: string, body: string) {
  if (typeof Notification === 'undefined') return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, {
      body,
      icon: '/favicon.ico',
      tag: 'ai-reply', // 同 tag 的通知会合并，不会弹一堆
      silent: false,
    });
    // 点击通知 → 聚焦到页面
    n.onclick = () => {
      window.focus();
      n.close();
    };
    // 10 秒后自动关闭
    setTimeout(() => n.close(), 10000);
  } catch (e) {
    // Safari 等可能不支持
    console.warn('[ReplyNotify] Browser notification failed:', e);
  }
}

// ═══ Hook ═══

export function useReplyNotification(options: UseReplyNotificationOptions) {
  const { isStreaming, isResearchMode = false } = options;
  const wasStreamingRef = useRef(false);
  const isResearchRef = useRef(false);
  isResearchRef.current = isResearchMode;

  // 首次渲染时尝试请求通知权限（静默请求，不打扰用户）
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // 页面重新可见时停止标题闪烁
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        stopTitleFlash();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopTitleFlash();
    };
  }, []);

  // 监听 isStreaming 从 true → false
  useEffect(() => {
    if (isStreaming) {
      wasStreamingRef.current = true;
      return;
    }

    // isStreaming === false
    if (!wasStreamingRef.current) return; // 不是从 streaming 状态结束的
    wasStreamingRef.current = false;

    // ★ 只在页面不可见时通知
    if (!document.hidden) return;

    const isResearch = isResearchRef.current;
    const title = isResearch ? '深度研究完成' : '回复已完成';
    const body = isResearch
      ? '您的深度研究任务已完成，点击查看结果。'
      : 'AI 已回复，点击查看。';

    // 标签页标题闪烁
    startTitleFlash(title);

    // 浏览器桌面通知
    showBrowserNotification(title, body);

  }, [isStreaming]);
}
