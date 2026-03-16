/**
 * useNetworkStatus — 网络状态检测 Hook
 * 
 * 监听 navigator.onLine 事件，提供网络状态。
 * 
 * 用法：
 * ```tsx
 * const { isOnline, wasOffline } = useNetworkStatus();
 * ```
 */
import { useState, useEffect, useRef } from 'react';

export interface NetworkStatus {
  /** 当前是否在线 */
  isOnline: boolean;
  /** 是否刚从离线恢复（用于显示"已恢复"提示） */
  wasOffline: boolean;
  /** 离线持续时间（ms） */
  offlineDuration: number;
}

export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [offlineDuration, setOfflineDuration] = useState(0);
  const offlineSinceRef = useRef<number | null>(null);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      if (offlineSinceRef.current) {
        setOfflineDuration(Date.now() - offlineSinceRef.current);
        offlineSinceRef.current = null;
      }
      setWasOffline(true);
      // 3 秒后清除"已恢复"状态
      setTimeout(() => setWasOffline(false), 3000);
    };

    const handleOffline = () => {
      setIsOnline(false);
      offlineSinceRef.current = Date.now();
      setWasOffline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return { isOnline, wasOffline, offlineDuration };
}
