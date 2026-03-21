import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Check, Crown, Sparkles, Zap, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";

export default function VIPMembership() {
  const { data: balance } = trpc.fishCoin.getBalance.useQuery();
  const { data: vipInfo } = trpc.user.getVIPInfo.useQuery();
  const { data: vipPlans, isLoading: plansLoading } = trpc.billingConfig.getVIPPlans.useQuery();
  const purchaseVIP = trpc.user.purchaseVIP.useMutation();
  const utils = trpc.useUtils();
  const [purchasing, setPurchasing] = useState<"vip" | "premium" | null>(null);

  const handlePurchase = async (tier: "vip" | "premium") => {
    setPurchasing(tier);
    try {
      await purchaseVIP.mutateAsync({ tier, durationDays: 30 });
      toast.success("🎉 恭喜！成功升级为VIP会员");
      utils.user.getVIPInfo.invalidate();
      utils.fishCoin.getBalance.invalidate();
      utils.user.getQuotaStatus.invalidate();
    } catch (error: any) {
      toast.error(error.message || "购买失败，请稍后重试");
    } finally {
      setPurchasing(null);
    }
  };

  // ★ Phase 3：从后端动态构建 VIP 方案列表
  const plans = useMemo(() => {
    const iconMap: Record<string, any> = { vip: Crown, premium: Zap };
    const colorMap: Record<string, string> = { vip: "text-blue-500", premium: "text-purple-500" };
    const bgMap: Record<string, string> = {
      vip: "bg-blue-50 dark:bg-blue-950",
      premium: "bg-purple-50 dark:bg-purple-950",
    };

    const freePlan = {
      id: "free",
      name: "免费版",
      price: 0,
      icon: Sparkles,
      color: "text-gray-500",
      bgColor: "bg-gray-50 dark:bg-gray-900",
      features: ["基础对话配额", "基础图片配额", "基础文档配额", "基础功能访问"],
      current: vipInfo?.tier === "free",
    };

    if (!vipPlans || vipPlans.length === 0) return [freePlan];

    const dynamicPlans = vipPlans
      .filter((p: any) => p.enabled)
      .map((p: any) => ({
        id: p.tier,
        name: p.displayName,
        price: p.monthlyPrice,
        icon: iconMap[p.tier] || Crown,
        color: colorMap[p.tier] || "text-blue-500",
        bgColor: bgMap[p.tier] || "bg-blue-50 dark:bg-blue-950",
        features: p.features || [],
        popular: p.tier === "vip",
        current: vipInfo?.tier === p.tier,
      }));

    return [freePlan, ...dynamicPlans];
  }, [vipPlans, vipInfo]);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">VIP会员</h1>
          <p className="text-muted-foreground mt-2">升级会员，解锁更多Insi能力</p>
        </div>

        {/* 当前会员状态 */}
        {vipInfo?.isVIP && (
          <Card className="elegant-gradient">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground mb-1">当前会员等级</p>
                  <div className="flex items-center gap-2">
                    <Crown className="h-6 w-6 text-amber-500" />
                    <span className="text-2xl font-bold">
                      {vipInfo.tier === "vip" ? "VIP会员" : "高级VIP"}
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground mb-1">剩余天数</p>
                  <p className="text-2xl font-bold">{vipInfo.daysRemaining} 天</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 余额显示 */}
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">当前🐟币余额</p>
                <p className="text-2xl font-bold">{balance?.balance || "0.00"} 🐟币</p>
              </div>
              <Button variant="outline" asChild>
                <a href="/transactions">充值</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 会员套餐对比 */}
        <div>
          <h2 className="text-xl font-semibold mb-4">选择适合您的套餐</h2>
          <div className="grid gap-6 md:grid-cols-3">
            {plans.map((plan) => {
              const Icon = plan.icon;
              const isCurrent = plan.current;
              const canPurchase = !isCurrent && plan.id !== "free";
              const isPurchasing = purchasing === plan.id;

              return (
                <Card
                  key={plan.id}
                  className={`relative ${plan.popular ? "border-primary shadow-lg" : ""}`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-semibold">
                        推荐
                      </span>
                    </div>
                  )}

                  <CardHeader>
                    <div className={`w-12 h-12 rounded-lg ${plan.bgColor} flex items-center justify-center mb-3`}>
                      <Icon className={`h-6 w-6 ${plan.color}`} />
                    </div>
                    <CardTitle className="text-2xl">{plan.name}</CardTitle>
                    <CardDescription>
                      {plan.price === 0 ? (
                        <span className="text-2xl font-bold text-foreground">免费</span>
                      ) : (
                        <>
                          <span className="text-3xl font-bold text-foreground">{plan.price}</span>
                          <span className="text-muted-foreground ml-1">🐟币/30天</span>
                        </>
                      )}
                    </CardDescription>
                  </CardHeader>

                  <CardContent className="space-y-4">
                    <ul className="space-y-2">
                      {plan.features.map((feature, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <Check className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span className="text-sm">{feature}</span>
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      <Button className="w-full" disabled>
                        当前套餐
                      </Button>
                    ) : canPurchase ? (
                      <Button
                        className="w-full"
                        onClick={() => handlePurchase(plan.id as "vip" | "premium")}
                        disabled={isPurchasing}
                      >
                        {isPurchasing ? "购买中..." : "立即购买"}
                      </Button>
                    ) : (
                      <Button className="w-full" variant="outline" disabled>
                        当前套餐
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* 常见问题 */}
        <Card>
          <CardHeader>
            <CardTitle>常见问题</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="font-semibold mb-2">Q: VIP会员有效期是多久？</h3>
              <p className="text-sm text-muted-foreground">
                A: VIP会员和高级VIP会员的有效期均为30天，到期后会自动降级为免费版。
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Q: 配额每天什么时候重置？</h3>
              <p className="text-sm text-muted-foreground">
                A: 所有配额将在每天零点（00:00）自动重置，未使用的配额不会累积。
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Q: 可以中途升级吗？</h3>
              <p className="text-sm text-muted-foreground">
                A: 可以。如果您当前是VIP会员，可以随时升级为高级VIP，新的有效期将从升级时刻开始计算。
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Q: 如何获取更多🐟币？</h3>
              <p className="text-sm text-muted-foreground">
                A: 您可以通过邀请好友注册、完成任务等方式获取🐟币奖励。
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
