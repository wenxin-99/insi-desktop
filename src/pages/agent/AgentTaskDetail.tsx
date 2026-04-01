/**
 * pages/agent/AgentTaskDetail.tsx — 任务详情页（全面升级版）
 *
 * ★ 结果摘要面板（从最终步骤提取，格式化展示）
 * ★ 失败诊断 + 建议操作引导
 * ★ 结果导出（复制 Markdown / 下载）
 * ★ 任务 prompt 展开查看
 */
import { useState, useMemo, useCallback } from "react";
import {
  ArrowLeft, Pause, Play, Square, RotateCcw,
  Clock, Coins, Zap, Terminal, Brain,
  Loader2, CheckCircle, XCircle, Download,
  FileText, AlertTriangle, Lightbulb, ChevronDown, ChevronUp,
  Clipboard, Check, Trash2,
} from "lucide-react";
import { useSandboxSocket } from "@/hooks/useSandboxSocket";
import SandboxPanel from "@/components/SandboxPanel";
import { AgentStepFlow } from "./AgentStepFlow";
import { TYPE_LABELS, TYPE_COLORS, STATUS_LABELS, STATUS_COLORS } from "./types";
import type { AgentTask, AgentStep } from "./types";

interface Props {
  task: AgentTask;
  steps: AgentStep[];
  onBack: () => void;
  onCancel: () => void;
  onPause: () => void;
  onResume: () => void;
  onRetry: () => void;
  onDelete?: () => void;
}

// ── 失败诊断 ──

interface FailureDiagnosis {
  reason: string;
  suggestions: string[];
  severity: "low" | "medium" | "high";
}

function diagnoseFailure(task: AgentTask, steps: AgentStep[]): FailureDiagnosis {
  const err = (task.errorMsg || "").toLowerCase();

  if (/连续.*观察.*相同|consecutive.*identical|anti.?loop|看门狗/i.test(err)) {
    return {
      reason: "任务陷入循环 — AI 反复执行相同操作但结果不变，被安全机制终止",
      suggestions: ["尝试更具体的 prompt，明确告诉 AI 最终目标", "如果是网页操作，检查目标页面是否需要登录", "考虑拆分为更小的子任务"],
      severity: "medium",
    };
  }
  if (/余额|balance|insufficient|🐟/i.test(err)) {
    return { reason: "🐟 余额不足", suggestions: ["充值🐟币后重试", "使用更经济的模型"], severity: "high" };
  }
  if (/connect|timeout|ECONNREFUSED|网络|超时/i.test(err)) {
    return {
      reason: "网络连接失败 — 目标服务器无法访问或响应超时",
      suggestions: ["检查目标 URL/IP 是否正确", "如果是 SSH 任务确认端口和凭证", "等几分钟后重试"],
      severity: "medium",
    };
  }
  if (/auth|401|403|forbidden|permission|denied|登录|认证/i.test(err)) {
    return {
      reason: "认证/权限失败",
      suggestions: ["检查账号密码/API Key 是否正确", "确认操作账号有足够权限", "网页操作前可能需要先登录"],
      severity: "high",
    };
  }
  if (/model|llm|rate.?limit|token|模型/i.test(err)) {
    return { reason: "AI 模型调用失败", suggestions: ["稍后重试（限频通常几分钟恢复）", "切换使用的模型"], severity: "low" };
  }
  if (/max.*step|步骤.*超|step.*limit/i.test(err) || task.totalSteps >= 25) {
    return {
      reason: "步骤数耗尽 — 任务太复杂",
      suggestions: ["简化任务描述聚焦核心目标", "拆分为多个小任务", "提高 maxSteps 配置"],
      severity: "medium",
    };
  }
  return {
    reason: task.errorMsg || "任务执行过程中遇到错误",
    suggestions: ["检查 prompt 描述是否清晰具体", "点击「重试」再次执行", "反复失败则尝试换一种描述方式"],
    severity: "low",
  };
}

// ── 结果提取 ──

function extractResult(task: AgentTask, steps: AgentStep[]): string {
  if (task.result) {
    const r = typeof task.result === "string" ? task.result : JSON.stringify(task.result, null, 2);
    if (r.length > 10) return r;
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].type === "summary" || steps[i].type === "complete") {
      const c = steps[i].observation || steps[i].toolInput || "";
      if (c.length > 10) return c;
    }
  }
  for (let i = steps.length - 1; i >= 0; i--) {
    const c = steps[i].observation || "";
    if (c.length > 50) return c;
  }
  return "";
}

function buildExportMarkdown(task: AgentTask, steps: AgentStep[], result: string): string {
  const lines = [
    `# Agent 任务报告`, "",
    `- **类型**: ${TYPE_LABELS[task.type]}`,
    `- **状态**: ${STATUS_LABELS[task.status]}`,
    `- **步骤**: ${task.totalSteps}`,
    `- **费用**: ${task.totalCost} 🐟`,
    `- **创建**: ${new Date(task.createdAt).toLocaleString("zh-CN")}`,
    "", `## 任务描述`, "", task.prompt, "",
  ];
  if (result) lines.push(`## 执行结果`, "", result, "");
  if (steps.length > 0) {
    lines.push(`## 执行步骤`, "");
    for (const s of steps) {
      const tool = s.toolName ? ` (${s.toolName})` : "";
      lines.push(`${s.stepNumber}. **${s.type}**${tool}: ${(s.observation || s.toolInput || "").substring(0, 200)}`);
    }
  }
  return lines.join("\n");
}

