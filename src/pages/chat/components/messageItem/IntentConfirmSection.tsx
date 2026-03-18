/**
 * IntentConfirmSection — 意图确认卡片区域
 * 
 * 处理三种确认卡片：
 * - IntentConfirmCard（图片生成/视频生成/文档处理/通用对话）
 * - ResearchConfirmCard
 * - VideoConfirmCard
 * 
 * 从 MessageItem.tsx 拆分，原始行号 215-666
 */
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { IntentConfirmCard } from '@/components/IntentConfirmCard';
import { ResearchConfirmCard } from '@/components/ResearchConfirmCard';
import { VideoConfirmCard } from '@/components/VideoConfirmCard';
import type { ContentProps } from './types';

export function IntentConfirmSection({ msg, state, handleSendMessage }: ContentProps) {
  const { t } = useTranslation();
  const {
    messages, setMessages,
    selectedConversationId,
    setIsStreamingMessage,
    isStartingResearch, setIsStartingResearch,
    setActiveResearchTaskId,
    isProcessingIntent, setIsProcessingIntent,
    isGeneratingVideo, setIsGeneratingVideo,
    selectedModelId, selectedPackageId,
    saveMessagesMutation,
    refetchBalance,
    generateVideoMutation,
    startResearchMutation,
    sendStreamMessage,
    balance,
  } = state;

  // ── IntentConfirmCard ──
  if ((msg as any).isIntentConfirm) {
    return (
      <IntentConfirmCard
        intent={(msg as any).intentConfirmData.intent}
        confidence={(msg as any).intentConfirmData.confidence}
        reasoning={(msg as any).intentConfirmData.reasoning}
        imageUrl={(msg as any).intentConfirmData.imageUrl}
        onConfirm={async (intent) => {
          setIsProcessingIntent(true);
          try {
            const imageUrl = (msg as any).intentConfirmData.imageUrl;
            setMessages(prev => prev.filter(m => m.timestamp !== msg.timestamp));

            if (intent === 'image_generation') {
              await handleImageGeneration(imageUrl);
            } else if (intent === 'video_generation') {
              await handleVideoGeneration(imageUrl);
            } else if (intent === 'document_processing') {
              await handleDocumentProcessing(imageUrl);
            } else {
              await handleGeneralChat();
            }
          } catch (error: any) {
            toast.error(error.message || '操作失败');
          } finally {
            setIsProcessingIntent(false);
          }
        }}
        onCancel={() => {
          setMessages(prev => prev.filter(m => m.timestamp !== msg.timestamp));
        }}
        isProcessing={isProcessingIntent}
      />
    );
  }

  // ── ResearchConfirmCard ──
  if ((msg as any).isResearchConfirm) {
    return (
      <ResearchConfirmCard
        params={(msg as any).researchConfirmParams}
        cost={10}
        onConfirm={async (prompt) => {
          setIsStartingResearch(true);
          try {
            const result = await startResearchMutation.mutateAsync({
              prompt,
              conversationId: selectedConversationId ?? undefined,
              packageId: selectedPackageId ?? undefined,
            });
            const researchMsg = {
              role: "assistant" as const,
              content: `<ResearchTaskCard taskId="${result.taskId}" prompt="${prompt.replace(/"/g, '&quot;')}" />`,
              timestamp: Date.now(),
              isResearchTask: true,
              researchTaskId: result.taskId,
              researchPrompt: prompt,
            };
            setMessages(prev => prev.filter(m => !(m as any).isResearchConfirm).concat(researchMsg));
            setActiveResearchTaskId(result.taskId);
            toast.success(t('chat.research.started', { cost: result.cost }));
            refetchBalance();
          } catch (error: any) {
            toast.error(error.message || t('chat.research.startFailed'));
            setMessages(prev => [...prev, {
              role: "assistant" as const,
              content: error.message || t('chat.research.startFailedRetry'),
              timestamp: Date.now(),
              isError: true,
            }]);
          } finally {
            setIsStartingResearch(false);
          }
        }}
        onCancel={() => {
          setMessages(prev => prev.filter(m => !(m as any).isResearchConfirm));
          const originalMsg = (msg as any).researchConfirmParams?.originalMessage;
          if (originalMsg) {
            setTimeout(() => handleSendMessage(originalMsg), 50);
          }
          toast.info(t('chat.research.cancelled'));
        }}
        isStarting={isStartingResearch}
      />
    );
  }

  // ── VideoConfirmCard ──
  if ((msg as any).isVideoConfirm) {
    return (
      <VideoConfirmCard
        params={(msg as any).videoConfirmParams}
        balance={parseFloat(balance?.balance || '0')}
        onConfirm={async (params) => {
          setIsGeneratingVideo(true);
          try {
            const videoParams = {
              prompt: params.prompt,
              duration: (params.duration === 10 ? 10 : 5) as 5 | 10,
              style: params.style || undefined,
              imageUrl: params.imageUrl || undefined,
              packageId: selectedPackageId ?? undefined,
            };
            const result = await generateVideoMutation.mutateAsync(videoParams);

            const videoTaskMessage = {
              id: Date.now(),
              role: 'assistant' as const,
              content: `<VideoTaskCard taskId="${result.taskId}" prompt="${params.prompt.replace(/"/g, '&quot;')}" />`,
              timestamp: Date.now(),
              isVideoTask: true,
              videoTaskId: result.taskId,
              videoPrompt: params.prompt
            };

            setMessages(prev => {
              const filtered = prev.filter(m => !(m as any).isVideoConfirm);
              const updated = [...filtered, videoTaskMessage];
              if (selectedConversationId) {
                saveMessagesMutation.mutate({
                  conversationId: selectedConversationId,
                  messages: JSON.stringify(updated.filter(m => m.role !== 'system')),
                });
              }
              return updated;
            });
            toast.success(`视频生成任务已创建！任务ID: ${result.taskId}`);
            refetchBalance();
          } catch (error: any) {
            toast.error(error.message || t('chat.videoGenFailed'));
          } finally {
            setIsGeneratingVideo(false);
          }
        }}
        onCancel={() => {
          setMessages(prev => prev.filter(m => !(m as any).isVideoConfirm));
          toast.info(t('chat.videoCancelled'));
        }}
        isGenerating={isGeneratingVideo}
      />
    );
  }

  return null;

  // ─── Helper: 图片生成 ───
  async function handleImageGeneration(imageUrl: string) {
    toast.info(t('chat.video.analyzingImage'));

    const userMsg = {
      id: Date.now(),
      role: 'user' as const,
      content: '生成类似风格的图片',
      timestamp: Date.now(),
      sentAt: Date.now(),
      images: [{ url: imageUrl, name: '参考图片' }]
    };
    setMessages(prev => [...prev, userMsg]);

    const assistantMsg = {
      id: Date.now() + 1,
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, assistantMsg]);
    setIsStreamingMessage(true);

    const generationMessage = {
      role: 'user' as const,
      content: [
        { type: 'text', text: '请分析这张图片的内容、风格和主题，然后生成一张类似风格的图片。' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    };

    await sendStreamMessage(
      selectedModelId ?? 0,
      [...messages, userMsg, generationMessage],
      selectedConversationId ?? undefined,
      {
        onStart: () => { console.log('[Intent Confirm] Image generation started'); },
        onContent: (content: string) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === "assistant") {
              lastMessage.content = (lastMessage.content || "") + content;
            }
            return newMessages;
          });
        },
        onImagePlaceholder: (data: any) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === "assistant") {
              if (!lastMessage.images) lastMessage.images = [];
              const genIdx = lastMessage.images.findIndex((img: any) => img.isGenerating);
              if (genIdx !== -1) {
                lastMessage.images[genIdx] = { url: data.placeholderUrl, name: data.prompt, isPlaceholder: true };
              } else {
                lastMessage.images.push({ url: data.placeholderUrl, name: data.prompt, isPlaceholder: true });
              }
            }
            return newMessages;
          });
        },
        onImage: (data: any) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === "assistant") {
              if (lastMessage.images) {
                const genIdx = lastMessage.images.findIndex((img: any) => img.isGenerating);
                const placeholderIndex = genIdx !== -1 ? genIdx : lastMessage.images.findIndex((img: any) => img.isPlaceholder);
                if (placeholderIndex !== -1) {
                  lastMessage.images[placeholderIndex] = { url: data.imageUrl, name: data.prompt, placeholderUrl: data.placeholderUrl };
                } else {
                  lastMessage.images.push({ url: data.imageUrl, name: data.prompt });
                }
              } else {
                lastMessage.images = [{ url: data.imageUrl, name: data.prompt }];
              }
            }
            return newMessages;
          });
        },
        onDone: () => {
          setIsStreamingMessage(false);
          refetchBalance();
        },
        onError: (error: string) => {
          setIsStreamingMessage(false);
          toast.error(error || '图片生成失败');
        }
      },
      selectedPackageId ?? undefined,
      true
    );
  }

  // ─── Helper: 视频生成 ───
  async function handleVideoGeneration(imageUrl: string) {
    toast.info(t('chat.video.analyzing'));

    const descriptionResponse = await fetch('/api/chat/stream', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        modelId: selectedModelId ?? 0,
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: '请用一句话描述这张图片的内容和场景，用于生成视频。只返回描述文字，不要其他内容。' },
            { type: 'image_url', image_url: { url: imageUrl } }
          ]
        }],
        packageId: selectedPackageId,
        hasVisionContent: true
      })
    });

    if (!descriptionResponse.ok) {
      throw new Error('分析图片失败');
    }

    const reader = descriptionResponse.body?.getReader();
    const decoder = new TextDecoder();
    let description = '';

    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.type === 'content') {
                description += data.content;
              }
            } catch (e) { /* ignore parse errors */ }
          }
        }
      }
    }

    const result = await generateVideoMutation.mutateAsync({
      prompt: description || t('chat.video.defaultPrompt'),
      duration: 5,
      packageId: selectedPackageId ?? undefined,
    });

    const videoTaskMessage = {
      id: Date.now(),
      role: 'assistant' as const,
      content: `<VideoTaskCard taskId="${result.taskId}" prompt="${description.replace(/"/g, '&quot;')}" />`,
      timestamp: Date.now(),
      isVideoTask: true,
      videoTaskId: result.taskId,
      videoPrompt: description
    };

    setMessages(prev => {
      const updated = [...prev, videoTaskMessage];
      if (selectedConversationId) {
        saveMessagesMutation.mutate({
          conversationId: selectedConversationId,
          messages: JSON.stringify(updated.filter(m => m.role !== 'system')),
        });
      }
      return updated;
    });
    toast.success(t('chat.videoTaskCreated', { taskId: result.taskId }));
    refetchBalance();
  }

  // ─── Helper: 文档处理 ───
  async function handleDocumentProcessing(imageUrl: string) {
    toast.info('正在识别并分析文档...');

    const userMsg = {
      id: Date.now(),
      role: 'user' as const,
      content: '处理文档',
      timestamp: Date.now(),
      sentAt: Date.now(),
      images: [{ url: imageUrl, name: '文档图片' }]
    };
    setMessages(prev => [...prev, userMsg]);

    const assistantMsg = {
      id: Date.now() + 1,
      role: 'assistant' as const,
      content: '',
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, assistantMsg]);
    setIsStreamingMessage(true);

    const processingMessage = {
      role: 'user' as const,
      content: [
        { type: 'text', text: '请识别并分析这份文档的内容，提取关键信息。' },
        { type: 'image_url', image_url: { url: imageUrl } }
      ]
    };

    await sendStreamMessage(
      selectedModelId ?? 0,
      [...messages, userMsg, processingMessage],
      selectedConversationId ?? undefined,
      {
        onStart: () => { console.log('[Intent Confirm] Document processing started'); },
        onContent: (content: string) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === "assistant") {
              lastMessage.content = (lastMessage.content || "") + content;
            }
            return newMessages;
          });
        },
        onDone: () => {
          setIsStreamingMessage(false);
          refetchBalance();
        },
        onError: (error: string) => {
          setIsStreamingMessage(false);
          toast.error(error || '文档处理失败');
        }
      },
      selectedPackageId ?? undefined,
      true
    );
  }

  // ─── Helper: 通用对话 ───
  async function handleGeneralChat() {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return;

    setMessages(prev => prev.map(m =>
      m.timestamp === msg.timestamp
        ? { ...m, content: '', isIntentConfirm: false, intentConfirmData: undefined } as any
        : m
    ));
    setIsStreamingMessage(true);

    const chatMessages = messages.filter(m => m.role !== 'assistant' || !(m as any).isIntentConfirm);

    await sendStreamMessage(
      selectedModelId ?? 0,
      chatMessages,
      selectedConversationId ?? undefined,
      {
        onContent: (content: string) => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === "assistant") {
              lastMessage.content = (lastMessage.content || "") + content;
            }
            return newMessages;
          });
        },
        onDone: () => {
          setIsStreamingMessage(false);
          refetchBalance();
        },
        onError: (error: string) => {
          setIsStreamingMessage(false);
          toast.error(error || '对话失败');
        }
      },
      selectedPackageId ?? undefined,
      true
    );
  }
}
