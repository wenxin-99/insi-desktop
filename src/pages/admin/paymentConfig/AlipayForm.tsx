/**
 * paymentConfig/AlipayForm — 支付宝配置表单
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FormActions } from "./FormActions";
import type { ProviderConfig, TestResult } from "./types";

interface AlipayFormProps {
  initial: ProviderConfig;
  onSave: (data: { provider: "alipay"; enabled: boolean; config: any; notes: string }) => void;
  onTest: (data: { provider: "alipay"; config: any }, callbacks: { onSuccess: (r: any) => void; onError: (e: any) => void }) => void;
  savePending: boolean;
  testPending: boolean;
}

export function AlipayForm({ initial, onSave, onTest, savePending, testPending }: AlipayFormProps) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [appId, setAppId] = useState(initial.config.alipayAppId || "");
  const [privateKey, setPrivateKey] = useState(initial.config.alipayPrivateKey || "");
  const [publicKey, setPublicKey] = useState(initial.config.alipayPublicKey || "");
  const [notifyUrl, setNotifyUrl] = useState(initial.config.alipayNotifyUrl || "");
  const [returnUrl, setReturnUrl] = useState(initial.config.alipayReturnUrl || "");
  const [notes, setNotes] = useState(initial.notes);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const configPayload = { alipayAppId: appId, alipayPrivateKey: privateKey, alipayPublicKey: publicKey, alipayNotifyUrl: notifyUrl, alipayReturnUrl: returnUrl };

  const handleTest = () => {
    setTestResult(null);
    onTest({ provider: "alipay", config: configPayload }, {
      onSuccess: (r) => { setTestResult(r); toast[r.success ? "success" : "error"](r.message); },
      onError: (e) => { setTestResult({ success: false, message: e.message }); toast.error(`测试失败：${e.message}`); },
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
        <Label>App ID（应用ID）</Label>
        <Input placeholder="2021001234567890" value={appId} onChange={(e) => setAppId(e.target.value)} />
        <p className="text-xs text-muted-foreground">在支付宝开放平台的应用详情页面获取</p>
      </div>
      <div className="space-y-2">
        <Label>应用私钥（Private Key）</Label>
        <Textarea placeholder="MIIEvQIBADANBgkqhkiG9w0BAQE..." value={privateKey} onChange={(e) => setPrivateKey(e.target.value)} rows={4} className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground">使用RSA2签名方式，请妥善保管私钥</p>
      </div>
      <div className="space-y-2">
        <Label>支付宝公钥（Alipay Public Key）</Label>
        <Textarea placeholder="MIIBIjANBgkqhkiG9w0BAQE..." value={publicKey} onChange={(e) => setPublicKey(e.target.value)} rows={4} className="font-mono text-xs" />
        <p className="text-xs text-muted-foreground">在支付宝开放平台获取，用于验证支付宝返回的签名</p>
      </div>
      <div className="space-y-2">
        <Label>异步通知URL（Notify URL）</Label>
        <Input placeholder="https://yourdomain.com/api/alipay/notify" value={notifyUrl} onChange={(e) => setNotifyUrl(e.target.value)} />
        <p className="text-xs text-muted-foreground">支付宝服务器异步通知支付结果的URL</p>
      </div>
      <div className="space-y-2">
        <Label>同步返回URL（Return URL）</Label>
        <Input placeholder="https://yourdomain.com/payment/success" value={returnUrl} onChange={(e) => setReturnUrl(e.target.value)} />
        <p className="text-xs text-muted-foreground">支付完成后跳转回商户网站的URL</p>
      </div>
      <div className="space-y-2">
        <Label>备注说明</Label>
        <Textarea placeholder="可选：添加备注说明..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <FormActions
        testResult={testResult} testPending={testPending} savePending={savePending}
        testDisabled={!appId || !privateKey || !publicKey}
        onTest={handleTest}
        onSave={() => onSave({ provider: "alipay", enabled, config: configPayload, notes })}
      />
    </div>
  );
}
