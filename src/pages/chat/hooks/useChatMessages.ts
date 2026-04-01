/**
 * useChatMessages — 消息状态管理 Hook（v2: tRPC + streamManager 集成）
 *
 * ✅ 已修复 A3 问题：
 *   - 使用 trpc.conversation.getById.fetch() 替代 raw fetch
 *   - 集成 streamManager 的后台任务状态恢复
 *   - 集成 operationLog 本地存储
 *   - 完整的缓存逻辑（与 Chat.tsx loadConversationMessages 一致）
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import type { ChatMessage, MessageCacheEntry, OperationLog } from '@/types/chat';
import { trpc } from '@/lib/trpc';
import { streamManager } from '@/lib/backgroundStreamManager';
import {
  saveOperationLogs,
  loadOperationLogs,
  deleteOperationLogs,
} from '@/lib/operationLogStorage';

// ─── 缓存常量 ────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 分钟
const MAX_CACHE = 20;

// ─── 扩展缓存项（含 activeResearchTaskId）───────
interface ExtendedCacheEntry extends MessageCacheEntry {
  activeResearchTaskId?: number | null;
}

// ─── Options ──────────────────────────────────────
interface UseChatMessagesOptions {
  conversationId: number | null;
  /** 外部回调：当从后台任务恢复时通知父组件更新 streaming 状态等 */
  onBackgroundRestore?: (task: {
    messages: ChatMessage[];
    operationLogs: OperationLog[];
    thinkingSteps: any[];
    realtimeThinkingSteps: any[];
    previewFile: any;
  }) => void;
  /** 外部回调：恢复活跃的研究任务 ID */
  onRestoreResearchTask?: (taskId: number | null) => void;
}

