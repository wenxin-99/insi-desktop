import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Calendar, Crown, Info, Package, Sparkles, Zap, ArrowLeft } from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { toast } from "sonner";
import DashboardLayout from '@/components/DashboardLayout';

export default function Subscription() {
  const { t } = useTranslation();
  const { data: activeSubscription, isLoading } = trpc.payment.getActiveSubscription.useQuery();
  const { data: allSubscriptions } = trpc.payment.getSubscriptions.useQuery();

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      active: { variant: "default", label: t('pages.subscription.active') },
      canceled: { variant: "outline", label: t('pages.subscription.canceled') },
      past_due: { variant: "destructive", label: t('pages.subscription.pastDue') },
      trialing: { variant: "secondary", label: t('pages.subscription.trialing') },
    };
    
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getPlanIcon = (planId: string) => {
    if (planId.includes('premium')) {
      return <Zap className="w-6 h-6 text-primary" />;
    }
    return <Crown className="w-6 h-6 text-primary" />;
  };

  const getPlanName = (planId: string) => {
    if (planId.includes('premium')) {
      return planId.includes('monthly') ? t('pages.subscription.premiumMonthly') : t('pages.subscription.premiumYearly');
    }
    return planId.includes('monthly') ? t('pages.subscription.basicMonthly') : t('pages.subscription.basicYearly');
  };

  const handleCancelSubscription = () => {
    toast.info(t('pages.subscription.cancelSubscriptionTitle'), {
      description: t('pages.subscription.cancelSubscriptionDesc')
    });
  };

  const handleManageSubscription = () => {
    toast.info(t('pages.subscription.manageSubscriptionTitle'), {
      description: t('pages.subscription.manageSubscriptionDesc')
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container py-8 space-y-6">
          <Skeleton className="h-10 w-48" />
          <Card>
            <CardContent className="p-6">
              <div className="space-y-4">
                <Skeleton className="h-6 w-1/3" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="default"
          onClick={() => window.history.back()}
          className="min-h-[44px] px-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          <span className="text-base">{t('pages.subscription.backButton')}</span>
        </Button>
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('pages.subscription.title')}</h1>
          <p className="text-muted-foreground">
            {t('pages.subscription.subtitle')}
          </p>
        </div>

        {/* Active Subscription */}
        {activeSubscription ? (
          <Card className="border-primary/50 shadow-lg">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-purple-500/20">
                    {getPlanIcon(activeSubscription.planId)}
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{getPlanName(activeSubscription.planId)}</CardTitle>
                    <CardDescription className="mt-1">
                      {t('pages.subscription.currentSubscription')} ID: {activeSubscription.stripeSubscriptionId}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(activeSubscription.status)}
              </div>
            </CardHeader>

            <CardContent className="space-y-6">
              {/* Renewal Info */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{t('pages.subscription.startDate')}</span>
                  </div>
                  <p className="font-semibold">
                    {format(new Date(activeSubscription.currentPeriodStart), 'yyyy年MM月dd日', { locale: zhCN })}
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="w-4 h-4" />
                    <span>{t('pages.subscription.nextBillingDate')}</span>
                  </div>
                  <p className="font-semibold">
                    {format(new Date(activeSubscription.currentPeriodEnd), 'yyyy年MM月dd日', { locale: zhCN })}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {t('pages.subscription.daysRemaining')}: {differenceInDays(new Date(activeSubscription.currentPeriodEnd), new Date())} {t('pages.subscription.days')}
                  </p>
                </div>
              </div>

              {/* Cancel Warning */}
              {activeSubscription.cancelAtPeriodEnd && (
                <Alert variant="destructive">
                  <Info className="w-4 h-4" />
                  <AlertTitle>订阅将在周期结束时取消</AlertTitle>
                  <AlertDescription>
                    您的订阅将在 {format(new Date(activeSubscription.currentPeriodEnd), 'yyyy年MM月dd日', { locale: zhCN })} 到期后自动取消。
                    在此之前，您仍可正常使用所有会员特权。
                  </AlertDescription>
                </Alert>
              )}

              {/* Renewal Reminder */}
              {!activeSubscription.cancelAtPeriodEnd && 
                differenceInDays(new Date(activeSubscription.currentPeriodEnd), new Date()) <= 7 && (
                <Alert>
                  <Sparkles className="w-4 h-4" />
                  <AlertTitle>续费提醒</AlertTitle>
                  <AlertDescription>
                    您的订阅将在 {differenceInDays(new Date(activeSubscription.currentPeriodEnd), new Date())} 天后自动续费。
                    请确保您的支付方式有效。
                  </AlertDescription>
                </Alert>
              )}

              {/* Benefits */}
              <div className="p-4 rounded-lg bg-muted/50 space-y-3">
                <p className="font-semibold text-sm">会员特权</p>
                <div className="grid gap-2">
                  {activeSubscription.planId.includes('premium') ? (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>无限🐟币使用</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>专属高级模型</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>最高优先级响应</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>专属客服支持</span>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>每月500🐟币</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>AI对话优先响应</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span>支持所有AI模型</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex gap-3">
              <Button variant="outline" onClick={handleManageSubscription}>
                {t('pages.subscription.manage')}
              </Button>
              {!activeSubscription.cancelAtPeriodEnd && (
                <Button variant="destructive" onClick={handleCancelSubscription}>
                  {t('pages.subscription.cancel')}
                </Button>
              )}
            </CardFooter>
          </Card>
        ) : (
          // No Active Subscription
          <Card>
            <CardContent className="p-12">
              <div className="flex flex-col items-center justify-center text-center space-y-4">
                <div className="p-4 rounded-full bg-muted">
                  <Package className="w-8 h-8 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <h3 className="font-semibold text-lg">{t('pages.subscription.noSubscription')}</h3>
                  <p className="text-sm text-muted-foreground max-w-sm">
                    {t('pages.dashboard.type') === '类型' ? '订阅会员享受更多特权和优惠，立即选择适合您的方案' : 'Subscribe to membership to enjoy more privileges and benefits, choose the plan that suits you now'}
                  </p>
                </div>
                <Button onClick={() => window.location.href = '/pricing'}>
                  <Crown className="w-4 h-4 mr-2" />
                  {t('pages.subscription.explorePlans')}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Subscription History */}
        {allSubscriptions && allSubscriptions.length > 0 && (
          <div className="space-y-4">
            <h2 className="text-xl font-semibold">{t('pages.subscription.subscriptionHistory')}</h2>
            <div className="grid gap-4">
              {allSubscriptions.map((subscription) => (
                <Card key={subscription.id} className={subscription.status === 'active' ? 'hidden' : ''}>
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-muted shrink-0">
                          {getPlanIcon(subscription.planId)}
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{getPlanName(subscription.planId)}</h3>
                            {getStatusBadge(subscription.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(subscription.createdAt), 'yyyy年MM月dd日', { locale: zhCN })} - 
                            {subscription.canceledAt 
                              ? format(new Date(subscription.canceledAt), 'yyyy年MM月dd日', { locale: zhCN })
                              : '至今'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Help */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="w-5 h-5" />
              常见问题
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <p className="font-semibold text-sm">如何取消订阅？</p>
              <p className="text-sm text-muted-foreground">
                您可以随时取消订阅。取消后，您仍可使用至当前订阅周期结束。订阅不会自动续费。
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-sm">取消后可以恢复吗？</p>
              <p className="text-sm text-muted-foreground">
                可以。您可以随时重新订阅，选择适合您的方案。
              </p>
            </div>
            <div className="space-y-2">
              <p className="font-semibold text-sm">如何更改支付方式？</p>
              <p className="text-sm text-muted-foreground">
                请联系客服或在Stripe客户门户中更新您的支付方式。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
    </DashboardLayout>
  );
}
