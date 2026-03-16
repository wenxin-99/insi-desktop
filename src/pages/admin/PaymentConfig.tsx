/**
 * PaymentConfig — 支付配置页面
 *
 * 拆分自原 716 行单文件。子模块：
 *   types.ts        - 共享类型
 *   FormActions.tsx  - 测试/保存按钮 + 结果展示（三表单共享）
 *   StripeForm.tsx   - Stripe 配置
 *   AlipayForm.tsx   - 支付宝配置
 *   WechatForm.tsx   - 微信支付配置
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { CreditCard, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { StripeForm } from "./paymentConfig/StripeForm";
import { AlipayForm } from "./paymentConfig/AlipayForm";
import { WechatForm } from "./paymentConfig/WechatForm";
import type { PaymentConfigData, Provider, ProviderConfig } from "./paymentConfig/types";

export default function PaymentConfig() {
  const [activeTab, setActiveTab] = useState("stripe");

  const { data: configs, isLoading, refetch } = trpc.paymentConfig.getAll.useQuery();

  const upsertMutation = trpc.paymentConfig.upsert.useMutation({
    onSuccess: () => { toast.success("保存成功"); refetch(); },
    onError: (error) => { toast.error(`保存失败：${error.message}`); },
  });

  const testConnectionMutation = trpc.paymentConfig.testConnection.useMutation();

  // ════════ 工具函数 ════════

  const getConfig = (provider: Provider): ProviderConfig => {
    const config = configs?.find((c) => c.provider === provider);
    if (!config) return { enabled: false, config: {}, notes: "" };
    try {
      return { enabled: config.enabled, config: JSON.parse(config.config) as PaymentConfigData, notes: config.notes || "" };
    } catch {
      return { enabled: false, config: {}, notes: "" };
    }
  };

  const enabledStatus = {
    stripe: configs?.find((c) => c.provider === "stripe")?.enabled || false,
    alipay: configs?.find((c) => c.provider === "alipay")?.enabled || false,
    wechat: configs?.find((c) => c.provider === "wechat")?.enabled || false,
  };

  const handleSave = (data: { provider: Provider; enabled: boolean; config: any; notes: string }) => {
    upsertMutation.mutate(data);
  };

  const handleTest = (data: { provider: Provider; config: any }, callbacks: { onSuccess: (r: any) => void; onError: (e: any) => void }) => {
    testConnectionMutation.mutate(data, callbacks);
  };

  // ════════ 渲染 ════════

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  const StatusBadge = ({ enabled, label }: { enabled: boolean; label: string }) => (
    <Badge variant={enabled ? "default" : "secondary"} className="text-sm py-1.5 px-3">
      {enabled ? <><CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />{label}已启用</> : <><XCircle className="mr-1.5 h-3.5 w-3.5" />{label}未启用</>}
    </Badge>
  );

  return (
    <DashboardLayout>
      <div className="space-y-6 p-6 max-w-5xl">
        <div className="space-y-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">支付配置</h1>
            <p className="text-muted-foreground mt-2">配置多种支付方式，为用户提供灵活的支付选择</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <StatusBadge enabled={enabledStatus.stripe} label="Stripe" />
            <StatusBadge enabled={enabledStatus.alipay} label="支付宝" />
            <StatusBadge enabled={enabledStatus.wechat} label="微信支付" />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" /> 支付方式配置
            </CardTitle>
            <CardDescription>配置Stripe、支付宝、微信支付等多种支付方式</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="stripe">Stripe</TabsTrigger>
                <TabsTrigger value="alipay">支付宝</TabsTrigger>
                <TabsTrigger value="wechat">微信支付</TabsTrigger>
              </TabsList>
              <TabsContent value="stripe" className="mt-6">
                <StripeForm initial={getConfig("stripe")} onSave={handleSave} onTest={handleTest} savePending={upsertMutation.isPending} testPending={testConnectionMutation.isPending} />
              </TabsContent>
              <TabsContent value="alipay" className="mt-6">
                <AlipayForm initial={getConfig("alipay")} onSave={handleSave} onTest={handleTest} savePending={upsertMutation.isPending} testPending={testConnectionMutation.isPending} />
              </TabsContent>
              <TabsContent value="wechat" className="mt-6">
                <WechatForm initial={getConfig("wechat")} onSave={handleSave} onTest={handleTest} savePending={upsertMutation.isPending} testPending={testConnectionMutation.isPending} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
