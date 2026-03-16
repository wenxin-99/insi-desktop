/**
 * modelManagement/EditModelDialog — 编辑模型对话框
 *
 * ★ 改动：集成 CapabilitiesEditor 组件，替代单独的 supportsVision 开关
 */
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { ImageProviderSelect } from "./ImageProviderSelect";
import { VideoCostFields } from "./VideoCostFields";
import { CapabilitiesEditor } from "./CapabilitiesEditor";
import type { ModelFormData } from "./types";

interface EditModelDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: ModelFormData;
  setFormData: (updater: ModelFormData | ((prev: ModelFormData) => ModelFormData)) => void;
  onUpdate: () => void;
  isPending: boolean;
}

export function EditModelDialog({
  open,
  onOpenChange,
  formData,
  setFormData,
  onUpdate,
  isPending,
}: EditModelDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>编辑模型</DialogTitle>
          <DialogDescription>修改模型配置</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* 基本信息 */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>模型名称</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, name: e.target.value }))}
              />
            </div>
            <div>
              <Label>显示名称</Label>
              <Input
                value={formData.displayName}
                onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, displayName: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <Label>模型描述</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, description: e.target.value }))}
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

          {/* ★ 新增：能力标签编辑器（替代旧的 supportsVision 开关） */}
          <CapabilitiesEditor
            capabilities={formData.capabilities}
            onChange={(caps) =>
              setFormData((prev: ModelFormData) => ({
                ...prev,
                capabilities: caps,
                // 向后兼容: 同步更新 supportsVision
                supportsVision: caps.includes("vision"),
              }))
            }
          />

          {/* 自定义模型 API 配置 */}
          {formData.source === "custom" && (
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
                  />
                </div>
                <div>
                  <Label>模型标识符</Label>
                  <Input
                    name="model_api_identifier"
                    autoComplete="off"
                    value={formData.apiModel}
                    onChange={(e) => setFormData((prev: ModelFormData) => ({ ...prev, apiModel: e.target.value }))}
                  />
                </div>
              </div>
            </div>
          )}

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
            <Button onClick={onUpdate} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
