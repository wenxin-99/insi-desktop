/**
 * Chat — 主编排器
 * 
 * 精简后的主文件，仅负责：
 * 1. 调用所有 hooks 获取状态和方法
 * 2. 组合所有子组件
 * 3. 渲染外层布局（DashboardLayout、拖拽遮罩、右侧面板）
 * 
 * 原始: 6041 行 → 精简后 ~250 行
 */

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Image as ImageIcon, Sparkles, Loader2, Bot, X } from 'lucide-react';
import { NetworkStatusBar } from '@/components/NetworkStatusBar';
import { ConversationSearch } from '@/components/ConversationSearch';
import { RightSidePanel } from '@/components/RightSidePanel';
import { FilePreviewPanel } from '@/components/FilePreviewPanel';
import { ArtifactCard } from '@/components/ArtifactCard';
import SandboxPanel from '@/components/SandboxPanel';
import { useTranslation } from 'react-i18next';
import { MobileSandboxSheet } from '@/components/MobileSandboxSheet';
import { useIsMobile } from '@/hooks/useMobile';
// ── Hooks ──
import {
  useChatState,
  useFileUpload,
  useExport,
  useConversation,
  useSendMessage,
  useChatEffects,
} from './chat/hooks';
import { useReplyNotification } from '@/hooks/useReplyNotification';
import { ChatAgentPanel, useAgentMode } from '@/components/agentMode/ChatAgentPanel';
import { CloudDesktopViewer } from '@/components/desktopPanel/CloudDesktopViewer';
import type { FixErrorContext } from '@/components/codeCanvas';
// ── Components ──
import {
  ChatToolbar,
  MessageList,
  ChatDialogs,
} from './chat/components';

