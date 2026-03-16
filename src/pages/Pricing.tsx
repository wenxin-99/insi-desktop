import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Check, Coins, Crown, Sparkles, Zap, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { COIN_PACKAGES, SUBSCRIPTION_PLANS, Product } from "../../../shared/products";
import DashboardLayout from '@/components/DashboardLayout';

// 重新组织订阅计划数据，按级别分组
interface SubscriptionPlan {
  tier: 'basic' | 'premium';
  name: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  monthlyId: string;
  yearlyId: string;
  features: string[];
  popular?: boolean;
}

const SUBSCRIPTION_TIERS: SubscriptionPlan[] = [
  {
    tier: 'basic',
    name: '基础会员',
    description: '适合日常使用',
    monthlyPrice: 19.9,
    yearlyPrice: 199,
    monthlyId: 'membership_basic_monthly',
    yearlyId: 'membership_basic_yearly',
    features: [
      '每月500🐟币',
      'AI对话优先响应',
      '支持所有AI模型',
      '无广告体验',
      '可随时取消',
    ],
  },
  {
    tier: 'premium',
    name: '高级会员',
    description: '无限使用，专业首选',
    monthlyPrice: 49.9,
    yearlyPrice: 499,
    monthlyId: 'membership_premium_monthly',
    yearlyId: 'membership_premium_yearly',
    popular: true,
    features: [
      '无限🐟币使用',
      '专属高级模型',
      '最高优先级响应',
      '专属客服支持',
      '高级功能抢先体验',
    ],
  },
];

