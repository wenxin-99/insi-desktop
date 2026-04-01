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

      {/* 充值入口 */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">🐟币计费</p>
              <p className="text-sm text-muted-foreground">所有 AI 功能按🐟币消费，用多少扣多少</p>
            </div>
            <Link href="/recharge">
              <Button>
                <Coins className="mr-2 h-4 w-4" /> 充值🐟币
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