export default function Chat() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // ═══════════ 1. 全局状态 ═══════════
  const state = useChatState();

  // ═══════════ 1.5 移动端 Artifact 全屏控制 ═══════════
  // 移动端不自动弹全屏，需用户主动点击才打开
  const [mobileArtifactOpen, setMobileArtifactOpen] = useState(false);
  // activeArtifact 清空时重置
  useEffect(() => {
    if (!state.activeArtifact) setMobileArtifactOpen(false);
  }, [state.activeArtifact]);

  // ── 下滑手势关闭 ──
  const [sheetDragY, setSheetDragY] = useState(0);        // 当前下拉距离
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetTouchStartRef = useRef<{ y: number; time: number } | null>(null);
  const SWIPE_THRESHOLD = 80;    // 下拉超过 80px 触发关闭
  const VELOCITY_THRESHOLD = 0.5; // 快速下滑也触发

  const closeMobileArtifact = useCallback(() => {
    setMobileArtifactOpen(false);
    state.setActiveArtifact(null);
    setSheetDragY(0);
    setSheetDragging(false);
  }, [state]);

  const handleSheetTouchStart = useCallback((e: React.TouchEvent) => {
    // 只在触摸顶部拖拽条区域时启动手势（前 48px）
    const touch = e.touches[0];
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    if (touch.clientY - rect.top > 48) return; // 只响应顶部区域
    sheetTouchStartRef.current = { y: touch.clientY, time: Date.now() };
  }, []);

  const handleSheetTouchMove = useCallback((e: React.TouchEvent) => {
    if (!sheetTouchStartRef.current) return;
    const deltaY = e.touches[0].clientY - sheetTouchStartRef.current.y;
    if (deltaY > 0) { // 只处理下拉
      setSheetDragY(deltaY);
      setSheetDragging(true);
    }
  }, []);

  const handleSheetTouchEnd = useCallback(() => {
    if (!sheetTouchStartRef.current || !sheetDragging) {
      sheetTouchStartRef.current = null;
      return;
    }
    const elapsed = Date.now() - sheetTouchStartRef.current.y;
    const velocity = sheetDragY / Math.max(1, Date.now() - sheetTouchStartRef.current.time);
    if (sheetDragY > SWIPE_THRESHOLD || velocity > VELOCITY_THRESHOLD) {
      closeMobileArtifact();
    } else {
      setSheetDragY(0);
      setSheetDragging(false);
    }
    sheetTouchStartRef.current = null;
  }, [sheetDragY, sheetDragging, closeMobileArtifact]);

  // 注入到 state 中供子组件调用（点击内联触发卡片时打开移动端全屏）
  const enhancedState = useMemo(() => ({
    ...state,
    openMobileArtifact: () => setMobileArtifactOpen(true),
  }), [state]);

  // ═══════════ 2. 文件上传 ═══════════
  const {
    handleDragOver, handleDragLeave, handleDrop,
    handleFileUpload, handleImageUpload, retryUpload,
  } = useFileUpload(state);

  // ═══════════ 3. 导出功能 ═══════════
  const {
    exportToMarkdown, exportToWord,
    handleExportConversation, handleExportPdf,
    handleImageDownload, handleShareConversation,
  } = useExport(state);

  // ═══════════ 4. 对话管理 ═══════════
  const {
    parseDisplayMessages, computeCollapsedIndices,
    saveToMessageCache, restoreResearchTaskFromMessages,
    loadConversationMessages,
    handleCreateConversation, handleDeleteConversation,
    handleClearHistory, handleStopStreaming,
  } = useConversation(state);

  // ═══════════ 5. 消息发送 ═══════════
  const {
    handleSendMessage,
    normalizeImageUrl, extractImagesFromMarkdown,
    generateSuggestedQuestions,
  } = useSendMessage(state);

  // ★ P1-1: 设置排队消费回调 — useStreamCallbacks 完成后会调用此 ref
  state.pendingSendRef.current = handleSendMessage;

  // ═══════════ 6. 副作用（useEffect 集合） ═══════════
  useChatEffects(state, {
    loadConversationMessages,
    handleSendMessage,
    saveToMessageCache,
    generateSuggestedQuestions,
  });

  // ★ 侧边栏对话列表事件监听（用 ref 避免 stale closure）
  const sidebarHandlersRef = useRef({ loadConversationMessages, handleCreateConversation, handleDeleteConversation, handleExportConversation, handleShareConversation, setSelectedConversationId: state.setSelectedConversationId, setMessages: state.setMessages, refetchConversations: state.refetchConversations, selectedConversationId: state.selectedConversationId, setManagingTagsForConversation: state.setManagingTagsForConversation, setShowTagManagement: state.setShowTagManagement });
  sidebarHandlersRef.current = { loadConversationMessages, handleCreateConversation, handleDeleteConversation, handleExportConversation, handleShareConversation, setSelectedConversationId: state.setSelectedConversationId, setMessages: state.setMessages, refetchConversations: state.refetchConversations, selectedConversationId: state.selectedConversationId, setManagingTagsForConversation: state.setManagingTagsForConversation, setShowTagManagement: state.setShowTagManagement };

  useEffect(() => {
    const h = sidebarHandlersRef;
    const onSelect = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) { h.current.setSelectedConversationId(id); h.current.loadConversationMessages(id); }
    };
    const onCreate = () => h.current.handleCreateConversation();
    const onDelete = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (!id) return;
      // ★ FIX: SidebarChatList 已完成确认+删除，这里只做 UI 清理，不再调 handleDeleteConversation（会二次确认+二次删除）
      const s = h.current;
      if (s.selectedConversationId === id) {
        s.setSelectedConversationId(null);
        s.setMessages([]);
      }
      s.refetchConversations();
    };
    const onExport = (e: Event) => { const id = (e as CustomEvent).detail?.id; if (id) h.current.handleExportConversation(id); };
    const onShare = (e: Event) => { const id = (e as CustomEvent).detail?.id; if (id) h.current.handleShareConversation(id); };
    // ★ P0-1: 管理标签
    const onManageTags = (e: Event) => {
      const id = (e as CustomEvent).detail?.id;
      if (id) { h.current.setManagingTagsForConversation(id); h.current.setShowTagManagement(true); }
    };

    window.addEventListener('sidebar:selectConversation', onSelect);
    window.addEventListener('sidebar:createConversation', onCreate);
    window.addEventListener('sidebar:deleteConversation', onDelete);
    window.addEventListener('sidebar:exportConversation', onExport);
    window.addEventListener('sidebar:shareConversation', onShare);
    window.addEventListener('sidebar:manageTags', onManageTags);
    return () => {
      window.removeEventListener('sidebar:selectConversation', onSelect);
      window.removeEventListener('sidebar:createConversation', onCreate);
      window.removeEventListener('sidebar:deleteConversation', onDelete);
      window.removeEventListener('sidebar:exportConversation', onExport);
      window.removeEventListener('sidebar:shareConversation', onShare);
      window.removeEventListener('sidebar:manageTags', onManageTags);
    };
  }, []);

  // ★ 同步 selectedConversationId 到侧边栏对话列表
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chat:stateSync', {
      detail: { selectedConversationId: state.selectedConversationId },
    }));
  }, [state.selectedConversationId]);


  // ═══════════ Bot P0: Bot 信息栏与开场白 ═══════════
  const { activeBotId, activeBotInfo, isLoadingBotInfo } = state;
  const [botStartersDismissed, setBotStartersDismissed] = useState(false);
  // 切换 Bot 或对话时重置
  useEffect(() => { setBotStartersDismissed(false); }, [activeBotId, state.selectedConversationId]);

