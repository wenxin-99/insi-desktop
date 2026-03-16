/**
 * Admin AI-Ops Analytics & Automation
 *
 * 数据分析仪表盘 + 流水线自动化配置：
 * - 健康评分仪表盘
 * - 反馈/Issue 趋势图表（recharts）
 * - 模块健康度热力图
 * - 流水线自动化等级配置
 * - 最新健康报告
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  ArrowLeft, Activity, TrendingUp, Shield, Play, RefreshCw,
  Loader2, Brain, Gauge, Zap, FileText,
} from "lucide-react";
import { useLocation } from "wouter";

const LEVEL_DESCRIPTIONS = [
  "仅采集+分类",
  "+ 自动验证 + 自动复现",
  "+ 自动生成方案 + 沙箱测试",
  "+ P2/P3 自动部署（推荐）",
  "全自动（仅 P0 需审批）",
];

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#6b7280"];
const CATEGORY_COLORS = ["#3b82f6", "#8b5cf6", "#f59e0b", "#10b981", "#6b7280"];

export default function AdminAIOpsAnalytics() {
  const [, navigate] = useLocation();
  const [trendDays, setTrendDays] = useState(30);

  // 数据查询
  const { data: config } = trpc.aiOps.getAutomationConfig.useQuery();
  const { data: report } = trpc.aiOps.getLatestReport.useQuery();
  const { data: trends } = trpc.aiOps.getTrendData.useQuery({ days: trendDays });
  const { data: moduleHealth } = trpc.aiOps.getModuleHealth.useQuery();
  const { data: tierData } = trpc.aiOps.getTierModelConfig.useQuery();

  // Mutations
  const configMutation = trpc.aiOps.setAutomationConfig.useMutation({
    onSuccess: () => toast.success("配置已更新"),
    onError: (err) => toast.error("配置更新失败: " + err.message),
  });
  const reportMutation = trpc.aiOps.generateHealthReport.useMutation({
    onSuccess: () => toast.success("报告已生成"),
    onError: (err) => toast.error("报告生成失败: " + err.message),
  });
  const pipelineMutation = trpc.aiOps.runPipeline.useMutation({
    onSuccess: (data) => toast.success(`流水线: ${data.issuesProcessed} 处理, ${data.stagesAdvanced} 推进`),
    onError: (err) => toast.error("流水线执行失败: " + (err.message.includes("DOCTYPE") ? "请求超时，流水线仍在后台运行" : err.message)),
  });
  const tierMutation = trpc.aiOps.setTierModelConfig.useMutation({
    onSuccess: () => toast.success("模型配置已保存"),
    onError: (err) => toast.error("保存失败: " + err.message),
  });

  const score = report?.overallScore ?? null;
  const scoreColor = score === null ? "text-muted-foreground" :
    score >= 80 ? "text-emerald-500" : score >= 60 ? "text-amber-500" : "text-red-500";

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-6 space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/ai-ops")} className="h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Activity className="h-5 w-5 text-cyan-500" />
            <div>
              <h1 className="text-xl font-bold">数据分析 & 自动化</h1>
              <p className="text-xs text-muted-foreground">趋势图表 · 模块健康度 · 流水线配置</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => pipelineMutation.mutate()}
              disabled={pipelineMutation.isPending}>
              {pipelineMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Play className="h-3.5 w-3.5 mr-1" />}
              运行流水线
            </Button>
            <Button variant="outline" size="sm" onClick={() => reportMutation.mutate()}
              disabled={reportMutation.isPending}>
              {reportMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <FileText className="h-3.5 w-3.5 mr-1" />}
              生成报告
            </Button>
          </div>
        </div>

        {/* ═══ 健康评分 + 快速统计 ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {/* 大号健康分数 */}
          <Card className="col-span-2 md:col-span-1">
            <CardContent className="pt-5 pb-4 text-center">
              <Gauge className={`h-6 w-6 mx-auto mb-1 ${scoreColor}`} />
              <div className={`text-4xl font-bold ${scoreColor}`}>
                {score ?? "—"}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">健康评分</div>
              {report?.scoreChange !== undefined && report.scoreChange !== 0 && (
                <div className={`text-xs mt-1 ${report.scoreChange > 0 ? "text-emerald-500" : "text-red-500"}`}>
                  {report.scoreChange > 0 ? "↑" : "↓"} {Math.abs(report.scoreChange)} 分
                </div>
              )}
            </CardContent>
          </Card>

          <QuickStat icon={<TrendingUp className="h-5 w-5 text-blue-500" />}
            label="24h 反馈" value={report?.feedback?.total24h ?? "—"} />
          <QuickStat icon={<Shield className="h-5 w-5 text-red-500" />}
            label="待处理 Issue" value={report?.issues?.totalOpen ?? "—"} />
          <QuickStat icon={<Zap className="h-5 w-5 text-violet-500" />}
            label="24h 部署" value={report?.pipeline?.deploymentsToday ?? "—"} />
          <QuickStat icon={<Brain className="h-5 w-5 text-amber-500" />}
            label="知识库" value={report?.knowledge?.totalEntries ?? "—"} />
        </div>

        {/* ═══ AI 总结 ═══ */}
        {report?.aiSummary && (
          <Card>
            <CardContent className="pt-4 pb-4">
              <p className="text-sm leading-relaxed">{report.aiSummary}</p>
              {report.recommendations?.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-3">
                  {report.recommendations.map((r: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs">{r}</Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* ═══ 趋势图表 ═══ */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* 反馈趋势 */}
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">反馈趋势</CardTitle>
                <Select value={String(trendDays)} onValueChange={v => setTrendDays(Number(v))}>
                  <SelectTrigger className="w-[90px] h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">7天</SelectItem>
                    <SelectItem value="30">30天</SelectItem>
                    <SelectItem value="90">90天</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {trends?.feedbackTrend?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <AreaChart data={trends.feedbackTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
                    <Area type="monotone" dataKey="active" stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.3} name="主动反馈" />
                    <Area type="monotone" dataKey="passive" stackId="1" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.3} name="被动信号" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>

          {/* Issue 创建/解决趋势 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Issue 创建 vs 解决</CardTitle>
            </CardHeader>
            <CardContent>
              {trends?.issueTrend?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={trends.issueTrend}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
                    <Bar dataKey="created" fill="#ef4444" fillOpacity={0.7} name="新建" radius={[2, 2, 0, 0]} />
                    <Bar dataKey="resolved" fill="#10b981" fillOpacity={0.7} name="解决" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>

          {/* 优先级饼图 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">优先级分布</CardTitle>
            </CardHeader>
            <CardContent>
              {trends?.priorityDistribution?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={trends.priorityDistribution} dataKey="count" nameKey="priority"
                      cx="50%" cy="50%" outerRadius={70} label={({ priority, count }) => `${priority}: ${count}`}
                      labelLine={false} fontSize={11}>
                      {trends.priorityDistribution.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>

          {/* 类别分布 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">类别分布</CardTitle>
            </CardHeader>
            <CardContent>
              {trends?.categoryDistribution?.length ? (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={trends.categoryDistribution} dataKey="count" nameKey="category"
                      cx="50%" cy="50%" outerRadius={70} label={({ category, count }) => `${category}: ${count}`}
                      labelLine={false} fontSize={11}>
                      {trends.categoryDistribution.map((_: any, i: number) => (
                        <Cell key={i} fill={CATEGORY_COLORS[i % CATEGORY_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>
        </div>

        {/* ═══ 模块健康度 ═══ */}
        {moduleHealth?.length ? (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">模块健康度</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {moduleHealth.map((m: any) => {
                  const color = m.score >= 80 ? "text-emerald-500 border-emerald-500/20 bg-emerald-500/5" :
                    m.score >= 60 ? "text-amber-500 border-amber-500/20 bg-amber-500/5" :
                    "text-red-500 border-red-500/20 bg-red-500/5";
                  return (
                    <div key={m.module} className={`p-3 rounded-lg border ${color}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-mono font-medium">{m.module}</span>
                        <span className="text-lg font-bold">{m.score}</span>
                      </div>
                      <div className="text-xs opacity-70">
                        Issue: {m.openIssues} 开 / {m.resolvedIssues} 关 · 解决率 {m.resolveRate}%
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* ═══ 流水线自动化配置 ═══ */}
        {config && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Zap className="h-4 w-4 text-violet-500" />
                流水线自动化配置
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* 自动化等级 */}
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">
                  自动化等级: Level {config.level}
                </label>
                <div className="space-y-1.5">
                  {LEVEL_DESCRIPTIONS.map((desc, i) => (
                    <button
                      key={i}
                      onClick={() => configMutation.mutate({ level: i })}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all
                        ${config.level === i
                          ? "bg-primary/10 text-primary ring-1 ring-primary/30 font-medium"
                          : "bg-muted/30 text-muted-foreground hover:bg-muted/50"
                        }`}
                    >
                      <span className="font-mono mr-2">L{i}</span>
                      {desc}
                      {i === 3 && <Badge variant="outline" className="ml-2 text-[10px]">推荐</Badge>}
                    </button>
                  ))}
                </div>
              </div>

              {/* 开关选项 */}
              <div className="grid grid-cols-2 gap-4 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">知识库预查</span>
                  <Switch checked={config.useKnowledgeBase}
                    onCheckedChange={v => configMutation.mutate({ useKnowledgeBase: v })} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">自动用户验证</span>
                  <Switch checked={config.autoVerifyUsers}
                    onCheckedChange={v => configMutation.mutate({ autoVerifyUsers: v })} />
                </div>
              </div>

              {/* 需要审批的优先级 */}
              <div className="pt-2 border-t">
                <label className="text-xs font-medium text-muted-foreground mb-2 block">需要人工审批的优先级</label>
                <div className="flex gap-2">
                  {(["P0", "P1", "P2", "P3"] as const).map(p => (
                    <button
                      key={p}
                      onClick={() => {
                        const current = config.requireApproval || [];
                        const next = current.includes(p) ? current.filter(x => x !== p) : [...current, p];
                        configMutation.mutate({ requireApproval: next });
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                        ${config.requireApproval?.includes(p)
                          ? "bg-amber-500/10 text-amber-500 ring-1 ring-amber-500/30"
                          : "bg-muted/30 text-muted-foreground"
                        }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* ═══ 分级模型配置 ═══ */}
        {tierData && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <Brain className="h-4 w-4 text-cyan-500" />
                AI 运维分级模型配置
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                为不同复杂度的任务分配不同模型。选择"自动"则使用平台默认模型。
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {([
                { tier: "fast" as const, label: "Fast (快速)", desc: "反馈分类、健康报告摘要", color: "text-emerald-500" },
                { tier: "standard" as const, label: "Standard (标准)", desc: "运维对话、复现分析、代码审查", color: "text-blue-500" },
                { tier: "flagship" as const, label: "Flagship (旗舰)", desc: "代码补丁生成 — 需要最强代码理解能力", color: "text-violet-500" },
                { tier: "vision" as const, label: "Vision (视觉)", desc: "反馈截图识别 — 需要支持图片输入的模型", color: "text-amber-500" },
              ]).map(({ tier, label, desc, color }) => (
                <div key={tier} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-medium ${color}`}>{label}</div>
                    <div className="text-xs text-muted-foreground">{desc}</div>
                  </div>
                  <Select
                    value={String(tierData.config[tier] || 0)}
                    onValueChange={(v) => tierMutation.mutate({ [tier]: Number(v) })}
                  >
                    <SelectTrigger className="w-[220px] h-8 text-xs">
                      <SelectValue placeholder="选择模型" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">自动（默认模型）</SelectItem>
                      {tierData.availableModels.map((m: any) => (
                        <SelectItem key={m.id} value={String(m.id)}>
                          {m.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}

              {/* 当前生效显示 */}
              <div className="pt-2 border-t text-xs text-muted-foreground">
                <span className="font-medium">可用模型:</span> {tierData.availableModels.length} 个
                {tierData.availableModels.length === 0 && (
                  <span className="text-amber-500 ml-2">⚠ 请先在"模型管理"中配置至少一个 chat 类型的模型</span>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function QuickStat({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">{icon}</div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[200px] text-muted-foreground text-xs">
      暂无数据
    </div>
  );
}
