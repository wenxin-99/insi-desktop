/**
 * paymentConfig/StripeForm — Stripe 配置表单
 */
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { FormActions } from "./FormActions";
import type { ProviderConfig, TestResult } from "./types";

interface StripeFormProps {
  initial: ProviderConfig;
  onSave: (data: { provider: "stripe"; enabled: boolean; config: any; notes: string }) => void;
  onTest: (data: { provider: "stripe"; config: any }, callbacks: { onSuccess: (r: any) => void; onError: (e: any) => void }) => void;
  savePending: boolean;
  testPending: boolean;
}

export function StripeForm({ initial, onSave, onTest, savePending, testPending }: StripeFormProps) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [publicKey, setPublicKey] = useState(initial.config.stripePublicKey || "");
  const [secretKey, setSecretKey] = useState(initial.config.stripeSecretKey || "");
  const [webhookSecret, setWebhookSecret] = useState(initial.config.stripeWebhookSecret || "");
  const [notes, setNotes] = useState(initial.notes);
  const [testResult, setTestResult] = useState<TestResult | null>(null);

  const configPayload = { stripePublicKey: publicKey, stripeSecretKey: secretKey, stripeWebhookSecret: webhookSecret };

  const handleTest = () => {
    setTestResult(null);
    onTest({ provider: "stripe", config: configPayload }, {
      onSuccess: (r) => { setTestResult(r); toast[r.success ? "success" : "error"](r.message); },
      onError: (e) => { setTestResult({ success: false, message: e.message }); toast.error(`测试失败：${e.message}`); },
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
        <Label>Publishable Key（公钥）</Label>
        <Input placeholder="pk_test_..." value={publicKey} onChange={(e) => setPublicKey(e.target.value)} />
        <p className="text-xs text-muted-foreground">在Stripe Dashboard的API Keys页面获取</p>
      </div>
      <div className="space-y-2">
        <Label>Secret Key（密钥）</Label>
        <Input type="password" placeholder="sk_test_..." value={secretKey} onChange={(e) => setSecretKey(e.target.value)} />
        <p className="text-xs text-muted-foreground">请妥善保管，不要泄露给他人</p>
      </div>
      <div className="space-y-2">
        <Label>Webhook Secret（Webhook密钥）</Label>
        <Input type="password" placeholder="whsec_..." value={webhookSecret} onChange={(e) => setWebhookSecret(e.target.value)} />
        <p className="text-xs text-muted-foreground">用于验证Webhook请求的签名</p>
      </div>
      <div className="space-y-2">
        <Label>备注说明</Label>
        <Textarea placeholder="可选：添加备注说明..." value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
      </div>
      <FormActions
        testResult={testResult} testPending={testPending} savePending={savePending}
        testDisabled={!secretKey}
        onTest={handleTest}
        onSave={() => onSave({ provider: "stripe", enabled, config: configPayload, notes })}
      />
    </div>
  );
}
