/**
 * ProgressTracker — ```progress 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为进度追踪器（学习计划/项目规划等）。
 * 任务可在前端勾选（React state，不持久化）。
 *
 * JSON Schema:
 * {
 *   "title": "Python 学习路线",
 *   "phases": [
 *     {
 *       "name": "基础语法",
 *       "duration": "2周",
 *       "tasks": [
 *         {"text": "变量和数据类型", "done": true},
 *         {"text": "控制流程", "done": false}
 *       ]
 *     }
 *   ]
 * }
 */

import { memo, useState, useRef, useEffect } from 'react';
import { Target, ChevronDown, ChevronRight, CheckCircle2, Circle, Clock, RotateCcw, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════

interface ProgressTask {
  text: string;
  done?: boolean;
}

interface ProgressPhase {
  name: string;
  duration?: string;
  tasks: ProgressTask[];
}

interface ProgressData {
  title?: string;
  phases: ProgressPhase[];
}

interface ProgressTrackerProps {
  jsonStr: string;
  streaming?: boolean;
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

/** 生成稳定的存储 key（基于 title + 任务结构的简单 hash） */
function getStorageKey(data: ProgressData): string {
  const fingerprint = (data.title || '') + '|' + data.phases.map(p => p.name + ':' + p.tasks.map(t => t.text).join(',')).join(';');
  let h = 0;
  for (let i = 0; i < fingerprint.length; i++) h = ((h << 5) - h + fingerprint.charCodeAt(i)) | 0;
  return `insi_progress_${Math.abs(h).toString(36)}`;
}

/** 从 localStorage 加载任务状态 */
function loadTaskStates(key: string): Map<string, boolean> | null {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return null;
    const obj = JSON.parse(stored) as Record<string, boolean>;
    return new Map(Object.entries(obj));
  } catch { return null; }
}

/** 保存任务状态到 localStorage */
function saveTaskStates(key: string, states: Map<string, boolean>) {
  try {
    const obj: Record<string, boolean> = {};
    states.forEach((v, k) => { obj[k] = v; });
    localStorage.setItem(key, JSON.stringify(obj));
  } catch { /* quota exceeded or private mode */ }
}

function ProgressTrackerInner({ jsonStr, streaming }: ProgressTrackerProps) {
  let initialData: ProgressData | null = null;
  {
    const r = safeParseJson<any>(jsonStr);
    if (Array.isArray(r.data)) {
      initialData = { phases: r.data };
    } else {
      initialData = r.data;
    }
  }

  // ★ 用 state 管理任务完成状态（可交互勾选 + localStorage 持久化）
  const [taskStates, setTaskStates] = useState<Map<string, boolean>>(new Map());
  const initializedRef = useRef(false);
  const storageKeyRef = useRef('');

  const [collapsedPhases, setCollapsedPhases] = useState<Set<number>>(new Set());
  const [shareOk, setShareOk] = useState(false);

  // 当数据首次解析成功时，同步初始状态（优先从 localStorage 恢复）
  useEffect(() => {
    if (initialData && !initializedRef.current) {
      initializedRef.current = true;
      const sKey = getStorageKey(initialData);
      storageKeyRef.current = sKey;

      // 尝试从 localStorage 恢复
      const saved = loadTaskStates(sKey);
      if (saved && saved.size > 0) {
        setTaskStates(saved);
      } else {
        // 首次：使用 AI 提供的 done 状态
        const map = new Map<string, boolean>();
        initialData.phases.forEach((p, pi) => {
          p.tasks.forEach((t, ti) => {
            map.set(`${pi}-${ti}`, !!t.done);
          });
        });
        setTaskStates(map);
      }
    }
  }, [initialData]);

  const toggleTask = (phaseIdx: number, taskIdx: number) => {
    const key = `${phaseIdx}-${taskIdx}`;
    setTaskStates(prev => {
      const next = new Map(prev);
      next.set(key, !next.get(key));
      // ★ 持久化到 localStorage
      if (storageKeyRef.current) saveTaskStates(storageKeyRef.current, next);
      return next;
    });
  };

  const togglePhase = (idx: number) => {
    setCollapsedPhases(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  // ★ 重置进度（清除 localStorage 并恢复 AI 初始状态）
  const resetProgress = () => {
    if (!initialData) return;
    const map = new Map<string, boolean>();
    initialData.phases.forEach((p, pi) => {
      p.tasks.forEach((t, ti) => {
        map.set(`${pi}-${ti}`, !!t.done);
      });
    });
    setTaskStates(map);
    if (storageKeyRef.current) {
      try { localStorage.removeItem(storageKeyRef.current); } catch { /* ignore */ }
    }
  };

  // ═══════ 流式骨架 ═══════
  if (!initialData && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4 text-violet-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '进度规划生成中...'}</h3>
          </div>
          <div className="h-3 w-full rounded-full bg-muted animate-pulse mb-3" />
          <div className="space-y-2">
            {[0, 1].map(i => (
              <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-300 via-violet-500 to-violet-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // ═══════ 解析失败降级 ═══════
  if (!initialData) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>进度数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const phases = initialData.phases || [];

  // 计算总进度
  let totalTasks = 0;
  let completedTasks = 0;
  phases.forEach((p, pi) => {
    p.tasks.forEach((_, ti) => {
      totalTasks++;
      if (taskStates.get(`${pi}-${ti}`)) completedTasks++;
    });
  });
  const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // ★ 分享进度（生成文字摘要复制到剪贴板）
  const shareProgress = async () => {
    const title = initialData.title || '进度追踪';
    const lines = [`📊 ${title} — ${pct}% 完成 (${completedTasks}/${totalTasks})`, ''];
    phases.forEach((phase, pi) => {
      const pDone = phase.tasks.filter((_, ti) => taskStates.get(`${pi}-${ti}`)).length;
      lines.push(`▸ ${phase.name} (${pDone}/${phase.tasks.length})`);
      phase.tasks.forEach((task, ti) => {
        const done = !!taskStates.get(`${pi}-${ti}`);
        lines.push(`  ${done ? '✅' : '⬜'} ${task.text}`);
      });
      lines.push('');
    });
    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setShareOk(true);
      setTimeout(() => setShareOk(false), 1500);
    } catch { /* ignore */ }
  };

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* ═══════ 标题栏 ═══════ */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-medium">{initialData.title || '进度追踪'}</h3>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground">
            {completedTasks}/{totalTasks} 完成
          </span>
          <div className="flex items-center gap-0.5">
            <button onClick={shareProgress} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title={shareOk ? '已复制' : '分享进度'}>
              {shareOk ? <CheckCircle2 className="w-3 h-3 text-emerald-500" /> : <Share2 className="w-3 h-3" />}
            </button>
            {completedTasks > 0 && (
              <button onClick={resetProgress} className="p-1 text-muted-foreground hover:text-foreground transition-colors" title="重置进度">
                <RotateCcw className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ═══════ 总进度条 ═══════ */}
      <div className="px-4 pt-3 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs font-bold text-violet-600 dark:text-violet-400 tabular-nums w-10 text-right">{pct}%</span>
        </div>
      </div>

      {/* ═══════ 阶段列表 ═══════ */}
      <div className="px-4 pb-3 space-y-2">
        {phases.map((phase, pi) => {
          const collapsed = collapsedPhases.has(pi);
          const phaseDone = phase.tasks.every((_, ti) => taskStates.get(`${pi}-${ti}`));
          const phaseProgress = phase.tasks.length > 0
            ? phase.tasks.filter((_, ti) => taskStates.get(`${pi}-${ti}`)).length
            : 0;

          return (
            <div key={pi} className="rounded-lg border border-border/60 overflow-hidden">
              {/* 阶段头 */}
              <button
                onClick={() => togglePhase(pi)}
                className="w-full flex items-center gap-2 px-3 py-2 hover:bg-muted/30 transition-colors"
              >
                {collapsed ? <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                <div className={cn(
                  'w-2 h-2 rounded-full flex-shrink-0',
                  phaseDone ? 'bg-emerald-500' : phaseProgress > 0 ? 'bg-violet-500' : 'bg-muted-foreground/30'
                )} />
                <span className="text-xs font-semibold text-foreground flex-1 text-left">{phase.name}</span>
                {phase.duration && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />{phase.duration}
                  </span>
                )}
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {phaseProgress}/{phase.tasks.length}
                </span>
              </button>

              {/* 任务列表 */}
              {!collapsed && (
                <div className="px-3 pb-2 space-y-1">
                  {phase.tasks.map((task, ti) => {
                    const done = !!taskStates.get(`${pi}-${ti}`);
                    return (
                      <button
                        key={ti}
                        onClick={() => toggleTask(pi, ti)}
                        className="w-full flex items-center gap-2 py-1 px-1 rounded hover:bg-muted/30 transition-colors group"
                      >
                        {done ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-muted-foreground/40 group-hover:text-muted-foreground flex-shrink-0" />
                        )}
                        <span className={cn(
                          'text-xs text-left',
                          done ? 'text-muted-foreground line-through' : 'text-foreground'
                        )} style={{ overflowWrap: 'anywhere' }}>
                          {task.text}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ProgressTracker = memo(ProgressTrackerInner);
