/**
 * Chat 模块共享类型定义
 * 
 * 从 Chat.tsx 提取，供 Chat 页面、消息组件、hooks 共同使用。
 */

/** 消息附件图片 */
export interface MessageImage {
  url: string;
  name: string;
  isPlaceholder?: boolean;
  isGenerating?: boolean;
  placeholderUrl?: string;
  /** 优化后的英文 prompt（用于重试/变体生成） */
  imagePrompt?: string;
  /** 是否已收藏 */
  isFavorite?: boolean;
}

/** 消息附件文件 */
export interface MessageFile {
  url: string;
  name: string;
  size: number;
}

/** 对话消息 */
export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  images?: MessageImage[];
  files?: MessageFile[];
  timestamp?: number;
  sentAt?: number;
  respondedAt?: number;
  // 特殊消息类型标记
  isVideoConfirm?: boolean;
  videoConfirmParams?: any;
  isResearchTask?: boolean;
  researchTaskId?: number;
  researchPrompt?: string;
  isAutomationTask?: boolean;
  automationTaskId?: number;
  isIntentConfirm?: boolean;
  intentConfirmData?: any;
  // 错误与重试
  isError?: boolean;
  failedMessage?: {
    content: string;
    images?: Array<{ url: string; name: string }>;
    files?: Array<{ url: string; name: string }>;
  };
  // 内部使用
  textContent?: string;       // 原始文本（不含文件标记）
  _displayContent?: string;   // 展示用内容
}

/** 操作日志 */
export interface OperationLog {
  id: string;
  action: string;
  target?: string;
  operationStatus: 'running' | 'completed';
  timestamp: number;
  diff?: {
    fileName: string;
    before: string;
    after: string;
  };
}

/** 上传文件（含进度信息） */
export interface UploadingFile {
  url: string;
  name: string;
  size: number;
  progress?: number;
  error?: string;
  file?: File;
  id?: string;
}

/** 上传图片（含进度信息） */
export interface UploadingImage {
  url: string;
  name: string;
  progress?: number;
}

/** 思考阶段 */
export type ThinkingStage = 'idle' | 'reasoning' | 'generating' | 'error';

/** 消息缓存项 */
export interface MessageCacheEntry {
  messages: ChatMessage[];
  collapsedDescriptions: Set<number>;
  operationLogs: OperationLog[];
  timestamp: number;
}
