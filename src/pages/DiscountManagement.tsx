import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { safeToast } from "@/lib/safeToast";
import { Loader2, Save, Percent, ArrowLeft, Calendar, TrendingUp, Layers } from "lucide-react";

export default function DiscountManagement() {
  const { data: discountConfigs, refetch: refetchConfigs } = trpc.discount.getAll.useQuery();
  const { data: globalSettings, refetch: refetchGlobal } = trpc.discount.getGlobalSettings.useQuery();
  const { data: statistics } = trpc.discount.getStatistics.useQuery();
  const updateConfigMutation = trpc.discount.updateConfig.useMutation();
  const updateGlobalMutation = trpc.discount.updateGlobalSettings.useMutation();

  const [editingConfig, setEditingConfig] = useState<Record<string, any>>({});
  const [globalEnabled, setGlobalEnabled] = useState(globalSettings?.discountEnabled ?? true);

  // 同步全局设置状态（使用useEffect避免React error #310）
  useEffect(() => {
    if (globalSettings) {
      setGlobalEnabled(globalSettings.discountEnabled);
    }
  }, [globalSettings]);

  const handleUpdateConfig = async (userTier: "free" | "vip" | "premium") => {
    const config = editingConfig[userTier];
    if (!config) {
      safeToast.error("请先修改配置");
      return;
    }

    // 验证定时折扣时间合法性
    if (config.startTime && config.endTime) {
      const start = new Date(config.startTime);
      const end = new Date(config.endTime);
      if (start >= end) {
        safeToast.error("开始时间必须早于结束时间");
        return;
      }
    }

    try {
      await updateConfigMutation.mutateAsync({
        userTier,
        ...config,
      });
      safeToast.success("折扣配置已更新");
      refetchConfigs();
      setEditingConfig((prev) => {
        const newState = { ...prev };
        delete newState[userTier];
        return newState;
      });
    } catch (error: any) {
      safeToast.error(`更新失败：${error.message}`);
    }
  };

  const handleToggleGlobal = async (enabled: boolean) => {
    // 乐观更新UI
    setGlobalEnabled(enabled);
    try {
      await updateGlobalMutation.mutateAsync({ discountEnabled: enabled });
      safeToast.success(enabled ? "折扣系统已启用" : "折扣系统已关闭");
      refetchGlobal();
    } catch (error: any) {
      // 失败时回滚
      setGlobalEnabled(!enabled);
      safeToast.error(`更新失败：${error.message}`);
    }
  };

  const getTierLabel = (tier: string) => {
    const labels: Record<string, string> = {
      free: "免费用户",
      vip: "VIP用户",
      premium: "高级VIP",
    };
    return labels[tier] || tier;
  };

  const getTierColor = (tier: string) => {
    const colors: Record<string, string> = {
      free: "text-gray-600",
      vip: "text-blue-600",
      premium: "text-purple-600",
    };
    return colors[tier] || "text-gray-600";
  };

  const formatDateTime = (date: string | Date | null | undefined) => {
    if (!date) return "未设置";
    const dateObj = date instanceof Date ? date : new Date(date);
    return dateObj.toLocaleString("zh-CN");
  };

  if (!discountConfigs || !globalSettings) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">折扣管理</h1>
          <p className="text-muted-foreground mt-2">
            管理折扣配置、查看使用统计、配置叠加规则
          </p>
        </div>
      </div>

      <Tabs defaultValue="config" className="space-y-6">
        <TabsList>
          <TabsTrigger value="config">
            <Percent className="h-4 w-4 mr-2" />
            折扣配置
          </TabsTrigger>
          <TabsTrigger value="statistics">
            <TrendingUp className="h-4 w-4 mr-2" />
            使用统计
          </TabsTrigger>
          <TabsTrigger value="stacking">
            <Layers className="h-4 w-4 mr-2" />
            叠加规则
          </TabsTrigger>
        </TabsList>

        {/* 折扣配置标签页 */}
        <TabsContent value="config" className="space-y-6">
          {/* 全局折扣开关 */}
          <Card>
            <CardHeader>
              <CardTitle>全局折扣设置</CardTitle>
              <CardDescription>
                控制整个系统的折扣功能是否启用
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="global-discount" className="text-base font-medium">
                    启用折扣系统
                  </Label>
                  <p className="text-sm text-muted-foreground mt-1">
                    关闭后，所有用户等级的折扣将不生效
                  </p>
                </div>
                <Switch
                  id="global-discount"
                  checked={globalEnabled}
                  onCheckedChange={handleToggleGlobal}
                />
              </div>
            </CardContent>
          </Card>

          {/* 用户等级折扣配置 */}
          <div className="grid gap-6 md:grid-cols-3">
            {discountConfigs.map((config) => {
              const editing = editingConfig[config.userTier] || {};
              const chatDiscount = editing.chatDiscount ?? config.chatDiscount;
              const imageDiscount = editing.imageDiscount ?? config.imageDiscount;
              const documentDiscount = editing.documentDiscount ?? config.documentDiscount;
              const enabled = editing.enabled ?? config.enabled;
              const startTime = editing.startTime ?? config.startTime;
              const endTime = editing.endTime ?? config.endTime;

              return (
                <Card key={config.id} className={!enabled ? "opacity-60" : ""}>
                  <CardHeader>
                    <CardTitle className={`flex items-center gap-2 ${getTierColor(config.userTier)}`}>
                      <Percent className="h-5 w-5" />
                      {getTierLabel(config.userTier)}
                    </CardTitle>
                    <CardDescription>{config.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* 启用开关 */}
                    <div className="flex items-center justify-between">
                      <Label htmlFor={`enabled-${config.userTier}`} className="text-sm">
                        启用折扣
                      </Label>
                      <Switch
                        id={`enabled-${config.userTier}`}
                        checked={enabled}
                        onCheckedChange={(checked) => {
                          setEditingConfig((prev) => ({
                            ...prev,
                            [config.userTier]: {
                              ...prev[config.userTier],
                              enabled: checked,
                            },
                          }));
                        }}
                      />
                    </div>

                    {/* Insi对话折扣 */}
                    <div className="space-y-2">
                      <Label htmlFor={`chat-${config.userTier}`}>
                        Insi对话折扣 ({chatDiscount}%)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`chat-${config.userTier}`}
                          type="number"
                          min="0"
                          max="100"
                          value={chatDiscount}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setEditingConfig((prev) => ({
                              ...prev,
                              [config.userTier]: {
                                ...prev[config.userTier],
                                chatDiscount: Math.min(100, Math.max(0, value)),
                              },
                            }));
                          }}
                          disabled={!enabled}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {chatDiscount > 0 ? `实付：${((100 - chatDiscount) / 10).toFixed(1).replace('.0','')}折` : '暂无折扣'}
                      </p>
                    </div>

                    {/* 图片生成折扣 */}
                    <div className="space-y-2">
                      <Label htmlFor={`image-${config.userTier}`}>
                        图片生成折扣 ({imageDiscount}%)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`image-${config.userTier}`}
                          type="number"
                          min="0"
                          max="100"
                          value={imageDiscount}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setEditingConfig((prev) => ({
                              ...prev,
                              [config.userTier]: {
                                ...prev[config.userTier],
                                imageDiscount: Math.min(100, Math.max(0, value)),
                              },
                            }));
                          }}
                          disabled={!enabled}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {imageDiscount > 0 ? `实付：${((100 - imageDiscount) / 10).toFixed(1).replace('.0','')}折` : '暂无折扣'}
                      </p>
                    </div>

                    {/* 文档处理折扣 */}
                    <div className="space-y-2">
                      <Label htmlFor={`document-${config.userTier}`}>
                        文档处理折扣 ({documentDiscount}%)
                      </Label>
                      <div className="flex items-center gap-2">
                        <Input
                          id={`document-${config.userTier}`}
                          type="number"
                          min="0"
                          max="100"
                          value={documentDiscount}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setEditingConfig((prev) => ({
                              ...prev,
                              [config.userTier]: {
                                ...prev[config.userTier],
                                documentDiscount: Math.min(100, Math.max(0, value)),
                              },
                            }));
                          }}
                          disabled={!enabled}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {documentDiscount > 0 ? `实付：${((100 - documentDiscount) / 10).toFixed(1).replace('.0','')}折` : '暂无折扣'}
                      </p>
                    </div>

                    {/* 定时折扣设置 */}
                    <div className="space-y-3 pt-2 border-t">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Calendar className="h-4 w-4" />
                        定时折扣
                      </div>
                      
                      <div className="space-y-2">
                        <Label htmlFor={`start-${config.userTier}`} className="text-xs">
                          开始时间（留空表示立即生效）
                        </Label>
                        <Input
                          id={`start-${config.userTier}`}
                          type="datetime-local"
                          value={startTime ? new Date(startTime).toISOString().slice(0, 16) : ""}
                          onChange={(e) => {
                            setEditingConfig((prev) => ({
                              ...prev,
                              [config.userTier]: {
                                ...prev[config.userTier],
                                startTime: e.target.value ? new Date(e.target.value).toISOString() : null,
                              },
                            }));
                          }}
                          disabled={!enabled}
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`end-${config.userTier}`} className="text-xs">
                          结束时间（留空表示永久有效）
                        </Label>
                        <Input
                          id={`end-${config.userTier}`}
                          type="datetime-local"
                          value={endTime ? new Date(endTime).toISOString().slice(0, 16) : ""}
                          onChange={(e) => {
                            setEditingConfig((prev) => ({
                              ...prev,
                              [config.userTier]: {
                                ...prev[config.userTier],
                                endTime: e.target.value ? new Date(e.target.value).toISOString() : null,
                              },
                            }));
                          }}
                          disabled={!enabled}
                        />
                      </div>

                      {(config.startTime || config.endTime) && (() => {
                        const now = new Date();
                        const start = config.startTime ? new Date(config.startTime) : null;
                        const end = config.endTime ? new Date(config.endTime) : null;
                        const isActive = (!start || now >= start) && (!end || now <= end);
                        return (
                          <div className={`text-xs space-y-1 p-2 rounded border ${isActive ? 'bg-green-50 border-green-200 text-green-800' : 'bg-muted/50 border-muted text-muted-foreground'}`}>
                            <p className="font-medium">{isActive ? '✅ 定时折扣生效中' : '⏰ 定时折扣未生效'}</p>
                            {config.startTime && <p>开始：{formatDateTime(config.startTime)}</p>}
                            {config.endTime && <p>结束：{formatDateTime(config.endTime)}</p>}
                          </div>
                        );
                      })()}
                    </div>

                    {/* 保存按钮 */}
                    <Button
                      className="w-full"
                      onClick={() => handleUpdateConfig(config.userTier as any)}
                      disabled={!editingConfig[config.userTier] || updateConfigMutation.isPending}
                    >
                      {updateConfigMutation.isPending ? (
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
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* 说明 */}
          <Card>
            <CardHeader>
              <CardTitle>折扣说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• 折扣百分比表示优惠力度，例如20%表示打8折（支付原价的80%）</p>
              <p>• 关闭全局折扣开关后，所有用户等级的折扣将不生效</p>
              <p>• 单独关闭某个等级的折扣，只影响该等级用户</p>
              <p>• 定时折扣：可设置折扣的生效时间段，用于限时活动</p>
              <p>• 折扣范围：0-100%，建议设置在10-30%之间</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 使用统计标签页 */}
        <TabsContent value="statistics" className="space-y-6">
          {(!statistics || statistics.length === 0) ? (
            <div className="text-center py-12 text-muted-foreground border rounded-lg">
              <p>暂无统计数据</p>
              <p className="text-xs mt-1">折扣被使用后将在这里显示统计</p>
            </div>
          ) : null}
          <div className="grid gap-6 md:grid-cols-3">
            {statistics?.map((stat) => (
              <Card key={stat.userTier}>
                <CardHeader>
                  <CardTitle className={`flex items-center gap-2 ${getTierColor(stat.userTier)}`}>
                    {getTierLabel(stat.userTier)}
                  </CardTitle>
                  <CardDescription>
                    {stat.enabled ? "折扣已启用" : "折扣已禁用"}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">使用次数</span>
                      <span className="text-2xl font-bold">{stat.usageCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">总节省金额</span>
                      <span className="text-xl font-semibold text-green-600">
                        {stat.totalSaved ? (
                          typeof stat.totalSaved === 'string' 
                            ? parseFloat(stat.totalSaved).toFixed(2) 
                            : Number(stat.totalSaved).toFixed(2)
                        ) : '0.00'} 🐟币
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-muted-foreground">受益用户数</span>
                      <span className="text-lg font-medium">{stat.benefitedUsers} 人</span>
                    </div>
                  </div>

                  {(stat.startTime || stat.endTime) && (
                    <div className="pt-3 border-t space-y-1">
                      <div className="flex items-center gap-2 text-sm font-medium mb-2">
                        <Calendar className="h-4 w-4" />
                        定时设置
                      </div>
                      {stat.startTime && (
                        <p className="text-xs text-muted-foreground">
                          开始：{formatDateTime(stat.startTime)}
                        </p>
                      )}
                      {stat.endTime && (
                        <p className="text-xs text-muted-foreground">
                          结束：{formatDateTime(stat.endTime)}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>统计说明</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
              <p>• 使用次数：该等级用户享受折扣的总次数</p>
              <p>• 总节省金额：该等级用户通过折扣节省的🐟币总额</p>
              <p>• 受益用户数：使用过该等级折扣的不同用户数量（去重统计）</p>
              <p>• 统计数据实时更新，反映折扣系统的使用情况</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 叠加规则标签页 */}
        <TabsContent value="stacking" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>折扣叠加规则</CardTitle>
              <CardDescription>
                配置多种折扣类型（等级折扣、活动折扣、优惠券）的叠加方式
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>折扣叠加规则功能即将推出</p>
                <p className="text-sm mt-2">支持配置多种折扣的组合策略</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
