/**
 * BranchNavigator — 消息分支导航器
 *
 * 编辑用户消息 或 重新生成 AI 回复 时，旧版本保存为分支。
 * 显示 ◀ 2/3 ▶ 导航控件，点击切换时替换该位置后的所有消息。
 *
 * 数据结构：
 *   userMsg._branches = [{ messages: [...], createdAt }, ...]
 *   userMsg._activeBranch = 0 (当前最新) | 1+ (历史分支索引)
 *   userMsg._currentSnapshot = [...] (当前版本的后续消息快照)
 */

import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ChatMessage } from '../../types';

interface BranchNavigatorProps {
  msg: ChatMessage;
  index: number;
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
}

export function BranchNavigator({ msg, index, messages, setMessages }: BranchNavigatorProps) {
  const branches = (msg as any)._branches as Array<{ messages: ChatMessage[]; createdAt: number }> | undefined;
  if (!branches || branches.length === 0) return null;

  const totalVersions = branches.length + 1; // 历史分支 + 当前版本
  const activeBranch: number = (msg as any)._activeBranch ?? 0; // 0 = 最新版
  const currentDisplay = totalVersions - activeBranch; // 用户看到的编号（最新 = 最大数字）

  const switchTo = (newActive: number) => {
    if (newActive === activeBranch) return;

    setMessages((prev: any[]) => {
      const updated = [...prev];
      const userMsg = { ...updated[index] } as any;
      const oldActive: number = userMsg._activeBranch ?? 0;

      // 1. 保存当前显示的后续消息
      const followingMessages = updated.slice(index + 1);

      if (oldActive === 0) {
        // 从"最新版本"切走 → 保存后续消息到 _currentSnapshot
        userMsg._currentSnapshot = followingMessages;
      } else {
        // 从某个历史分支切走 → 更新那个分支的消息
        userMsg._branches = [...(userMsg._branches || [])];
        userMsg._branches[oldActive - 1] = {
          ...userMsg._branches[oldActive - 1],
          messages: [updated[index], ...followingMessages],
        };
      }

      // 2. 加载目标分支
      let targetFollowing: any[];
      if (newActive === 0) {
        // 切回最新版本
        targetFollowing = userMsg._currentSnapshot || [];
      } else {
        // 切到历史分支
        const branch = userMsg._branches[newActive - 1];
        if (!branch || !branch.messages || branch.messages.length === 0) return prev;
        // 分支第一条是用户消息本身（旧内容），后面是 AI 回复 + 后续
        targetFollowing = branch.messages.slice(1);
      }

      userMsg._activeBranch = newActive;

      // 3. 拼接：index 之前的消息 + 更新后的用户消息 + 目标分支后续
      return [...updated.slice(0, index), userMsg, ...targetFollowing];
    });
  };

  return (
    <div className="inline-flex items-center gap-0.5 text-xs text-muted-foreground select-none">
      <button
        onClick={() => switchTo(Math.min(activeBranch + 1, totalVersions - 1))}
        disabled={activeBranch >= totalVersions - 1}
        className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="查看更早版本"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <span className="min-w-[2rem] text-center tabular-nums font-medium text-[11px]">
        {currentDisplay}/{totalVersions}
      </span>
      <button
        onClick={() => switchTo(Math.max(activeBranch - 1, 0))}
        disabled={activeBranch <= 0}
        className="p-0.5 rounded hover:bg-accent disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        title="查看更新版本"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
