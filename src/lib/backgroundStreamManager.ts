/**
 * BackgroundStreamManager — 多任务后台流式管理器
 *
 * - 每个对话独立运行一个流式任务，互不干扰
 * - 切换对话时旧对话的流继续后台运行
 * - 返回对话时自动恢复流式状态和 UI
 * - 服务端在 done 之前已持久化消息，客户端只需管 UI 状态
 * - 全局完成回调：即使无订阅者也能触发余额刷新、标题生成等副作用
 */

export type StreamEventType =
  | 'start' | 'content' | 'done' | 'error'
  | 'image' | 'image_placeholder' | 'image_count' | 'image_failed'
  | 'video_task' | 'fallback' | 'thinking'
  | 'intent_confirmation' | 'operation' | 'automation_task'
  | 'reasoning_content' | 'thinking_stage'
  | 'artifact_start' | 'artifact_chunk' | 'artifact_end'
  | 'file_preview';

export interface StreamEvent {
  type: StreamEventType;
  data: any;
  timestamp: number;
}

export type TaskStatus = 'running' | 'completed' | 'error' | 'aborted';

/** 切换对话时缓存的前端 UI 状态 */
export interface CachedClientState {
  messages: any[];
  operationLogs: any[];
  thinkingSteps: any[];
  realtimeThinkingSteps: any[];
  previewFile: any | null;
}

export interface StreamTask {
  conversationId: number;
  status: TaskStatus;
  abortController: AbortController;
  fullContent: string;
  events: StreamEvent[];
  replayedIndex: number;
  doneData: any | null;
  errorMessage: string | null;
  startedAt: number;
  completedAt: number | null;
  userMessageText: string;
  cachedClientState: CachedClientState | null;
  /** 全局完成回调是否已触发 */
  globalHandlerFired: boolean;
}

export interface TaskCompletionInfo {
  conversationId: number;
  status: 'completed' | 'error';
  fullContent: string;
  doneData: any | null;
  errorMessage: string | null;
  userMessageText: string;
  startedAt: number;
  completedAt: number;
}

type EventListener = (event: StreamEvent) => void;
type StatusChangeListener = () => void;
type GlobalCompletionListener = (info: TaskCompletionInfo) => void;

class BackgroundStreamManager {
  private tasks = new Map<number, StreamTask>();
  private activeSubscribers = new Map<number, EventListener>();
  private statusListeners = new Set<StatusChangeListener>();
  private globalCompletionListeners = new Set<GlobalCompletionListener>();

  /* ── 启动流 ── */

  startStream(
    conversationId: number,
    requestBody: {
      modelId: number;
      messages: any[];
      conversationId?: number;
      packageId?: number;
      hasVisionContent?: boolean;
      thinkingMode?: boolean;
      userCity?: string;
      aspectRatio?: string;
    },
    userMessageText: string,
  ): StreamTask {
    this.abortStream(conversationId);
    const abortController = new AbortController();
    const task: StreamTask = {
      conversationId,
      status: 'running',
      abortController,
      fullContent: '',
      events: [],
      replayedIndex: 0,
      doneData: null,
      errorMessage: null,
      startedAt: Date.now(),
      completedAt: null,
      userMessageText,
      cachedClientState: null,
      globalHandlerFired: false,
    };
    this.tasks.set(conversationId, task);
    this.notifyStatusChange();
    this.runStream(task, requestBody);
    return task;
  }

  /* ── 后台执行流（含自动重试） ── */

  private static MAX_RETRIES = 2; // 最多重试2次（共3次请求）
  private static RETRY_DELAYS = [1000, 3000]; // 指数退避：1秒、3秒

  /** 判断错误是否值得重试（网络错误、5xx服务器错误） */
  private isRetryableError(error: unknown, hasContent: boolean): boolean {
    // 已经收到了部分内容的流中断 → 不重试（保留已有内容）
    if (hasContent) return false;
    if (error instanceof TypeError && error.message.includes('fetch')) return true; // 网络错误
    if (error instanceof Error) {
      const msg = error.message.toLowerCase();
      if (msg.includes('network') || msg.includes('failed to fetch') || msg.includes('连接')) return true;
      if (msg.includes('500') || msg.includes('502') || msg.includes('503') || msg.includes('504')) return true;
      if (msg.includes('timeout') || msg.includes('超时')) return true;
    }
    return false;
  }

