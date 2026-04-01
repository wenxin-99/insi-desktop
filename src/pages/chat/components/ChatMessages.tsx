/**
 * ChatMessages — 消息列表组件（虚拟滚动 + 完整版）
 *
 * ✅ B1 完善：
 *   - 传递所有 MessageItem 特殊卡片回调
 *   - 流式传输的 streamedContent 正确注入
 *   - 空状态 / 加载骨架屏
 *   - 滚动到底部按钮联动
 */
import { memo, useRef, forwardRef, useImperativeHandle } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { MessageItem } from './MessageItem';
import type { ChatMessage, OperationLog } from '@/types/chat';
import type { ThinkingStep } from '@/components/ThinkingProcessPanel';

export interface ChatMessagesHandle {
  scrollToBottom: (behavior?: ScrollBehavior) => void;
  scrollToIndex: (index: number) => void;
}

interface ChatMessagesProps {
  messages: ChatMessage[];
  isStreaming: boolean;
  isLoading: boolean;
  streamedContent: string;

  // 编辑
  editingIndex: number | null;
  editText: string;

  // 基础回调
  onCopy: (content: string) => void;
  onEdit: (index: number, text: string) => void;
  onCancelEdit: () => void;
  onEditTextChange: (text: string) => void;
  onEditSubmit: (
    index: number,
    text: string,
    images?: any[],
    files?: any[],
  ) => void;
  onRegenerate: (index: number) => void;
  onResend: (index: number) => void;
  onImageClick: (
    images: Array<{ url: string; name: string }>,
    index: number,
  ) => void;
  onImageDownload: (url: string, name: string) => void;
  onTTS?: (index: number) => void;
  onScrollStateChange?: (isNearBottom: boolean) => void;

  // 展示控制
  collapsedDescriptions: Set<number>;
  onToggleDescription: (index: number) => void;

  // 操作日志
  operationLogs?: OperationLog[];

  // 特殊卡片回调
  onVideoConfirm?: (params: any) => void;
  onVideoReject?: () => void;
  onIntentConfirm?: (intent: string) => void;
  onIntentReject?: () => void;
  onResearchTaskClick?: (taskId: number) => void;
  onRetryFailed?: (msg: ChatMessage) => void;

  // 思考步骤
  thinkingSteps?: ThinkingStep[];
  realtimeThinkingSteps?: ThinkingStep[];

  // 图片生成阶段
  imageGenStage?: { stage: string; prompt?: string; error?: string; errorType?: string; timestamp: number } | null;
  imageGenProgress?: { attempt: number; maxAttempts: number; status: string; timestamp: number } | null;

  // 工具
  normalizeImageUrl: (url: string) => string;
  t: (key: string) => string;

  // 空状态
  emptyState?: React.ReactNode;
  loadingSkeleton?: React.ReactNode;
}

