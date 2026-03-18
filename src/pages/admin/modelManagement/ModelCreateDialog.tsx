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
import { ImageProviderSelect } from "./ImageProviderSelect";

/** 根据 API 端点 URL 自动推断图片生成协议 */
interface ModelCreateDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  formData: any;
  setFormData: (data: any) => void;
  onSubmit: () => void;
  templates: any[];
  handleTemplateSelect: (id: string) => void;
  autoDetectImageProvider: (endpoint: string) => string;
}

export function ModelCreateDialog({
  isOpen, onOpenChange, formData, setFormData, onSubmit, templates, handleTemplateSelect
}: ModelCreateDialogProps) {
  return (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
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
                  <Select value={selectedTemplate} onValueChange={handleTemplateSelect}>
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
                  {selectedTemplate && (
                    <div className="mt-2 text-sm text-muted-foreground">
                      <p>💡 {getTemplateById(selectedTemplate)?.notes}</p>
                    </div>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>模型名称</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="例如: qwen-max"
                    />
                  </div>
                  <div>
                    <Label>显示名称</Label>
                    <Input
                      value={formData.displayName}
                      onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                      placeholder="例如: 通义千问 Max"
                    />
                  </div>
                </div>

                <div>
                  <Label>模型描述</Label>
                  <Textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="简要描述模型的特点和用途"
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

                <div className="flex items-center space-x-2">
                    <Switch
                      checked={formData.visibleToUser}
                      onCheckedChange={(checked) => setFormData({ ...formData, visibleToUser: checked })}
                    />
                    <Label>向用户显示具体模型名</Label>
                </div>

                <div className="flex items-center space-x-2 border-t pt-4">
                  <Switch
                    checked={formData.supportsVision}
                    onCheckedChange={(checked) => setFormData({ ...formData, supportsVision: checked })}
                  />
                  <Label>支持视觉识别（图片理解能力）</Label>
                </div>

                <div className="border-t pt-4">
                  <h3 className="font-semibold mb-3">API配置</h3>
                  <div className="space-y-3">
                    <div>
                      <Label>API端点</Label>
                      <Input
                        value={formData.apiEndpoint}
                        onChange={(e) => setFormData({ ...formData, apiEndpoint: e.target.value })}
                        placeholder="https://api.example.com/v1/chat/completions"
                      />
                    </div>
                    <div>
                      <Label>API密钥</Label>
                      <Input
                        type="password"
                        value={formData.apiKey}
                        onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder="sk-..."
                      />
                    </div>
                    <div>
                      <Label>模型标识符</Label>
                      <Input
                        value={formData.apiModel}
                        onChange={(e) => setFormData({ ...formData, apiModel: e.target.value })}
                        placeholder="例如: qwen-max"
                      />
                    </div>
                  </div>
                </div>

                {/* 图片模型专属配置 */}
                {formData.type === 'image' && (
                  <ImageProviderSelect formData={formData} setFormData={setFormData} />
                )}

                {/* 视频模型专属配置（创建对话框） */}
                {formData.type === 'video' && (
                  <div className="border-t pt-4">
                    <h3 className="font-semibold mb-3">🎬 视频生成费用配置</h3>
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
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleCreate} disabled={createMutation.isPending}>
                    {createMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    创建
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
  );
}
