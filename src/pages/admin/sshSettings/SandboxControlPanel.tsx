import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Trash2,
  TestTube,
  Star,
  StarOff,
  Loader2,
  Server,
  Key,
  Lock,
  CheckCircle,
  XCircle,
  Edit,
  Save,
  X,
  Monitor,
  Play,
  Square,
  RotateCcw,
  Activity,
  Terminal,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface SSHConfigItem {
  id: number;
  name: string;
  host: string;
  port: number;
  username: string;
  authType: "password" | "privateKey";
  isDefault: boolean;
  isActive: boolean;
  connectTimeout: number;
  createdAt: string;
  updatedAt: string;
  // 沙箱字段
  sandboxEnabled?: boolean;
  sandboxWsPort?: number;
  sandboxStatus?: "offline" | "deploying" | "online" | "error";
  sandboxWsEndpoint?: string;
  sandboxMaxTasks?: number;
  sandboxRunningTasks?: number;
  sandboxError?: string;
  sandboxLastCheckAt?: string;
}

const STATUS_MAP: Record<string, { label: string; color: string; dot: string }> = {
  offline:   { label: "离线", color: "bg-gray-100 text-gray-600",  dot: "bg-gray-400" },
  deploying: { label: "部署中", color: "bg-yellow-100 text-yellow-700", dot: "bg-yellow-400 animate-pulse" },
  online:    { label: "在线", color: "bg-green-100 text-green-700", dot: "bg-green-500" },
  error:     { label: "异常", color: "bg-red-100 text-red-700",    dot: "bg-red-500" },
};


export function SandboxControlPanel(props: any) {
  return (
    <>
                  {/* ── 沙箱节点控制面板 ── */}
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
                                <span className="ml-1 opacity-70">
                                  ({config.sandboxRunningTasks}/{config.sandboxMaxTasks})
                                </span>
                              )}
                            </span>
                          );
                        })()}
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!!config.sandboxEnabled}
                          onCheckedChange={(checked) => handleSandboxToggle(config.id, checked)}
                        />
                        {config.sandboxEnabled && (
                          <Button
                            variant="ghost" size="sm"
                            onClick={() => setExpandedSandbox(expandedSandbox === config.id ? null : config.id)}
                          >
                            {expandedSandbox === config.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* 展开的沙箱控制面板 */}
                    {config.sandboxEnabled && expandedSandbox === config.id && (
                      <div className="mt-3 space-y-3">
                        {/* 操作按钮 */}
                        <div className="flex flex-wrap gap-2">
                          {/* 部署 */}
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleSandboxAction(config.id, "deploy")}
                            disabled={!!sandboxAction}
                          >
                            {sandboxAction?.id === config.id && sandboxAction.action === "deploy"
                              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              : <Server className="h-3.5 w-3.5 mr-1.5" />}
                            {config.sandboxStatus === "offline" ? "一键部署" : "重新部署"}
                          </Button>

                          {/* 启动 */}
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleSandboxAction(config.id, "start")}
                            disabled={!!sandboxAction || config.sandboxStatus === "online"}
                          >
                            <Play className="h-3.5 w-3.5 mr-1.5" /> 启动
                          </Button>

                          {/* 停止 */}
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleSandboxAction(config.id, "stop")}
                            disabled={!!sandboxAction || config.sandboxStatus === "offline"}
                          >
                            <Square className="h-3.5 w-3.5 mr-1.5" /> 停止
                          </Button>

                          {/* 重启 */}
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleSandboxAction(config.id, "restart")}
                            disabled={!!sandboxAction || config.sandboxStatus === "offline"}
                          >
                            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> 重启
                          </Button>

                          {/* 健康检查 */}
                          <Button
                            size="sm" variant="outline"
                            onClick={() => handleSandboxAction(config.id, "check")}
                            disabled={!!sandboxAction}
                          >
                            {sandboxAction?.id === config.id && sandboxAction.action === "check"
                              ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              : <Activity className="h-3.5 w-3.5 mr-1.5" />}
                            检查连接
                          </Button>

                          {/* 查看日志 */}
                          <Button size="sm" variant="outline" onClick={() => handleViewLogs(config.id)}>
                            <Terminal className="h-3.5 w-3.5 mr-1.5" /> 日志
                          </Button>
                        </div>

                        {/* 连接信息 */}
                        {config.sandboxWsEndpoint && (
                          <div className="text-xs bg-gray-50 dark:bg-gray-800 rounded p-2 font-mono">
                            <span className="text-gray-500">WS Endpoint: </span>
                            <span className="text-blue-600">{config.sandboxWsEndpoint}</span>
                          </div>
                        )}

                        {/* 错误信息 */}
                        {config.sandboxError && (
                          <div className="text-xs bg-red-50 text-red-700 rounded p-2 whitespace-pre-wrap">
                            {config.sandboxError}
                          </div>
                        )}

                        {/* 日志面板 */}
                        {sandboxLogs?.id === config.id && (
                          <div className="relative">
                            <Button
                              variant="ghost" size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0"
                              onClick={() => setSandboxLogs(null)}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                            <pre className="text-xs bg-gray-900 text-green-400 rounded p-3 max-h-60 overflow-auto font-mono whitespace-pre-wrap">
                              {sandboxLogs.logs}
                            </pre>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
    </>
  );
}