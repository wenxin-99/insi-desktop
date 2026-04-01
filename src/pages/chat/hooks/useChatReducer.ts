/**
 * useChatReducer — 聊天页面状态管理
 * 
 * 将 Chat.tsx 的 51 个 useState 整合为 useReducer，
 * 分为 5 个状态组，批量更新减少重渲染。
 * 
 * 迁移方式：
 *   1. 在 Chat.tsx 顶部替换 51 个 useState 为 const [state, dispatch] = useChatReducer()
 *   2. 将 setXxx(val) 替换为 dispatch({ type: 'SET_XXX', payload: val })
 *   3. 将 xxx 替换为 state.xxx
 *   4. 逐步迁移，不需要一次性完成
 */
import { useReducer, useCallback } from 'react';
import type { ChatMessage, OperationLog, UploadingFile, UploadingImage, ThinkingStage } from '@/types/chat';
import type { ThinkingStep } from '@/types/thinking';

// ═══════════════════════════════════════════
// State 定义
// ═══════════════════════════════════════════

/** 核心对话状态 */
interface ConversationState {
  selectedConversationId: number | null;
  selectedModelId: number | null;
  selectedPackageId: number | null;
  messages: ChatMessage[];
  message: string; // 输入框内容
  isLoadingMessages: boolean;
}

/** UI 状态 */
interface UIState {
  showMobileSidebar: boolean;
  showShortcutsHelp: boolean;
  showTagManagement: boolean;
  showStyleSelector: boolean;
  showThinkingPanel: boolean;
  showScrollToBottom: boolean;
  showTaskLimitBanner: boolean;
  isHistoryCollapsed: boolean;
  isDragging: boolean;
  hasInputContent: boolean;
  collapsedDescriptions: Set<number>;
  selectedTags: number[];
  managingTagsForConversation: number | null;
  selectedStyle: string | null;
}

/** 流式传输状态 */
interface StreamState {
  isStreamingMessage: boolean;
  isProcessingIntent: boolean;
  suggestedQuestions: string[];
}

/** 文件上传状态 */
interface UploadState {
  uploadedImages: UploadingImage[];
  uploadedFiles: UploadingFile[];
  uploadingImageId: string | null;
  previewFile: { name: string; content: string; isLive: boolean } | null;
}

/** 思考模式状态 */
interface ThinkingState {
  thinkingMode: boolean;
  thinkingStage: ThinkingStage;
  thinkingModelName: string;
  thinkingStartTime: number | null;
  elapsedThinkingTime: number;
  reasoningContent: string;
  currentThinkingSteps: Array<{ id: string; content: string; timestamp: number }>;
  realtimeThinkingSteps: ThinkingStep[];
  operationLogs: OperationLog[];
}

/** Lightbox 状态 */
interface LightboxState {
  lightboxOpen: boolean;
  lightboxImages: Array<{ url: string; name: string }>;
  lightboxIndex: number;
}

/** 视频状态 */
interface VideoState {
  videoDialogOpen: boolean;
  videoConfirmOpen: boolean;
  videoConfirmParams: any;
  isGeneratingVideo: boolean;
}

/** 研究模式状态 */
interface ResearchState {
  isResearchMode: boolean;
  isStartingResearch: boolean;
  activeResearchTaskId: number | null;
  sandboxActiveTab: 'browser' | 'code' | 'terminal';
}

/** 消息编辑状态 */
interface EditState {
  editingMessageIndex: number | null;
  editText: string;
}

/** 语音状态 */
interface VoiceState {
  voiceDialogOpen: boolean;
}

/** 完整状态 */
export interface ChatState {
  conversation: ConversationState;
  ui: UIState;
  stream: StreamState;
  upload: UploadState;
  thinking: ThinkingState;
  lightbox: LightboxState;
  video: VideoState;
  research: ResearchState;
  edit: EditState;
  voice: VoiceState;
}

// ═══════════════════════════════════════════
// Actions
// ═══════════════════════════════════════════

