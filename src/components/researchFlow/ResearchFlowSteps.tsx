/**
 * researchFlow/ResearchFlowSteps.tsx — 对话流式研究步骤
 *
 * 替代 ResearchTaskCard 的卡片模式，将步骤作为对话气泡融入聊天流。
 *
 * 数据源与 ResearchTaskCard 完全一致：
 * - tRPC: research.getTaskDetails 轮询任务状态和 DB 步骤
 * - Socket: useSandboxSocket 接收实时事件
 *
 * 核心逻辑：
 * 1. 将 Socket 实时事件 + DB 步骤统一转为 FlowStep[]
 * 2. 自动折叠中间步骤（保留首尾 + 最近 N 步可见）
 * 3. 运行中底部显示分阶段进度 + 控制栏
 * 4. 完成后显示 ReportBubble
 * 5. 点击浏览/终端步骤联动右侧沙箱面板
 * 6. 将 sandbox 截图匹配到 browse 步骤的缩略图
 */
import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { useConfirm } from '@/components/ConfirmDialog';
import { trpc } from '@/lib/trpc';
import { useSandboxSocket } from '@/hooks/useSandboxSocket';

import type { FlowStep, StepCategory, TaskPhase } from './types';
import { inferPhase } from './types';
import { StepBubble } from './StepBubble';
import { CollapsedGroup } from './CollapsedGroup';
import { ControlBar } from './ControlBar';
import { ReportBubble } from './ReportBubble';

// ── Props（与 ResearchTaskCard 兼容） ──
interface ResearchFlowStepsProps {
  taskId: number;
  prompt: string;
  onOpenSandbox?: (taskId: number) => void;
}

// ── 折叠阈值：超过此数量时中间步骤折叠 ──
const COLLAPSE_THRESHOLD = 5;
const VISIBLE_HEAD = 2;
const VISIBLE_TAIL = 3;

