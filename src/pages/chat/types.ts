/**
 * Chat 模块共享类型定义
 * 
 * 所有 hooks 和组件共享的类型、接口定义。
 * 从原始 Chat.tsx 中提取，确保类型一致性。
 */

import type { ThinkingStep } from '@/components/ThinkingProcessPanel';
import type { ChatInputRef } from '@/components/ChatInput';

// ═══════════ 消息类型 ═══════════

export interface ChatImage {
  url: string;
  name: string;
  isPlaceholder?: boolean;
  isGenerating?: boolean;
  placeholderUrl?: string;
}

export interface ChatFile {
  url: string;
  name: string;
  size: number;
  progress?: number;
  error?: string;
  file?: File;
  id?: string;
  statusText?: string;
}

export interface UploadedImage {
  url: string;
  name: string;
  progress?: number;
  id?: string;
}

export interface FailedMessage {
  content: string;
  images?: Array<{ url: string; name: string }>;
  files?: Array<{ url: string; name: string }>;
}

/** 引用上下文（用于图片/视频结果的后续生成） */
export interface QuotedReference {
  type: 'image' | 'video' | 'message';
  /** 缩略图 URL（图片直接用原图，视频用封面或占位图） */
  thumbnailUrl?: string;
  /** 原始图片 URL 列表（图片引用时） */
  imageUrls?: Array<{ url: string; name: string }>;
  /** 视频任务 ID（视频引用时） */
  videoTaskId?: number;
  /** 原始 prompt */
  prompt?: string;
  /** 显示标签 */
  label: string;
  /** ★ P0-3: 引用的消息内容（消息引用时） */
  messageContent?: string;
  /** ★ P0-3: 引用消息的角色 */
  messageRole?: 'user' | 'assistant';
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  images?: ChatImage[];
  files?: ChatFile[];
  timestamp?: number;
  sentAt?: number;
  respondedAt?: number;
  isVideoConfirm?: boolean;
  videoConfirmParams?: any;
  isResearchTask?: boolean;
  researchTaskId?: number;
  researchPrompt?: string;
  isError?: boolean;
  failedMessage?: FailedMessage;
  // 扩展字段（运行时动态添加）
  isAutomationTask?: boolean;
  automationTaskId?: number;
  automationTaskName?: string;
  automationSiteName?: string;
  automationCompleted?: boolean;
  isVideoTask?: boolean;
  videoTaskId?: number;
  videoPrompt?: string;
  isIntentConfirm?: boolean;
  intentConfirmData?: any;
  thinkingSteps?: Array<{ id: string; content: string; timestamp: number }>;
  operationLogs?: OperationLog[];
  thinkingTime?: number;
  _displayContent?: string;
  // 文件包下载
  filePackageUrl?: string;
  // Artifact 预览（对话内实时 UI 原型）
  artifact?: ArtifactData;
  // 流式工具组件（完成后持久化到消息）
  toolComponents?: import('@/types/toolComponent').ToolComponentData[];
  // 方案选择卡片
  solutionPicker?: SolutionPickerData;
  // 分支（编辑/重新生成时保留历史版本）
  _branches?: Array<{ messages: ChatMessage[]; createdAt: number }>;
  _activeBranch?: number; // 当前激活的分支索引（0 = 当前版本，1+ = 历史分支）
}

// ═══════════ Artifact 预览 ═══════════
// ★ 从 @/types/artifact 共享（避免 components → pages/chat 循环依赖）
export type { ArtifactData, SolutionPickerData } from '@/types/artifact';

// ═══════════ 操作日志 ═══════════

export interface OperationLog {
  id: string;
  action: string;
  target?: string;
  operationStatus: 'running' | 'completed';
  timestamp: number;
  diff?: { fileName: string; before: string; after: string };
}

// ═══════════ 文件预览 ═══════════

export interface PreviewFile {
  name: string;
  content: string;
  isLive: boolean;
}

// ═══════════ 消息缓存 ═══════════

export interface MessageCacheEntry {
  messages: ChatMessage[];
  collapsedDescriptions: Set<number>;
  operationLogs: OperationLog[];
  activeResearchTaskId?: number | null;
  timestamp: number;
}