// ── 主组件 ──

export function AgentTaskDetail({ task, steps, onBack, onCancel, onPause, onResume, onRetry, onDelete }: Props) {
  const isRunning = task.status === "running";
  const isPaused = task.status === "paused";
  const isFailed = task.status === "failed" || task.status === "cancelled";
  const isCompleted = task.status === "completed";
  const taskIdNum = parseInt(task.id) || 0;

  const sandbox = useSandboxSocket(isRunning ? taskIdNum : null);
  const [activeTab, setActiveTab] = useState<"browser" | "code" | "terminal">("terminal");
  const [showPrompt, setShowPrompt] = useState(false);
  const [copied, setCopied] = useState(false);

  const result = useMemo(() => extractResult(task, steps), [task, steps]);
  const diagnosis = useMemo(() => isFailed ? diagnoseFailure(task, steps) : null, [task, steps, isFailed]);

  const maxSteps = task.config?.maxSteps || 30;
  const progress = Math.min(100, Math.floor((task.totalSteps / maxSteps) * 100));
  const duration = task.updatedAt && task.createdAt
    ? Math.floor((new Date(task.updatedAt).getTime() - new Date(task.createdAt).getTime()) / 1000) : 0;
  const fmtDuration = duration > 60 ? `${Math.floor(duration / 60)}m ${duration % 60}s` : `${duration}s`;

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(buildExportMarkdown(task, steps, result)).then(() => {
      setCopied(true); setTimeout(() => setCopied(false), 2000);
    });
  }, [task, steps, result]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([buildExportMarkdown(task, steps, result)], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url;
    a.download = `agent_${task.id.substring(0, 8)}.md`; a.click();
    URL.revokeObjectURL(url);
  }, [task, steps, result]);

  const showSandbox = isRunning || sandbox.isConnected;
  const showResult = !showSandbox && (isCompleted || isFailed);

  return (
    <div className="h-full flex flex-col bg-background">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-card shadow-sm">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-muted transition-colors"><ArrowLeft className="w-5 h-5" /></button>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm">{task.prompt.substring(0, 60)}{task.prompt.length > 60 ? "..." : ""}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[task.type]}`}>{TYPE_LABELS[task.type]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[task.status]}`}>
                {isRunning && <Loader2 className="w-3 h-3 inline mr-0.5 animate-spin" />}
                {isCompleted && <CheckCircle className="w-3 h-3 inline mr-0.5" />}
                {isFailed && <XCircle className="w-3 h-3 inline mr-0.5" />}
                {STATUS_LABELS[task.status]}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Zap className="w-3 h-3" />{task.totalSteps} 步</span>
              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{fmtDuration}</span>
              {parseFloat(task.totalCost) > 0 && <span className="flex items-center gap-1"><Coins className="w-3 h-3" />{task.totalCost} 🐟</span>}
              <span className="font-mono text-[10px] opacity-50">#{task.id.substring(0, 8)}</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {(isCompleted || isFailed) && (
            <div className="flex items-center gap-1 mr-2">
              <button onClick={handleCopy} className="px-2.5 py-1.5 text-xs bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 flex items-center gap-1 transition-colors">
                {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Clipboard className="w-3.5 h-3.5" />}
                {copied ? "已复制" : "复制"}
              </button>
              <button onClick={handleDownload} className="px-2.5 py-1.5 text-xs bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 flex items-center gap-1 transition-colors">
                <Download className="w-3.5 h-3.5" /> 导出
              </button>
            </div>
          )}
          {isRunning && (
            <>
              <button onClick={onPause} className="px-3 py-1.5 text-xs bg-yellow-100 text-yellow-700 rounded-xl hover:bg-yellow-200"><Pause className="w-3.5 h-3.5 inline mr-1" />暂停</button>
              <button onClick={onCancel} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-xl hover:bg-red-200"><Square className="w-3.5 h-3.5 inline mr-1" />取消</button>
            </>
          )}
          {isPaused && <button onClick={onResume} className="px-3 py-1.5 text-xs bg-green-100 text-green-700 rounded-xl hover:bg-green-200"><Play className="w-3.5 h-3.5 inline mr-1" />恢复</button>}
          {isFailed && <button onClick={onRetry} className="px-3 py-1.5 text-xs bg-blue-100 text-blue-700 rounded-xl hover:bg-blue-200"><RotateCcw className="w-3.5 h-3.5 inline mr-1" />重试</button>}
          {(isFailed || isCompleted || task.status === "cancelled") && onDelete && (
            <button onClick={onDelete} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-xl hover:bg-red-200">
              <Trash2 className="w-3.5 h-3.5 inline mr-1" />删除
            </button>
          )}
        </div>
      </div>

      {isRunning && <div className="h-1 bg-muted"><div className="h-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-1000" style={{ width: `${progress}%` }} /></div>}

      {/* 主体 */}
      <div className="flex-1 flex overflow-hidden">
        {/* 左侧：步骤时间线 */}
        <div className="w-[400px] border-r bg-card overflow-y-auto">
          <div className="p-4">
            <button onClick={() => setShowPrompt(!showPrompt)}
              className="w-full flex items-center justify-between p-2.5 rounded-xl bg-muted/40 hover:bg-muted/60 transition-colors mb-4 text-left">
              <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5"><FileText className="w-3.5 h-3.5" /> 任务描述</span>
              {showPrompt ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {showPrompt && <div className="p-3 mb-4 rounded-xl bg-muted/20 border text-sm text-foreground/80 whitespace-pre-wrap">{task.prompt}</div>}
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-amber-500" />执行步骤 <span className="text-xs text-muted-foreground font-normal">共 {steps.length} 步</span></h3>
            <AgentStepFlow steps={steps} maxDisplay={50} />
          </div>
        </div>

        {/* 右侧 */}
        <div className="flex-1 overflow-y-auto">
          {showSandbox ? (
            <SandboxPanel browser={sandbox.browser} code={sandbox.code} terminal={sandbox.terminal}
              activeTab={activeTab} onTabChange={setActiveTab} isConnected={sandbox.isConnected}
              taskId={taskIdNum} socket={sandbox.socket} clickIndicator={sandbox.clickIndicator}
              pendingConfirmation={sandbox.pendingConfirmation}
              onConfirmationResolved={() => sandbox.setPendingConfirmation(null)}
              cursorPosition={sandbox.cursorPosition}
              browserTabs={sandbox.browserTabs}
              helpNeeded={sandbox.helpNeeded}
              onHelpDismiss={() => sandbox.setHelpNeeded(null)} />
          ) : showResult ? (
            <div className="h-full p-6 space-y-5">
              {/* 完成：结果面板 */}
              {isCompleted && result && (
                <div className="rounded-2xl border border-green-200 bg-gradient-to-br from-green-50 to-emerald-50/50 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle className="w-5 h-5 text-green-500" />
                    <h3 className="font-bold text-sm text-green-800">执行结果</h3>
                    <span className="text-xs text-green-600 ml-auto">{task.totalSteps} 步 · {fmtDuration}</span>
                  </div>
                  <div className="text-sm text-green-900/80 whitespace-pre-wrap leading-relaxed max-h-[60vh] overflow-y-auto">{result}</div>
                </div>
              )}
              {isCompleted && !result && (
                <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                  <CheckCircle className="w-16 h-16 text-green-300 mb-4" />
                  <p className="text-lg font-medium text-green-600">任务已完成</p>
                  <p className="text-sm mt-1">{task.totalSteps} 步 · {fmtDuration}</p>
                  <p className="text-xs mt-3">详细输出请查看左侧步骤时间线</p>
                </div>
              )}

              {/* 失败：诊断面板 */}
              {isFailed && diagnosis && (
                <div className="rounded-2xl border border-red-200 bg-gradient-to-br from-red-50 to-orange-50/30 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <XCircle className="w-5 h-5 text-red-500" />
                    <h3 className="font-bold text-sm text-red-800">任务失败</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full ml-auto ${
                      diagnosis.severity === "high" ? "bg-red-100 text-red-700" : diagnosis.severity === "medium" ? "bg-orange-100 text-orange-700" : "bg-yellow-100 text-yellow-700"
                    }`}>{diagnosis.severity === "high" ? "需要处理" : diagnosis.severity === "medium" ? "可重试" : "轻微问题"}</span>
                  </div>
                  <div className="flex items-start gap-2 p-3 rounded-xl bg-red-100/50 mb-4">
                    <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
                    <p className="text-sm text-red-800">{diagnosis.reason}</p>
                  </div>
                  <p className="text-xs font-medium text-amber-800 mb-2 flex items-center gap-1"><Lightbulb className="w-3.5 h-3.5" /> 建议操作</p>
                  <ul className="space-y-1.5">
                    {diagnosis.suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-amber-900/80">
                        <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-700 text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 pt-3 border-t border-red-200/50">
                    <button onClick={onRetry} className="px-4 py-2 bg-blue-600 text-white text-sm rounded-xl hover:bg-blue-700 flex items-center gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> 重新执行
                    </button>
                  </div>
                </div>
              )}
              {isFailed && result && (
                <div className="rounded-2xl border bg-card p-5">
                  <h3 className="font-bold text-sm mb-2 flex items-center gap-2 text-muted-foreground"><FileText className="w-4 h-4" /> 部分执行结果</h3>
                  <div className="text-sm text-foreground/70 whitespace-pre-wrap max-h-[40vh] overflow-y-auto">{result}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <Terminal className="w-16 h-16 opacity-10 mb-4" />
              <p className="text-sm">沙箱面板将在任务执行时显示</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