export const ChatMessages = memo(
  forwardRef<ChatMessagesHandle, ChatMessagesProps>(
    function ChatMessages(props, ref) {
      const {
        messages,
        isStreaming,
        isLoading,
        streamedContent,
        editingIndex,
        editText,
        onCopy,
        onEdit,
        onCancelEdit,
        onEditTextChange,
        onEditSubmit,
        onRegenerate,
        onResend,
        onImageClick,
        onImageDownload,
        onTTS,
        onScrollStateChange,
        collapsedDescriptions,
        onToggleDescription,
        operationLogs,
        onVideoConfirm,
        onVideoReject,
        onIntentConfirm,
        onIntentReject,
        onResearchTaskClick,
        onRetryFailed,
        thinkingSteps,
        realtimeThinkingSteps,
        imageGenStage,
        imageGenProgress,
        normalizeImageUrl,
        t,
        emptyState,
        loadingSkeleton,
      } = props;

      const virtuosoRef = useRef<VirtuosoHandle>(null);
      const isAutoScrollingRef = useRef(true);

      useImperativeHandle(ref, () => ({
        scrollToBottom: (behavior: ScrollBehavior = 'smooth') => {
          virtuosoRef.current?.scrollToIndex({
            index: 'LAST',
            behavior,
          });
        },
        scrollToIndex: (index: number) => {
          virtuosoRef.current?.scrollToIndex({
            index,
            behavior: 'smooth',
            align: 'center',
          });
        },
      }));

      // 构建索引映射（虚拟列表 index → 原始 messages index）
      const indexMap: number[] = [];
      messages.forEach((msg, i) => {
        if (msg.role === 'system') return;
        indexMap.push(i);
      });

      // 空/加载状态
      if (isLoading && messages.length === 0) {
        return (
          <div className="flex-1 min-h-0 overflow-y-auto p-4">
            {loadingSkeleton || (
              <div className="space-y-4 animate-pulse">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-3/4" />
                      <div className="h-4 bg-muted rounded w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      }
      if (messages.length === 0) {
        return (
          <div className="flex-1 min-h-0 overflow-y-auto">{emptyState}</div>
        );
      }

      // 渲染单条消息
      const renderItem = (virtualIndex: number) => {
        const realIndex = indexMap[virtualIndex];
        if (realIndex == null) return null;

        const msg = messages[realIndex];
        if (!msg) return null;

        // 流式传输：最后一条助手消息使用 streamedContent
        const isLastAssistant =
          realIndex === messages.length - 1 && msg.role === 'assistant';
        // ★ 修复 React Error #31: msg.content 可能是多模态数组
        const rawContent = typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content.filter((item: any) => item.type === 'text' && item.text).map((item: any) => item.text).join('\n')
            : String(msg.content || '');
        const displayContent =
          isLastAssistant && isStreaming && streamedContent
            ? streamedContent
            : rawContent;

        const displayMsg = {
          ...msg,
          _displayContent: displayContent,
        } as ChatMessage;

        return (
          <MessageItem
            key={msg.id || `msg-${realIndex}`}
            message={displayMsg}
            index={realIndex}
            isStreaming={isStreaming}
            isLastMessage={realIndex === messages.length - 1}
            editingIndex={editingIndex}
            editText={editText}
            onCopy={onCopy}
            onEdit={onEdit}
            onCancelEdit={onCancelEdit}
            onEditTextChange={onEditTextChange}
            onEditSubmit={onEditSubmit}
            onRegenerate={onRegenerate}
            onResend={onResend}
            onImageClick={onImageClick}
            onImageDownload={onImageDownload}
            onTTS={onTTS}
            collapsedDescriptions={collapsedDescriptions}
            onToggleDescription={onToggleDescription}
            operationLogs={operationLogs}
            onVideoConfirm={onVideoConfirm}
            onVideoReject={onVideoReject}
            onIntentConfirm={onIntentConfirm}
            onIntentReject={onIntentReject}
            onResearchTaskClick={onResearchTaskClick}
            onRetryFailed={onRetryFailed}
            thinkingSteps={
              isLastAssistant && isStreaming ? thinkingSteps : undefined
            }
            realtimeThinkingSteps={
              isLastAssistant && isStreaming
                ? realtimeThinkingSteps
                : undefined
            }
            imageGenStage={
              isLastAssistant && isStreaming ? imageGenStage : undefined
            }
            imageGenProgress={
              isLastAssistant && isStreaming ? imageGenProgress : undefined
            }
            normalizeImageUrl={normalizeImageUrl}
            t={t}
          />
        );
      };

      return (
        <Virtuoso
          ref={virtuosoRef}
          totalCount={indexMap.length}
          itemContent={renderItem}
          followOutput={(isAtBottom) => {
            if (isStreaming && isAtBottom) return 'smooth';
            return false;
          }}
          atBottomStateChange={(atBottom) => {
            isAutoScrollingRef.current = atBottom;
            onScrollStateChange?.(atBottom);
          }}
          atBottomThreshold={200}
          overscan={300}
          increaseViewportBy={{ top: 200, bottom: 200 }}
          className="flex-1 min-h-0"
          style={{ overflowX: 'hidden' }}
          components={{
            Footer: () => {
              if (!isStreaming || !streamedContent) return null;
              return (
                <div className="px-4 py-2">
                  <span className="inline-block w-2 h-5 bg-foreground/50 animate-pulse" />
                </div>
              );
            },
          }}
        />
      );
    },
  ),
);
