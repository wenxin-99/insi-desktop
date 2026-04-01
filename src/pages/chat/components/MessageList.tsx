/**
 * MessageList — 消息区域编排器
 * 
 * ★ 统一渲染架构：MessageItem 同时处理 streaming + completed 状态
 *   不再使用独立的 StreamingMessage 组件，消灭双路径 DOM 重建
 * 
 * 负责：Card容器、滚动容器、骨架屏、空状态、滚动到底部按钮、免责声明
 * 委派：
 *   - MessageItem   → 单条消息渲染（streaming + completed）
 *   - ChatInputArea → 底部输入区域
 */

import { useRef, useEffect, useCallback } from 'react';
import { BackgroundTasksBar } from '@/components/BackgroundTaskIndicator';
import { EmptyConversationState } from '@/components/EmptyConversationState';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';

import { MessageItem } from './MessageItem';
import { ChatInputArea } from './ChatInputArea';
import type { ChatStateReturn } from '../types';

interface MessageListProps {
  state: ChatStateReturn;
  handleSendMessage: (text?: string, resendImages?: any[], resendFiles?: any[], isRegenerate?: boolean) => void;
  handleStopStreaming: () => void;
  handleImageDownload: (url: string, name: string) => Promise<void>;
  handleFileUpload: (file: File) => Promise<void>;
  handleImageUpload: (file: File) => Promise<void>;
  retryUpload: (fileId: string) => Promise<void>;
  loadConversationMessages: (id: number, options?: { forceRefresh?: boolean }) => Promise<void>;
  normalizeImageUrl: (url: string) => string;
  extractImagesFromMarkdown: (content: string) => { cleanedContent: string; images: Array<{ url: string; name: string }> };
}

