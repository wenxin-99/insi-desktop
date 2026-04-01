import { streamManager } from '@/lib/backgroundStreamManager';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Zap, X, Plus } from 'lucide-react';

interface TaskStatusPanelProps {
  showTaskLimitBanner: boolean;
  setShowTaskLimitBanner: (v: boolean) => void;
  modelPackages: any[];
  selectedPackageId: number | null;
  conversations: any[];
  setSelectedConversationId: (id: number | null) => void;
  setMessages: (fn: any) => void;
  conversationLimitInfo: { isAtLimit: boolean; maxMessages: number; currentCount: number; remaining: number };
  messages: any[];
}

export function TaskStatusPanel({
  showTaskLimitBanner,
  setShowTaskLimitBanner,
  modelPackages,
  selectedPackageId,
  conversations,
  setSelectedConversationId,
  setMessages,
  conversationLimitInfo,
  messages,
}: TaskStatusPanelProps) {
  return (
    <>
      {/* 多任务并发上限提示 */}
      {showTaskLimitBanner && (() => {
        const pkg = modelPackages?.find((p: any) => p.id === selectedPackageId);
        const maxC = pkg?.maxConcurrentTasks ?? 3;
        const runningTasks = streamManager.getRunningTasks();
        return (
          <div className="mb-2 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/90 dark:bg-amber-950/40 backdrop-blur-sm overflow-hidden">
            <div className="px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/60 flex items-center justify-center">
                  <Zap className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">已达到同时对话上限</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-0.5">
                    当前套餐最多同时运行 {maxC} 个对话，已有 {runningTasks.length} 个进行中。请等待任务完成后继续。
                  </p>
                  {runningTasks.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {runningTasks.map((task) => {
                        const conv = conversations?.find((c: any) => c.id === task.conversationId);
                        return (
                          <button
                            key={task.conversationId}
                            onClick={() => { setSelectedConversationId(task.conversationId); setShowTaskLimitBanner(false); }}
                            className="flex items-center gap-2 w-full text-left px-2.5 py-1.5 rounded-lg bg-amber-100/60 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 transition-colors group"
                          >
                            <span className="relative flex h-2 w-2 flex-shrink-0">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
                            </span>
                            <span className="text-xs text-amber-700 dark:text-amber-300 truncate flex-1">
                              {conv?.title || `对话 #${task.conversationId}`}
                            </span>
                            <span className="text-[10px] text-amber-500 dark:text-amber-500 group-hover:text-amber-700 dark:group-hover:text-amber-300 flex-shrink-0">前往查看 →</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <div className="mt-2 flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-amber-200 dark:bg-amber-800 rounded-full overflow-hidden">
                      <div className="h-full bg-amber-500 dark:bg-amber-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, (runningTasks.length / maxC) * 100)}%` }} />
                    </div>
                    <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400 tabular-nums flex-shrink-0">{runningTasks.length}/{maxC}</span>
                  </div>
                </div>
                <button onClick={() => setShowTaskLimitBanner(false)}
                  className="flex-shrink-0 text-amber-400 hover:text-amber-600 dark:text-amber-500 dark:hover:text-amber-300 p-0.5">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* 单对话消息上限提示 */}
      {conversationLimitInfo.isAtLimit && (
        <div className="mb-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/90 dark:bg-gray-900/60 backdrop-blur-sm overflow-hidden">
          <div className="px-4 py-3">
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                <svg className="w-4 h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 dark:text-gray-200">对话已达到消息上限（{conversationLimitInfo.maxMessages} 条）</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">为保证对话质量，请开启新对话继续交流</p>
              </div>
              <Button size="sm" onClick={() => { setSelectedConversationId(null); setMessages([]); }} className="flex-shrink-0 gap-1.5">
                <Plus className="h-3.5 w-3.5" />新对话
              </Button>
            </div>
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div className="h-full bg-gray-400 dark:bg-gray-500 rounded-full" style={{ width: '100%' }} />
              </div>
              <span className="text-[10px] font-medium text-gray-500 dark:text-gray-400 tabular-nums flex-shrink-0">
                {conversationLimitInfo.currentCount}/{conversationLimitInfo.maxMessages}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 接近上限轻提示 */}
      {!conversationLimitInfo.isAtLimit && conversationLimitInfo.remaining <= 10 && conversationLimitInfo.remaining > 0 && messages.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-1 mb-1 rounded-lg bg-gray-50 dark:bg-gray-900/40 border border-gray-200 dark:border-gray-700">
          <span className="text-[11px] text-gray-500 dark:text-gray-400">本对话剩余 {conversationLimitInfo.remaining} 条消息额度</span>
          <div className="flex-1 h-1 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden max-w-[80px]">
            <div className={cn("h-full rounded-full transition-all", conversationLimitInfo.remaining <= 3 ? "bg-red-400" : "bg-amber-400")}
              style={{ width: `${(conversationLimitInfo.remaining / 10) * 100}%` }} />
          </div>
        </div>
      )}
    </>
  );
}
