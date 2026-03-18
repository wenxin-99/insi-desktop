/**
 * ResearchTaskRegistry — 追踪各对话中正在执行的研究代理任务
 *
 * 与 streamManager 互补：
 * - streamManager 追踪 LLM 聊天流（秒级）
 * - researchTaskRegistry 追踪研究代理任务（分钟级）
 *
 * 用法：
 *   researchTaskRegistry.register(conversationId, taskId)   // 研究任务启动时
 *   researchTaskRegistry.complete(conversationId)           // 任务完成/失败时
 *   researchTaskRegistry.isRunning(conversationId)          // 查询某对话是否有活跃任务
 *
 * 支持 useSyncExternalStore 订阅，用于 React 组件实时更新。
 */

type Listener = () => void;

/** 研究任务最大存活时间（15 分钟后自动清除，防止遗留） */
const MAX_TASK_AGE_MS = 15 * 60 * 1000;

interface TaskEntry {
  taskId: number;
  registeredAt: number;
}

class ResearchTaskRegistry {
  /** conversationId → TaskEntry */
  private activeTasks = new Map<number, TaskEntry>();
  private listeners = new Set<Listener>();

  /** 注册研究任务 */
  register(conversationId: number, taskId: number) {
    this.activeTasks.set(conversationId, { taskId, registeredAt: Date.now() });
    this.notify();
    console.log(`[ResearchRegistry] Registered task #${taskId} for conversation #${conversationId}`);
  }

  /** 标记任务完成（或失败） */
  complete(conversationId: number) {
    if (this.activeTasks.has(conversationId)) {
      const entry = this.activeTasks.get(conversationId);
      this.activeTasks.delete(conversationId);
      this.notify();
      console.log(`[ResearchRegistry] Completed task #${entry?.taskId} for conversation #${conversationId}`);
    }
  }

  /** 通过 taskId 标记完成 */
  completeByTaskId(taskId: number) {
    for (const [convId, entry] of this.activeTasks) {
      if (entry.taskId === taskId) {
        this.activeTasks.delete(convId);
        this.notify();
        console.log(`[ResearchRegistry] Completed task #${taskId} (conversation #${convId})`);
        return;
      }
    }
  }

  /** 查询某对话是否有活跃研究任务（含过期清理） */
  isRunning(conversationId: number): boolean {
    const entry = this.activeTasks.get(conversationId);
    if (!entry) return false;
    // 自动过期清理
    if (Date.now() - entry.registeredAt > MAX_TASK_AGE_MS) {
      this.activeTasks.delete(conversationId);
      this.notify();
      return false;
    }
    return true;
  }

  /** 获取某对话的活跃任务 ID */
  getTaskId(conversationId: number): number | null {
    return this.activeTasks.get(conversationId)?.taskId ?? null;
  }

  /** 获取所有运行中的任务（含过期清理） */
  getRunningTasks(): Array<{ conversationId: number; taskId: number }> {
    const now = Date.now();
    const result: Array<{ conversationId: number; taskId: number }> = [];
    for (const [conversationId, entry] of this.activeTasks) {
      if (now - entry.registeredAt > MAX_TASK_AGE_MS) {
        this.activeTasks.delete(conversationId);
      } else {
        result.push({ conversationId, taskId: entry.taskId });
      }
    }
    return result;
  }

  /** 订阅状态变化（用于 useSyncExternalStore） */
  onStatusChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((fn) => fn());
  }
}

export const researchTaskRegistry = new ResearchTaskRegistry();
