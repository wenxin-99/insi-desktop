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


  const WechatConfigForm = () => {
    const wechatConfig = getConfig('wechat');
    const [enabled, setEnabled] = useState(wechatConfig.enabled);
    const [appId, setAppId] = useState(wechatConfig.config.wechatAppId || '');
    const [mchId, setMchId] = useState(wechatConfig.config.wechatMchId || '');
    const [apiKey, setApiKey] = useState(wechatConfig.config.wechatApiKey || '');
    const [notifyUrl, setNotifyUrl] = useState(wechatConfig.config.wechatNotifyUrl || '');
    const [notes, setNotes] = useState(wechatConfig.notes);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string; details?: any } | null>(null);
    
    const handleTest = () => {
      setTestResult(null);
      testConnectionMutation.mutate({
        provider: 'wechat',
        config: {
          wechatAppId: appId,
          wechatMchId: mchId,
          wechatApiKey: apiKey,
          wechatNotifyUrl: notifyUrl,
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
        provider: 'wechat',
        enabled,
        config: {
          wechatAppId: appId,
          wechatMchId: mchId,
          wechatApiKey: apiKey,
          wechatNotifyUrl: notifyUrl,
        },
        notes,
      });
    };
    
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between p-4 bg-muted/50 rounded-lg">
          <div className="space-y-0.5">
            <Label className="text-base font-medium">启用微信支付</Label>
            <p className="text-sm text-muted-foreground">开启后用户可以使用微信进行支付</p>
          </div>
          <Switch checked={enabled} onCheckedChange={setEnabled} />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="wechat-app-id">App ID（应用ID）</Label>
          <Input
            id="wechat-app-id"
            placeholder="wx1234567890abcdef"
            value={appId}
            onChange={(e) => setAppId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            在微信商户平台获取
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="wechat-mch-id">商户号（Mch ID）</Label>
          <Input
            id="wechat-mch-id"
            placeholder="1234567890"
            value={mchId}
            onChange={(e) => setMchId(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            微信支付商户号
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="wechat-api-key">API密钥（API Key）</Label>
          <Input
            id="wechat-api-key"
            type="password"
            placeholder="32位API密钥"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            在微信商户平台设置，用于签名验证
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="wechat-notify-url">异步通知URL（Notify URL）</Label>
          <Input
            id="wechat-notify-url"
            placeholder="https://yourdomain.com/api/wechat/notify"
            value={notifyUrl}
            onChange={(e) => setNotifyUrl(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            微信服务器异步通知支付结果的URL
          </p>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="wechat-notes">备注说明</Label>
          <Textarea
            id="wechat-notes"
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
            disabled={testConnectionMutation.isPending || !appId || !mchId || !apiKey}
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
  
  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }
  
  return (
    <DashboardLayout>