export function MessageList({
  state, handleSendMessage, handleStopStreaming, handleImageDownload,
  handleFileUpload, handleImageUpload, retryUpload,
  loadConversationMessages, normalizeImageUrl, extractImagesFromMarkdown,
}: MessageListProps) {
  const { t } = useTranslation();
  const {
    selectedConversationId, setSelectedConversationId,
    messages,
    isStreamingMessage,
    streamedContent,
    isLoadingMessages,
    showScrollToBottom, setShowScrollToBottom,
    activeResearchTaskId, previewFile,
    isSidebarOpen,
    messagesEndRef, messagesContainerRef, chatInputRef,
    userScrolledUpRef,
    conversations,
    suggestedQuestions, setSuggestedQuestions,
  } = state;

  // ★ 虚拟键盘高度检测 — 用于动态定位 "回到最新" 按钮
  const { keyboardHeight } = useKeyboardHeight();

  // ★ 触摸状态跟踪：区分用户手动滚动 vs 程序性滚动
  const isTouchActiveRef = useRef(false);
  // ★ 鼠标滚轮跟踪（桌面端）
  const isWheelActiveRef = useRef(false);
  // ★ 用户主动上滑后"锁定"：流式期间不让程序性 scroll 事件翻转 flag
  const userScrollLockedRef = useRef(false);

  // 流式结束时解锁
  useEffect(() => {
    if (!isStreamingMessage) {
      userScrollLockedRef.current = false;
    }
  }, [isStreamingMessage]);

  // ★ 注册全局 touch + wheel 监听（passive，不阻塞滚动）
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const onTouchStart = () => { isTouchActiveRef.current = true; };
    const onTouchEnd = () => {
      // 延迟重置，让 scroll 事件有时间先触发
      setTimeout(() => { isTouchActiveRef.current = false; }, 120);
    };
    const onWheel = () => {
      isWheelActiveRef.current = true;
      setTimeout(() => { isWheelActiveRef.current = false; }, 120);
    };
    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });
    container.addEventListener('touchcancel', onTouchEnd, { passive: true });
    container.addEventListener('wheel', onWheel, { passive: true });
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      container.removeEventListener('wheel', onWheel);
    };
  }, [messagesContainerRef]);

  // ★ 滚动事件处理 — 仅在用户手动滚动时更新 userScrolledUpRef
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if ((window as any).__chatScrollRafId) return;
    (window as any).__chatScrollRafId = requestAnimationFrame(() => {
      (window as any).__chatScrollRafId = null;
      const target = e.target as HTMLDivElement;
      const distFromBottom = target.scrollHeight - target.scrollTop - target.clientHeight;
      const isNearBottom = distFromBottom < 150;

      setShowScrollToBottom(!isNearBottom);

      if (isStreamingMessage) {
        const isUserInitiated = isTouchActiveRef.current || isWheelActiveRef.current;
        if (isUserInitiated) {
          if (!isNearBottom) {
            // 用户主动上滑 → 锁定，阻止自动滚动
            userScrolledUpRef.current = true;
            userScrollLockedRef.current = true;
          } else {
            // 用户滑回底部 → 解锁
            userScrolledUpRef.current = false;
            userScrollLockedRef.current = false;
          }
        }
        // 程序性滚动 → 不修改 userScrolledUpRef
      }
    });
  }, [isStreamingMessage, setShowScrollToBottom, userScrolledUpRef]);

  return (
    <>
      {/* 对话区域 — 移动端无边框全屏，桌面端保留 Card 外观 */}
      <div className="flex-1 flex flex-col overflow-hidden md:rounded-lg md:border md:shadow-sm md:bg-card" style={{ paddingTop: '0px', paddingBottom: '2px' }}>
        <div className="px-0 pt-1 md:pt-2 pb-0 flex flex-col flex-1 min-h-0 relative" style={{ paddingBottom: '0px' }}>

          {/* 后台任务提示条 */}
          <BackgroundTasksBar
            currentConversationId={selectedConversationId}
            onSwitchTo={(convId: number) => {
              setSelectedConversationId(convId);
              loadConversationMessages(convId);
            }}
            conversations={conversations?.map((c: any) => ({ id: c.id, title: c.title }))}
          />

          {/* 消息列表 - 滚动容器
              ★ 移除 scroll-smooth：该 CSS 让触摸滚动也变成动画，手感极差
              ★ 添加 overscroll-behavior: contain：防止 iOS 弹性过度滚动传播到外层 */}
          <div
            ref={messagesContainerRef}
            className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden mb-1 md:mb-2 relative"
            style={{ overscrollBehavior: 'contain', WebkitOverflowScrolling: 'touch' }}
            onScroll={handleScroll}
          >
            <div className={cn(
              "space-y-1 md:space-y-1 md:mx-auto md:w-full transition-all duration-300 ease-in-out pb-2",
              (activeResearchTaskId || previewFile) && isSidebarOpen
                ? "md:max-w-[750px]"
                : "md:max-w-[900px]"
            )}>

              {/* 加载骨架屏 */}
              {isLoadingMessages && messages.length === 0 && (
                <div className="space-y-4 p-4 animate-pulse">
                  <div className="flex gap-3 justify-end">
                    <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                      <div className="h-4 bg-muted-foreground/20 rounded w-48 mb-2" />
                      <div className="h-4 bg-muted-foreground/20 rounded w-32" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                      <div className="h-4 bg-muted-foreground/20 rounded w-64 mb-2" />
                      <div className="h-4 bg-muted-foreground/20 rounded w-56 mb-2" />
                      <div className="h-4 bg-muted-foreground/20 rounded w-40" />
                    </div>
                  </div>
                  <div className="flex gap-3 justify-end">
                    <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                      <div className="h-4 bg-muted-foreground/20 rounded w-36" />
                    </div>
                  </div>
                  <div className="flex gap-3">
                    <div className="bg-muted rounded-lg p-3 max-w-[70%]">
                      <div className="h-4 bg-muted-foreground/20 rounded w-72 mb-2" />
                      <div className="h-4 bg-muted-foreground/20 rounded w-48" />
                    </div>
                  </div>
                </div>
              )}

              {/* 空状态 — ★ 只要当前对话没有消息就显示（新建对话、空对话均可） */}
              {messages.length === 0 && !isLoadingMessages && (
                <EmptyConversationState
                  onSelectTemplate={(template: string) => {
                    chatInputRef.current?.setInput(template);
                    chatInputRef.current?.focus();
                  }}
                  onSendMessage={(text: string) => {
                    handleSendMessage(text);
                  }}
                />
              )}

              {/* ═══════ 消息列表（★ 统一渲染：流式+完成态同一 DOM 节点） ═══════ */}
              <div className={isLoadingMessages ? 'opacity-0' : 'animate-in fade-in duration-300'}>
              {messages.map((msg, index) => {
                if (msg.role === 'system') return null;

                const isLastAssistant = index === messages.length - 1 && msg.role === 'assistant';
                const isStreamingThis = isStreamingMessage && isLastAssistant;
                // ★ 流式期间使用 streamedContent，完成态使用 msg.content
                // ★ 修复 React Error #31: msg.content 可能是多模态数组 [{type:"text",text:"..."}]
                const rawContent = (() => {
                  const c = msg.content;
                  if (typeof c === 'string') return c;
                  if (Array.isArray(c)) {
                    return c
                      .filter((item: any) => item.type === 'text' && item.text)
                      .map((item: any) => item.text)
                      .join('\n');
                  }
                  return String(c || '');
                })();
                const displayContent = isStreamingThis
                  ? (streamedContent || '')
                  : (isLastAssistant && !rawContent && streamedContent) ? streamedContent : rawContent;

                return (
                  <MessageItem
                    key={msg.id || `msg-${index}`}
                    msg={msg}
                    index={index}
                    displayContent={displayContent}
                    isLastAssistant={isLastAssistant}
                    isStreaming={isStreamingThis}
                    state={state}
                    handleSendMessage={handleSendMessage}
                    handleImageDownload={handleImageDownload}
                    normalizeImageUrl={normalizeImageUrl}
                    extractImagesFromMarkdown={extractImagesFromMarkdown}
                  />
                );
              })}
              </div>{/* fade-in wrapper end */}

              {/* ═══════ 滚动锚点 ═══════ */}
              <div ref={messagesEndRef} />

              {/* ═══════ 推荐追问（内联在消息流中，紧跟AI回复） ═══════ */}
              {suggestedQuestions.length > 0 && !isStreamingMessage && (
                <div className="px-3 md:px-4 pt-1 pb-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                  <div className="flex items-center gap-1.5 mb-2 text-xs text-muted-foreground/70">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
                    <span>猜你想问</span>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {suggestedQuestions.map((question: string, idx: number) => (
                      <button
                        key={idx}
                        className="group flex items-center gap-2 w-fit max-w-full px-3 py-2 text-sm text-left rounded-xl border border-border/60 bg-muted/30 text-foreground/80 hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all duration-200 cursor-pointer"
                        onClick={() => {
                          setSuggestedQuestions([]);
                          handleSendMessage(question);
                        }}
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 opacity-40 group-hover:opacity-70 transition-opacity"><path d="m9 18 6-6-6-6"/></svg>
                        <span className="truncate">{question}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>{/* 内容居中容器结束 */}
          </div>{/* 滚动容器结束 */}

          {/* 滚动到底部按钮 — ★ 动态定位，键盘弹出时不被遮挡 */}
          {showScrollToBottom && (
            <button
              onClick={() => {
                userScrolledUpRef.current = false;
                userScrollLockedRef.current = false;
                messagesContainerRef.current?.scrollTo({
                  top: messagesContainerRef.current.scrollHeight,
                  behavior: 'smooth',
                });
              }}
              className={cn(
                "absolute left-1/2 -translate-x-1/2 z-20 backdrop-blur-sm border shadow-md transition-all duration-300 hover:shadow-lg flex items-center justify-center",
                isStreamingMessage && userScrolledUpRef.current
                  ? "gap-1.5 px-3 py-1.5 rounded-full bg-blue-500/90 hover:bg-blue-600 border-blue-400/50 text-white"
                  : "w-8 h-8 rounded-full bg-white/90 hover:bg-white border-gray-200"
              )}
              style={{
                // ★ 键盘未弹出：固定在输入框上方 16px
                // ★ 键盘弹出：额外加上键盘高度偏移
                bottom: `${120 + keyboardHeight}px`,
              }}
              title={t('chat.scrollToBottom')}
            >
              {isStreamingMessage && userScrolledUpRef.current ? (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                  <span className="text-xs font-medium">回到最新</span>
                </>
              ) : (
                <svg className="w-4 h-4 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                </svg>
              )}
            </button>
          )}

          {/* ═══════ 输入区域 ═══════ */}
          <ChatInputArea
            state={state}
            handleSendMessage={handleSendMessage}
            handleStopStreaming={handleStopStreaming}
            handleFileUpload={handleFileUpload}
            handleImageUpload={handleImageUpload}
            retryUpload={retryUpload}
          />

        </div>
      </div>
    </>
  );
}
