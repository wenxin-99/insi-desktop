/**
 * useSSEReconnect — SSE 自动重连 Hook
 * 
 * 替代 Chat.tsx 中裸用 EventSource 的逻辑。
 * 特性：
 *   - 连接断开后自动重连（指数退避）
 *   - 最大重试次数限制
 *   - 网络恢复时立即重连
 *   - 组件卸载时自动清理
 * 
 * 用法：
 * ```tsx
 * const { status, lastEvent } = useSSEReconnect('/api/notifications/stream', {
 *   onMessage: (event) => { ... },
 *   onError: (error) => { ... },
 *   enabled: !!currentUser,
 * });
 * ```
 */
import { useEffect, useRef, useState, useCallback } from 'react';

export type SSEStatus = 'connecting' | 'connected' | 'disconnected' | 'error' | 'max_retries';

interface UseSSEReconnectOptions {
  /** 消息回调 */
  onMessage?: (event: MessageEvent) => void;
  /** 错误回调 */
  onError?: (error: Event) => void;
  /** 连接打开回调 */
  onOpen?: () => void;
  /** 状态变化回调 */
  onStatusChange?: (status: SSEStatus) => void;
  /** 是否启用（默认 true） */
  enabled?: boolean;
  /** 最大重试次数（默认 10） */
  maxRetries?: number;
  /** 初始重试延迟 ms（默认 1000） */
  initialDelay?: number;
  /** 最大重试延迟 ms（默认 30000） */
  maxDelay?: number;
}

export function useSSEReconnect(url: string, options: UseSSEReconnectOptions = {}) {
  const {
    onMessage,
    onError,
    onOpen,
    onStatusChange,
    enabled = true,
    maxRetries = 10,
    initialDelay = 1000,
    maxDelay = 30000,
  } = options;

  const [status, setStatus] = useState<SSEStatus>('disconnected');
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mountedRef = useRef(true);

  // 用 ref 存最新回调，避免 effect 频繁重建
  const callbacksRef = useRef({ onMessage, onError, onOpen, onStatusChange });
  callbacksRef.current = { onMessage, onError, onOpen, onStatusChange };

  const updateStatus = useCallback((newStatus: SSEStatus) => {
    if (!mountedRef.current) return;
    setStatus(newStatus);
    callbacksRef.current.onStatusChange?.(newStatus);
  }, []);

  const connect = useCallback(() => {
    // 清理旧连接
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (!mountedRef.current || !enabled) return;

    updateStatus('connecting');

    // 构建认证信息
    const token = localStorage.getItem('auth_token');
    // EventSource 不支持自定义 Header，通过 query param 传递 token
    const esUrl = token ? `${url}${url.includes('?') ? '&' : '?'}token=${encodeURIComponent(token)}` : url;

    // ★ 直接建立 EventSource（不做 HEAD 预检 — Cloudflare + SSE 端点会导致 HEAD 524 超时）
    const es = new EventSource(esUrl, { withCredentials: true });
    eventSourceRef.current = es;
    const connectTime = Date.now();

    es.onopen = () => {
      if (!mountedRef.current) return;
      retryCountRef.current = 0;
      updateStatus('connected');
      callbacksRef.current.onOpen?.();
    };

    es.onmessage = (event) => {
      if (!mountedRef.current) return;
      callbacksRef.current.onMessage?.(event);
    };

    es.onerror = () => {
      if (!mountedRef.current) return;
      callbacksRef.current.onError?.(new Event('error'));

      // ★ 如果连接在 2s 内就失败，很可能是 401 认证失败，避免无限快速重连
      const elapsed = Date.now() - connectTime;
      if (elapsed < 2000 && retryCountRef.current >= 3) {
        console.warn('[SSE] Rapid failures detected (likely auth issue), stopping reconnect');
        es.close();
        eventSourceRef.current = null;
        updateStatus('error');
        return;
      }

      if (retryCountRef.current === 0) {
        console.warn('[SSE] Connection lost, will reconnect with backoff');
      }
      if (es.readyState === EventSource.CLOSED) {
        es.close();
        eventSourceRef.current = null;
        scheduleReconnect();
      }
    };
  }, [url, enabled, maxRetries, updateStatus]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || !enabled) return;

    retryCountRef.current++;

    if (retryCountRef.current > maxRetries) {
      updateStatus('max_retries');
      console.error(`[SSE] Max retries (${maxRetries}) exceeded`);
      return;
    }

    // 指数退避 + 随机抖动
    const baseDelay = Math.min(initialDelay * Math.pow(2, retryCountRef.current - 1), maxDelay);
    const jitter = baseDelay * 0.2 * Math.random();
    const delay = Math.round(baseDelay + jitter);

    updateStatus('disconnected');

    retryTimerRef.current = setTimeout(() => {
      if (mountedRef.current) connect();
    }, delay);
  }, [enabled, maxRetries, initialDelay, maxDelay, connect, updateStatus]);

  // 手动重连
  const reconnect = useCallback(() => {
    retryCountRef.current = 0;
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    connect();
  }, [connect]);

  // 网络恢复时自动重连
  useEffect(() => {
    const handleOnline = () => {
      reconnect();
    };

    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [reconnect]);

  // 启动/清理
  useEffect(() => {
    mountedRef.current = true;

    if (enabled) {
      connect();
    }

    return () => {
      mountedRef.current = false;
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
    };
  }, [url, enabled, connect]);

  return { status, reconnect };
}
