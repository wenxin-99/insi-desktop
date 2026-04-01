import { toast } from 'sonner';
import { streamManager } from '@/lib/backgroundStreamManager';
import { researchTaskRegistry } from '@/lib/researchTaskRegistry';
import { saveOperationLogs } from '@/lib/operationLogStorage';
import type { ThinkingStep } from '@/components/ThinkingProcessPanel';
import type { ChatStateReturn } from '../types';
import { useMessageUtils } from './useMessageUtils';

/**
 * P2-1: 将工具类型 + 参数格式化为人类可读的描述
 */
function formatToolLabel(toolType: string, meta: any): string {
  const truncate = (s: string, max: number) => s.length > max ? s.substring(0, max) + '...' : s;
  switch (toolType) {
    case 'web_search':
      return meta?.query ? `搜索: ${truncate(meta.query, 40)}` : '联网搜索';
    case 'url_fetch':
      return meta?.url ? `阅读网页: ${truncate(meta.url, 50)}` : '阅读网页';
    case 'generate_image':
    case 'image_gen': {
      const size = meta?.size || meta?.resolution;
      return size ? `生成图片: ${size}` : '生成图片';
    }
    case 'code_gen':
      return meta?.language ? `生成代码: ${meta.language}` : '生成代码';
    case 'doc_gen':
      return meta?.title ? `生成文档: ${truncate(meta.title, 30)}` : '生成文档';
    case 'file_gen':
      return meta?.fileName ? `生成文件: ${meta.fileName}` : '生成文件';
    case 'data_analysis':
      return '数据分析';
    case 'code_interpreter':
      return '代码解释器';
    default:
      return meta?.description ? truncate(meta.description, 40) : `工具: ${toolType}`;
  }
}

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
    setActiveToolComponents,
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
    // ★ P1-1: 排队追问
    pendingMessagesRef,
    setPendingMessages,
    pendingSendRef,
  } = state as any;

  const { generateSuggestedQuestions } = useMessageUtils(state);

  const _buildStreamCallbacks = (conversationId: number, effectiveImages: any[], hasImageGenerationIntent: boolean) => {
    let _capturedThinkingSummary = '';
    let _capturedImagePrompt = ''; // 存储图片生成时 LLM 优化后的 prompt
    // ★ 闭包变量：捕获自动化/视频任务元数据，避免 React 18 批处理导致 onDone 读不到 onAutomationTask 设置的标记
    let _capturedTaskMeta: Record<string, any> | null = null;
    let _contextWarningData: { level: string; truncatedCount: number; usagePercent: number } | null = null;
    return {
    onStart: (data: any) => {
      _capturedThinkingSummary = '';
      _capturedImagePrompt = '';
      _capturedTaskMeta = null;
      setCurrentThinkingSteps([]);
      setRealtimeThinkingSteps([]);
      setOperationLogs([]);
      setThinkingSummary('');
      setActiveArtifact(null);
      setActiveToolComponents([]);
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
        previousCode: undefined as string | undefined,
        versions: [] as Array<{ version: number; code: string; timestamp: number }>,
      };
      // 写入消息 — ★ 创建新 message 对象
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const lastMessage = newMessages[lastIdx];
        if (lastMessage?.role === 'assistant') {
          // ★ T9-1: 如果已有 artifact（即版本迭代），保存旧版本到 versions 数组
          const existing = (lastMessage as any).artifact;
          if (existing && existing.code && existing.status === 'complete') {
            artifactData.previousCode = existing.code;
            const existingVersions = existing.versions || [];
            artifactData.versions = [
              ...existingVersions,
              { version: existing.version || 1, code: existing.code, timestamp: Date.now() },
            ];
          }
          newMessages[lastIdx] = { ...lastMessage, artifact: artifactData };
        }
        return newMessages;
      });
      // 同时激活右侧面板
      setActiveArtifact(artifactData);
    },
    onArtifactChunk: (data: any) => {
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const lastMessage = newMessages[lastIdx];
        if (lastMessage?.role === 'assistant' && (lastMessage as any).artifact) {
          const artifact = { ...(lastMessage as any).artifact };
          artifact.code = (artifact.code || '') + (data.chunk || '');
          newMessages[lastIdx] = { ...lastMessage, artifact };
          setActiveArtifact({ ...artifact });
        }
        return newMessages;
      });
    },
    onArtifactEnd: (data: any) => {
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const lastMessage = newMessages[lastIdx];
        if (lastMessage?.role === 'assistant' && (lastMessage as any).artifact) {
          const artifact = { ...(lastMessage as any).artifact };
          artifact.status = 'complete';
          if (data.metadata) {
            artifact.description = data.metadata.description || artifact.description;
          }
          newMessages[lastIdx] = { ...lastMessage, artifact };
          setActiveArtifact({ ...artifact });
        }
        return newMessages;
      });
    },
    // ═══════ 统一流式工具组件 ═══════
    onToolStart: (data: any) => {
      const { toolId, toolType, meta } = data;
      // P2-1: 生成人类可读的工具调用描述
      const humanLabel = formatToolLabel(toolType, meta);
      // P2-1: 同时添加一条操作步骤，让工具调用在步骤列表中可见
      const now = Date.now();
      // 简单格式（给 InlineStepList 的 thinkingSteps）
      const simpleStep = { id: `tool-${toolId}-${now}`, content: humanLabel, timestamp: now };
      setCurrentThinkingSteps((prev) => [...prev, simpleStep]);
      // 完整格式（给 ThinkingProcessPanel）
      const toolStep: ThinkingStep = {
        id: `tool-${toolId}-${now}`,
        name: humanLabel,
        status: 'running' as const,
        startTime: now,
      };
      setRealtimeThinkingSteps((prev) => {
        if (prev.length > 0) {
          const updated = [...prev];
          const lastStep = { ...updated[updated.length - 1] };
          if (lastStep.status === 'running') {
            lastStep.status = 'completed';
            lastStep.endTime = now;
            updated[updated.length - 1] = lastStep;
          }
          return [...updated, toolStep];
        }
        return [toolStep];
      });
      const toolData = {
        id: toolId,
        type: toolType,
        meta: { toolType, ...meta },
        humanLabel,
        streamedContent: '',
        status: 'streaming' as const,
        createdAt: Date.now(),
        ...(toolType === 'web_search' ? { searchResults: [], searchRound: 1, currentQuery: meta.query || '' } : {}),
      };
      setActiveToolComponents((prev: any[]) => [...prev, toolData]);
      // 同时写入消息 — ★ 创建新 message 对象
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const lastMessage = newMessages[lastIdx];
        if (lastMessage?.role === 'assistant') {
          const existing = (lastMessage as any).toolComponents || [];
          newMessages[lastIdx] = { ...lastMessage, toolComponents: [...existing, toolData] };
        }
        return newMessages;
      });
    },
    onToolChunk: (data: any) => {
      const { toolId, chunk, field, searchResult, searchRound, currentQuery } = data;
      // ★ 更新 activeToolComponents
      setActiveToolComponents((prev: any[]) => prev.map((t: any) => {
        if (t.id !== toolId) return t;
        const updated = { ...t };
        if (chunk) updated.streamedContent = (updated.streamedContent || '') + chunk;
        if (searchResult) {
          updated.searchResults = [...(updated.searchResults || []), searchResult];
        }
        if (searchRound !== undefined) updated.searchRound = searchRound;
        if (currentQuery !== undefined) updated.currentQuery = currentQuery;
        return updated;
      }));
      // ★ 同步更新 messages 中的 toolComponents（驱动 MessageItem 实时渲染）
      // ★ 关键：必须创建 NEW message 对象，不能 mutation，否则 React memo 检测不到变化
      if (chunk || searchResult) {
        setMessages((prev: any[]) => {
          const newMessages = [...prev];
          const lastIdx = newMessages.length - 1;
          const lastMessage = newMessages[lastIdx];
          if (lastMessage?.role === 'assistant' && (lastMessage as any).toolComponents?.length > 0) {
            const tools = [...(lastMessage as any).toolComponents];
            const idx = tools.findIndex((t: any) => t.id === toolId);
            if (idx >= 0) {
              const updated = { ...tools[idx] };
              if (chunk) updated.streamedContent = (updated.streamedContent || '') + chunk;
              if (searchResult) updated.searchResults = [...(updated.searchResults || []), searchResult];
              if (searchRound !== undefined) updated.searchRound = searchRound;
              if (currentQuery !== undefined) updated.currentQuery = currentQuery;
              tools[idx] = updated;
              // ★ 创建新 message 对象（非突变），确保 React 检测到变化
              newMessages[lastIdx] = { ...lastMessage, toolComponents: tools };
            }
          }
          return newMessages;
        });
      }
    },
    onToolEnd: (data: any) => {
      const { toolId, result } = data;
      // P2-1: 标记对应的工具步骤为已完成
      setRealtimeThinkingSteps((prev) => prev.map((s) => {
        if (s.id?.startsWith(`tool-${toolId}`) && s.status === 'running') {
          return { ...s, status: 'completed' as const, endTime: Date.now() };
        }
        return s;
      }));
      setActiveToolComponents((prev: any[]) => prev.map((t: any) =>
        t.id !== toolId ? t : { ...t, status: 'complete' as const, result }
      ));
      // ★ FIX: 直接在 setMessages 内更新，不依赖 setActiveToolComponents 的闭包变量
      // React 18 批处理下 updater 可能延迟执行 → finalToolData 为 null → setMessages 被跳过 → 搜索卡片永远不关闭
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const lastMessage = newMessages[lastIdx];
        if (lastMessage?.role === 'assistant') {
          const tools = [...((lastMessage as any).toolComponents || [])];
          const idx = tools.findIndex((t: any) => t.id === toolId);
          if (idx >= 0) {
            tools[idx] = { ...tools[idx], status: 'complete' as const, result };
          }
          newMessages[lastIdx] = { ...lastMessage, toolComponents: tools };
        }
        return newMessages;
      });
    },
    onToolError: (data: any) => {
      const { toolId, error } = data;
      // P2-1: 标记对应的工具步骤为失败
      setRealtimeThinkingSteps((prev) => prev.map((s) => {
        if (s.id?.startsWith(`tool-${toolId}`) && s.status === 'running') {
          return { ...s, status: 'error' as const, endTime: Date.now() };
        }
        return s;
      }));
      setActiveToolComponents((prev: any[]) => prev.map((t: any) =>
        t.id !== toolId ? t : { ...t, status: 'error' as const, error }
      ));
      // ★ FIX: 直接在 setMessages 内更新
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const lastMessage = newMessages[lastIdx];
        if (lastMessage?.role === 'assistant') {
          const tools = [...((lastMessage as any).toolComponents || [])];
          const idx = tools.findIndex((t: any) => t.id === toolId);
          if (idx >= 0) {
            tools[idx] = { ...tools[idx], status: 'error' as const, error };
          }
          newMessages[lastIdx] = { ...lastMessage, toolComponents: tools };
        }
        return newMessages;
      });
    },
    // ═══════ 作业批改结果卡片（T14-2） ═══════
    onHomeworkResult: (data: any) => {
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const lastMessage = newMessages[lastIdx];
        if (lastMessage?.role === 'assistant') {
          // ★ 创建新对象，不突变
          newMessages[lastIdx] = { ...lastMessage, homeworkResult: data };
        }
        return newMessages;
      });
    },
    // ═══════ 方案选择卡片 ═══════
    onSolutionPicker: (data: any) => {
      const pickerData = {
        id: data.id,
        question: data.question,
        options: data.options || [],
        allowCustom: data.allowCustom ?? true,
        allowSkip: data.allowSkip ?? true,
        status: 'pending',
      };
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const lastMessage = newMessages[lastIdx];
        if (lastMessage?.role === 'assistant') {
          // ★ 创建新对象，不突变
          newMessages[lastIdx] = { ...lastMessage, solutionPicker: pickerData };
        } else {
          newMessages.push({
            id: String(Date.now()),
            role: 'assistant' as const,
            content: '',
            timestamp: Date.now(),
            solutionPicker: pickerData,
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
      // ★ 闭包捕获：确保 onDone 即使在 React 批处理下也能获取到这些元数据
      _capturedTaskMeta = {
        isAutomationTask: true,
        automationTaskId: data.taskId,
        automationTaskName: data.taskName,
        automationSiteName: data.siteName,
        ...(data.allTasks && data.allTasks.length > 1 ? { automationAllTasks: data.allTasks } : {}),
      };
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const lastMessage = newMessages[lastIdx];
        if (lastMessage && lastMessage.role === 'assistant') {
          // ★ 创建新 message 对象
          const updated: any = {
            ...lastMessage,
            isAutomationTask: true,
            automationTaskId: data.taskId,
            automationTaskName: data.taskName,
            automationSiteName: data.siteName,
          };
          if (data.allTasks && data.allTasks.length > 1) {
            updated.automationAllTasks = data.allTasks;
          }
          newMessages[lastIdx] = updated;
        }
        return [...newMessages];
      });
    },
    // ★ Agent 浏览器事件
    onAgentStep: (data: any) => {
      // Agent 步骤通过 ChatAgentPanel 组件处理（由 Chat.tsx 中的 useAgentMode hook 管理）
      // 这里通过 window 事件桥接到 Chat 组件
      window.dispatchEvent(new CustomEvent('agent:sse', { detail: { type: 'agent_step', ...data } }));
    },
    onAgentConfirm: (data: any) => {
      window.dispatchEvent(new CustomEvent('agent:sse', { detail: { type: 'agent_confirm', ...data } }));
    },
    onAgentStatus: (data: any) => {
      window.dispatchEvent(new CustomEvent('agent:sse', { detail: { type: 'agent_status', ...data } }));
    },
    onIntentConfirm: (data: any) => {
      setIsStreamingMessage(false);
      setThinkingStage('idle');
      setThinkingStartTime(null);

      // ★ Native Tool 架构：视频意图走 VideoConfirmCard（保留时长/风格/费用完整 UI）
      if (data.intent === 'video_generation') {
        setMessages((prev) => {
          const newMessages = [...prev];
          const videoConfirmMsg = {
            id: String(Date.now()),
            role: 'assistant' as const,
            content: '',
            timestamp: Date.now(),
            isVideoConfirm: true,
            videoConfirmParams: {
              prompt: data.prompt || '',
              extractedDuration: data.duration || 5,
              extractedStyle: data.style || '',
              imageUrl: data.imageUrl || undefined,
              isVideoRequest: true,
              confidence: 'high',
            },
          };
          // 替换最后一条 assistant 占位消息，或追加
          const lastIdx = newMessages.length - 1;
          if (lastIdx >= 0 && newMessages[lastIdx].role === 'assistant') {
            newMessages[lastIdx] = videoConfirmMsg as any;
          } else {
            newMessages.push(videoConfirmMsg as any);
          }
          return newMessages;
        });
        return;
      }

      // ★ Native Tool 架构：深度调研意图走 ResearchConfirmCard
      if (data.intent === 'deep_research') {
        setMessages((prev) => {
          const newMessages = [...prev];
          const researchConfirmMsg = {
            id: String(Date.now()),
            role: 'assistant' as const,
            content: '',
            timestamp: Date.now(),
            isResearchConfirm: true,
            researchConfirmParams: {
              prompt: data.prompt || '',
              confidence: 'high' as const,
              method: 'llm' as const,
              originalMessage: data.prompt || '',
            },
          };
          const lastIdx = newMessages.length - 1;
          if (lastIdx >= 0 && newMessages[lastIdx].role === 'assistant') {
            newMessages[lastIdx] = researchConfirmMsg as any;
          } else {
            newMessages.push(researchConfirmMsg as any);
          }
          return newMessages;
        });
        return;
      }

      // 其他意图走通用 IntentConfirmCard
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
          // ★ 优先用服务端下发的 index 精准定位槽位
          const targetIdx = typeof data.index === 'number' ? data.index : -1;
          if (targetIdx >= 0 && targetIdx < lastMessage.images.length) {
            lastMessage.images[targetIdx] = { url: data.placeholderUrl, name: data.prompt, isPlaceholder: true };
          } else {
            // 兜底：替换第一个 isGenerating 占位图
            const genIdx = lastMessage.images.findIndex((img: any) => img.isGenerating);
            if (genIdx !== -1) {
              lastMessage.images[genIdx] = { url: data.placeholderUrl, name: data.prompt, isPlaceholder: true };
            } else {
              lastMessage.images.push({ url: data.placeholderUrl, name: data.prompt, isPlaceholder: true });
            }
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
            // ★ 优先用服务端下发的 index 精准定位槽位
            const targetIdx = typeof data.index === 'number' ? data.index : -1;
            if (targetIdx >= 0 && targetIdx < lastMessage.images.length) {
              lastMessage.images[targetIdx] = imageObj;
            } else {
              // 兜底：优先替换 isGenerating 占位，其次替换 isPlaceholder 占位
              const genIdx = lastMessage.images.findIndex((img: any) => img.isGenerating);
              const placeholderIndex = genIdx !== -1 ? genIdx : lastMessage.images.findIndex((img: any) => img.isPlaceholder);
              if (placeholderIndex !== -1) {
                lastMessage.images[placeholderIndex] = imageObj;
              } else { lastMessage.images.push(imageObj); }
            }
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
    // ★ 单张图片生成失败时，移除该槽位的占位图
    onImageFailed: (data: any) => {
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant' && lastMessage.images) {
          const targetIdx = typeof data.index === 'number' ? data.index : -1;
          if (targetIdx >= 0 && targetIdx < lastMessage.images.length) {
            lastMessage.images.splice(targetIdx, 1);
          } else {
            // 兜底：移除第一个 isGenerating 占位
            const genIdx = lastMessage.images.findIndex((img: any) => img.isGenerating);
            if (genIdx !== -1) lastMessage.images.splice(genIdx, 1);
          }
          if (lastMessage.images.length === 0) delete (lastMessage as any).images;
        }
        return newMessages;
      });
    },
    // ═══════ 轻量联网搜索 ═══════
    onWebSearchStart: (data: any) => {
      setWebSearchQuery(data.query || '');
    },
    onWebSearchResult: (data: any) => {
      // 将搜索来源存储到最后一条 assistant 消息上
      // ★ 多轮搜索修复：追加合并而非覆盖，按 URL 去重
      const newSources = data.sources || [];
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          const existing: Array<{ title: string; url: string }> = (lastMessage as any).webSearchSources || [];
          const existingUrls = new Set(existing.map((s: any) => s.url));
          const merged = [...existing, ...newSources.filter((s: any) => s.url && !existingUrls.has(s.url))];
          (lastMessage as any).webSearchSources = merged;
          (lastMessage as any).webSearchQuery = data.query || '';
        }
        return newMessages;
      });
    },
    onWebSearchDone: () => {
      setWebSearchQuery(null);
    },
    onWebSearchProgress: (data: any) => {
      // 多轮搜索进度 → 更新搜索状态显示
      if (data.phase === 'searching' && data.query) {
        setWebSearchQuery(`🔄 [${data.totalSearches}] ${data.query}`);
      } else if (data.phase === 'iterating') {
        setWebSearchQuery(`🔄 已搜索 ${data.totalSearches} 次，正在分析是否需要补充...`);
      } else if (data.phase === 'done') {
        // 不立即清除，让 web_search_done 事件处理
      }
      // 同时更新消息上的搜索计数
      setMessages((prev: any[]) => {
        const newMessages = [...prev];
        const lastMessage = newMessages[newMessages.length - 1];
        if (lastMessage?.role === 'assistant') {
          (lastMessage as any).searchProgress = {
            phase: data.phase,
            totalSearches: data.totalSearches,
            iteration: data.iteration,
          };
        }
        return newMessages;
      });
    },
    // ═══════ 网页抓取 ═══════
    onUrlFetchStart: (data: any) => {
      // 复用 webSearchQuery 状态显示阅读进度
      setWebSearchQuery(`📄 ${data.url?.substring(0, 50) || '网页'}...`);
      // ★ 不再自动打开沙箱面板 — URL 浏览进度已通过搜索卡片展示
      // 沙箱面板仅在用户主动触发代理任务时打开
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
    // ★ 上下文窗口警告
    onContextWarning: (data: any) => {
      _contextWarningData = data;
      console.log(`[ContextWarning] level=${data.level}, truncated=${data.truncatedCount}, usage=${data.usagePercent}%`);
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
      // ★ 在 updater 中捕获最终消息，供立即持久化使用
      let _messagesToPersist: any[] | null = null;
      let _isConfirmCard = false;
      setMessages((prev) => {
        const newMessages = [...prev];
        const lastIdx = newMessages.length - 1;
        const origMsg = newMessages[lastIdx];
        // ★ 确认卡片保护：如果最后一条消息是意图确认卡片（Research/Video/Intent），
        //   跳过 onDone 的内容覆盖和属性修改，避免破坏卡片状态和交互
        if (origMsg && ((origMsg as any).isResearchConfirm || (origMsg as any).isVideoConfirm || (origMsg as any).isIntentConfirm)) {
          _isConfirmCard = true;
          _messagesToPersist = newMessages.filter((m: any) => m.role !== 'system');
          return newMessages;
        }
        if (origMsg && origMsg.role === 'assistant') {
          const lastMessage = { ...origMsg };
          newMessages[lastIdx] = lastMessage;
          lastMessage.content = finalContent || origMsg.content || '';
          // ★ 清理残留的 isGenerating 和 isPlaceholder 占位图（未被 onImage 替换的孤儿）
          if (lastMessage.images) {
            lastMessage.images = lastMessage.images.filter((img: any) => !img.isGenerating && !img.isPlaceholder);
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
          // ★ 回复被截断标记（服务端 auto-continuation 后仍不完整）
          if ((data as any).truncated) {
            lastMessage.content = (lastMessage.content || '') + '\n\n---\n> ⚠️ 回复内容较长已被截断，发送"继续"可接续阅读。';
          }
          // ★ 上下文窗口警告：对话过长，AI 已丢失早期记忆
          if (_contextWarningData) {
            const w = _contextWarningData;
            const hint = w.level === 'critical'
              ? `\n\n---\n> ⚠️ 当前对话已非常长（上下文使用 ${w.usagePercent}%），AI 已压缩 ${w.truncatedCount} 条早期消息，可能无法记住前面的内容。**强烈建议新建对话继续。**`
              : w.truncatedCount > 0
                ? `\n\n---\n> 💡 对话较长（上下文 ${w.usagePercent}%），${w.truncatedCount} 条早期消息已被压缩。如果 AI 遗忘了之前的内容，可以新建对话。`
                : '';
            if (hint) lastMessage.content = (lastMessage.content || '') + hint;
            _contextWarningData = null;
          }
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
          // ★ 合并闭包捕获的任务元数据（防止 React 18 批处理丢失 onAutomationTask 的标记）
          if (_capturedTaskMeta) {
            Object.assign(lastMessage, _capturedTaskMeta);
          }
        }
        // ★ 捕获最终消息用于立即持久化（在 React 状态更新的同一微任务中）
        _messagesToPersist = newMessages.filter((m: any) => m.role !== 'system');
        return newMessages;
      });

      setIsStreamingMessage(false);
      if (conversationId) streamManager.clearTask(conversationId);
      refetchBalance();

      // ★ 确认卡片场景：跳过标题生成、推荐追问等后处理，避免干扰用户交互
      if (_isConfirmCard) {
        onStreamComplete();
        // 仍需持久化（确保刷新后卡片不丢失），但不触发标题生成和推荐追问
        if (conversationId) {
          queueMicrotask(() => {
            const toSave = _messagesToPersist;
            if (toSave && toSave.length > 0) {
              trpcClient.conversation.saveMessages.mutate({
                conversationId: conversationId!,
                messages: JSON.stringify(toSave),
              }).then(() => refetchConversations()).catch(() => refetchConversations());
            } else {
              refetchConversations();
            }
          });
        }
        return;
      }

      // ★ 自动化任务场景：服务端已通过 saveToConversation 写入完整元数据，
      //   跳过客户端 saveMessages 避免覆盖（客户端消息可能缺少 isAutomationTask 等标记）
      if (_capturedTaskMeta) {
        setIsStreamingMessage(false);
        onStreamComplete();
        // ★ 不调用 refetchConversations → loadConversationMessages → restoreResearchTaskFromMessages
        //   否则 DB 消息可能还没写入 isAutomationTask 标记，导致 activeResearchTaskId 被清除
        //   改为延迟刷新，给服务端 saveToConversation 足够时间
        if (conversationId) {
          streamManager.clearTask(conversationId);
          setTimeout(() => refetchConversations(), 2000);
        }
        return;
      }

      // ★ filePackageUrl 在 setMessages 内部设置后可能不触发子组件重渲染，
      // 延迟强制刷新一次确保下载按钮立即显示
      if (data.filePackageUrl) {
        setTimeout(() => setMessages(prev => [...prev]), 150);
      }

      // ★ 流完成后立即持久化消息到数据库（不再用 setTimeout 延迟）
      // 旧逻辑：200ms setTimeout → 在此期间 refetchConversations/generateTitle 可能
      //   触发 loadConversationMessages → 从 DB 读到空消息 → 覆盖 React state → 消息丢失
      // 新逻辑：queueMicrotask 确保在 React batch 刷新后立即保存，
      //   然后才触发 refetchConversations，保证 DB 中已有最新消息
      if (conversationId) {
        queueMicrotask(() => {
          const toSave = _messagesToPersist;
          if (toSave && toSave.length > 0) {
            trpcClient.conversation.saveMessages.mutate({
              conversationId: conversationId!,
              messages: JSON.stringify(toSave),
            }).then(() => {
              // ★ 保存成功后才刷新对话列表，此时 DB 中已有最新消息
              refetchConversations();
            }).catch((err: any) => {
              console.error('[Stream] Auto-save failed:', err.message);
              // 保存失败也要刷新（不阻塞 UI）
              refetchConversations();
            });
          } else {
            refetchConversations();
          }
        });
      }

      // ★ 标题生成已由服务端 save.ts triggerAutoTitle 异步处理，
      //   无需前端再发 generateTitleMutation（双路径竞争会导致 Gemini 空消息超时错误）

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

      // ★ P1-1: 消费排队消息 — 流完成后自动发送下一条
      const currentQueue = pendingMessagesRef?.current;
      if (currentQueue && currentQueue.length > 0) {
        const [nextMsg, ...rest] = currentQueue;
        setPendingMessages(rest);
        // 延迟发送，确保上一条消息完全持久化
        setTimeout(() => {
          if (pendingSendRef?.current) {
            pendingSendRef.current(nextMsg);
          }
        }, 500);
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
