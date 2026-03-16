import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "../../lib/trpc";
import { Button } from "../../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Switch } from "../../components/ui/switch";
import { Slider } from "../../components/ui/slider";
import { useToast } from "../../hooks/use-toast";
import { ArrowLeft, Save, FileText, Info } from "lucide-react";

export default function PDFWatermarkConfig() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editValues, setEditValues] = useState({
    watermarkText: "",
    opacity: 0.1,
    rotation: -45,
    fontSize: 60,
    color: "#000000",
    enabled: true,
  });

  // 获取配置
  const { data: config, isLoading, isError, error: queryError, refetch } = trpc.pdfWatermarkConfig.getConfig.useQuery();

  // 更新配置
  const updateMutation = trpc.pdfWatermarkConfig.updateConfig.useMutation({
    onSuccess: () => {
      toast({
        title: "保存成功",
        description: "PDF水印配置已更新",
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
        watermarkText: config.watermarkText,
        opacity: parseFloat(config.opacity),
        rotation: config.rotation,
        fontSize: config.fontSize,
        color: config.color,
        enabled: config.enabled,
      });
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (!editValues.watermarkText.trim()) {
      toast({
        title: "输入错误",
        description: "请输入水印文字",
        variant: "destructive",
      });
      return;
    }

    if (editValues.fontSize < 10 || editValues.fontSize > 200) {
      toast({
        title: "输入错误",
        description: "字体大小必须在10-200之间",
        variant: "destructive",
      });
      return;
    }

    updateMutation.mutate({
      watermarkText: editValues.watermarkText.trim(),
      opacity: editValues.opacity,
      rotation: editValues.rotation,
      fontSize: editValues.fontSize,
      color: editValues.color,
      enabled: editValues.enabled,
    });
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditValues({
      watermarkText: "",
      opacity: 0.1,
      rotation: -45,
      fontSize: 60,
      color: "#000000",
      enabled: true,
    });
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">PDF水印配置</h1>
        </div>
        <div className="text-center text-muted-foreground py-12">加载中...</div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">PDF水印配置</h1>
        </div>
        <div className="text-center py-12 space-y-3">
          <p className="text-destructive">加载失败：{(queryError as any)?.message || '未知错误'}</p>
          <Button variant="outline" onClick={() => refetch()}>重新加载</Button>
        </div>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">PDF水印配置</h1>
        </div>
        <div className="text-center py-12 space-y-3">
          <p className="text-muted-foreground">尚未初始化水印配置</p>
          <Button onClick={() => refetch()}>重新加载</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 max-w-4xl">
      {/* 页面标题和返回按钮 */}
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate("/admin")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8 text-primary" />
            PDF水印配置
          </h1>
          <p className="text-muted-foreground mt-1">
            自定义作业批改报告PDF的水印样式
          </p>
        </div>
      </div>

      {/* 说明卡片 */}
      <Card className="mb-6 border-blue-200 bg-blue-50/50">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-900">
              <p className="font-medium mb-1">配置说明</p>
              <ul className="list-disc list-inside space-y-1 text-blue-800">
                <li>水印将显示在所有PDF批改报告的每一页上</li>
                <li>透明度范围：0（完全透明）到 1（完全不透明），建议0.05-0.15</li>
                <li>旋转角度：-180° 到 180°，负数为逆时针旋转</li>
                <li>字体大小：10-200，建议40-80之间</li>
                <li>禁用水印后，新生成的PDF将不显示水印</li>
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
              <CardTitle>水印配置</CardTitle>
              <CardDescription>自定义PDF水印的文字、样式和显示效果</CardDescription>
            </div>
            {!isEditing && (
              <Button onClick={handleEdit}>编辑配置</Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 水印文字 */}
          <div className="space-y-2">
            <Label htmlFor="watermarkText">水印文字</Label>
            <Input
              id="watermarkText"
              value={isEditing ? editValues.watermarkText : config.watermarkText}
              onChange={(e) => setEditValues({ ...editValues, watermarkText: e.target.value })}
              disabled={!isEditing}
              placeholder="例如：仅供学习使用"
            />
          </div>

          {/* 透明度 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="opacity">透明度</Label>
              <span className="text-sm text-muted-foreground">
                {isEditing ? editValues.opacity.toFixed(2) : parseFloat(config.opacity).toFixed(2)}
              </span>
            </div>
            <Slider
              id="opacity"
              min={0}
              max={1}
              step={0.01}
              value={[isEditing ? editValues.opacity : parseFloat(config.opacity)]}
              onValueChange={([value]) => setEditValues({ ...editValues, opacity: value })}
              disabled={!isEditing}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              建议值：0.05-0.15，过高会影响PDF内容可读性
            </p>
          </div>

          {/* 旋转角度 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="rotation">旋转角度</Label>
              <span className="text-sm text-muted-foreground">
                {isEditing ? editValues.rotation : config.rotation}°
              </span>
            </div>
            <Slider
              id="rotation"
              min={-180}
              max={180}
              step={1}
              value={[isEditing ? editValues.rotation : config.rotation]}
              onValueChange={([value]) => setEditValues({ ...editValues, rotation: value })}
              disabled={!isEditing}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              -45° 为常见的斜向水印样式
            </p>
          </div>

          {/* 字体大小 */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label htmlFor="fontSize">字体大小</Label>
              <span className="text-sm text-muted-foreground">
                {isEditing ? editValues.fontSize : config.fontSize}px
              </span>
            </div>
            <Slider
              id="fontSize"
              min={10}
              max={200}
              step={1}
              value={[isEditing ? editValues.fontSize : config.fontSize]}
              onValueChange={([value]) => setEditValues({ ...editValues, fontSize: value })}
              disabled={!isEditing}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              建议值：40-80，根据水印文字长度调整
            </p>
          </div>

          {/* 颜色 */}
          <div className="space-y-2">
            <Label htmlFor="color">颜色</Label>
            <div className="flex gap-3 items-center">
              <Input
                id="color"
                type="color"
                value={isEditing ? editValues.color : config.color}
                onChange={(e) => setEditValues({ ...editValues, color: e.target.value })}
                disabled={!isEditing}
                className="w-20 h-10"
              />
              <Input
                value={isEditing ? editValues.color : config.color}
                onChange={(e) => setEditValues({ ...editValues, color: e.target.value })}
                disabled={!isEditing}
                placeholder="#000000"
                className="flex-1"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              深色（如黑色#000000）或浅色（如灰色#808080）都可以，配合透明度使用
            </p>
          </div>

          {/* 启用状态 */}
          <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
            <div>
              <Label htmlFor="enabled" className="text-base">启用水印</Label>
              <p className="text-sm text-muted-foreground mt-1">
                关闭后，新生成的PDF将不显示水印
              </p>
            </div>
            <Switch
              id="enabled"
              checked={isEditing ? editValues.enabled : config.enabled}
              onCheckedChange={(checked) => setEditValues({ ...editValues, enabled: checked })}
              disabled={!isEditing}
            />
          </div>

          {/* 水印预览 */}
          <div className="space-y-2">
            <Label>水印预览</Label>
            <div className="relative w-full h-48 bg-white border-2 border-dashed border-gray-300 rounded-lg overflow-hidden">
              <div className="absolute inset-0 flex items-center justify-center">
                <p className="text-gray-400 text-sm">PDF内容区域</p>
              </div>
              {(isEditing ? editValues.enabled : config.enabled) && (
                <div
                  className="absolute inset-0 flex items-center justify-center pointer-events-none"
                  style={{
                    transform: `rotate(${isEditing ? editValues.rotation : config.rotation}deg)`,
                  }}
                >
                  <span
                    style={{
                      fontSize: `${(isEditing ? editValues.fontSize : config.fontSize) / 3}px`,
                      color: isEditing ? editValues.color : config.color,
                      opacity: isEditing ? editValues.opacity : parseFloat(config.opacity),
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {isEditing ? editValues.watermarkText : config.watermarkText}
                  </span>
                </div>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              实际PDF中的水印会根据页面大小自动调整位置和比例
            </p>
          </div>

          {/* 操作按钮 */}
          {isEditing && (
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
