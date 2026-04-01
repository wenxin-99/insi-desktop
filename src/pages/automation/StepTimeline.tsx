/**
 * 网站运营助手 - 任务步骤时间线
 * 模板数据和类型已提取到 templates.tsx / types.ts
 */
import { useState } from "react";
import {
  AlertCircle, Bot, Clock, FileText, Globe,
  MessageSquare, MonitorPlay, Search, Terminal, Zap,
} from "lucide-react";
import type { TaskStep } from "./types";
import { apiFetch } from "./types";

export function StepTimeline({ steps, taskId }: { steps: TaskStep[]; taskId: number }) {
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [screenshots, setScreenshots] = useState<Record<number, string>>({});

  const loadScreenshot = async (stepId: number) => {
    if (screenshots[stepId]) return;
    try {
      const data = await apiFetch(`/tasks/${taskId}/steps/${stepId}/screenshot`);
      setScreenshots(prev => ({ ...prev, [stepId]: data.screenshot }));
    } catch { /* ignore */ }
  };

  const stepIconMap: Record<string, React.ReactNode> = {
    navigate: <Globe className="w-4 h-4 text-blue-500" />,
    click: <MonitorPlay className="w-4 h-4 text-green-500" />,
    input: <Terminal className="w-4 h-4 text-purple-500" />,
    think: <Bot className="w-4 h-4 text-yellow-500" />,
    search: <Search className="w-4 h-4 text-cyan-500" />,
    content_generate: <FileText className="w-4 h-4 text-pink-500" />,
    post: <MessageSquare className="w-4 h-4 text-indigo-500" />,
    wait: <Clock className="w-4 h-4 text-gray-400" />,
  };

  const stepLabelMap: Record<string, string> = {
    navigate: "导航", click: "点击", input: "输入", captcha: "验证码",
    think: "思考", search: "搜索", content_generate: "生成内容",
    post: "发帖", reply: "回复", wait: "等待", login: "登录", scroll: "滚动",
  };

  return (
    <div className="space-y-1">
      {steps.map((step, i) => (
        <div key={step.id} className="relative">
          {i < steps.length - 1 && <div className="absolute left-[17px] top-8 bottom-0 w-px bg-gray-200" />}
          <div
            className={`flex items-start gap-3 p-2 rounded-xl cursor-pointer transition-colors ${expandedStep === step.id ? "bg-blue-50" : "hover:bg-gray-50"}`}
            onClick={() => { setExpandedStep(expandedStep === step.id ? null : step.id); if (step.screenshotUrl) loadScreenshot(step.id); }}>
            <div className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${step.success ? "bg-green-100" : "bg-red-100"}`}>
              {stepIconMap[step.type] || <Zap className="w-4 h-4 text-gray-400" />}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-gray-400">#{step.stepNumber}</span>
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100">{stepLabelMap[step.type] || step.type}</span>
                {step.durationMs && <span className="text-xs text-gray-400">{step.durationMs}ms</span>}
                {!step.success && <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
              </div>
              <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{step.content}</p>
            </div>
          </div>
          {expandedStep === step.id && (
            <div className="ml-12 mt-1 mb-2 p-3 bg-gray-50 rounded-xl text-sm space-y-2">
              {step.selector && <div><span className="text-gray-500">选择器：</span><code className="text-xs bg-gray-200 px-1 rounded">{step.selector}</code></div>}
              {step.inputText && <div><span className="text-gray-500">输入：</span>{step.inputText}</div>}
              {step.errorMessage && <div className="text-red-600"><span className="text-gray-500">错误：</span>{step.errorMessage}</div>}
              {screenshots[step.id] && <img src={screenshots[step.id]} alt="步骤截图" className="w-full rounded-xl border shadow-sm" />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─────────────────── 实时沙箱面板 ───────────────────
