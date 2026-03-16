import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, Save, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function VideoApiConfig() {
  const [showApiKey, setShowApiKey] = useState<{ [key: number]: boolean }>({});
  const [editingConfig, setEditingConfig] = useState<any>(null);

  // 获取所有API配置
  const { data: configs, isLoading, refetch } = trpc.videos.getApiConfigs.useQuery();
  // 创建/更新API配置
  const saveMutation = trpc.videos.saveApiConfig.useMutation({
    onSuccess: () => {
      refetch();
      setEditingConfig(null);
      toast.success("API配置创建成功");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });



  // 删除API配置（暂无此API，使用saveApiConfig的isEnabled=false代替）
  const deleteMutation = { mutate: (data: any) => {
    saveMutation.mutate({ ...data, isEnabled: false });
  } };
  
  const deleteMutationOld = trpc.videos.saveApiConfig.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("API配置删除成功");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const handleSave = () => {
    if (!editingConfig) return;

    const data = {
      provider: editingConfig.provider,
      apiKey: editingConfig.apiKey,
      apiEndpoint: editingConfig.apiEndpoint || undefined,
      cost5s: parseFloat(editingConfig.cost5s) || 30,
      cost10s: parseFloat(editingConfig.cost10s) || 50,
      description: editingConfig.description || undefined,
      isEnabled: editingConfig.isEnabled ?? true,
    };

    // saveApiConfig同时用于创建和更新，不需要configId
    saveMutation.mutate(data);
  };

  return (
    <DashboardLayout>
      <div className="container py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">视频API配置</h1>
            <p className="text-muted-foreground mt-1">
              管理视频生成服务商的API密钥和费用设置
            </p>
          </div>

          <Button
            onClick={() =>
              setEditingConfig({
                provider: "runway",
                apiKey: "",
                apiEndpoint: "",
                cost5s: "30",
                cost10s: "50",
                description: "",
                isEnabled: true,
              })
            }
          >
            <Plus className="w-4 h-4 mr-2" />
            添加配置
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="grid gap-4">
            {configs?.map((config: any) => (
              <Card key={config.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="capitalize">{config.provider}</CardTitle>
                      <CardDescription>
                        5秒:{(config as any).cost5s}鱼币 · 10秒:{(config as any).cost10s}鱼币 ·{" "}
                        {config.isEnabled ? (
                          <span className="text-green-600">已启用</span>
                        ) : (
                          <span className="text-gray-500">已禁用</span>
                        )}
                        {config.description && ` · ${config.description}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setEditingConfig(config)}
                      >
                        编辑
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm("确定要删除这个API配置吗？")) {
                            deleteMutation.mutate({ configId: config.id });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label className="text-xs text-muted-foreground">API Endpoint</Label>
                      <p className="text-sm mt-1 font-mono">
                        {config.apiEndpoint || "默认"}
                      </p>
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">API Key</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <p className="text-sm font-mono flex-1 truncate">
                          {showApiKey[config.id]
                            ? config.apiKey
                            : `${config.apiKey.substring(0, 10)}...`}
                        </p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            setShowApiKey((prev) => ({
                              ...prev,
                              [config.id]: !prev[config.id],
                            }))
                          }
                        >
                          {showApiKey[config.id] ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}

            {configs?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                还没有配置任何API，点击"添加配置"开始
              </div>
            )}
          </div>
        )}

        {/* 编辑对话框 */}
        {editingConfig && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
              <CardHeader>
                <CardTitle>
                  {editingConfig.id ? "编辑API配置" : "添加API配置"}
                </CardTitle>
                <CardDescription>
                  配置视频生成服务商的API密钥和费用设置
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4">
                <div>
                  <Label htmlFor="provider">服务商</Label>
                  <Select
                    value={editingConfig.provider}
                    onValueChange={(value) =>
                      setEditingConfig({ ...editingConfig, provider: value })
                    }
                  >
                    <SelectTrigger id="provider">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="runway">Runway ML</SelectItem>
                      <SelectItem value="luma">Luma Dream Machine</SelectItem>
                      <SelectItem value="pika">Pika Labs</SelectItem>
                      <SelectItem value="mock">模拟模式（测试）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={editingConfig.apiKey}
                    onChange={(e) =>
                      setEditingConfig({ ...editingConfig, apiKey: e.target.value })
                    }
                    placeholder="输入API密钥"
                  />
                </div>

                <div>
                  <Label htmlFor="apiEndpoint">API Endpoint（可选）</Label>
                  <Input
                    id="apiEndpoint"
                    value={editingConfig.apiEndpoint || ""}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        apiEndpoint: e.target.value,
                      })
                    }
                    placeholder="留空使用默认端点"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="cost5s">5秒视频费用（鱼币）</Label>
                    <Input
                      id="cost5s"
                      type="number"
                      step="0.1"
                      value={editingConfig.cost5s}
                      onChange={(e) =>
                        setEditingConfig({
                          ...editingConfig,
                          cost5s: e.target.value,
                        })
                      }
                      placeholder="5秒视频成本"
                    />
                  </div>
                  <div>
                    <Label htmlFor="cost10s">10秒视频费用（鱼币）</Label>
                    <Input
                      id="cost10s"
                      type="number"
                      step="0.1"
                      value={editingConfig.cost10s}
                      onChange={(e) =>
                        setEditingConfig({
                          ...editingConfig,
                          cost10s: e.target.value,
                        })
                      }
                      placeholder="10秒视频成本"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="description">配置说明（可选）</Label>
                  <Input
                    id="description"
                    value={editingConfig.description || ""}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        description: e.target.value,
                      })
                    }
                    placeholder="例：适用于短视频生成"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="isEnabled"
                    checked={editingConfig.isEnabled}
                    onChange={(e) =>
                      setEditingConfig({
                        ...editingConfig,
                        isEnabled: e.target.checked,
                      })
                    }
                    className="w-4 h-4"
                  />
                  <Label htmlFor="isEnabled">启用此配置</Label>
                </div>

                <div className="flex gap-2 justify-end mt-4">
                  <Button
                    variant="outline"
                    onClick={() => setEditingConfig(null)}
                  >
                    取消
                  </Button>
                  <Button
                    onClick={handleSave}
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    <Save className="w-4 h-4 mr-2" />
                    保存
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
