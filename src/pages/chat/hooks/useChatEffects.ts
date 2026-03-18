/**
 * useChatEffects — 全部 useEffect 副作用
 * 
 * 集中管理所有 useEffect，包括：
 * - 模型/套餐偏好自动选择
 * - 对话自动选中（首次加载）
 * - 后台任务完成事件
 * - 草稿恢复、消息缓存同步
 * - 思考时间计时器
 * - EventSource 通知流
 * - 全局键盘快捷键
 * - 流式自动滚动
 * - 文件预览实时更新
 * - 快捷键注册
 * 
 * 原始位置: Chat.tsx L196-750, L1190-1470, L1295-1340
 */


import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { streamManager } from '@/lib/backgroundStreamManager';
import { researchTaskRegistry } from '@/lib/researchTaskRegistry';
import { setOnTaskCompletedCallback, setOnNextTaskCallback, setOnBatchCompleteCallback } from '@/hooks/useSandboxSocket';
import { useKeyboardShortcuts } from '@/hooks/useKeyboardShortcuts';

import type { ChatStateReturn } from '../types';

interface EffectsConfig {
  loadConversationMessages: (id: number, options?: { forceRefresh?: boolean }) => Promise<void>;
  handleSendMessage: (text?: string) => void;
  saveToMessageCache: (id: number, msgs: any[], collapsed: Set<number>, logs: any[]) => void;
  generateSuggestedQuestions?: (response: string, userMsg?: string, automationMeta?: any) => void;
}

