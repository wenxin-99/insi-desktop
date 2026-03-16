/**
 * dashboard/BalanceQuotaSection — 余额卡片 + 配额卡片
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Coins, History, Gauge, RefreshCw, MessageSquare, Image, FileText } from "lucide-react";
import { Link } from "wouter";
import { useTranslation } from "react-i18next";

interface BalanceQuotaSectionProps {
  balance: any;
  quotaStatus: any;
  balanceFetching: boolean;
  syncPending: boolean;
  syncError: boolean;
  onRefresh: () => void;
  onSync: () => void;
}

export function BalanceQuotaSection({
  balance, quotaStatus, balanceFetching, syncPending, syncError, onRefresh, onSync,
}: BalanceQuotaSectionProps) {
  const { t } = useTranslation();

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* 余额 */}
      <Card className="elegant-gradient">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("pages.dashboard.coinBalance")}</p>
              <div className="flex items-center gap-2">
                <Coins className="h-6 w-6 text-amber-500" />
                <span className="text-3xl font-bold">{balance?.balance || "0.00"}</span>
                <button onClick={onRefresh} className="ml-1 text-muted-foreground hover:text-foreground transition-colors" title="刷新余额" disabled={balanceFetching}>
                  <RefreshCw className={`h-4 w-4 ${balanceFetching ? "animate-spin" : ""}`} />
                </button>
              </div>
              <div className="mt-2 flex flex-col gap-1">
                <button onClick={onSync} disabled={syncPending} className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                  <RefreshCw className={`h-3 w-3 ${syncPending ? "animate-spin" : ""}`} />
                  {syncPending ? "同步中..." : "同步论坛余额"}
                </button>
                {syncError && <a href="/forum-login" className="text-xs text-amber-600 hover:text-amber-700">↩ 重新登录以同步</a>}
              </div>
            </div>
            <Link href="/transactions">
              <Button variant="outline">
                <History className="mr-2 h-4 w-4" /> {t("pages.transactions.transactionHistory")}
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* 配额 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Gauge className="h-5 w-5" />{t("pages.dashboard.quotaUsage")}</CardTitle>
          <CardDescription>{t("pages.dashboard.quotaResetTime")}</CardDescription>
        </CardHeader>
        <CardContent>
          {quotaStatus ? (
            <div className="space-y-4">
              {[
                { icon: MessageSquare, color: "blue", label: t("pages.dashboard.quickActions.aiChat.title"), data: quotaStatus.chat },
                { icon: Image, color: "purple", label: t("pages.dashboard.quickActions.imageGeneration.title"), data: quotaStatus.image },
                { icon: FileText, color: "green", label: t("pages.dashboard.quickActions.documentProcessing.title"), data: quotaStatus.document },
              ].map(({ icon: Icon, color, label, data }) => (
                <div key={label}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2"><Icon className={`h-4 w-4 text-${color}-500`} /><span className="text-sm font-medium">{label}</span></div>
                    <span className="text-sm text-muted-foreground">{data.used}/{data.limit}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full bg-${color}-500 transition-all`} style={{ width: `${(data.used / data.limit) * 100}%` }} />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">{t("pages.dashboard.loading")}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
