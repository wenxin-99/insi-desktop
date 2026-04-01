import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Coins, Check, Sparkles, TrendingUp, Gift, ArrowLeft, X, Loader2, QrCode, RefreshCw, Timer, ShieldCheck, PartyPopper } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import DashboardLayout from '@/components/DashboardLayout';

// ═══════════ 类型定义 ═══════════

interface RechargePackage {
  id: number;
  amount: number;
  price: number;
  bonus: number;
  popular: boolean;
  gradient: string;
}

interface PaymentState {
  stage: "idle" | "creating" | "qr" | "polling" | "success" | "failed";
  outTradeNo?: string;
  payUrl?: string;
  provider?: string;
  error?: string;
}

// ═══════════ QR 码生成（纯前端，无外部依赖）═══════════

/**
 * 使用 Google Chart API 生成二维码图片 URL
 * 也可以替换为本地 qrcode 库
 */
function getQrCodeUrl(text: string, size: number = 280): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}&margin=8`;
}

// ═══════════ 主组件 ═══════════

export default function Recharge() {
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<"alipay" | "wechat" | null>(null);
  const [payment, setPayment] = useState<PaymentState>({ stage: "idle" });

  // ★ 支付倒计时（30 分钟）
  const [countdown, setCountdown] = useState(30 * 60); // 秒
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (payment.stage === "qr" || payment.stage === "polling") {
      setCountdown(30 * 60);
      countdownRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            // 倒计时结束，标记超时
            if (countdownRef.current) clearInterval(countdownRef.current);
            setPayment(p => ({ ...p, stage: "failed", error: "二维码已过期，请重新下单" }));
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownRef.current) { clearInterval(countdownRef.current); countdownRef.current = null; }
    }
    return () => { if (countdownRef.current) clearInterval(countdownRef.current); };
  }, [payment.stage]);

  const formatCountdown = (s: number) => `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;

  const { data: balance, refetch: refetchBalance } = trpc.fishCoin.getBalance.useQuery();
  const { data: myOrders } = trpc.fishCoin.getMyOrders.useQuery({ limit: 10 });

  // ★ 充值套餐配置（与 server/db/billingConfig.ts DEFAULT_RECHARGE_PACKAGES 保持一致）
  const GRADIENTS = [
    "from-rose-400 to-pink-500",     // 体验包
    "from-blue-500 to-cyan-500",
    "from-purple-500 to-pink-500",
    "from-orange-500 to-amber-500",
    "from-green-500 to-emerald-500",
  ];

  const rechargePackages: RechargePackage[] = [
    { id: 5, amount: 20,   price: 1,   bonus: 0,    popular: false, gradient: GRADIENTS[0] },
    { id: 1, amount: 100,  price: 10,  bonus: 0,    popular: false, gradient: GRADIENTS[1] },
    { id: 2, amount: 500,  price: 45,  bonus: 50,   popular: true,  gradient: GRADIENTS[2] },
    { id: 3, amount: 1000, price: 80,  bonus: 200,  popular: false, gradient: GRADIENTS[3] },
    { id: 4, amount: 5000, price: 350, bonus: 1500, popular: false, gradient: GRADIENTS[4] },
  ];

  // 轮询定时器 ref
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollCount = useRef(0);

  // 清理轮询
  const stopPolling = useCallback(() => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    pollCount.current = 0;
  }, []);

  // 组件卸载时清理
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  // ═══════════ 轮询订单状态 ═══════════

  const startPolling = useCallback(
    (outTradeNo: string) => {
      stopPolling();
      pollCount.current = 0;

      pollTimer.current = setInterval(async () => {
        pollCount.current++;

        // 最多轮询 200 次（约 10 分钟）
        if (pollCount.current > 200) {
          stopPolling();
          setPayment((prev) => ({
            ...prev,
            stage: "failed",
            error: "支付超时，请检查微信是否已完成支付，或重新下单",
          }));
          return;
        }

        try {
          const resp = await fetch(`/api/payment/order-status?outTradeNo=${encodeURIComponent(outTradeNo)}`, {
            credentials: "include",
          });

          if (!resp.ok) return;

          const data = await resp.json();

          if (data.status === "paid") {
            stopPolling();
            setPayment((prev) => ({ ...prev, stage: "success" }));
            refetchBalance();
            toast.success(
              `充值成功！获得 ${data.fishCoinTotal} 🐟币`,
              { duration: 5000 }
            );
          } else if (data.status === "failed" || data.status === "expired") {
            stopPolling();
            setPayment((prev) => ({
              ...prev,
              stage: "failed",
              error: data.status === "expired" ? "订单已过期" : "支付失败",
            }));
          }
        } catch {
          // 网络错误，继续轮询
        }
      }, 3000); // 每 3 秒轮询一次
    },
    [stopPolling, refetchBalance]
  );

  // ═══════════ 发起支付 ═══════════

  const handleRecharge = async () => {
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

    setPayment({ stage: "creating" });

    try {
      const resp = await fetch("/api/payment/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          packageId: pkg.id,
          paymentMethod,
        }),
      });

      const data = await resp.json();

      if (!resp.ok || !data.success) {
        setPayment({
          stage: "failed",
          error: data.error || "创建订单失败",
        });
        toast.error(data.error || "创建订单失败");
        return;
      }

      if (paymentMethod === "wechat" && data.payUrl) {
        // ★ 微信支付：显示二维码 + 开始轮询
        setPayment({
          stage: "qr",
          outTradeNo: data.outTradeNo,
          payUrl: data.payUrl,
          provider: "wechat",
        });
        startPolling(data.outTradeNo);
      } else {
        // 支付宝或其他：显示提示
        setPayment({
          stage: "failed",
          error: data.message || "该支付方式暂未开通",
        });
      }
    } catch (err: any) {
      setPayment({
        stage: "failed",
        error: `网络错误: ${err.message}`,
      });
      toast.error("网络错误，请重试");
    }
  };

  // ═══════════ 关闭支付对话框 ═══════════

  const closePaymentDialog = () => {
    stopPolling();
    setPayment({ stage: "idle" });
  };

  // ═══════════ 渲染 ═══════════

  return (
    <DashboardLayout>
    <div className="container max-w-6xl py-8">
      <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-4">
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
        <p className="text-xl text-muted-foreground">选择合适的套餐，享受更多AI服务</p>
      </div>

      {/* 充值套餐 */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-12">
        {rechargePackages.map((pkg) => (
          <Card
            key={pkg.id}
            className={`relative cursor-pointer transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 ${
              selectedPackage === pkg.id ? "ring-2 ring-primary shadow-xl" : "hover:ring-1 hover:ring-border"
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
              <div className="text-sm text-muted-foreground mb-4">实得 {pkg.amount + pkg.bonus} 🐟币</div>
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
            <CardDescription>支持微信支付（支付宝开发中）</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              {/* 微信支付 */}
              <Card
                className={`cursor-pointer transition-all ${
                  paymentMethod === "wechat" ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border"
                }`}
                onClick={() => setPaymentMethod("wechat")}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-lg bg-green-50 dark:bg-green-950 flex items-center justify-center">
                    <svg className="h-8 w-8" viewBox="0 0 1024 1024" fill="#07C160">
                      <path d="M690.1 377.4c5.9 0 11.8.2 17.6.5-15.8-73.2-95.8-127.4-189.3-127.4-101.7 0-184.2 67.3-184.2 150.4 0 48.3 26.3 87.8 69.5 118.4l-17.4 52.4 60.8-30.4c21.7 4.3 39 8.7 60.8 8.7 5.7 0 11.4-.2 17-0.7-3.6-12.1-5.6-24.9-5.6-38.1 0-74.7 76.8-133.8 170.8-133.8z m-110.5-41.5c12.9 0 21.7 8.7 21.7 21.7 0 13-8.7 21.7-21.7 21.7s-26.1-8.7-26.1-21.7c0-13 13-21.7 26.1-21.7z m-130.3 43.4c-13 0-26.1-8.7-26.1-21.7 0-13 13-21.7 26.1-21.7 12.9 0 21.7 8.7 21.7 21.7 0 13-8.7 21.7-21.7 21.7z" />
                      <path d="M870.1 511.3c0-74.7-76.8-135.5-162.4-135.5-91.3 0-166.7 60.8-166.7 135.5 0 74.7 75.4 135.5 166.7 135.5 17.4 0 34.8-4.3 52.2-8.7l47.8 26.1-13-43.4c34.7-26.2 75.4-61.5 75.4-109.5z m-214.6-21.7c-8.7 0-17.4-8.7-17.4-17.4 0-8.7 8.7-17.4 17.4-17.4s21.7 8.7 21.7 17.4c0 8.7-13 17.4-21.7 17.4z m104.2 0c-8.7 0-17.4-8.7-17.4-17.4 0-8.7 8.7-17.4 17.4-17.4 13 0 21.7 8.7 21.7 17.4 0 8.7-8.7 17.4-21.7 17.4z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">微信支付</div>
                    <div className="text-sm text-muted-foreground">扫码支付，即时到账</div>
                  </div>
                  {paymentMethod === "wechat" && <Check className="h-6 w-6 text-primary" />}
                </CardContent>
              </Card>

              {/* 支付宝（暂未开通） */}
              <Card
                className={`cursor-pointer transition-all opacity-60 ${
                  paymentMethod === "alipay" ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-border"
                }`}
                onClick={() => {
                  toast.info("支付宝支付开发中，请使用微信支付");
                  // setPaymentMethod("alipay");
                }}
              >
                <CardContent className="flex items-center gap-4 p-6">
                  <div className="w-12 h-12 rounded-lg bg-blue-50 dark:bg-blue-950 flex items-center justify-center">
                    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="#1677FF">
                      <path d="M21.5 5.5C21.5 4.67 20.83 4 20 4H4C3.17 4 2.5 4.67 2.5 5.5V18.5C2.5 19.33 3.17 20 4 20H20C20.83 20 21.5 19.33 21.5 18.5V5.5Z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold">支付宝</div>
                    <div className="text-sm text-muted-foreground">即将开通</div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 确认充值按钮 */}
      {selectedPackage && paymentMethod && (
        <div className="flex justify-center">
          <Button
            size="lg"
            className="btn-elegant text-lg px-12 py-6"
            onClick={handleRecharge}
            disabled={payment.stage === "creating"}
          >
            {payment.stage === "creating" ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                正在创建订单...
              </>
            ) : (
              <>
                <Coins className="mr-2 h-5 w-5" />
                确认充值 ¥{rechargePackages.find((p) => p.id === selectedPackage)?.price}
              </>
            )}
          </Button>
        </div>
      )}

      {/* ═══════════ 微信支付二维码弹窗（优化版） ═══════════ */}
      {(payment.stage === "qr" || payment.stage === "polling") && payment.payUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={closePaymentDialog}>
          <Card className="w-[440px] max-w-[95vw] relative animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-3 right-3 z-10"
              onClick={closePaymentDialog}
            >
              <X className="h-4 w-4" />
            </Button>

            <CardHeader className="text-center pb-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center mb-3">
                <QrCode className="h-7 w-7 text-green-600" />
              </div>
              <CardTitle className="text-xl">微信扫码支付</CardTitle>
              <CardDescription>
                请使用微信扫描下方二维码完成支付
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col items-center gap-5 pb-6">
              {/* 二维码 + 倒计时环 */}
              <div className="relative">
                <div className="bg-white p-4 rounded-2xl shadow-sm border">
                  <img
                    src={getQrCodeUrl(payment.payUrl)}
                    alt="微信支付二维码"
                    className="w-[240px] h-[240px]"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = `https://chart.googleapis.com/chart?cht=qr&chs=240x240&chl=${encodeURIComponent(payment.payUrl!)}`;
                    }}
                  />
                </div>
              </div>

              {/* 支付金额 + 倒计时 */}
              <div className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted/50">
                <div>
                  <div className="text-sm text-muted-foreground">支付金额</div>
                  <div className="text-3xl font-bold text-green-600">
                    ¥{rechargePackages.find((p) => p.id === selectedPackage)?.price}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {(() => {
                      const pkg = rechargePackages.find((p) => p.id === selectedPackage);
                      if (!pkg) return "";
                      return `${pkg.amount}🐟币${pkg.bonus > 0 ? ` + 赠${pkg.bonus}🐟币` : ""}`;
                    })()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground mb-1">
                    <Timer className="h-4 w-4" />
                    <span>剩余时间</span>
                  </div>
                  <div className={`text-2xl font-mono font-bold ${countdown < 120 ? "text-red-500" : "text-foreground"}`}>
                    {formatCountdown(countdown)}
                  </div>
                </div>
              </div>

              {/* 等待支付动画 */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin text-green-500" />
                <span>等待扫码支付中... 支付完成后自动到账</span>
              </div>

              {/* 安全提示 + 订单号 */}
              <div className="w-full pt-3 border-t space-y-2">
                <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground/70">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>微信安全支付 · 资金由微信官方保障</span>
                </div>
                <div className="text-center text-xs text-muted-foreground/50">
                  订单号 {payment.outTradeNo}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════ 支付成功弹窗（优化版） ═══════════ */}
      {payment.stage === "success" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-[400px] max-w-[95vw] animate-in fade-in zoom-in-95 duration-200">
            <CardContent className="flex flex-col items-center gap-5 pt-10 pb-8">
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center animate-in zoom-in duration-300">
                <Check className="h-10 w-10 text-green-600" />
              </div>
              <div className="text-center">
                <h2 className="text-2xl font-bold mb-1">支付成功！</h2>
                <p className="text-muted-foreground">
                  {(() => {
                    const pkg = rechargePackages.find((p) => p.id === selectedPackage);
                    if (!pkg) return "🐟币已到账";
                    const total = pkg.amount + pkg.bonus;
                    return `${total}🐟币已到账${pkg.bonus > 0 ? `（含赠送${pkg.bonus}🐟币）` : ""}`;
                  })()}
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm">
                <PartyPopper className="h-4 w-4" />
                <span>祝您使用愉快</span>
              </div>
              <Button onClick={() => { closePaymentDialog(); refetchBalance(); }} size="lg" className="mt-2 px-8">
                完成
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════ 支付失败弹窗（优化版） ═══════════ */}
      {payment.stage === "failed" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <Card className="w-[400px] max-w-[95vw] animate-in fade-in zoom-in-95 duration-200">
            <CardContent className="flex flex-col items-center gap-4 pt-10 pb-8">
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900 flex items-center justify-center">
                <X className="h-10 w-10 text-red-600" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">支付未完成</h2>
                <p className="text-muted-foreground text-sm max-w-[280px]">
                  {payment.error || "请重试或联系客服"}
                </p>
              </div>
              <div className="flex gap-3 mt-3">
                <Button variant="outline" size="lg" onClick={closePaymentDialog}>
                  关闭
                </Button>
                <Button size="lg" onClick={() => { closePaymentDialog(); handleRecharge(); }}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  重新支付
                </Button>
              </div>
            </CardContent>
          </Card>
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
                {rechargePackages.filter(p => p.bonus > 0).map(p => (
                  <li key={p.id}>• 充值{p.amount}🐟币，额外赠送{p.bonus}🐟币</li>
                ))}
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

      {/* ═══ 充值记录 ═══ */}
      {myOrders && myOrders.length > 0 && (
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="text-lg">充值记录</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">订单号</th>
                    <th className="py-2 pr-3 font-medium">金额</th>
                    <th className="py-2 pr-3 font-medium">🐟币</th>
                    <th className="py-2 pr-3 font-medium">状态</th>
                    <th className="py-2 font-medium">时间</th>
                  </tr>
                </thead>
                <tbody>
                  {myOrders.map((order: any) => (
                    <tr key={order.outTradeNo} className="border-b last:border-0">
                      <td className="py-2.5 pr-3">
                        <span
                          className="font-mono text-xs cursor-pointer hover:text-primary"
                          title="点击复制订单号"
                          onClick={() => { navigator.clipboard.writeText(order.outTradeNo); }}
                        >
                          {order.outTradeNo}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">¥{order.amountCny}</td>
                      <td className="py-2.5 pr-3">
                        {order.fishCoinAmount}
                        {order.fishCoinBonus > 0 && <span className="text-green-600 text-xs ml-0.5">+{order.fishCoinBonus}</span>}
                      </td>
                      <td className="py-2.5 pr-3">
                        {order.status === "paid" && <Badge variant="default">已支付</Badge>}
                        {order.status === "refunded" && <Badge variant="secondary">已退款</Badge>}
                        {order.status === "pending" && <Badge variant="outline">待支付</Badge>}
                        {order.status === "expired" && <Badge variant="outline">已过期</Badge>}
                        {order.status === "failed" && <Badge variant="destructive">失败</Badge>}
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(order.paidAt || order.createdAt).toLocaleString("zh-CN")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
    </DashboardLayout>
  );
}
