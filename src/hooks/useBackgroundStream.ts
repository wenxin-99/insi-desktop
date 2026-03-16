/**
 * useBackgroundStream — React hook for background-aware streaming
 *
 * - 切换对话时流继续后台运行
 * - 返回对话时自动恢复流式状态
 * - 多个对话可以同时运行流
 */
import { useState, useCallback, useRef, useEffect, useSyncExternalStore } from 'react';
import { streamManager, StreamEvent } from '@/lib/backgroundStreamManager';

interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string | Array<any>;
}

export interface StreamEventHandlers {
  onStart?: (data: any) => void;
  onContent?: (content: string) => void;
  onImagePlaceholder?: (data: any) => void;
  onImageCount?: (data: any) => void;
  onImage?: (data: any) => void;
  onVideoTask?: (data: any) => void;
  onFallback?: (data: any) => void;
  onThinking?: (data: any) => void;
  onIntentConfirm?: (data: any) => void;
  onOperation?: (data: any) => void;
  onAutomationTask?: (data: any) => void;
  onFilePreview?: (data: { fileName: string; action: string; newContent?: string; oldContent?: string; timestamp: number }) => void;
  onReasoningContent?: (data: { content: string }) => void;
  onThinkingStage?: (data: { stage: string; model?: string; error?: string }) => void;
  onThinkingSummary?: (data: { summary: string; timestamp: number }) => void;
  // Artifact 实时预览
  onArtifactStart?: (data: { artifact: { id: string; title: string; language: string; description?: string; version?: number } }) => void;
  onArtifactChunk?: (data: { artifactId: string; chunk: string }) => void;
  onArtifactEnd?: (data: { artifactId: string; metadata?: any }) => void;
  onSolutionPicker?: (data: any) => void;
  // 轻量联网搜索
  onWebSearchStart?: (data: { query: string }) => void;
  onWebSearchResult?: (data: { query: string; sources: Array<{ title: string; url: string }> }) => void;
  onWebSearchDone?: (data: any) => void;
  // 网页抓取
  onUrlFetchStart?: (data: { url: string }) => void;
  onUrlFetchResult?: (data: { url: string; title: string }) => void;
  onDone?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useBackgroundStream(conversationId: number | null) {
  const [streamedContent, setStreamedContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 平滑输出缓冲区
  const rawBufferRef = useRef('');
  const displayedLenRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);
  const isFlushingRef = useRef(false);
  const lastCommitTimeRef = useRef(0);

  // 事件回调（Chat.tsx 随时可更新）
  const handlersRef = useRef<StreamEventHandlers>({});
  const unsubRef = useRef<(() => void) | null>(null);

  /* ── 平滑动画（节流提交版） ── */
  const STATE_COMMIT_INTERVAL = 50;

  const animateStream = useCallback(() => {
    const rawLen = rawBufferRef.current.length;
    const cur = displayedLenRef.current;
    if (cur < rawLen) {
      const rem = rawLen - cur;
      let n: number;
      if (isFlushingRef.current) n = Math.min(rem, 80);
      else if (rem > 200) n = Math.min(rem, Math.max(15, Math.floor(rem * 0.15)));
      else if (rem > 50) n = Math.min(rem, 8);
      else n = Math.min(rem, 4);
      displayedLenRef.current = cur + n;
    }

    // 节流提交 React 状态
    const now = performance.now();
    if (isFlushingRef.current || now - lastCommitTimeRef.current >= STATE_COMMIT_INTERVAL) {
      lastCommitTimeRef.current = now;
      setStreamedContent(rawBufferRef.current.substring(0, displayedLenRef.current));
    }

    if (displayedLenRef.current < rawBufferRef.current.length || !isFlushingRef.current) {
      rafIdRef.current = requestAnimationFrame(animateStream);
    } else {
      setStreamedContent(rawBufferRef.current.substring(0, displayedLenRef.current));
      rafIdRef.current = null;
    }
  }, []);

  const startAnimation = useCallback(() => {
    if (rafIdRef.current === null) rafIdRef.current = requestAnimationFrame(animateStream);
  }, [animateStream]);

  const stopAnimation = useCallback(() => {
    if (rafIdRef.current !== null) { cancelAnimationFrame(rafIdRef.current); rafIdRef.current = null; }
  }, []);

  useEffect(() => () => stopAnimation(), [stopAnimation]);

  /* ── 事件处理 ── */

  const handleEvent = useCallback((event: StreamEvent) => {
    const h = handlersRef.current;
    const d = event.data;
    switch (event.type) {
      case 'start': h.onStart?.(d); break;
      case 'content': {
        const c = d.content || '';
        rawBufferRef.current += c;
        startAnimation();
        h.onContent?.(c);
        break;
      }
      case 'image_placeholder': h.onImagePlaceholder?.(d); break;
      case 'image_count': h.onImageCount?.(d); break;
      case 'image': h.onImage?.(d); break;
      case 'video_task': h.onVideoTask?.(d); break;
      case 'fallback': h.onFallback?.(d); break;
      case 'thinking': h.onThinking?.(d); break;
      case 'intent_confirmation': h.onIntentConfirm?.(d); break;
      case 'operation':
        h.onOperation?.({
          action: d.action, target: d.target,
          operationStatus: d.operationStatus || d.status,
          timestamp: d.timestamp,
          ...(d.diff ? { diff: d.diff } : {}),
          ...(d.detail ? { detail: d.detail } : {}),
          ...(d.stepType ? { stepType: d.stepType } : {}),
          ...(d.description ? { description: d.description } : {}),
        });
        break;
      case 'thinking_summary': h.onThinkingSummary?.(d); break;
      case 'artifact_start': h.onArtifactStart?.(d); break;
      case 'artifact_chunk': h.onArtifactChunk?.(d); break;
      case 'artifact_end': h.onArtifactEnd?.(d); break;
      case 'solution_picker': h.onSolutionPicker?.(d); break;
      case 'web_search_start': h.onWebSearchStart?.(d); break;
      case 'web_search_result': h.onWebSearchResult?.(d); break;
      case 'web_search_done': h.onWebSearchDone?.(d); break;
      case 'url_fetch_start': h.onUrlFetchStart?.(d); break;
      case 'url_fetch_result': h.onUrlFetchResult?.(d); break;
      case 'automation_task': h.onAutomationTask?.(d); break;
      case 'file_preview': h.onFilePreview?.(d); break;
      case 'reasoning_content': h.onReasoningContent?.(d); break;
      case 'thinking_stage': h.onThinkingStage?.(d); break;
      case 'done':
        stopAnimation();
        if (rawBufferRef.current.length > displayedLenRef.current) {
          displayedLenRef.current = rawBufferRef.current.length;
          setStreamedContent(rawBufferRef.current);
        }
        h.onDone?.({
          ...d,
          newBalance: d.newBalance || '', message: d.message || '',
        });
        setIsStreaming(false);
        break;
      case 'error':
        stopAnimation();
        setError(d.error || 'AI调用失败');
        h.onError?.(d.error || 'AI调用失败');
        setIsStreaming(false);
        break;
    }
  }, [startAnimation, stopAnimation]);

  /* ── 对话切换时 订阅 / 取消订阅 ── */

  useEffect(() => {
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    if (!conversationId) { setIsStreaming(false); return; }

    const task = streamManager.getTask(conversationId);
    let isResuming = false;

    if (task && task.status === 'running') {
      // 恢复后台运行中的流：立即显示已累积内容
      setIsStreaming(true);
      setError(null);
      rawBufferRef.current = task.fullContent;
      displayedLenRef.current = task.fullContent.length;
      setStreamedContent(task.fullContent);
      isResuming = true; // 标记为恢复模式，跳过事件重放（fullContent 已包含全部内容）
    } else if (task && (task.status === 'completed' || task.status === 'error')) {
      streamManager.clearTask(conversationId);
      setIsStreaming(false);
    } else {
      setIsStreaming(false);
    }

    // 订阅：恢复模式跳过重放，只接收新事件
    const unsub = streamManager.subscribe(conversationId, handleEvent, isResuming);
    unsubRef.current = unsub;

    return () => { unsub(); unsubRef.current = null; };
  }, [conversationId, handleEvent]);

  /* ── 更新回调 ── */
  const setOptions = useCallback((opts: StreamEventHandlers) => {
    handlersRef.current = opts;
  }, []);

  /* ── 发送消息 ── */

  const sendMessage = useCallback(
    async (
      modelId: number,
      messages: Message[],
      targetConversationId: number | undefined,
      options: StreamEventHandlers = {},
      packageId?: number,
      hasVisionContent?: boolean,
      thinkingMode?: boolean,
      userCity?: string | null,
      aspectRatio?: string | null,
    ) => {
      if (!targetConversationId) return;

      handlersRef.current = options;

      // 重置本地状态
      setIsStreaming(true);
      setStreamedContent('');
      setError(null);
      rawBufferRef.current = '';
      displayedLenRef.current = 0;
      isFlushingRef.current = false;
      stopAnimation();

      const lastUser = messages.filter(m => m.role === 'user').pop();
      const userText = typeof lastUser?.content === 'string'
        ? lastUser.content.substring(0, 50)
        : '对话中...';

      streamManager.startStream(
        targetConversationId,
        { modelId, messages, conversationId: targetConversationId, packageId, hasVisionContent, thinkingMode, userCity: userCity || undefined, aspectRatio: aspectRatio || undefined },
        userText,
      );
    },
    [stopAnimation],
  );

  /* ── 中止 ── */

  const abort = useCallback(() => {
    if (conversationId) streamManager.abortStream(conversationId);
    stopAnimation();
    setIsStreaming(false);
  }, [conversationId, stopAnimation]);

  /* ── 重置 ── */

  const reset = useCallback(() => {
    setStreamedContent('');
    setError(null);
    setIsStreaming(false);
    rawBufferRef.current = '';
    displayedLenRef.current = 0;
    isFlushingRef.current = false;
    stopAnimation();
  }, [stopAnimation]);

  return { sendMessage, isStreaming, streamedContent, error, reset, abort, setOptions };
}

/* ── 全局后台任务状态 ── */

export function useBackgroundTasks() {
  const subscribe = useCallback((cb: () => void) => streamManager.onStatusChange(cb), []);
  const getSnapshot = useCallback(() => {
    return streamManager.getRunningTasks().length;
  }, []);
  const runningCount = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  return {
    runningCount,
    getRunningTasks: useCallback(() => streamManager.getRunningTasks(), []),
    abortTask: useCallback((id: number) => streamManager.abortStream(id), []),
    isRunning: useCallback((id: number) => streamManager.isRunning(id), []),
  };
}
