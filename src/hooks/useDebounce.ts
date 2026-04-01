/**
 * src/hooks/useDebounce.ts — P2 新增
 *
 * 通用防抖 Hook 集合。
 *
 * useDebounce(value, delay)      — 对值防抖（搜索输入）
 * useDebouncedCallback(fn, delay) — 对回调防抖（事件处理）
 * useThrottledCallback(fn, delay) — 对回调节流（resize/scroll）
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

/**
 * 对值防抖 — 常用于搜索输入框
 *
 * const debouncedQuery = useDebounce(query, 300);
 * useEffect(() => { search(debouncedQuery); }, [debouncedQuery]);
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

/**
 * 对回调防抖 — 常用于事件处理
 *
 * const debouncedSearch = useDebouncedCallback((q: string) => { api.search(q); }, 300);
 * <input onChange={e => debouncedSearch(e.target.value)} />
 */
export function useDebouncedCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );
}

/**
 * 对回调节流 — 常用于 resize / scroll
 *
 * const throttledResize = useThrottledCallback(() => { recalcLayout(); }, 100);
 * useEffect(() => { window.addEventListener('resize', throttledResize); }, []);
 */
export function useThrottledCallback<T extends (...args: any[]) => any>(
  callback: T,
  delay: number,
): (...args: Parameters<T>) => void {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  const lastCallRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const elapsed = now - lastCallRef.current;

      if (elapsed >= delay) {
        lastCallRef.current = now;
        callbackRef.current(...args);
      } else {
        // 尾部触发：保证最后一次调用不丢失
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
          lastCallRef.current = Date.now();
          callbackRef.current(...args);
        }, delay - elapsed);
      }
    },
    [delay],
  );
}
