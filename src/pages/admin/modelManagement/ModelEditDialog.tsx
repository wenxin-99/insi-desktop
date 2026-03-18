import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, Plus, Edit, Trash2, CheckCircle2, XCircle, Clock, TestTube2, ArrowLeft, AlertCircle, FileCode } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MODEL_TEMPLATES, getTemplateById, getAllProviders, type ModelTemplate } from "@shared/modelTemplates";

/** 根据 API 端点 URL 自动推断图片生成协议 */
interface ModelEditDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  autoDetectImageProvider: (endpoint: string) => string;
}

export function ModelEditDialog({
  isOpen, onOpenChange, formData, setFormData, onSubmit
}: ModelEditDialogProps) {
  return (
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑模型</DialogTitle>
              <DialogDescription>修改模型配置</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>模型名称</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>显示名称</Label>
                  <Input
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <Label>模型描述</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>模型类型</Label>
                  <Select value={formData.type} onValueChange={(value: any) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chat">💬 对话/推理</SelectItem>
                      <SelectItem value="image">🎨 图片生成</SelectItem>
                      <SelectItem value="video">🎬 视频生成</SelectItem>
                      <SelectItem value="tts">🔊 语音合成</SelectItem>
                      <SelectItem value="asr">🎤 语音识别</SelectItem>
                      <SelectItem value="vision">👁 视觉理解</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {/* 费用已统一在套餐管理中设置 */}
                <div className="flex items-center space-x-2 pt-8">
                  <Switch
                    checked={formData.enabled}
                    onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
                  />
                  <Label>启用模型</Label>
                </div>
              </div>

              <div className="flex items-center space-x-2 border-t pt-4">
                <Switch
                  checked={formData.supportsVision}
                  onCheckedChange={(checked) => setFormData({ ...formData, supportsVision: checked })}
                />
                <Label>支持视觉识别（图片理解能力）</Label>
              </div>

              {formData.source === "custom" && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">API配置</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>API端点</Label>
                      <Input
                        value={formData.apiEndpoint}
                        onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>API密钥</Label>
                      <Input
                        type="password"
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>模型标识符</Label>
                      <Input
                        value={formData.apiModel}
                        onChange={(e) => setFormData({ ...formData, apiModel: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 图片模型专属配置 */}
              {formData.type === 'image' && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">🎨 图片生成配置</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>API 协议 <span className="text-xs text-muted-foreground font-normal ml-1">留空可根据端点URL自动识别</span></Label>
                      <Select 
                        value={formData.imageProvider} 
                        onValueChange={(value: any) => {
                          const presets: Record<string, { endpoint: string; hint: string }> = {
                            'google-imagen': { 
                              endpoint: 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
                              hint: '使用 Google Imagen，API Key 填 Google AI Studio 密钥'
                            },
                            'dashscope-async': { 
                              endpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
                              hint: '阿里 DashScope 异步模式，适用于 wanx 系列'
                            },
                            'openai-compatible': { 
                              endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
                              hint: 'OpenAI 兼容接口，会调用 /images/generations'
                            },
                            'forge': { endpoint: '', hint: 'Forge/ComfyUI 本地部署' },
                          };
                          const preset = presets[value] || { endpoint: '', hint: '' };
                          setFormData({ 
                            ...formData, 
                            imageProvider: value,
                            ...(formData.apiEndpoint ? {} : { apiEndpoint: preset.endpoint }),
                          });
                          if (preset.hint) toast.info(preset.hint, { duration: 5000 });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="请选择 API 协议..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="openai-compatible">OpenAI 兼容（通用，推荐）</SelectItem>
                          <SelectItem value="dashscope-async">阿里 DashScope 异步（wanx 文生图）</SelectItem>
                            <SelectItem value="dashscope-image-edit">阿里 DashScope 图像编辑（wanx 编辑）</SelectItem>
                          <SelectItem value="google-imagen">Google Imagen</SelectItem>
                          <SelectItem value="forge">Forge / ComfyUI</SelectItem>
                        </SelectContent>
                      </Select>
                      {formData.imageProvider === 'openai-compatible' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          💡 端点填到 <code>/v1</code> 即可，系统会自动拼接 <code>/images/generations</code>
                        </p>
                      )}
                      {formData.imageProvider === 'dashscope-async' && (
                        <p className="text-xs text-muted-foreground mt-1">
                          💡 异步模式：提交任务 → 轮询结果。适用于 wanx-v1、wanx2.1-t2i-turbo 等
                        </p>
                      )}
                        {formData.imageProvider === 'dashscope-image-edit' && (
                          <p className="text-xs text-muted-foreground mt-1">
                            💡 图像编辑模式：上传原图+指令修改。端点填 <code>https://dashscope.aliyuncs.com/api/v1/services/aigc/image2image/image-synthesis</code>，模型名如 <code>wanx2.1-imageedit</code>
                          </p>
                        )}
                    </div>
                    <div>
                      <Label>默认宽高比</Label>
                      <Select value={formData.imageAspectRatio} onValueChange={(value) => setFormData({ ...formData, imageAspectRatio: value })}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1:1">1:1（方形）</SelectItem>
                          <SelectItem value="16:9">16:9（横屏）</SelectItem>
                          <SelectItem value="9:16">9:16（竖屏）</SelectItem>
                          <SelectItem value="4:3">4:3</SelectItem>
                          <SelectItem value="3:4">3:4</SelectItem>
                          <SelectItem value="3:2">3:2</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              )}

              {/* 视频模型专属配置 */}
              {formData.type === 'video' && (
                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">🎬 视频生成费用配置</h3>
                  <p className="text-sm text-muted-foreground mb-3">
                    设置不同时长的视频生成🐟币费用（原「视频API配置」已合并至此）
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>5秒视频费用（🐟币）</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.videoCost5s}
                        onChange={(e) => setFormData({ ...formData, videoCost5s: e.target.value })}
                        placeholder="30"
                      />
                    </div>
                    <div>
                      <Label>10秒视频费用（🐟币）</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        value={formData.videoCost10s}
                        onChange={(e) => setFormData({ ...formData, videoCost10s: e.target.value })}
                        placeholder="50"
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  取消
                </Button>
                <Button onClick={handleUpdate} disabled={updateMutation.isPending}>
                  {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  保存
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
  );
}
