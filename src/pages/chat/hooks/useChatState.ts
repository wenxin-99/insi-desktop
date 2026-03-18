/**
 * useChatState — 聊天页面全局状态管理
 * 
 * 集中管理所有 useState、useRef、TRPC 查询/变更、以及派生状态。
 * 其他 hooks（useSendMessage、useConversation 等）从此 hook 获取状态。
 * 
 * 原始位置: Chat.tsx L68-213, L373-390, L1179-1275, L1315-1340
 */

import { useState, useRef, useCallback, useMemo, useSyncExternalStore, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { useSidebarOptional } from '@/components/ui/sidebar';
import { useBackgroundStream, useBackgroundTasks } from '@/hooks/useBackgroundStream';
import { useSimulatedThinking } from '@/hooks/useSimulatedThinking';
import { useUserLocation } from '@/hooks/useUserLocation';
import { useDraftManager } from '@/hooks/useDraftManager';
import { useSandboxSocket } from '@/hooks/useSandboxSocket';
import { useTTS } from '@/hooks/useTTS';
import { streamManager } from '@/lib/backgroundStreamManager';
import type { ChatInputRef } from '@/components/ChatInput';
import type { ThinkingStep } from '@/components/ThinkingProcessPanel';
import { deleteOperationLogs } from '@/lib/operationLogStorage';
import type {
  ChatMessage, ChatFile, UploadedImage, OperationLog,
  PreviewFile, MessageCacheEntry, ConversationLimitInfo,
  ThinkingStageType, ChatStateReturn, QuotedReference,
} from '../types';

export function useChatState(): ChatStateReturn {
  const { t } = useTranslation();
  const utils = trpc.useUtils();

  // ═══════════ 侧边栏 ═══════════
  const sidebarContext = useSidebarOptional();
  const isSidebarOpen = sidebarContext ? sidebarContext.state !== 'collapsed' : true;

  // ═══════════ 对话选择 ═══════════
  const [selectedConversationId, _setSelectedConversationId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedConversationId');
    return saved ? parseInt(saved, 10) : null;
  });
  const setSelectedConversationId = useCallback((id: number | null) => {
    _setSelectedConversationId(id);
    if (id !== null) {
      localStorage.setItem('selectedConversationId', String(id));
    } else {
      localStorage.removeItem('selectedConversationId');
    }
  }, []);
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(() => {
    const savedPackageId = localStorage.getItem('preferredPackageId');
    return savedPackageId ? parseInt(savedPackageId, 10) : null;
  });

  // ═══════════ 消息 ═══════════
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const msgIdCounter = useRef(0);
  const nextMsgId = useCallback(() => `msg-${++msgIdCounter.current}-${Date.now()}`, []);

  // ═══════════ UI 状态 ═══════════
  const [showShortcutsHelp, setShowShortcutsHelp] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);
  const [voiceDialogOpen, setVoiceDialogOpen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<Array<{ url: string; name: string }>>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [showTagManagement, setShowTagManagement] = useState(false);
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [managingTagsForConversation, setManagingTagsForConversation] = useState<number | null>(null);
  const [videoDialogOpen, setVideoDialogOpen] = useState(false);
  const [videoConfirmOpen, setVideoConfirmOpen] = useState(false);
  const [videoConfirmParams, setVideoConfirmParams] = useState<any>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [isProcessingIntent, setIsProcessingIntent] = useState(false);
  const [showThinkingPanel, setShowThinkingPanel] = useState(false);
  const [isHistoryCollapsed, setIsHistoryCollapsed] = useState(false);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const [showTaskLimitBanner, setShowTaskLimitBanner] = useState(false);
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [hasInputContent, setHasInputContent] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  // ═══════════ 上传 ═══════════
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [uploadedFiles, setUploadedFiles] = useState<ChatFile[]>([]);
  const [uploadingImageId, setUploadingImageId] = useState<string | null>(null);
  const [quotedRef, setQuotedRef] = useState<QuotedReference | null>(null);
  const isUploading = uploadedImages.some((img: any) => img.progress !== undefined) ||
    uploadedFiles.some((f: any) => f.progress !== undefined && !f.error);

  // ═══════════ 流式状态 ═══════════
  const [isStreamingMessage, setIsStreamingMessage] = useState(false);
  const {
    sendMessage: sendStreamMessage, isStreaming, streamedContent,
    reset: resetStream, abort: abortStream, setOptions: setStreamOptions,
  } = useBackgroundStream(selectedConversationId);
  const { runningCount: backgroundTaskCount, isRunning: isConversationRunning } = useBackgroundTasks();

  // ═══════════ 研究模式 ═══════════
  const [isResearchMode, setIsResearchMode] = useState(false);
  const [isStartingResearch, setIsStartingResearch] = useState(false);
  const [activeResearchTaskId, setActiveResearchTaskId] = useState<number | null>(null);

  // ═══════════ 沙箱 ═══════════
  const [sandboxActiveTab, setSandboxActiveTab] = useState<'browser' | 'code' | 'terminal'>('browser');
  const sandboxData = useSandboxSocket(activeResearchTaskId);

  // ═══════════ TTS ═══════════
  const { playingTtsIndex, setPlayingTtsIndex, isTtsAutoMode, setIsTtsAutoMode, streamingTts, handleTtsPlay } = useTTS(selectedPackageId);

  // ═══════════ 思考状态 ═══════════
  const { steps: simulatedSteps, startThinking, onStreamStart, onStreamComplete, reset: resetSimulatedThinking } = useSimulatedThinking();
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [elapsedThinkingTime, setElapsedThinkingTime] = useState<number>(0);
  const [currentThinkingSteps, setCurrentThinkingSteps] = useState<Array<{ id: string; content: string; timestamp: number }>>([]);
  const [realtimeThinkingSteps, setRealtimeThinkingSteps] = useState<ThinkingStep[]>([]);
  const [thinkingMode, setThinkingModeRaw] = useState(() => {
    try { return localStorage.getItem('thinkingMode') === 'true'; } catch { return false; }
  });
  const setThinkingMode = useCallback((val: boolean) => {
    setThinkingModeRaw(val);
    try { localStorage.setItem('thinkingMode', String(val)); } catch {}
  }, []);
  const [reasoningContent, setReasoningContent] = useState('');
  const [thinkingStage, setThinkingStage] = useState<ThinkingStageType>('idle');
  const [thinkingModelName, setThinkingModelName] = useState('');
  const [imageGenStage, setImageGenStage] = useState<{ stage: string; prompt?: string; error?: string; errorType?: string; timestamp: number } | null>(null);
  const [imageGenProgress, setImageGenProgress] = useState<{ attempt: number; maxAttempts: number; status: string; timestamp: number } | null>(null);
  const [webSearchQuery, setWebSearchQuery] = useState<string | null>(null);
  const userCity = useUserLocation();

  // ═══════════ 操作日志 ═══════════
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const operationLogsRef = useRef<OperationLog[]>(operationLogs);

  // ═══════════ 思考摘要（Claude 风格折叠态显示） ═══════════
  const [thinkingSummary, setThinkingSummary] = useState<string>('');

  // ═══════════ Artifact 右侧面板 ═══════════
  const [activeArtifact, setActiveArtifact] = useState<any>(null);

  // ═══════════ 折叠/推荐 ═══════════
  const [collapsedDescriptions, setCollapsedDescriptions] = useState<Set<number>>(new Set());
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);

  // ═══════════ 文件预览 ═══════════
  const [previewFile, _setPreviewFileInternal] = useState<PreviewFile | null>(null);
  const [previewFiles, setPreviewFiles] = useState<PreviewFile[]>([]);
  const [activePreviewIndex, setActivePreviewIndex] = useState(0);
  const lastFileNameRef = useRef<string | null>(null);
  const previewOpenedRef = useRef(false);

  // 包装 setPreviewFile：同时维护 previewFiles 数组
  const setPreviewFile = useCallback((valOrUpdater: PreviewFile | null | ((prev: PreviewFile | null) => PreviewFile | null)) => {
    _setPreviewFileInternal((prev) => {
      const newVal = typeof valOrUpdater === 'function' ? valOrUpdater(prev) : valOrUpdater;
      if (newVal === null) {
        // 不清空 previewFiles（历史保留），只清 active
        return null;
      }
      // 追加到 previewFiles
      setPreviewFiles(prevFiles => {
        const existingIdx = prevFiles.findIndex(f => f.name === newVal.name);
        if (existingIdx >= 0) {
          // 同名文件：更新内容
          const updated = [...prevFiles];
          updated[existingIdx] = { ...newVal };
          setActivePreviewIndex(existingIdx);
          return updated;
        }
        // 新文件：追加
        const newFiles = [...prevFiles, { ...newVal }];
        setActivePreviewIndex(newFiles.length - 1);
        return newFiles;
      });
      // 始终返回新引用，确保 React 检测到变化并重新渲染
      return { ...newVal };
    });
  }, []);

  // ═══════════ 草稿 ═══════════
  const { draft, saveDraft, clearDraft } = useDraftManager(selectedConversationId);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string | null>(null);

  // ═══════════ 消息编辑 ═══════════
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState('');

  // ═══════════ Refs ═══════════
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const chatInputRef = useRef<ChatInputRef>(null);
  const sendingGuardRef = useRef(false);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const hasDetectedToolCallRef = useRef<boolean>(false);
  const streamedContentRef = useRef<string>('');
  const reasoningContentRef = useRef<string>('');
  const streamingForConvIdRef = useRef<number | null>(null);
  const selectedConvIdRef = useRef<number | null>(selectedConversationId);
  const messageCacheRef = useRef<Map<number, MessageCacheEntry>>(new Map());
  const initialLoadDoneRef = useRef(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);

  // ═══════════ 后台任务追踪 ═══════════
  const taskSubscribe = useCallback((cb: () => void) => streamManager.onStatusChange(cb), []);
  const taskSnapshot = useCallback(() => streamManager.getRunningTasks().length, []);
  const runningTaskCount = useSyncExternalStore(taskSubscribe, taskSnapshot, taskSnapshot);

  const CACHE_TTL = 5 * 60 * 1000;

  // ═══════════ TRPC 查询 ═══════════
  const { data: conversations, refetch: refetchConversations } = trpc.conversation.getAll.useQuery();
  const { data: models } = trpc.aiModel.getAll.useQuery();
  const { data: modelPackages } = trpc.modelPackage.getAll.useQuery();
  const { data: balance, refetch: refetchBalance, isLoading: isLoadingBalance } = trpc.fishCoin.getBalance.useQuery();
  const { data: currentUser } = trpc.auth.me.useQuery();

  // 流式对话结束后自动刷新🐟币余额
  useEffect(() => {
    const unsub = streamManager.onGlobalComplete(() => {
      refetchBalance();
    });
    return unsub;
  }, [refetchBalance]);

  const chatModels = models?.filter((m: any) => m.type === 'chat' && m.enabled);

  // ═══════════ TRPC Mutations ═══════════
  const updatePreferenceMutation = trpc.auth.updatePreference.useMutation();

  const createConversationMutation = trpc.conversation.create.useMutation({
    onSuccess: (data: any) => {
      setSelectedConversationId(data.id);
      refetchConversations();
      // NOTE: 不在这里 setMessages([])，避免覆盖 handleSendMessage 添加的消息
    },
    onError: (error: any) => {
      toast.error(error.message || '创建对话失败');
    },
  });

  const deleteConversationMutation = trpc.conversation.delete.useMutation({
    onSuccess: (_, variables: any) => {
      deleteOperationLogs(variables.id.toString());
      messageCacheRef.current.delete(variables.id);
      if (variables.id === selectedConversationId) {
        setSelectedConversationId(null);
        setMessages([]);
        setOperationLogs([]);
        setThinkingSummary('');
        setActiveArtifact(null);
        // 停止所有 TTS 播放
        streamingTts.stop();
        setPlayingTtsIndex(null);
        setIsTtsAutoMode(false);
        // 清除右侧面板状态
        setPreviewFile(null);
        setPreviewFiles([]);
        setActivePreviewIndex(0);
        setActiveResearchTaskId(null);
      }
      refetchConversations();
    },
    onError: (error: any) => {
      toast.error(error.message || t('common.error'));
    },
  });

  const chatMutation = trpc.ai.chat.useMutation({
    onSuccess: (data: any) => {
      const messageContent = typeof data.message === 'string' ? data.message : JSON.stringify(data.message);
      setMessages((prev) => [...prev, { role: 'assistant', content: messageContent }]);
      refetchBalance();
    },
    onError: (error: any) => {
      toast.error(error.message || t('common.error'));
      // 移除用户消息
      setMessages((prev) => prev.slice(0, -1));
    },
  });

  const exportPdfMutation = trpc.conversation.exportPdf.useMutation();
  const exportContentPdfMutation = trpc.conversation.exportContentPdf.useMutation();
  const generateDocumentMutation = trpc.ai.generateDocument.useMutation();
  const generateTitleMutation = trpc.conversation.generateTitle.useMutation();
  const updatePackageMutation = trpc.conversation.updatePackage.useMutation();
  const saveMessagesMutation = trpc.conversation.saveMessages.useMutation();
  const detectVideoIntentMutation = trpc.videos.detectVideoIntent.useMutation();
  const generateVideoMutation = trpc.videos.generate.useMutation();
  const startResearchMutation = trpc.chatResearch.startFromChat.useMutation();
  const generateSuggestedQuestionsMutation = trpc.ai.generateSuggestedQuestions.useMutation();

  // ═══════════ 计算属性 ═══════════
  const conversationLimitInfo = useMemo<ConversationLimitInfo>(() => {
    const pkg = modelPackages?.find((p: any) => p.id === selectedPackageId);
    const maxMessages = pkg?.maxMessagesPerConversation ?? 50;
    const currentCount = messages.filter(m => m.role !== 'system').length;
    return {
      isAtLimit: currentCount >= maxMessages,
      currentCount,
      maxMessages,
      remaining: Math.max(0, maxMessages - currentCount),
    };
  }, [messages, modelPackages, selectedPackageId]);

  return {
    t, utils, isSidebarOpen,
    selectedConversationId, setSelectedConversationId,
    selectedModelId, setSelectedModelId,
    selectedPackageId, setSelectedPackageId,
    message, setMessage, messages, setMessages, nextMsgId,
    showShortcutsHelp, setShowShortcutsHelp,
    showMobileSidebar, setShowMobileSidebar,
    voiceDialogOpen, setVoiceDialogOpen,
    lightboxOpen, setLightboxOpen,
    lightboxImages, setLightboxImages,
    lightboxIndex, setLightboxIndex,
    isDragging, setIsDragging,
    showTagManagement, setShowTagManagement,
    selectedTags, setSelectedTags,
    managingTagsForConversation, setManagingTagsForConversation,
    videoDialogOpen, setVideoDialogOpen,
    videoConfirmOpen, setVideoConfirmOpen,
    videoConfirmParams, setVideoConfirmParams,
    isGeneratingVideo, setIsGeneratingVideo,
    isProcessingIntent, setIsProcessingIntent,
    showThinkingPanel, setShowThinkingPanel,
    isHistoryCollapsed, setIsHistoryCollapsed,
    showScrollToBottom, setShowScrollToBottom,
    showTaskLimitBanner, setShowTaskLimitBanner,
    showStyleSelector, setShowStyleSelector,
    hasInputContent, setHasInputContent,
    isLoadingMessages, setIsLoadingMessages,
    uploadedImages, setUploadedImages,
    uploadedFiles, setUploadedFiles,
    uploadingImageId, setUploadingImageId,
    isUploading,
    quotedRef, setQuotedRef,
    isStreamingMessage, setIsStreamingMessage,
    streamedContent, isStreaming,
    sendStreamMessage, resetStream, abortStream, setStreamOptions,
    isResearchMode, setIsResearchMode,
    isStartingResearch, setIsStartingResearch,
    activeResearchTaskId, setActiveResearchTaskId,
    sandboxActiveTab, setSandboxActiveTab, sandboxData,
    backgroundTaskCount, runningTaskCount, isConversationRunning,
    simulatedSteps, startThinking, onStreamStart, onStreamComplete, resetSimulatedThinking,
    thinkingStartTime, setThinkingStartTime,
    elapsedThinkingTime, setElapsedThinkingTime,
    currentThinkingSteps, setCurrentThinkingSteps,
    realtimeThinkingSteps, setRealtimeThinkingSteps,
    thinkingMode, setThinkingMode,
    reasoningContent, setReasoningContent,
    thinkingStage, setThinkingStage,
    thinkingModelName, setThinkingModelName,
    imageGenStage, setImageGenStage,
    imageGenProgress, setImageGenProgress,
    webSearchQuery, setWebSearchQuery,
    userCity,
    operationLogs, setOperationLogs, operationLogsRef,
    thinkingSummary, setThinkingSummary,
    activeArtifact, setActiveArtifact,
    collapsedDescriptions, setCollapsedDescriptions,
    suggestedQuestions, setSuggestedQuestions,
    playingTtsIndex, setPlayingTtsIndex,
    isTtsAutoMode, setIsTtsAutoMode,
    streamingTts, handleTtsPlay,
    previewFile, setPreviewFile,
    previewFiles, setPreviewFiles, activePreviewIndex, setActivePreviewIndex,
    lastFileNameRef, previewOpenedRef,
    draft, saveDraft, clearDraft,
    selectedStyle, setSelectedStyle,
    selectedAspectRatio, setSelectedAspectRatio,
    editingMessageIndex, setEditingMessageIndex,
    editText, setEditText,
    messagesEndRef, fileInputRef, imageInputRef, chatInputRef,
    sendingGuardRef, messagesContainerRef, userScrolledUpRef,
    hasDetectedToolCallRef, streamedContentRef, reasoningContentRef,
    streamingForConvIdRef, selectedConvIdRef,
    messageCacheRef, initialLoadDoneRef, chatContainerRef,
    conversations, refetchConversations,
    models, modelPackages, chatModels,
    balance, refetchBalance, isLoadingBalance,
    currentUser,
    createConversationMutation, deleteConversationMutation,
    chatMutation,
    exportPdfMutation, exportContentPdfMutation,
    generateDocumentMutation, generateTitleMutation,
    updatePackageMutation, saveMessagesMutation,
    updatePreferenceMutation,
    detectVideoIntentMutation, generateVideoMutation,
    startResearchMutation, generateSuggestedQuestionsMutation,
    conversationLimitInfo, CACHE_TTL,
  };
}
