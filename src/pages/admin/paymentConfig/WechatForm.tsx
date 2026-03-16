/**
 * paymentConfig/WechatForm — 微信支付配置表单
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FormActions } from "./FormActions";
import type { ProviderConfig, TestResult } from "./types";

interface WechatFormProps {
  initial: ProviderConfig;
  onSave: (data: { provider: "wechat"; enabled: boolean; config: any; notes: string }) => void;
  onTest: (data: { provider: "wechat"; config: any }, callbacks: { onSuccess: (r: any) => void; onError: (e: any) => void }) => void;
  savePending: boolean;
  testPending: boolean;
}

export function WechatForm({ initial, onSave, onTest, savePending, testPending }: WechatFormProps) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [appId, setAppId] = useState(initial.config.wechatAppId || "");
  const [mchId, setMchId] = useState(initial.config.wechatMchId || "");
  const [apiKey, setApiKey] = useState(initial.config.wechatApiKey || "");
  const [notifyUrl, setNotifyUrl] = useState(initial.config.wechatNotifyUrl || "");
  const [notes, setNotes] = useState(initial.notes);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const configPayload = { wechatAppId: appId, wechatMchId: mchId, wechatApiKey: apiKey, wechatNotifyUrl: notifyUrl };

  const handleTest = () => {
    setTestResult(null);
    onTest({ provider: "wechat", config: configPayload }, {
      onSuccess: (r) => { setTestResult(r); toast[r.success ? "success" : "error"](r.message); },
      onError: (e) => { setTestResult({ success: false, message: e.message }); toast.error(`测试失败：${e.message}`); },
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
        <Label>App ID（应用ID）</Label>
        <Input placeholder="wx1234567890abcdef" value={appId} onChange={(e) => setAppId(e.target.value)} />
        <p className="text-xs text-muted-foreground">在微信商户平台获取</p>
      </div>
      <div className="space-y-2">
        <Label>商户号（Mch ID）</Label>
        <Input placeholder="1234567890" value={mchId} onChange={(e) => setMchId(e.target.value)} />
        <p className="text-xs text-muted-foreground">微信支付商户号</p>
      </div>
      <div className="space-y-2">
        <Label>API密钥（API Key）</Label>
        <Input type="password" placeholder="32位API密钥" value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        <p className="text-xs text-muted-foreground">在微信商户平台设置，用于签名验证</p>
      </div>
      <div className="space-y-2">
        <Label>异步通知URL（Notify URL）</Label>
        <Input placeholder="https://yourdomain.com/api/wechat/notify" value={notifyUrl} onChange={(e) => setNotifyUrl(e.target.value)} />
        <p className="text-xs text-muted-foreground">微信服务器异步通知支付结果的URL</p>
      </div>
      <div className="space-y-2">
        <Label>备注说明</Label>
        <Textarea placeholder="可选：添加备注说明..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <FormActions
        testResult={testResult} testPending={testPending} savePending={savePending}
        testDisabled={!appId || !mchId || !apiKey}
        onTest={handleTest}
        onSave={() => onSave({ provider: "wechat", enabled, config: configPayload, notes })}
      />
    </div>
  );
}
