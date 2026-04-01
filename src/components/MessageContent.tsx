import { useTypewriterEffect } from "@/hooks/useTypewriterEffect";

interface MessageContentProps {
  content: string;
  isStreaming?: boolean;
  enableTypewriter?: boolean;
}

/**
 * 消息内容组件
 * 支持打字机效果的文本显示
 */
export function MessageContent({ 
  content, 
  isStreaming = false,
  enableTypewriter = true 
}: MessageContentProps) {
  // 只对正在流式输出的消息应用打字机效果
  const displayedContent = useTypewriterEffect(
    content,
    30, // 30ms/字符
    enableTypewriter && isStreaming
  );

  return (
    <div className="whitespace-pre-wrap break-words overflow-wrap-anywhere">
      {displayedContent}
    </div>
  );
}
