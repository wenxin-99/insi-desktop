/**
 * sshSettings/SandboxPanel — 沙箱控制面板（展开区域）
 */
import { Button } from "@/components/ui/button";
import { Loader2, Server, Play, Square, RotateCcw, Activity, Terminal, X } from "lucide-react";
import type { SSHConfigItem } from "./types";

interface SandboxPanelProps {
  config: SSHConfigItem;
  sandboxAction: { id: number; action: string } | null;
  sandboxLogs: { id: number; logs: string } | null;
  setSandboxLogs: (v: { id: number; logs: string } | null) => void;
  deployProgress: { step: number; totalSteps: number; label: string; percent: number } | null;
  diagResult: { id: number; checks: any[]; overall: string } | null;
  setDiagResult: (v: any) => void;
  diagnosing: boolean;
  onAction: (configId: number, action: "deploy" | "start" | "stop" | "restart" | "check") => void;
  onCancelDeploy: (configId: number) => void;
  onDiagnose: (configId: number) => void;
  onViewLogs: (configId: number) => void;
}

export function SandboxPanel({
  config, sandboxAction, sandboxLogs, setSandboxLogs,
  deployProgress, diagResult, setDiagResult, diagnosing,
  onAction, onCancelDeploy, onDiagnose, onViewLogs,
}: SandboxPanelProps) {
  const isDeploying = sandboxAction?.id === config.id && sandboxAction.action === "deploy";

  return (
    <div className="mt-3 space-y-3">
      {/* 操作按钮 */}
      <div className="flex flex-wrap gap-2">
        <Button size="sm" variant="outline" onClick={() => onAction(config.id, "deploy")} disabled={!!sandboxAction}>
          {isDeploying ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Server className="h-3.5 w-3.5 mr-1.5" />}
          {config.sandboxStatus === "offline" ? "一键部署" : "重新部署"}
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction(config.id, "start")} disabled={!!sandboxAction || config.sandboxStatus === "online"}>
          <Play className="h-3.5 w-3.5 mr-1.5" /> 启动
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction(config.id, "stop")} disabled={!!sandboxAction || config.sandboxStatus === "offline"}>
          <Square className="h-3.5 w-3.5 mr-1.5" /> 停止
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction(config.id, "restart")} disabled={!!sandboxAction || config.sandboxStatus === "offline"}>
          <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> 重启
        </Button>
        <Button size="sm" variant="outline" onClick={() => onAction(config.id, "check")} disabled={!!sandboxAction}>
          {sandboxAction?.id === config.id && sandboxAction.action === "check"
            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            : <Activity className="h-3.5 w-3.5 mr-1.5" />}
          检查连接
        </Button>
        <Button size="sm" variant="outline" onClick={() => onViewLogs(config.id)}>
          <Terminal className="h-3.5 w-3.5 mr-1.5" /> 日志
        </Button>
        {isDeploying && (
          <Button size="sm" variant="destructive" onClick={() => onCancelDeploy(config.id)}>
            <X className="h-3.5 w-3.5 mr-1.5" /> 取消部署
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => onDiagnose(config.id)} disabled={diagnosing}>
          {diagnosing && diagResult?.id === config.id
            ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            : <Activity className="h-3.5 w-3.5 mr-1.5" />}
          诊断
        </Button>
      </div>

      {/* 部署进度条 */}
      {isDeploying && deployProgress && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>⑥ {deployProgress.label}</span>
            <span>{deployProgress.percent}%</span>
          </div>
          <div className="w-full h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${deployProgress.percent}%` }} />
          </div>
          <div className="text-xs text-muted-foreground">步骤 {deployProgress.step}/{deployProgress.totalSteps}</div>
        </div>
      )}

      {/* 诊断结果 */}
      {diagResult?.id === config.id && (
        <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">诊断结果</span>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              diagResult.overall === "healthy" ? "bg-green-100 text-green-700" :
              diagResult.overall === "degraded" ? "bg-yellow-100 text-yellow-700" :
              "bg-red-100 text-red-700"
            }`}>
              {diagResult.overall === "healthy" ? "✅ 健康" : diagResult.overall === "degraded" ? "⚠️ 部分异常" : "❌ 异常"}
            </span>
          </div>
          {diagResult.checks.map((check: any, i: number) => (
            <div key={i} className="flex items-center gap-2 text-xs">
              <span>{check.status === "pass" ? "✅" : check.status === "warn" ? "⚠️" : "❌"}</span>
              <span className="font-medium w-28">{check.name}</span>
              <span className="text-muted-foreground flex-1">{check.message}</span>
              {check.duration !== undefined && <span className="text-muted-foreground/60">{check.duration}ms</span>}
            </div>
          ))}
          <Button variant="ghost" size="sm" className="w-full mt-1" onClick={() => setDiagResult(null)}>关闭</Button>
        </div>
      )}

      {/* 连接信息 */}
      {config.sandboxWsEndpoint && (
        <div className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-2 font-mono">
          <span className="text-gray-500">WS Endpoint: </span>
          <span className="text-blue-600">{config.sandboxWsEndpoint}</span>
        </div>
      )}

      {/* 错误信息 */}
      {config.sandboxError && (
        <div className="text-xs bg-red-50 text-red-700 rounded p-2 whitespace-pre-wrap">{config.sandboxError}</div>
      )}

      {/* 日志面板 */}
      {sandboxLogs?.id === config.id && (
        <div className="relative">
          <Button variant="ghost" size="sm" className="absolute top-1 right-1 h-6 w-6 p-0" onClick={() => setSandboxLogs(null)}>
            <X className="h-3 w-3" />
          </Button>
          <pre className="text-xs bg-gray-900 text-green-400 rounded p-3 max-h-60 overflow-auto font-mono whitespace-pre-wrap">
            {sandboxLogs.logs}
          </pre>
        </div>
      )}
    </div>
  );
}