export function useChatEffects(state: ChatStateReturn, config: EffectsConfig) {
  const {
    t, messages, setMessages,
    selectedConversationId, setSelectedConversationId,
    selectedModelId, setSelectedModelId,
    selectedPackageId, setSelectedPackageId,
    currentUser, updatePreferenceMutation,
    conversations, refetchConversations, refetchBalance,
    chatModels, modelPackages, createConversationMutation,
    isStreaming, isStreamingMessage, streamedContent,
    setIsStreamingMessage,
    messagesEndRef, messagesContainerRef, chatInputRef, userScrolledUpRef,
    voiceDialogOpen, setVoiceDialogOpen,
    thinkingStartTime, setElapsedThinkingTime,
    setRealtimeThinkingSteps,
    previewFile, setPreviewFile,
    lastFileNameRef, previewOpenedRef,
    operationLogs, operationLogsRef,
    selectedConvIdRef, messageCacheRef, initialLoadDoneRef,
    collapsedDescriptions,
    showTaskLimitBanner, setShowTaskLimitBanner,
    runningTaskCount,
    uploadedFiles, setUploadedFiles,
    saveDraft,
    draft, setHasInputContent,
    showShortcutsHelp, setShowShortcutsHelp,
    uploadedImages,
    activeResearchTaskId, setActiveResearchTaskId,
  } = state;
  const { loadConversationMessages, handleSendMessage, saveToMessageCache, generateSuggestedQuestions } = config;

  const prevConversationIdRef = useRef<number | null>(null);

  // ═══════════ 操作日志 ref 同步 ═══════════
  useEffect(() => { operationLogsRef.current = operationLogs; }, [operationLogs]);

  // ═══════════ selectedConvIdRef 同步 ═══════════
  useEffect(() => { selectedConvIdRef.current = selectedConversationId; }, [selectedConversationId]);

  // ═══════════ 模型/套餐偏好自动选择 ═══════════
  useEffect(() => {
    if (currentUser) {
      if (currentUser.preferredPackageId) {
        if (selectedPackageId !== currentUser.preferredPackageId) setSelectedPackageId(currentUser.preferredPackageId);
        if (selectedModelId !== null) setSelectedModelId(null);
        if (currentUser.preferredModelId) updatePreferenceMutation.mutate({ preferredModelId: null, preferredPackageId: currentUser.preferredPackageId });
      } else if (currentUser.preferredModelId && !selectedModelId && !selectedPackageId) {
        setSelectedModelId(currentUser.preferredModelId);
      }
    }
  }, [currentUser?.preferredPackageId, currentUser?.preferredModelId]);

  // ═══════════ 监听模型/套餐选择变化 ═══════════
  useEffect(() => {
    if (selectedModelId && currentUser && selectedModelId !== currentUser.preferredModelId) {
      updatePreferenceMutation.mutate({ preferredModelId: selectedModelId, preferredPackageId: null });
    }
  }, [selectedModelId, currentUser?.preferredModelId]);

  useEffect(() => {
    if (selectedPackageId && currentUser && selectedPackageId !== currentUser.preferredPackageId) {
      updatePreferenceMutation.mutate({ preferredPackageId: selectedPackageId, preferredModelId: null });
    }
  }, [selectedPackageId, currentUser?.preferredPackageId]);

  // ═══════════ 自动选择第一个可用模型 ═══════════
  useEffect(() => {
    if (chatModels && chatModels.length > 0 && !selectedModelId && !currentUser?.preferredModelId) {
      setSelectedModelId(chatModels[0].id);
    }
  }, [chatModels, selectedModelId, currentUser]);

  // ═══════════ 新用户自动选择默认套餐 ═══════════
  useEffect(() => {
    // 只在没有任何偏好时自动选第一个可用套餐
    if (!selectedPackageId && !selectedModelId && !currentUser?.preferredPackageId && !currentUser?.preferredModelId) {
      if (modelPackages && modelPackages.length > 0) {
        const firstEnabled = modelPackages.find((p: any) => p.enabled);
        if (firstEnabled) {
          setSelectedPackageId(firstEnabled.id);
          setSelectedModelId(null);
        }
      }
    }
  }, [modelPackages, selectedPackageId, selectedModelId, currentUser?.preferredPackageId, currentUser?.preferredModelId]);

  // ═══════════ 检测用户切换 → 清除上一个用户的残留状态 ═══════════
  const prevUserIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!currentUser) return;
    const prevUserId = prevUserIdRef.current;
    prevUserIdRef.current = currentUser.id;
    // 用户 ID 变化 → 说明切换了账号（GitHub OAuth / 退出再登录）
    if (prevUserId !== null && prevUserId !== currentUser.id) {
      console.log(`[Chat] User changed: ${prevUserId} → ${currentUser.id}, clearing stale state`);
      setSelectedConversationId(null);
      setMessages([]);
      initialLoadDoneRef.current = false;
    }
  }, [currentUser?.id]);

  // ═══════════ 自动选中对话（首次加载） ═══════════
  useEffect(() => {
    if (initialLoadDoneRef.current) return;

    // ★ conversations 已加载但为空（新用户没有对话） → 清除残留 ID
    if (conversations && conversations.length === 0) {
      if (selectedConversationId) {
        console.log('[Chat] No conversations for current user, clearing stale selectedConversationId');
        setSelectedConversationId(null);
      }
      return;
    }
    if (!conversations || conversations.length === 0) return;
    initialLoadDoneRef.current = true;

    if (selectedConversationId) {
      const exists = conversations.some((c: any) => c.id === selectedConversationId);
      if (exists) { loadConversationMessages(selectedConversationId); return; }
      // ★ 选中的对话不在当前用户的列表中 → 清除
      console.log('[Chat] selectedConversationId not found in user conversations, clearing');
    }
    const latestConversation = conversations[0];
    setSelectedConversationId(latestConversation.id);
    loadConversationMessages(latestConversation.id);
  }, [conversations]);

  // ═══════════ 后台任务完成事件 ═══════════
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      refetchBalance();
      refetchConversations();
      // 清除研究任务追踪
      if (detail?.conversationId) {
        researchTaskRegistry.complete(detail.conversationId);
      }
      if (detail?.conversationId && detail.conversationId === selectedConversationId) {
        streamManager.clearTask(detail.conversationId);
        setIsStreamingMessage(false);
        messageCacheRef.current.delete(detail.conversationId);
        loadConversationMessages(detail.conversationId, { forceRefresh: true });
      } else if (detail?.conversationId) {
        messageCacheRef.current.delete(detail.conversationId);
      }
    };
    window.addEventListener('bg-task-complete', handler);
    return () => window.removeEventListener('bg-task-complete', handler);
  }, [selectedConversationId, refetchBalance, refetchConversations]);

  // ═══════════ 草稿恢复 ═══════════
  useEffect(() => {
    if (selectedConversationId !== prevConversationIdRef.current) {
      prevConversationIdRef.current = selectedConversationId;
      if (selectedConversationId && draft) {
        if (chatInputRef.current && draft.input) chatInputRef.current.setInput(draft.input);
        if (draft.files.length > 0) setUploadedFiles(draft.files);
        else setUploadedFiles([]);
      } else if (!selectedConversationId) {
        if (chatInputRef.current) chatInputRef.current.clear();
        setUploadedFiles([]);
      }
    }
  }, [selectedConversationId, draft]);

  // ═══════════ 消息缓存同步 ═══════════
  useEffect(() => {
    if (selectedConversationId && messages.length > 0 && !isStreaming && !isStreamingMessage) {
      saveToMessageCache(selectedConversationId, messages, collapsedDescriptions, operationLogs);
    }
  }, [messages.length, selectedConversationId, isStreaming, isStreamingMessage]);

  // ═══════════ 草稿保存（防抖） ═══════════
  useEffect(() => {
    if (!selectedConversationId) return;
    const currentInput = chatInputRef.current?.getValue() || '';
    const timer = setTimeout(() => { saveDraft(currentInput, uploadedFiles); }, 500);
    return () => clearTimeout(timer);
  }, [uploadedFiles, selectedConversationId, saveDraft]);

  // ═══════════ 任务完成回调（运营总结 — 每个账号触发一次） ═══════════
  useEffect(() => {
    setOnTaskCompletedCallback((data: any) => {
      const summary = data.resultSummary;
      const contentInfo = summary?.contentInfo;
      const taskName = data.taskName || '';
      const taskSucceeded = summary?.completed !== false; // 兼容旧格式

      // 从任务名中提取账号信息和批次进度（例如 "发帖（账号1/3: 哈哈）"）
      const accountMatch = taskName.match(/账号(\d+)\/(\d+)[:\s：]*(.+?)[\)）]/);
      const accountName = accountMatch ? accountMatch[3] : '';
      const currentIndex = accountMatch ? parseInt(accountMatch[1]) : 1;
      const totalTasks = accountMatch ? parseInt(accountMatch[2]) : 1;
      const isBatch = totalTasks > 1;

      let summaryText: string;

      if (!taskSucceeded) {
        // ★ 任务失败
        const errorMsg = summary?.errorMessage || '未知错误';
        if (isBatch) {
          summaryText = `❌ **账号 ${accountName} 运营失败** (${currentIndex}/${totalTasks})\n\n> ${errorMsg}`;
        } else {
          summaryText = `❌ **运营任务失败**`;
          if (accountName) summaryText += ` · 账号：${accountName}`;
          summaryText += `\n\n> ${errorMsg}`;
        }
      } else {
        // 任务成功 — 构建详细报告
        const postCount = contentInfo?.postCount || (contentInfo?.publishedUrl ? 1 : 0);
        const replyCount = contentInfo?.replyCount || 0;
        const allPublished = contentInfo?.allPublished || [];

        const actionLines: string[] = [];
        if (allPublished.length > 0) {
          allPublished.forEach((item: any) => {
            const typeLabel = item.type === 'post' ? '📝 发帖' : '💬 回复';
            const urlShort = item.url ? `[查看](${item.url})` : '（未获取链接）';
            actionLines.push(`| ${typeLabel} | ${urlShort} | ${item.length} 字 |`);
          });
        } else if (contentInfo?.publishedUrl) {
          actionLines.push(`| 📝 发帖 | [查看](${contentInfo.publishedUrl}) | ${contentInfo.contentLength} 字 |`);
        }

        const completedAt = new Date(summary.completedAt);
        const timeStr = completedAt.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });

        // 区分单账号 vs 多账号中间进度
        if (isBatch) {
          summaryText = `🔄 **账号 ${accountName} 运营完成** (${currentIndex}/${totalTasks})`;
        } else {
          summaryText = `✅ **运营任务完成**`;
          if (accountName) summaryText += ` · 账号：${accountName}`;
        }
        summaryText += `\n`;

        if (actionLines.length > 0) {
          summaryText += `\n| 操作 | 链接 | 字数 |\n|------|------|------|\n`;
          summaryText += actionLines.join('\n');
          summaryText += '\n';
        }

        if (contentInfo?.contentPreview) {
          summaryText += `\n> ${contentInfo.contentPreview}\n`;
        }

        summaryText += `\n**步骤 ${summary.totalSteps}** · 完成于 ${timeStr}`;
        if (postCount > 0 || replyCount > 0) {
          const parts = [];
          if (postCount > 0) parts.push(`发帖 ${postCount} 篇`);
          if (replyCount > 0) parts.push(`回复 ${replyCount} 条`);
          summaryText += ` · ${parts.join('、')}`;
        }
      }

      // 追加消息
      setMessages((prev: any) => {
        const alreadyExists = prev.some((m: any) => m.automationTaskId === data.taskId && m.automationCompleted === true);
        if (alreadyExists) return prev;
        return [...prev, {
          role: 'assistant' as const,
          content: summaryText,
          timestamp: Date.now(),
          automationTaskId: data.taskId,
          automationCompleted: true,
        }];
      });

      // 仅在单账号任务完成时生成追问（多账号由 batch_complete 处理）
      if (!isBatch && taskSucceeded && generateSuggestedQuestions) {
        generateSuggestedQuestions(summaryText, '', { taskName });
      }
    });
    return () => { setOnTaskCompletedCallback(null); };
  }, []);

  // ═══════════ 多账号批次全部完成：汇总消息 ═══════════
  useEffect(() => {
    setOnBatchCompleteCallback((data) => {
      const { totalTasks, successCount, failCount, batchResults } = data;
      let text: string;
      if (failCount === 0) {
        text = `✅ **全部 ${totalTasks} 个账号运营完成**`;
      } else if (successCount === 0) {
        text = `❌ **全部 ${totalTasks} 个账号运营失败**`;
      } else {
        text = `⚠️ **${totalTasks} 个账号运营结束** · ${successCount} 成功，${failCount} 失败`;
      }
      text += '\n\n';
      batchResults.forEach((r, i) => {
        const icon = r.success ? '✅' : '❌';
        text += `${icon} 账号 **${r.username}** #${r.taskId}`;
        if (!r.success && r.error) text += ` — ${r.error.substring(0, 60)}`;
        text += '\n';
      });

      setMessages((prev: any) => {
        const alreadyExists = prev.some((m: any) => m._batchComplete === true);
        if (alreadyExists) return prev;
        return [...prev, {
          role: 'assistant' as const,
          content: text.trim(),
          timestamp: Date.now(),
          _batchComplete: true,
        }];
      });

      if (generateSuggestedQuestions) {
        generateSuggestedQuestions(text, '', { totalTasks, successCount, failCount });
      }
    });
    return () => { setOnBatchCompleteCallback(null); };
  }, []);

  // ═══════════ 多账号顺序执行：自动切换到下一个任务 ═══════════
  useEffect(() => {
    setOnNextTaskCallback((data) => {
      console.log(`[ChatEffects] Switching to next task: #${data.nextTaskId} (${data.nextUsername}, ${data.currentIndex + 1}/${data.totalTasks})`);
      // 更新 activeResearchTaskId，触发 useSandboxSocket 重新连接到新任务的 socket room
      setActiveResearchTaskId(data.nextTaskId);
    });
    return () => { setOnNextTaskCallback(null); };
  }, [setActiveResearchTaskId]);

  // ═══════════ 文件预览实时更新 ═══════════
  const previewIsLive = previewFile?.isLive ?? false;
  useEffect(() => {
    if (!previewIsLive || !streamedContent) return;
    const cleanMarkers = (code: string) => code
      .replace(/\/\/\s*[─—\-]{2,}.*[─—\-]{2,}.*$/gm, '')
      .replace(/\/\/\s*[─—\-]*\s*(旧代码|替换为|新代码|原代码|修改后).*$/gm, '')
      .trim();

    const fileNamePatterns = [/修改文件[：:]\s*\*{0,2}\s*([^\s*\n(（]+\.\w+)/g, /文件[：:]\s*\*{0,2}\s*`?([^\s`*\n(（]+\.\w+)`?/g];
    let lastDetectedFile: string | null = null;
    let lastDetectedPos = -1;
    for (const pattern of fileNamePatterns) {
      let fm;
      while ((fm = pattern.exec(streamedContent)) !== null) {
        if (fm.index > lastDetectedPos) { lastDetectedPos = fm.index; lastDetectedFile = fm[1]; }
      }
    }
    if (lastDetectedFile && previewFile && lastDetectedFile !== previewFile.name) {
      lastFileNameRef.current = lastDetectedFile;
      setPreviewFile(prev => prev ? { ...prev, name: lastDetectedFile! } : null);
    }

    let contentToExtract = streamedContent;
    if (lastDetectedPos > 0) {
      const searchStart = Math.max(0, lastDetectedPos - 10);
      const beforeContent = streamedContent.substring(0, searchStart);
      const afterContent = streamedContent.substring(searchStart);
      if (/```\w*\n[\s\S]*?```/.test(beforeContent)) contentToExtract = afterContent;
    }

    const rawBlocks: string[] = [];
    const completeRegex = /```\w*\n([\s\S]*?)```/g;
    let match;
    while ((match = completeRegex.exec(contentToExtract)) !== null) rawBlocks.push(match[1].trimEnd());

    const allBackticks = contentToExtract.match(/```/g) || [];
    if (allBackticks.length % 2 === 1) {
      const lastIdx = contentToExtract.lastIndexOf('```');
      const openBlock = contentToExtract.substring(lastIdx).replace(/```\w*\n?/, '');
      if (openBlock.trim()) rawBlocks.push(openBlock.trimEnd());
    }

    if (rawBlocks.length > 0) {
      const uniqueBlocks: string[] = [];
      for (let i = 0; i < rawBlocks.length; i++) {
        const cleaned = cleanMarkers(rawBlocks[i]);
        const prevCleaned = i > 0 ? cleanMarkers(rawBlocks[i - 1]) : '';
        if (cleaned !== prevCleaned || cleaned.length < 5) uniqueBlocks.push(cleaned);
      }
      let previewContent: string;
      if (uniqueBlocks.length === 1) previewContent = uniqueBlocks[0];
      else if (uniqueBlocks.length === 2) previewContent = `// ──── 旧代码 ────\n${uniqueBlocks[0]}\n\n// ──── 新代码 ────\n${uniqueBlocks[1]}`;
      else previewContent = `// ──── 旧代码 ────\n${uniqueBlocks[uniqueBlocks.length - 2]}\n\n// ──── 新代码 ────\n${uniqueBlocks[uniqueBlocks.length - 1]}`;
      setPreviewFile(prev => prev ? { ...prev, content: previewContent } : null);
    }
  }, [streamedContent, previewIsLive]);

  // ═══════════ 流式结束后标记预览为非实时 ═══════════
  useEffect(() => {
    if (!isStreamingMessage && previewIsLive) setPreviewFile(prev => prev ? { ...prev, isLive: false } : null);
  }, [isStreamingMessage, previewIsLive]);

  // ═══════════ 实时更新思考时间 ═══════════
  useEffect(() => {
    if (thinkingStartTime === null) return;
    const interval = setInterval(() => {
      setElapsedThinkingTime((Date.now() - thinkingStartTime) / 1000);
    }, 100);
    return () => clearInterval(interval);
  }, [thinkingStartTime]);

  // ★ EventSource 通知流已移至 chat/index.tsx 的 useSSEReconnect 统一处理
  // thinking_step_update 由 handleNotificationEvent 处理，不再重复建连

  // ═══════════ 全局空格键（语音输入） ═══════════
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if (voiceDialogOpen) return;
      if (e.code === 'Space') {
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA' && target.tagName !== 'BUTTON' && !target.isContentEditable) {
          e.preventDefault();
          setVoiceDialogOpen(true);
        }
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [voiceDialogOpen]);

  // ═══════════ 流式自动滚动 ═══════════
  // ★ 改用 scrollTop 直接赋值（instant），不再使用 scrollIntoView({ behavior: 'smooth' })
  //   smooth 动画在移动端会与用户触摸滚动"打架"，导致要滑好几次才能停住
  const scrollRafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isStreaming || !messagesContainerRef.current) return;
    if (userScrolledUpRef.current) return;
    // 使用 rAF 防抖，避免每个 chunk 都触发滚动（高频更新时只执行最后一次）
    if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      if (userScrolledUpRef.current) return;
      const el = messagesContainerRef.current;
      if (el) {
        // ★ instant scroll — 不产生动画，不与用户触摸冲突
        el.scrollTop = el.scrollHeight;
      }
    });
    return () => {
      if (scrollRafRef.current) cancelAnimationFrame(scrollRafRef.current);
    };
  }, [streamedContent, isStreaming]);

  // ═══════════ 流式结束后重置滚动 ═══════════
  useEffect(() => {
    if (!isStreamingMessage) userScrolledUpRef.current = false;
  }, [isStreamingMessage]);

  // ═══════════ 后台任务上限提示自动消失 ═══════════
  useEffect(() => {
    if (showTaskLimitBanner) {
      const currentPackage = modelPackages?.find((p: any) => p.id === selectedPackageId);
      const maxConcurrent = currentPackage?.maxConcurrentTasks ?? 3;
      if (runningTaskCount < maxConcurrent) setShowTaskLimitBanner(false);
    }
  }, [runningTaskCount, showTaskLimitBanner, modelPackages, selectedPackageId]);

  // ═══════════ 快捷键注册 ═══════════
  useKeyboardShortcuts([
    {
      key: 'Enter', ctrl: true,
      handler: () => {
        const value = chatInputRef.current?.getValue() || '';
        if (value.trim() || uploadedImages.length > 0 || uploadedFiles.length > 0) {
          handleSendMessage(value);
          chatInputRef.current?.clear();
        }
      },
      description: '发送消息',
    },
    {
      key: 'n', ctrl: true,
      handler: () => {
        if (selectedModelId || selectedPackageId) {
          setMessages([]);
          createConversationMutation.mutate({
            modelId: selectedModelId || modelPackages?.[0]?.primaryModelId || chatModels?.[0]?.id || 1,
            title: '新对话',
          });
        } else {
          toast.error('请先选择AI模型或套餐');
        }
      },
      description: '新建对话',
    },
    {
      key: '?', shift: true,
      handler: () => setShowShortcutsHelp(true),
      description: '显示快捷键帮助',
    },
  ]);
}