export type ChatAction =
  // 对话
  | { type: 'SET_CONVERSATION_ID'; payload: number | null }
  | { type: 'SET_MODEL_ID'; payload: number | null }
  | { type: 'SET_PACKAGE_ID'; payload: number | null }
  | { type: 'SET_MESSAGES'; payload: ChatMessage[] }
  | { type: 'UPDATE_MESSAGES'; payload: (prev: ChatMessage[]) => ChatMessage[] }
  | { type: 'SET_MESSAGE'; payload: string }
  | { type: 'SET_LOADING_MESSAGES'; payload: boolean }
  // UI
  | { type: 'SET_MOBILE_SIDEBAR'; payload: boolean }
  | { type: 'SET_SHORTCUTS_HELP'; payload: boolean }
  | { type: 'SET_TAG_MANAGEMENT'; payload: boolean }
  | { type: 'SET_STYLE_SELECTOR'; payload: boolean }
  | { type: 'SET_THINKING_PANEL'; payload: boolean }
  | { type: 'SET_SCROLL_TO_BOTTOM'; payload: boolean }
  | { type: 'SET_TASK_LIMIT_BANNER'; payload: boolean }
  | { type: 'SET_HISTORY_COLLAPSED'; payload: boolean }
  | { type: 'SET_DRAGGING'; payload: boolean }
  | { type: 'SET_HAS_INPUT_CONTENT'; payload: boolean }
  | { type: 'TOGGLE_DESCRIPTION_COLLAPSE'; payload: number }
  | { type: 'SET_SELECTED_TAGS'; payload: number[] }
  | { type: 'SET_MANAGING_TAGS'; payload: number | null }
  | { type: 'SET_SELECTED_STYLE'; payload: string | null }
  // 流式
  | { type: 'SET_STREAMING'; payload: boolean }
  | { type: 'SET_PROCESSING_INTENT'; payload: boolean }
  | { type: 'SET_SUGGESTED_QUESTIONS'; payload: string[] }
  // 上传
  | { type: 'SET_UPLOADED_IMAGES'; payload: UploadingImage[] }
  | { type: 'SET_UPLOADED_FILES'; payload: UploadingFile[] }
  | { type: 'SET_UPLOADING_IMAGE_ID'; payload: string | null }
  | { type: 'SET_PREVIEW_FILE'; payload: UploadState['previewFile'] }
  // 思考
  | { type: 'SET_THINKING_MODE'; payload: boolean }
  | { type: 'SET_THINKING_STAGE'; payload: ThinkingStage }
  | { type: 'SET_THINKING_MODEL_NAME'; payload: string }
  | { type: 'SET_THINKING_START_TIME'; payload: number | null }
  | { type: 'SET_ELAPSED_THINKING_TIME'; payload: number }
  | { type: 'SET_REASONING_CONTENT'; payload: string }
  | { type: 'SET_CURRENT_THINKING_STEPS'; payload: ThinkingState['currentThinkingSteps'] }
  | { type: 'SET_REALTIME_THINKING_STEPS'; payload: ThinkingStep[] }
  | { type: 'SET_OPERATION_LOGS'; payload: OperationLog[] }
  | { type: 'RESET_THINKING'; payload?: undefined }
  // Lightbox
  | { type: 'OPEN_LIGHTBOX'; payload: { images: Array<{ url: string; name: string }>; index: number } }
  | { type: 'CLOSE_LIGHTBOX'; payload?: undefined }
  | { type: 'SET_LIGHTBOX_OPEN'; payload: boolean }
  | { type: 'SET_LIGHTBOX_IMAGES'; payload: Array<{ url: string; name: string }> }
  | { type: 'SET_LIGHTBOX_INDEX'; payload: number }
  // 视频
  | { type: 'SET_VIDEO_DIALOG'; payload: boolean }
  | { type: 'SET_VIDEO_CONFIRM'; payload: { open: boolean; params?: any } }
  | { type: 'SET_VIDEO_CONFIRM_OPEN'; payload: boolean }
  | { type: 'SET_VIDEO_CONFIRM_PARAMS'; payload: any }
  | { type: 'SET_GENERATING_VIDEO'; payload: boolean }
  // 研究
  | { type: 'SET_RESEARCH_MODE'; payload: boolean }
  | { type: 'SET_STARTING_RESEARCH'; payload: boolean }
  | { type: 'SET_ACTIVE_RESEARCH_TASK'; payload: number | null }
  | { type: 'SET_SANDBOX_TAB'; payload: 'browser' | 'code' | 'terminal' }
  // 编辑
  | { type: 'START_EDIT'; payload: { index: number; text: string } }
  | { type: 'CANCEL_EDIT'; payload?: undefined }
  | { type: 'SET_EDIT_TEXT'; payload: string }
  // 语音
  | { type: 'SET_VOICE_DIALOG'; payload: boolean }
  // 批量更新
  | { type: 'BATCH'; payload: ChatAction[] };

