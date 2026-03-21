import { toast } from 'sonner';
import { streamManager } from '@/lib/backgroundStreamManager';
import { saveOperationLogs } from '@/lib/operationLogStorage';
import type { ThinkingStep } from '@/components/ThinkingProcessPanel';
import type { ChatStateReturn } from '../types';

/**
 * 意图检测 Hook
 * - _detectImageIntent
 * - _detectResearchIntent
 * - _handleAutoResearch
 * - _handleResearchMode
 * - _handleVideoIntent
 */
export function useIntentDetectors(state: ChatStateReturn) {
  const {
    trpcClient, setMessages, messages, setIsStartingResearch,
    setActiveResearchTaskId, isGeneratingVideo, setIsGeneratingVideo,
    selectedConversationId, setSelectedConversationId,
    selectedPackageId, uploadedImages, setUploadedImages, setUploadedFiles,
    setMessage, setHasInputContent, chatInputRef,
    detectVideoIntentMutation, startResearchMutation,
    refetchConversations, refetchBalance,
    t, handleSendMessage,
  } = state as any;

  const _handleResearchMode = async (textToSend: string, resendImages?: Array<{ url: string; name: string; progress?: number }>) => {
    const researchPrompt = textToSend.trim();
    if (!researchPrompt) { toast.error(t('chat.research.enterPrompt')); return; }

    const currentImages = resendImages ?? uploadedImages;
    const imageUrls = currentImages.map((img: any) => typeof img === 'string' ? img : img.url).filter((url: string) => url && !url.startsWith('blob:'));
    const userMsg = {
      role: 'user' as const,
      content: researchPrompt,
      timestamp: Date.now(),
      sentAt: Date.now(),
      images: imageUrls.length > 0 ? imageUrls.map((url: string) => ({ url, name: '用户上传图片' })) : undefined,
    };
    setMessages(prev => [...prev, userMsg]);
    setMessage('');
    chatInputRef.current?.clear();
    setHasInputContent(false);
    setUploadedImages([]);
    setUploadedFiles([]);

    try {
      const result = await startResearchMutation.mutateAsync({
        prompt: researchPrompt,
        conversationId: selectedConversationId ?? undefined,
        images: imageUrls.length > 0 ? imageUrls : undefined,
        packageId: selectedPackageId ?? undefined,
      });

      const researchMsg = {
        role: 'assistant' as const,
        content: `<ResearchTaskCard taskId="${result.taskId}" prompt="${researchPrompt.replace(/"/g, '&quot;')}" />`,
        timestamp: Date.now(),
        isResearchTask: true,
        researchTaskId: result.taskId,
        researchPrompt,
      };
      setMessages(prev => [...prev, researchMsg]);
      setActiveResearchTaskId(result.taskId);
      if (result.conversationId && selectedConversationId === null) setSelectedConversationId(result.conversationId);
      refetchConversations();
      toast.success(t('chat.research.started', { cost: result.cost }));
      refetchBalance();
    } catch (error: any) {
      toast.error(error.message || t('chat.research.startFailed'));
      setMessages(prev => [...prev, { role: 'assistant' as const, content: error.message || t('chat.research.startFailedRetry'), timestamp: Date.now(), isError: true }]);
    }
    setIsResearchMode(false);
  };

  // ═══════════ 内部方法：图片意图检测 ═══════════

  const _detectImageIntent = (textToSend: string, resendImages?: Array<{ url: string; name: string; progress?: number }>) => {
    const imageKeywords = ['生成图片', '制作图片', '创建图片', '生成一张图', '生成一张图片', '做一张图', '做个图片', '配上一张', '配上图片', '配图', 'generate image', 'create image', 'make image', '画一张', '继续生成', '再生成', '再来一张', '再画一张', '重新生成', '生成类似的', '生成相似的', '类似的图', '相似的图', '同样的图', '同样风格'];
    const hasRecentImageGeneration = messages.some((msg, idx) => msg.role === 'assistant' && msg.images && msg.images.length > 0 && idx >= messages.length - 6);
    const contextualImageKeywords = ['换个风格', '换一种', '改一下', '修改一下', '调整一下', '再来', '再试', '不满意', '换个颜色', '更亮一点', '更暗一点', '更大一点', '更小一点', '加上', '去掉', '改成', '变成', '继续', '还要', '再来一个', '来一个', '多来几个'];

    const hasDirectImageIntent = textToSend.trim() && imageKeywords.some(kw => textToSend.toLowerCase().includes(kw.toLowerCase()));
    const hasContextualImageIntent = hasRecentImageGeneration && textToSend.trim() && contextualImageKeywords.some(kw => textToSend.toLowerCase().includes(kw.toLowerCase()));
    const hasImageGenerationIntent = hasDirectImageIntent || hasContextualImageIntent;

    const imageEditPatterns = [
      /重新.{0,5}生成/, /(修改|编辑|调整|对齐|移动|替换|更换|改|换).{0,20}(图|图片|图像|内容|文字|字|文本|位置|颜色|大小)/,
      /把.{1,30}(对齐|居中|调整|移到|放到|改[成为]|换[成为]|去掉|删除|加上|添加)/,
      /(去掉|删除|移除|擦除|添加|加上|加入).{0,20}(图|图片|图像|文字|水印|背景|元素)/,
      /(图|图片|图像).{0,10}(中|里|上|内).{0,15}(修改|替换|调整|改|换)/,
      /按照.{0,20}(图|图片).{0,10}(修改|重新|调整|生成)/,
      /参考.{0,10}(这张|这个|上传|这).{0,10}(图|图片)/,
      /(这张|这个|上面的?|上传的?).{0,5}(图|图片).{0,10}(修改|编辑|调整|重做|重新)/,
    ];
    const hasImageEditIntent = (uploadedImages.length > 0 || (resendImages && resendImages.length > 0)) &&
      hasImageGenerationIntent && imageEditPatterns.some(p => p.test(textToSend));

    // 继续生成 - 上下文记忆
    const continueKeywords = ['继续生成', '再生成', '再来一张', '再画一张', '重新生成', '生成类似的', '生成相似的', '类似的图', '相似的图', '同样的图', '同样风格', '继续', '再来', '还要', '再来一个', '来一个', '多来几个'];
    const isContinueGeneration = hasImageGenerationIntent && !hasImageEditIntent &&
      continueKeywords.some(kw => textToSend.toLowerCase().includes(kw.toLowerCase()));

    let enhancedMessage = textToSend;
    if (isContinueGeneration) {
      for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        if (msg.role === 'assistant' && msg.images && msg.images.length > 0) {
          let prevDesc = '';
          // 优先从 images[0].name 获取（包含实际的生成 prompt）
          const imgName = msg.images[0]?.name;
          if (imgName && imgName !== '用户上传图片' && imgName.length > 10 && !imgName.includes('/uploads/')) {
            prevDesc = imgName;
          } else {
            // 回退：从消息内容中提取
            const descMatch = msg.content.match(/图片描述：?\s*([^\n]+)/i) || msg.content.match(/描述：?\s*([^\n]+)/i);
            if (descMatch && descMatch[1]) {
              prevDesc = descMatch[1].trim();
            } else {
              // 最终回退：清理 markdown 图片链接后取剩余文本
              const cleaned = typeof msg.content === 'string'
                ? msg.content.replace(/!\[[^\]]*\]\([^)]*\)/g, '').replace(/图片描述：?/g, '').trim()
                : '';
              if (cleaned.length > 10) prevDesc = cleaned.substring(0, 200);
            }
          }
          if (prevDesc) {
            enhancedMessage = `${textToSend}\n\n[上一次生成的图片描述参考：${prevDesc}]`;
          }
          break;
        }
      }
    }

    const effectiveImages = resendImages ?? uploadedImages;
    const shouldIgnoreUploadedImages = hasImageGenerationIntent && effectiveImages.length > 0 && !hasImageEditIntent;

    return { hasImageGenerationIntent, hasImageEditIntent, enhancedMessage, shouldIgnoreUploadedImages };
  };

  // ═══════════ 内部方法：研究意图检测 ═══════════

  const _detectResearchIntent = (textToSend: string, effectiveFiles: any[]): boolean => {
    // ★ 收紧：仅显式"深度研究/调研报告"关键词触发（轻量搜索由后端 LLM 自动判断）
    const explicitResearchKeywords = [
      '深度研究', '深度调研', '深入研究', '深入调研', '详细调研', '全面调研', '全面研究',
      '帮我研究', '帮我调研', '做个调研', '做个研究', '做一个调研', '做一个研究',
      '进行研究', '进行调研', '开展研究', '开展调研',
      '生成研究报告', '写个报告', '研究报告', '调研报告',
      '市场调研', '行业分析报告', '竞品分析报告',
    ];
    const hasExplicitResearch = explicitResearchKeywords.some(kw => textToSend.toLowerCase().includes(kw.toLowerCase()));

    // 排除代码上下文
    const recentMessages = messages.slice(-6);
    const hasCodeContext = recentMessages.some((m: any) => {
      const c = typeof m.content === 'string' ? m.content : '';
      return c.includes('```') || c.includes('=== 文件内容') || /\.tsx?\n/.test(c);
    });
    const isCodeRelated = /提示词|系统提示|prompt|system\s*prompt|代码|函数|接口|API|组件|功能|bug|修复|优化/i.test(textToSend) && !hasExplicitResearch;

    return !!textToSend.trim() &&
      uploadedImages.length === 0 &&
      effectiveFiles.length === 0 &&
      !hasCodeContext &&
      !isCodeRelated &&
      hasExplicitResearch;
  };

  // ═══════════ 内部方法：自动启动研究 ═══════════

  const _handleAutoResearch = async (textToSend: string) => {
    const userMessage = { role: 'user' as const, content: textToSend.trim(), timestamp: Date.now(), sentAt: Date.now() };
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    chatInputRef.current?.clear();
    setHasInputContent(false);
    setIsStartingResearch(true);

    try {
      const prompt = textToSend.trim();
      const result = await startResearchMutation.mutateAsync({
        prompt,
        conversationId: selectedConversationId ?? undefined,
        packageId: selectedPackageId ?? undefined,
      });
      const researchMsg = {
        role: 'assistant' as const,
        content: `<ResearchTaskCard taskId="${result.taskId}" prompt="${prompt.replace(/"/g, '&quot;')}" />`,
        timestamp: Date.now(),
        isResearchTask: true,
        researchTaskId: result.taskId,
        researchPrompt: prompt,
      };
      setMessages(prev => [...prev, researchMsg]);
      setActiveResearchTaskId(result.taskId);
      toast.success(t('chat.research.started', { cost: result.cost }));
      refetchBalance();
    } catch (error: any) {
      toast.error(t('chat.research.startFailed') + '，已切换为普通对话');
      await handleSendMessage(textToSend);
    } finally {
      setIsStartingResearch(false);
    }
  };

  // ═══════════ 内部方法：视频意图处理 ═══════════

  const _handleVideoIntent = async (textToSend: string, effectiveFiles: any[]): Promise<boolean> => {
    const videoGenerationPhrases = [
      '生成视频', '制作视频', '创建视频', '做个视频', '做一个视频', '做视频',
      '生成一段视频', '制作一段视频', '生成一个视频', '制作一个视频',
      '生成动画', '制作动画', '创建动画', '做个动画', '做一个动画',
      '生成短视频', '制作短视频', '创建短视频', '做个短视频',
      '来个视频', '来段视频', '要个视频', '弄个视频',
      // ── 图生视频衔接短语 ──
      '让它动起来', '让她动起来', '让他动起来', '动起来',
      '让这张图动起来', '让图片动起来', '让画面动起来',
      '变成视频', '转成视频', '做成视频', '图片变视频', '图转视频',
      '让它活起来', '让它跑起来', '让它飞起来', '让它跳起来',
      'generate video', 'create video', 'make video', 'generate a video',
      'create a video', 'make a video', 'make an animation',
      'animate it', 'make it move', 'bring it to life', 'animate this',
      'turn it into a video', 'make this a video', 'convert to video',
    ];
    const msgLower = textToSend.toLowerCase();
    const phraseMatch = videoGenerationPhrases.some(phrase => msgLower.includes(phrase.toLowerCase()));
    // 灵活正则：长动词短语允许较大间距，单字动词收紧到 0-4 字
    const flexVideoRegex = /(帮我生成|帮我制作|帮我做|生成|制作|创建).{0,30}(视频|动画|短视频|vlog)|(做|来|要|弄).{0,4}(视频|动画|短视频|vlog)/;
    const flexMatch = flexVideoRegex.test(textToSend);
    // ── 图生视频模式：让xx动起来 / 变成xx视频 ──
    const i2vRegex = /让.{0,6}(动起来|活起来|跑起来|飞起来|跳起来|跳舞|运动)|变成.{0,4}(视频|动画)|转成.{0,4}(视频|动画)|做成.{0,4}(视频|动画)/;
    const i2vMatch = i2vRegex.test(textToSend);

    // ── 排除非生成语境：「视频」后紧跟分析/功能/管理等词时，用户在讨论视频相关功能而非要求生成视频 ──
    const videoNonGenContext = /(视频|动画).{0,2}(内容|分析|功能|平台|管理|编辑|剪辑|播放|下载|上传|审核|转码|压缩|格式|教程|课程|学习|会议|通话|监控|识别|检测|处理|服务|系统|模块|接口|SDK|API)/;
    const isNonGenContext = videoNonGenContext.test(textToSend);
    // 同时排除疑问讨论句式：「需要...视频...吗/呢/？」
    const videoDiscussionPattern = /(需要|应该|是否|要不要|有没有必要).{0,20}(视频|动画).{0,10}(吗|呢|？|\?)/;
    const isDiscussion = videoDiscussionPattern.test(textToSend);

    const hasVideoGenerationIntent = (phraseMatch || flexMatch || i2vMatch) && !isNonGenContext && !isDiscussion;

    const shouldCheckVideoIntent = textToSend.trim() && effectiveFiles.length === 0 && hasVideoGenerationIntent;
    if (!shouldCheckVideoIntent) return false;

    try {
      const intentResult = await detectVideoIntentMutation.mutateAsync({ message: textToSend.trim(), packageId: selectedPackageId ?? undefined });
      if (intentResult.isVideoRequest && intentResult.confidence !== 'low') {
        // ── 图生视频衔接：自动抓取参考图 ──
        // 优先级：用户上传的图 > 聊天中最后一张 AI 生成的图
        let refImageUrl = uploadedImages.length > 0
          ? (typeof uploadedImages[0] === 'string' ? uploadedImages[0] : (uploadedImages[0] as any)?.url)
          : undefined;

        // 如果用户没上传图但是说了"让它动起来"类的话，自动从聊天记录抓最后一张 AI 图
        if (!refImageUrl && i2vMatch) {
          for (let i = messages.length - 1; i >= 0; i--) {
            const m = messages[i];
            if (m.role !== 'assistant') continue;
            // 从 msg.images 数组取
            if (m.images && m.images.length > 0) {
              const lastImg = m.images[m.images.length - 1];
              refImageUrl = typeof lastImg === 'string' ? lastImg : (lastImg as any)?.url;
              if (refImageUrl) break;
            }
            // 从 markdown 内容里提取 ![...](url)
            const content = typeof m.content === 'string' ? m.content : '';
            const imgMatch = content.match(/!\[.*?\]\(([^)]+)\)/);
            if (imgMatch) {
              refImageUrl = imgMatch[1];
              break;
            }
          }
          if (refImageUrl) {
          }
        }

        const userMessage = {
          role: 'user' as const,
          content: textToSend.trim(),
          timestamp: Date.now(),
          ...(uploadedImages.length > 0 ? { images: uploadedImages.map((img: any) => typeof img === 'string' ? { url: img } : img) } : {}),
        };
        const confirmMessage = {
          role: 'assistant' as const,
          content: t('chat.video.intentDetected'),
          timestamp: Date.now(),
          isVideoConfirm: true,
          videoConfirmParams: { ...intentResult, prompt: intentResult.prompt?.trim() || textToSend.trim(), imageUrl: refImageUrl },
        };
        setMessages(prev => [...prev, userMessage, confirmMessage]);
        setMessage('');
        setUploadedImages([]);
        return true;
      }
    } catch (error: any) {
    }
    return false;
  };

  return {
    _handleResearchMode,
    _detectImageIntent,
    _detectResearchIntent,
    _handleAutoResearch,
    _handleVideoIntent,
  };
}
