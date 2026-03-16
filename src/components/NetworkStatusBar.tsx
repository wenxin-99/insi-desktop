/**
 * NetworkStatusBar — 网络状态提示栏
 * 
 * 功能：
 * - 离线时顶部显示红色警告条
 * - 恢复在线时显示绿色"已恢复"提示
 * - 自动消失
 * 
 * 替换 Chat.tsx 中原有的简单 NetworkStatusBar。
 */
import { memo } from 'react';
import { Wifi, WifiOff } from 'lucide-react';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

export const NetworkStatusBar = memo(function NetworkStatusBar() {
  const { isOnline, wasOffline } = useNetworkStatus();

  // 在线且非刚恢复 → 不显示
  if (isOnline && !wasOffline) return null;

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-[9999] px-4 py-2 text-center text-sm font-medium transition-all duration-300 ${
        isOnline
          ? 'bg-green-500 text-white animate-slide-down'
          : 'bg-red-500 text-white'
      }`}
    >
      <div className="flex items-center justify-center gap-2">
        {isOnline ? (
          <>
            <Wifi className="h-4 w-4" />
            <span>网络已恢复</span>
          </>
        ) : (
          <>
            <WifiOff className="h-4 w-4" />
            <span>网络连接已断开，部分功能可能不可用</span>
          </>
        )}
      </div>
    </div>
  );
});