// ═══════════════════════════════════════════
// Reducer
// ═══════════════════════════════════════════

const initialState: ChatState = {
  conversation: {
    selectedConversationId: null,
    selectedModelId: null,
    selectedPackageId: null,
    messages: [],
    message: '',
    isLoadingMessages: false,
  },
  ui: {
    showMobileSidebar: false,
    showShortcutsHelp: false,
    showTagManagement: false,
    showStyleSelector: false,
    showThinkingPanel: false,
    showScrollToBottom: false,
    showTaskLimitBanner: false,
    isHistoryCollapsed: false,
    isDragging: false,
    hasInputContent: false,
    collapsedDescriptions: new Set(),
    selectedTags: [],
    managingTagsForConversation: null,
    selectedStyle: null,
  },
  stream: {
    isStreamingMessage: false,
    isProcessingIntent: false,
    suggestedQuestions: [],
  },
  upload: {
    uploadedImages: [],
    uploadedFiles: [],
    uploadingImageId: null,
    previewFile: null,
  },
  thinking: {
    thinkingMode: (() => { try { return localStorage.getItem('thinkingMode') === 'true'; } catch { return false; } })(),
    thinkingStage: 'idle',
    thinkingModelName: '',
    thinkingStartTime: null,
    elapsedThinkingTime: 0,
    reasoningContent: '',
    currentThinkingSteps: [],
    realtimeThinkingSteps: [],
    operationLogs: [],
  },
  lightbox: {
    lightboxOpen: false,
    lightboxImages: [],
    lightboxIndex: 0,
  },
  video: {
    videoDialogOpen: false,
    videoConfirmOpen: false,
    videoConfirmParams: null,
    isGeneratingVideo: false,
  },
  research: {
    isResearchMode: false,
    isStartingResearch: false,
    activeResearchTaskId: null,
    sandboxActiveTab: 'browser',
  },
  edit: {
    editingMessageIndex: null,
    editText: '',
  },
  voice: {
    voiceDialogOpen: false,
  },
};

