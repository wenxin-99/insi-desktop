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

export function DashboardRecentActivity(props: any) {
  const { t, data } = props;
  return (
    <>
        {/* 最近活动 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('pages.dashboard.recentActivity')}</CardTitle>
            <CardDescription>{t('pages.dashboard.recentActivityDesc')}</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions && transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{transaction.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleString("zh-CN")}
                      </p>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-semibold ${
                          parseFloat(transaction.amount) < 0 ? "text-red-600" : "text-green-600"
                        }`}
                      >
                        {transaction.amount} 🐟币
                      </p>
                      <p className="text-xs text-muted-foreground">{t('pages.dashboard.balance')}: {transaction.balanceAfter}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">{t('pages.dashboard.noTransactions')}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}