/**
 * ImageGenerationProgress — 图片生成专用进度组件
 *
 * 从 operationLogs 中自动识别图片生成步骤，渲染 4 阶段富进度 UI：
 *   1. 解析画面需求
 *   2. 优化提示词（含 prompt 预览）
 *   3. AI 生成图片（含进度动画）
 *   4. 完成 / 失败
 *
 * 复用服务端 sendOperationStatus 发送的现有 operationLogs 数据，
 * 无需新增 SSE 事件类型或前端状态管道。
 */
import { useState, useEffect, useRef } from 'react';
import {
  Eye, Wand2, Cpu, Sparkles,
  CheckCircle2, Loader2, Clock, ChevronRight, ChevronDown,
  AlertCircle, ImageIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══ Types ═══
interface OperationLog {
  id: string;
  action: string;
  target?: string;
  operationStatus: 'running' | 'completed';
  timestamp: number;
}

interface ImageGenerationProgressProps {
  operations: OperationLog[];
  isLive?: boolean;
}

// ═══ 阶段定义 ═══
const STAGES = [
  { key: 'analyze',   icon: Eye,      label: '解析画面需求' },
  { key: 'optimize',  icon: Wand2,    label: '优化提示词' },
  { key: 'generate',  icon: Cpu,      label: 'AI 生成图片' },
  { key: 'done',      icon: Sparkles, label: '生成完成' },
] as const;

// ═══ 从 operationLogs 推导当前阶段 ═══
function deriveStageFromOps(ops: OperationLog[]) {
  let currentStage = 0; // analyze
  let prompt = '';
  let isError = false;
  let errorMsg = '';
  let isSafetyError = false;
  let safetySuggestion = '';
  let isDone = false;
  const stageTimes: (number | null)[] = [null, null, null, null];

  for (const op of ops) {
    if (op.action.includes('解析画面需求')) {
      if (op.operationStatus === 'completed') {
        currentStage = Math.max(currentStage, 1);
        stageTimes[0] = op.timestamp;
      }
    } else if (op.action.includes('优化提示词')) {
      currentStage = Math.max(currentStage, 1);
      if (op.target) prompt = op.target;
      if (op.operationStatus === 'completed') {
        currentStage = Math.max(currentStage, 2);
        stageTimes[1] = op.timestamp;
      }
    } else if (op.action.includes('正在生成图片') || op.action.includes('生成图片')) {
      currentStage = Math.max(currentStage, 2);
    } else if (op.action.includes('图片生成完成')) {
      currentStage = 3;
      isDone = true;
      stageTimes[2] = op.timestamp;
      stageTimes[3] = op.timestamp;
    } else if (op.action.includes('图片生成失败')) {
      currentStage = 2;
      isError = true;
      const raw = op.target || '生成失败';
      // ★ 解析结构化安全错误（包含 💡 suggestion）
      if (raw.includes('安全审核') || raw.includes('安全策略')) {
        isSafetyError = true;
        const parts = raw.split('\n\n💡 ');
        errorMsg = parts[0];
        safetySuggestion = parts[1] || '';
      } else {
        errorMsg = raw;
      }
    }
  }

  return { currentStage, prompt, isError, errorMsg, isSafetyError, safetySuggestion, isDone, stageTimes };
}

// ═══ 检测是否是图片生成流程 ═══
export function isImageGenerationFlow(ops: OperationLog[]): boolean {
  return ops.some(op =>
    op.action.includes('解析画面需求') ||
    op.action.includes('优化提示词') ||
    op.action.includes('生成图片')
  );
}

// ═══ 主组件 ═══
export function ImageGenerationProgress({ operations, isLive }: ImageGenerationProgressProps) {
  const [promptExpanded, setPromptExpanded] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef(Date.now());
  const autoCollapseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const derived = deriveStageFromOps(operations);
  
  // 非实时模式（历史消息）：强制显示为完成状态，且默认折叠
  const { currentStage, prompt, isError, errorMsg, isSafetyError, safetySuggestion, isDone } = isLive
    ? derived
    : { ...derived, currentStage: derived.isError ? derived.currentStage : 3, isDone: !derived.isError };

  // 历史消息默认折叠
  useEffect(() => {
    if (!isLive && (isDone || isError)) {
      setCollapsed(true);
    }
  }, [isLive]);

  // 实时模式：完成后 1.5s 自动折叠
  useEffect(() => {
    if (isLive && (isDone || isError)) {
      autoCollapseTimerRef.current = setTimeout(() => setCollapsed(true), 1500);
    }
    return () => {
      if (autoCollapseTimerRef.current) clearTimeout(autoCollapseTimerRef.current);
    };
  }, [isLive, isDone, isError]);

  // 计时
  useEffect(() => {
    if (!isLive || isDone) return;
    startRef.current = Date.now();
    const t = setInterval(() => setElapsed((Date.now() - startRef.current) / 1000), 100);
    return () => clearInterval(t);
  }, [isLive, isDone]);

  return (
    <div className="mb-3">
      {/* ═══ 标题栏（完成/失败后可点击折叠） ═══ */}
      <div
        className={cn(
          "flex items-center gap-2",
          collapsed ? "mb-0" : "mb-3",
          (isDone || isError) && "cursor-pointer select-none"
        )}
        onClick={() => { if (isDone || isError) setCollapsed(!collapsed); }}
      >
        <div className={cn(
          "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
          isDone ? "bg-emerald-100 dark:bg-emerald-900/30" 
            : (isError && isSafetyError) ? "bg-amber-100 dark:bg-amber-900/30"
            : isError ? "bg-red-100 dark:bg-red-900/30"
            : "bg-violet-100 dark:bg-violet-900/30"
        )}>
          {isDone ? <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
            : (isError && isSafetyError) ? <AlertCircle className="h-4 w-4 text-amber-500" />
            : isError ? <AlertCircle className="h-4 w-4 text-red-500" />
            : <ImageIcon className="h-4 w-4 text-violet-600 dark:text-violet-400" />}
        </div>
        <span className="text-sm font-semibold text-foreground">
          {isDone ? 'AI 图片生成完成' : (isError && isSafetyError) ? '图片内容审核未通过' : isError ? '图片生成失败' : 'AI 图片生成'}
        </span>
        {/* 折叠/展开指示 */}
        {(isDone || isError) && (
          <ChevronDown className={cn(
            "h-3.5 w-3.5 text-muted-foreground/50 transition-transform duration-200",
            !collapsed && "rotate-180"
          )} />
        )}
        {elapsed > 0 && !collapsed && (
          <span className="text-[11px] text-muted-foreground/50 tabular-nums ml-auto flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {elapsed.toFixed(1)}s
          </span>
        )}
      </div>

      {/* ═══ 阶段列表（可折叠） ═══ */}
      <div className={cn(
        "ml-1 space-y-1 overflow-hidden transition-all duration-300 ease-in-out",
        collapsed ? "max-h-0 opacity-0" : "max-h-[500px] opacity-100 mt-2"
      )}>
        {STAGES.map((stage, i) => {
          const Icon = stage.icon;
          const isDoneStep = i < currentStage || isDone;
          const isActive = i === currentStage && !isDone && !isError;
          const isErrorStep = isError && i === currentStage;
          const isPending = i > currentStage && !isDone;

          if (isPending && i > currentStage + 1) return null;

          return (
            <div key={stage.key} className={cn(
              "transition-all duration-300",
              isPending && "opacity-30"
            )}>
              {/* 步骤行 */}
              <div className="flex items-center gap-2.5 py-1">
                <div className={cn(
                  "w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-all duration-300",
                  isDoneStep ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400"
                    : isActive ? "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400"
                    : (isErrorStep && isSafetyError) ? "bg-amber-100 text-amber-500 dark:bg-amber-900/40 dark:text-amber-400"
                    : isErrorStep ? "bg-red-100 text-red-500 dark:bg-red-900/40 dark:text-red-400"
                    : "bg-muted text-muted-foreground/30"
                )}>
                  {isDoneStep ? <CheckCircle2 className="h-3 w-3" />
                    : isActive ? <Loader2 className="h-3 w-3 animate-spin" />
                    : isErrorStep ? <AlertCircle className="h-3 w-3" />
                    : <Icon className="h-3 w-3" />}
                </div>
                <span className={cn(
                  "text-[13px] transition-colors",
                  isDoneStep ? "text-foreground/80"
                    : isActive ? "text-violet-700 dark:text-violet-300 font-semibold"
                    : (isErrorStep && isSafetyError) ? "text-amber-600 dark:text-amber-400 font-semibold"
                    : isErrorStep ? "text-red-600 dark:text-red-400 font-semibold"
                    : "text-muted-foreground/40"
                )}>
                  {isErrorStep ? (isSafetyError ? '内容审核拦截' : '生成失败') : stage.label}
                </span>
              </div>

              {/* Prompt 预览（优化提示词阶段） */}
              {stage.key === 'optimize' && prompt && (isDoneStep || isActive) && (
                <div
                  className="ml-[30px] mt-0.5 mb-1 cursor-pointer"
                  onClick={() => setPromptExpanded(!promptExpanded)}
                >
                  <div className={cn(
                    "px-2.5 py-1.5 rounded-lg border text-[11px] leading-relaxed transition-all",
                    "bg-violet-50/60 border-violet-200/50 text-violet-700",
                    "dark:bg-violet-950/20 dark:border-violet-800/30 dark:text-violet-300",
                    promptExpanded ? "max-h-[200px]" : "max-h-[36px]",
                    "overflow-hidden relative"
                  )}>
                    <span className="font-semibold text-violet-500 dark:text-violet-400">Prompt: </span>
                    {prompt}
                    {!promptExpanded && prompt.length > 60 && (
                      <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-violet-50/90 dark:from-violet-950/80 to-transparent flex items-end justify-center">
                        <ChevronRight className="h-2.5 w-2.5 rotate-90 text-violet-400" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* 生成中进度动画 */}
              {stage.key === 'generate' && isActive && (
                <div className="ml-[30px] mt-1 mb-1">
                  <div className="h-1.5 rounded-full bg-violet-100 dark:bg-violet-900/30 overflow-hidden w-48">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-violet-500 to-purple-500"
                      style={{
                        animation: 'imageGenPulse 2s ease-in-out infinite',
                      }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground/50 mt-1">
                    AI 正在绘制画面，通常需要 10-30 秒...
                  </p>
                </div>
              )}

              {/* 错误详情 */}
              {isErrorStep && errorMsg && (
                isSafetyError ? (
                  <div className="ml-[30px] mt-1.5 mb-1.5">
                    <div className="rounded-lg border border-amber-200 bg-amber-50/80 dark:border-amber-800/40 dark:bg-amber-950/20 px-3 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className="text-amber-600 dark:text-amber-400 text-base mt-0.5 shrink-0">🛡️</span>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-amber-800 dark:text-amber-300 leading-relaxed">
                            {errorMsg}
                          </p>
                          {safetySuggestion && (
                            <p className="text-[11px] text-amber-700/80 dark:text-amber-400/70 mt-1.5 leading-relaxed">
                              💡 {safetySuggestion}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="ml-[30px] mt-1 mb-1 text-[11px] text-red-500/80 dark:text-red-400/80">
                    {errorMsg}
                  </div>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* CSS 动画 */}
      <style>{`
        @keyframes imageGenPulse {
          0% { width: 15%; opacity: 0.7; }
          50% { width: 75%; opacity: 1; }
          100% { width: 15%; opacity: 0.7; }
        }
      `}</style>
    </div>
  );
}
