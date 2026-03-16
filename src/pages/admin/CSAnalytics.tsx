/**
 * 管理后台 — 客服数据看板
 *
 * 功能:
 * - 今日/本周概览卡片
 * - 对话趋势折线图
 * - 满意度分布饼图
 * - 热门问题 Top-K
 * - 知识库命中率
 * - 坐席绩效表
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";
import {
  BarChart3, TrendingUp, MessageSquare, Clock, Star, Users,
  BookOpen, Zap, ArrowUpRight, ArrowDownRight, RefreshCw,
} from "lucide-react";

const PIE_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#3b82f6"];

export default function CSAnalytics() {
  const [days, setDays] = useState(30);

  const { data, isLoading, refetch } = trpc.customerService.getDashboard.useQuery({ days });
  const { data: kbHit } = trpc.customerService.getKBHitRate.useQuery({ days: 7 });

  if (!data) {
    return (
      <DashboardLayout>
        <div className="container max-w-7xl py-6 flex items-center justify-center h-64 text-muted-foreground">
          {isLoading ? <RefreshCw className="h-5 w-5 animate-spin mr-2" /> : null}
          加载中...
        </div>
      </DashboardLayout>
    );
  }

  const { today, week, trends, topIntents, ratingDistribution, agentStats } = data;

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-6 space-y-6">
        {/* ═══ 头部 ═══ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-500
              flex items-center justify-center text-white">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">客服数据看板</h1>
              <p className="text-sm text-muted-foreground">运营指标 · 满意度 · 知识库效果</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={String(days)} onValueChange={v => setDays(Number(v))}>
              <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="7">近 7 天</SelectItem>
                <SelectItem value="30">近 30 天</SelectItem>
                <SelectItem value="90">近 90 天</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* ═══ 今日概览 ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          <MetricCard icon={<MessageSquare className="h-5 w-5 text-blue-500" />}
            label="今日对话" value={today.conversations}
            sub={`${today.activeNow} 活跃中`} />
          <MetricCard icon={<Zap className="h-5 w-5 text-emerald-500" />}
            label="已解决" value={today.resolved}
            sub={`自助率 ${Math.round(today.selfResolveRate * 100)}%`} />
          <MetricCard icon={<Star className="h-5 w-5 text-amber-500" />}
            label="满意度" value={today.satisfactionAvg || "—"}
            sub="今日平均 (1-5)" />
          <MetricCard icon={<Users className="h-5 w-5 text-violet-500" />}
            label="转人工率" value={`${Math.round(today.handoffRate * 100)}%`}
            sub={`本周 ${week.handoffCount} 次`}
            alert={today.handoffRate > 0.3} />
          <MetricCard icon={<BookOpen className="h-5 w-5 text-cyan-500" />}
            label="知识库命中" value={kbHit ? `${Math.round(kbHit.hitRate * 100)}%` : "—"}
            sub={kbHit ? `${kbHit.withSources}/${kbHit.totalQueries}` : ""} />
          <MetricCard icon={<TrendingUp className="h-5 w-5 text-pink-500" />}
            label="本周对话" value={week.conversations}
            sub={`评分 ${week.avgRating || "—"}`} />
        </div>

        {/* ═══ 趋势图 ═══ */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* 对话趋势 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">对话趋势</CardTitle>
            </CardHeader>
            <CardContent>
              {trends.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={trends}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
                    <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--foreground))" }} />
                    <Area type="monotone" dataKey="conversations" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} name="总对话" />
                    <Area type="monotone" dataKey="resolved" stroke="#22c55e" fill="#22c55e" fillOpacity={0.2} name="已解决" />
                    <Area type="monotone" dataKey="handoffs" stroke="#f97316" fill="#f97316" fillOpacity={0.2} name="转人工" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>

          {/* 满意度分布 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">满意度分布</CardTitle>
            </CardHeader>
            <CardContent>
              {ratingDistribution?.length > 0 ? (
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={ratingDistribution.map((r: any) => ({ name: `${r.rating} 星`, value: r.count }))}
                      cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {ratingDistribution.map((_: any, i: number) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : <EmptyChart />}
            </CardContent>
          </Card>
        </div>

        {/* ═══ 热门问题 + 知识库 ═══ */}
        <div className="grid md:grid-cols-2 gap-4">
          {/* 热门意图 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">热门问题类型</CardTitle>
            </CardHeader>
            <CardContent>
              {topIntents?.length > 0 ? (
                <div className="space-y-2">
                  {topIntents.map((item: any, i: number) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm">{translateIntent(item.intent)}</span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(100, (item.count / (topIntents[0]?.count || 1)) * 100)}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{item.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">暂无数据</p>}
            </CardContent>
          </Card>

          {/* 知识库未命中问题 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-1.5">
                <BookOpen className="h-4 w-4 text-amber-500" />
                知识库未覆盖的问题
              </CardTitle>
            </CardHeader>
            <CardContent>
              {kbHit?.topMissedQueries?.length ? (
                <div className="space-y-2">
                  {kbHit.topMissedQueries.filter(Boolean).map((q: string, i: number) => (
                    <div key={i} className="text-sm p-2 bg-amber-500/5 border border-amber-500/20 rounded-lg">
                      {q}
                    </div>
                  ))}
                  <p className="text-xs text-muted-foreground mt-2">
                    这些问题 AI 无法从知识库中找到答案，建议补充相关文档。
                  </p>
                </div>
              ) : <p className="text-sm text-muted-foreground text-center py-8">所有问题均已覆盖</p>}
            </CardContent>
          </Card>
        </div>

        {/* ═══ 坐席绩效 ═══ */}
        {agentStats?.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">坐席绩效</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {agentStats.map((agent: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg border bg-muted/20">
                    <div className="font-medium text-sm mb-1">{agent.agentName}</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="text-lg font-bold">{agent.sessions}</div>
                        <div className="text-[10px] text-muted-foreground">接待</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-emerald-500">{agent.resolved}</div>
                        <div className="text-[10px] text-muted-foreground">解决</div>
                      </div>
                      <div>
                        <div className="text-lg font-bold text-amber-500">{agent.avgRating || "—"}</div>
                        <div className="text-[10px] text-muted-foreground">评分</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ icon, label, value, sub, alert }: {
  icon: React.ReactNode; label: string; value: any; sub: string; alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-red-500/30 bg-red-500/5" : ""}>
      <CardContent className="pt-4 pb-3 px-4">
        <div className="flex items-center gap-2 mb-1">{icon}</div>
        <div className="text-xl font-bold">{value}</div>
        <div className="text-[11px] text-muted-foreground">{label}</div>
        {sub && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}

function EmptyChart() {
  return <div className="flex items-center justify-center h-[220px] text-muted-foreground text-xs">暂无数据</div>;
}

function translateIntent(intent: string): string {
  const map: Record<string, string> = {
    refund: "退款申请", feedback: "反馈/投诉", general: "通用咨询",
    user_requested: "主动转人工", knowledge_miss: "知识库未命中",
    sensitive_topic: "敏感话题", too_many_rounds: "多轮未解决",
    billing: "账单相关", account: "账户问题",
  };
  return map[intent] || intent;
}
