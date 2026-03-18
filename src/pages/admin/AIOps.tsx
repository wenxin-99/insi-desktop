/**
 * Admin AI-Ops Dashboard
 *
 * AI 全局管理平台 — 管理员仪表盘
 *
 * 功能:
 * - 统计概览（反馈数、Issue 数、优先级分布）
 * - Issue 列表（按优先级排序，支持状态筛选）
 * - 反馈标签分布图
 * - Issue 详情弹窗（含关联反馈 + AI 诊断结果 + 审计日志）
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Bot, Bug, Zap, AlertTriangle, CheckCircle, Clock, TrendingUp,
  MessageSquare, Eye, ChevronRight, ChevronDown, RefreshCw, ArrowLeft,
} from "lucide-react";

// ── 常量 ──

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; label: string }> = {
  P0: { color: "text-red-600",    bg: "bg-red-500/10 border-red-500/30",    label: "P0 紧急" },
  P1: { color: "text-orange-500", bg: "bg-orange-500/10 border-orange-500/30", label: "P1 高" },
  P2: { color: "text-amber-500",  bg: "bg-amber-500/10 border-amber-500/30",  label: "P2 中" },
  P3: { color: "text-gray-500",   bg: "bg-gray-500/10 border-gray-500/30",    label: "P3 低" },
};

const STATUS_CONFIG: Record<string, { variant: "default" | "secondary" | "outline" | "destructive"; label: string }> = {
  open:             { variant: "destructive", label: "待处理" },
  diagnosing:       { variant: "default",     label: "诊断中" },
  verified:         { variant: "default",     label: "已验证" },
  reproducing:      { variant: "default",     label: "复现中" },
  verifying:        { variant: "default",     label: "验证中" },
  planning:         { variant: "default",     label: "方案中" },
  testing:          { variant: "default",     label: "测试中" },
  in_sandbox:       { variant: "default",     label: "沙箱测试" },
  pending_approval: { variant: "secondary",   label: "待审批" },
  deploying:        { variant: "default",     label: "部署中" },
  monitoring:       { variant: "default",     label: "监控中" },
  resolved:         { variant: "outline",     label: "已解决" },
  wontfix:          { variant: "outline",     label: "不修复" },
  needs_human:      { variant: "destructive", label: "需人工" },
};

const CATEGORY_ICONS: Record<string, any> = {
  bug: Bug,
  performance: Zap,
  ui: Eye,
  feature: TrendingUp,
  content: MessageSquare,
};

export default function AdminAIOps() {
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedIssueId, setSelectedIssueId] = useState<number | null>(null);
  const [resolvedCollapsed, setResolvedCollapsed] = useState(true);

  // ── 数据查询 ──
  const { data: stats, isLoading: statsLoading } = trpc.aiOps.getStats.useQuery();

  const { data: issues, isLoading: issuesLoading, refetch: refetchIssues } = trpc.aiOps.getIssues.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    limit: 50,
  });

  const { data: issueDetail } = trpc.aiOps.getIssueDetail.useQuery(
    { id: selectedIssueId! },
    { enabled: !!selectedIssueId }
  );

  const updateStatusMutation = trpc.aiOps.updateIssueStatus.useMutation({
    onSuccess: () => {
      toast.success("状态已更新");
      refetchIssues();
    },
  });

  const triggerAnalysisMutation = trpc.aiOps.triggerAnalysis.useMutation({
    onSuccess: () => toast.success("AI 分析已触发"),
    onError: (err) => toast.error(err.message),
  });

  const fb = stats?.feedback || {} as any;
  const iss = stats?.issues || {} as any;

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-6 space-y-6">
        {/* ═══ 页面标题 ═══ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-blue-500
              flex items-center justify-center text-white">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">AI 运维中心</h1>
              <p className="text-sm text-muted-foreground">
                用户反馈智能分析 · Issue 自动归类 · 优先级评估
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchIssues()}>
            <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
            刷新
          </Button>
        </div>

        {/* ═══ 统计卡片 ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={<MessageSquare className="h-5 w-5 text-blue-500" />}
            label="24h 新反馈"
            value={fb.last_24h ?? "-"}
            sub={`总计 ${fb.total ?? 0} 条`}
          />
          <StatCard
            icon={<Bug className="h-5 w-5 text-red-500" />}
            label="待处理 Issue"
            value={iss.open_count ?? "-"}
            sub={`总计 ${iss.total ?? 0} 个`}
          />
          <StatCard
            icon={<AlertTriangle className="h-5 w-5 text-orange-500" />}
            label="P0/P1 紧急"
            value={((iss.p0_open ?? 0) + (iss.p1_open ?? 0)) || "-"}
            sub="需要优先处理"
            alert={(iss.p0_open ?? 0) > 0}
          />
          <StatCard
            icon={<CheckCircle className="h-5 w-5 text-emerald-500" />}
            label="已解决"
            value={iss.resolved ?? "-"}
            sub={`被动信号 ${fb.passive_count ?? 0} 条`}
          />
        </div>

        {/* ═══ 标签分布 + 模块分布 ═══ */}
        {(stats?.tagDistribution?.length || stats?.moduleDistribution?.length) ? (
          <div className="grid md:grid-cols-2 gap-4">
            {stats?.tagDistribution?.length ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    近 7 天反馈标签分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.tagDistribution.map((t: any) => (
                      <div key={t.quick_tag} className="flex items-center justify-between">
                        <span className="text-sm">{formatTag(t.quick_tag)}</span>
                        <div className="flex items-center gap-2">
                          <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary rounded-full"
                              style={{
                                width: `${Math.min(100, (t.cnt / (stats.tagDistribution[0]?.cnt || 1)) * 100)}%`
                              }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground w-6 text-right">{t.cnt}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
            {stats?.moduleDistribution?.length ? (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    Issue 模块分布
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {stats.moduleDistribution.map((m: any) => (
                      <div key={m.affected_module} className="flex items-center justify-between">
                        <span className="text-sm font-mono">{m.affected_module || "unknown"}</span>
                        <Badge variant="secondary">{m.cnt}</Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>
        ) : null}

        {/* ═══ Issue 列表 ═══ */}
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Issue 列表</CardTitle>
              <div className="flex gap-2">
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-[130px] h-8 text-xs">
                    <SelectValue placeholder="全部状态" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="open">待处理</SelectItem>
                    <SelectItem value="diagnosing">诊断中</SelectItem>
                    <SelectItem value="planning">方案中</SelectItem>
                    <SelectItem value="pending_approval">待审批</SelectItem>
                    <SelectItem value="deploying">部署中</SelectItem>
                    <SelectItem value="monitoring">监控中</SelectItem>
                    <SelectItem value="needs_human">需人工</SelectItem>
                    <SelectItem value="resolved">已解决</SelectItem>
                    <SelectItem value="wontfix">不修复</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue placeholder="全部级别" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部级别</SelectItem>
                    <SelectItem value="P0">P0 紧急</SelectItem>
                    <SelectItem value="P1">P1 高</SelectItem>
                    <SelectItem value="P2">P2 中</SelectItem>
                    <SelectItem value="P3">P3 低</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {issuesLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" /> 加载中...
              </div>
            ) : !issues?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无 Issue，一切正常 ✨</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {/* ── 活跃 Issue ── */}
                {issues
                  .filter((issue: any) => issue.status !== "resolved" && issue.status !== "wontfix")
                  .map((issue: any) => (
                    <IssueRow key={issue.id} issue={issue} onClick={() => setSelectedIssueId(issue.id)} />
                  ))}

                {/* ── 已关闭 Issue（可折叠） ── */}
                {(() => {
                  const closedIssues = issues.filter(
                    (issue: any) => issue.status === "resolved" || issue.status === "wontfix"
                  );
                  if (!closedIssues.length) return null;
                  return (
                    <>
                      <div
                        className="flex items-center gap-2 px-5 py-2.5 bg-muted/20 cursor-pointer hover:bg-muted/40 transition-colors select-none"
                        onClick={() => setResolvedCollapsed((v) => !v)}
                      >
                        <ChevronDown
                          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${
                            resolvedCollapsed ? "-rotate-90" : ""
                          }`}
                        />
                        <span className="text-xs font-medium text-muted-foreground">
                          已关闭（{closedIssues.length}）
                        </span>
                      </div>
                      {!resolvedCollapsed &&
                        closedIssues.map((issue: any) => (
                          <IssueRow
                            key={issue.id}
                            issue={issue}
                            onClick={() => setSelectedIssueId(issue.id)}
                            dimmed
                          />
                        ))}
                    </>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ Issue 详情弹窗 ═══ */}
        <Dialog open={!!selectedIssueId} onOpenChange={() => setSelectedIssueId(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {!issueDetail && (
              <DialogHeader>
                <DialogTitle className="text-lg">加载中...</DialogTitle>
              </DialogHeader>
            )}
            {issueDetail && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`px-2 py-0.5 rounded text-xs font-bold border
                      ${(PRIORITY_CONFIG[issueDetail.issue.priority] || PRIORITY_CONFIG.P3).bg}
                      ${(PRIORITY_CONFIG[issueDetail.issue.priority] || PRIORITY_CONFIG.P3).color}`}
                    >
                      {issueDetail.issue.priority}
                    </div>
                    <Badge variant={(STATUS_CONFIG[issueDetail.issue.status] || STATUS_CONFIG.open).variant}>
                      {(STATUS_CONFIG[issueDetail.issue.status] || STATUS_CONFIG.open).label}
                    </Badge>
                    <Badge variant="outline">{issueDetail.issue.category}</Badge>
                  </div>
                  <DialogTitle className="text-lg">
                    #{issueDetail.issue.id} {issueDetail.issue.title}
                  </DialogTitle>
                </DialogHeader>

                <div className="space-y-5 mt-2">
                  {/* AI 诊断结果 */}
                  {issueDetail.issue.diagnosis && (
                    <div className="bg-violet-500/5 border border-violet-500/20 rounded-lg p-4">
                      <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">
                        <Bot className="h-4 w-4 text-violet-500" />
                        AI 诊断结果
                      </h4>
                      <div className="text-sm space-y-1.5">
                        {(() => {
                          try {
                            const d = typeof issueDetail.issue.diagnosis === "string"
                              ? JSON.parse(issueDetail.issue.diagnosis)
                              : issueDetail.issue.diagnosis;
                            return (
                              <>
                                <p><span className="text-muted-foreground">模块:</span> <code className="text-xs bg-muted px-1 rounded">{d.affectedModule}</code></p>
                                <p><span className="text-muted-foreground">技术线索:</span> {d.technicalHints || "暂无"}</p>
                                <p><span className="text-muted-foreground">需要代码修复:</span> {d.needsCodeFix ? "是" : "否"}</p>
                                <p><span className="text-muted-foreground">置信度:</span> {Math.round((d.confidence || 0) * 100)}%</p>
                              </>
                            );
                          } catch {
                            return <p className="text-muted-foreground text-xs">诊断数据格式异常</p>;
                          }
                        })()}
                      </div>
                    </div>
                  )}

                  {/* 影响指标 */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-xl font-bold">{issueDetail.issue.affected_users}</div>
                      <div className="text-xs text-muted-foreground">影响用户</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-xl font-bold">{issueDetail.issue.frequency}</div>
                      <div className="text-xs text-muted-foreground">出现次数</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-xl font-bold">{issueDetail.feedbacks?.length || 0}</div>
                      <div className="text-xs text-muted-foreground">关联反馈</div>
                    </div>
                  </div>

                  {/* 关联反馈列表 */}
                  {issueDetail.feedbacks?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <MessageSquare className="h-4 w-4" />
                        关联的用户反馈
                      </h4>
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {issueDetail.feedbacks.map((fb: any) => (
                          <div key={fb.id} className="text-sm p-3 bg-muted/30 rounded-lg border border-border/50">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-medium">{fb.userName || "匿名用户"}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(fb.createdAt).toLocaleString("zh-CN")}
                              </span>
                            </div>
                            <p className="text-muted-foreground text-xs leading-relaxed">
                              {fb.content?.substring(0, 200)}
                            </p>
                            {fb.quick_tag && (
                              <Badge variant="outline" className="mt-1.5 text-xs">
                                {formatTag(fb.quick_tag)}
                              </Badge>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 审计日志 */}
                  {issueDetail.auditLog?.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold mb-2 flex items-center gap-1.5">
                        <Clock className="h-4 w-4" />
                        操作日志
                      </h4>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto">
                        {issueDetail.auditLog.map((log: any) => (
                          <div key={log.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span className="w-32 flex-shrink-0">
                              {new Date(log.created_at).toLocaleString("zh-CN")}
                            </span>
                            <Badge variant="outline" className="text-[10px]">{log.actor}</Badge>
                            <span>{log.action}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 操作按钮 */}
                  <div className="flex gap-2 pt-2 border-t">
                    <Select
                      value={issueDetail.issue.status}
                      onValueChange={(val) => updateStatusMutation.mutate({
                        id: issueDetail.issue.id,
                        status: val,
                      })}
                    >
                      <SelectTrigger className="w-[140px] h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
                          <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// ── 辅助组件 & 函数 ──

function StatCard({ icon, label, value, sub, alert }: {
  icon: React.ReactNode; label: string; value: any; sub: string; alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-red-500/30 bg-red-500/5" : ""}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center justify-between mb-2">
          {icon}
          {alert && <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>}
        </div>
        <div className="text-2xl font-bold">{typeof value === "bigint" ? value.toString() : value}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
        <div className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}

function IssueRow({ issue, onClick, dimmed }: {
  issue: any; onClick: () => void; dimmed?: boolean;
}) {
  const pCfg = PRIORITY_CONFIG[issue.priority] || PRIORITY_CONFIG.P3;
  const sCfg = STATUS_CONFIG[issue.status] || STATUS_CONFIG.open;
  const CategoryIcon = CATEGORY_ICONS[issue.category] || Bug;

  return (
    <div
      className={`flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 cursor-pointer transition-colors ${
        dimmed ? "opacity-60" : ""
      }`}
      onClick={onClick}
    >
      <div className={`px-2 py-0.5 rounded text-xs font-bold border ${pCfg.bg} ${pCfg.color}`}>
        {issue.priority}
      </div>
      <CategoryIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{issue.title}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-muted-foreground font-mono">{issue.affected_module}</span>
          <span className="text-xs text-muted-foreground">·</span>
          <span className="text-xs text-muted-foreground">
            {issue.affected_users} 用户 · {issue.frequency} 次
          </span>
        </div>
      </div>
      <Badge variant={sCfg.variant} className="text-xs flex-shrink-0">
        {sCfg.label}
      </Badge>
      <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </div>
  );
}

function formatTag(tag: string): string {
  const map: Record<string, string> = {
    wrong_answer: "❌ 回答不准确",
    incomplete: "📝 回答不完整",
    slow_response: "🐌 响应太慢",
    ui_broken: "🖥️ 显示异常",
    not_helpful: "😕 没有帮助",
    feature_missing: "🔧 缺少功能",
    crash: "💥 崩溃/报错",
    other: "💬 其他",
  };
  return map[tag] || tag;
}
