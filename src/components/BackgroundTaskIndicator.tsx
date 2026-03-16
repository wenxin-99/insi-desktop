import { useCallback } from 'react';
import { useSyncExternalStore } from 'react';
import { streamManager } from '@/lib/backgroundStreamManager';
import { researchTaskRegistry } from '@/lib/researchTaskRegistry';
import { Loader2, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useBackgroundTasks } from '@/hooks/useBackgroundStream';

/** 对话列表里的"生成中"/"研究中"小徽章 */
export function BackgroundTaskBadge({ conversationId, className }: { conversationId: number; className?: string }) {
  // 订阅 LLM 聊天流状态
  const subscribeStream = useCallback((cb: () => void) => streamManager.onStatusChange(cb), []);
  const getStreamSnapshot = useCallback(() => streamManager.isRunning(conversationId), [conversationId]);
  const isStreaming = useSyncExternalStore(subscribeStream, getStreamSnapshot, getStreamSnapshot);

  // 订阅研究代理任务状态
  const subscribeResearch = useCallback((cb: () => void) => researchTaskRegistry.onStatusChange(cb), []);
  const getResearchSnapshot = useCallback(() => researchTaskRegistry.isRunning(conversationId), [conversationId]);
  const isResearching = useSyncExternalStore(subscribeResearch, getResearchSnapshot, getResearchSnapshot);

  if (!isStreaming && !isResearching) return null;

  return (
    <span className={cn('flex items-center gap-1 flex-shrink-0', className)}>
      {isResearching ? (
        <>
          <Search className="h-3 w-3 text-purple-500 animate-pulse" />
          <span className="text-[10px] text-purple-500 font-medium whitespace-nowrap">研究中</span>
        </>
      ) : (
        <>
          <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
          <span className="text-[10px] text-blue-500 font-medium whitespace-nowrap">生成中</span>
        </>
      )}
    </span>
  );
}

/** 聊天区顶部"后台任务"提示条 */
export function BackgroundTasksBar({
  currentConversationId,
  onSwitchTo,
  conversations,
}: {
  currentConversationId: number | null;
  onSwitchTo: (id: number) => void;
  conversations?: Array<{ id: number; title: string }>;
}) {
  const { getRunningTasks } = useBackgroundTasks();
  const streamTasks = getRunningTasks().filter(t => t.conversationId !== currentConversationId);

  // 订阅研究任务数量变化（用标量值避免 useSyncExternalStore 引用比较导致的无限循环）
  const subscribeResearch = useCallback((cb: () => void) => researchTaskRegistry.onStatusChange(cb), []);
  const getResearchCount = useCallback(() => researchTaskRegistry.getRunningTasks().length, []);
  const researchCount = useSyncExternalStore(subscribeResearch, getResearchCount, getResearchCount);
  // 仅在数量 > 0 时才读取详情（避免每次渲染创建新数组）
  const researchTasks = researchCount > 0 ? researchTaskRegistry.getRunningTasks() : [];
  const bgResearchTasks = researchTasks.filter(t => t.conversationId !== currentConversationId);

  // 合并去重
  const allBgConvIds = new Set([
    ...streamTasks.map(t => t.conversationId),
    ...bgResearchTasks.map(t => t.conversationId),
  ]);
  if (allBgConvIds.size === 0) return null;

  const bgConvIds = Array.from(allBgConvIds);
  const researchConvIds = new Set(bgResearchTasks.map(t => t.conversationId));

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 text-xs flex-shrink-0">
      <Loader2 className="h-3 w-3 animate-spin text-blue-500 flex-shrink-0" />
      <span className="text-blue-700 dark:text-blue-300 flex-shrink-0">
        {bgConvIds.length} 个对话在后台运行中
      </span>
      <div className="flex gap-1 flex-wrap flex-1 min-w-0">
        {bgConvIds.slice(0, 3).map(convId => {
          const title = conversations?.find(c => c.id === convId)?.title || `对话 #${convId}`;
          const isResearch = researchConvIds.has(convId);
          return (
            <button
              key={convId}
              onClick={() => onSwitchTo(convId)}
              className={cn(
                "px-2 py-0.5 rounded transition-colors truncate max-w-[120px]",
                isResearch
                  ? "bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-400 hover:bg-purple-200 dark:hover:bg-purple-800/50"
                  : "bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800/50"
              )}
              title={`切换到: ${title}${isResearch ? ' (研究中)' : ''}`}
            >
              {isResearch ? '🔍 ' : ''}{title}
            </button>
          );
        })}
        {bgConvIds.length > 3 && <span className="text-blue-500">+{bgConvIds.length - 3}</span>}
      </div>
    </div>
  );
}
