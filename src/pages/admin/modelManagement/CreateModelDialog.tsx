/**
 * modelManagement/CreateModelDialog — 新建模型对话框
 *
 * ★ 改动：集成 CapabilitiesEditor，替代 supportsVision 开关；type Select 加入 embedding/rerank
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Plus, FileCode } from "lucide-react";
import { MODEL_TEMPLATES, getTemplateById, getAllProviders } from "@shared/modelTemplates";
import { ImageProviderSelect } from "./ImageProviderSelect";
import { VideoCostFields } from "./VideoCostFields";
import { CapabilitiesEditor } from "./CapabilitiesEditor";
import type { ModelFormData } from "./types";

interface CreateModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: ModelFormData;
  setFormData: (updater: ModelFormData | ((prev: ModelFormData) => ModelFormData)) => void;
  selectedTemplate: string;
  onTemplateSelect: (templateId: string) => void;
  onCreate: () => void;
  isPending: boolean;
}

export function CreateModelDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  selectedTemplate,
  onTemplateSelect,
  onCreate,
  isPending,
}: CreateModelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          添加模型
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>添加新模型</DialogTitle>
          <DialogDescription>配置新的AI模型</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* 模板选择 */}
          <div className="border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-3">
              <FileCode className="h-4 w-4 text-primary" />
              <Label className="text-base font-semibold">快速配置模板</Label>
            </div>
            <Select value={selectedTemplate} onValueChange={onTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="选择一个预设模板（可选）" />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                <SelectItem value="none">不使用模板</SelectItem>
                {getAllProviders().map(provider => (
                  <div key={provider}>
                    <div className="px-2 py-1.5 text-sm font-semibold text-muted-foreground">{provider}</div>
                    {MODEL_TEMPLATES.filter(t => t.provider === provider).map(template => (
                      <SelectItem key={template.id} value={template.id}>
                        <div className="flex items-center justify-between w-full">
                          <span>{template.name}</span>
                          <span className="text-xs text-muted-foreground ml-2">
                            {template.tier.toUpperCase()}
                            {template.supportsVision && " | 👁️"}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </div>
                ))}
              </SelectContent>
            </Select>
            {selectedTemplate && selectedTemplate !== "none" && (
              <div className="mt-2 text-sm text-muted-foreground">
                <p>💡 {getTemplateById(selectedTemplate)?.notes}</p>
              </div>
            )}
          </div>

          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>模型名称</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, name: e.target.value }))}
                placeholder="例如: qwen-max"
              />
            </div>
            <div>
              <Label>显示名称</Label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, displayName: e.target.value }))}
                placeholder="例如: 通义千问 Max"
              />
            </div>
          </div>

          <div>
            <Label>模型描述</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, description: e.target.value }))}
              placeholder="简要描述模型的特点和用途"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label>模型类型</Label>
              <Select value={formData.type} onValueChange={(value: any) => setFormData((prev: ModelFormData) => ({ ...prev, type: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="chat">💬 对话/推理</SelectItem>
                  <SelectItem value="image">🎨 图片生成</SelectItem>
                  <SelectItem value="video">🎬 视频生成</SelectItem>
                  <SelectItem value="tts">🔊 语音合成</SelectItem>
                  <SelectItem value="asr">🎤 语音识别</SelectItem>
                  <SelectItem value="vision">👁 视觉理解</SelectItem>
                  <SelectItem value="search">🌐 搜索API</SelectItem>
                  <SelectItem value="embedding">📐 向量嵌入</SelectItem>
                  <SelectItem value="rerank">🔀 重排序</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2 pt-8">
              <Switch
                checked={formData.enabled}
                onCheckedChange={(checked) => setFormData((prev: ModelFormData) => ({ ...prev, enabled: checked }))}
              />
              <Label>启用模型</Label>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              checked={formData.visibleToUser}
              onCheckedChange={(checked) => setFormData((prev: ModelFormData) => ({ ...prev, visibleToUser: checked }))}
            />
            <Label>向用户显示具体模型名</Label>
          </div>

          {/* ★ 新增：能力标签编辑器（替代旧的 supportsVision 开关） */}
          <CapabilitiesEditor
            capabilities={formData.capabilities}
            onChange={(caps) =>
              setFormData((prev: ModelFormData) => ({
                ...prev,
                capabilities: caps,
                supportsVision: caps.includes("vision"),
              }))
            }
          />

          {/* API 配置 */}
          <div className="border-t pt-4">
            <h3 className="font-semibold mb-3">API配置</h3>
            <div className="space-y-3">
              <div>
                <Label>API端点</Label>
                <Input
                  name="model_api_endpoint"
                  autoComplete="off"
                  data-1p-ignore
                  data-lpignore="true"
                  value={formData.apiEndpoint}
                  onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, apiEndpoint: e.target.value }))}
                  placeholder="https://api.example.com/v1"
                />
              </div>
              <div>
                <Label>API密钥</Label>
                <Input
                  name="model_api_secret"
                  type="password"
                  autoComplete="new-password"
                  data-1p-ignore
                  data-lpignore="true"
                  value={formData.apiKey}
                  onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, apiKey: e.target.value }))}
                  placeholder="sk-..."
                />
              </div>
              <div>
                <Label>模型标识符</Label>
                <Input
                  name="model_api_identifier"
                  autoComplete="off"
                  value={formData.apiModel}
                  onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, apiModel: e.target.value }))}
                  placeholder="例如: gpt-4o, qwen-max"
                />
              </div>
            </div>
          </div>

          {/* 图片/视频专属配置 */}
          {formData.type === "image" && (
            <ImageProviderSelect formData={formData} setFormData={setFormData} />
          )}
          {formData.type === "video" && (
            <VideoCostFields formData={formData} setFormData={setFormData} />
          )}

          {/* 操作按钮 */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button onClick={onCreate} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              创建模型
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