// ═══════════ 对话限制信息 ═══════════

export interface ConversationLimitInfo {
  isAtLimit: boolean;
  currentCount: number;
  maxMessages: number;
  remaining: number;
}

// ═══════════ SSE 回调事件 ═══════════

export interface StreamCallbacks {
  onStart?: (data: any) => void;
  onContent?: (content: string) => void;
  onFallback?: (data: any) => void;
  onThinking?: (data: any) => void;
  onReasoningContent?: (data: any) => void;
  onThinkingStage?: (data: any) => void;
  onOperation?: (data: any) => void;
  onAutomationTask?: (data: any) => void;
  onIntentConfirm?: (data: any) => void;
  onImagePlaceholder?: (data: any) => void;
  onImage?: (data: any) => void;
  onFilePreview?: (data: { fileName: string; action: 'create' | 'modify' | 'delete'; newContent?: string; oldContent?: string; timestamp: number }) => void;
  onDone?: (data: any) => void;
  onError?: (error: string) => void;
}

// ═══════════ 思考阶段 ═══════════

export type ThinkingStageType = 'idle' | 'reasoning' | 'generating' | 'error';

// ═══════════ 视频确认参数 ═══════════

export interface VideoConfirmParams {
  prompt: string;
  imageUrl?: string;
  isVideoRequest?: boolean;
  confidence?: string;
  [key: string]: any;
}

// ═══════════ Hook 返回类型集合 ═══════════

/** useChatState 返回的所有状态 */
export interface ChatStateReturn {
  // 翻译
  t: (key: string, opts?: any) => string;
  utils: any;
  trpcClient: any;
  
  // 侧边栏
  isSidebarOpen: boolean;
  
  // 对话选择
  selectedConversationId: number | null;
  setSelectedConversationId: (id: number | null) => void;
  selectedModelId: number | null;
  setSelectedModelId: (id: number | null) => void;
  selectedPackageId: number | null;
  setSelectedPackageId: (id: number | null) => void;
  
  // 项目上下文
  currentProjectId: number | null;
  setCurrentProjectId: (id: number | null) => void;
  
  // 消息
  message: string;
  setMessage: (msg: string) => void;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  nextMsgId: () => string;
  
  // UI 状态
  showShortcutsHelp: boolean;
  setShowShortcutsHelp: (v: boolean) => void;
  showMobileSidebar: boolean;
  setShowMobileSidebar: (v: boolean) => void;
  voiceDialogOpen: boolean;
  setVoiceDialogOpen: (v: boolean) => void;
  lightboxOpen: boolean;
  setLightboxOpen: (v: boolean) => void;
  lightboxImages: Array<{ url: string; name: string }>;
  setLightboxImages: (imgs: Array<{ url: string; name: string }>) => void;
  lightboxIndex: number;
  setLightboxIndex: (i: number) => void;
  isDragging: boolean;
  setIsDragging: (v: boolean) => void;
  showTagManagement: boolean;
  setShowTagManagement: (v: boolean) => void;
  selectedTags: number[];
  setSelectedTags: (tags: number[]) => void;
  managingTagsForConversation: number | null;
  setManagingTagsForConversation: (id: number | null) => void;
  videoDialogOpen: boolean;
  setVideoDialogOpen: (v: boolean) => void;
  videoConfirmOpen: boolean;
  setVideoConfirmOpen: (v: boolean) => void;
  videoConfirmParams: VideoConfirmParams | null;
  setVideoConfirmParams: (p: any) => void;
  isGeneratingVideo: boolean;
  setIsGeneratingVideo: (v: boolean) => void;
  isProcessingIntent: boolean;
  setIsProcessingIntent: (v: boolean) => void;
  showThinkingPanel: boolean;
  setShowThinkingPanel: (v: boolean) => void;
  isHistoryCollapsed: boolean;
  setIsHistoryCollapsed: (v: boolean) => void;
  showScrollToBottom: boolean;
  setShowScrollToBottom: (v: boolean) => void;
  showTaskLimitBanner: boolean;
  setShowTaskLimitBanner: (v: boolean) => void;
  showStyleSelector: boolean;
  setShowStyleSelector: (v: boolean) => void;
  hasInputContent: boolean;
  setHasInputContent: (v: boolean) => void;
  isLoadingMessages: boolean;
  setIsLoadingMessages: (v: boolean) => void;
  