function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    // === 对话 ===
    case 'SET_CONVERSATION_ID':
      return { ...state, conversation: { ...state.conversation, selectedConversationId: action.payload } };
    case 'SET_MODEL_ID':
      return { ...state, conversation: { ...state.conversation, selectedModelId: action.payload } };
    case 'SET_PACKAGE_ID':
      return { ...state, conversation: { ...state.conversation, selectedPackageId: action.payload } };
    case 'SET_MESSAGES':
      return { ...state, conversation: { ...state.conversation, messages: action.payload } };
    case 'UPDATE_MESSAGES':
      return { ...state, conversation: { ...state.conversation, messages: action.payload(state.conversation.messages) } };
    case 'SET_MESSAGE':
      return { ...state, conversation: { ...state.conversation, message: action.payload } };
    case 'SET_LOADING_MESSAGES':
      return { ...state, conversation: { ...state.conversation, isLoadingMessages: action.payload } };

    // === UI ===
    case 'SET_MOBILE_SIDEBAR':
      return { ...state, ui: { ...state.ui, showMobileSidebar: action.payload } };
    case 'SET_SHORTCUTS_HELP':
      return { ...state, ui: { ...state.ui, showShortcutsHelp: action.payload } };
    case 'SET_TAG_MANAGEMENT':
      return { ...state, ui: { ...state.ui, showTagManagement: action.payload } };
    case 'SET_STYLE_SELECTOR':
      return { ...state, ui: { ...state.ui, showStyleSelector: action.payload } };
    case 'SET_THINKING_PANEL':
      return { ...state, ui: { ...state.ui, showThinkingPanel: action.payload } };
    case 'SET_SCROLL_TO_BOTTOM':
      return { ...state, ui: { ...state.ui, showScrollToBottom: action.payload } };
    case 'SET_TASK_LIMIT_BANNER':
      return { ...state, ui: { ...state.ui, showTaskLimitBanner: action.payload } };
    case 'SET_HISTORY_COLLAPSED':
      return { ...state, ui: { ...state.ui, isHistoryCollapsed: action.payload } };
    case 'SET_DRAGGING':
      return { ...state, ui: { ...state.ui, isDragging: action.payload } };
    case 'SET_HAS_INPUT_CONTENT':
      return { ...state, ui: { ...state.ui, hasInputContent: action.payload } };
    case 'TOGGLE_DESCRIPTION_COLLAPSE': {
      const newSet = new Set(state.ui.collapsedDescriptions);
      if (newSet.has(action.payload)) newSet.delete(action.payload);
      else newSet.add(action.payload);
      return { ...state, ui: { ...state.ui, collapsedDescriptions: newSet } };
    }
    case 'SET_SELECTED_TAGS':
      return { ...state, ui: { ...state.ui, selectedTags: action.payload } };
    case 'SET_MANAGING_TAGS':
      return { ...state, ui: { ...state.ui, managingTagsForConversation: action.payload } };
    case 'SET_SELECTED_STYLE':
      return { ...state, ui: { ...state.ui, selectedStyle: action.payload } };

    // === 流式 ===
    case 'SET_STREAMING':
      return { ...state, stream: { ...state.stream, isStreamingMessage: action.payload } };
    case 'SET_PROCESSING_INTENT':
      return { ...state, stream: { ...state.stream, isProcessingIntent: action.payload } };
    case 'SET_SUGGESTED_QUESTIONS':
      return { ...state, stream: { ...state.stream, suggestedQuestions: action.payload } };

    // === 上传 ===
    case 'SET_UPLOADED_IMAGES':
      return { ...state, upload: { ...state.upload, uploadedImages: action.payload } };
    case 'SET_UPLOADED_FILES':
      return { ...state, upload: { ...state.upload, uploadedFiles: action.payload } };
    case 'SET_UPLOADING_IMAGE_ID':
      return { ...state, upload: { ...state.upload, uploadingImageId: action.payload } };
    case 'SET_PREVIEW_FILE':
      return { ...state, upload: { ...state.upload, previewFile: action.payload } };

    // === 思考 ===
    case 'SET_THINKING_MODE':
      try { localStorage.setItem('thinkingMode', String(action.payload)); } catch {}
      return { ...state, thinking: { ...state.thinking, thinkingMode: action.payload } };
    case 'SET_THINKING_STAGE':
      return { ...state, thinking: { ...state.thinking, thinkingStage: action.payload } };
    case 'SET_THINKING_MODEL_NAME':
      return { ...state, thinking: { ...state.thinking, thinkingModelName: action.payload } };
    case 'SET_THINKING_START_TIME':
      return { ...state, thinking: { ...state.thinking, thinkingStartTime: action.payload } };
    case 'SET_ELAPSED_THINKING_TIME':
      return { ...state, thinking: { ...state.thinking, elapsedThinkingTime: action.payload } };
    case 'SET_REASONING_CONTENT':
      return { ...state, thinking: { ...state.thinking, reasoningContent: action.payload } };
    case 'SET_CURRENT_THINKING_STEPS':
      return { ...state, thinking: { ...state.thinking, currentThinkingSteps: action.payload } };
    case 'SET_REALTIME_THINKING_STEPS':
      return { ...state, thinking: { ...state.thinking, realtimeThinkingSteps: action.payload } };
    case 'SET_OPERATION_LOGS':
      return { ...state, thinking: { ...state.thinking, operationLogs: action.payload } };
    case 'RESET_THINKING':
      return {
        ...state,
        thinking: {
          ...state.thinking,
          thinkingStage: 'idle',
          thinkingStartTime: null,
          elapsedThinkingTime: 0,
          reasoningContent: '',
          currentThinkingSteps: [],
          realtimeThinkingSteps: [],
          operationLogs: [],
        },
      };

    // === Lightbox ===
    case 'OPEN_LIGHTBOX':
      return {
        ...state,
        lightbox: { lightboxOpen: true, lightboxImages: action.payload.images, lightboxIndex: action.payload.index },
      };
    case 'CLOSE_LIGHTBOX':
      return { ...state, lightbox: { ...state.lightbox, lightboxOpen: false } };
    case 'SET_LIGHTBOX_OPEN':
      return { ...state, lightbox: { ...state.lightbox, lightboxOpen: action.payload } };
    case 'SET_LIGHTBOX_IMAGES':
      return { ...state, lightbox: { ...state.lightbox, lightboxImages: action.payload } };
    case 'SET_LIGHTBOX_INDEX':
      return { ...state, lightbox: { ...state.lightbox, lightboxIndex: action.payload } };

    // === 视频 ===
    case 'SET_VIDEO_DIALOG':
      return { ...state, video: { ...state.video, videoDialogOpen: action.payload } };
    case 'SET_VIDEO_CONFIRM':
      return {
        ...state,
        video: { ...state.video, videoConfirmOpen: action.payload.open, videoConfirmParams: action.payload.params || null },
      };
    case 'SET_VIDEO_CONFIRM_OPEN':
      return { ...state, video: { ...state.video, videoConfirmOpen: action.payload } };
    case 'SET_VIDEO_CONFIRM_PARAMS':
      return { ...state, video: { ...state.video, videoConfirmParams: action.payload } };
    case 'SET_GENERATING_VIDEO':
      return { ...state, video: { ...state.video, isGeneratingVideo: action.payload } };

    // === 研究 ===
    case 'SET_RESEARCH_MODE':
      return { ...state, research: { ...state.research, isResearchMode: action.payload } };
    case 'SET_STARTING_RESEARCH':
      return { ...state, research: { ...state.research, isStartingResearch: action.payload } };
    case 'SET_ACTIVE_RESEARCH_TASK':
      return { ...state, research: { ...state.research, activeResearchTaskId: action.payload } };
    case 'SET_SANDBOX_TAB':
      return { ...state, research: { ...state.research, sandboxActiveTab: action.payload } };

    // === 编辑 ===
    case 'START_EDIT':
      return { ...state, edit: { editingMessageIndex: action.payload.index, editText: action.payload.text } };
    case 'CANCEL_EDIT':
      return { ...state, edit: { editingMessageIndex: null, editText: '' } };
    case 'SET_EDIT_TEXT':
      return { ...state, edit: { ...state.edit, editText: action.payload } };

    // === 语音 ===
    case 'SET_VOICE_DIALOG':
      return { ...state, voice: { voiceDialogOpen: action.payload } };

    // === 批量更新 ===
    case 'BATCH':
      return action.payload.reduce(chatReducer, state);

    default:
      return state;
  }
}

// ═══════════════════════════════════════════
// Hook
// ═══════════════════════════════════════════

export function useChatReducer(overrides?: Partial<ChatState>) {
  const init = overrides ? deepMerge(initialState, overrides) : initialState;
  const [state, dispatch] = useReducer(chatReducer, init);

  // 便捷批量更新
  const batchDispatch = useCallback((...actions: ChatAction[]) => {
    dispatch({ type: 'BATCH', payload: actions });
  }, []);

  return { state, dispatch, batchDispatch };
}

/** 深度合并（仅一层） */
function deepMerge<T extends Record<string, any>>(base: T, overrides: Partial<T>): T {
  const result = { ...base };
  for (const key in overrides) {
    if (overrides[key] && typeof overrides[key] === 'object' && !Array.isArray(overrides[key])) {
      result[key] = { ...base[key], ...overrides[key] } as any;
    } else if (overrides[key] !== undefined) {
      result[key] = overrides[key] as any;
    }
  }
  return result;
}
