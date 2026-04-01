/**
 * TokenStats — 管理员 Token 用量统计页面
 *
 * 路由: /admin/token-stats
 * 侧栏: AI 服务 分组
 */

import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Loader2, BarChart3, TrendingUp, Users, AlertTriangle,
  ArrowUpDown, Zap, Brain, Coins,
} from "lucide-react";

// ─── helpers ───

function formatTokens(n: number): string {
  if (n >= 1_000_000_000) return (n / 1_000_000_000).toFixed(2) + "B";
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function formatCost(n: number): string {
  return Number(n).toFixed(2);
}

const RANGE_OPTIONS = [
  { label: "7天", value: 7 },
  { label: "30天", value: 30 },
  { label: "90天", value: 90 },
  { label: "365天", value: 365 },
] as const;

// ─── Mini bar chart (pure CSS, no deps) ───

function MiniBar({ value, max, color = "bg-blue-500" }: { value: number; max: number; color?: string }) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  return (
    <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
      <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ─── Main ───

export default function TokenStats() {
  const [days, setDays] = useState(30);
  const [sortField, setSortField] = useState<"totalTokens" | "totalCalls" | "totalCost">("totalTokens");

  const { data: modelStats, isLoading: statsLoading } = trpc.tokenStats.getModelStats.useQuery({ days });
  const { data: trend, isLoading: trendLoading } = trpc.tokenStats.getTokenTrend.useQuery({ days });
  const { data: userRanking, isLoading: userLoading } = trpc.tokenStats.getUserRanking.useQuery({ days, limit: 15 });
  const { data: suggestions } = trpc.tokenStats.getOptimizationSuggestions.useQuery();

  const isLoading = statsLoading || trendLoading || userLoading;

  // ── 汇总 ──
  const totals = modelStats?.reduce(
    (acc, s) => ({
      calls: acc.calls + Number(s.totalCalls),
      prompt: acc.prompt + Number(s.totalPromptTokens),
      completion: acc.completion + Number(s.totalCompletionTokens),
      tokens: acc.tokens + Number(s.totalTokens),
      cost: acc.cost + Number(s.totalCost),
    }),
    { calls: 0, prompt: 0, completion: 0, tokens: 0, cost: 0 }
  ) ?? { calls: 0, prompt: 0, completion: 0, tokens: 0, cost: 0 };

  // ── 排序 ──
  const sortedStats = [...(modelStats ?? [])].sort((a: any, b: any) => Number(b[sortField]) - Number(a[sortField]));
  const maxTokens = Math.max(...(sortedStats.map((s: any) => Number(s.totalTokens)) || [1]));

  // ── 趋势最高值 ──
  const maxTrendTokens = Math.max(...(trend?.map((t) => Number(t.totalTokens)) || [1]));

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BarChart3 className="h-6 w-6" />
              Token 用量统计
            </h1>
            <p className="text-muted-foreground mt-1">各模型调用量、Token 消耗与成本分析</p>
          </div>
          <div className="flex gap-1">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={days === opt.value ? "default" : "outline"}
                size="sm"
                onClick={() => setDays(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* ═══ Overview Cards ═══ */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总调用次数</CardTitle>
                  <Zap className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{totals.calls.toLocaleString()}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Prompt Tokens</CardTitle>
                  <Brain className="h-4 w-4 text-blue-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-blue-600">{formatTokens(totals.prompt)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Completion Tokens</CardTitle>
                  <TrendingUp className="h-4 w-4 text-green-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{formatTokens(totals.completion)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总 Tokens</CardTitle>
                  <BarChart3 className="h-4 w-4 text-purple-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{formatTokens(totals.tokens)}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">总成本</CardTitle>
                  <Coins className="h-4 w-4 text-amber-500" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{formatCost(totals.cost)} 🐟</div>
                </CardContent>
              </Card>
            </div>

            {/* ═══ Trend (simple CSS bars) ═══ */}
            {trend && trend.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">每日 Token 用量趋势</CardTitle>
                  <CardDescription>最近 {days} 天的每日 Token 消耗</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-end gap-[2px] h-32">
                    {trend.map((d: any, i: number) => {
                      const pct = maxTrendTokens > 0 ? (Number(d.totalTokens) / maxTrendTokens) * 100 : 0;
                      const barWidth = Math.max(100 / trend.length - 1, 2);
                      return (
                        <div
                          key={i}
                          className="group relative bg-blue-500/80 hover:bg-blue-600 rounded-t transition-all cursor-pointer"
                          style={{ height: `${Math.max(pct, 1)}%`, width: `${barWidth}%`, minWidth: 3 }}
                          title={`${d.date}\n${formatTokens(Number(d.totalTokens))} tokens\n${Number(d.calls)} 次调用`}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block bg-popover border border-border rounded-lg shadow-lg p-2 text-xs whitespace-nowrap z-10">
                            <div className="font-medium">{d.date}</div>
                            <div className="text-blue-600">{formatTokens(Number(d.totalTokens))} tokens</div>
                            <div className="text-muted-foreground">{Number(d.calls)} 次调用</div>
                            <div className="text-amber-600">{formatCost(Number(d.cost))} 🐟</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
                    <span>{trend[0]?.date}</span>
                    <span>{trend[trend.length - 1]?.date}</span>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* ═══ Model Table ═══ */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">模型用量明细</CardTitle>
                <CardDescription>点击表头排序</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>模型</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => setSortField("totalCalls")}
                      >
                        <span className="flex items-center gap-1">
                          调用次数 <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead>成功率</TableHead>
                      <TableHead>Prompt</TableHead>
                      <TableHead>Completion</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => setSortField("totalTokens")}
                      >
                        <span className="flex items-center gap-1">
                          总 Tokens <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                      <TableHead>Token 占比</TableHead>
                      <TableHead>均 Tokens/次</TableHead>
                      <TableHead>均响应(ms)</TableHead>
                      <TableHead
                        className="cursor-pointer select-none"
                        onClick={() => setSortField("totalCost")}
                      >
                        <span className="flex items-center gap-1">
                          成本 <ArrowUpDown className="h-3 w-3" />
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedStats.map((s: any) => {
                      const calls = Number(s.totalCalls);
                      const tokens = Number(s.totalTokens);
                      const avgTokens = calls > 0 ? Math.round(tokens / calls) : 0;
                      return (
                        <TableRow key={s.modelId}>
                          <TableCell className="font-medium">{s.modelName || (s.modelId === 0 ? "未识别模型" : `模型#${s.modelId}`)}</TableCell>
                          <TableCell>{calls.toLocaleString()}</TableCell>
                          <TableCell>
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                              Number(s.successRate) >= 95 ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" :
                              Number(s.successRate) >= 80 ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300" :
                              "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                            }`}>
                              {Number(s.successRate).toFixed(1)}%
                            </span>
                          </TableCell>
                          <TableCell className="text-blue-600">{formatTokens(Number(s.totalPromptTokens))}</TableCell>
                          <TableCell className="text-green-600">{formatTokens(Number(s.totalCompletionTokens))}</TableCell>
                          <TableCell className="font-semibold">{formatTokens(tokens)}</TableCell>
                          <TableCell>
                            <MiniBar value={tokens} max={maxTokens} color="bg-purple-500" />
                          </TableCell>
                          <TableCell className="text-muted-foreground">{formatTokens(avgTokens)}</TableCell>
                          <TableCell className="text-muted-foreground">
                            {s.avgResponseTime ? `${Number(s.avgResponseTime).toFixed(0)}` : "-"}
                          </TableCell>
                          <TableCell className="text-amber-600 font-medium">{formatCost(Number(s.totalCost))} 🐟</TableCell>
                        </TableRow>
                      );
                    })}
                    {sortedStats.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
                          暂无数据，Token 统计将在聊天调用时自动记录
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* ═══ User Ranking ═══ */}
            {userRanking && userRanking.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4" />
                    用户 Token 消耗排行
                  </CardTitle>
                  <CardDescription>Top 15 用户（最近 {days} 天）</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-12">#</TableHead>
                        <TableHead>用户</TableHead>
                        <TableHead>调用次数</TableHead>
                        <TableHead>Prompt</TableHead>
                        <TableHead>Completion</TableHead>
                        <TableHead>总 Tokens</TableHead>
                        <TableHead>成本</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {userRanking.map((u: any, i: number) => (
                        <TableRow key={u.userId}>
                          <TableCell className="font-bold text-muted-foreground">{i + 1}</TableCell>
                          <TableCell className="font-medium">{u.userId === 0 ? "🤖 系统 / AI运维" : (u.userName || `用户#${u.userId}`)}</TableCell>
                          <TableCell>{Number(u.calls).toLocaleString()}</TableCell>
                          <TableCell className="text-blue-600">{formatTokens(Number(u.promptTokens))}</TableCell>
                          <TableCell className="text-green-600">{formatTokens(Number(u.completionTokens))}</TableCell>
                          <TableCell className="font-semibold">{formatTokens(Number(u.totalTokens))}</TableCell>
                          <TableCell className="text-amber-600">{formatCost(Number(u.cost))} 🐟</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}

            {/* ═══ Optimization Suggestions ═══ */}
            {suggestions && suggestions.suggestions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                    优化建议
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {suggestions.suggestions.map((s: any, i: number) => (
                    <div
                      key={i}
                      className={`flex items-start gap-3 p-3 rounded-lg ${
                        s.type === "high_cost" ? "bg-red-50 dark:bg-red-950/20" :
                        s.type === "low_success_rate" ? "bg-yellow-50 dark:bg-yellow-950/20" :
                        s.type === "high_token_usage" ? "bg-purple-50 dark:bg-purple-950/20" :
                        "bg-blue-50 dark:bg-blue-950/20"
                      }`}
                    >
                      <AlertTriangle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${
                        s.type === "high_cost" ? "text-red-500" :
                        s.type === "low_success_rate" ? "text-yellow-500" :
                        s.type === "high_token_usage" ? "text-purple-500" :
                        "text-blue-500"
                      }`} />
                      <p className="text-sm">{s.message}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
