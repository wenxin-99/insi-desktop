/**
 * modelManagement/ModelTable — 模型列表表格
 */
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Edit, Trash2, CheckCircle2, XCircle, Clock, TestTube2 } from "lucide-react";
import { MODEL_TYPE_LABELS, IMAGE_PROVIDER_LABELS } from "./types";

interface TestResult {
  success: boolean;
  message: string;
  responseTime?: number;
}

interface ModelTableProps {
  models: any[] | undefined;
  isLoading: boolean;
  testingModelId: number | null;
  testResults: Record<number, TestResult>;
  testPending: boolean;
  onEdit: (model: any) => void;
  onDelete: (id: number, name: string) => void;
  onTest: (id: number, name: string) => void;
}

function StatusIcon({ status }: { status?: string }) {
  switch (status) {
    case "available":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "unavailable":
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function statusText(status?: string): string {
  switch (status) {
    case "available": return "可用";
    case "unavailable": return "不可用";
    default: return "未测试";
  }
}

function ProtocolBadge({ type, config, endpoint, modelName }: { type: string; config?: string; endpoint?: string; modelName?: string }) {
  // 图片模型：检查显式配置
  if (type === 'image') {
    let cfg: any = {};
    try { cfg = config ? JSON.parse(config) : {}; } catch {}
    const explicit = cfg.imageProvider;
    const label = IMAGE_PROVIDER_LABELS[explicit] || "";
    if (label) {
      return (
        <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
          {label}
        </span>
      );
    }
  }
  // 全类型自动推断（前端轻量版，与服务端 autoDetectProtocol 同逻辑）
  const url = (endpoint || '').toLowerCase();
  const model = (modelName || '').toLowerCase();
  let detected = '';
  if (type === 'image') {
    if (url.includes('googleapis.com')) {
      detected = (model.includes('imagen') || url.includes(':predict')) ? 'Imagen' : 'Gemini原生';
    } else if (url.includes('dashscope')) {
      detected = url.includes('/services/aigc/') ? 'DashScope异步' : 'OpenAI兼容';
    } else { detected = 'OpenAI兼容'; }
  } else if (type === 'chat' || type === 'vision' || type === 'embedding' || type === 'rerank' || type === 'search') {
    if (url.includes('anthropic.com') || url.includes('/v1/messages') || model.includes('claude')) {
      detected = 'Anthropic';
    } else if (url.includes('googleapis.com')) {
      detected = 'Gemini';
    } else { detected = 'OpenAI兼容'; }
  } else if (type === 'video') {
    detected = (url.includes('pollo') || model.includes('pollo')) ? 'Pollo' : 'DashScope';
  } else if (type === 'tts') {
    if (url.includes('dashscope') || model.includes('cosyvoice') || model.includes('sambert')) detected = 'DashScope';
    else if (url.includes('bytedance') || url.includes('volcengine')) detected = '火山引擎';
    else if (url.includes('googleapis.com')) detected = 'Gemini';
    else if (url.startsWith('wss://')) detected = '火山引擎';
    else detected = 'OpenAI兼容';
  } else if (type === 'asr') {
    if (url.includes('dashscope') || model.includes('paraformer') || model.includes('sensevoice')) detected = 'DashScope';
    else if (url.includes('bytedance') || url.includes('volcengine')) detected = '火山引擎';
    else if (url.includes('googleapis.com')) detected = 'Gemini';
    else if (url.startsWith('wss://')) detected = '火山引擎';
    else detected = 'Whisper兼容';
  } else if (type === 'search') {
    if (url.includes('tavily')) detected = 'Tavily';
    else detected = '搜索API';
  } else {
    return null;  // 未知类型不显示
  }
  if (!detected || !endpoint) return null;
  return (
    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
      自动·{detected}
    </span>
  );
}

function TestResultCell({ modelId, testingModelId, testResults, apiStatus }: {
  modelId: number;
  testingModelId: number | null;
  testResults: Record<number, TestResult>;
  apiStatus?: string;
}) {
  if (testingModelId === modelId) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
        <span className="text-sm text-blue-600">测试中...</span>
      </div>
    );
  }

  const result = testResults[modelId];
  if (result) {
    return (
      <div className="flex items-center gap-2">
        {result.success ? (
          <>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
            <div className="flex flex-col">
              <span className="text-sm text-green-600">连接正常</span>
              {result.responseTime && (
                <span className="text-xs text-muted-foreground">{result.responseTime}ms</span>
              )}
            </div>
          </>
        ) : (
          <>
            <XCircle className="h-4 w-4 text-red-500" />
            <div className="flex flex-col">
              <span className="text-sm text-red-600">连接失败</span>
              <span className="text-xs text-muted-foreground" title={result.message}>
                {result.message.length > 20 ? result.message.substring(0, 20) + "..." : result.message}
              </span>
            </div>
          </>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <StatusIcon status={apiStatus} />
      <span className="text-sm">{statusText(apiStatus)}</span>
    </div>
  );
}

export function ModelTable({
  models,
  isLoading,
  testingModelId,
  testResults,
  testPending,
  onEdit,
  onDelete,
  onTest,
}: ModelTableProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
                  {/* 名称 */}
                  <td className="p-3">
                    <div>
                      <div className="font-medium">{model.displayName}</div>
                      <div className="text-sm text-muted-foreground">{model.name}</div>
                    </div>
                  </td>
                  {/* 类型 */}
                  <td className="p-3">
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary">
                      {MODEL_TYPE_LABELS[model.type] || model.type}
                    </span>
                    {(model as any).source !== "builtin" && (
                      <ProtocolBadge type={model.type} config={model.config} endpoint={model.apiEndpoint} modelName={model.apiModel} />
                    )}
                  </td>
                  {/* 来源 */}
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      (model as any).source === "builtin" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"
                    }`}>
                      {(model as any).source === "builtin" ? "内置" : "自定义"}
                    </span>
                  </td>
                  {/* 启用状态 */}
                  <td className="p-3">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      model.enabled ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-700"
                    }`}>
                      {model.enabled ? "启用" : "禁用"}
                    </span>
                  </td>
                  {/* API 状态 */}
                  <td className="p-3">
                    <TestResultCell
                      modelId={model.id}
                      testingModelId={testingModelId}
                      testResults={testResults}
                      apiStatus={(model as any).apiStatus}
                    />
                  </td>
                  {/* 使用统计 */}
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
                  {/* 操作 */}
                  <td className="p-3">
                    <div className="flex items-center justify-end gap-2">
                      <Button variant="ghost" size="sm" onClick={() => onTest(model.id, model.displayName)} disabled={testPending} title="测试API连接">
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
