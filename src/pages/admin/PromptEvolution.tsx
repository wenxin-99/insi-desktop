/**
 * Admin - 提示词进化 & 用户记忆 管理页面
 */
import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, XCircle, Undo2, Play, Loader2,
  Brain, Zap, AlertTriangle, TrendingUp, Eye, Trash2, RefreshCw,
} from "lucide-react";
import { useLocation } from "wouter";

type Tab = "dashboard" | "patches" | "episodes" | "memories";

const STATUS_COLORS: Record<string, string> = {
  proposed: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  deployed: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  reverted: "bg-gray-100 text-gray-500",
};

const OUTCOME_COLORS: Record<string, string> = {
  success: "bg-green-100 text-green-800",
  partial: "bg-amber-100 text-amber-800",
  failure: "bg-red-100 text-red-800",
  timeout: "bg-orange-100 text-orange-800",
  cancelled: "bg-gray-100 text-gray-500",
};

export default function PromptEvolution() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [patchFilter, setPatchFilter] = useState("all");

  return (
    <DashboardLayout>
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">提示词进化 & 用户记忆</h1>
              <p className="text-sm text-muted-foreground">Agent 从历史任务中自动学习，持续优化提示词</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg w-fit">
          {(["dashboard", "patches", "episodes", "memories"] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded-md transition-colors ${
                tab === t ? "bg-background shadow text-foreground font-medium" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {{ dashboard: "📊 仪表板", patches: "🔧 补丁管理", episodes: "📋 任务复盘", memories: "🧠 用户记忆" }[t]}
            </button>
          ))}
        </div>

        {/* Content */}
        {tab === "dashboard" && <DashboardTab />}
        {tab === "patches" && <PatchesTab filter={patchFilter} setFilter={setPatchFilter} />}
        {tab === "episodes" && <EpisodesTab />}
        {tab === "memories" && <MemoriesTab />}
      </div>
    </DashboardLayout>
  );
}

// ═══════════════════════════════════
// 仪表板
// ═══════════════════════════════════

