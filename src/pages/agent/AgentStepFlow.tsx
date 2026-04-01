/**
 * pages/agent/AgentStepFlow.tsx — 步骤时间线 + 流程图可视化
 *
 * 双模式：
 *   timeline — 纵向时间线（默认，适合移动端）
 *   flow     — 横向流程图（桌面端）
 *
 * 无需 reactflow 外部依赖，纯 SVG + CSS 实现。
 */
import { useState, useMemo } from "react";
import {
  Brain, Wrench, Eye, AlertTriangle, CheckCircle, FileText,
  ArrowRight, ChevronDown, ChevronUp, LayoutList, GitBranch,
  Play, X,
} from "lucide-react";
import type { AgentStep } from "./types";

const STEP_ICONS: Record<string, any> = {
  thought: Brain,
  action: Wrench,
  observation: Eye,
  error: AlertTriangle,
  complete: CheckCircle,
  summary: FileText,
};

const STEP_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  thought: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700" },
  action: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700" },
  observation: { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-600" },
  error: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700" },
  complete: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700" },
  summary: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700" },
};

interface Props {
  steps: AgentStep[];
  maxDisplay?: number;
}

export function AgentStepFlow({ steps, maxDisplay = 100 }: Props) {
  const [mode, setMode] = useState<"timeline" | "flow" | "replay">("timeline");
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);
  const [expandedScreenshot, setExpandedScreenshot] = useState<string | null>(null);

  // ★ P2⑦：筛选有截图的 action 步骤用于回放
  const screenshotSteps = useMemo(() =>
    steps.filter(s => s.type === "action" && s.metadata?.screenshotBase64),
  [steps]);

  const displaySteps = useMemo(() => {
    if (showAll) return steps;
    return steps.slice(-maxDisplay);
  }, [steps, maxDisplay, showAll]);

  const toggleExpand = (stepId: number) => {
    setExpandedSteps(prev => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId); else next.add(stepId);
      return next;
    });
  };

  if (steps.length === 0) {
    return (
      <div className="text-center text-muted-foreground text-sm py-10">
        <Brain className="w-10 h-10 mx-auto opacity-20 mb-2" />
        <p>等待执行步骤...</p>
      </div>
    );
  }

  return (
    <div>
      {/* 模式切换 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs text-muted-foreground">
          共 {steps.length} 步
          {steps.length > maxDisplay && !showAll && (
            <button onClick={() => setShowAll(true)} className="ml-2 text-primary hover:underline">显示全部</button>
          )}
        </span>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setMode("timeline")}
            className={`p-1.5 rounded-md text-xs ${mode === "timeline" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setMode("flow")}
            className={`p-1.5 rounded-md text-xs ${mode === "flow" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
          >
            <GitBranch className="w-3.5 h-3.5" />
          </button>
          {screenshotSteps.length > 0 && (
            <button
              onClick={() => setMode("replay")}
              className={`p-1.5 rounded-md text-xs ${mode === "replay" ? "bg-background shadow-sm" : "text-muted-foreground"}`}
              title="截图回放"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {mode === "timeline" ? (
        <TimelineView steps={displaySteps} expandedSteps={expandedSteps} toggleExpand={toggleExpand} onScreenshotClick={setExpandedScreenshot} />
      ) : mode === "replay" ? (
        <ReplayView steps={screenshotSteps} onScreenshotClick={setExpandedScreenshot} />
      ) : (
        <FlowView steps={displaySteps} />
      )}

      {/* ★ P2⑦：截图全屏弹窗 */}
      {expandedScreenshot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-6 cursor-pointer" onClick={() => setExpandedScreenshot(null)}>
          <img src={expandedScreenshot} alt="截图" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" onClick={e => e.stopPropagation()} />
          <button onClick={() => setExpandedScreenshot(null)} className="absolute top-4 right-4 text-white/60 hover:text-white bg-black/40 rounded-full p-2"><X className="w-5 h-5" /></button>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════
// Timeline Mode
// ═══════════════════════════════════════════

function TimelineView({ steps, expandedSteps, toggleExpand, onScreenshotClick }: {
  steps: AgentStep[];
  expandedSteps: Set<number>;
  toggleExpand: (id: number) => void;
  onScreenshotClick?: (src: string) => void;
}) {
  return (
    <div className="relative">
      {/* 连接线 */}
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border" />

      {steps.map((step, i) => {
        const Icon = STEP_ICONS[step.type || "action"] || Wrench;
        const colors = STEP_COLORS[step.type || "action"] || STEP_COLORS.action;
        const isExpanded = expandedSteps.has(step.id);
        const content = step.observation || step.toolInput || "";
        const isLong = content.length > 150;
        const durationMs = step.metadata?.durationMs;

        return (
          <div key={step.id} className="relative flex gap-3 pb-4">
            {/* 图标节点 */}
            <div className={`relative z-10 flex-shrink-0 w-10 h-10 rounded-xl ${colors.bg} ${colors.border} border flex items-center justify-center`}>
              <Icon className={`w-4 h-4 ${colors.text}`} />
            </div>

            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`text-xs font-medium ${colors.text}`}>
                  #{step.stepNumber} {step.type}
                </span>
                {step.toolName && (
                  <span className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                    {step.toolName}
                  </span>
                )}
                {durationMs && (
                  <span className="text-xs text-muted-foreground">
                    {durationMs > 1000 ? `${(durationMs / 1000).toFixed(1)}s` : `${durationMs}ms`}
                  </span>
                )}
              </div>

              <div
                className={`text-sm text-foreground/80 ${!isExpanded && isLong ? "line-clamp-3" : ""}`}
                style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
              >
                {content.substring(0, isExpanded ? undefined : 500)}
              </div>

              {isLong && (
                <button
                  onClick={() => toggleExpand(step.id)}
                  className="text-xs text-primary mt-1 flex items-center gap-0.5 hover:underline"
                >
                  {isExpanded ? <><ChevronUp className="w-3 h-3" />收起</> : <><ChevronDown className="w-3 h-3" />展开全部</>}
                </button>
              )}

              {/* 截图缩略图 */}
              {step.metadata?.screenshotBase64 && (
                <img
                  src={`data:image/jpeg;base64,${step.metadata.screenshotBase64}`}
                  alt="截图"
                  className="mt-2 w-48 h-auto rounded-lg border shadow-sm cursor-pointer hover:opacity-90 hover:shadow-md transition-all"
                  onClick={() => onScreenshotClick?.(`data:image/jpeg;base64,${step.metadata.screenshotBase64}`)}
                />
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════
// ★ P2⑦ Replay Mode (截图回放)
// ═══════════════════════════════════════════

function ReplayView({ steps, onScreenshotClick }: {
  steps: AgentStep[];
  onScreenshotClick?: (src: string) => void;
}) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const step = steps[currentIdx];
  if (!step) return <div className="text-center text-muted-foreground py-10 text-sm">无可回放的截图步骤</div>;

  const src = `data:image/jpeg;base64,${step.metadata?.screenshotBase64 || ""}`;
  const total = steps.length;

  return (
    <div className="space-y-3">
      {/* 截图主体 */}
      <div className="relative rounded-xl overflow-hidden border bg-muted/10 cursor-pointer" onClick={() => onScreenshotClick?.(src)}>
        <img src={src} alt={`步骤 ${step.stepNumber}`} className="w-full h-auto" />
        {/* 步骤信息叠加 */}
        <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
          <div className="text-white text-xs font-medium">
            #{step.stepNumber} {step.toolName || step.type}
          </div>
          <div className="text-white/70 text-[10px] line-clamp-1">
            {step.observation?.substring(0, 100) || ""}
          </div>
        </div>
      </div>

      {/* 进度条 + 控制 */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))}
          disabled={currentIdx === 0}
          className="text-xs px-2 py-1 rounded-lg border hover:bg-muted disabled:opacity-30"
        >
          ← 上一步
        </button>

        {/* 进度条 */}
        <div className="flex-1 flex items-center gap-0.5">
          {steps.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIdx(i)}
              className={`flex-1 h-1.5 rounded-full transition-colors ${
                i === currentIdx ? "bg-primary" : i < currentIdx ? "bg-primary/40" : "bg-muted"
              }`}
            />
          ))}
        </div>

        <button
          onClick={() => setCurrentIdx(Math.min(total - 1, currentIdx + 1))}
          disabled={currentIdx >= total - 1}
          className="text-xs px-2 py-1 rounded-lg border hover:bg-muted disabled:opacity-30"
        >
          下一步 →
        </button>
      </div>

      <div className="text-center text-[10px] text-muted-foreground">
        {currentIdx + 1} / {total} 步
        {step.metadata?.durationMs && ` · ${step.metadata.durationMs > 1000 ? `${(step.metadata.durationMs / 1000).toFixed(1)}s` : `${step.metadata.durationMs}ms`}`}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// Flow Mode (横向流程图)
// ═══════════════════════════════════════════

function FlowView({ steps }: { steps: AgentStep[] }) {
  // 将步骤分组为 think→act→observe 三元组
  const groups = useMemo(() => {
    const result: Array<{ thought?: AgentStep; action?: AgentStep; observe?: AgentStep }> = [];
    let current: { thought?: AgentStep; action?: AgentStep; observe?: AgentStep } = {};

    for (const step of steps) {
      if (step.type === "thought") {
        if (current.thought) result.push(current);
        current = { thought: step };
      } else if (step.type === "action") {
        current.action = step;
      } else {
        current.observe = step;
        result.push(current);
        current = {};
      }
    }
    if (current.thought || current.action) result.push(current);
    return result;
  }, [steps]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="flex items-start gap-2 min-w-max">
        {groups.map((group, i) => (
          <div key={i} className="flex items-center gap-1">
            <div className="flex flex-col gap-1 items-center min-w-[120px]">
              {/* 思考 */}
              {group.thought && (
                <div className="w-full p-2 rounded-xl bg-amber-50 border border-amber-200 text-xs">
                  <div className="flex items-center gap-1 text-amber-700 font-medium mb-0.5">
                    <Brain className="w-3 h-3" /> 思考
                  </div>
                  <p className="text-amber-900/70 line-clamp-2">{group.thought.observation?.substring(0, 80)}</p>
                </div>
              )}
              {/* 行动 */}
              {group.action && (
                <div className="w-full p-2 rounded-xl bg-blue-50 border border-blue-200 text-xs">
                  <div className="flex items-center gap-1 text-blue-700 font-medium mb-0.5">
                    <Wrench className="w-3 h-3" /> {group.action.toolName || "执行"}
                  </div>
                  <p className="text-blue-900/70 line-clamp-2">{(group.action.observation || group.action.toolInput || "").substring(0, 80)}</p>
                </div>
              )}
              {/* 观察 */}
              {group.observe && (
                <div className="w-full p-2 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                  <div className="flex items-center gap-1 text-slate-600 font-medium mb-0.5">
                    <Eye className="w-3 h-3" /> 观察
                  </div>
                  <p className="text-slate-500 line-clamp-2">{group.observe.observation?.substring(0, 80)}</p>
                </div>
              )}
            </div>
            {i < groups.length - 1 && (
              <ArrowRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
