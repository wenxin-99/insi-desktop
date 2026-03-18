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

import { useEffect, useRef } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Image as ImageIcon, Sparkles } from 'lucide-react';
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
// ── Components ──
import {
  ChatToolbar,
  ConversationList,
  MessageList,
  ChatDialogs,
} from './chat/components';

export default function Chat() {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  // ═══════════ 1. 全局状态 ═══════════
  const state = useChatState();

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

  // ═══════════ 6. 副作用（useEffect 集合） ═══════════
  useChatEffects(state, {
    loadConversationMessages,
    handleSendMessage,
    saveToMessageCache,
    generateSuggestedQuestions,
  });

useReplyNotification({ isStreaming: state.isStreaming, isResearchMode: state.isResearchMode });
  // ═══════════ 7. URL 参数：从语音对话返回时自动恢复对话 ═══════════
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
          <ChatToolbar state={state} handleCreateConversation={handleCreateConversation} />

          <div className="flex gap-4 flex-1 min-h-0">
            {/* 左侧对话列表（移动端抽屉 + 桌面端侧边栏） */}
            <ConversationList
              state={state}
              handleCreateConversation={handleCreateConversation}
              handleDeleteConversation={handleDeleteConversation}
              handleExportConversation={handleExportConversation}
              handleExportPdf={handleExportPdf}
              handleShareConversation={handleShareConversation}
              loadConversationMessages={loadConversationMessages}
            />

            {/* 消息渲染区 + 输入框 */}
            <MessageList
              state={state}
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
                    />
                  )}
                </div>
              </div>
            ) : activeArtifact ? (
              <div className="h-full flex flex-col">
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
          />
        )}
      {/* ═══════ 移动端 Artifact 全屏预览（xl 以下） ═══════ */}
      {activeArtifact && (
        <div className="xl:hidden fixed inset-0 z-[55] bg-background flex flex-col">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
            <div className="flex items-center gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm font-semibold truncate">{activeArtifact.title || '界面预览'}</span>
            </div>
            <button
              onClick={() => setActiveArtifact(null)}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 rounded hover:bg-muted"
            >
              关闭
            </button>
          </div>
          <div className="flex-1 min-h-0 overflow-hidden">
            <ArtifactCard
              artifact={activeArtifact}
              fillHeight
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
                setActiveArtifact(null);
                const { chatInputRef } = state as any;
                if (chatInputRef?.current) {
                  chatInputRef.current.setInput(`请调整上面的预览效果：${feedback}`);
                  chatInputRef.current.focus();
                }
              }}
              onExport={() => {}}
            />
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
