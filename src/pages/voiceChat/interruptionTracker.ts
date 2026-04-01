/**
 * interruptionTracker.ts — 打断恢复追踪器
 *
 * ChatGPT Advanced Voice Mode 的打断恢复：
 *   用户打断 AI → AI 记住说到哪了 → 回答完用户新问题后，主动说
 *   "刚才我说到 XXX，要我继续吗？"
 *
 * 实现思路：
 *   1. 持续追踪 AI 正在输出的转录文本
 *   2. 当收到 interrupted 信号时，保存已说内容和推断的"完整意图"
 *   3. 在下一轮对话的 system prompt 中注入打断上下文
 *   4. AI 可以根据上下文决定是否主动恢复
 *
 * 使用方式：
 *   const tracker = createInterruptionTracker();
 *   // AI 输出转录时持续 feed
 *   tracker.feedAiTranscript("好的，关于这个问题...");
 *   // 被打断时
 *   tracker.markInterrupted();
 *   // 下一轮取恢复上下文注入 prompt
 *   const ctx = tracker.getRecoveryContext(); // 返回注入文本或空串
 */

export interface InterruptionRecord {
  /** AI 已经说出的内容 */
  spokenText: string;
  /** 被打断的时间 */
  interruptedAt: number;
  /** 是否已经恢复过（防止重复恢复） */
  recovered: boolean;
  /** 打断时用户正在说什么（如果有转录） */
  userTextAtInterrupt: string;
}

export interface InterruptionTrackerHandle {
  /** 喂入 AI 实时转录的文本片段（增量） */
  feedAiTranscript: (delta: string) => void;
  /** 喂入用户实时转录文本 */
  feedUserTranscript: (text: string) => void;
  /** 标记当前 AI 发言被打断 */
  markInterrupted: () => void;
  /** AI 新一轮开始时调用：清除实时转录缓冲 */
  resetTurn: () => void;
  /** 获取打断恢复上下文（注入 system prompt），获取后自动标记为已恢复 */
  getRecoveryContext: () => string;
  /** 是否有未恢复的打断 */
  hasPendingRecovery: () => boolean;
  /** 清空所有记录 */
  clear: () => void;
}

const MAX_SPOKEN_LENGTH = 500; // 截断过长的已说内容
const RECOVERY_EXPIRE_MS = 5 * 60 * 1000; // 5 分钟后打断恢复过期

export function createInterruptionTracker(): InterruptionTrackerHandle {
  let currentAiText = "";        // 当前轮 AI 的累积转录
  let currentUserText = "";      // 当前用户正在说的
  let pendingRecord: InterruptionRecord | null = null;

  return {
    feedAiTranscript(delta: string) {
      currentAiText += delta;
    },

    feedUserTranscript(text: string) {
      currentUserText = text;
    },

    markInterrupted() {
      const spoken = currentAiText.trim();
      if (spoken.length < 5) {
        // AI 几乎没说就被打断，不值得恢复
        currentAiText = "";
        return;
      }

      pendingRecord = {
        spokenText: spoken.length > MAX_SPOKEN_LENGTH
          ? spoken.substring(0, MAX_SPOKEN_LENGTH) + "..."
          : spoken,
        interruptedAt: Date.now(),
        recovered: false,
        userTextAtInterrupt: currentUserText.trim(),
      };

      console.log(`[InterruptTracker] Marked interrupted. Spoken: "${spoken.substring(0, 80)}..."`);

      // 重置当前轮缓冲
      currentAiText = "";
      currentUserText = "";
    },

    resetTurn() {
      currentAiText = "";
    },

    getRecoveryContext(): string {
      if (!pendingRecord || pendingRecord.recovered) return "";

      // 检查是否过期
      if (Date.now() - pendingRecord.interruptedAt > RECOVERY_EXPIRE_MS) {
        pendingRecord = null;
        return "";
      }

      const record = pendingRecord;
      pendingRecord = { ...record, recovered: true };

      // 构造恢复上下文
      const lines: string[] = [
        "\n[打断恢复上下文]",
        `你刚才正在回答时被用户打断了。你已经说到的内容是："${record.spokenText}"`,
      ];

      if (record.userTextAtInterrupt) {
        lines.push(`用户打断你时说的是："${record.userTextAtInterrupt}"`);
      }

      lines.push(
        "请先回答用户的新问题或回应用户的新发言。",
        `如果你之前的回答还没说完且仍然相关，回答完新问题后可以简短提及\u201C刚才说到…要继续吗？\u201D`,
        "如果用户的打断和你之前的话题无关，就不需要恢复了。",
        `注意：这段打断上下文是系统自动插入的，不要向用户提及\u201C系统告诉我\u201D之类的话。`,
      );

      return lines.join("\n");
    },

    hasPendingRecovery(): boolean {
      if (!pendingRecord || pendingRecord.recovered) return false;
      if (Date.now() - pendingRecord.interruptedAt > RECOVERY_EXPIRE_MS) return false;
      return true;
    },

    clear() {
      currentAiText = "";
      currentUserText = "";
      pendingRecord = null;
    },
  };
}
