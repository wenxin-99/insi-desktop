import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Crown, Save, RefreshCw } from "lucide-react";
import { useState } from "react";
import { safeToast } from "@/lib/safeToast";

export default function ForumBenefitsManagement() {
  const { data: benefits, refetch, isLoading } = trpc.forumBenefits.getAll.useQuery();
  const updateBenefit = trpc.forumBenefits.update.useMutation();

  const [editingLevel, setEditingLevel] = useState<number | null>(null);
  const [formData, setFormData] = useState<{
    levelName: string;
    chatDiscount: number;
    imageDiscount: number;
    documentDiscount: number;
  }>({
    levelName: "",
    chatDiscount: 0,
    imageDiscount: 0,
    documentDiscount: 0,
  });

  const handleEdit = (benefit: any) => {
    setEditingLevel(benefit.trustLevel);
    setFormData({
      levelName: benefit.levelName,
      chatDiscount: benefit.chatDiscount,
      imageDiscount: benefit.imageDiscount,
      documentDiscount: benefit.documentDiscount,
    });
  };

  const handleSave = async () => {
    if (editingLevel === null) return;

    try {
      await updateBenefit.mutateAsync({
        trustLevel: editingLevel,
        levelName: formData.levelName,
        chatDiscount: formData.chatDiscount,
        imageDiscount: formData.imageDiscount,
        documentDiscount: formData.documentDiscount,
      });

      safeToast.success(`等级 ${editingLevel} 的权益配置已更新`);
      setEditingLevel(null);
      refetch();
    } catch (error: any) {
      safeToast.error(error.message || "保存失败：未知错误");
    }
  };

  const handleCancel = () => {
    setEditingLevel(null);
    setFormData({
      levelName: "",
      chatDiscount: 0,
      imageDiscount: 0,
      documentDiscount: 0,
    });
  };

  const getLevelColor = (level: number) => {
    if (level === 0) return "text-gray-500 bg-gray-50 dark:bg-gray-950";
    if (level <= 3) return "text-blue-500 bg-blue-50 dark:bg-blue-950";
    if (level <= 6) return "text-purple-500 bg-purple-50 dark:bg-purple-950";
    return "text-amber-500 bg-amber-50 dark:bg-amber-950";
  };

  const getSpecialBenefits = (level: number) => {
    const benefits: string[] = [];
    if (level >= 4) benefits.push("优先队列");
    if (level >= 6) benefits.push("新模型优先体验");
    if (level >= 8) benefits.push("专属客服");
    if (level === 9) benefits.push("所有功能VIP待遇");
    return benefits;
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Crown className="h-8 w-8 text-amber-500" />
            论坛等级权益管理
          </h1>
          <p className="text-muted-foreground mt-2">
            配置不同论坛等级的Insi功能折扣和特殊权益
          </p>
        </div>

        {/* 权益配置列表 */}
        <div className="grid gap-4">
          {benefits?.map((benefit) => (
            <Card key={benefit.trustLevel} className={getLevelColor(benefit.trustLevel)}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-background/50 flex items-center justify-center font-bold text-lg">
                      {benefit.trustLevel}
                    </div>
                    <div>
                      <p className="text-xl">{benefit.levelName}</p>
                      <p className="text-sm font-normal text-muted-foreground">
                        等级 {benefit.trustLevel}
                      </p>
                    </div>
                  </div>
                  {editingLevel !== benefit.trustLevel && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(benefit)}
                    >
                      编辑
                    </Button>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {editingLevel === benefit.trustLevel ? (
                  <div className="space-y-4">
                    {/* 编辑表单 */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>等级名称</Label>
                        <Input
                          value={formData.levelName}
                          onChange={(e) =>
                            setFormData({ ...formData, levelName: e.target.value })
                          }
                          placeholder="例如：新手、资深用户"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>Insi对话折扣 (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.chatDiscount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              chatDiscount: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>图片生成折扣 (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.imageDiscount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              imageDiscount: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>文档处理折扣 (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={formData.documentDiscount}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              documentDiscount: parseInt(e.target.value) || 0,
                            })
                          }
                        />
                      </div>
                    </div>

                    {/* 特殊权益提示 */}
                    <div className="p-3 rounded-lg bg-background border">
                      <p className="text-sm font-medium mb-2">自动特殊权益：</p>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        {getSpecialBenefits(benefit.trustLevel).map((b, i) => (
                          <li key={i}>• {b}</li>
                        ))}
                        {getSpecialBenefits(benefit.trustLevel).length === 0 && (
                          <li className="text-muted-foreground/50">无特殊权益</li>
                        )}
                      </ul>
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSave}
                        disabled={updateBenefit.isPending}
                      >
                        <Save className="mr-2 h-4 w-4" />
                        {updateBenefit.isPending ? "保存中..." : "保存"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleCancel}
                        disabled={updateBenefit.isPending}
                      >
                        取消
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-3 gap-4">
                    {/* 显示模式 */}
                    <div className="p-3 rounded-lg bg-background border text-center">
                      <p className="text-sm text-muted-foreground mb-1">Insi对话折扣</p>
                      <p className="text-2xl font-bold">{benefit.chatDiscount}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background border text-center">
                      <p className="text-sm text-muted-foreground mb-1">图片生成折扣</p>
                      <p className="text-2xl font-bold">{benefit.imageDiscount}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background border text-center">
                      <p className="text-sm text-muted-foreground mb-1">文档处理折扣</p>
                      <p className="text-2xl font-bold">{benefit.documentDiscount}%</p>
                    </div>

                    {/* 特殊权益 */}
                    {getSpecialBenefits(benefit.trustLevel).length > 0 && (
                      <div className="col-span-3 p-3 rounded-lg bg-background border">
                        <p className="text-sm font-medium mb-2">特殊权益：</p>
                        <div className="flex flex-wrap gap-2">
                          {getSpecialBenefits(benefit.trustLevel).map((b, i) => (
                            <span
                              key={i}
                              className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm"
                            >
                              {b}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* 说明卡片 */}
        <Card>
          <CardHeader>
            <CardTitle>配置说明</CardTitle>
            <CardDescription>关于论坛等级权益系统的说明</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              • <strong>折扣百分比：</strong>用户实际支付 = 原价 × (1 - 折扣率)，例如20%折扣表示只需支付原价的80%
            </p>
            <p>
              • <strong>等级同步：</strong>用户的论坛等级会在每次登录时自动同步到Insi平台
            </p>
            <p>
              • <strong>特殊权益：</strong>等级4+享有优先队列，等级6+可优先体验新模型，等级8+享有专属客服
            </p>
            <p>
              • <strong>激励机制：</strong>鼓励用户在论坛积极活跃以提升等级，从而获得更高的Insi功能折扣
            </p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
