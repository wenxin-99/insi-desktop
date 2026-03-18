/**
 * pages/admin/AgentDashboard.tsx — Agent 统计仪表盘（Admin）
 *
 * 显示：任务量、成功率、平均步骤数、费用、队列状态
 */
import { useState } from "react";
import {
  BarChart3, CheckCircle, XCircle, Clock, Cpu, Zap, Coins,
  TrendingUp, Activity, Loader2, RefreshCw, Server,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 flex items-start gap-4">
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        <p className="text-2xl font-bold mt-0.5">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AgentDashboard() {
  const statsQuery = trpc.agent.stats.useQuery(undefined, { refetchInterval: 15000 });
  const queueQuery = trpc.agent.queueStats.useQuery(undefined, { refetchInterval: 5000 });

  const stats = statsQuery.data || {} as any;
  const queue = queueQuery.data || {} as any;

  const total = Number(stats.total) || 0;
  const completed = Number(stats.completed) || 0;
  const failed = Number(stats.failed) || 0;
  const running = Number(stats.running) || 0;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* 标题 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BarChart3 className="w-6 h-6 text-primary" />
              Agent 运营仪表盘
            </h1>
            <p className="text-sm text-muted-foreground mt-1">最近 7 天统计数据</p>
          </div>
          <button
            onClick={() => { statsQuery.refetch(); queueQuery.refetch(); }}
            className="p-2 rounded-lg hover:bg-muted text-muted-foreground"
          >
            <RefreshCw className={`w-4 h-4 ${statsQuery.isLoading ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <StatCard icon={Cpu} label="总任务数" value={total} sub="近 7 天" color="bg-blue-50 text-blue-600" />
          <StatCard icon={CheckCircle} label="成功率" value={`${successRate}%`} sub={`${completed} 完成 / ${failed} 失败`} color="bg-green-50 text-green-600" />
          <StatCard icon={Zap} label="平均步骤" value={Math.round(Number(stats.avgSteps) || 0)} sub="每个任务" color="bg-amber-50 text-amber-600" />
          <StatCard icon={Coins} label="平均费用" value={`${(Number(stats.avgCost) || 0).toFixed(1)}🐟`} sub="每个任务" color="bg-purple-50 text-purple-600" />
        </div>

        {/* 队列状态 */}
        <div className="rounded-2xl border bg-card p-5 mb-8">
          <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
            <Server className="w-4 h-4 text-primary" />
            任务队列实时状态
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <QueueStat label="等待中" value={queue.waiting || 0} color="text-yellow-600" />
            <QueueStat label="执行中" value={queue.active || 0} color="text-cyan-600" />
            <QueueStat label="已完成" value={queue.completed || 0} color="text-green-600" />
            <QueueStat label="失败" value={queue.failed || 0} color="text-red-600" />
            <QueueStat label="并发上限" value={queue.workerConcurrency || 3} color="text-gray-600" />
          </div>
        </div>

        {/* 状态分布 */}
        <div className="rounded-2xl border bg-card p-5">
          <h2 className="font-bold text-sm flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-primary" />
            任务状态分布
          </h2>
          <div className="flex items-end gap-1 h-32">
            {[
              { label: "完成", value: completed, color: "bg-green-400", total },
              { label: "失败", value: failed, color: "bg-red-400", total },
              { label: "运行中", value: running, color: "bg-cyan-400", total },
              { label: "取消", value: Number(stats.cancelled) || 0, color: "bg-gray-400", total },
            ].map((bar, i) => {
              const height = total > 0 ? Math.max(4, (bar.value / total) * 100) : 4;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-xs font-medium">{bar.value}</span>
                  <div
                    className={`w-full rounded-t-lg ${bar.color} transition-all duration-500`}
                    style={{ height: `${height}%` }}
                  />
                  <span className="text-[10px] text-muted-foreground">{bar.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function QueueStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  );
}