function DashboardTab() {
  const { data, isLoading, refetch } = trpc.promptEvolution.getDashboard.useQuery();
  const runAnalysis = trpc.promptEvolution.runAnalysis.useMutation({
    onSuccess: (result) => {
      toast.success(`分析完成: ${result.episodeCount} 个任务, ${result.patchesProposed} 个补丁建议`);
      refetch();
    },
    onError: (e) => toast.error(e.message),
  });

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-6">
      {/* Metrics cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-lg"><TrendingUp className="h-5 w-5 text-blue-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">激活补丁</p>
                <p className="text-2xl font-bold">{data?.activePatches ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-amber-100 rounded-lg"><AlertTriangle className="h-5 w-5 text-amber-600" /></div>
              <div>
                <p className="text-sm text-muted-foreground">待审核补丁</p>
                <p className="text-2xl font-bold">{data?.proposedPatches ?? 0}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="md:col-span-2">
          <CardContent className="pt-6">
            <pre className="text-sm text-muted-foreground whitespace-pre-wrap">{data?.metrics || "暂无数据"}</pre>
          </CardContent>
        </Card>
      </div>

      {/* Top failure patterns */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">Top 失败模式</CardTitle>
          <Button size="sm" variant="outline" onClick={() => runAnalysis.mutate()} disabled={runAnalysis.isPending}>
            {runAnalysis.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            立即分析
          </Button>
        </CardHeader>
        <CardContent>
          {data?.topPatterns && data.topPatterns.length > 0 ? (
            <div className="space-y-3">
              {data.topPatterns.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-sm bg-red-50 text-red-700 px-2 py-1 rounded">{p.name}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{p.count} 次</span>
                    <span>{(p.rate * 100).toFixed(0)}%</span>
                    <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-red-400 rounded-full" style={{ width: `${p.rate * 100}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground py-4">暂无数据，点击「立即分析」开始</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════
// 补丁管理
// ═══════════════════════════════════

function PatchesTab({ filter, setFilter }: { filter: string; setFilter: (f: string) => void }) {
  const { data: patches, refetch, isLoading } = trpc.promptEvolution.listPatches.useQuery({ status: filter });

  const approve = trpc.promptEvolution.approvePatch.useMutation({
    onSuccess: () => { toast.success("补丁已批准"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const reject = trpc.promptEvolution.rejectPatch.useMutation({
    onSuccess: () => { toast.success("补丁已拒绝"); refetch(); },
    onError: (e) => toast.error(e.message),
  });
  const revert = trpc.promptEvolution.revertPatch.useMutation({
    onSuccess: () => { toast.success("补丁已回滚"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        {["all", "proposed", "approved", "deployed", "rejected", "reverted"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 text-xs rounded-full transition-colors ${
              filter === s ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {s === "all" ? "全部" : s}
          </button>
        ))}
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="ml-auto">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !patches?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">暂无补丁</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {patches.map((patch: any) => (
            <Card key={patch.id}>
              <CardContent className="pt-5 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs bg-muted px-2 py-0.5 rounded">{patch.targetPattern}</span>
                      <Badge className={STATUS_COLORS[patch.status] || ""}>{patch.status}</Badge>
                      <span className="text-xs text-muted-foreground">{patch.targetFile}</span>
                    </div>
                    <p className="text-sm">{patch.reasoning}</p>
                  </div>

                  <div className="flex gap-1.5 shrink-0">
                    {patch.status === "proposed" && (
                      <>
                        <Button size="sm" variant="outline" className="text-green-600" onClick={() => approve.mutate({ id: patch.id })}>
                          <CheckCircle className="h-3.5 w-3.5 mr-1" />批准
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600" onClick={() => reject.mutate({ id: patch.id })}>
                          <XCircle className="h-3.5 w-3.5 mr-1" />拒绝
                        </Button>
                      </>
                    )}
                    {(patch.status === "approved" || patch.status === "deployed") && (
                      <Button size="sm" variant="outline" className="text-orange-600" onClick={() => revert.mutate({ id: patch.id })}>
                        <Undo2 className="h-3.5 w-3.5 mr-1" />回滚
                      </Button>
                    )}
                  </div>
                </div>

                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground mb-1">补丁内容:</p>
                  <pre className="text-xs font-mono whitespace-pre-wrap">{patch.patchContent}</pre>
                </div>

                {patch.expectedEffect && (
                  <p className="text-xs text-muted-foreground">预期效果: {patch.expectedEffect}</p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════
// 任务复盘
// ═══════════════════════════════════

function EpisodesTab() {
  const { data: episodes, isLoading } = trpc.promptEvolution.listEpisodes.useQuery({ limit: 50 });
  const [expanded, setExpanded] = useState<number | null>(null);

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground mb-4">最近 {episodes?.length || 0} 个已完成任务的复盘数据</p>
      {episodes?.map((ep: any) => (
        <div key={ep.taskId} className="border rounded-lg overflow-hidden">
          <button
            className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/50 transition-colors"
            onClick={() => setExpanded(expanded === ep.taskId ? null : ep.taskId)}
          >
            <Badge className={OUTCOME_COLORS[ep.outcome] || ""}>{ep.outcome}</Badge>
            <span className="text-sm font-mono text-muted-foreground">#{ep.taskId}</span>
            <span className="text-sm truncate flex-1">{ep.taskType}</span>
            <span className="text-xs text-muted-foreground">{ep.totalSteps}步 / 浪费{ep.wastedSteps}</span>
            {ep.failurePatterns?.length > 0 && (
              <div className="flex gap-1">
                {ep.failurePatterns.slice(0, 3).map((p: string, i: number) => (
                  <span key={i} className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded">{p}</span>
                ))}
              </div>
            )}
          </button>
          {expanded === ep.taskId && (
            <div className="px-3 pb-3 border-t bg-muted/30">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 py-3 text-sm">
                <div>诊断步: <span className="font-medium">{ep.diagnosisSteps}</span></div>
                <div>编辑步: <span className="font-medium">{ep.editSteps}</span></div>
                <div>验证步: <span className="font-medium">{ep.verifySteps}</span></div>
                <div>构建: <span className="font-medium">{ep.buildSuccesses}/{ep.buildAttempts}</span></div>
                <div>首次写代码: <span className="font-medium">#{ep.firstWriteStep || '-'}</span></div>
                <div>首次browse: <span className="font-medium">#{ep.firstBrowseStep || '-'}</span></div>
                <div>重写同文件: <span className="font-medium">{ep.sameFileRewriteCount}次</span></div>
                <div>耗时: <span className="font-medium">{ep.durationMs ? (ep.durationMs / 60000).toFixed(1) + '分' : '-'}</span></div>
              </div>
              {ep.stepsSummary && (
                <pre className="text-xs font-mono text-muted-foreground bg-background rounded p-2 mt-2 max-h-48 overflow-auto whitespace-pre-wrap">{ep.stepsSummary}</pre>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════
// 用户记忆
// ═══════════════════════════════════

function MemoriesTab() {
  const [userId, setUserId] = useState<number | undefined>(undefined);
  const { data: memories, refetch, isLoading } = trpc.promptEvolution.listUserMemories.useQuery({ userId, limit: 100 });
  const deleteMem = trpc.promptEvolution.deleteUserMemory.useMutation({
    onSuccess: () => { toast.success("已删除"); refetch(); },
    onError: (e) => toast.error(e.message),
  });

  const CATEGORY_LABELS: Record<string, string> = {
    server: "🖥 服务器",
    tech_stack: "⚙️ 技术栈",
    preference: "💡 偏好",
    project: "📁 项目",
    issue: "⚠️ 问题",
    personal: "👤 个人",
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <input
          type="number"
          placeholder="按用户 ID 筛选（留空显示全部）"
          className="border rounded-lg px-3 py-2 text-sm w-64"
          value={userId ?? ""}
          onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : undefined)}
        />
        <Button size="sm" variant="ghost" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
        <span className="text-sm text-muted-foreground ml-auto">{memories?.length || 0} 条记忆</span>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
      ) : !memories?.length ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">暂无用户记忆</CardContent></Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left font-medium">用户</th>
                <th className="px-3 py-2 text-left font-medium">分类</th>
                <th className="px-3 py-2 text-left font-medium">键</th>
                <th className="px-3 py-2 text-left font-medium">值</th>
                <th className="px-3 py-2 text-left font-medium">使用次数</th>
                <th className="px-3 py-2 text-left font-medium">更新时间</th>
                <th className="px-3 py-2 w-12"></th>
              </tr>
            </thead>
            <tbody>
              {memories.map((m: any) => (
                <tr key={m.id} className="border-t hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className="text-xs text-muted-foreground">#{m.userId}</span>
                    {m.userName && <span className="ml-1 text-xs">{m.userName}</span>}
                  </td>
                  <td className="px-3 py-2">
                    <span className="text-xs">{CATEGORY_LABELS[m.category] || m.category}</span>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs">{m.key}</td>
                  <td className="px-3 py-2 text-xs max-w-xs truncate">{m.value}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{m.hitCount}</td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">{new Date(m.updatedAt).toLocaleDateString()}</td>
                  <td className="px-3 py-2">
                    <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-red-500" onClick={() => deleteMem.mutate({ id: m.id, userId: m.userId })}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
