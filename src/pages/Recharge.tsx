import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Coins, Check, Sparkles, TrendingUp, Gift, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";

export default function Recharge() {
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"alipay" | "wechat" | null>(null);

  const { data: balance, refetch: refetchBalance } = trpc.fishCoin.getBalance.useQuery();

  const rechargePackages = [
    {
      id: 1,
      amount: 100,
      price: 10,
      bonus: 0,
      popular: false,
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      id: 2,
      amount: 500,
      price: 45,
      bonus: 50,
      popular: true,
      gradient: "from-purple-500 to-pink-500",
    },
    {
      id: 3,
      amount: 1000,
      price: 80,
      bonus: 200,
      popular: false,
      gradient: "from-orange-500 to-amber-500",
    },
    {
      id: 4,
      amount: 5000,
      price: 350,
      bonus: 1500,
      popular: false,
      gradient: "from-green-500 to-emerald-500",
    },
  ];

  const rechargeMutation = trpc.fishCoin.recharge.useMutation({
    onSuccess: (data) => {
      const pkg = rechargePackages.find((p) => p.id === selectedPackage);
      toast.success(`充值成功！获得 ${pkg ? pkg.amount + pkg.bonus : 0} 🐟币`);
      refetchBalance();
      setSelectedPackage(null);
      setPaymentMethod(null);
    },
    onError: (error) => {
      toast.error(`充值失败：${error.message}`);
    },
  });

  const handleRecharge = () => {
    if (!selectedPackage) {
      toast.error("请选择充值套餐");
      return;
    }
    if (!paymentMethod) {
      toast.error("请选择支付方式");
      return;
    }

    const pkg = rechargePackages.find((p) => p.id === selectedPackage);
    if (!pkg) return;

    // 调用充值API
    toast.info(`正在处理充值请求...`);
    rechargeMutation.mutate({
      amount: pkg.amount,
      bonus: pkg.bonus,
      paymentMethod: paymentMethod as "alipay" | "wechat",
    });
  };

  return (
    <div className="container max-w-6xl py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回
      </Button>
      {/* 页面标题 */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect mb-4">
          <Coins className="h-5 w-5 text-amber-500" />
          <span className="text-sm font-medium">当前余额: {balance ? Number(balance.balance).toFixed(2) : "0.00"} 🐟币</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">充值🐟币</h1>
        <p className="text-xl text-muted-foreground">
          选择合适的套餐，享受更多AI服务
        </p>
      </div>

      {/* 充值套餐 */}
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
        {rechargePackages.map((pkg) => (
          <Card
            key={pkg.id}
            className={`relative cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
              selectedPackage === pkg.id
                ? "ring-2 ring-primary shadow-xl"
                : "hover:ring-1 hover:ring-border"
            }`}
            onClick={() => setSelectedPackage(pkg.id)}
          >
            {pkg.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <div className="px-4 py-1 rounded-full bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  最受欢迎
                </div>
              </div>
            )}
            <CardHeader className="text-center pb-4">
              <div className={`w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br ${pkg.gradient} flex items-center justify-center mb-4`}>
                <Coins className="h-8 w-8 text-white" />
              </div>
              <CardTitle className="text-3xl font-bold">{pkg.amount} 🐟币</CardTitle>
              {pkg.bonus > 0 && (
                <div className="flex items-center justify-center gap-1 text-sm text-green-600 dark:text-green-400">
                  <Gift className="h-4 w-4" />
                  <span>额外赠送 {pkg.bonus} 🐟币</span>
                </div>
              )}
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold mb-2">¥{pkg.price}</div>
              <div className="text-sm text-muted-foreground mb-4">
                实得 {pkg.amount + pkg.bonus} 🐟币
              </div>
              {selectedPackage === pkg.id && (
                <div className="flex items-center justify-center gap-2 text-primary">
                  <Check className="h-5 w-5" />
                  <span className="font-medium">已选择</span>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* 支付方式 */}
      {selectedPackage && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>选择支付方式</CardTitle>
            <CardDescription>支持支付宝、微信支付</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <Card
                className={`cursor-pointer transition-all ${
                  paymentMethod === "alipay"
                    ? "ring-2 ring-primary"
                    : "hover:ring-1 hover:ring-border"
                }`}
                onClick={() => setPaymentMethod("alipay")}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#1677FF">
                      <path d="M21.5 5.5C21.5 4.67 20.83 4 20 4H4C3.17 4 2.5 4.67 2.5 5.5V18.5C2.5 19.33 3.17 20 4 20H20C20.83 20 21.5 19.33 21.5 18.5V5.5Z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">支付宝</div>
                    <div className="text-sm text-muted-foreground">快速安全</div>
                  </div>
                  {paymentMethod === "alipay" && (
                    <Check className="h-6 w-6 text-primary" />
                  )}
                </CardContent>
              </Card>

              <Card
                className={`cursor-pointer transition-all ${
                  paymentMethod === "wechat"
                    ? "ring-2 ring-primary"
                    : "hover:ring-1 hover:ring-border"
                }`}
                onClick={() => setPaymentMethod("wechat")}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-950 flex items-center justify-center">
                    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#07C160">
                      <path d="M8.5 9C7.67 9 7 8.33 7 7.5S7.67 6 8.5 6 10 6.67 10 7.5 9.33 9 8.5 9M15.5 9C14.67 9 14 8.33 14 7.5S14.67 6 15.5 6 17 6.67 17 7.5 16.33 9 15.5 9M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2Z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">微信支付</div>
                    <div className="text-sm text-muted-foreground">便捷支付</div>
                  </div>
                  {paymentMethod === "wechat" && (
                    <Check className="h-6 w-6 text-primary" />
                  )}
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 确认充值按钮 */}
      {selectedPackage && paymentMethod && (
        <div className="flex justify-center">
          <Button size="lg" className="btn-elegant text-lg px-12 py-6" onClick={handleRecharge}>
            <Coins className="mr-2 h-5 w-5" />
            确认充值 ¥
            {rechargePackages.find((p) => p.id === selectedPackage)?.price}
          </Button>
        </div>
      )}

      {/* 充值说明 */}
      <Card className="mt-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            充值说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">🐟币用途</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• AI对话：每次对话消耗相应模型的🐟币</li>
                <li>• 图片生成：根据图片质量和尺寸消耗🐟币</li>
                <li>• 文档处理：PDF、Word文档分析消耗🐟币</li>
                <li>• 语音转文字：音频转录按时长消耗🐟币</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">充值优惠</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 充值500🐟币，额外赠送50🐟币</li>
                <li>• 充值1000🐟币，额外赠送200🐟币</li>
                <li>• 充值5000🐟币，额外赠送1500🐟币</li>
                <li>• 充值越多，优惠越大！</li>
              </ul>
            </div>
          </div>
          <div className="pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              注意：🐟币充值后不支持退款，请根据实际需求选择合适的套餐。如有疑问，请联系客服。
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
