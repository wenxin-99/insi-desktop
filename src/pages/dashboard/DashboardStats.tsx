import DashboardLayout from "@/components/DashboardLayout";
import { safeToast } from "@/lib/safeToast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Image, FileText, Mic, Coins, History, TrendingUp, BarChart3, Gauge, Crown, Sparkles , RefreshCw } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: balance, refetch: refetchBalance, isFetching: balanceFetching } = trpc.fishCoin.getBalance.useQuery();
  const syncFromForumMutation = trpc.fishCoin.syncFromForum.useMutation({
    onSuccess: (data) => {
      refetchBalance();
      refetchStats();

export function DashboardStats(props: any) {
  const { t, data } = props;
  return (
    <>
        {/* 统计概览 */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.dashboard.conversationHistory')}</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{conversations?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('pages.dashboard.totalConversations')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.dashboard.fileProcessing')}</CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{files?.length || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">{t('pages.dashboard.uploadedFiles')}</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{t('pages.dashboard.recentConsumption')}</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {transactions
                  ?.filter((t) => t.type === "consume")
                  .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0)
                  .toFixed(2) || "0.00"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">🐟币</p>
            </CardContent>
          </Card>
        </div>

        {/* 🐟币消费趋势图表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="h-5 w-5" />
              {t('pages.dashboard.consumptionTrend')}
            </CardTitle>
            <CardDescription>
              {t('pages.dashboard.consumptionTrendDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">{t('pages.dashboard.loading')}</p>
              </div>
            ) : stats?.consumptionTrend && stats.consumptionTrend.length > 0 ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={stats.consumptionTrend}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => {
                      const date = new Date(value);
                      return `${date.getMonth() + 1}/${date.getDate()}`;
                    }}
                    className="text-xs"
                  />
                  <YAxis className="text-xs" />
                  <Tooltip 
                    labelFormatter={(value) => `${t('pages.dashboard.date')}: ${value}`}
                    formatter={(value: number) => [`${value.toFixed(2)} 🐟币`, ""]}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="consume" 
                    stroke="#ef4444" 
                    name={t('pages.dashboard.consume')} 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="recharge" 
                    stroke="#22c55e" 
                    name={t('pages.dashboard.recharge')} 
                    strokeWidth={2}
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-80 flex items-center justify-center">
                <p className="text-muted-foreground">{t('pages.dashboard.noData')}</p>
              </div>
            )}
          </CardContent>
        </Card>

    </>
  );
}