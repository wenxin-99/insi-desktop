import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Textarea } from "../../components/ui/textarea";
import { useToast } from "../../hooks/use-toast";
import { ArrowLeft, Save, Image, DollarSign, Info } from "lucide-react";

export default function ImageGenerationPricing({ embedded = false }: { embedded?: boolean }) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    pricePerImage: "",
    displayName: "",
    description: "",
    enabled: true,
  });

  // 获取配置
  const { data: config, isLoading, refetch } = trpc.imageGenerationPricing.getConfig.useQuery();

  // 更新配置
  const updateMutation = trpc.imageGenerationPricing.updateConfig.useMutation({
    onSuccess: () => {
      toast({
        title: "保存成功",
        description: "图片生成费用配置已更新",
      });
      setIsEditing(false);
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

  const handleEdit = () => {
    if (config) {
      setEditValues({
        pricePerImage: config.pricePerImage,
        displayName: config.displayName,
        description: config.description || "",
        enabled: config.enabled,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    const price = parseFloat(editValues.pricePerImage);
    if (isNaN(price) || price < 0) {
      toast({
        title: "输入错误",
        description: "请输入有效的费用金额（不能为负数）",
        variant: "destructive",
      });
      return;
    }

    if (!editValues.displayName.trim()) {
      toast({
        title: "输入错误",
        description: "请输入显示名称",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      pricePerImage: price,
      displayName: editValues.displayName.trim(),
      description: editValues.description.trim() || undefined,
      enabled: editValues.enabled,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValues({
      pricePerImage: "",
      displayName: "",
      description: "",
      enabled: true,
    });
  };

  if (isLoading) {
    return (
      <div className={embedded ? "" : "container mx-auto py-8"}>
        {!embedded && (
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">图片生成费用配置</h1>
        </div>
        )}
        <div className="text-center text-muted-foreground py-12">加载中...</div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className={embedded ? "" : "container mx-auto py-8"}>
        {!embedded && (
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">图片生成费用配置</h1>
        </div>
        )}
        <div className="text-center text-muted-foreground py-12">配置不存在</div>
      </div>
    );
  }

  return (
    <div className={embedded ? "space-y-6" : "container mx-auto py-8 max-w-4xl"}>
      {/* 页面标题和返回按钮 - 仅独立模式 */}
      {!embedded && (
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Image className="h-8 w-8 text-primary" />
            图片生成费用配置
          </h1>
          <p className="text-muted-foreground mt-1">
            管理AI图片生成功能的收费标准
          </p>
        </div>
      </div>
      )}

      {/* 说明卡片 */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">配置说明</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>图片生成费用独立于聊天模型费用，不受用户选择的套餐影响</li>
                <li>用户等级折扣仍然适用于图片生成（VIP用户可享受折扣）</li>
                <li>修改费用后立即生效，影响所有后续的图片生成请求</li>
                <li>禁用后，用户将无法使用图片生成功能</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 配置卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                {isEditing ? "编辑配置" : "当前配置"}
              </CardTitle>
              <CardDescription>
                {isEditing ? "修改图片生成的收费标准" : "查看当前的图片生成费用设置"}
              </CardDescription>
            </div>
            {!isEditing && (
              <Button onClick={handleEdit}>
                编辑配置
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {isEditing ? (
            <>
              {/* 编辑模式 */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="displayName">显示名称</Label>
                  <Input
                    id="displayName"
                    value={editValues.displayName}
                    onChange={(e) =>
                      setEditValues({ ...editValues, displayName: e.target.value })
                    }
                    placeholder="例如：标准图片生成"
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="pricePerImage">
                    每张图片费用（🐟币）
                  </Label>
                  <Input
                    id="pricePerImage"
                    type="number"
                    min="0"
                    step="0.01"
                    value={editValues.pricePerImage}
                    onChange={(e) =>
                      setEditValues({ ...editValues, pricePerImage: e.target.value })
                    }
                    placeholder="例如：5.00"
                  />
                  <p className="text-xs text-muted-foreground">
                    建议设置在 3-10 🐟币之间，过高可能影响用户使用意愿
                  </p>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="description">描述（可选）</Label>
                  <Textarea
                    id="description"
                    value={editValues.description}
                    onChange={(e) =>
                      setEditValues({ ...editValues, description: e.target.value })
                    }
                    placeholder="例如：每生成一张图片收费5🐟币"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-0.5">
                    <Label>启用状态</Label>
                    <p className="text-sm text-muted-foreground">
                      禁用后用户将无法使用图片生成功能
                    </p>
                  </div>
                  <Switch
                    checked={editValues.enabled}
                    onCheckedChange={(checked) =>
                      setEditValues({ ...editValues, enabled: checked })
                    }
                  />
                </div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-4">
                <Button
                  onClick={handleSave}
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {updateMutation.isPending ? "保存中..." : "保存配置"}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleCancel}
                  disabled={updateMutation.isPending}
                  className="flex-1"
                >
                  取消
                </Button>
              </div>
            </>
          ) : (
            <>
              {/* 查看模式 */}
              <div className="space-y-4">
                <div className="grid gap-2">
                  <Label className="text-muted-foreground">显示名称</Label>
                  <div className="text-lg font-medium">{config.displayName}</div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground">每张图片费用</Label>
                  <div className="text-2xl font-bold text-primary">
                    {config.pricePerImage} 🐟币
                  </div>
                </div>

                {config.description && (
                  <div className="grid gap-2">
                    <Label className="text-muted-foreground">描述</Label>
                    <div className="text-sm">{config.description}</div>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label className="text-muted-foreground">启用状态</Label>
                  <div className="flex items-center gap-2">
                    <div
                      className={`h-2 w-2 rounded-full ${
                        config.enabled ? "bg-green-500" : "bg-gray-400"
                      }`}
                    />
                    <span className={config.enabled ? "text-green-600" : "text-gray-500"}>
                      {config.enabled ? "已启用" : "已禁用"}
                    </span>
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label className="text-muted-foreground">最后更新时间</Label>
                  <div className="text-sm">
                    {new Date(config.updatedAt).toLocaleString("zh-CN")}
                  </div>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* 费用计算示例 */}
      {!isEditing && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-lg">费用计算示例</CardTitle>
            <CardDescription>不同用户等级的实际扣费金额</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">免费用户</div>
                  <div className="text-sm text-muted-foreground">无折扣</div>
                </div>
                <div className="text-lg font-bold">{config.pricePerImage} 🐟币</div>
              </div>
              <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="font-medium">VIP用户</div>
                  <div className="text-sm text-muted-foreground">9折优惠</div>
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {(parseFloat(config.pricePerImage) * 0.9).toFixed(2)} 🐟币
                </div>
              </div>
              <div className="flex justify-between items-center p-3 bg-purple-50 rounded-lg">
                <div>
                  <div className="font-medium">高级VIP用户</div>
                  <div className="text-sm text-muted-foreground">8折优惠</div>
                </div>
                <div className="text-lg font-bold text-purple-600">
                  {(parseFloat(config.pricePerImage) * 0.8).toFixed(2)} 🐟币
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
