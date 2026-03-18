/**
 * ModelList — 模型列表表格组件
 * 从 ModelManagement.tsx 拆分，原始行号 598-763
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Edit, Trash2, CheckCircle2, XCircle, TestTube2 } from "lucide-react";

interface ModelListProps {
  models: any[] | undefined;
  testingModelId: number | null;
  testResults: Record<number, any>;
  testMutation: { isPending: boolean };
  onTest: (id: number, name: string) => void;
  onEdit: (model: any) => void;
  onDelete: (id: number, name: string) => void;
  getStatusIcon: (status: string) => JSX.Element;
  getStatusText: (status: string) => string;
}

export function ModelList({
  models, testingModelId, testResults, testMutation,
  onTest, onEdit, onDelete, getStatusIcon, getStatusText,
}: ModelListProps) {
  const providerLabels: Record<string, string> = {
    'openai-compatible': 'OpenAI兼容',
    'dashscope-async': 'DashScope异步',
    'google-imagen': 'Imagen',
    'forge': 'Forge',
  };

  return (
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
                    <ModelTypeBadge model={model} providerLabels={providerLabels} />
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
                    <ApiStatusCell
                      model={model}
                      testingModelId={testingModelId}
                      testResults={testResults}
                      getStatusIcon={getStatusIcon}
                      getStatusText={getStatusText}
                    />
                  </td>
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onTest(model.id, model.displayName)} disabled={testMutation.isPending} title="测试API连接">
                        <TestTube2 className="h-4 w-4 text-blue-500" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onEdit(model)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="sm" onClick={() => onDelete(model.id, model.displayName)}>
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
  );
}

// ─── 模型类型徽标 ───
function ModelTypeBadge({ model, providerLabels }: { model: any; providerLabels: Record<string, string> }) {
  const typeLabels: Record<string, string> = {
    chat: "💬 对话", vision: "👁 视觉", image: "🎨 图片",
    video: "🎬 视频", tts: "🔊 TTS", asr: "🎤 ASR",
    text: "📝 文本", transcription: "🎤 语音",
  };

  return (
    <>
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
        {typeLabels[model.type] || model.type}
      </span>
      {model.type === "image" && (() => {
        const cfg = model.config ? (() => { try { return JSON.parse(model.config); } catch { return {}; } })() : {};
        const label = providerLabels[cfg.imageProvider] || '';
        return label ? (
          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700">{label}</span>
        ) : (
          <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-red-100 text-red-600">⚠ 未设协议</span>
        );
      })()}
    </>
  );
}

// ─── API 状态单元格 ───
function ApiStatusCell({ model, testingModelId, testResults, getStatusIcon, getStatusText }: {
  model: any; testingModelId: number | null; testResults: Record<number, any>;
  getStatusIcon: (s: string) => JSX.Element; getStatusText: (s: string) => string;
}) {
  if (testingModelId === model.id) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-blue-600">测试中...</span>
      </div>
    );
  }
  if (testResults[model.id]) {
    const result = testResults[model.id];
    return (
      <div className="flex items-center gap-2">
        {result.success ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div className="flex flex-col">
              <span className="text-sm text-green-600">连接正常</span>
              {result.responseTime && <span className="text-xs text-muted-foreground">{result.responseTime}ms</span>}
            </div>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-red-500" />
            <div className="flex flex-col">
              <span className="text-sm text-red-600">连接失败</span>
              <span className="text-xs text-muted-foreground" title={result.message}>
                {result.message.length > 20 ? result.message.substring(0, 20) + '...' : result.message}
              </span>
            </div>
          </>
        )}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      {getStatusIcon((model as any).apiStatus)}
      <span className="text-sm">{getStatusText((model as any).apiStatus)}</span>
    </div>
  );
}
