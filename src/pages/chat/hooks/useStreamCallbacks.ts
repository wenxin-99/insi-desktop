import { toast } from 'sonner';
import { streamManager } from '@/lib/backgroundStreamManager';
import { researchTaskRegistry } from '@/lib/researchTaskRegistry';
import { saveOperationLogs } from '@/lib/operationLogStorage';
import type { ThinkingStep } from '@/components/ThinkingProcessPanel';
import type { ChatStateReturn } from '../types';
import { useMessageUtils } from './useMessageUtils';

/**
 * SSE 流式回调构建 Hook
 * - _buildStreamCallbacks
 */
export function useStreamCallbacks(state: ChatStateReturn) {
  const {
    setMessages, messages, selectedConversationId, trpcClient,
    setIsStreamingMessage, streamedContent, setStreamedContent,
    setThinkingSteps, thinkingMode,
    setActiveResearchTaskId, setIsStartingResearch,
    setIsGeneratingVideo,
    isProcessingIntent, setIsProcessingIntent,
    currentThinkingSteps,
    exportContentPdfMutation,
    generateDocumentMutation,
    generateTitleMutation,
    hasDetectedToolCallRef,
    isTtsAutoMode,
    lastFileNameRef,
    onStreamComplete,
    onStreamStart,
    operationLogsRef,
    previewOpenedRef,
    refetchBalance,
    refetchConversations,
    selectedConvIdRef,
    selectedPackageId,
    setCollapsedDescriptions,
    setCurrentThinkingSteps,
    setOperationLogs,
    setThinkingSummary,
    setActiveArtifact,
    setPlayingTtsIndex,
    setPreviewFile,
    setRealtimeThinkingSteps,
    setReasoningContent,
    reasoningContentRef,
    setSuggestedQuestions,
    setThinkingModelName,
    setThinkingStage,
    setThinkingStartTime,
    setImageGenStage,
    setImageGenProgress,
    setWebSearchQuery,
    streamedContentRef,
    streamingForConvIdRef,
    streamingTts,
    t,
    // 用于错误时回填输入框
    chatInputRef,
    saveDraft,
    setUploadedImages,
    setUploadedFiles,
  } = state as any;

  const { generateSuggestedQuestions } = useMessageUtils(state);

  const _buildStreamCallbacks = (conversationId: number, effectiveImages: any[], hasImageGenerationIntent: boolean) => {
    let _capturedThinkingSummary = '';
    let _capturedImagePrompt = ''; // 存储图片生成时 LLM 优化后的 prompt
    return {
    onStart: (data: any) => {
      _capturedThinkingSummary = '';
      _capturedImagePrompt = '';
      setCurrentThinkingSteps([]);
      setRealtimeThinkingSteps([]);
      setOperationLogs([]);
      setThinkingSummary('');
      setActiveArtifact(null);
      setReasoningContent('');
      reasoningContentRef.current = '';
      setThinkingStage('idle');
      setActiveResearchTaskId(null);
      setThinkingStartTime(Date.now());
      setImageGenStage(null);
      setImageGenProgress(null);
      setWebSearchQuery(null);
      hasDetectedToolCallRef.current = false;
      onStreamStart();
      if (isTtsAutoMode) {
        streamingTts.start({ packageId: selectedPackageId ?? undefined });
        setPlayingTtsIndex(-1);
      }
    },
    onContent: (content: any) => {
      if (hasDetectedToolCallRef.current) return;
      const contentStr = typeof content === 'string' ? content : String(content);
      streamedContentRef.current = (streamedContentRef.current || '') + contentStr;
      const accumulatedContent = streamedContentRef.current;

      if (accumulatedContent.length === contentStr.length && lastFileNameRef.current && !previewOpenedRef.current) {
        previewOpenedRef.current = true;
        setPreviewFile({ name: lastFileNameRef.current, content: contentStr, isLive: true });
      }

      const hasToolCall = accumulatedContent.includes('"action"') &&
        (accumulatedContent.includes('dalle.text2im') || accumulatedContent.includes('text2im'));
      if (hasToolCall) { hasDetectedToolCallRef.current = true; console.log('[IMAGE GENERATION] Tool call detected, clearing content'); }

      if (isTtsAutoMode) {
        // markdown 清理已移至 useStreamingTts.synthesize，此处直接传递原始内容
        if (contentStr.trim()) streamingTts.feedChunk(contentStr);
      }
    },
    onFallback: (data: any) => {
      if (data.usedFallback) {
        // 静默处理视觉模型切换，不显示通知给用户
      }
    },
    onThinking: (data: any) => {
      // 优先使用 details（对话式过渡文字），回退到 step（标题）
      const displayText = data.details || data.step;
      const simpleStep = { id: `step-${Date.now()}-${Math.random()}`, content: displayText, timestamp: data.timestamp };
      setCurrentThinkingSteps((prev) => [...prev, simpleStep]);
      const now = Date.now();
      const thinkingStep: ThinkingStep = { id: `step-${now}-${Math.random()}`, name: data.step, details: data.details, status: 'completed', startTime: data.timestamp, endTime: now };
      setRealtimeThinkingSteps((prev) => {
        if (prev.length > 0) {
          const updated = [...prev];
          const lastStep = { ...updated[updated.length - 1] };
          if (!lastStep.endTime || lastStep.endTime === lastStep.startTime) { lastStep.endTime = now; updated[updated.length - 1] = lastStep; }
          return [...updated, thinkingStep];
        }
        return [...prev, thinkingStep];
      });
    },
    onReasoningContent: (data: any) => { const chunk = data.content || ''; setReasoningContent(prev => prev + chunk); reasoningContentRef.current += chunk; },
    onThinkingStage: (data: any) => {
      if (data.stage === 'start') { setThinkingStage('reasoning'); setThinkingModelName(data.model || ''); setReasoningContent(''); reasoningContentRef.current = ''; }
      else if (data.stage === 'end') { setThinkingStage('generating'); }
      else if (data.stage === 'error') { setThinkingStage('error'); if (data.error) toast.error(data.error, { duration: 5000 }); }
    },
    onThinkingSummary: (data: any) => {
      if (data.summary) {
        _capturedThinkingSummary = data.summary;
        setThinkingSummary(data.summary);
      }
    },
    // ═══════ Artifact 实时预览 ═══════
    onArtifactStart: (data: any) => {
      const { artifact } = data;
      const artifactData = {
        id: artifact.id,
        title: artifact.title,
        language: artifact.language || 'html',
        description: artifact.description || '',
        code: '',
        version: artifact.version || 1,
        status: 'streaming' as const,
      };
      // 写入消息
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          (lastMessage as any).artifact = artifactData;
        }
        return newMessages;
      });
      // 同时激活右侧面板
      setActiveArtifact(artifactData);
    },
    onArtifactChunk: (data: any) => {
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant' && (lastMessage as any).artifact) {
          const artifact = { ...(lastMessage as any).artifact };
          artifact.code = (artifact.code || '') + (data.chunk || '');
          (lastMessage as any).artifact = artifact;
          // 同步到右侧面板
          setActiveArtifact({ ...artifact });
        }
        return newMessages;
      });
    },
    onArtifactEnd: (data: any) => {
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant' && (lastMessage as any).artifact) {
          const artifact = { ...(lastMessage as any).artifact };
          artifact.status = 'complete';
          if (data.metadata) {
            artifact.description = data.metadata.description || artifact.description;
          }
          (lastMessage as any).artifact = artifact;
          // 同步到右侧面板
          setActiveArtifact({ ...artifact });
        }
        return newMessages;
      });
    },
    // ═══════ 方案选择卡片 ═══════
    onSolutionPicker: (data: any) => {
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          (lastMessage as any).solutionPicker = {
            id: data.id,
            question: data.question,
            options: data.options || [],
            allowCustom: data.allowCustom ?? true,
            allowSkip: data.allowSkip ?? true,
            status: 'pending',
          };
        } else {
          // 如果没有助手消息，创建一个
          newMessages.push({
            id: String(Date.now()),
            role: 'assistant' as const,
            content: '',
            timestamp: Date.now(),
            solutionPicker: {
              id: data.id,
              question: data.question,
              options: data.options || [],
              allowCustom: data.allowCustom ?? true,
              allowSkip: data.allowSkip ?? true,
              status: 'pending',
            },
          } as any);
        }
        return newMessages;
      });
    },
    onOperation: (data: any) => {
      const operationLog = {
        id: `op-${Date.now()}-${Math.random()}`,
        action: data.action,
        target: data.target,
        operationStatus: data.operationStatus,
        timestamp: data.timestamp,
        ...(data.diff ? { diff: data.diff } : {}),
        ...(data.detail ? { detail: data.detail } : {}),
        ...(data.stepType ? { stepType: data.stepType } : {}),
        ...(data.description ? { description: data.description } : {}),
      };
      setOperationLogs((prev) => {
        const existingIndex = prev.findIndex(log => log.action === data.action && log.target === data.target && log.operationStatus === 'running');
        let newLogs;
        if (existingIndex >= 0 && data.operationStatus === 'completed') { const updated = [...prev]; updated[existingIndex] = operationLog; newLogs = updated; }
        else { newLogs = [...prev, operationLog]; }
        if (selectedConversationId) saveOperationLogs(selectedConversationId.toString(), newLogs);
        return newLogs;
      });
      if ((data.action === '生成文件' || data.action === '正在编写修复方案') && data.target && data.operationStatus === 'running') {
        lastFileNameRef.current = data.target;
        previewOpenedRef.current = true;
        setPreviewFile({ name: data.target, content: '', isLive: true });
      }
      if (data.target && data.target.includes('.') && (data.action.includes('文件') || data.action.includes('修复'))) lastFileNameRef.current = data.target;
      if (data.action === '正在生成回答' && data.operationStatus === 'running' && lastFileNameRef.current && !previewOpenedRef.current) {
        previewOpenedRef.current = true;
        setPreviewFile({ name: lastFileNameRef.current, content: '', isLive: true });
      }
      // ★ 图片生成：捕获优化后的 prompt
      if (data.action === '优化提示词' && data.operationStatus === 'completed' && data.target) {
        _capturedImagePrompt = data.target;
      }
      // ★ 图片生成：进入"正在生成图片"阶段时，清理初始提示
      if (data.action === '正在生成图片' && data.operationStatus === 'running') {
        setMessages((prev) => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            if (lastMessage.content === '🎨 正在为您生成图片，请稍候…') lastMessage.content = '';
          }
          return newMessages;
        });
      }
    },
    onFilePreview: (data: { fileName: string; action: string; newContent?: string; oldContent?: string; timestamp: number }) => {
      // 结构化的文件预览事件（服务端发送，优先级高于前端正则解析）
      let previewContent = '';
      if (data.action === 'modify' && data.oldContent && data.newContent) {
        previewContent = `// ──── 旧代码 ────\n${data.oldContent}\n\n// ──── 新代码 ────\n${data.newContent}`;
      } else if (data.newContent) {
        previewContent = data.newContent;
      }
      if (previewContent) {
        lastFileNameRef.current = data.fileName;
        previewOpenedRef.current = true;
        setPreviewFile({ name: data.fileName, content: previewContent, isLive: true });
      }
    },
    onAutomationTask: (data: any) => {
      setActiveResearchTaskId(data.taskId);
      // 注册到研究任务追踪器
      if (conversationId) researchTaskRegistry.register(conversationId, data.taskId);
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          (lastMessage as any).isAutomationTask = true;
          (lastMessage as any).automationTaskId = data.taskId;
          (lastMessage as any).automationTaskName = data.taskName;
          (lastMessage as any).automationSiteName = data.siteName;
          // 多账号任务：存储全部任务列表以支持切换
          if (data.allTasks && data.allTasks.length > 1) {
            (lastMessage as any).automationAllTasks = data.allTasks;
          }
        }
        return [...newMessages];
      });
    },
    onIntentConfirm: (data: any) => {
      setIsStreamingMessage(false);
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastAssistantIdx = newMessages.length - 1;
        if (lastAssistantIdx >= 0 && newMessages[lastAssistantIdx].role === 'assistant') {
          newMessages[lastAssistantIdx] = { ...newMessages[lastAssistantIdx], content: '', isIntentConfirm: true, intentConfirmData: data } as any;
        } else {
          newMessages.push({ id: String(Date.now()), role: 'assistant' as const, content: '', timestamp: Date.now(), isIntentConfirm: true, intentConfirmData: data } as any);
        }
        return newMessages;
      });
    },
    onImagePlaceholder: (data: any) => {
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          if (lastMessage.content === '🎨 正在为您生成图片，请稍候…') lastMessage.content = '';
          if (!lastMessage.images) lastMessage.images = [];
          // ★ 替换已有的 isGenerating 占位图（Canvas 动画 → 模糊占位图）
          const genIdx = lastMessage.images.findIndex((img: any) => img.isGenerating);
          if (genIdx !== -1) {
            lastMessage.images[genIdx] = { url: data.placeholderUrl, name: data.prompt, isPlaceholder: true };
          } else {
            lastMessage.images.push({ url: data.placeholderUrl, name: data.prompt, isPlaceholder: true });
          }
          setCollapsedDescriptions(prev => { const newSet = new Set(prev); newSet.add(newMessages.length - 1); return newSet; });
        }
        return newMessages;
      });
    },
    // ★ 多图生成：服务端发送 imageCount，插入对应数量的占位图
    onImageCount: (data: any) => {
      const count = data.count || 1;
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          if (!lastMessage.images) lastMessage.images = [];
          for (let i = 0; i < count; i++) {
            lastMessage.images.push({
              url: 'generating:placeholder',
              name: _capturedImagePrompt || 'AI 绘制中',
              isPlaceholder: true,
              isGenerating: true,
            } as any);
          }
          setCollapsedDescriptions(prev => { const newSet = new Set(prev); newSet.add(newMessages.length - 1); return newSet; });
        }
        return newMessages;
      });
    },
    onImage: (data: any) => {
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          lastMessage.content += `\n\n![AI_IMG](${data.imageUrl})`;
          const imageObj = { url: data.imageUrl, name: data.prompt, placeholderUrl: data.placeholderUrl, imagePrompt: data.prompt };
          if (lastMessage.images) {
            // ★ 优先替换 isGenerating 占位，其次替换 isPlaceholder 占位
            const genIdx = lastMessage.images.findIndex((img: any) => img.isGenerating);
            const placeholderIndex = genIdx !== -1 ? genIdx : lastMessage.images.findIndex((img: any) => img.isPlaceholder);
            if (placeholderIndex !== -1) {
              lastMessage.images[placeholderIndex] = imageObj;
            } else { lastMessage.images.push(imageObj); }
          } else { lastMessage.images = [imageObj]; }
          setCollapsedDescriptions(prev => { const newSet = new Set(prev); newSet.add(newMessages.length - 1); return newSet; });
        }
        return newMessages;
      });
    },
    onImageStage: (data: any) => {
      setImageGenStage({
        stage: data.stage,
        prompt: data.prompt,
        error: data.error,
        errorType: data.errorType,
        timestamp: data.timestamp,
      });
    },
    onImageProgress: (data: any) => {
      setImageGenProgress({
        attempt: data.attempt,
        maxAttempts: data.maxAttempts,
        status: data.status,
        timestamp: data.timestamp,
      });
    },
    // ═══════ 轻量联网搜索 ═══════
    onWebSearchStart: (data: any) => {
      setWebSearchQuery(data.query || '');
    },
    onWebSearchResult: (data: any) => {
      // 将搜索来源存储到最后一条 assistant 消息上
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          (lastMessage as any).webSearchSources = data.sources || [];
          (lastMessage as any).webSearchQuery = data.query || '';
        }
        return newMessages;
      });
    },
    onWebSearchDone: () => {
      setWebSearchQuery(null);
    },
    // ═══════ 网页抓取 ═══════
    onUrlFetchStart: (data: any) => {
      // 复用 webSearchQuery 状态显示阅读进度
      setWebSearchQuery(`📄 ${data.url?.substring(0, 50) || '网页'}...`);
      // 如果有浏览会话 ID，打开沙箱面板
      if (data.browseSessionId) {
        setActiveResearchTaskId(data.browseSessionId);
      }
    },
    onUrlFetchResult: (data: any) => {
      setWebSearchQuery(null);
      // 将抓取来源存储到消息上
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          const existingSources = (lastMessage as any).webSearchSources || [];
          if (data.url) {
            existingSources.push({ title: data.title || data.url, url: data.url });
            (lastMessage as any).webSearchSources = existingSources;
          }
        }
        return newMessages;
      });
    },
    onDone: (data: any) => {
      setThinkingStage('idle');
      if (conversationId) {
        const task = streamManager.getTask(conversationId);
        if (task) task.globalHandlerFired = true;
      }

      const isBackgroundCompletion = selectedConvIdRef.current !== conversationId;
      if (isBackgroundCompletion) {
        streamingForConvIdRef.current = null;
        streamedContentRef.current = '';
        onStreamComplete();
        refetchBalance();
        refetchConversations();
        if (conversationId) streamManager.clearTask(conversationId);
        return;
      }

      streamingForConvIdRef.current = null;
      const respondedAt = Date.now();
      const finalContent = data.message || streamedContentRef.current || streamedContent || '';
      streamedContentRef.current = '';

      // 检测文件生成操作日志
      const fileBlockPattern = new RegExp('`{3}file:([^\\n`]+)\\n([\\s\\S]*?)`{3}', 'g');
      let fileMatch;
      while ((fileMatch = fileBlockPattern.exec(finalContent)) !== null) {
        const fileName = fileMatch[1].trim();
        const fileOp = { id: `op-file-${Date.now()}-${Math.random()}`, action: '生成文件', target: fileName, operationStatus: 'completed' as const, timestamp: Date.now() };
        setOperationLogs(prev => { const newLogs = [...prev, fileOp]; if (selectedConversationId) saveOperationLogs(selectedConversationId.toString(), newLogs); return newLogs; });
      }

      if (isTtsAutoMode) { streamingTts.flush(); setTimeout(() => setPlayingTtsIndex(null), 500); (state as any).setIsTtsAutoMode?.(false); }

      const thinkingStepsToSave = currentThinkingSteps.length > 0 ? [...currentThinkingSteps] : undefined;
      setThinkingStartTime(null);
      setCurrentThinkingSteps([]);
      onStreamComplete();

      // 更新最后一条助手消息
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const origMsg = newMessages[lastIdx];
        if (origMsg && origMsg.role === 'assistant') {
          const lastMessage = { ...origMsg };
          newMessages[lastIdx] = lastMessage;
          lastMessage.content = finalContent || origMsg.content || '';
          // ★ 清理残留的 isGenerating 占位图（错误时未被 onImage 替换）
          if (lastMessage.images) {
            lastMessage.images = lastMessage.images.filter((img: any) => !img.isGenerating);
            if (lastMessage.images.length === 0) delete (lastMessage as any).images;
          }
          lastMessage.respondedAt = respondedAt;
          const userMessage = newMessages[newMessages.length - 2];
          if (userMessage && userMessage.role === 'user' && userMessage.sentAt) lastMessage.sentAt = userMessage.sentAt;
          if (thinkingStepsToSave) (lastMessage as any).thinkingSteps = thinkingStepsToSave;
          const latestOperationLogs = operationLogsRef.current;
          if (latestOperationLogs.length > 0) (lastMessage as any).operationLogs = [...latestOperationLogs];
          if (lastMessage.sentAt && lastMessage.respondedAt) (lastMessage as any).thinkingTime = (lastMessage.respondedAt - lastMessage.sentAt) / 1000;
          if (_capturedThinkingSummary) (lastMessage as any).thinkingSummary = _capturedThinkingSummary;
          // 保存深度推理内容（供折叠回看）
          const savedReasoning = reasoningContentRef.current;
          if (savedReasoning && savedReasoning.length > 0) (lastMessage as any).reasoningContent = savedReasoning;
          // ★ 附加文件包下载链接
          if (data.filePackageUrl) (lastMessage as any).filePackageUrl = data.filePackageUrl;
          const msgContent = typeof lastMessage.content === 'string' ? lastMessage.content : '';
          const researchMatch = msgContent.match(/<ResearchTaskCard\s+taskId="(\d+)"/);
          if (researchMatch && !(lastMessage as any).isResearchTask) {
            const taskId = parseInt(researchMatch[1]);
            (lastMessage as any).isResearchTask = true;
            (lastMessage as any).researchTaskId = taskId;
            (lastMessage as any).researchPrompt = (msgContent.match(/prompt="([^"]*)"/) || [])[1] || '';
            setTimeout(() => setActiveResearchTaskId(taskId), 100);
            // 注册到研究任务追踪器（支持后台徽章显示）
            if (conversationId) researchTaskRegistry.register(conversationId, taskId);
          }
        }
        return newMessages;
      });

      setIsStreamingMessage(false);
      if (conversationId) streamManager.clearTask(conversationId);
      refetchBalance();
      // ★ filePackageUrl 在 setMessages 内部设置后可能不触发子组件重渲染，
      // 延迟强制刷新一次确保下载按钮立即显示
      if (data.filePackageUrl) {
        setTimeout(() => setMessages(prev => [...prev]), 150);
      }

      // 流完成后自动持久化消息到数据库（防止刷新后丢失）
      if (conversationId) {
        const saveMessagesMutation = (state as any).saveMessagesMutation;
        setTimeout(() => {
          setMessages((currentMsgs: any[]) => {
            const toSave = currentMsgs.filter((m: any) => m.role !== 'system');
            if (toSave.length > 0 && saveMessagesMutation) {
              saveMessagesMutation.mutate({
                conversationId,
                messages: JSON.stringify(toSave),
              });
            } else if (toSave.length > 0) {
              trpcClient.conversation.saveMessages.mutate({
                conversationId,
                messages: JSON.stringify(toSave),
              }).catch((err: any) => console.error('[Stream] Auto-save failed:', err.message));
            }
            return currentMsgs;
          });
        }, 200);
      }

      // 异步生成标题 — ★ 仅在第一条用户消息时触发（避免每次对话都浪费一次 LLM 调用）
      if (conversationId) {
        const userMessages = messages.filter(m => m.role === 'user');
        if (userMessages.length <= 1) {
          const userMessageContent = userMessages[0]?.content || '';
          generateTitleMutation.mutate(
            { conversationId, userMessage: typeof userMessageContent === 'string' ? userMessageContent : '' },
            { onSuccess: () => refetchConversations(), onError: (error: any) => console.error('生成标题失败:', error) }
          );
        }
      }

      // 生成推荐追问（仅当用户仍在当前对话时）
      const hasResearchCard = streamedContent.includes('<ResearchTaskCard') || streamedContent.includes('ResearchTaskCard');
      if (streamedContent && !hasResearchCard && conversationId === selectedConvIdRef.current) {
        const lastMsgs = messages;
        const userMessageContent = [...lastMsgs].reverse().find(m => m.role === 'user')?.content || '';
        const isAutomationDone = streamedContent.includes('任务状态更新') || streamedContent.includes('已成功发布') || streamedContent.includes('任务已完成') || streamedContent.includes('新帖子创建');
        if (isAutomationDone) {
          setSuggestedQuestions(['继续发帖运营', '发布下一篇技术文章', '换个主题再发一篇']);
        } else {
          generateSuggestedQuestions(streamedContent, typeof userMessageContent === 'string' ? userMessageContent : '', undefined, conversationId);
        }
      }

      // 文档整理完成后自动导出
      if (data.isDocumentGeneration && data.requestedFormat && finalContent.length > 100) {
        const docTitle = `AI整理文档-${new Date().toLocaleDateString('zh-CN')}`;

        // 优先提取 ```file:xxx\n内容\n``` 块中的实际内容
        // 如果没有文件块，则使用完整回复（去掉多余说明行）
        let cleanContent = finalContent;
        const fileBlockMatch = finalContent.match(/```(?:file:[^\n]*)?\n([\s\S]*?)```/);
        if (fileBlockMatch) {
          cleanContent = fileBlockMatch[1].trim();
        } else {
          // 没有文件块：去掉"正在生成..."等提示行，保留实质内容
          cleanContent = finalContent
            .replace(/[（(]系统正在生成[^）)]*[）)]/g, '')
            .replace(/✅\s*PDF已生成[！!]?/g, '')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        }

        if (data.requestedFormat === 'pdf') {
          setTimeout(() => {
            const toastId = toast.loading('正在自动生成PDF文档...');
            exportContentPdfMutation.mutate({ content: cleanContent, title: docTitle }, {
              onSuccess: (result: any) => { toast.success('PDF文档已生成！正在下载...', { id: toastId }); const a = document.createElement('a'); a.href = result.url; a.download = result.filename; a.click(); },
              onError: () => { toast.error('PDF自动生成失败，请点击消息下方的导出按钮手动导出', { id: toastId }); },
            });
          }, 500);
        } else if (data.requestedFormat === 'word') {
          setTimeout(() => {
            const toastId = toast.loading('正在自动生成Word文档...');
            generateDocumentMutation.mutate({ title: docTitle, content: cleanContent }, {
              onSuccess: (result: any) => { toast.success('Word文档已生成！正在下载...', { id: toastId }); const a = document.createElement('a'); a.href = result.url; a.download = result.fileName; a.click(); },
              onError: (error: any) => { toast.error(error.message || 'Word自动生成失败', { id: toastId }); },
            });
          }, 500);
        }
      }
    },
    onError: (error: string) => {
      const isBackgroundError = selectedConvIdRef.current !== conversationId;
      if (isBackgroundError) {
        streamingForConvIdRef.current = null; streamedContentRef.current = ''; onStreamComplete();
        if (conversationId) streamManager.clearTask(conversationId); return;
      }
      streamingForConvIdRef.current = null;
      setIsStreamingMessage(false);
      setThinkingStage('idle');
      setThinkingStartTime(null);
      onStreamComplete();

      let userFriendlyError = '';
      let errorIcon = '⚠️';
      // 判断是否为"发送前就被拦截"的错误（配额/余额不足），此类错误没有产生任何有效输出
      const isQuotaError = error.includes('配额已用完') || error.includes('今日对话配额已用完');
      const isBalanceError = error.includes('余额不足');
      const isPreSendError = isQuotaError || isBalanceError; // 请求未开始就失败

      if (isQuotaError) { userFriendlyError = t('chat.errors.quotaExceeded'); errorIcon = '🚨'; }
      else if (error.includes('LLM stream invoke failed')) userFriendlyError = t('chat.errors.serverError');
      else if (isBalanceError) { userFriendlyError = t('chat.errors.insufficientBalance'); errorIcon = '🐟'; }
      else if (error.includes('请选择')) userFriendlyError = error;
      else if (error && error.trim().length > 0) userFriendlyError = error;
      else userFriendlyError = t('chat.errors.unknownError');

      const partialContent = streamedContentRef.current || '';
      streamedContentRef.current = '';

      // ════════════════════════════════════════════════════════════
      // 配额/余额不足 且 无有效输出：回填用户消息到输入框，不留错误气泡
      // ════════════════════════════════════════════════════════════
      if (isPreSendError && (!partialContent || partialContent.length <= 20)) {
        // 1. 从消息列表中提取用户原始内容，然后移除 [用户消息 + 空助手消息]
        let restoredText = '';
        let restoredImages: any[] = [];
        let restoredFiles: any[] = [];

        setMessages((prev: any[]) => {
          const newMessages = [...prev];
          // 找到最后一条助手消息（错误占位）和它前面的用户消息
          const lastIdx = newMessages.length - 1;
          if (lastIdx >= 0 && newMessages[lastIdx].role === 'assistant') {
            if (lastIdx >= 1 && newMessages[lastIdx - 1].role === 'user') {
              const userMsg = newMessages[lastIdx - 1];
              restoredText = typeof userMsg.content === 'string' ? userMsg.content : '';
              restoredImages = userMsg.images || [];
              restoredFiles = (userMsg as any).files || [];
              // 移除 用户消息 + 助手错误占位
              newMessages.splice(lastIdx - 1, 2);
            } else {
              // 只有助手错误占位，移除
              newMessages.splice(lastIdx, 1);
            }
          }
          return newMessages;
        });

        // 2. 回填到输入框
        setTimeout(() => {
          if (restoredText && chatInputRef?.current) {
            chatInputRef.current.setInput(restoredText);
            chatInputRef.current.focus();
          }
          if (restoredImages.length > 0) setUploadedImages(restoredImages);
          if (restoredFiles.length > 0) setUploadedFiles(restoredFiles);

          // 3. 存为草稿，刷新后仍在
          if (restoredText && saveDraft) {
            saveDraft(restoredText, restoredFiles);
          }
        }, 50);

        // 4. 提示用户
        toast.error(userFriendlyError, {
          duration: 8000,
          description: '您的消息已回填到输入框，不会丢失',
        });

        return;
      }

      // ════════════════════════════════════════════════════════════
      // 其他错误（有部分输出 或 非配额错误）：保留错误气泡 + 重试按钮
      // ════════════════════════════════════════════════════════════
      toast.error(userFriendlyError, { duration: 8000 });

      setMessages((prev) => {
        const newMessages = [...prev];
        if (newMessages.length > 0 && newMessages[newMessages.length - 1].role === 'assistant') {
          const failedUserMessage = newMessages.length >= 2 && newMessages[newMessages.length - 2].role === 'user' ? newMessages[newMessages.length - 2] : null;
          if (partialContent && partialContent.length > 20) {
            newMessages[newMessages.length - 1] = {
              role: 'assistant', content: partialContent + `\n\n---\n${errorIcon} **传输中断**：${userFriendlyError}`,
              timestamp: Date.now(), respondedAt: Date.now(), isError: true,
              failedMessage: failedUserMessage ? { content: typeof failedUserMessage.content === 'string' ? failedUserMessage.content : '', images: failedUserMessage.images, files: (failedUserMessage as any).files } : undefined,
            };
          } else {
            newMessages[newMessages.length - 1] = {
              role: 'assistant', content: `${errorIcon} **错误**\n\n${userFriendlyError}`,
              timestamp: Date.now(), isError: true,
              failedMessage: failedUserMessage ? { content: typeof failedUserMessage.content === 'string' ? failedUserMessage.content : '', images: failedUserMessage.images, files: (failedUserMessage as any).files } : undefined,
            };
          }
        }
        return newMessages;
      });
    },
  }; };

  return { _buildStreamCallbacks };
}