useReplyNotification({ isStreaming: state.isStreaming, isResearchMode: state.isResearchMode });

  // ═══════════ 7.5 Agent Mode ═══════════
  const agentMode = useAgentMode();
  useEffect(() => {
    const handler = (e: Event) => {
      agentMode.handleSSEEvent((e as CustomEvent).detail);
    };
    window.addEventListener('agent:sse', handler);
    return () => window.removeEventListener('agent:sse', handler);
  }, [agentMode.handleSSEEvent]);
  useEffect(() => { agentMode.reset(); }, [state.selectedConversationId]);

  // ═══════════ 7.55 Desktop Control (Computer Use) ═══════════
  const [desktopState, setDesktopState] = useState<{
    status: 'inactive' | 'creating' | 'ready' | 'operating' | 'done' | 'error';
    viewerUrl?: string;
    screenshot?: string;
    screenWidth?: number;
    screenHeight?: number;
    statusMessage?: string;
    steps: Array<{ tool: string; description: string; timestamp: number }>;
  }>({ status: 'inactive', steps: [] });

  useEffect(() => {
    const handler = (e: Event) => {
      const data = (e as CustomEvent).detail;
      if (data.type === 'desktop_screenshot') {
        setDesktopState(prev => ({
          ...prev,
          status: prev.status === 'inactive' ? 'operating' : prev.status,
          screenshot: data.screenshot,
          screenWidth: data.width,
          screenHeight: data.height,
          steps: [...prev.steps, { tool: 'screenshot', description: '', timestamp: Date.now() }],
        }));
      } else if (data.type === 'desktop_status') {
        setDesktopState(prev => ({
          ...prev,
          status: data.status || prev.status,
          viewerUrl: data.viewerUrl || prev.viewerUrl,
          screenWidth: data.screenWidth || prev.screenWidth,
          screenHeight: data.screenHeight || prev.screenHeight,
          statusMessage: data.message,
        }));
      }
    };
    window.addEventListener('desktop:sse', handler);
    return () => window.removeEventListener('desktop:sse', handler);
  }, []);
  useEffect(() => { setDesktopState({ status: 'inactive', steps: [] }); }, [state.selectedConversationId]);

  // ═══════════ 7.6 Code Canvas AI 修复 ═══════════
  useEffect(() => {
    const handler = (e: Event) => {
      const ctx = (e as CustomEvent<FixErrorContext>).detail;
      const lang = ctx.language === "python" ? "Python" : ctx.language === "typescript" ? "TypeScript" : "JavaScript";
      const lineInfo = ctx.errorLine ? ` (第 ${ctx.errorLine} 行)` : "";
      const prompt = `请修复以下 ${lang} 代码中的错误${lineInfo}：\n\n错误信息：\n${ctx.error}\n\n控制台输出：\n${ctx.consoleOutput || "（无）"}\n\n代码：\n\`\`\`${ctx.language}\n${ctx.code}\n\`\`\`\n\n请直接给出修复后的完整代码，不要省略任何部分。`;
      handleSendMessage(prompt);
    };
    window.addEventListener('code-canvas:fix-error', handler as any);
    return () => window.removeEventListener('code-canvas:fix-error', handler as any);
  }, [handleSendMessage]);

  // ═══════════ 7.7 组件内发送消息（DecisionCard 深入分析 / LiveDataCard 刷新） ═══════════
  useEffect(() => {
    const handler = (e: Event) => {
      const prompt = (e as CustomEvent<{ prompt: string }>).detail?.prompt;
      if (prompt) handleSendMessage(prompt);
    };
    window.addEventListener('chat:sendPrompt', handler as any);
    return () => window.removeEventListener('chat:sendPrompt', handler as any);
  }, [handleSendMessage]);

  // ═══════════ 8. URL 参数：从语音对话返回时自动恢复对话 ═══════════
  const _urlConvLoaded = useRef(false);
  useEffect(() => {
    if (_urlConvLoaded.current) return;
    const param = new URLSearchParams(window.location.search).get('conversationId');
    if (!param) return;
    const convId = parseInt(param, 10);
    if (isNaN(convId)) return;
    _urlConvLoaded.current = true;
    // 清除 URL 中的参数，避免下次进入重复触发
    window.history.replaceState({}, '', window.location.pathname);
    setSelectedConversationId(convId);
    loadConversationMessages(convId);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ═══════════ 渲染 ═══════════
  const {
    selectedConversationId, setSelectedConversationId,
    currentUser,
    isDragging,
    chatContainerRef,
    activeResearchTaskId, setActiveResearchTaskId,
    previewFile, setPreviewFile,
    previewFiles, activePreviewIndex, setActivePreviewIndex,
    activeArtifact, setActiveArtifact,
    sandboxData, sandboxActiveTab, setSandboxActiveTab,
    isReconnecting,
    messages,
  } = state;

  return (
    <DashboardLayout hideHeader={isMobile}>
      <NetworkStatusBar />

      {/* 对话搜索（Ctrl+K / Cmd+K） */}
      <ConversationSearch
        onSelect={(id: number) => {
          setSelectedConversationId(id);
          loadConversationMessages(id);
        }}
        enabled={!!currentUser}
      />

      {/* 超宽屏三栏布局容器 — 移动端隐藏 header 后可用高度更大 */}
      <div className={`flex overflow-hidden ${
        isMobile
          ? 'h-[calc(100dvh-0.5rem)] max-h-[calc(100dvh-0.5rem)]'
          : 'h-[calc(100dvh-3.5rem-0.5rem)] md:h-[calc(100dvh-3.5rem-0.5rem)] lg:h-[calc(100vh-0.75rem)] max-h-[calc(100dvh-3.5rem-0.5rem)] md:max-h-[calc(100dvh-3.5rem-0.5rem)] lg:max-h-[calc(100vh-0.75rem)]'
      }`}>

        {/* 中间主要内容区域 */}
        <div
          ref={chatContainerRef}
          className="flex flex-col flex-1 overflow-hidden relative"
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {/* 全屏拖拽遮罩层 */}
          {isDragging && (
            <div className="absolute inset-0 bg-primary/5 backdrop-blur-sm flex items-center justify-center z-50 pointer-events-none">
              <div className="bg-background/95 border-2 border-dashed border-primary rounded-2xl p-8 md:p-12 shadow-2xl">
                <div className="flex flex-col items-center gap-4">
                  <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary/10 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 md:w-10 md:h-10 text-primary" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg md:text-xl font-semibold text-primary mb-1">释放以上传文件</p>
                    <p className="text-sm text-muted-foreground">支持图片、PDF、Word、Excel等格式</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 顶部工具栏 */}

          {/* ★ Bot P0: Bot 信息栏 */}
          {activeBotInfo && (
            <div className="mx-4 mt-2 p-3 rounded-lg border border-primary/20 bg-primary/5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xl shrink-0 border border-primary/10">
                {activeBotInfo.avatar || '🤖'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-primary" />
                  {activeBotInfo.name}
                </div>
                {activeBotInfo.description && (
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{activeBotInfo.description}</p>
                )}
              </div>
              <button
                onClick={() => state.setActiveBotId(null)}
                className="p-1 rounded hover:bg-muted text-muted-foreground"
                title="退出 Bot"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ★ Bot P0: 开场引导消息 */}
          {activeBotInfo && messages.length === 0 && !botStartersDismissed &&
           activeBotInfo.starterMessages?.length > 0 && (
            <div className="mx-4 mt-3 flex flex-wrap gap-2">
              {activeBotInfo.starterMessages.map((msg: string, i: number) => (
                <button
                  key={i}
                  onClick={() => {
                    setBotStartersDismissed(true);
                    handleSendMessage(msg);
                  }}
                  className="px-3 py-2 text-sm rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all text-left max-w-[280px] truncate"
                >
                  {msg}
                </button>
              ))}
            </div>
          )}


          <ChatToolbar state={state} handleCreateConversation={handleCreateConversation} />

          <div className="flex gap-4 flex-1 min-h-0">

            {/* 消息渲染区 + 输入框 */}
            <MessageList
              state={enhancedState}
              handleSendMessage={handleSendMessage}
              handleStopStreaming={handleStopStreaming}
              handleImageDownload={handleImageDownload}
              handleFileUpload={handleFileUpload}
              handleImageUpload={handleImageUpload}
              retryUpload={retryUpload}
              loadConversationMessages={loadConversationMessages}
              normalizeImageUrl={normalizeImageUrl}
              extractImagesFromMarkdown={extractImagesFromMarkdown}
            />

            {/* ★ Agent 浏览器操作面板 */}
            {agentMode.status !== "inactive" && (
              <div className="px-4 pb-2">
                <ChatAgentPanel
                  steps={agentMode.steps}
                  status={agentMode.status}
                  confirmation={agentMode.confirmation}
                  onConfirm={() => {
                    agentMode.handleConfirm();
                    handleSendMessage("确认执行");
                  }}
                  onReject={() => {
                    agentMode.handleReject();
                    handleSendMessage("取消操作");
                  }}
                  onClose={agentMode.handleClose}
                  error={agentMode.error}
                />
              </div>
            )}

            {/* ★ 云端桌面控制面板 (Computer Use) */}
            {desktopState.status !== 'inactive' && (
              <div className="px-4 pb-2">
                <CloudDesktopViewer
                  viewerUrl={desktopState.viewerUrl}
                  screenshot={desktopState.screenshot}
                  screenWidth={desktopState.screenWidth}
                  screenHeight={desktopState.screenHeight}
                  status={desktopState.status as any}
                  statusMessage={desktopState.statusMessage}
                  steps={desktopState.steps}
                  onClose={() => setDesktopState({ status: 'inactive', steps: [] })}
                />
              </div>
            )}
          </div>
          {/* 免责声明 — 移动端仅空对话时显示，桌面端始终显示 */}
          {(!isMobile || messages.length === 0) && (
          <div className="text-center py-1 md:py-1.5">
            <span className="text-[11px] text-muted-foreground/40">AI 工具，其回答未必正确无误，请注意甄别</span>
          </div>
          )}
        </div>

        {/* 右侧辅助面板（文件预览 / 研究任务 / Artifact 预览） */}
        {(activeResearchTaskId || previewFile || activeArtifact) && (
          <RightSidePanel
            title={activeResearchTaskId ? t('chat.research.sandbox') : activeArtifact ? (activeArtifact.title || '界面预览') : '文件预览'}
            defaultCollapsed={false}
            noPadding={true}
          >
            {activeResearchTaskId ? (
              <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-3 px-1">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm font-medium">
                      {t('chat.research.taskLabel', { id: activeResearchTaskId })}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveResearchTaskId(null)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
                  >
                    {t('chat.research.backToThinking')}
                  </button>
                </div>
                <div className="flex-1 min-h-0">
                  {isReconnecting && !sandboxData?.isConnected && (
                    <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-950/30 border-b border-blue-200 dark:border-blue-800 text-xs text-blue-700 dark:text-blue-300">
                      <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" opacity="0.3"/><path d="M12 2a10 10 0 019.95 9" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
                      正在恢复任务现场...
                    </div>
                  )}
                  {sandboxData && (
                    <SandboxPanel
                      browser={sandboxData.browser}
                      code={sandboxData.code}
                      terminal={sandboxData.terminal}
                      activeTab={sandboxActiveTab}
                      onTabChange={setSandboxActiveTab}
                      isConnected={sandboxData.isConnected}
                      taskId={activeResearchTaskId}
                      socket={sandboxData.socket}
                      clickIndicator={sandboxData.clickIndicator}
                      screenshotTimeout={sandboxData.screenshotTimeout}
                      pendingConfirmation={sandboxData.pendingConfirmation}
                      onConfirmationResolved={() => sandboxData.setPendingConfirmation(null)}
                      cursorPosition={sandboxData.cursorPosition}
                      browserTabs={sandboxData.browserTabs}
                      helpNeeded={sandboxData.helpNeeded}
                      onHelpDismiss={() => sandboxData.setHelpNeeded(null)}
                    />
                  )}
                </div>
              </div>
            ) : activeArtifact ? (
              <div className="h-full flex flex-col overflow-hidden">
                <ArtifactCard
                  artifact={activeArtifact}
                  fillHeight
                  onApprove={() => {
                    setActiveArtifact({ ...activeArtifact, status: 'approved' });
                    // 同步到消息
                    const { setMessages } = state;
                    setMessages((prev: any[]) => {
                      const newMsgs = [...prev];
                      for (let i = newMsgs.length - 1; i >= 0; i--) {
                        if ((newMsgs[i] as any).artifact?.id === activeArtifact.id) {
                          (newMsgs[i] as any).artifact = { ...(newMsgs[i] as any).artifact, status: 'approved' };
                          break;
                        }
                      }
                      return newMsgs;
                    });
                  }}
                  onIterate={(feedback) => {
                    const { chatInputRef } = state as any;
                    if (chatInputRef?.current) {
                      chatInputRef.current.setInput(`请调整上面的预览效果：${feedback}`);
                      chatInputRef.current.focus();
                    }
                  }}
                  onCanvasAction={(prompt) => {
                    const { chatInputRef } = state as any;
                    if (chatInputRef?.current) {
                      chatInputRef.current.setInput(prompt);
                      chatInputRef.current.focus();
                    }
                  }}
                  onCodeChange={(code) => {
                    // 同步手动编辑的代码到 activeArtifact
                    setActiveArtifact({ ...activeArtifact, code });
                  }}
                  onExport={() => {}}
                />
              </div>
            ) : (
              <FilePreviewPanel
                fileName={previewFile?.name}
                content={previewFile?.content}
                isLive={previewFile?.isLive}
                onClose={() => setPreviewFile(null)}
                files={previewFiles}
                activeFileIndex={activePreviewIndex}
                onFileSelect={(index) => {
                  setActivePreviewIndex(index);
                  const file = previewFiles[index];
                  if (file) setPreviewFile(file);
                }}
                onFileClose={(index) => {
                  // 关闭单个文件 Tab
                  const newFiles = previewFiles.filter((_, i) => i !== index);
                  if (newFiles.length === 0) {
                    setPreviewFile(null);
                  } else {
                    const newIdx = Math.min(activePreviewIndex, newFiles.length - 1);
                    setActivePreviewIndex(newIdx);
                    setPreviewFile(newFiles[newIdx]);
                  }
                }}
              />
            )}
          </RightSidePanel>
        )}
      </div>

{/* ═══════ 移动端沙箱底部抽屉 ═══════ */}
        {sandboxData && (
          <MobileSandboxSheet
            browser={sandboxData.browser}
            code={sandboxData.code}
            terminal={sandboxData.terminal}
            activeTab={sandboxActiveTab}
            onTabChange={setSandboxActiveTab}
            isConnected={sandboxData.isConnected}
            taskId={activeResearchTaskId}
            socket={sandboxData.socket}
            isActive={!!activeResearchTaskId}
            pendingConfirmation={sandboxData.pendingConfirmation}
            onConfirmationResolved={() => sandboxData.setPendingConfirmation(null)}
            cursorPosition={sandboxData.cursorPosition}
            browserTabs={sandboxData.browserTabs}
            helpNeeded={sandboxData.helpNeeded}
            onHelpDismiss={() => sandboxData.setHelpNeeded(null)}
          />
        )}
      {/* ═══════ 移动端 Artifact 通知条 + 全屏预览（xl 以下） ═══════ */}
      {/* ★ 修复：不再自动全屏，始终先显示通知条，用户主动点击后才全屏 */}
      {activeArtifact && !mobileArtifactOpen && (
        <div className="xl:hidden fixed bottom-20 left-4 right-4 z-[55] bg-background/95 backdrop-blur border border-border rounded-xl shadow-lg px-4 py-3">
          <div className="flex items-center justify-between">
            <div
              className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
              onClick={() => {
                if (activeArtifact.status === 'complete' || activeArtifact.status === 'approved') {
                  setMobileArtifactOpen(true);
                }
              }}
            >
              {activeArtifact.status === 'streaming' ? (
                <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
              ) : (
                <Sparkles className="w-4 h-4 text-primary shrink-0" />
              )}
              <span className="text-sm font-medium truncate">{activeArtifact.title || '界面预览'}</span>
              {activeArtifact.status === 'streaming' ? (
                <span className="text-xs text-muted-foreground">生成中...</span>
              ) : (
                <span className="text-xs text-primary font-medium">点击查看预览 →</span>
              )}
            </div>
            <button
              onClick={() => setActiveArtifact(null)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted ml-2 shrink-0"
            >
              关闭
            </button>
          </div>
        </div>
      )}
      {activeArtifact && mobileArtifactOpen && (
        <div className="xl:hidden fixed inset-0 z-[55]">
          {/* 半透明遮罩（点击可关闭，跟随拖拽透明度变化） */}
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-[2px]"
            style={{ opacity: sheetDragY > 0 ? Math.max(0.1, 1 - sheetDragY / 300) : 1 }}
            onClick={closeMobileArtifact}
          />
          {/* 卡片主体 — 从 top-[60px] 开始，支持下滑手势 */}
          <div
            className="absolute inset-x-0 bottom-0 top-[60px] flex flex-col bg-card rounded-t-2xl shadow-2xl border-t border-x border-border overflow-hidden"
            style={{
              transform: sheetDragY > 0 ? `translateY(${sheetDragY}px)` : undefined,
              transition: sheetDragging ? 'none' : 'transform 0.3s ease-out',
            }}
            onTouchStart={handleSheetTouchStart}
            onTouchMove={handleSheetTouchMove}
            onTouchEnd={handleSheetTouchEnd}
          >
            {/* ── 顶部拖拽条 ── */}
            <div className="flex flex-col items-center pt-2 pb-1 flex-shrink-0 cursor-grab active:cursor-grabbing">
              <div className="w-9 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            {/* ── ArtifactCard 填充剩余空间 ── */}
            <div className="flex flex-col overflow-hidden" style={{ height: 0, flexGrow: 1 }}>
              <ArtifactCard
                artifact={activeArtifact}
                fillHeight
                onClose={closeMobileArtifact}
                onApprove={() => {
                  setActiveArtifact({ ...activeArtifact, status: 'approved' });
                  const { setMessages } = state;
                  setMessages((prev: any[]) => {
                    const newMsgs = [...prev];
                    for (let i = newMsgs.length - 1; i >= 0; i--) {
                      if ((newMsgs[i] as any).artifact?.id === activeArtifact.id) {
                        (newMsgs[i] as any).artifact = { ...(newMsgs[i] as any).artifact, status: 'approved' };
                        break;
                      }
                    }
                    return newMsgs;
                  });
                }}
                onIterate={(feedback) => {
                  closeMobileArtifact();
                  const { chatInputRef } = state as any;
                  if (chatInputRef?.current) {
                    chatInputRef.current.setInput(`请调整上面的预览效果：${feedback}`);
                    chatInputRef.current.focus();
                  }
                }}
                onCanvasAction={(prompt) => {
                  closeMobileArtifact();
                  const { chatInputRef } = state as any;
                  if (chatInputRef?.current) {
                    chatInputRef.current.setInput(prompt);
                    chatInputRef.current.focus();
                  }
                }}
                onCodeChange={(code) => {
                  setActiveArtifact({ ...activeArtifact, code });
                }}
                onExport={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      {/* 弹窗/浮层集合 */}
      <ChatDialogs
        state={state}
        handleSendMessage={handleSendMessage}
        handleImageDownload={handleImageDownload}
      />
    </DashboardLayout>
  );
}
