/**
 * Dashboard — 仪表盘主页
 *
 * 拆分自原 538 行。子模块：
 *   dashboard/ForumBenefitsCard.tsx    - 论坛等级权益卡片
 *   dashboard/BalanceQuotaSection.tsx  - 余额 + 配额卡片
 *   dashboard/ConsumptionChart.tsx     - 消费趋势图表
 */
import DashboardLayout from "@/components/DashboardLayout";
import { safeToast } from "@/lib/safeToast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Image, FileText, Mic, Crown, TrendingUp, History } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";
import { ForumBenefitsCard } from "./dashboard/ForumBenefitsCard";
import { BalanceQuotaSection } from "./dashboard/BalanceQuotaSection";
import { ConsumptionChart } from "./dashboard/ConsumptionChart";

export default function Dashboard() {
  const { t } = useTranslation();
  const { data: balance, refetch: refetchBalance, isFetching: balanceFetching } = trpc.fishCoin.getBalance.useQuery();
  const syncFromForumMutation = trpc.fishCoin.syncFromForum.useMutation({
    onSuccess: (data) => { refetchBalance(); refetchStats(); safeToast.success(data.message || "同步成功"); },
    onError: (err) => safeToast.error(err.message || "同步失败，请重新登录论坛账号"),
  });
  const { data: transactions } = trpc.fishCoin.getTransactions.useQuery({ limit: 10 });
  const { data: conversations } = trpc.conversation.getAll.useQuery();
  const { data: files } = trpc.file.getAll.useQuery();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.stats.getUserStats.useQuery(undefined, { staleTime: 0, gcTime: 0 });
  const { data: quotaStatus } = trpc.user.getQuotaStatus.useQuery();
  const { data: vipInfo } = trpc.user.getVIPInfo.useQuery();

  const quickActions = [
    { icon: MessageSquare, title: t("pages.dashboard.quickActions.aiChat.title"), description: t("pages.dashboard.quickActions.aiChat.description"), href: "/chat", color: "text-blue-500", bgColor: "bg-blue-50 dark:bg-blue-950" },
    { icon: Image, title: t("pages.dashboard.quickActions.imageGeneration.title"), description: t("pages.dashboard.quickActions.imageGeneration.description"), href: "/images", color: "text-purple-500", bgColor: "bg-purple-50 dark:bg-purple-950" },
    { icon: FileText, title: t("pages.dashboard.quickActions.documentProcessing.title"), description: t("pages.dashboard.quickActions.documentProcessing.description"), href: "/files", color: "text-green-500", bgColor: "bg-green-50 dark:bg-green-950" },
    { icon: Mic, title: t("pages.dashboard.quickActions.voiceToText.title"), description: t("pages.dashboard.quickActions.voiceToText.description"), href: "/voice-chat", color: "text-amber-500", bgColor: "bg-amber-50 dark:bg-amber-950" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{t("pages.dashboard.title")}</h1>
            <p className="text-muted-foreground mt-2">{t("pages.dashboard.welcome")}</p>
          </div>
          <Link href="/">
            <Button variant="outline" className="gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              {t("pages.dashboard.backToHome")}
            </Button>
          </Link>
        </div>

        {/* VIP 状态 */}
        {vipInfo?.isVIP && (
          <Card className="elegant-gradient border-amber-500/50">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center"><Crown className="h-6 w-6 text-amber-500" /></div>
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">{t("pages.dashboard.vipStatus")}</p>
                    <p className="text-2xl font-bold">{vipInfo.tier === "vip" ? t("pages.dashboard.vipMember") : t("pages.dashboard.premiumVip")}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">{t("pages.dashboard.daysRemaining")}</p>
                  <p className="text-2xl font-bold text-amber-500">{vipInfo.daysRemaining} {t("pages.dashboard.days")}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 论坛权益 */}
        <ForumBenefitsCard stats={stats} balance={balance} />

        {/* 余额 + 配额 */}
        <BalanceQuotaSection
          balance={balance} quotaStatus={quotaStatus}
          balanceFetching={balanceFetching}
          syncPending={syncFromForumMutation.isPending}
          syncError={syncFromForumMutation.isError}
          onRefresh={() => { refetchBalance(); refetchStats(); }}
          onSync={() => syncFromForumMutation.mutate()}
        />

        {/* 最近对话 */}
        {conversations && conversations.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2"><History className="h-5 w-5" />{t("pages.dashboard.recentConversations")}</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {conversations.slice(0, 6).map((conversation) => (
                <Link key={conversation.id} href={`/chat?conversation=${conversation.id}`}>
                  <Card className="card-hover cursor-pointer h-full">
                    <CardHeader>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center flex-shrink-0"><MessageSquare className="h-5 w-5 text-blue-500" /></div>
                        <div className="flex-1 min-w-0">
                          <CardTitle className="text-base line-clamp-1">{conversation.title || t("pages.dashboard.untitledConversation")}</CardTitle>
                          <CardDescription className="text-xs mt-1">{new Date(conversation.updatedAt).toLocaleString("zh-CN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</CardDescription>
                        </div>
                      </div>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* 快速操作 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">{t("pages.dashboard.quickStart")}</h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((action, i) => (
              <Link key={i} href={action.href}>
                <Card className="card-hover cursor-pointer h-full">
                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${action.bgColor} flex items-center justify-center mb-3`}><action.icon className={`h-6 w-6 ${action.color}`} /></div>
                    <CardTitle className="text-lg">{action.title}</CardTitle>
                    <CardDescription>{action.description}</CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* 统计概览 */}
        <div className="grid gap-4 md:grid-cols-3">
          {[
            { icon: MessageSquare, title: t("pages.dashboard.conversationHistory"), value: conversations?.length || 0, desc: t("pages.dashboard.totalConversations") },
            { icon: FileText, title: t("pages.dashboard.fileProcessing"), value: files?.length || 0, desc: t("pages.dashboard.uploadedFiles") },
            { icon: TrendingUp, title: t("pages.dashboard.recentConsumption"), value: transactions?.filter((tx) => tx.type === "consume").reduce((s, tx) => s + Math.abs(parseFloat(tx.amount)), 0).toFixed(2) || "0.00", desc: "🐟币" },
          ].map(({ icon: Icon, title, value, desc }) => (
            <Card key={title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle><Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent><div className="text-2xl font-bold">{value}</div><p className="text-xs text-muted-foreground mt-1">{desc}</p></CardContent>
            </Card>
          ))}
        </div>

        {/* 消费趋势 */}
        <ConsumptionChart stats={stats} statsLoading={statsLoading} />

        {/* 最近活动 */}
        <Card>
          <CardHeader>
            <CardTitle>{t("pages.dashboard.recentActivity")}</CardTitle>
            <CardDescription>{t("pages.dashboard.recentActivityDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {transactions && transactions.length > 0 ? (
              <div className="space-y-4">
                {transactions.map((tx) => (
                  <div key={tx.id} className="flex items-center justify-between">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">{new Date(tx.createdAt).toLocaleString("zh-CN")}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-sm font-semibold ${parseFloat(tx.amount) < 0 ? "text-red-600" : "text-green-600"}`}>{tx.amount} 🐟币</p>
                      <p className="text-xs text-muted-foreground">{t("pages.dashboard.balance")}: {tx.balanceAfter}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">{t("pages.dashboard.noTransactions")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
