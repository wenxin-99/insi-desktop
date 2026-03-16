/**
 * useSendMessage — 消息发送核心 Hook（已模块化）
 *
 * 子 hooks：
 *   useMessageUtils      - normalizeImageUrl, extractImagesFromMarkdown, generateSuggestedQuestions
 *   useIntentDetectors   - 图片/研究/视频意图检测和处理
 *   useMessageBuilder    - 多模态消息内容构建
 *   useStreamCallbacks   - SSE 流式回调
 */
import { toast } from 'sonner';
import { streamManager } from '@/lib/backgroundStreamManager';
import { saveOperationLogs } from '@/lib/operationLogStorage';
import type { ThinkingStep } from '@/components/ThinkingProcessPanel';
import type { ChatStateReturn } from '../types';
import { useMessageUtils } from './useMessageUtils';
import { useIntentDetectors } from './useIntentDetectors';
import { useMessageBuilder } from './useMessageBuilder';
import { useStreamCallbacks } from './useStreamCallbacks';

export function useSendMessage(state: ChatStateReturn) {
  const {
    t, messages, setMessages, nextMsgId,
    selectedConversationId, setSelectedConversationId,
    selectedModelId, selectedPackageId,
    message, setMessage,
    uploadedImages, setUploadedImages,
    uploadedFiles, setUploadedFiles,
    isUploading,
    isResearchMode, setIsResearchMode,
    setIsStartingResearch, isStartingResearch,
    setActiveResearchTaskId,
    sendStreamMessage, resetStream,
    setIsStreamingMessage,
    setSuggestedQuestions,
    setHasInputContent,
    setShowTaskLimitBanner,
    setCollapsedDescriptions,
    setCurrentThinkingSteps, setRealtimeThinkingSteps,
    setThinkingStartTime, setElapsedThinkingTime,
    setThinkingStage, setThinkingModelName,
    setReasoningContent,
    setOperationLogs,
    setPreviewFile,
    startThinking, onStreamStart, onStreamComplete,
    messagesEndRef, chatInputRef,
    sendingGuardRef, userScrolledUpRef,
    hasDetectedToolCallRef, streamedContentRef,
    streamingForConvIdRef, selectedConvIdRef,
    operationLogsRef, initialLoadDoneRef,
    lastFileNameRef, previewOpenedRef,
    modelPackages, chatModels, currentUser,
    createConversationMutation,
    refetchConversations, refetchBalance,
    detectVideoIntentMutation,
    startResearchMutation,
    generateTitleMutation,
    generateSuggestedQuestionsMutation,
    exportContentPdfMutation,
    generateDocumentMutation,
    streamedContent,
    clearDraft,
    isTtsAutoMode, streamingTts,
    playingTtsIndex, setPlayingTtsIndex,
    thinkingMode,
    currentThinkingSteps,
    userCity,
    selectedAspectRatio,
  } = state;


  // ═══ 子 Hook 组合 ═══
  const { normalizeImageUrl, extractImagesFromMarkdown, generateSuggestedQuestions } = useMessageUtils(state);
  const { _handleResearchMode, _detectImageIntent, _detectResearchIntent, _handleAutoResearch, _handleVideoIntent } = useIntentDetectors(state);
  const { _buildMessageContent } = useMessageBuilder(state);
  const { _buildStreamCallbacks } = useStreamCallbacks(state);

  // ═══ 核心发送逻辑 ═══
  const handleSendMessage = async (
    messageText?: string,
    resendImages?: Array<{ url: string; name: string; progress?: number }>,
    resendFiles?: Array<{ url: string; name: string; size: number }>,
    isRegenerate?: boolean
  ) => {

    // ── 防重复提交 ──
    if (sendingGuardRef.current) { console.log('[Chat] Blocked duplicate send'); return; }
    sendingGuardRef.current = true;
    setTimeout(() => { sendingGuardRef.current = false; }, 500);

    if (isUploading) { toast.warning('文件正在上传中，请等待上传完成后再发送'); return; }

    const textToSend = messageText !== undefined ? messageText : message;
    const effectiveFiles = resendFiles ?? uploadedFiles;
    setSuggestedQuestions([]);

    if (!textToSend.trim() && (resendImages ?? uploadedImages).length === 0 && effectiveFiles.length === 0) {
      toast.error(t('chat.inputPlaceholder'));
      return;
    }

    // ═══════════ 1. 联网代理模式 ═══════════
    if (isResearchMode) {
      await _handleResearchMode(textToSend, resendImages);
      return;
    }

    // ═══════════ 2. 图片生成意图检测 ═══════════
    const imageIntentResult = _detectImageIntent(textToSend, resendImages);
    const { hasImageGenerationIntent, hasImageEditIntent, enhancedMessage, shouldIgnoreUploadedImages } = imageIntentResult;

    // ═══════════ 3. 智能联网代理意图检测 ═══════════
    const hasResearchIntent = _detectResearchIntent(textToSend, effectiveFiles);
    if (hasResearchIntent && !isResearchMode) {
      await _handleAutoResearch(textToSend);
      return;
    }

    // ═══════════ 4. 视频生成意图检测 ═══════════
    const videoHandled = await _handleVideoIntent(textToSend, effectiveFiles);
    if (videoHandled) return;

    // ═══════════ 5. 自动创建对话 ═══════════
    let conversationId = selectedConversationId;
    if (!conversationId) {
      try {
        const newConv = await new Promise<{ id: number }>((resolve, reject) => {
          createConversationMutation.mutate(
            {
              modelId: selectedModelId || currentUser?.preferredModelId || chatModels?.[0]?.id || 1,
              title: '新对话',
              packageId: selectedPackageId || undefined,
            },
            { onSuccess: resolve, onError: reject }
          );
        });
        conversationId = newConv.id;
        setSelectedConversationId(newConv.id);
        initialLoadDoneRef.current = true;
        await refetchConversations();
      } catch {
        toast.error('创建对话失败');
        return;
      }
    }

    if (!selectedModelId && !selectedPackageId) { toast.error('请选择AI模型或模型套餐'); return; }

    // ═══════════ 6. 并发/限制检查 ═══════════
    const currentPackage = modelPackages?.find((p: any) => p.id === selectedPackageId);
    const maxConcurrent = currentPackage?.maxConcurrentTasks ?? 3;
    if (streamManager.getRunningTasks().length >= maxConcurrent) {
      setShowTaskLimitBanner(true);
      return;
    }
    const maxMessages = currentPackage?.maxMessagesPerConversation ?? 50;
    if (messages.length >= maxMessages) {
      toast.error(`当前对话已达到 ${maxMessages} 条消息上限，请开启新对话继续`);
      return;
    }

    // 检查上传状态
    const stillUploading = uploadedImages.filter((img: any) => img.url?.startsWith('blob:') || (img.progress !== undefined && img.progress < 100));
    if (stillUploading.length > 0) { toast.error('图片正在上传中，请等待上传完成后再发送'); return; }
    const filesStillUploading = (resendFiles ?? uploadedFiles).filter((f: any) => f.progress !== undefined || f.url?.startsWith('blob:') || (!f.url && !f.error));
    if (filesStillUploading.length > 0) { toast.error('文件正在上传中，请等待上传完成后再发送'); return; }

    // ═══════════ 7. 构建消息内容 ═══════════
    const effectiveImages = resendImages ?? uploadedImages;
    const { messageContent, userMessageForDisplay, userMessageForAPI, displayContent } =
      _buildMessageContent(textToSend, enhancedMessage, effectiveImages, effectiveFiles, shouldIgnoreUploadedImages, hasImageGenerationIntent, hasImageEditIntent);

    // 添加用户消息到UI
    if (!isRegenerate) setMessages((prev) => [...prev, userMessageForDisplay]);
    userScrolledUpRef.current = false;
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 100);

    // 清空输入
    if (!isRegenerate) {
      setMessage('');
      setUploadedImages([]);
      setUploadedFiles([]);
      clearDraft();
    }

    // ═══════════ 8. 流式传输 ═══════════
    setIsStreamingMessage(true);
    streamingForConvIdRef.current = conversationId;
    setThinkingStartTime(Date.now());
    setElapsedThinkingTime(0);
    startThinking();

    const hasImages = effectiveImages.length > 0;
    const initialAssistantContent = hasImages
      ? `🔍 正在识别图片${effectiveImages.length > 1 ? `（${effectiveImages.length}张）` : ''}…`
      : hasImageGenerationIntent ? '🎨 正在为您生成图片，请稍候…' : '';

    setMessages((prev) => [...prev, { id: nextMsgId(), role: 'assistant', content: initialAssistantContent, timestamp: Date.now() }]);
    setTimeout(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, 150);
    resetStream();

    const hasVisionContent = Array.isArray(userMessageForAPI.content) &&
      userMessageForAPI.content.some((item: any) => item.type === 'image_url');

    hasDetectedToolCallRef.current = false;
    streamedContentRef.current = '';
    if (effectiveFiles.length > 0) lastFileNameRef.current = effectiveFiles[0].name;
    else lastFileNameRef.current = null;
    previewOpenedRef.current = false;
    setPreviewFile(null);

    const apiMessages = isRegenerate
      ? [...messages.slice(0, -2), userMessageForAPI]
      : [...messages, userMessageForAPI];

    await sendStreamMessage(
      selectedModelId ?? 0,
      apiMessages,
      conversationId,
      _buildStreamCallbacks(conversationId!, effectiveImages, hasImageGenerationIntent),
      selectedPackageId ?? undefined,
      hasVisionContent,
      thinkingMode,
      userCity,
      selectedAspectRatio,
    );
  };

  // ═══════════ 内部方法：联网代理模式处理 ═══════════


  return {
    handleSendMessage,
    normalizeImageUrl,
    extractImagesFromMarkdown,
  };
}