// ─── 消息解析（从 Chat.tsx parseDisplayMessages 提取） ───────
function parseDisplayMessages(parsedMessages: any[]): ChatMessage[] {
  // 去重
  const deduped: any[] = [];
  for (let i = 0; i < parsedMessages.length; i++) {
    const msg = parsedMessages[i];
    if (msg.role === 'user' && deduped.length > 0) {
      const lastSameRole = [...deduped].reverse().find((m) => m.role === 'user');
      if (lastSameRole) {
        const extractText = (content: any): string => {
          if (typeof content === 'string') return content;
          if (Array.isArray(content))
            return content
              .filter((p: any) => p.type === 'text')
              .map((p: any) => p.text)
              .join('');
          return String(content || '');
        };
        const textA = extractText(msg.content);
        const textB = extractText(lastSameRole.content);

        if (textA === textB) {
          const getImageUrls = (m: any): string[] => {
            const urls: string[] = [];
            if (m.images)
              m.images.forEach((img: any) =>
                urls.push(typeof img === 'string' ? img : img.url),
              );
            if (Array.isArray(m.content))
              m.content
                .filter((p: any) => p.type === 'image_url')
                .forEach((p: any) => urls.push(p.image_url?.url));
            return urls.sort();
          };
          const imagesA = getImageUrls(msg);
          const imagesB = getImageUrls(lastSameRole);
          const sameImages =
            imagesA.length === imagesB.length &&
            imagesA.every((url, idx) => url === imagesB[idx]);
          const timeDiff = Math.abs(
            (msg.timestamp || msg.sentAt || 0) -
              (lastSameRole.timestamp || lastSameRole.sentAt || 0),
          );
          const shouldDedup =
            (imagesA.length > 0 && sameImages) || timeDiff < 60000;
          if (shouldDedup) continue;
        }
      }
    }
    deduped.push(msg);
  }

  return deduped
    .map((msg: any) => {
      // ★ Artifact 恢复：从 content 中的代码块重建丢失的 artifact（历史数据兼容）
      if (msg.role === 'assistant' && !msg.artifact && typeof msg.content === 'string') {
        const artifactMatch = msg.content.match(
          /```(?:artifact:([^\n]*)|(?:(html|jsx|tsx|vue|css|react)\s*\n))([\s\S]*?)```/
        );
        if (artifactMatch) {
          const title = (artifactMatch[1] || '').trim();
          const lang = artifactMatch[2] || 'html';
          const code = (artifactMatch[3] || '').trim();
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
      // 特殊消息类型标记
      if (msg.isResearchTask)
        return {
          ...msg,
          isResearchTask: true,
          researchTaskId: msg.researchTaskId,
          researchPrompt: msg.researchPrompt,
        };
      if (msg.isAutomationTask)
        return {
          ...msg,
          isAutomationTask: true,
          automationTaskId: msg.automationTaskId,
          automationTaskName: msg.automationTaskName,
          automationSiteName: msg.automationSiteName,
        };
      // ★ 自动化任务恢复：从消息内容中检测并恢复丢失的元数据（历史数据兼容）
      if (msg.role === 'assistant' && !msg.isAutomationTask && typeof msg.content === 'string') {
        // 匹配 "已为 N 个账号创建/继续任务" 或 "自动化任务已创建并启动"
        const multiMatch = msg.content.match(/已为\s*(\d+)\s*个账号(?:创建|继续创建)(?:自动化)?任务/);
        const singleMatch = msg.content.match(/自动化任务已创建并启动/) || msg.content.match(/已继续自动化任务/);
        if (multiMatch || singleMatch) {
          // 从内容中提取任务 ID 列表
          const taskIdMatches = [...msg.content.matchAll(/任务\s*#(\d+)/g)];
          const firstTaskId = taskIdMatches.length > 0 ? parseInt(taskIdMatches[0][1]) : undefined;
          // 提取账号列表
          const accountMatches = [...msg.content.matchAll(/账号\s*\*{0,2}(\S+?)\*{0,2}\s*→\s*任务\s*#(\d+)/g)];
          const allTasks = accountMatches.length > 1
            ? accountMatches.map(m => ({ taskId: parseInt(m[2]), username: m[1], taskName: m[1] }))
            : undefined;
          // 提取任务名称和站点名
          const taskNameMatch = msg.content.match(/任务名称[：:]\s*\*{0,2}(.+?)\*{0,2}\n/);
          const siteMatch = msg.content.match(/目标网站[：:]\s*\*{0,2}(.+?)\*{0,2}\n/);

          return {
            ...msg,
            isAutomationTask: true,
            automationTaskId: firstTaskId,
            automationTaskName: taskNameMatch?.[1] || '自动化任务',
            automationSiteName: siteMatch?.[1] || '',
            ...(allTasks ? { automationAllTasks: allTasks } : {}),
            timestamp: msg.timestamp || msg.sentAt || msg.respondedAt || Date.now(),
          };
        }
      }
      if (msg.isVideoTask)
        return {
          ...msg,
          isVideoTask: true,
          videoTaskId: msg.videoTaskId,
          videoPrompt: msg.videoPrompt || msg.content,
          timestamp: msg.timestamp || msg.sentAt || msg.respondedAt || Date.now(),
        };

      // 多模态消息（content 是数组）
      if (typeof msg.content === 'object' && Array.isArray(msg.content)) {
        let textContent = '';
        const images: Array<{ url: string; name: string }> = [];
        let files: Array<{ name: string; url: string; size: number }> | undefined;
        for (const part of msg.content) {
          if (part.type === 'text') textContent += part.text;
          else if (part.type === 'image_url')
            images.push({ url: part.image_url.url, name: '图片' });
          else if (part.type === 'file_url') {
            if (!files) files = [];
            files.push({
              name:
                part.file_url?.filename ||
                part.file_url?.url?.split('/').pop() ||
                '文件',
              url: part.file_url?.url || '',
              size: 0,
            });
          }
        }
        return {
          ...msg,
          content:
            msg._displayContent !== undefined
              ? msg._displayContent
              : textContent || (images.length > 0 ? '[图片]' : ''),
          images: images.length > 0 ? images : undefined,
          files: files && files.length > 0 ? files : undefined,
          timestamp:
            msg.timestamp || msg.sentAt || msg.respondedAt || Date.now(),
        };
      }

      // 普通文本消息
      // ★ 向后兼容：旧 DB 数据可能只有 markdown ![AI_IMG](url) 没有 images 数组
      // 从 content 中提取图片，让主渲染路径（ProgressiveImage + ImageActionBar）统一处理
      let backfillImages: Array<{ url: string; name: string; imagePrompt?: string }> | undefined;
      if (msg.role === 'assistant' && !msg.images && typeof msg.content === 'string') {
        const imgRegex = /!\[(?:AI_IMG|Generated Image)[^\]]*\]\(([^)]+)\)/g;
        const imgs: Array<{ url: string; name: string }> = [];
        let match;
        while ((match = imgRegex.exec(msg.content)) !== null) {
          imgs.push({ url: match[1], name: '生成图片' });
        }
        if (imgs.length > 0) backfillImages = imgs;
      }
      return {
        ...msg,
        ...(backfillImages ? { images: backfillImages } : {}),
        content: (() => {
          if (msg._displayContent !== undefined) return msg._displayContent;
          if (typeof msg.content === 'string' && msg.role === 'user') {
            const enhanced = msg.content.match(
              /^继续生成类似图片（基于之前的(?:描述|内容)：[\s\S]+）$/,
            );
            if (enhanced) return '继续';
            // 新格式：用户原话 + [上一次生成的图片描述参考：...] → 只显示用户原话
            const refIdx = msg.content.indexOf('\n\n[上一次生成的图片描述参考：');
            if (refIdx > 0) return msg.content.substring(0, refIdx);
          }
          return msg.content;
        })(),
        timestamp:
          msg.timestamp || msg.sentAt || msg.respondedAt || Date.now(),
      };
    })
    .filter((m: any) => m.role !== 'system');
}

/** 计算带图片消息的折叠索引 */
function computeCollapsedIndices(displayMessages: any[]): Set<number> {
  const indices = displayMessages
    .map((msg: any, index: number) =>
      msg.images && msg.images.length > 0 ? index : -1,
    )
    .filter((index: number) => index !== -1);
  return new Set(indices);
}

/** 从消息列表中提取最近的研究任务 ID */
function extractResearchTaskId(msgs: ChatMessage[]): number | null {
  for (let i = msgs.length - 1; i >= 0; i--) {
    const msg = msgs[i] as any;
    if (msg.isResearchTask && msg.researchTaskId) return msg.researchTaskId;
    // ★ 自动化任务也使用 activeResearchTaskId 驱动沙箱面板
    if (msg.isAutomationTask && msg.automationTaskId) return msg.automationTaskId;
    const content = typeof msg.content === 'string' ? msg.content : '';
    const match = content.match(/<ResearchTaskCard\s+taskId="(\d+)"/);
    if (match) return parseInt(match[1]);
  }
  return null;
}

// ═══════════════════════════════════════════
// Hook 主体
// ═══════════════════════════════════════════

export function useChatMessages(options: UseChatMessagesOptions) {
  const {
    conversationId,
    onBackgroundRestore,
    onRestoreResearchTask,
  } = options;

  // ─── 状态 ───────────────────────────────
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [collapsedDescriptions, setCollapsedDescriptions] = useState<Set<number>>(new Set());
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);

  const msgIdCounter = useRef(0);
  const cacheRef = useRef<Map<number, ExtendedCacheEntry>>(new Map());
  const selectedConvIdRef = useRef<number | null>(null);

  // tRPC
  const utils = trpc.useUtils();
  const saveMessagesMutation = trpc.conversation.saveMessages.useMutation();

  // ─── ID 生成 ────────────────────────────
  const nextMsgId = useCallback(() => {
    msgIdCounter.current += 1;
    return `msg_${Date.now()}_${msgIdCounter.current}`;
  }, []);

  // ─── 缓存操作 ──────────────────────────
  const saveToCache = useCallback(
    (
      convId: number,
      msgs: ChatMessage[],
      collapsed?: Set<number>,
      logs?: OperationLog[],
      researchTaskId?: number | null,
    ) => {
      const cache = cacheRef.current;
      const now = Date.now();
      // 清理过期
      for (const [key, entry] of cache.entries()) {
        if (now - entry.timestamp > CACHE_TTL) cache.delete(key);
      }
      // 限制数量
      if (cache.size >= MAX_CACHE) {
        const oldest = [...cache.entries()].sort(
          (a, b) => a[1].timestamp - b[1].timestamp,
        )[0];
        if (oldest) cache.delete(oldest[0]);
      }
      cache.set(convId, {
        messages: msgs,
        collapsedDescriptions: collapsed || new Set(),
        operationLogs: logs || [],
        timestamp: now,
        activeResearchTaskId: researchTaskId,
      });
    },
    [],
  );

  // ─── 核心：加载对话消息 ──────────────────
  const loadMessages = useCallback(
    async (
      convId: number,
      opts?: { forceRefresh?: boolean },
    ) => {
      const prevConvId = selectedConvIdRef.current;

      // 1️⃣ 离开当前对话时缓存
      if (prevConvId && prevConvId !== convId) {
        if (messages.length > 0) {
          saveToCache(
            prevConvId,
            messages,
            collapsedDescriptions,
            operationLogs,
            extractResearchTaskId(messages),
          );
        }
        // 如果有后台流，保存客户端状态
        if (streamManager.isRunning(prevConvId)) {
          streamManager.saveClientState(prevConvId, {
            messages: [...messages],
            operationLogs: [...operationLogs],
            thinkingSteps: [],
            realtimeThinkingSteps: [],
            previewFile: null,
          });
        }
      }

      // 更新 ref
      selectedConvIdRef.current = convId;

      // 2️⃣ 相同对话且已有消息 → 跳过
      if (prevConvId === convId && messages.length > 0 && !opts?.forceRefresh) {
        return;
      }

      // 3️⃣ 检查后台运行中的流
      const bgTask = streamManager.getTask(convId);
      if (bgTask && bgTask.status === 'running') {
        if (bgTask.cachedClientState) {
          const cached = bgTask.cachedClientState;
          setMessages(cached.messages);
          setOperationLogs(cached.operationLogs);
          onBackgroundRestore?.(cached);
          onRestoreResearchTask?.(extractResearchTaskId(cached.messages));
        }
        return; // 等待流完成，不从服务端加载
      }

      // 4️⃣ 后台已完成的任务：清理
      if (bgTask && (bgTask.status === 'completed' || bgTask.status === 'error')) {
        streamManager.clearTask(convId);
        cacheRef.current.delete(convId); // 缓存失效
      }

      // 5️⃣ 从内存缓存恢复
      const cached = cacheRef.current.get(convId);
      const isCacheValid = cached && Date.now() - cached.timestamp < CACHE_TTL;

      if (isCacheValid && !opts?.forceRefresh) {
        setMessages(cached!.messages);
        setCollapsedDescriptions(cached!.collapsedDescriptions);
        setOperationLogs(cached!.operationLogs);
        onRestoreResearchTask?.(cached!.activeResearchTaskId ?? null);
        return;
      }

      // 6️⃣ 有过期缓存 → 先显示缓存，后台刷新
      if (cached && !isCacheValid && !opts?.forceRefresh) {
        setMessages(cached.messages);
        setCollapsedDescriptions(cached.collapsedDescriptions);
        setOperationLogs(cached.operationLogs);
        onRestoreResearchTask?.(cached.activeResearchTaskId ?? null);
        // 继续加载最新数据（不显示 loading）
      } else {
        setIsLoading(true);
      }

      // 7️⃣ 从服务端加载（tRPC）
      try {
        const savedLogs = loadOperationLogs(convId.toString());
        setOperationLogs(savedLogs);

        const conversation = await utils.conversation.getById.fetch({ id: convId });

        if (conversation && conversation.messages) {
          const parsedMessages = JSON.parse(conversation.messages as string);
          const displayMessages = parseDisplayMessages(parsedMessages);
          const collapsed = computeCollapsedIndices(displayMessages);

          // 防止快速切换竞态 + 不覆盖已开始的流
          const isNowStreaming = streamManager.isRunning(convId);
          if (selectedConvIdRef.current === convId && !isNowStreaming) {
            setMessages(displayMessages);
            setCollapsedDescriptions(collapsed);
            onRestoreResearchTask?.(extractResearchTaskId(displayMessages));
            saveToCache(convId, displayMessages, collapsed, savedLogs);
          }
        }
      } catch (error: any) {
        console.error('[useChatMessages] Failed to load:', error.message);
        // 如果没有缓存兜底，清空
        if (!cached) setMessages([]);
      } finally {
        setIsLoading(false);
      }
    },
    // 注意：messages/collapsedDescriptions/operationLogs 是"当前"值，
    // 仅在 prevConvId 缓存逻辑中使用（离开对话时），不会导致循环
    [messages, collapsedDescriptions, operationLogs, saveToCache, utils, onBackgroundRestore, onRestoreResearchTask],
  );

  // ─── 保存到服务端 ──────────────────────
  const saveMessages = useCallback(
    async (convId?: number) => {
      const targetId = convId || conversationId;
      if (!targetId || messages.length === 0) return;

      try {
        await saveMessagesMutation.mutateAsync({
          conversationId: targetId,
          messages: JSON.stringify(messages.filter((m) => m.role !== 'system')),
        });
        saveToCache(targetId, messages, collapsedDescriptions, operationLogs);
      } catch (error: any) {
        console.error('[useChatMessages] Failed to save:', error.message);
      }
    },
    [conversationId, messages, collapsedDescriptions, operationLogs, saveMessagesMutation, saveToCache],
  );

  // ─── 消息操作 ──────────────────────────
  const addMessage = useCallback(
    (msg: Partial<ChatMessage> & { role: ChatMessage['role']; content: string }) => {
      const fullMsg: ChatMessage = {
        id: nextMsgId(),
        timestamp: Date.now(),
        ...msg,
      };
      setMessages((prev) => [...prev, fullMsg]);
      return fullMsg;
    },
    [nextMsgId],
  );

  const updateLastMessage = useCallback(
    (updater: (msg: ChatMessage) => ChatMessage) => {
      setMessages((prev) => {
        if (prev.length === 0) return prev;
        const updated = [...prev];
        updated[updated.length - 1] = updater(updated[updated.length - 1]);
        return updated;
      });
    },
    [],
  );

  const editAndResend = useCallback(
    (index: number, _newContent: string): ChatMessage[] => {
      const truncated = messages.slice(0, index);
      setMessages(truncated);
      return truncated;
    },
    [messages],
  );

  const removeLastAssistant = useCallback((): ChatMessage | null => {
    const lastIdx = messages.length - 1;
    if (lastIdx < 0 || messages[lastIdx].role !== 'assistant') return null;
    const removed = messages[lastIdx];
    setMessages((prev) => prev.slice(0, -1));
    return removed;
  }, [messages]);

  const toggleDescription = useCallback((index: number) => {
    setCollapsedDescriptions((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setCollapsedDescriptions(new Set());
    setOperationLogs([]);
  }, []);

  // ─── 保存操作日志到 localStorage ──────
  useEffect(() => {
    if (conversationId && operationLogs.length > 0) {
      saveOperationLogs(conversationId.toString(), operationLogs);
    }
  }, [conversationId, operationLogs]);

  // ─── 返回 ──────────────────────────────
  return {
    // 状态
    messages,
    isLoading,
    collapsedDescriptions,
    operationLogs,

    // Setters（向后兼容，供 Chat.tsx 中现有代码直接使用）
    setMessages,
    setOperationLogs,
    setCollapsedDescriptions,

    // 操作
    loadMessages,
    saveMessages,
    addMessage,
    updateLastMessage,
    editAndResend,
    removeLastAssistant,
    toggleDescription,
    clearMessages,
    nextMsgId,
    saveToCache,
    clearCache: (convId: number) => { cacheRef.current.delete(convId); },

    // 工具
    parseDisplayMessages,
    computeCollapsedIndices,
    extractResearchTaskId,
  };
}
