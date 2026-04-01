/**
 * MessageItem 子组件共享类型
 */
import type { ChatStateReturn, ChatMessage } from '../../types';

export interface MessageItemProps {
  msg: ChatMessage;
  index: number;
  displayContent: string;
  isLastAssistant: boolean;
  isStreaming?: boolean;            // ★ 统一渲染：当前消息正在流式输出
  state: ChatStateReturn;
  handleSendMessage: (text?: string, resendImages?: any[], resendFiles?: any[], isRegenerate?: boolean) => void;
  handleImageDownload: (url: string, name: string) => Promise<void>;
  normalizeImageUrl: (url: string) => string;
  extractImagesFromMarkdown: (content: string) => { cleanedContent: string; images: Array<{ url: string; name: string }> };
}

/** AssistantContent 和 UserContent 共享的 props */
export type ContentProps = MessageItemProps;
