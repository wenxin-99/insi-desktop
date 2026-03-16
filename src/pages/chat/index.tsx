/**
 * Chat 页面主容器 — 重构版骨架
 * 
 * 【重要】这是一个渐进式迁移的示范骨架，不是直接替换文件。
 * 
 * 迁移策略：
 *   1. 先在旧 Chat.tsx 中逐步 import 新 hooks 替换对应的 useState
 *   2. 逐步将 JSX 块替换为新组件
 *   3. 最终完全切换到此文件
 * 
 * 从 6041 行 → ~300 行（纯组装，逻辑全在 hooks 和子组件中）
 */
import { useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

// === 新 Hooks ===
import { useChatReducer } from './hooks/useChatReducer';
import { useChatMessages } from './hooks/useChatMessages';
import { useFileUpload } from './hooks/useFileUpload';
import { useThinkingMode } from './hooks/useThinkingMode';
import { useBackgroundStream } from '@/hooks/useBackgroundStream';
import { useSSEReconnect } from '@/hooks/useSSEReconnect';
import { useAutoRetry } from '@/hooks/useAutoRetry';

// === 新组件 ===
import { ChatHeader } from './components/ChatHeader';
import { ChatMessages, ChatMessagesHandle } from './components/ChatMessages';
import { NetworkStatusBar } from '@/components/NetworkStatusBar';
import { ConversationSearch } from '@/components/ConversationSearch';

// === 已有组件（复用） ===
import { DashboardLayout } from '@/components/DashboardLayout';
import { ChatInput } from '@/components/ChatInput';
// ... 其他 import

// 类型
import type { ChatInputRef } from '@/components/ChatInput';

export default function ChatPage() {
  const { t } = useTranslation();

  // ═══════════════════════════════════════
  // 状态管理（替代 51 个 useState）
  // ═══════════════════════════════════════
  const { state, dispatch, batchDispatch } = useChatReducer({
    conversation: {
      selectedConversationId: null, // 初始化时从 URL/localStorage 读取
      selectedModelId: null,
      selectedPackageId: null,
      messages: [],
      message: '',
      isLoadingMessages: false,
    },
  });

  // 消息管理
  const messageManager = useChatMessages({
    conversationId: state.conversation.selectedConversationId,
  });

  // 文件上传
  const fileUpload = useFileUpload();

  // 思考模式
  const thinking = useThinkingMode();

  // 流式传输
  const { sendMessage, isStreaming, streamedContent, abort: abortStream, setOptions: setStreamOptions } =
    useBackgroundStream(state.conversation.selectedConversationId);

  // SSE 通知（自动重连）
  const { status: sseStatus } = useSSEReconnect('/api/notifications/stream', {
    enabled: !!state.conversation.selectedConversationId,
    onMessage: (event) => {
      try {
        const data = JSON.parse(event.data);
        handleNotificationEvent(data);
      } catch {}
    },
    maxRetries: 10,
    initialDelay: 2000,
  });

  // API 重试
  const { execute: retryableExecute } = useAutoRetry({
    maxRetries: 3,
    initialDelay: 1500,
    onRetry: (attempt) => toast.info(`正在重试 (${attempt}/3)...`),
  });

  // Refs
  const chatInputRef = useRef<ChatInputRef>(null);
  const chatMessagesRef = useRef<ChatMessagesHandle>(null);

  // ═══════════════════════════════════════
  // 核心逻辑
  // ═══════════════════════════════════════

  /** 处理发送消息 */
  const handleSendMessage = useCallback(async (
    text: string,
    images?: any[],
    files?: any[],
  ) => {
    // ... 发送逻辑（从原 Chat.tsx handleSendMessage 迁移）
    // 使用 messageManager.addMessage()
    // 使用 sendMessage() 启动流式传输
    // 使用 thinking.resetThinking() 重置思考状态
  }, [/* deps */]);

  /** 处理停止生成 */
  const handleStopStreaming = useCallback(() => {
    abortStream?.();
    // 保存已生成内容...
    dispatch({ type: 'SET_STREAMING', payload: false });
  }, [abortStream, dispatch]);

  /** 处理通知事件 */
  const handleNotificationEvent = useCallback((data: any) => {
    // ★ 后端 thinkingStepTracker 发送的 type 是 'thinking_step_update'，data.data 是 step 对象
    if (data.type === 'thinking_step_update' && data.data) {
      const step = data.data;
      thinking.setRealtimeThinkingSteps((prev: any[]) => {
        const idx = prev.findIndex((s: any) => s.id === step.id);
        if (idx >= 0) { const updated = [...prev]; updated[idx] = step; return updated; }
        return [...prev, step];
      });
    }
    if (data.type === 'operation_log') {
      thinking.addOperationLog(data);
    }
  }, [thinking]);

  /** 加载对话消息 */
  const loadConversationMessages = useCallback(async (convId: number) => {
    dispatch({ type: 'SET_LOADING_MESSAGES', payload: true });
    try {
      await messageManager.loadMessages(convId);
    } catch (error: any) {
      toast.error('加载对话历史失败，请稍后重试');
    } finally {
      dispatch({ type: 'SET_LOADING_MESSAGES', payload: false });
    }
  }, [dispatch, messageManager]);

  /** 处理消息编辑 */
  const handleEditSubmit = useCallback((index: number, text: string, images?: any[], files?: any[]) => {
    messageManager.editAndResend(index, text);
    dispatch({ type: 'CANCEL_EDIT' });
    // 延迟发送（等 React 更新完毕）
    setTimeout(() => handleSendMessage(text, images, files), 50);
  }, [messageManager, dispatch, handleSendMessage]);

  /** 处理消息重新生成 */
  const handleRegenerate = useCallback((index: number) => {
    // 找到这条助手消息前面的用户消息
    const msgs = messageManager.messages;
    if (msgs[index]?.role === 'assistant' && index > 0 && msgs[index - 1]?.role === 'user') {
      const userMsg = msgs[index - 1];
      messageManager.setMessages(prev => prev.slice(0, index));
      setTimeout(() => handleSendMessage(
        typeof userMsg.content === 'string' ? userMsg.content : '',
        (userMsg as any).images,
        (userMsg as any).files,
      ), 50);
    }
  }, [messageManager, handleSendMessage]);

  // ═══════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════

  return (
    <DashboardLayout>
      <NetworkStatusBar />
      <ConversationSearch
        onSelect={(id) => {
          dispatch({ type: 'SET_CONVERSATION_ID', payload: id });
          loadConversationMessages(id);
        }}
        enabled={true}
      />

      <div className="flex h-[calc(100dvh-3.5rem-0.5rem)] overflow-hidden">
        <div
          className="flex flex-col flex-1 overflow-hidden relative"
          onDragOver={fileUpload.handleDragOver}
          onDragLeave={fileUpload.handleDragLeave}
          onDrop={fileUpload.handleDrop}
        >
          {/* 顶部工具栏 */}
          <ChatHeader
            selectedPackageId={state.conversation.selectedPackageId}
            selectedConversationId={state.conversation.selectedConversationId}
            thinkingMode={thinking.thinkingMode}
            isStreaming={isStreaming}
            onPackageChange={(id) => dispatch({ type: 'SET_PACKAGE_ID', payload: id })}
            onThinkingModeToggle={() => thinking.setThinkingMode(!thinking.thinkingMode)}
            onNewConversation={() => {/* ... */}}
            onOpenMobileSidebar={() => dispatch({ type: 'SET_MOBILE_SIDEBAR', payload: true })}
            onExportMarkdown={() => {/* ... */}}
            onExportWord={() => {/* ... */}}
            onOpenSearch={() => {/* Ctrl+K */}}
            t={t}
          />

          {/* 消息列表（虚拟滚动） */}
          <ChatMessages
            ref={chatMessagesRef}
            messages={messageManager.messages}
            isStreaming={isStreaming}
            isLoading={state.conversation.isLoadingMessages}
            streamedContent={streamedContent}
            editingIndex={state.edit.editingMessageIndex}
            editText={state.edit.editText}
            onCopy={(content) => {
              navigator.clipboard.writeText(content);
            }}
            onEdit={(index, text) => dispatch({ type: 'START_EDIT', payload: { index, text } })}
            onCancelEdit={() => dispatch({ type: 'CANCEL_EDIT' })}
            onEditTextChange={(text) => dispatch({ type: 'SET_EDIT_TEXT', payload: text })}
            onEditSubmit={handleEditSubmit}
            onRegenerate={handleRegenerate}
            onResend={(index) => {/* ... */}}
            onImageClick={(images, idx) => dispatch({ type: 'OPEN_LIGHTBOX', payload: { images, index: idx } })}
            onImageDownload={(url, name) => {/* ... */}}
            onScrollStateChange={(isNearBottom) => {
              dispatch({ type: 'SET_SCROLL_TO_BOTTOM', payload: !isNearBottom });
            }}
            collapsedDescriptions={messageManager.collapsedDescriptions}
            onToggleDescription={messageManager.toggleDescription}
            normalizeImageUrl={(url) => url} // 实际实现中替换为真实函数
            t={t}
          />

          {/* 输入框 */}
          <ChatInput
            ref={chatInputRef}
            onSend={handleSendMessage}
            onStop={handleStopStreaming}
            isStreaming={isStreaming}
            // ... 其他 props
          />
        </div>
      </div>
    </DashboardLayout>
  );
}
