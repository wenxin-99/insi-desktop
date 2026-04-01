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


  const StripeConfigForm = () => {
    const stripeConfig = getConfig('stripe');
    const [enabled, setEnabled] = useState(stripeConfig.enabled);
    const [publicKey, setPublicKey] = useState(stripeConfig.config.stripePublicKey || '');
    const [secretKey, setSecretKey] = useState(stripeConfig.config.stripeSecretKey || '');
    const [webhookSecret, setWebhookSecret] = useState(stripeConfig.config.stripeWebhookSecret || '');
    const [notes, setNotes] = useState(stripeConfig.notes);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
    
    const handleTest = () => {
      setTestResult(null);
      testConnectionMutation.mutate({
        provider: 'stripe',
        config: {
          stripePublicKey: publicKey,
          stripeSecretKey: secretKey,
          stripeWebhookSecret: webhookSecret,
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
        provider: 'stripe',
        enabled,
        config: {
          stripePublicKey: publicKey,
          stripeSecretKey: secretKey,
          stripeWebhookSecret: webhookSecret,
        },
        notes,
      });
    };
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">启用Stripe支付</Label>
            <p className="text-sm text-muted-foreground">开启后用户可以使用Stripe进行支付</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="stripe-public-key">Publishable Key（公钥）</Label>
          <Input
            id="stripe-public-key"
            placeholder="pk_test_..."
            value={publicKey}
            onChange={(e) => setPublicKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            在Stripe Dashboard的API Keys页面获取
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="stripe-secret-key">Secret Key（密钥）</Label>
          <Input
            id="stripe-secret-key"
            type="password"
            placeholder="sk_test_..."
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            请妥善保管，不要泄露给他人
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="stripe-webhook-secret">Webhook Secret（Webhook密钥）</Label>
          <Input
            id="stripe-webhook-secret"
            type="password"
            placeholder="whsec_..."
            value={webhookSecret}
            onChange={(e) => setWebhookSecret(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            用于验证Webhook请求的签名
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="stripe-notes">备注说明</Label>
          <Textarea
            id="stripe-notes"
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
            disabled={testConnectionMutation.isPending || !secretKey}
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
  
  // 支付宝配置表单