import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Coins, Home, Receipt } from "lucide-react";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // 倒计时自动跳转
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setLocation('/orders');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [setLocation]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 space-y-6">
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-green-500/20 rounded-full animate-ping" />
              <div className="relative p-4 rounded-full bg-green-500/10">
                <CheckCircle className="w-16 h-16 text-green-600" />
              </div>
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">支付成功！</h1>
            <p className="text-muted-foreground">
              感谢您的购买，您的订单已成功处理
            </p>
          </div>

          {/* Info */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <Coins className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">🐟币已充值</p>
                <p className="text-xs text-muted-foreground">
                  您的余额已更新，可立即使用
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Receipt className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium">订单记录已保存</p>
                <p className="text-xs text-muted-foreground">
                  您可以在订单历史中查看详情
                </p>
              </div>
            </div>
          </div>

          {/* Countdown */}
          <div className="text-center text-sm text-muted-foreground">
            {countdown} 秒后自动跳转到订单历史...
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setLocation('/')}
            >
              <Home className="w-4 h-4 mr-2" />
              返回首页
            </Button>
            <Button
              className="flex-1"
              onClick={() => setLocation('/orders')}
            >
              <Receipt className="w-4 h-4 mr-2" />
              查看订单
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