export function ResearchFlowSteps({ taskId, prompt, onOpenSandbox }: ResearchFlowStepsProps) {
  const confirm = useConfirm();
  const [collapsed, setCollapsed] = useState(true);
  const [userExpanded, setUserExpanded] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // ═══════ 数据源：与 ResearchTaskCard 一致 ═══════

  const cancelTask = trpc.research.cancelTask.useMutation();

  const { data: taskData, refetch: refetchTask } = trpc.research.getTaskDetails.useQuery(
    { taskId },
    {
      refetchInterval: (query) => {
        const status = query?.state?.data?.status;
        if (status === 'completed' || status === 'failed') return false;
        return 3000;
      },
    },
  );

  const sandbox = useSandboxSocket(taskId);

  const rawStatus = taskData?.status || 'pending';
  const status = rawStatus === 'processing' ? 'running' : rawStatus;
  const dbSteps = taskData?.steps || [];
  const rawReport = taskData?.report || taskData?.reportContent || '';
  const report = rawReport
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');

  const isRunning = status === 'running' || status === 'pending';
  const isFinished = status === 'completed' || status === 'failed';

  // ═══════ 浏览器截图快照映射 ═══════
  // 为 browse 类型步骤匹配最近的截图

  const browserHistory = sandbox.browser?.history || [];
  const currentScreenshot = sandbox.browser?.screenshot || '';

  const findScreenshotForUrl = useCallback((url: string): string | undefined => {
    if (!url) return undefined;
    // 从 history 反向找匹配 URL 的截图
    // history 里目前不存截图 base64，只有 url/title/timestamp
    // 所以如果是最新的 URL 就用当前截图
    if (sandbox.browser?.url && url.includes(new URL(sandbox.browser.url).hostname)) {
      return currentScreenshot || undefined;
    }
    return undefined;
  }, [sandbox.browser?.url, currentScreenshot]);

  // ═══════ 转换：Socket 实时事件 → FlowStep[] ═══════

  const realtimeSteps = useMemo<FlowStep[]>(() => {
    const entries: FlowStep[] = [];

    // Agent 步骤
    if (sandbox.steps) {
      for (const step of sandbox.steps) {
        const { stepType, content, stepNumber } = step.payload;
        let category: StepCategory = 'think';
        let title = content?.substring(0, 120) || `步骤 #${stepNumber}`;
        let detail = content?.substring(0, 300);

        switch (stepType) {
          case 'think':
            category = 'think';
            title = '思考分析';
            break;
          case 'search':
            category = 'search';
            title = `搜索: ${content?.substring(0, 80)}`;
            break;
          case 'observe':
            category = 'observe';
            title = '分析搜索结果';
            break;
          default:
            category = 'think';
            title = stepType || '执行步骤';
        }

        entries.push({
          id: `rt-${stepType}-${stepNumber}`,
          category,
          title,
          detail,
          timestamp: step.timestamp,
        });
      }
    }

    // 终端命令
    const terminalLines = sandbox.terminal?.lines || [];
    for (let i = 0; i < terminalLines.length; i++) {
      const line = terminalLines[i];
      if (line.type === 'command') {
        const cmdText = line.content
          .replace(/\x1b\[[0-9;]*m/g, '')
          .replace(/\$ /g, '')
          .trim();
        if (cmdText && !cmdText.includes('自动化沙箱终端已就绪')) {
          entries.push({
            id: `rt-cmd-${i}`,
            category: 'command',
            title: cmdText.substring(0, 80),
            detail: cmdText,
            timestamp: line.timestamp,
          });
        }
      }
    }

    // 浏览器历史 — 附加截图
    if (sandbox.browser?.history) {
      for (let i = 0; i < sandbox.browser.history.length; i++) {
        const page = sandbox.browser.history[i];
        entries.push({
          id: `rt-browse-${i}`,
          category: 'browse',
          title: page.title || page.url,
          url: page.url,
          screenshotBase64: findScreenshotForUrl(page.url),
          timestamp: page.timestamp,
        });
      }
    }

    // 排序 + 去重连续思考
    entries.sort((a, b) => a.timestamp - b.timestamp);
    const deduped: FlowStep[] = [];
    for (const entry of entries) {
      const prev = deduped[deduped.length - 1];
      if (prev && prev.category === entry.category && prev.category === 'think' && prev.detail === entry.detail) {
        continue;
      }
      deduped.push(entry);
    }
    return deduped;
  }, [sandbox.steps, sandbox.terminal?.lines, sandbox.browser?.history, findScreenshotForUrl]);

  // ═══════ 转换：DB 步骤 → FlowStep[] ═══════

  const dbFlowSteps = useMemo<FlowStep[]>(() => {
    return dbSteps.map((step: any, index: number) => {
      const categoryMap: Record<string, StepCategory> = {
        thought: 'think',
        action: 'command',
        observation: 'observe',
        summary: 'summary',
        search: 'search',
        browse: 'browse',
        code: 'code',
      };
      return {
        id: `db-${step.id || index}`,
        category: categoryMap[step.type] || 'think',
        title: ({'thought':'思考分析','action':'执行操作','observation':'分析结果','summary':'正在撰写研究报告','search':'搜索','browse':'浏览网页'}[step.type] || step.toolName || step.type || '步骤') + (step.toolName && step.type === 'action' ? ': ' + step.toolName : ''),
        detail: step.content?.substring(0, 300),
        timestamp: step.createdAt ? new Date(step.createdAt).getTime() : Date.now(),
      };
    });
  }, [dbSteps]);

  // 合并：优先用实时数据
  const allSteps = realtimeSteps.length > 0 ? realtimeSteps : dbFlowSteps;

  // ═══════ 阶段推断 ═══════

  const currentPhase: TaskPhase = useMemo(() => inferPhase(allSteps), [allSteps]);

  // 阶段内进度（粗略估算）
  const phaseProgress = useMemo(() => {
    if (status === 'completed') return 100;
    if (status === 'pending') return 0;
    if (sandbox.progress > 0) {
      // 用 sandbox.progress 映射到当前阶段
      if (currentPhase === 'search') return Math.min(90, sandbox.progress * 3);
      if (currentPhase === 'analyze') return Math.min(90, (sandbox.progress - 30) * 2.5);
      return Math.min(90, (sandbox.progress - 60) * 2.5);
    }
    // 根据步骤数粗算
    return Math.min(85, allSteps.length * 8);
  }, [status, sandbox.progress, currentPhase, allSteps.length]);

  // ═══════ 进度计算 ═══════

  const progressPercent = useMemo(() => {
    if (status === 'completed') return 100;
    if (status === 'failed') return 0;
    if (status === 'pending') return 5;
    if (sandbox.progress > 0) return sandbox.progress;
    return Math.max(10, Math.round(Math.min(allSteps.length / 30, 0.9) * 100));
  }, [status, allSteps.length, sandbox.progress]);

  // ═══════ 时间计算 ═══════

  const baseTime = allSteps.length > 0 ? allSteps[0].timestamp : Date.now();
  const lastTime = allSteps.length > 0 ? allSteps[allSteps.length - 1].timestamp : Date.now();

  const formatDuration = (ms: number): string => {
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    return `${Math.floor(s / 60)}m${(s % 60).toString().padStart(2, '0')}s`;
  };

  const duration = formatDuration(lastTime - baseTime);

  // ═══════ 自动滚动 ═══════

  useEffect(() => {
    if (isRunning && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [allSteps.length, isRunning]);

  // 完成后自动折叠
  useEffect(() => {
    if (isFinished && !userExpanded) {
      setCollapsed(true);
    }
  }, [isFinished, userExpanded]);

  // ═══════ 步骤折叠逻辑 ═══════

  const renderItems = useMemo(() => {
    if (!collapsed || allSteps.length <= COLLAPSE_THRESHOLD + 1) {
      return allSteps.map((s) => ({ type: 'step' as const, step: s }));
    }
    const head = allSteps.slice(0, VISIBLE_HEAD);
    const tail = allSteps.slice(-VISIBLE_TAIL);
    const middle = allSteps.slice(VISIBLE_HEAD, allSteps.length - VISIBLE_TAIL);

    const items: Array<{ type: 'step'; step: FlowStep } | { type: 'collapsed'; steps: FlowStep[] }> = [];
    head.forEach((s) => items.push({ type: 'step', step: s }));
    if (middle.length > 0) {
      items.push({ type: 'collapsed', steps: middle });
    }
    tail.forEach((s) => items.push({ type: 'step', step: s }));
    return items;
  }, [allSteps, collapsed]);

  // ═══════ 统计 ═══════

  const browseCount = allSteps.filter((s) => s.category === 'browse').length;

  // ═══════ 沙箱联动 ═══════

  const handleOpenSandbox = useCallback((taskId: number) => {
    onOpenSandbox?.(taskId);
  }, [onOpenSandbox]);

  // ═══════ 渲染 ═══════

  return (
    <div className="w-full space-y-2">
      {/* 步骤时间线 */}
      {allSteps.length > 0 && (
        <div className="relative">
          {/* 时间线竖线 */}
          <div className="absolute left-[8px] md:left-[9px] top-0 bottom-0 w-[2px] bg-gradient-to-b from-border via-border to-transparent" />

          <div className="space-y-2">
            {renderItems.map((item, idx) => {
              if (item.type === 'collapsed') {
                return (
                  <CollapsedGroup
                    key="collapsed"
                    steps={item.steps}
                    onExpand={() => {
                      setCollapsed(false);
                      setUserExpanded(true);
                    }}
                  />
                );
              }
              return (
                <StepBubble
                  key={item.step.id}
                  step={item.step}
                  baseTime={baseTime}
                  isLast={idx === renderItems.length - 1}
                  progress={progressPercent}
                  onOpenSandbox={handleOpenSandbox}
                />
              );
            })}

            {/* 运行中的加载指示器 */}
            {isRunning && (
              <div className="pl-7 md:pl-10 relative animate-in fade-in duration-200">
                <div className="absolute left-[-2px] md:left-[-5px] top-[3px] w-[20px] h-[20px] md:w-[28px] md:h-[28px] rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center z-10">
                  <Loader2 className="w-2.5 h-2.5 md:w-4 md:h-4 animate-spin text-blue-500" />
                </div>
                <div className="flex items-center gap-1.5 py-1">
                  <span className="text-[11px] text-blue-500 dark:text-blue-400 animate-pulse">
                    {sandbox.thinking
                      ? '正在思考...'
                      : sandbox.currentStep || '执行中...'}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 等待中（无步骤） */}
      {allSteps.length === 0 && isRunning && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-muted/40 border border-border/60">
          <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />
          <span className="text-[12px] text-muted-foreground">
            正在启动研究任务...
          </span>
        </div>
      )}

      {/* 当前思考内容（实时） */}
      {isRunning && sandbox.thinking && (
        <div className="pl-7">
          <div className="rounded-lg bg-amber-50/50 dark:bg-amber-950/10 border border-amber-200/40 dark:border-amber-800/20 px-3 py-2">
            <div className="flex items-start gap-1.5">
              <span className="text-[10px] text-amber-500 mt-0.5">💡</span>
              <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70 line-clamp-2 leading-relaxed">
                {sandbox.thinking}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 控制栏（含阶段进度） */}
      {isRunning && (
        <ControlBar
          status={status}
          taskId={taskId}
          isStopping={cancelTask.isPending}
          currentPhase={currentPhase}
          phaseProgress={phaseProgress}
          socket={sandbox.socket}
          onStop={async () => {
            if (await confirm({ title: '停止任务', description: '确认停止此研究任务？停止后无法恢复。', confirmText: '停止', variant: 'destructive' })) {
              await cancelTask.mutateAsync({ taskId });
              refetchTask();
            }
          }}
          onOpenSandbox={onOpenSandbox}
        />
      )}

      {/* 完成/失败报告 */}
      {isFinished && (
        <ReportBubble
          report={report}
          status={status as 'completed' | 'failed'}
          stepCount={allSteps.length}
          browseCount={browseCount}
          duration={duration}
        />
      )}

      <div ref={bottomRef} />
    </div>
  );
}
