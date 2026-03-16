/**
 * useAutoRetry — API 调用自动重试 Hook
 * 
 * 提供指数退避重试能力，适用于：
 * - 流式传输中断后重试
 * - API 请求失败重试
 * - 网络恢复后自动重试
 * 
 * 用法：
 * ```ts
 * const { execute, isRetrying, retryCount, cancel } = useAutoRetry({
 *   maxRetries: 3,
 *   initialDelay: 1000,
 *   onRetry: (attempt) => toast.info(`正在重试 (${attempt}/3)...`),
 * });
 * 
 * // 执行带重试的异步操作
 * const result = await execute(async () => {
 *   const res = await fetch('/api/chat/stream', { ... });
 *   if (!res.ok) throw new Error('请求失败');
 *   return res;
 * });
 * ```
 */
import { useState, useRef, useCallback } from 'react';

interface UseAutoRetryOptions {
  /** 最大重试次数（默认 3） */
  maxRetries?: number;
  /** 初始延迟 ms（默认 1000） */
  initialDelay?: number;
  /** 最大延迟 ms（默认 15000） */
  maxDelay?: number;
  /** 退避倍数（默认 2） */
  backoffMultiplier?: number;
  /** 是否应该重试的判断函数（默认所有错误都重试） */
  shouldRetry?: (error: Error, attempt: number) => boolean;
  /** 每次重试时的回调 */
  onRetry?: (attempt: number, error: Error, delay: number) => void;
  /** 所有重试耗尽时的回调 */
  onMaxRetriesReached?: (error: Error) => void;
}

interface RetryState {
  isRetrying: boolean;
  retryCount: number;
  lastError: Error | null;
}

export function useAutoRetry(options: UseAutoRetryOptions = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 15000,
    backoffMultiplier = 2,
    shouldRetry = () => true,
    onRetry,
    onMaxRetriesReached,
  } = options;

  const [state, setState] = useState<RetryState>({
    isRetrying: false,
    retryCount: 0,
    lastError: null,
  });

  const cancelledRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 计算当前重试延迟（指数退避 + 抖动） */
  const getDelay = useCallback((attempt: number): number => {
    const baseDelay = Math.min(
      initialDelay * Math.pow(backoffMultiplier, attempt - 1),
      maxDelay
    );
    // 添加 ±20% 随机抖动
    const jitter = baseDelay * 0.2 * (Math.random() * 2 - 1);
    return Math.round(Math.max(0, baseDelay + jitter));
  }, [initialDelay, backoffMultiplier, maxDelay]);

  /** 执行操作（带自动重试） */
  const execute = useCallback(async <T>(
    fn: () => Promise<T>,
  ): Promise<T> => {
    cancelledRef.current = false;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (cancelledRef.current) {
        throw new Error('Operation cancelled');
      }

      try {
        // 首次尝试
        if (attempt === 0) {
          setState({ isRetrying: false, retryCount: 0, lastError: null });
        }

        const result = await fn();

        // 成功：重置状态
        setState({ isRetrying: false, retryCount: 0, lastError: null });
        return result;
      } catch (error: any) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // 判断是否应该重试
        if (attempt >= maxRetries || !shouldRetry(lastError, attempt + 1)) {
          setState({ isRetrying: false, retryCount: attempt, lastError });
          
          if (attempt >= maxRetries) {
            onMaxRetriesReached?.(lastError);
          }
          
          throw lastError;
        }

        // 等待后重试
        const delay = getDelay(attempt + 1);
        
        setState({
          isRetrying: true,
          retryCount: attempt + 1,
          lastError,
        });

        onRetry?.(attempt + 1, lastError, delay);

        // 等待延迟
        await new Promise<void>((resolve) => {
          timeoutRef.current = setTimeout(resolve, delay);
        });
      }
    }

    // 不应到达这里
    throw lastError || new Error('Unknown retry error');
  }, [maxRetries, shouldRetry, getDelay, onRetry, onMaxRetriesReached]);

  /** 取消正在进行的重试 */
  const cancel = useCallback(() => {
    cancelledRef.current = true;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setState(prev => ({ ...prev, isRetrying: false }));
  }, []);

  /** 手动重置状态 */
  const reset = useCallback(() => {
    cancel();
    setState({ isRetrying: false, retryCount: 0, lastError: null });
  }, [cancel]);

  return {
    execute,
    cancel,
    reset,
    isRetrying: state.isRetrying,
    retryCount: state.retryCount,
    lastError: state.lastError,
  };
}

/**
 * 判断错误是否可重试的常用规则
 */
export const retryableErrors = {
  /** 网络错误和服务端 5xx */
  networkAndServer: (error: Error): boolean => {
    const msg = error.message.toLowerCase();
    if (msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')) return true;
    if (msg.includes('aborted') || msg.includes('cancelled')) return false;
    // 5xx 错误
    const statusMatch = msg.match(/\b(5\d{2})\b/);
    if (statusMatch) return true;
    // 429 Too Many Requests
    if (msg.includes('429') || msg.includes('rate limit')) return true;
    return false;
  },

  /** 只重试网络错误（不重试业务错误） */
  networkOnly: (error: Error): boolean => {
    const msg = error.message.toLowerCase();
    return msg.includes('network') || msg.includes('fetch') || msg.includes('timeout')
      || msg.includes('econnrefused') || msg.includes('econnreset');
  },
};
