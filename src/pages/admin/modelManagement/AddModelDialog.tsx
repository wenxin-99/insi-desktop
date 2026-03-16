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
import { ModelCreateDialog } from "./modelManagement/ModelCreateDialog";

export function AddModelDialog(props: any) {
  return (
    <>
      {/* 添加模型对话框 */}
      <ModelCreateDialog
        isOpen={isCreateDialogOpen}
        onOpenChange={setIsCreateDialogOpen}
        formData={formData}
        setFormData={setFormData}
        onSubmit={handleCreate}
        templates={MODEL_TEMPLATES}
        handleTemplateSelect={handleTemplateSelect}
        autoDetectImageProvider={autoDetectImageProvider}
      />

        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>模型列表</CardTitle>
              <CardDescription>共 {models?.length || 0} 个模型</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-3 font-semibold">名称</th>
                      <th className="text-left p-3 font-semibold">类型</th>
                      <th className="text-left p-3 font-semibold">来源</th>
                      <th className="text-left p-3 font-semibold">状态</th>
                      <th className="text-left p-3 font-semibold">API状态</th>
                      <th className="text-left p-3 font-semibold">使用统计</th>
                      <th className="text-right p-3 font-semibold">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {models?.map((model) => (
                      <tr key={model.id} className="border-b hover:bg-muted/50">
                        <td className="p-3">
                          <div>
                            <div className="font-medium">{model.displayName}</div>
                            <div className="text-sm text-muted-foreground">{model.name}</div>
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                            {model.type === "chat" && "💬 对话"}
                            {model.type === "vision" && "👁 视觉"}
                            {model.type === "image" && "🎨 图片"}
                            {model.type === "video" && "🎬 视频"}
                            {model.type === "tts" && "🔊 TTS"}
                            {model.type === "asr" && "🎤 ASR"}
                            {model.type === "text" && "📝 文本"}
                            {model.type === "transcription" && "🎤 语音"}
                          </span>
                          {model.type === "image" && (() => {
                            const cfg = model.config ? (() => { try { return JSON.parse(model.config); } catch { return {}; } })() : {};
                            const providerLabels: Record<string, string> = {
                              'openai-compatible': 'OpenAI兼容',
                              'dashscope-async': 'DashScope异步',
                              'google-imagen': 'Imagen',
                              'forge': 'Forge',
                            };
                            const label = providerLabels[cfg.imageProvider] || '';
                            return label ? (
                              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">
                                {label}
                              </span>
                            ) : (
                              <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600">
                                ⚠ 未设协议
                              </span>
                            );
                          })()}
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            (model as any).source === "builtin" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                          }`}>
                            {(model as any).source === "builtin" ? "内置" : "自定义"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            model.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                          }`}>
                            {model.enabled ? "启用" : "禁用"}
                          </span>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col gap-1">
                            <div className="text-sm">
                              <span className="font-medium">调用:</span> {(model as any).totalCalls || 0}次
                            </div>
                            {((model as any).totalCalls || 0) > 0 && (
                              <>
                                <div className="text-xs text-muted-foreground">
                                  平均: {(model as any).avgResponseTime || 0}ms
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  成功率: {(((model as any).successCalls || 0) / ((model as any).totalCalls || 1) * 100).toFixed(1)}%
                                </div>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {testingModelId === model.id ? (
                              <>
                                <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                                <span className="text-sm text-blue-600">测试中...</span>
                              </>
                            ) : testResults[model.id] ? (
                              <>
                                {testResults[model.id].success ? (
                                  <>
                                    <CheckCircle2 className="h-4 w-4 text-green-500" />
                                    <div className="flex flex-col">
                                      <span className="text-sm text-green-600">连接正常</span>
                                      {testResults[model.id].responseTime && (
                                        <span className="text-xs text-muted-foreground">{testResults[model.id].responseTime}ms</span>
                                      )}
                                    </div>
                                  </>
                                ) : (
                                  <>
                                    <XCircle className="h-4 w-4 text-red-500" />
                                    <div className="flex flex-col">
                                      <span className="text-sm text-red-600">连接失败</span>
                                      <span className="text-xs text-muted-foreground" title={testResults[model.id].message}>
                                        {testResults[model.id].message.length > 20 
                                          ? testResults[model.id].message.substring(0, 20) + '...' 
                                          : testResults[model.id].message}
                                      </span>
                                    </div>
                                  </>
                                )}
                              </>
                            ) : (
                              <>
                                {getStatusIcon((model as any).apiStatus)}
                                <span className="text-sm">{getStatusText((model as any).apiStatus)}</span>
                              </>
                            )}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTest(model.id, model.displayName)}
                              disabled={testMutation.isPending}
                              title="测试API连接"
                            >
                              <TestTube2 className="h-4 w-4 text-blue-500" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(model)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(model.id, model.displayName)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        )}

    </>
  );
}