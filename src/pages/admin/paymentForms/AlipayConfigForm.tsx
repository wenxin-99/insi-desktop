import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { CreditCard, Loader2, Save, CheckCircle2, XCircle, TestTube2, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface PaymentConfigData {
  // Stripe配置
  stripePublicKey?: string;
  stripeSecretKey?: string;
  stripeWebhookSecret?: string;
  // 支付宝配置
  alipayAppId?: string;
  alipayPrivateKey?: string;
  alipayPublicKey?: string;
  alipayNotifyUrl?: string;
  alipayReturnUrl?: string;
  // 微信配置
  wechatAppId?: string;
  wechatMchId?: string;
  wechatApiKey?: string;
  wechatNotifyUrl?: string;
}


  const AlipayConfigForm = () => {
    const alipayConfig = getConfig('alipay');
    const [enabled, setEnabled] = useState(alipayConfig.enabled);
    const [appId, setAppId] = useState(alipayConfig.config.alipayAppId || '');
    const [privateKey, setPrivateKey] = useState(alipayConfig.config.alipayPrivateKey || '');
    const [publicKey, setPublicKey] = useState(alipayConfig.config.alipayPublicKey || '');
    const [notifyUrl, setNotifyUrl] = useState(alipayConfig.config.alipayNotifyUrl || '');
    const [returnUrl, setReturnUrl] = useState(alipayConfig.config.alipayReturnUrl || '');
    const [notes, setNotes] = useState(alipayConfig.notes);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
    
    const handleTest = () => {
      setTestResult(null);
      testConnectionMutation.mutate({
        provider: 'alipay',
        config: {
          alipayAppId: appId,
          alipayPrivateKey: privateKey,
          alipayPublicKey: publicKey,
          alipayNotifyUrl: notifyUrl,
          alipayReturnUrl: returnUrl,
        },
      }, {
        onSuccess: (result) => {
          setTestResult(result);
          if (result.success) {
            toast.success(result.message);
          } else {
            toast.error(result.message);
          }
        },
        onError: (error) => {
          setTestResult({ success: false, message: error.message });
          toast.error(`测试失败：${error.message}`);
        },
      });
    };
    
    const handleSave = () => {
      upsertMutation.mutate({
        provider: 'alipay',
        enabled,
        config: {
          alipayAppId: appId,
          alipayPrivateKey: privateKey,
          alipayPublicKey: publicKey,
          alipayNotifyUrl: notifyUrl,
          alipayReturnUrl: returnUrl,
        },
        notes,
      });
    };
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">启用支付宝支付</Label>
            <p className="text-sm text-muted-foreground">开启后用户可以使用支付宝进行支付</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="alipay-app-id">App ID（应用ID）</Label>
          <Input
            id="alipay-app-id"
            placeholder="2021001234567890"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            在支付宝开放平台的应用详情页面获取
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="alipay-private-key">应用私钥（Private Key）</Label>
          <Textarea
            id="alipay-private-key"
            placeholder="MIIEvQIBADANBgkqhkiG9w0BAQE..."
            value={privateKey}
            onChange={(e) => setPrivateKey(e.target.value)}
            rows={4}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            使用RSA2签名方式，请妥善保管私钥
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="alipay-public-key">支付宝公钥（Alipay Public Key）</Label>
          <Textarea
            id="alipay-public-key"
            placeholder="MIIBIjANBgkqhkiG9w0BAQE..."
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
            rows={4}
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground">
            在支付宝开放平台获取，用于验证支付宝返回的签名
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="alipay-notify-url">异步通知URL（Notify URL）</Label>
          <Input
            id="alipay-notify-url"
            placeholder="https://yourdomain.com/api/alipay/notify"
            value={notifyUrl}
            onChange={(e) => setNotifyUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            支付宝服务器异步通知支付结果的URL
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="alipay-return-url">同步返回URL（Return URL）</Label>
          <Input
            id="alipay-return-url"
            placeholder="https://yourdomain.com/payment/success"
            value={returnUrl}
            onChange={(e) => setReturnUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            支付完成后跳转回商户网站的URL
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="alipay-notes">备注说明</Label>
          <Textarea
            id="alipay-notes"
            placeholder="可选：添加备注说明..."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
          />
        </div>
        
        {/* 测试结果显示 */}
        {testResult && (
          <Alert variant={testResult.success ? "default" : "destructive"}>
            {testResult.success ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>
              {testResult.message}
              {testResult.details && (
                <pre className="mt-2 text-xs opacity-70">
                  {JSON.stringify(testResult.details, null, 2)}
                </pre>
              )}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={handleTest} 
            disabled={testConnectionMutation.isPending || !appId || !privateKey || !publicKey}
            variant="outline"
            className="w-full sm:w-auto"
          >
            {testConnectionMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                测试中...
              </>
            ) : (
              <>
                <TestTube2 className="mr-2 h-4 w-4" />
                测试连接
              </>
            )}
          </Button>
          
          <Button onClick={handleSave} disabled={upsertMutation.isPending} className="w-full sm:w-auto">
            {upsertMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                保存配置
              </>
            )}
          </Button>
        </div>
      </div>
    );
  };
  
  // 微信配置表单