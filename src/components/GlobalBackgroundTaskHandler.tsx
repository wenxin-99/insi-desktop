/**
 * GlobalBackgroundTaskHandler — 全局后台任务管理
 *
 * 放置在 App.tsx 顶层，职责：
 * 1. 监听后台任务完成（无论用户在哪个页面）
 * 2. 触发余额刷新、标题生成、对话列表刷新
 * 3. 显示浮动任务指示器（非 Chat 页面时可见）
 */
import { useEffect, useCallback, useSyncExternalStore } from 'react';
import { useLocation } from 'wouter';
import { streamManager, TaskCompletionInfo } from '@/lib/backgroundStreamManager';
import { Loader2, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/** 全局后台任务处理 + 浮动指示器 */
export function GlobalBackgroundTaskHandler() {
  const [location, setLocation] = useLocation();
  const isOnChatPage = location === '/chat';

  // 订阅运行中的任务数
  const subscribe = useCallback((cb: () => void) => streamManager.onStatusChange(cb), []);
  const getSnapshot = useCallback(() => {
    const running = streamManager.getRunningTasks();
    return running.length;
  }, []);
  const runningCount = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // 全局完成回调：处理"孤儿任务"（用户已离开 Chat 页面或切换了对话）
  useEffect(() => {
    const unsub = streamManager.onGlobalComplete((info: TaskCompletionInfo) => {
      console.log('[GlobalHandler] Background task completed:', info.conversationId, info.status);

      if (info.status === 'error') {
        toast.error(`后台对话出错: ${info.errorMessage || '未知错误'}`);
      }

      // 触发余额刷新（通过自定义事件，让 Chat.tsx 或 DashboardLayout 等监听）
      window.dispatchEvent(new CustomEvent('bg-task-complete', {
        detail: {
          conversationId: info.conversationId,
          status: info.status,
          fullContent: info.fullContent,
          userMessageText: info.userMessageText,
        }
      }));
    });

    return unsub;
  }, []);

  // 不在 Chat 页面 + 有运行中任务 → 显示浮动指示器
  if (isOnChatPage || runningCount === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button
        onClick={() => setLocation('/chat')}
        className={cn(
          "flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg",
          "bg-blue-600 hover:bg-blue-700 text-white",
          "transition-all hover:scale-105 active:scale-95",
          "border border-blue-500/50"
        )}
        title="点击返回对话页面"
      >
        <div className="relative">
          <MessageSquare className="h-4 w-4" />
          <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-400 rounded-full animate-pulse" />
        </div>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-sm font-medium">
          {runningCount} 个对话生成中
        </span>
      </button>
    </div>
  );
}
