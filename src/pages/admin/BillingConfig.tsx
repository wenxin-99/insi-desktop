/**
 * BillingConfig — 统一计费管理面板
 *
 * 三个标签页：
 *   1. 充值档位 — 管理充值套餐（金额、赠送、售价、排序）
 *   2. VIP 方案 — 管理会员等级（价格、配额、折扣）
 *   3. 功能单价 — 管理研究/SSH/自动化等全局定价参数
 */
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, Coins, Crown, Settings, Plus, Trash2, Save, Loader2, GripVertical, RefreshCcw,
} from "lucide-react";

// ════════════ 充值档位 Tab ════════════

interface RechargePackage {
  id: number;
  amount: number;
  bonus: number;
  priceCNY: number;
  enabled: boolean;
  popular: boolean;
  sortOrder: number;
  gradient: string;
}

function RechargeTab() {
  // ★ 使用已有的 rechargeConfig 路由（server/routers/adminConfig/rechargeConfig.ts）
  const { data, isLoading, refetch } = trpc.billingConfig.getRechargePackages.useQuery();
  const updateMutation = trpc.billingConfig.updateRechargePackages.useMutation({
    onSuccess: () => { toast.success("充值档位已保存"); refetch(); },
    onError: (e: any) => toast.error(`保存失败: ${e.message}`),
  });

  const [packages, setPackages] = useState<RechargePackage[]>([]);

  useEffect(() => {
    if (data) setPackages(JSON.parse(JSON.stringify(data)));
  }, [data]);

  const addPackage = () => {
    const maxId = packages.reduce((m, p) => Math.max(m, p.id), 0);
    const gradients = ["from-blue-500 to-cyan-500", "from-purple-500 to-pink-500", "from-orange-500 to-amber-500", "from-green-500 to-emerald-500", "from-rose-500 to-red-500"];
    setPackages([...packages, {
      id: maxId + 1,
      amount: 100,
      bonus: 0,
      priceCNY: 10,
      enabled: true,
      popular: false,
      sortOrder: packages.length,
      gradient: gradients[packages.length % gradients.length],
    }]);
  };

  const removePackage = (id: number) => {
    setPackages(packages.filter(p => p.id !== id));
  };

  const updateField = (id: number, field: string, value: any) => {
    setPackages(packages.map(p => p.id === id ? { ...p, [field]: value } : p));
  };

  const handleSave = () => {
    if (packages.length === 0) {
      toast.error("至少保留一个充值档位");
      return;
    }
    updateMutation.mutate(packages);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">管理充值档位的🐟币数量、赠送额度和人民币售价。修改后需点击保存。</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={addPackage}>
            <Plus className="h-4 w-4 mr-1" /> 添加档位
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
            {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            保存
          </Button>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-16">ID</TableHead>
            <TableHead>🐟币</TableHead>
            <TableHead>赠送</TableHead>
            <TableHead>售价(¥)</TableHead>
            <TableHead className="w-20">实际比率</TableHead>
            <TableHead className="w-20">启用</TableHead>
            <TableHead className="w-20">热门</TableHead>
            <TableHead className="w-16">排序</TableHead>
            <TableHead className="w-16"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {packages.sort((a, b) => a.sortOrder - b.sortOrder).map((pkg) => (
            <TableRow key={pkg.id}>
              <TableCell className="font-mono text-muted-foreground">{pkg.id}</TableCell>
              <TableCell>
                <Input
                  type="number" className="w-24" value={pkg.amount}
                  onChange={(e) => updateField(pkg.id, "amount", Number(e.target.value))}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number" className="w-20" value={pkg.bonus}
                  onChange={(e) => updateField(pkg.id, "bonus", Number(e.target.value))}
                />
              </TableCell>
              <TableCell>
                <Input
                  type="number" className="w-20" value={pkg.priceCNY}
                  onChange={(e) => updateField(pkg.id, "priceCNY", Number(e.target.value))}
                />
              </TableCell>
              <TableCell className="text-sm text-muted-foreground">
                1:{pkg.priceCNY > 0 ? ((pkg.amount + pkg.bonus) / pkg.priceCNY).toFixed(1) : "∞"}
              </TableCell>
              <TableCell>
                <Switch checked={pkg.enabled} onCheckedChange={(v) => updateField(pkg.id, "enabled", v)} />
              </TableCell>
              <TableCell>
                <Switch checked={pkg.popular} onCheckedChange={(v) => updateField(pkg.id, "popular", v)} />
              </TableCell>
              <TableCell>
                <Input
                  type="number" className="w-14" value={pkg.sortOrder}
                  onChange={(e) => updateField(pkg.id, "sortOrder", Number(e.target.value))}
                />
              </TableCell>
              <TableCell>
                <Button variant="ghost" size="icon" onClick={() => removePackage(pkg.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {packages.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">暂无充值档位，点击"添加档位"创建</div>
      )}
    </div>
  );
}

// ════════════ VIP 方案 Tab ════════════

interface VIPPlan {
  tier: "vip" | "premium";
  displayName: string;
  monthlyPrice: number;
  defaultDurationDays: number;
  quotas: { chat: number; image: number; document: number };
  discountPercent: number;
  features: string[];
  enabled: boolean;
}

function VIPTab() {
  const { data, isLoading, refetch } = trpc.billingConfig.getVIPPlans.useQuery();
  const updateMutation = trpc.billingConfig.updateVIPPlans.useMutation({
    onSuccess: () => { toast.success("VIP 方案已保存"); refetch(); },
    onError: (e) => toast.error(`保存失败: ${e.message}`),
  });

  const [plans, setPlans] = useState<VIPPlan[]>([]);

  useEffect(() => {
    if (data) setPlans(JSON.parse(JSON.stringify(data)));
  }, [data]);

  const updatePlan = (tier: string, field: string, value: any) => {
    setPlans(plans.map(p => p.tier === tier ? { ...p, [field]: value } : p));
  };

  const updateQuota = (tier: string, field: string, value: number) => {
    setPlans(plans.map(p => p.tier === tier ? { ...p, quotas: { ...p.quotas, [field]: value } } : p));
  };

  const updateFeatures = (tier: string, value: string) => {
    setPlans(plans.map(p => p.tier === tier ? { ...p, features: value.split("\n").filter(Boolean) } : p));
  };

  const handleSave = () => {
    updateMutation.mutate({ plans });
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">配置 VIP 和高级 VIP 的月费、配额和折扣。</p>
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          保存
        </Button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {plans.map((plan) => (
          <Card key={plan.tier} className={plan.tier === "premium" ? "border-purple-500/30" : ""}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Crown className={`h-5 w-5 ${plan.tier === "premium" ? "text-purple-500" : "text-blue-500"}`} />
                  {plan.tier === "vip" ? "标准会员" : "专业会员"}
                  <Badge variant={plan.tier === "premium" ? "default" : "secondary"}>{plan.tier}</Badge>
                </CardTitle>
                <Switch checked={plan.enabled} onCheckedChange={(v) => updatePlan(plan.tier, "enabled", v)} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">显示名称</Label>
                  <Input value={plan.displayName} onChange={(e) => updatePlan(plan.tier, "displayName", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">月费(🐟)</Label>
                  <Input type="number" value={plan.monthlyPrice} onChange={(e) => updatePlan(plan.tier, "monthlyPrice", Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">默认时长(天)</Label>
                  <Input type="number" value={plan.defaultDurationDays} onChange={(e) => updatePlan(plan.tier, "defaultDurationDays", Number(e.target.value))} />
                </div>
                <div>
                  <Label className="text-xs">折扣(%)</Label>
                  <Input type="number" value={plan.discountPercent} onChange={(e) => updatePlan(plan.tier, "discountPercent", Number(e.target.value))} />
                </div>
              </div>

              <div>
                <Label className="text-xs mb-1 block">每日配额</Label>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <span className="text-xs text-muted-foreground">对话</span>
                    <Input type="number" value={plan.quotas.chat} onChange={(e) => updateQuota(plan.tier, "chat", Number(e.target.value))} />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">图片</span>
                    <Input type="number" value={plan.quotas.image} onChange={(e) => updateQuota(plan.tier, "image", Number(e.target.value))} />
                  </div>
                  <div>
                    <span className="text-xs text-muted-foreground">文档</span>
                    <Input type="number" value={plan.quotas.document} onChange={(e) => updateQuota(plan.tier, "document", Number(e.target.value))} />
                  </div>
                </div>
              </div>

              <div>
                <Label className="text-xs mb-1 block">功能亮点（每行一项）</Label>
                <textarea
                  className="w-full h-24 text-sm rounded-md border px-3 py-2 bg-background"
                  value={plan.features.join("\n")}
                  onChange={(e) => updateFeatures(plan.tier, e.target.value)}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ════════════ 功能单价 Tab ════════════

function FeaturePricesTab() {
  const { data, isLoading, refetch } = trpc.billingConfig.getFeaturePrices.useQuery();
  const updateMutation = trpc.billingConfig.updateFeaturePrices.useMutation({
    onSuccess: () => { toast.success("功能单价已保存"); refetch(); },
    onError: (e) => toast.error(`保存失败: ${e.message}`),
  });

  const [prices, setPrices] = useState<Record<string, number>>({});

  useEffect(() => {
    if (data) setPrices({ ...data });
  }, [data]);

  const fields = [
    { key: "maxSingleChatCharge", label: "单次对话扣费上限", unit: "🐟", desc: "防止配置错误导致天价扣费" },
    { key: "researchBaseCost", label: "研究任务底价", unit: "🐟", desc: "启动时预扣" },
    { key: "researchStepCost", label: "研究任务每步费用", unit: "🐟/步", desc: "执行过程中逐步扣除" },
    { key: "sshBaseCost", label: "SSH 运维底价", unit: "🐟", desc: "启动时预扣" },
    { key: "sshStepCost", label: "SSH 运维每步费用", unit: "🐟/步", desc: "执行过程中逐步扣除" },
    { key: "automationPrecharge", label: "自动化任务预扣", unit: "🐟", desc: "浏览器自动化启动时预扣" },
    { key: "automationMaxCharge", label: "自动化任务封顶", unit: "🐟", desc: "单次自动化最高收费" },
  ];

  const handleSave = () => {
    updateMutation.mutate(prices);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">全局功能定价参数。套餐中的独立定价会覆盖此处的默认值。</p>
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          保存
        </Button>
      </div>

      <div className="grid gap-4">
        {fields.map(({ key, label, unit, desc }) => (
          <div key={key} className="flex items-center gap-4 p-3 rounded-lg border bg-card">
            <div className="flex-1">
              <div className="font-medium text-sm">{label}</div>
              <div className="text-xs text-muted-foreground">{desc}</div>
            </div>
            <div className="flex items-center gap-2 w-40">
              <Input
                type="number"
                step="0.1"
                value={prices[key] ?? 0}
                onChange={(e) => setPrices({ ...prices, [key]: Number(e.target.value) })}
                className="text-right"
              />
              <span className="text-sm text-muted-foreground whitespace-nowrap">{unit}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ════════════ 论坛兑换 Tab ════════════

function ForumSyncTab() {
  const { data, isLoading, refetch } = trpc.billingConfig.getForumSyncConfig.useQuery();
  const updateMutation = trpc.billingConfig.updateForumSyncConfig.useMutation({
    onSuccess: () => { toast.success("论坛兑换配置已保存"); refetch(); },
    onError: (e: any) => toast.error(`保存失败: ${e.message}`),
  });

  const [config, setConfig] = useState({ exchangeRate: 5, monthlyCap: 200, reverseSync: false });

  useEffect(() => {
    if (data) setConfig({ ...data });
  }, [data]);

  const handleSave = () => {
    updateMutation.mutate(config);
  };

  if (isLoading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  const exampleDaily = Math.floor(5 / config.exchangeRate); // 签到5积分能换多少
  const exampleActive = Math.floor(17 / config.exchangeRate); // 活跃用户日均17积分
  const exampleMonthly = Math.min(exampleActive * 30, config.monthlyCap || exampleActive * 30);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">控制论坛积分兑换🐟币的比率和上限。修改后需点击保存。</p>
        <Button size="sm" onClick={handleSave} disabled={updateMutation.isPending}>
          {updateMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
          保存
        </Button>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
          <div className="flex-1">
            <div className="font-medium text-sm">兑换比例</div>
            <div className="text-xs text-muted-foreground">多少论坛积分兑换 1 🐟币（值越大，兑换越难）</div>
          </div>
          <div className="flex items-center gap-2 w-48">
            <Input type="number" min={1} max={100} value={config.exchangeRate}
              onChange={(e) => setConfig({ ...config, exchangeRate: Math.max(1, Number(e.target.value)) })}
              className="text-right" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">积分 = 1🐟</span>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
          <div className="flex-1">
            <div className="font-medium text-sm">每月兑换上限</div>
            <div className="text-xs text-muted-foreground">每位用户每月最多从论坛兑换的🐟币数（0 = 不限）</div>
          </div>
          <div className="flex items-center gap-2 w-48">
            <Input type="number" min={0} max={100000} value={config.monthlyCap}
              onChange={(e) => setConfig({ ...config, monthlyCap: Math.max(0, Number(e.target.value)) })}
              className="text-right" />
            <span className="text-sm text-muted-foreground whitespace-nowrap">🐟/月</span>
          </div>
        </div>

        <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
          <div className="flex-1">
            <div className="font-medium text-sm">反向同步</div>
            <div className="text-xs text-muted-foreground">AI 消费扣🐟币时是否同步扣除论坛积分（建议关闭，让两套货币独立）</div>
          </div>
          <Switch checked={config.reverseSync} onCheckedChange={(v) => setConfig({ ...config, reverseSync: v })} />
        </div>
      </div>

      <Card className="bg-muted/30">
        <CardContent className="pt-4">
          <div className="text-sm font-medium mb-2">当前配置下的收入预估</div>
          <div className="grid grid-cols-3 gap-4 text-sm text-muted-foreground">
            <div>
              <div className="text-xs">仅签到用户</div>
              <div className="font-mono text-foreground">{exampleDaily}🐟/天 ≈ {exampleDaily * 30}🐟/月</div>
            </div>
            <div>
              <div className="text-xs">活跃用户（签到+发帖+回复）</div>
              <div className="font-mono text-foreground">{exampleActive}🐟/天 ≈ {exampleMonthly}🐟/月</div>
            </div>
            <div>
              <div className="text-xs">折合人民币</div>
              <div className="font-mono text-foreground">≈ ¥{(exampleMonthly * 0.1).toFixed(0)}/月</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ════════════ 主页面 ════════════

export default function BillingConfig() {
  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">计费配置</h1>
            <p className="text-muted-foreground">统一管理充值档位、VIP方案和功能定价</p>
          </div>
        </div>

        <Tabs defaultValue="recharge">
          <TabsList>
            <TabsTrigger value="recharge" className="gap-1.5">
              <Coins className="h-4 w-4" /> 充值档位
            </TabsTrigger>
            <TabsTrigger value="vip" className="gap-1.5">
              <Crown className="h-4 w-4" /> VIP 方案
            </TabsTrigger>
            <TabsTrigger value="prices" className="gap-1.5">
              <Settings className="h-4 w-4" /> 功能单价
            </TabsTrigger>
            <TabsTrigger value="forum" className="gap-1.5">
              <RefreshCcw className="h-4 w-4" /> 论坛兑换
            </TabsTrigger>
          </TabsList>

          <TabsContent value="recharge" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>充值档位管理</CardTitle>
                <CardDescription>配置用户可购买的🐟币充值套餐</CardDescription>
              </CardHeader>
              <CardContent>
                <RechargeTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vip" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>VIP 会员方案</CardTitle>
                <CardDescription>配置VIP和高级VIP的价格、配额和权益</CardDescription>
              </CardHeader>
              <CardContent>
                <VIPTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="prices" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>功能定价参数</CardTitle>
                <CardDescription>研究、SSH、自动化等功能的全局默认定价</CardDescription>
              </CardHeader>
              <CardContent>
                <FeaturePricesTab />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="forum" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle>论坛积分兑换</CardTitle>
                <CardDescription>控制论坛积分→🐟币的兑换比率、月度上限和反向同步</CardDescription>
              </CardHeader>
              <CardContent>
                <ForumSyncTab />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
