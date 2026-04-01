import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Edit, Trash2, TestTube2, Coins } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

type ModelFormData = {
  name: string;
  displayName: string;
  description: string;
  type: "chat" | "image" | "text" | "transcription" | "video" | "tts" | "asr" | "vision" | "search";
  costPerUse: string;
  enabled: boolean;
  config: string;
  apiEndpoint: string;
  apiKey: string;
  apiModel: string;
};

const initialFormData: ModelFormData = {
  name: "",
  displayName: "",
  description: "",
  type: "chat",
  costPerUse: "1.00",
  enabled: true,
  config: "",
  apiEndpoint: "",
  apiKey: "",
  apiModel: "",
};

export default function AdminModels() {
  const { data: models, isLoading, refetch } = trpc.aiModel.adminGetAll.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingModel, setEditingModel] = useState<any>(null);
  const [formData, setFormData] = useState<ModelFormData>(initialFormData);
  const [testDialogOpen, setTestDialogOpen] = useState(false);
  const [testingModel, setTestingModel] = useState<any>(null);
  const [testInput, setTestInput] = useState("");

  const createMutation = trpc.aiModel.create.useMutation({
    onSuccess: () => {
      toast.success("模型创建成功");
      setDialogOpen(false);
      setFormData(initialFormData);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "模型创建失败");
    },
  });

  const updateMutation = trpc.aiModel.update.useMutation({
    onSuccess: () => {
      toast.success("模型更新成功");
      setDialogOpen(false);
      setEditingModel(null);
      setFormData(initialFormData);
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "模型更新失败");
    },
  });

  const deleteMutation = trpc.aiModel.delete.useMutation({
    onSuccess: () => {
      toast.success("模型删除成功");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "模型删除失败");
    },
  });

  const testMutation = trpc.aiModel.test.useMutation({
    onSuccess: (data) => {
      toast.success(data.message);
      setTestDialogOpen(false);
      setTestInput("");
    },
    onError: (error) => {
      toast.error(error.message || "模型测试失败");
    },
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.displayName || !formData.costPerUse) {
      toast.error("请填写所有必填字段");
      return;
    }

    const cost = parseFloat(formData.costPerUse);
    if (isNaN(cost) || cost < 0) {
      toast.error("请输入有效的消耗金额");
      return;
    }

    if (editingModel) {
      updateMutation.mutate({
        id: editingModel.id,
        ...formData,
      });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleEdit = (model: any) => {
    setEditingModel(model);
    setFormData({
      name: model.name,
      displayName: model.displayName,
      description: model.description || "",
      type: model.type,
      costPerUse: model.costPerUse,
      enabled: model.enabled,
      config: model.config || "",
      apiEndpoint: model.apiEndpoint || "",
      apiKey: model.apiKey || "",
      apiModel: model.apiModel || "",
    });
    setDialogOpen(true);
  };

  const handleDelete = (modelId: number) => {
    if (confirm("确定要删除这个模型吗？")) {
      deleteMutation.mutate({ id: modelId });
    }
  };

  const handleTest = () => {
    if (!testInput) {
      toast.error("请输入测试内容");
      return;
    }

    testMutation.mutate({
      id: testingModel.id,
    });
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      chat: "对话",
      image: "图片生成",
      text: "文本处理",
      transcription: "语音转文字",
      video: "视频生成",
      tts: "语音合成",
      asr: "语音识别",
      vision: "视觉理解",
      search: "搜索API",
    };
    return labels[type] || type;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">AI模型管理</h1>
          <p className="text-muted-foreground mt-2">管理AI模型配置和消耗规则</p>
        </div>
        <Dialog
          open={dialogOpen}
          onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingModel(null);
              setFormData(initialFormData);
            }
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              添加模型
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingModel ? "编辑模型" : "添加新模型"}</DialogTitle>
              <DialogDescription>配置AI模型的基本信息和消耗规则</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4 max-h-[60vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">模型标识 *</Label>
                  <Input
                    id="name"
                    placeholder="例如: gpt-4"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">显示名称 *</Label>
                  <Input
                    id="displayName"
                    placeholder="例如: GPT-4"
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  placeholder="模型描述信息"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="type">模型类型 *</Label>
                  <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chat">对话</SelectItem>
                      <SelectItem value="image">图片生成</SelectItem>
                      <SelectItem value="video">视频生成</SelectItem>
                      <SelectItem value="vision">视觉理解</SelectItem>
                      <SelectItem value="tts">语音合成</SelectItem>
                      <SelectItem value="asr">语音识别</SelectItem>
                      <SelectItem value="search">搜索API（如 Tavily）</SelectItem>
                      <SelectItem value="text">文本处理</SelectItem>
                      <SelectItem value="transcription">语音转文字（旧）</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="costPerUse">每次消耗🐟币 *</Label>
                  <Input
                    id="costPerUse"
                    type="number"
                    step="0.01"
                    placeholder="1.00"
                    value={formData.costPerUse}
                    onChange={(e) => setFormData({ ...formData, costPerUse: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="config">配置 (JSON)</Label>
                <Textarea
                  id="config"
                  placeholder='{"temperature": 0.7}'
                  value={formData.config}
                  onChange={(e) => setFormData({ ...formData, config: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="space-y-4 border-t pt-4">
                <h4 className="text-sm font-medium">API配置</h4>
                <div className="space-y-2">
                  <Label htmlFor="model-api-endpoint">API端点</Label>
                  <Input
                    id="model-api-endpoint"
                    name="model_api_endpoint"
                    autoComplete="off"
                    data-1p-ignore
                    data-lpignore="true"
                    placeholder="https://api.deepseek.com"
                    value={formData.apiEndpoint}
                    onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-api-key">API密钥</Label>
                  <Input
                    id="model-api-key"
                    name="model_api_key"
                    type="password"
                    autoComplete="new-password"
                    data-1p-ignore
                    data-lpignore="true"
                    placeholder="sk-..."
                    value={formData.apiKey}
                    onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model-api-model">模型标识符</Label>
                  <Input
                    id="model-api-model"
                    name="model_api_model"
                    autoComplete="off"
                    placeholder="如 gpt-4-turbo、tavily-search（API 请求中的 model 参数）"
                    value={formData.apiModel}
                    onChange={(e) => setFormData({ ...formData, apiModel: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="enabled"
                  checked={formData.enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                />
                <Label htmlFor="enabled">启用模型</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingModel ? "更新" : "创建"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>模型列表</CardTitle>
          <CardDescription>共 {models?.length || 0} 个模型</CardDescription>
        </CardHeader>
        <CardContent>
          {/* 桌面端表格视图 */}
          <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>显示名称</TableHead>
                  <TableHead>类型</TableHead>
                  <TableHead>消耗</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>创建时间</TableHead>
                  <TableHead>操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
              {models?.map((model) => (
                <TableRow key={model.id}>
                  <TableCell>{model.id}</TableCell>
                  <TableCell className="font-medium">{model.displayName}</TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {getTypeLabel(model.type)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold">{model.costPerUse}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {model.enabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        启用
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                        禁用
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{new Date(model.createdAt).toLocaleDateString("zh-CN")}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" onClick={() => {
                        setTestingModel(model);
                        setTestDialogOpen(true);
                      }}>
                        <TestTube2 className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => handleEdit(model)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(model.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              </TableBody>
            </Table>
          </div>

          {/* 移动端卡片视图 */}
          <div className="md:hidden space-y-4">
            {models?.map((model) => (
              <Card key={model.id}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h3 className="font-semibold text-lg">{model.displayName}</h3>
                      <p className="text-sm text-muted-foreground">{model.name}</p>
                    </div>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      {getTypeLabel(model.type)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-1">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold">{model.costPerUse} 鱼币</span>
                    </div>
                    {model.enabled ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                        启用
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                        禁用
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 pt-3 border-t">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => {
                      setTestingModel(model);
                      setTestDialogOpen(true);
                    }}>
                      <TestTube2 className="h-4 w-4 mr-1" />
                      测试
                    </Button>
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => handleEdit(model)}>
                      <Edit className="h-4 w-4 mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(model.id)}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      <Dialog open={testDialogOpen} onOpenChange={setTestDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>测试模型</DialogTitle>
            <DialogDescription>
              测试模型 {testingModel?.displayName} 的功能
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="testInput">测试输入</Label>
              <Textarea
                id="testInput"
                placeholder="输入测试内容..."
                value={testInput}
                onChange={(e) => setTestInput(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleTest} disabled={testMutation.isPending}>
              {testMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              测试
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      </div>
    </DashboardLayout>
  );
}
