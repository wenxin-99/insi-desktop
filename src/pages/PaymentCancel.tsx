import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { XCircle, ArrowLeft, CreditCard, HelpCircle } from "lucide-react";

export default function PaymentCancel() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="p-8 space-y-6">
          {/* Cancel Icon */}
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-orange-500/10">
              <XCircle className="w-16 h-16 text-orange-600" />
            </div>
          </div>

          {/* Title */}
          <div className="text-center space-y-2">
            <h1 className="text-2xl font-bold">支付已取消</h1>
            <p className="text-muted-foreground">
              您的支付流程已被取消，未产生任何费用
            </p>
          </div>

          {/* Info */}
          <div className="space-y-3 p-4 rounded-lg bg-muted/50">
            <div className="flex items-start gap-3">
              <HelpCircle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">为什么取消支付？</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>支付信息填写有误</li>
                  <li>需要更换支付方式</li>
                  <li>想要选择其他产品</li>
                  <li>暂时不想购买</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Reassurance */}
          <div className="text-center text-sm text-muted-foreground">
            别担心，您可以随时重新购买
          </div>

          {/* Actions */}
          <div className="flex flex-col gap-3">
            <Button
              className="w-full"
              onClick={() => setLocation('/pricing')}
            >
              <CreditCard className="w-4 h-4 mr-2" />
              重新选择产品
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => setLocation('/')}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              返回首页
            </Button>
          </div>

          {/* Help */}
          <div className="text-center space-y-2 pt-4 border-t">
            <p className="text-sm font-medium">需要帮助？</p>
            <p className="text-xs text-muted-foreground">
              如果您在支付过程中遇到问题，请联系客服获取帮助
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
