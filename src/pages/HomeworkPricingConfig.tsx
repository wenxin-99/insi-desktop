import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../lib/trpc";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Switch } from "../components/ui/switch";
import { useToast } from "../hooks/use-toast";
import { ArrowLeft, Save, DollarSign, GraduationCap } from "lucide-react";

export default function HomeworkPricingConfig({ embedded = false }: { embedded?: boolean }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    pricePerCorrection: string;
    useAdvancedModel: boolean;
  }>({ pricePerCorrection: "", useAdvancedModel: false });

  // 获取费用配置
  const { data: configs, isLoading, refetch } = trpc.homework.getPricingConfigs.useQuery();

  // 更新费用配置
  const updateMutation = trpc.homework.updatePricingConfig.useMutation({
    onSuccess: () => {
      toast({
        title: "保存成功",
        description: "费用配置已更新",
      });
      setEditingId(null);
      refetch();
    },
    onError: (error) => {
      toast({
        title: "保存失败",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = (config: any) => {
    setEditingId(config.gradeCategory);
    setEditValues({
      pricePerCorrection: config.pricePerCorrection,
      useAdvancedModel: config.useAdvancedModel,
    });
  };

  const handleSave = (gradeCategory: string) => {
    const price = parseFloat(editValues.pricePerCorrection);
    if (isNaN(price) || price < 0) {
      toast({
        title: "输入错误",
        description: "请输入有效的费用金额",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      gradeCategory,
      pricePerCorrection: price,
      useAdvancedModel: editValues.useAdvancedModel,
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({ pricePerCorrection: "", useAdvancedModel: false });
  };

  if (isLoading) {
    return (
      <div className={embedded ? "" : "container mx-auto py-8"}>
        {!embedded && (
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">作业批改费用配置</h1>
        </div>
        )}
        <div className="text-center text-muted-foreground py-12">加载中...</div>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto py-8 max-w-5xl"}>
      {/* 页面标题和返回按钮 - 仅独立模式 */}
      {!embedded && (
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-primary" />
            作业批改费用配置
          </h1>
          <p className="text-muted-foreground mt-1">
            管理不同年级的作业批改费用标准
          </p>
        </div>
      </div>
      )}

      {/* 配置说明卡片 */}
      <Card className="mb-6 border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <GraduationCap className="h-5 w-5" />
            配置说明
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>• 每次批改统一扣费，不受上传图片数量影响</p>
          <p>• 旗舰模型适用于高难度题目，提供更准确的批改结果</p>
          <p>• 修改费用后立即生效，影响所有新的批改请求</p>
        </CardContent>
      </Card>

      {/* 费用配置列表 */}
      <div className="grid gap-4">
        {configs?.map((config) => {
          const isEditing = editingId === config.gradeCategory;
          
          return (
            <Card key={config.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-xl">{config.gradeName}</CardTitle>
                    <CardDescription className="mt-1">{config.gradeRange}</CardDescription>
                  </div>
                  {!isEditing && (
                    <Button
                      variant="outline"
                      onClick={() => handleEdit(config)}
                    >
                      编辑
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* 费用配置 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor={`price-${config.gradeCategory}`}>
                      每次批改费用（🐟币）
                    </Label>
                    {isEditing ? (
                      <Input
                        id={`price-${config.gradeCategory}`}
                        type="number"
                        step="0.01"
                        min="0"
                        value={editValues.pricePerCorrection}
                        onChange={(e) =>
                          setEditValues({
                            ...editValues,
                            pricePerCorrection: e.target.value,
                          })
                        }
                        className="max-w-xs"
                      />
                    ) : (
                      <div className="text-2xl font-bold text-primary">
                        {config.pricePerCorrection} 🐟币
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`model-${config.gradeCategory}`}>
                      使用旗舰模型
                    </Label>
                    {isEditing ? (
                      <div className="flex items-center gap-2">
                        <Switch
                          id={`model-${config.gradeCategory}`}
                          checked={editValues.useAdvancedModel}
                          onCheckedChange={(checked) =>
                            setEditValues({
                              ...editValues,
                              useAdvancedModel: checked,
                            })
                          }
                        />
                        <span className="text-sm text-muted-foreground">
                          {editValues.useAdvancedModel ? "是" : "否"}
                        </span>
                      </div>
                    ) : (
                      <div className="text-lg font-semibold">
                        {config.useAdvancedModel ? (
                          <span className="text-green-600">✓ 是</span>
                        ) : (
                          <span className="text-muted-foreground">否</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* 编辑操作按钮 */}
                {isEditing && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      onClick={() => handleSave(config.gradeCategory)}
                      disabled={updateMutation.isPending}
                      className="gap-2"
                    >
                      <Save className="h-4 w-4" />
                      {updateMutation.isPending ? "保存中..." : "保存"}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCancel}
                      disabled={updateMutation.isPending}
                    >
                      取消
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