  // 上传
  uploadedImages: UploadedImage[];
  setUploadedImages: React.Dispatch<React.SetStateAction<UploadedImage[]>>;
  uploadedFiles: ChatFile[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<ChatFile[]>>;
  uploadingImageId: string | null;
  setUploadingImageId: (id: string | null) => void;
  isUploading: boolean;
  
  // 引用
  quotedRef: QuotedReference | null;
  setQuotedRef: React.Dispatch<React.SetStateAction<QuotedReference | null>>;
  
  // 流式状态
  isStreamingMessage: boolean;
  setIsStreamingMessage: (v: boolean) => void;
  streamedContent: string;
  isStreaming: boolean;
  sendStreamMessage: any;
  resetStream: () => void;
  abortStream: (() => void) | null;
  
  // ★ P1-1: 排队追问
  pendingMessages: string[];
  setPendingMessages: React.Dispatch<React.SetStateAction<string[]>>;
  pendingMessagesRef: React.MutableRefObject<string[]>;
  setStreamOptions: any;
  
  // 研究模式
  isResearchMode: boolean;
  setIsResearchMode: (v: boolean) => void;
  isStartingResearch: boolean;
  setIsStartingResearch: (v: boolean) => void;
  activeResearchTaskId: number | null;
  setActiveResearchTaskId: (id: number | null) => void;
  
  // 沙箱
  sandboxActiveTab: 'browser' | 'code' | 'terminal';
  setSandboxActiveTab: (tab: 'browser' | 'code' | 'terminal') => void;
  sandboxData: any;
  
  // 后台任务
  backgroundTaskCount: number;
  runningTaskCount: number;
  isConversationRunning: boolean;
  
  // 思考状态
  simulatedSteps: any[];
  startThinking: () => void;
  onStreamStart: () => void;
  onStreamComplete: () => void;
  resetSimulatedThinking: () => void;
  thinkingStartTime: number | null;
  setThinkingStartTime: (t: number | null) => void;
  elapsedThinkingTime: number;
  setElapsedThinkingTime: (t: number) => void;
  currentThinkingSteps: Array<{ id: string; content: string; timestamp: number }>;
  setCurrentThinkingSteps: React.Dispatch<React.SetStateAction<Array<{ id: string; content: string; timestamp: number }>>>;
  realtimeThinkingSteps: ThinkingStep[];
  setRealtimeThinkingSteps: React.Dispatch<React.SetStateAction<ThinkingStep[]>>;
  thinkingMode: boolean;
  setThinkingMode: (v: boolean) => void;
  autoMode: boolean;
  setAutoMode: (v: boolean) => void;
  reasoningContent: string;
  setReasoningContent: React.Dispatch<React.SetStateAction<string>>;
  thinkingStage: ThinkingStageType;
  setThinkingStage: (s: ThinkingStageType) => void;
  thinkingModelName: string;
  setThinkingModelName: (n: string) => void;
  
  // 操作日志
  operationLogs: OperationLog[];
  setOperationLogs: React.Dispatch<React.SetStateAction<OperationLog[]>>;
  operationLogsRef: React.MutableRefObject<OperationLog[]>;
  
  // 图片生成阶段
  imageGenStage: { stage: string; prompt?: string; error?: string; errorType?: string; timestamp: number } | null;
  setImageGenStage: React.Dispatch<React.SetStateAction<{ stage: string; prompt?: string; error?: string; errorType?: string; timestamp: number } | null>>;
  imageGenProgress: { attempt: number; maxAttempts: number; status: string; timestamp: number } | null;
  setImageGenProgress: React.Dispatch<React.SetStateAction<{ attempt: number; maxAttempts: number; status: string; timestamp: number } | null>>;
  // 轻量联网搜索
  webSearchQuery: string | null;
  setWebSearchQuery: React.Dispatch<React.SetStateAction<string | null>>;
  // 流式工具组件
  activeToolComponents: import('@/types/toolComponent').ToolComponentData[];
  setActiveToolComponents: React.Dispatch<React.SetStateAction<import('@/types/toolComponent').ToolComponentData[]>>;
  // 用户位置（IP 定位 + 记忆兜底）
  userCity: string | null;
  
  // 折叠
  collapsedDescriptions: Set<number>;
  setCollapsedDescriptions: React.Dispatch<React.SetStateAction<Set<number>>>;
  
  // 推荐追问
  suggestedQuestions: string[];
  setSuggestedQuestions: (q: string[]) => void;
  
  // TTS
  playingTtsIndex: number | null;
  setPlayingTtsIndex: (i: number | null) => void;
  isTtsAutoMode: boolean;
  setIsTtsAutoMode: (v: boolean) => void;
  streamingTts: any;
  handleTtsPlay: (index: number, content: string) => void;
  
  // 文件预览
  previewFile: PreviewFile | null;
  setPreviewFile: (val: PreviewFile | null | ((prev: PreviewFile | null) => PreviewFile | null)) => void;
  previewFiles: PreviewFile[];
  setPreviewFiles: React.Dispatch<React.SetStateAction<PreviewFile[]>>;
  activePreviewIndex: number;
  setActivePreviewIndex: React.Dispatch<React.SetStateAction<number>>;
  lastFileNameRef: React.MutableRefObject<string | null>;
  previewOpenedRef: React.MutableRefObject<boolean>;
  
  // 草稿
  draft: any;
  saveDraft: (input: string, files: any[]) => void;
  clearDraft: () => void;
  selectedStyle: string | null;
  setSelectedStyle: (s: string | null) => void;
  selectedAspectRatio: string | null;
  setSelectedAspectRatio: (r: string | null) => void;
  
  // ★ Bot P0
  activeBotId: number | null;
  setActiveBotId: (id: number | null) => void;
  activeBotInfo: any | null;
  isLoadingBotInfo: boolean;

  // 消息编辑
  editingMessageIndex: number | null;
  setEditingMessageIndex: (i: number | null) => void;
  editText: string;
  setEditText: (t: string) => void;
  
  // Refs
  messagesEndRef: React.RefObject<HTMLDivElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  imageInputRef: React.RefObject<HTMLInputElement>;
  chatInputRef: React.RefObject<ChatInputRef>;
  sendingGuardRef: React.MutableRefObject<boolean>;
  // ★ P1-1: 排队消费回调
  pendingSendRef: React.MutableRefObject<((text: string) => void) | null>;
  messagesContainerRef: React.RefObject<HTMLDivElement>;
  userScrolledUpRef: React.MutableRefObject<boolean>;
  hasDetectedToolCallRef: React.MutableRefObject<boolean>;
  streamedContentRef: React.MutableRefObject<string>;
  reasoningContentRef: React.MutableRefObject<string>;
  streamingForConvIdRef: React.MutableRefObject<number | null>;
  selectedConvIdRef: React.MutableRefObject<number | null>;
  messageCacheRef: React.MutableRefObject<Map<number, MessageCacheEntry>>;
  initialLoadDoneRef: React.MutableRefObject<boolean>;
  chatContainerRef: React.RefObject<HTMLDivElement>;
  
  // TRPC 查询数据
  conversations: any[] | undefined;
  refetchConversations: () => void;
  models: any[] | undefined;
  modelPackages: any[] | undefined;
  chatModels: any[] | undefined;
  balance: any;
  refetchBalance: () => void;
  isLoadingBalance: boolean;
  currentUser: any;
  
  // TRPC Mutations
  createConversationMutation: any;
  deleteConversationMutation: any;
  chatMutation: any;
  exportPdfMutation: any;
  exportContentPdfMutation: any;
  generateDocumentMutation: any;
  generateTitleMutation: any;
  updatePackageMutation: any;
  saveMessagesMutation: any;
  updatePreferenceMutation: any;
  detectVideoIntentMutation: any;
  generateVideoMutation: any;
  startResearchMutation: any;
  generateSuggestedQuestionsMutation: any;
  
  // 计算属性
  conversationLimitInfo: ConversationLimitInfo;
  CACHE_TTL: number;
}
