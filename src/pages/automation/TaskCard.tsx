/**
 * 网站运营助手 - 任务卡片组件
 * 模板数据和类型已提取到 templates.tsx / types.ts
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import {
  Play, Pause, Square, Trash2, Eye,
  Clock, AlertCircle, CheckCircle, Loader2,
  RotateCcw, Coins,
} from "lucide-react";
import type { SiteAccount, AutomationTask, TaskStep } from "./types";
import { apiFetch, cleanInstruction } from "./types";
import { TEMPLATES } from "./templates";

export function TaskCard({ task, onStart, onPause, onCancel, onDelete, onView, onRetry }: {
  task: AutomationTask; onStart: () => void; onPause: () => void;
  onCancel: () => void; onDelete: () => void; onView: () => void; onRetry: () => void;
}) {
  const statusCfg: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending:   { color: "bg-gray-100 text-gray-600",   icon: <Clock className="w-3.5 h-3.5" />,              label: "待执行" },
    running:   { color: "bg-blue-100 text-blue-700",   icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: "执行中" },
    paused:    { color: "bg-yellow-100 text-yellow-700",icon: <Pause className="w-3.5 h-3.5" />,              label: "已暂停" },
    completed: { color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3.5 h-3.5" />,         label: "已完成" },
    failed:    { color: "bg-red-100 text-red-700",     icon: <AlertCircle className="w-3.5 h-3.5" />,         label: "失败" },
    cancelled: { color: "bg-gray-100 text-gray-400",   icon: <Square className="w-3.5 h-3.5" />,              label: "已取消" },
  };
  const s = statusCfg[task.status] || statusCfg.pending;
  const cleanedInstruction = cleanInstruction(task.instruction);

  return (
    <div className="bg-white rounded-2xl border hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-sm">{task.name}</h4>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
              {s.icon} {s.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-1">{cleanedInstruction}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>{task.totalSteps} 步</span>
            {task.startedAt && <span>{new Date(task.startedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.status === "pending" && (
            <button onClick={onStart} className="p-1.5 rounded-xl hover:bg-green-50 text-green-600" title="启动"><Play className="w-4 h-4" /></button>
          )}
          {task.status === "running" && (
            <>
              <button onClick={onView} className="p-1.5 rounded-xl hover:bg-blue-50 text-blue-600" title="查看实况"><Eye className="w-4 h-4" /></button>
              <button onClick={onPause} className="p-1.5 rounded-xl hover:bg-yellow-50 text-yellow-600" title="暂停"><Pause className="w-4 h-4" /></button>
              <button onClick={onCancel} className="p-1.5 rounded-xl hover:bg-red-50 text-red-500" title="取消"><Square className="w-4 h-4" /></button>
            </>
          )}
          {task.status === "paused" && (
            <button onClick={onStart} className="p-1.5 rounded-xl hover:bg-green-50 text-green-600" title="继续"><Play className="w-4 h-4" /></button>
          )}
          {(task.status === "completed" || task.status === "failed" || task.status === "cancelled") && (
            <button onClick={onView} className="p-1.5 rounded-xl hover:bg-blue-50 text-blue-600" title="查看详情"><Eye className="w-4 h-4" /></button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-xl hover:bg-red-50 text-red-400" title="删除"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* 执行进度 */}
      {task.status === "running" && task.progress > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span className="truncate">{task.currentStep || "执行中..."}</span>
            <span>{Math.round(task.progress)}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      )}

      {/* 失败信息 + 重试 */}
      {task.status === "failed" && task.errorMessage && (
        <div className="mt-3 p-2.5 bg-red-50 rounded-xl text-xs text-red-600 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="line-clamp-2">{task.errorMessage}</p>
          </div>
          <button onClick={onRetry} className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg whitespace-nowrap shrink-0">
            <RotateCcw className="w-3 h-3" /> 重试
          </button>
        </div>
      )}

      {/* 完成后的论坛同步提示（mpsboring相关任务） */}
      {task.status === "completed" && task.name.toLowerCase().includes("签到") || task.status === "completed" && task.name.includes("发帖") || task.status === "completed" && task.name.includes("回复") ? (
        <SyncHint />
      ) : null}
    </div>
  );
}

export function SyncHint() {
  const utils = trpc.useUtils();
  const syncMutation = trpc.fishCoin.syncFromForum.useMutation({
    onSuccess: () => { utils.fishCoin.getBalance.invalidate(); },
  });
  const [done, setDone] = useState(false);

  if (done) return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
      <CheckCircle className="w-3.5 h-3.5" /> 鱼币余额已同步
    </div>
  );

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-gray-400">论坛可能已获得积分</span>
      <button
        onClick={() => { syncMutation.mutate(); setDone(true); }}
        disabled={syncMutation.isPending}
        className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors">
        {syncMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Coins className="w-3 h-3" />}
        同步鱼币
      </button>
    </div>
  );
}

// ─────────────────── 主页面 ───────────────────
