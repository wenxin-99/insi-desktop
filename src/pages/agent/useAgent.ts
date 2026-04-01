/**
 * pages/agent/useAgent.ts — Agent 页面状态管理 Hook
 *
 * ★ Phase 3: 新增 filterScheduled、定时任务 mutations
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import type { AgentType, AgentStatus } from "./types";

export function useAgent() {
  const [filterType, setFilterType] = useState<AgentType | undefined>();
  const [filterStatus, setFilterStatus] = useState<AgentStatus | undefined>();
  /** ★ Phase 3: true=定时模板, false=一次性, undefined=全部(排除子任务) */
  const [filterScheduled, setFilterScheduled] = useState<boolean | undefined>();
  const [viewMode, setViewMode] = useState<"card" | "table">("card");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [page, setPage] = useState(0);
  const LIMIT = 12;

  // 任务列表 — ★ 传入 scheduled 筛选
  const tasksQuery = trpc.agent.list.useQuery(
    { type: filterType, status: filterStatus, scheduled: filterScheduled, limit: LIMIT, offset: page * LIMIT },
    { refetchInterval: 5000 },
  );

  // 单个任务详情
  const detailQuery = trpc.agent.get.useQuery(
    { taskId: selectedTaskId! },
    { enabled: !!selectedTaskId, refetchInterval: 3000 },
  );

  // 任务步骤
  const stepsQuery = trpc.agent.getSteps.useQuery(
    { taskId: selectedTaskId!, limit: 200 },
    { enabled: !!selectedTaskId, refetchInterval: 3000 },
  );

  // ★ Phase 3: 定时任务执行历史
  const scheduleRunsQuery = trpc.agent.getScheduleRuns.useQuery(
    { taskId: selectedTaskId!, limit: 20 },
    {
      enabled: !!selectedTaskId && (detailQuery.data as any)?.isTemplate === 1,
      refetchInterval: 5000,
    },
  );

  // Mutations — 原有
  const cancelMut = trpc.agent.cancel.useMutation({
    onSuccess: () => tasksQuery.refetch(),
  });
  const pauseMut = trpc.agent.pause.useMutation({
    onSuccess: () => { tasksQuery.refetch(); detailQuery.refetch(); },
  });
  const resumeMut = trpc.agent.resume.useMutation({
    onSuccess: () => { tasksQuery.refetch(); detailQuery.refetch(); },
  });
  const retryMut = trpc.agent.retry.useMutation({
    onSuccess: () => tasksQuery.refetch(),
  });
  const deleteMut = trpc.agent.deleteTask.useMutation({
    onSuccess: () => { tasksQuery.refetch(); setSelectedTaskId(null); },
  });
  const createMut = trpc.agent.create.useMutation({
    onSuccess: () => { tasksQuery.refetch(); setShowCreateModal(false); },
  });

  // ★ Phase 3: 定时任务 Mutations
  const createScheduledMut = trpc.agent.createScheduled.useMutation({
    onSuccess: () => { tasksQuery.refetch(); setShowCreateModal(false); },
  });
  const toggleScheduleMut = trpc.agent.toggleSchedule.useMutation({
    onSuccess: () => { tasksQuery.refetch(); detailQuery.refetch(); scheduleRunsQuery.refetch(); },
  });
  const runScheduleNowMut = trpc.agent.runScheduleNow.useMutation({
    onSuccess: () => { tasksQuery.refetch(); scheduleRunsQuery.refetch(); },
  });
  const deleteScheduleMut = trpc.agent.deleteSchedule.useMutation({
    onSuccess: () => { tasksQuery.refetch(); setSelectedTaskId(null); },
  });

  const handleCancel = useCallback((taskId: string) => cancelMut.mutate({ taskId }), [cancelMut]);
  const handlePause = useCallback((taskId: string) => pauseMut.mutate({ taskId }), [pauseMut]);
  const handleResume = useCallback((taskId: string) => resumeMut.mutate({ taskId }), [resumeMut]);
  const handleRetry = useCallback((taskId: string) => retryMut.mutate({ taskId }), [retryMut]);
  const handleDelete = useCallback((taskId: string) => deleteMut.mutate({ taskId }), [deleteMut]);

  const handleCreate = useCallback((data: { prompt: string; type: AgentType; tools?: string[]; sandboxMode?: string }) => {
    createMut.mutate(data as any);
  }, [createMut]);

  // ★ Phase 3: 创建定时任务
  const handleCreateScheduled = useCallback((data: {
    prompt: string; type: AgentType; cronExpression: string;
    timezone?: string; config?: any;
    webhookUrl?: string; webhookMethod?: string; webhookHeaders?: string; webhookBody?: string;
    maxRetries?: number; timeoutSeconds?: number;
  }) => {
    createScheduledMut.mutate(data as any);
  }, [createScheduledMut]);

  const handleToggleSchedule = useCallback((taskId: string) => toggleScheduleMut.mutate({ taskId }), [toggleScheduleMut]);
  const handleRunScheduleNow = useCallback((taskId: string) => runScheduleNowMut.mutate({ taskId }), [runScheduleNowMut]);
  const handleDeleteSchedule = useCallback((taskId: string) => deleteScheduleMut.mutate({ taskId }), [deleteScheduleMut]);

  return {
    // 过滤器
    filterType, setFilterType, filterStatus, setFilterStatus,
    filterScheduled, setFilterScheduled,
    viewMode, setViewMode,
    // 分页
    page, setPage, LIMIT,
    // 选中
    selectedTaskId, setSelectedTaskId,
    // 创建弹窗
    showCreateModal, setShowCreateModal,
    // 查询
    tasks: tasksQuery.data?.tasks || [],
    total: tasksQuery.data?.total || 0,
    isLoading: tasksQuery.isLoading,
    detail: detailQuery.data,
    steps: stepsQuery.data?.steps || [],
    // ★ Phase 3: 定时任务执行历史
    scheduleRuns: scheduleRunsQuery.data?.runs || [],
    scheduleRunsTotal: scheduleRunsQuery.data?.total || 0,
    scheduleInfo: scheduleRunsQuery.data?.schedule || null,
    // 操作
    handleCancel, handlePause, handleResume, handleRetry, handleCreate, handleDelete,
    isCreating: createMut.isPending,
    // ★ Phase 3: 定时操作
    handleCreateScheduled, handleToggleSchedule, handleRunScheduleNow, handleDeleteSchedule,
    isCreatingScheduled: createScheduledMut.isPending,
    // refetch
    refetch: tasksQuery.refetch,
  };
}
