/**
 * useConversation — 对话管理
 * 
 * 处理对话创建/删除、消息加载/缓存、消息解析/去重、停止流式传输。
 * 
 * 原始位置: Chat.tsx L1340-1780, L3028-3040
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import { streamManager } from '@/lib/backgroundStreamManager';
import { saveOperationLogs, loadOperationLogs, deleteOperationLogs } from '@/lib/operationLogStorage';
import type { ChatStateReturn, ChatMessage, OperationLog } from '../types';

export function useConversation(state: ChatStateReturn) {
  const {
    t, utils, messages, setMessages,
    selectedConversationId, setSelectedConversationId,
    selectedPackageId, setSelectedPackageId,
    selectedModelId,
    modelPackages, chatModels, currentUser,
    createConversationMutation, deleteConversationMutation,
    refetchConversations, refetchBalance,
    setIsStreamingMessage, setIsLoadingMessages,
    setSuggestedQuestions,
    setPreviewFile, setPreviewFiles, setActivePreviewIndex,
    setActiveResearchTaskId,
    setOperationLogs, setCollapsedDescriptions,
    setCurrentThinkingSteps, setRealtimeThinkingSteps,
    setThinkingStartTime, setThinkingStage,
    previewFile, operationLogs, collapsedDescriptions,
    currentThinkingSteps, realtimeThinkingSteps,
    activeResearchTaskId,
    lastFileNameRef, previewOpenedRef,
    streamedContentRef, streamingForConvIdRef, selectedConvIdRef,
    reasoningContentRef,
    messageCacheRef, initialLoadDoneRef,
    operationLogsRef, isStreaming, isStreamingMessage,
    abortStream, streamedContent, onStreamComplete,
    userScrolledUpRef,
    CACHE_TTL,
  } = state;

  // ═══════════ 解析消息为显示格式 ═══════════

  const parseDisplayMessages = useCallback((parsedMessages: any[]) => {
    // 去重：移除重复用户消息
    const deduped: any[] = [];
    for (let i = 0; i < parsedMessages.length; i++) {
      const msg = parsedMessages[i];
      if (msg.role === 'user' && deduped.length > 0) {
        const lastSameRole = [...deduped].reverse().find(m => m.role === 'user');
        if (lastSameRole) {
          const extractText = (content: any): string => {
            if (typeof content === 'string') return content;
            if (Array.isArray(content)) return content.filter((p: any) => p.type === 'text').map((p: any) => p.text).join('');
            return String(content || '');
          };
          const textA = extractText(msg.content);
          const textB = extractText(lastSameRole.content);

          if (textA === textB) {
            const getImageUrls = (m: any): string[] => {
              const urls: string[] = [];
              if (m.images) m.images.forEach((img: any) => urls.push(typeof img === 'string' ? img : img.url));
              if (Array.isArray(m.content)) m.content.filter((p: any) => p.type === 'image_url').forEach((p: any) => urls.push(p.image_url?.url));
              return urls.sort();
            };
            const imagesA = getImageUrls(msg);
            const imagesB = getImageUrls(lastSameRole);
            const sameImages = imagesA.length === imagesB.length && imagesA.every((url: string, idx: number) => url === imagesB[idx]);
            const timeDiff = Math.abs((msg.timestamp || msg.sentAt || 0) - (lastSameRole.timestamp || lastSameRole.sentAt || 0));
            const shouldDedup = (imagesA.length > 0 && sameImages) || timeDiff < 60000;
            if (shouldDedup) {
              continue;
            }
          }
        }
      }
      deduped.push(msg);
    }

    const displayMessages = deduped.map((msg: any) => {
      // ★ Artifact 恢复：从 content 中的代码块重建丢失的 artifact（历史数据兼容）
      if (msg.role === 'assistant' && !msg.artifact && typeof msg.content === 'string') {
        const artifactMatch = msg.content.match(
          /```(?:artifact:([^\n]*)|(?:(html|jsx|tsx|vue|css|react)\s*\n))([\s\S]*?)```/
        );
        if (artifactMatch) {
          const title = (artifactMatch[1] || '').trim();
          const lang = artifactMatch[2] || 'html';
          const code = (artifactMatch[3] || '').trim();
          // 只有代码足够长且像 UI 内容才重建
          if (code.length > 100 && (/<(!DOCTYPE|html|div|head|body|style|script)/i.test(code) || ['react','jsx','tsx','vue'].includes(lang))) {
            const langMap: Record<string, string> = { html: 'html', jsx: 'react', tsx: 'react', vue: 'vue', css: 'css', react: 'react' };
            msg = { ...msg, artifact: {
              id: `art_recovered_${msg.timestamp || Date.now()}`,
              title: title || (langMap[lang] === 'react' ? 'React 组件预览' : '界面预览'),
              language: langMap[lang] || 'html',
              code,
              version: 1,
              status: 'complete',
              description: '',
            }};
          }
        }
      }
      if (msg.isResearchTask) return { ...msg, isResearchTask: true, researchTaskId: msg.researchTaskId, researchPrompt: msg.researchPrompt };
      if (msg.isAutomationTask) return { ...msg, isAutomationTask: true, automationTaskId: msg.automationTaskId, automationTaskName: msg.automationTaskName, automationSiteName: msg.automationSiteName };
      // ★ 自动化任务恢复：从消息内容中检测并恢复丢失的元数据（历史数据兼容）
      if (msg.role === 'assistant' && !msg.isAutomationTask && typeof msg.content === 'string') {
        const isAutoMsg = /已为\s*\d+\s*个账号(?:创建|继续创建)(?:自动化)?任务/.test(msg.content)
          || /自动化任务已创建并启动/.test(msg.content)
          || /已继续自动化任务/.test(msg.content);
        if (isAutoMsg) {
          const taskIdMatches = [...msg.content.matchAll(/任务\s*#(\d+)/g)];
          const firstTaskId = taskIdMatches.length > 0 ? parseInt(taskIdMatches[0][1]) : undefined;
          const accountMatches = [...msg.content.matchAll(/账号\s*\*{0,2}(\S+?)\*{0,2}\s*→\s*任务\s*#(\d+)/g)];
          const allTasks = accountMatches.length > 1
            ? accountMatches.map(m => ({ taskId: parseInt(m[2]), username: m[1], taskName: m[1] }))
            : undefined;
          return { ...msg, isAutomationTask: true, automationTaskId: firstTaskId, automationTaskName: '自动化任务', automationSiteName: '', ...(allTasks ? { automationAllTasks: allTasks } : {}), timestamp: msg.timestamp || msg.sentAt || Date.now() };
        }
      }
      if (msg.isVideoTask) return { ...msg, isVideoTask: true, videoTaskId: msg.videoTaskId, videoPrompt: msg.videoPrompt || msg.content, timestamp: msg.timestamp || msg.sentAt || msg.respondedAt || Date.now() };
      if (typeof msg.content === 'object' && Array.isArray(msg.content)) {
        let textContent = '';
        const images: Array<{ url: string; name: string }> = [];
        let files: Array<{ name: string; url: string; size: number }> | undefined;
        for (const part of msg.content) {
          if (part.type === 'text') textContent += part.text;
          else if (part.type === 'image_url') images.push({ url: part.image_url.url, name: '图片' });
          else if (part.type === 'file_url') {
            if (!files) files = [];
            files.push({ name: part.file_url?.filename || part.file_url?.url?.split('/').pop() || '文件', url: part.file_url?.url || '', size: 0 });
          }
        }
        return { ...msg, content: msg._displayContent !== undefined ? msg._displayContent : (textContent || (images.length > 0 ? '[图片]' : '')), images: images.length > 0 ? images : undefined, files: files && files.length > 0 ? files : undefined, timestamp: msg.timestamp || msg.sentAt || msg.respondedAt || Date.now() };
      }
      return {
        ...msg,
        content: (() => {
          if (msg._displayContent !== undefined) return msg._displayContent;
          if (typeof msg.content === 'string' && msg.role === 'user') {
            const enhanced = msg.content.match(/^继续生成类似图片（基于之前的(?:描述|内容)：[\s\S]+）$/);
            if (enhanced) return '继续';
            // 新格式：用户原话 + [上一次生成的图片描述参考：...] → 只显示用户原话
            const refIdx = msg.content.indexOf('\n\n[上一次生成的图片描述参考：');
            if (refIdx > 0) return msg.content.substring(0, refIdx);
          }
          return msg.content;
        })(),
        timestamp: msg.timestamp || msg.sentAt || msg.respondedAt || Date.now(),
      };
    });
    return displayMessages.filter((m: any) => m.role !== 'system');
  }, []);

  // ═══════════ 计算折叠索引 ═══════════

  const computeCollapsedIndices = useCallback((displayMessages: any[]) => {
    const indices = displayMessages
      .map((msg: any, index: number) => msg.images && msg.images.length > 0 ? index : -1)
      .filter((index: number) => index !== -1);
    return new Set(indices);
  }, []);

  // ═══════════ 缓存管理 ═══════════

  const saveToMessageCache = useCallback((conversationId: number, msgs: ChatMessage[], collapsed: Set<number>, logs: OperationLog[]) => {
    messageCacheRef.current.set(conversationId, {
      messages: msgs,
      collapsedDescriptions: collapsed,
      operationLogs: logs,
      activeResearchTaskId: activeResearchTaskId,
      timestamp: Date.now(),
    });
    if (messageCacheRef.current.size > 20) {
      const oldestKey = messageCacheRef.current.keys().next().value;
      if (oldestKey !== undefined) messageCacheRef.current.delete(oldestKey);
    }
  }, [activeResearchTaskId, messageCacheRef]);

  // ═══════════ 恢复研究任务 ═══════════

  const restoreResearchTaskFromMessages = useCallback((msgs: ChatMessage[]) => {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const msg = msgs[i] as any;
      if (msg.isResearchTask && msg.researchTaskId) {
        setActiveResearchTaskId(msg.researchTaskId);
        return;
      }
      // ★ 自动化任务也使用 activeResearchTaskId 驱动沙箱面板
      if (msg.isAutomationTask && msg.automationTaskId) {
        setActiveResearchTaskId(msg.automationTaskId);
        return;
      }
      const content = typeof msg.content === 'string' ? msg.content : '';
      const match = content.match(/<ResearchTaskCard\s+taskId="(\d+)"/);
      if (match) {
        setActiveResearchTaskId(parseInt(match[1]));
        return;
      }
    }
    // 没有找到沙箱任务 → 清除旧值
    setActiveResearchTaskId(null);
    (state as any).setActiveArtifact?.(null);
  }, [setActiveResearchTaskId]);

  // ═══════════ 加载对话消息 ═══════════

  const loadConversationMessages = async (conversationId: number, options?: { forceRefresh?: boolean }) => {
    try {
      const prevConvId = selectedConvIdRef.current;

      // 离开当前对话时：缓存消息 + 如果有运行中的流，缓存流状态
      if (prevConvId && prevConvId !== conversationId) {
        if (messages.length > 0) {
          saveToMessageCache(prevConvId, messages, collapsedDescriptions, operationLogs);
        }
        if (streamManager.isRunning(prevConvId)) {
          streamManager.saveClientState(prevConvId, {
            messages: [...(messages || [])],
            operationLogs: [...operationLogs],
            thinkingSteps: [...currentThinkingSteps],
            realtimeThinkingSteps: [...realtimeThinkingSteps],
            previewFile: previewFile,
          });
          setIsStreamingMessage(false);
        }
      }

      // 如果点击的是当前已选中的对话，直接返回
      if (prevConvId === conversationId && messages.length > 0 && !options?.forceRefresh) return;

      // 检查后台运行中的流
      const bgTask = streamManager.getTask(conversationId);
      if (bgTask && bgTask.status === 'running') {
        if (bgTask.cachedClientState) {
          const cached = bgTask.cachedClientState;
          setMessages(cached.messages);
          setOperationLogs(cached.operationLogs);
          setCurrentThinkingSteps(cached.thinkingSteps);
          setRealtimeThinkingSteps(cached.realtimeThinkingSteps);
          setPreviewFile(cached.previewFile);
          restoreResearchTaskFromMessages(cached.messages);
        } else {
          // 没有缓存状态（第一次切回来）：显示已有消息或清空等待流内容
          if (bgTask.fullContent) {
            // 流已有内容：保持当前消息不变，等 useBackgroundStream 回放内容
          }
        }
        setIsStreamingMessage(true);
        setThinkingStartTime(bgTask.startedAt);
        return; // ← 统一在此 return，不再落入服务端加载
      }

      // 后台已完成的任务：清理并从服务端加载最新数据
      if (bgTask && (bgTask.status === 'completed' || bgTask.status === 'error')) {
        streamManager.clearTask(conversationId);
        setIsStreamingMessage(false);
        refetchBalance();
        refetchConversations();
        messageCacheRef.current.delete(conversationId);
      }

      // 检查内存缓存
      const cached = messageCacheRef.current.get(conversationId);
      const isCacheValid = cached && (Date.now() - cached.timestamp < CACHE_TTL);

      if (isCacheValid && !options?.forceRefresh) {
        setPreviewFile(null);
        lastFileNameRef.current = null;
        previewOpenedRef.current = false;
        setMessages(cached.messages);
        setCollapsedDescriptions(cached.collapsedDescriptions);
        setOperationLogs(cached.operationLogs);
        if (cached.activeResearchTaskId) setActiveResearchTaskId(cached.activeResearchTaskId);
        else restoreResearchTaskFromMessages(cached.messages);
        return;
      }

      // 过期缓存：先显示缓存再后台刷新
      if (cached && !isCacheValid && !options?.forceRefresh) {
        setPreviewFile(null);
        lastFileNameRef.current = null;
        previewOpenedRef.current = false;
        setMessages(cached.messages);
        setCollapsedDescriptions(cached.collapsedDescriptions);
        setOperationLogs(cached.operationLogs);
        if (cached.activeResearchTaskId) setActiveResearchTaskId(cached.activeResearchTaskId);
        else restoreResearchTaskFromMessages(cached.messages);
      } else {
        setIsLoadingMessages(true);
      }

      // 从服务端加载
      setPreviewFile(null);
      setPreviewFiles([]);
      setActivePreviewIndex(0);
      (state as any).setActiveArtifact?.(null);
      lastFileNameRef.current = null;
      previewOpenedRef.current = false;

      const savedLogs = loadOperationLogs(conversationId.toString());
      setOperationLogs(savedLogs);

      const conversation = await utils.conversation.getById.fetch({ id: conversationId });
      if (conversation && conversation.messages) {
        const parsedMessages = JSON.parse(conversation.messages as string);
        const displayMessages = parseDisplayMessages(parsedMessages);
        const collapsed = computeCollapsedIndices(displayMessages);
        const isNowStreaming = streamManager.isRunning(conversationId);
        if (selectedConvIdRef.current === conversationId && !isNowStreaming) {
          // ★ 防止服务端返回的旧消息覆盖刚完成的流式消息
          // 场景：流刚结束 → saveMessages 正在飞行中 → 此时 loadConversationMessages 被触发
          //   → DB 还是空/旧数据 → 用空消息覆盖了 React state 中的完整对话
          // 修复：如果当前 state 中已有更多消息，跳过覆盖
          const currentMsgCount = (streamingForConvIdRef.current === conversationId) ? messages.length : 0;
          if (displayMessages.length < currentMsgCount && currentMsgCount > 0) {
            console.log(`[Load Conversation] Skipping stale DB data: DB has ${displayMessages.length} msgs, state has ${currentMsgCount}`);
            return;
          }
          setMessages(displayMessages);
          setCollapsedDescriptions(collapsed);
          restoreResearchTaskFromMessages(displayMessages);
          saveToMessageCache(conversationId, displayMessages, collapsed, savedLogs);
        }
      }
    } catch (error: any) {
      console.error('[Load Conversation] Error:', error);
      if (error.message && error.message.includes('对话不存在')) {
        toast.error(t('chat.conversationNotFound'));
        setSelectedConversationId(null);
        setMessages([]);
        localStorage.removeItem('selectedConversationId');
        refetchConversations();
      } else {
        toast.error('加载对话历史失败，请稍后重试');
      }
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // ═══════════ 创建新对话 ═══════════

  const handleCreateConversation = () => {
    let pkgId = selectedPackageId;
    if (!pkgId) {
      if (modelPackages && modelPackages.length > 0) {
        pkgId = modelPackages[0].id;
        setSelectedPackageId(pkgId);
      } else {
        toast.error(t('chat.selectPackageFirst'));
        return;
      }
    }
    setSuggestedQuestions([]);
    setPreviewFile(null);
    setActiveResearchTaskId(null);
    (state as any).setActiveArtifact?.(null);
    lastFileNameRef.current = null;
    previewOpenedRef.current = false;
    setMessages([]);
    createConversationMutation.mutate({
      modelId: 0,
      title: '新对话',
      packageId: pkgId,
    });
  };

  // ═══════════ 删除对话 ═══════════

  const handleDeleteConversation = (id: number) => {
    if (confirm(t('chat.confirmDelete'))) {
      deleteConversationMutation.mutate({ id });
    }
  };

  // ═══════════ 清空历史 ═══════════

  const handleClearHistory = () => {
    if (confirm('确定要清空当前对话的所有消息吗？')) {
      setMessages([]);
    }
  };

  // ═══════════ 停止流式传输 ═══════════

  const handleStopStreaming = () => {
    const partialContent = streamedContentRef.current || streamedContent || '';
    const partialReasoning = reasoningContentRef.current || '';
    if (abortStream) abortStream();
    streamingForConvIdRef.current = null;

    // 构建停止后显示的内容
    let stoppedContent = '';
    if (partialContent) {
      stoppedContent = partialContent + '\n\n---\n*（回答已被用户停止）*';
    } else {
      stoppedContent = '*（回答已被用户停止）*';
    }

    setMessages((prev) => {
      const newMessages = [...prev];
      const lastIdx = newMessages.length - 1;
      if (newMessages[lastIdx] && newMessages[lastIdx].role === 'assistant') {
        newMessages[lastIdx] = {
          ...newMessages[lastIdx],
          content: stoppedContent,
          respondedAt: Date.now(),
        };
        const latestOperationLogs = operationLogsRef.current;
        if (latestOperationLogs.length > 0) {
          (newMessages[lastIdx] as any).operationLogs = [...latestOperationLogs];
        }
        // 保存已产生的推理内容（供折叠回看）
        if (partialReasoning) {
          (newMessages[lastIdx] as any).reasoningContent = partialReasoning;
        }
      }
      return newMessages;
    });

    setIsStreamingMessage(false);
    streamedContentRef.current = '';
    onStreamComplete();
    setThinkingStage('idle');
    setThinkingStartTime(null);
  };

  return {
    parseDisplayMessages,
    computeCollapsedIndices,
    saveToMessageCache,
    restoreResearchTaskFromMessages,
    loadConversationMessages,
    handleCreateConversation,
    handleDeleteConversation,
    handleClearHistory,
    handleStopStreaming,
  };
}