export default function Pricing() {
  const { t } = useTranslation();
  const [isLoading, setIsLoading] = useState<string | null>(null);
  const createCheckoutSession = trpc.payment.createCheckoutSession.useMutation();

  const handlePurchase = async (productId: string) => {
    try {
      setIsLoading(productId);
      const { url } = await createCheckoutSession.mutateAsync({ productId });
      
      // 在新标签页打开Stripe Checkout
      window.open(url, '_blank');
      toast.success(t('pages.pricing.toast.redirecting'), {
        description: t('pages.pricing.toast.redirectingDesc')
      });
    } catch (error: any) {
      toast.error(t('pages.pricing.toast.createSessionFailed'), {
        description: error.message || t('pages.pricing.toast.retryLater')
      });
    } finally {
      setIsLoading(null);
    }
  };

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
      <div className="container py-12 space-y-12">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="default"
          onClick={() => window.history.back()}
          className="mb-4 md:mb-0 min-h-[44px] px-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          <span className="text-base">{t('pages.pricing.backButton')}</span>
        </Button>
        
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            {t('pages.pricing.title')}
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('pages.pricing.subtitle')}
          </p>
        </div>

        <Tabs defaultValue="packages" className="w-full">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="packages" className="gap-2">
              <Coins className="w-4 h-4" />
              {t('pages.pricing.tabs.packages')}
            </TabsTrigger>
            <TabsTrigger value="subscriptions" className="gap-2">
              <Crown className="w-4 h-4" />
              {t('pages.pricing.tabs.subscriptions')}
            </TabsTrigger>
          </TabsList>

          {/* 充值包 */}
          <TabsContent value="packages" className="mt-8">
            <div className="grid gap-6 md:grid-cols-3">
              {COIN_PACKAGES.map((pkg) => (
                <Card
                  key={pkg.id}
                  className={`relative overflow-hidden transition-all hover:shadow-lg ${
                    pkg.popular ? "border-primary shadow-md" : ""
                  }`}
                >
                  {pkg.popular && (
                    <Badge className="absolute top-4 right-4 bg-primary">
                      <Sparkles className="w-3 h-3 mr-1" />
                      {t('pages.pricing.badges.popular')}
                    </Badge>
                  )}
                  
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Coins className="w-6 h-6 text-primary" />
                      </div>
                      <CardTitle className="text-2xl">{pkg.name}</CardTitle>
                    </div>
                    <CardDescription>{pkg.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-bold">${pkg.price}</span>
                        <span className="text-muted-foreground">USD</span>
                      </div>
                      <div className="flex items-center gap-2 text-primary font-semibold">
                        <Coins className="w-5 h-5" />
                        <span className="text-2xl">{pkg.coinAmount} 🐟币</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {pkg.features?.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>

                  <CardFooter>
                    <Button
                      className="w-full"
                      size="lg"
                      variant={pkg.popular ? "default" : "outline"}
                      onClick={() => handlePurchase(pkg.id)}
                      disabled={isLoading === pkg.id}
                    >
                      {isLoading === pkg.id ? t('pages.pricing.buttons.processing') : t('pages.pricing.buttons.buyNow')}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* 会员订阅 */}
          <TabsContent value="subscriptions" className="mt-8">
            <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
              {SUBSCRIPTION_TIERS.map((plan) => (
                <Card
                  key={plan.monthlyId}
                  className={`relative overflow-hidden transition-all hover:shadow-lg ${
                    plan.popular ? "border-primary shadow-md scale-105" : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-purple-500 to-pink-500" />
                  )}
                  
                  {plan.popular && (
                    <Badge className="absolute top-4 right-4 bg-gradient-to-r from-primary to-purple-600">
                      <Crown className="w-3 h-3 mr-1" />
                      {t('pages.pricing.badges.recommended')}
                    </Badge>
                  )}

                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 rounded-lg ${plan.popular ? "bg-gradient-to-br from-primary/20 to-purple-500/20" : "bg-muted"}`}>
                        {plan.tier === "premium" ? (
                          <Zap className="w-6 h-6 text-primary" />
                        ) : (
                          <Crown className="w-6 h-6 text-primary" />
                        )}
                      </div>
                      <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    </div>
                    <CardDescription>{plan.description}</CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-6">
                    <div className="space-y-4">
                      {/* 月付价格 */}
                      <div className="p-4 rounded-lg bg-muted/50">
                        <div className="flex items-baseline justify-between mb-1">
                          <span className="text-sm text-muted-foreground">{t('pages.pricing.subscription.monthly')}</span>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">${plan.monthlyPrice}</span>
                            <span className="text-muted-foreground">{t('pages.pricing.subscription.perMonth')}</span>
                          </div>
                        </div>
                        <Button
                          className="w-full mt-2"
                          variant="outline"
                          onClick={() => handlePurchase(plan.monthlyId)}
                          disabled={isLoading === plan.monthlyId}
                        >
                          {isLoading === plan.monthlyId ? t('pages.pricing.buttons.processing') : t('pages.pricing.buttons.monthlySubscribe')}
                        </Button>
                      </div>

                      {/* 年付价格 */}
                      <div className="p-4 rounded-lg bg-primary/5 border border-primary/20">
                        <div className="flex items-baseline justify-between mb-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">{t('pages.pricing.subscription.yearly')}</span>
                            <Badge variant="secondary" className="text-xs">
                              {t('pages.pricing.badges.save')} ${(plan.monthlyPrice * 12 - plan.yearlyPrice).toFixed(0)}
                            </Badge>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold">${plan.yearlyPrice}</span>
                            <span className="text-muted-foreground">{t('pages.pricing.subscription.perYear')}</span>
                          </div>
                        </div>
                        <div className="text-xs text-muted-foreground mb-2">
                          {t('pages.pricing.subscription.equivalentTo')} ${(plan.yearlyPrice / 12).toFixed(2)}{t('pages.pricing.subscription.perMonth')}
                        </div>
                        <Button
                          className="w-full"
                          variant={plan.popular ? "default" : "outline"}
                          onClick={() => handlePurchase(plan.yearlyId)}
                          disabled={isLoading === plan.yearlyId}
                        >
                          {isLoading === plan.yearlyId ? t('pages.pricing.buttons.processing') : t('pages.pricing.buttons.yearlySubscribe')}
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-2 pt-4 border-t">
                      <p className="font-semibold text-sm mb-3">{t('pages.pricing.subscription.memberBenefits')}</p>
                      {plan.features?.map((feature, index) => (
                        <div key={index} className="flex items-start gap-2">
                          <Check className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>

        {/* FAQ */}
        <div className="max-w-3xl mx-auto space-y-6 pt-12">
          <h2 className="text-2xl font-bold text-center">{t('pages.pricing.faq.title')}</h2>
          <div className="grid gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('pages.pricing.faq.howToUseCoins.question')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('pages.pricing.faq.howToUseCoins.answer')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('pages.pricing.faq.subscriptionBenefits.question')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('pages.pricing.faq.subscriptionBenefits.answer')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('pages.pricing.faq.paymentSecurity.question')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('pages.pricing.faq.paymentSecurity.answer')}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">{t('pages.pricing.faq.cancelSubscription.question')}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  {t('pages.pricing.faq.cancelSubscription.answer')}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