  private async runStream(task: StreamTask, requestBody: any) {
    let retryCount = 0;

    while (retryCount <= BackgroundStreamManager.MAX_RETRIES) {
      if (task.status === 'aborted') return;

      try {
        await this.executeStream(task, requestBody);
        return; // 成功完成，退出
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          if (task.status !== 'aborted') task.status = 'aborted';
          this.notifyStatusChange();
          return;
        }

        const canRetry = retryCount < BackgroundStreamManager.MAX_RETRIES
          && this.isRetryableError(err, task.fullContent.length > 0)
          && task.status === 'running';

        if (canRetry) {
          retryCount++;
          const delay = BackgroundStreamManager.RETRY_DELAYS[retryCount - 1] || 3000;
          console.log(`[BGStream] Transient error, retrying in ${delay}ms (attempt ${retryCount + 1}/${BackgroundStreamManager.MAX_RETRIES + 1}):`, err);
          // 通知前端正在重试
          this.emit(task, 'operation', {
            action: '网络重连',
            target: `第${retryCount}次重试中...`,
            operationStatus: 'running',
            timestamp: Date.now(),
          });
          await new Promise(r => setTimeout(r, delay));
          continue;
        }

        // 不可重试的错误
        task.status = 'error';
        task.completedAt = Date.now();
        task.errorMessage = err instanceof Error ? err.message : '未知错误';
        this.emit(task, 'error', { error: task.errorMessage });
        this.fireGlobalCompletionIfOrphaned(task);
        this.notifyStatusChange();
        return;
      }
    }
  }

  /** 执行单次流式请求 */
  private async executeStream(task: StreamTask, requestBody: any) {
    const token = localStorage.getItem('auth_token');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const response = await fetch('/api/chat/stream', {
      method: 'POST',
      headers,
      credentials: 'include',
      signal: task.abortController.signal,
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `请求失败 (${response.status})`);
    }
    if (!response.body) throw new Error('Response body is null');
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let shouldExit = false;
    while (true) {
      const { done, value } = await reader.read();
      if (done || shouldExit || task.status === 'aborted') break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (const line of lines) {
        if (task.status === 'aborted') { shouldExit = true; break; }
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        try {
          const jsonStr = trimmed.slice(6);
          if (jsonStr === '[DONE]') {
            this.emit(task, 'done', { newBalance: '', message: '' });
            shouldExit = true; break;
          }
          const data = JSON.parse(jsonStr);
          if (data.choices?.[0]?.delta?.content !== undefined) {
            const c = data.choices[0].delta.content;
            if (c) { task.fullContent += c; this.emit(task, 'content', { content: c }); }
            continue;
          }
          switch (data.type as string) {
            case 'content':
              task.fullContent += data.content || '';
              this.emit(task, 'content', data); break;
            case 'done':
              task.doneData = data;
              this.emit(task, 'done', data); shouldExit = true; break;
            case 'error':
              task.errorMessage = data.error || 'AI调用失败';
              this.emit(task, 'error', data); shouldExit = true; break;
            default:
              this.emit(task, data.type, data); break;
          }
        } catch (e) { console.error('[BGStream] parse err:', trimmed, e); }
      }
    }
    if (task.status === 'running') {
      task.status = 'completed';
      task.completedAt = Date.now();
      this.notifyStatusChange();
      this.fireGlobalCompletionIfOrphaned(task);
    }
  }

  private emit(task: StreamTask, type: string, data: any) {
    const event: StreamEvent = { type: type as StreamEventType, data, timestamp: Date.now() };
    task.events.push(event);
    const sub = this.activeSubscribers.get(task.conversationId);
    if (sub) { sub(event); task.replayedIndex = task.events.length; }
    if (type === 'done' || type === 'error') this.notifyStatusChange();
  }

  /**
   * 当任务完成但无活跃订阅者时，触发全局完成回调
   * 用于：余额刷新、标题生成、toast通知等副作用
   */
  private fireGlobalCompletionIfOrphaned(task: StreamTask) {
    if (task.globalHandlerFired) return;
    const hasSub = this.activeSubscribers.has(task.conversationId);
    if (hasSub) return; // 有订阅者会在组件内处理

    task.globalHandlerFired = true;
    const info: TaskCompletionInfo = {
      conversationId: task.conversationId,
      status: task.status === 'error' ? 'error' : 'completed',
      fullContent: task.fullContent,
      doneData: task.doneData,
      errorMessage: task.errorMessage,
      userMessageText: task.userMessageText,
      startedAt: task.startedAt,
      completedAt: task.completedAt || Date.now(),
    };
    console.log('[BGStream] Orphaned task completed, firing global handlers:', task.conversationId);
    for (const fn of this.globalCompletionListeners) {
      try { fn(info); } catch (e) { console.error('[BGStream] global handler error:', e); }
    }
  }

  /* ── 订阅 ── */

  subscribe(conversationId: number, listener: EventListener, skipReplay = false): () => void {
    this.activeSubscribers.set(conversationId, listener);
    if (!skipReplay) {
      const task = this.tasks.get(conversationId);
      if (task && task.replayedIndex < task.events.length) {
        const pending = task.events.slice(task.replayedIndex);
        task.replayedIndex = task.events.length;
        setTimeout(() => { for (const ev of pending) listener(ev); }, 0);
      }
    } else {
      // 跳过重放：标记所有已有事件为已消费（从此刻起只接收新事件）
      const task = this.tasks.get(conversationId);
      if (task) task.replayedIndex = task.events.length;
    }
    return () => {
      if (this.activeSubscribers.get(conversationId) === listener) {
        this.activeSubscribers.delete(conversationId);
      }
      // 取消订阅后：如果任务已完成但全局回调还没触发，立即触发
      const task = this.tasks.get(conversationId);
      if (task && (task.status === 'completed' || task.status === 'error')) {
        this.fireGlobalCompletionIfOrphaned(task);
      }
    };
  }

  /* ── 客户端状态缓存 ── */

  saveClientState(conversationId: number, state: CachedClientState) {
    const task = this.tasks.get(conversationId);
    if (task) task.cachedClientState = state;
  }
  getClientState(conversationId: number): CachedClientState | null {
    return this.tasks.get(conversationId)?.cachedClientState || null;
  }

  /* ── 查询 / 控制 ── */

  abortStream(conversationId: number) {
    const task = this.tasks.get(conversationId);
    if (task && task.status === 'running') {
      task.status = 'aborted'; task.abortController.abort(); this.notifyStatusChange();
    }
  }
  getTask(conversationId: number): StreamTask | undefined { return this.tasks.get(conversationId); }
  getRunningTasks(): StreamTask[] { return Array.from(this.tasks.values()).filter(t => t.status === 'running'); }
  getCompletedTasks(): StreamTask[] { return Array.from(this.tasks.values()).filter(t => t.status === 'completed' || t.status === 'error'); }
  getAllTasks(): StreamTask[] { return Array.from(this.tasks.values()); }
  clearTask(conversationId: number) { this.tasks.delete(conversationId); this.notifyStatusChange(); }
  isRunning(conversationId: number): boolean { return this.tasks.get(conversationId)?.status === 'running'; }
  isCompleted(conversationId: number): boolean { return this.tasks.get(conversationId)?.status === 'completed'; }

  /* ── 全局完成回调 ── */

  onGlobalComplete(listener: GlobalCompletionListener): () => void {
    this.globalCompletionListeners.add(listener);
    return () => { this.globalCompletionListeners.delete(listener); };
  }

  /* ── 全局状态监听 ── */

  onStatusChange(listener: StatusChangeListener): () => void {
    this.statusListeners.add(listener);
    return () => { this.statusListeners.delete(listener); };
  }
  private _statusChangeTimer: ReturnType<typeof setTimeout> | null = null;

  private notifyStatusChange() {
    // throttle: 同一 tick 内多次调用只触发一次，避免卡片闪烁
    if (this._statusChangeTimer) return;
    this._statusChangeTimer = setTimeout(() => {
      this._statusChangeTimer = null;
      for (const fn of this.statusListeners) { try { fn(); } catch (e) { /* noop */ } }
    }, 50);
  }
}

export const streamManager = new BackgroundStreamManager();
