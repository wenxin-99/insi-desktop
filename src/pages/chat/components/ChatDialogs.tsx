/**
 * ChatDialogs — 弹窗/浮层组件集合
 * 
 * 包含：快捷键帮助、语音输入、视频生成、视频确认、标签管理、图片灯箱
 * 
 * 原始位置: Chat.tsx L5916-6041
 */

import { toast } from 'sonner';
import KeyboardShortcutsHelp from '@/components/KeyboardShortcutsHelp';
import { VoiceInputDialog } from '@/components/VoiceInputDialog';
import { VideoGenerationDialog } from '@/components/VideoGenerationDialog';
import { VideoConfirmDialog } from '@/components/VideoConfirmDialog';
import { TagManagementDialog } from '@/components/TagManagementDialog';
import { ImageLightbox } from '@/components/ImageLightbox';
import type { ChatStateReturn } from '../types';

interface ChatDialogsProps {
  state: ChatStateReturn;
  handleSendMessage: (text?: string) => void;
  handleImageDownload: (url: string, name: string) => Promise<void>;
}

export function ChatDialogs({ state, handleSendMessage, handleImageDownload }: ChatDialogsProps) {
  const {
    showShortcutsHelp, setShowShortcutsHelp,
    voiceDialogOpen, setVoiceDialogOpen,
    setIsTtsAutoMode,
    chatInputRef,
    videoDialogOpen, setVideoDialogOpen,
    selectedConversationId, setSelectedConversationId,
    videoConfirmOpen, setVideoConfirmOpen,
    videoConfirmParams,
    balance, refetchBalance,
    isGeneratingVideo, setIsGeneratingVideo,
    selectedModelId, selectedPackageId,
    currentUser, chatModels,
    createConversationMutation,
    generateVideoMutation,
    saveMessagesMutation,
    initialLoadDoneRef,
    refetchConversations,
    setMessages, setMessage,
    showTagManagement, setShowTagManagement,
    managingTagsForConversation,
    lightboxOpen, setLightboxOpen,
    lightboxImages, lightboxIndex, setLightboxIndex,
  } = state;

  return (
    <>
      {/* 快捷键帮助 */}
      <KeyboardShortcutsHelp open={showShortcutsHelp} onOpenChange={setShowShortcutsHelp} />
      
      {/* 语音输入对话框 */}
      <VoiceInputDialog
        open={voiceDialogOpen}
        onOpenChange={setVoiceDialogOpen}
        packageId={selectedPackageId ?? undefined}
        onTranscribed={(text: string) => {
          setVoiceDialogOpen(false);
          // 语音输入：直接发送消息，并开启TTS自动朗读模式
          setIsTtsAutoMode(true);
          chatInputRef.current?.setInput(text);
          // 短暂延迟确保输入框更新后再发送
          setTimeout(() => {
            handleSendMessage(text);
            chatInputRef.current?.setInput('');
          }, 50);
        }}
      />

      {/* 视频生成对话框 */}
      <VideoGenerationDialog
        open={videoDialogOpen}
        onOpenChange={setVideoDialogOpen}
        conversationId={selectedConversationId}
      />

      {/* 视频生成确认对话框 */}
      {videoConfirmParams && (
        <VideoConfirmDialog
          open={videoConfirmOpen}
          onOpenChange={setVideoConfirmOpen}
          videoParams={videoConfirmParams}
          balance={parseFloat(balance?.balance || '0')}
          cost={videoConfirmParams.duration === 5 ? 30 : 50}
          onConfirm={async (params: any) => {
            setVideoConfirmOpen(false);
            setIsGeneratingVideo(true);
            try {
              // 确保有对话ID（首页触发时自动创建）
              let convId = selectedConversationId;
              if (!convId) {
                const newConv = await new Promise<{ id: number }>((resolve, reject) => {
                  createConversationMutation.mutate(
                    {
                      modelId: selectedModelId || currentUser?.preferredModelId || chatModels?.[0]?.id || 1,
                      title: params.prompt.slice(0, 30) || '视频生成',
                      packageId: selectedPackageId || undefined,
                    },
                    { onSuccess: resolve, onError: reject }
                  );
                });
                convId = newConv.id;
                setSelectedConversationId(newConv.id);
                initialLoadDoneRef.current = true;
                await refetchConversations();
              }

              // 确保duration为5或10
              const videoParams = {
                ...params,
                duration: (params.duration === 10 ? 10 : 5) as 5 | 10,
                packageId: selectedPackageId ?? undefined,
                conversationId: convId ?? undefined,
              };
              const result = await generateVideoMutation.mutateAsync(videoParams);
              
              // 构建要保存的消息（用户意图 + 视频任务卡片）
              const userVideoMsg = {
                id: Date.now() - 1,
                role: 'user' as const,
                content: params.prompt,
                timestamp: Date.now() - 1,
              };
              const videoTaskMessage = {
                id: Date.now(),
                role: 'assistant' as const,
                content: `<VideoTaskCard taskId="${result.taskId}" prompt="${params.prompt.replace(/"/g, '&quot;')}" />`,
                timestamp: Date.now(),
                isVideoTask: true,
                videoTaskId: result.taskId,
                videoPrompt: params.prompt,
              };
              
              setMessages((prev: any) => {
                const hasUserMsg = prev.some((m: any) => m.role === 'user' && m.content === params.prompt);
                const updated = [...prev, ...(hasUserMsg ? [] : [userVideoMsg]), videoTaskMessage];
                saveMessagesMutation.mutate({
                  conversationId: convId!,
                  messages: JSON.stringify(updated.filter((m: any) => m.role !== 'system')),
                });
                return updated;
              });
              
              toast.success(`视频生成任务已创建！任务ID: ${result.taskId}`);
              setMessage('');
              refetchBalance();
            } catch (error: any) {
              toast.error(error.message || '视频生成失败');
            } finally {
              setIsGeneratingVideo(false);
            }
          }}
          isGenerating={isGeneratingVideo}
        />
      )}
      
      {/* 标签管理对话框 */}
      <TagManagementDialog
        open={showTagManagement}
        onOpenChange={setShowTagManagement}
        conversationId={managingTagsForConversation}
      />
      
      {/* 图片灯箱预览 */}
      {lightboxOpen && (
        <ImageLightbox
          images={lightboxImages}
          currentIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
          onPrevious={() => setLightboxIndex((lightboxIndex - 1 + lightboxImages.length) % lightboxImages.length)}
          onNext={() => setLightboxIndex((lightboxIndex + 1) % lightboxImages.length)}
          onDownload={handleImageDownload}
        />
      )}
    </>
  );
}
