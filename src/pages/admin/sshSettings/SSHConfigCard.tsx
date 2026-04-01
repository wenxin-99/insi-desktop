/**
 * sshSettings/SSHConfigCard — 单个 SSH 配置卡片
 */
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Loader2, Trash2, TestTube, Star, StarOff, Server,
  CheckCircle, XCircle, Edit, Monitor, ChevronDown, ChevronUp,
} from "lucide-react";
import { type SSHConfigItem, STATUS_MAP } from "./types";
import { SandboxPanel } from "./SandboxPanel";

interface SSHConfigCardProps {
  config: SSHConfigItem;
  testingId: number | null;
  testResult: { id: number; success: boolean; message: string; info?: string } | null;
  expandedSandbox: number | null;
  setExpandedSandbox: (id: number | null) => void;
  // sandbox props (pass-through)
  sandboxAction: { id: number; action: string } | null;
  sandboxLogs: { id: number; logs: string } | null;
  setSandboxLogs: (v: { id: number; logs: string } | null) => void;
  deployProgress: { step: number; totalSteps: number; label: string; percent: number } | null;
  diagResult: { id: number; checks: any[]; overall: string } | null;
  setDiagResult: (v: any) => void;
  diagnosing: boolean;
  // handlers
  onTest: (id: number) => void;
  onSetDefault: (id: number) => void;
  onEdit: (config: SSHConfigItem) => void;
  onDelete: (id: number) => void;
  onSandboxToggle: (configId: number, enabled: boolean) => void;
  onSandboxAction: (configId: number, action: "deploy" | "start" | "stop" | "restart" | "check") => void;
  onCancelDeploy: (configId: number) => void;
  onDiagnose: (configId: number) => void;
  onViewLogs: (configId: number) => void;
}

export function SSHConfigCard({
  config, testingId, testResult, expandedSandbox, setExpandedSandbox,
  sandboxAction, sandboxLogs, setSandboxLogs, deployProgress,
  diagResult, setDiagResult, diagnosing,
  onTest, onSetDefault, onEdit, onDelete,
  onSandboxToggle, onSandboxAction, onCancelDeploy, onDiagnose, onViewLogs,
}: SSHConfigCardProps) {
  return (
    <Card className={`${!config.isActive ? "opacity-60" : ""}`}>
      <CardContent className="py-4">
        {/* 主行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.isDefault ? "bg-blue-100" : "bg-gray-100"}`}>
              <Server className={`h-5 w-5 ${config.isDefault ? "text-blue-600" : "text-gray-500"}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-medium">{config.name}</span>
                {config.isDefault && <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">默认</span>}
                {!config.isActive && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">已禁用</span>}
              </div>
              <div className="text-sm text-gray-500 mt-0.5">
                {config.username}@{config.host}:{config.port}
                <span className="ml-2 text-xs">{config.authType === "password" ? "🔑 密码" : "🔐 密钥"}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1">
            {testResult?.id === config.id && (
              <div className={`flex items-center gap-1 mr-2 text-sm ${testResult.success ? "text-green-600" : "text-red-600"}`}>
                {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                <span className="max-w-[200px] truncate">{testResult.message}</span>
              </div>
            )}
            <Button variant="ghost" size="sm" onClick={() => onTest(config.id)} disabled={testingId === config.id}>
              {testingId === config.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <TestTube className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onSetDefault(config.id)} title={config.isDefault ? "当前为默认" : "设为默认"}>
              {config.isDefault ? <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" /> : <StarOff className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onEdit(config)}><Edit className="h-4 w-4" /></Button>
            <Button variant="ghost" size="sm" onClick={() => onDelete(config.id)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
          </div>
        </div>

        {/* 测试详情 */}
        {testResult?.id === config.id && testResult.info && (
          <div className="mt-3 p-2 bg-gray-50 rounded text-xs font-mono text-gray-600 whitespace-pre-wrap">{testResult.info}</div>
        )}

        {/* 沙箱控制 */}
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">自动化沙箱</span>
              {config.sandboxEnabled && (() => {
                const s = STATUS_MAP[config.sandboxStatus || "offline"] || STATUS_MAP.offline;
                return (
                  <span className={`text-xs px-2 py-0.5 rounded-full flex items-center gap-1 ${s.color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                    {config.sandboxStatus === "online" && config.sandboxRunningTasks !== undefined && (
                      <span className="ml-1 opacity-70">({config.sandboxRunningTasks}/{config.sandboxMaxTasks})</span>
                    )}
                  </span>
                );
              })()}
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={!!config.sandboxEnabled} onCheckedChange={(checked) => onSandboxToggle(config.id, checked)} />
              {config.sandboxEnabled && (
                <Button variant="ghost" size="sm" onClick={() => setExpandedSandbox(expandedSandbox === config.id ? null : config.id)}>
                  {expandedSandbox === config.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>

          {config.sandboxEnabled && expandedSandbox === config.id && (
            <SandboxPanel
              config={config}
              sandboxAction={sandboxAction}
              sandboxLogs={sandboxLogs}
              setSandboxLogs={setSandboxLogs}
              deployProgress={deployProgress}
              diagResult={diagResult}
              setDiagResult={setDiagResult}
              diagnosing={diagnosing}
              onAction={onSandboxAction}
              onCancelDeploy={onCancelDeploy}
              onDiagnose={onDiagnose}
              onViewLogs={onViewLogs}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}
