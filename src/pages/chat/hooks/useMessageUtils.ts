import { toast } from 'sonner';
import { streamManager } from '@/lib/backgroundStreamManager';
import { saveOperationLogs } from '@/lib/operationLogStorage';
import type { ThinkingStep } from '@/components/ThinkingProcessPanel';
import type { ChatStateReturn } from '../types';

/**
 * 消息工具函数 Hook
 * - normalizeImageUrl
 * - extractImagesFromMarkdown
 * - generateSuggestedQuestions
 */
export function useMessageUtils(state: ChatStateReturn) {
  const { trpcClient, setMessages, messages ,
    generateSuggestedQuestionsMutation,
    setSuggestedQuestions,
    selectedConversationId,
    selectedConvIdRef,
  } = state as any;

  const normalizeImageUrl = (url: string): string => {
    if (!url) return url;
    try {
      const parsed = new URL(url, window.location.origin);
      if (parsed.hostname === 'insights.ren' && parsed.pathname.startsWith('/uploads/')) {
        return parsed.pathname;
      }
    } catch {}
    return url;
  };

  /** 提取markdown中的图片 */
  const extractImagesFromMarkdown = (content: string): { cleanedContent: string; images: Array<{ url: string; name: string }> } => {
    const images: Array<{ url: string; name: string }> = [];
    const codeBlockPlaceholders: string[] = [];
    const contentWithoutCode = content.replace(/```[\s\S]*?```/g, (match) => {
      codeBlockPlaceholders.push(match);
      return `__CODE_BLOCK_${codeBlockPlaceholders.length - 1}__`;
    }).replace(/`[^`]+`/g, (match) => {
      codeBlockPlaceholders.push(match);
      return `__CODE_BLOCK_${codeBlockPlaceholders.length - 1}__`;
    });

    const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
    const cleanedContent = contentWithoutCode.replace(imageRegex, (_match, alt, url) => {
      if (url.startsWith('data:')) return _match;
      const isValidImageUrl =
        (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/uploads/') || url.startsWith('/api/')) &&
        (/\.(png|jpg|jpeg|gif|webp|svg|bmp|ico)(\?|$)/i.test(url) || url.includes('/image') || url.includes('flux') || url.includes('generated'));
      if (!isValidImageUrl) {
        return _match;
      }
      images.push({ url, name: alt || 'AI生成图片' });
      return '';
    });

    let restored = cleanedContent;
    codeBlockPlaceholders.forEach((block, i) => {
      restored = restored.replace(`__CODE_BLOCK_${i}__`, block);
    });
    return { cleanedContent: restored.trim(), images };
  };

  /** 生成推荐追问 */
  const generateSuggestedQuestions = async (assistantResponse: string, userMessage?: string, automationMeta?: { taskName?: string; postCount?: number; replyCount?: number }, forConversationId?: number) => {
    try {
      // 记录发起请求时的对话ID，用于回调时校验，防止跨对话污染
      const requestConvId = forConversationId || selectedConversationId;
      // 不传历史对话上下文，仅基于当前用户问题+AI回复生成追问
      generateSuggestedQuestionsMutation.mutate(
        { assistantResponse, userMessage, conversationHistory: [], automationMeta },
        {
          onSuccess: (result: any) => {
            // 校验：只有仍在同一对话时才设置推荐追问（使用ref获取最新值，避免闭包陈旧问题）
            const currentConvId = selectedConvIdRef?.current ?? selectedConversationId;
            if (requestConvId && currentConvId !== requestConvId) {
              return;
            }
            if (result.questions && result.questions.length > 0) setSuggestedQuestions(result.questions);
          },
          onError: (error: any) => {
            console.error('生成推荐追问失败:', error);
            // 校验对话ID（使用ref）
            const currentConvId = selectedConvIdRef?.current ?? selectedConversationId;
            if (requestConvId && currentConvId !== requestConvId) return;
            // 自动化场景下的兜底推荐
            if (automationMeta) {
              const taskCore = (automationMeta.taskName || '随机版块发帖+互相回复互动').replace(/继续|（账号.*?）/g, '').trim();
              setSuggestedQuestions([`继续${taskCore}`, '换个内容风格再跑一轮', '查看论坛最新互动情况']);
            } else {
              setSuggestedQuestions(['能详细解释一下吗？', '还有其他相关的信息吗？', '这个结果的依据是什么？']);
            }
          },
        }
      );
    } catch (error) {
      console.error('生成推荐追问失败:', error);
    }
  };

  // ═══════════ 核心发送逻辑 ═══════════


  return { normalizeImageUrl, extractImagesFromMarkdown, generateSuggestedQuestions };
}
