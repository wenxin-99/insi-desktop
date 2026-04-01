/**
 * InsightCard — 对话内富文本分析卡片
 *
 * 支持多种卡片类型：
 *   - gap-analysis: 差距分析（已有/差距/优化标签）
 *   - comparison:   对比卡片（A vs B 带评分）
 *   - checklist:    检查清单（✓/✗ 状态）
 *   - metrics:      数据指标卡片
 *   - steps:        步骤/路线图卡片
 *
 * 使用方式（AI 输出）：
 * ```insight-card
 * { "type": "gap-analysis", "title": "...", "items": [...] }
 * ```
 */

import { memo, useState } from 'react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';
import { ChevronDown, ChevronUp } from 'lucide-react';

// ═══════ 类型定义 ═══════

interface GapItem {
  tag: 'has' | 'gap' | 'opt';
  title: string;
  desc?: string;
  fix?: string;
}

interface ComparisonRow {
  dim: string;
  a: string;
  b: string;
  winner?: 'a' | 'b' | 'tie';
}

interface CheckItem {
  label: string;
  checked: boolean;
  note?: string;
}

interface MetricItem {
  label: string;
  value: string | number;
  change?: string;       // "+12%" or "-3%"
  status?: 'up' | 'down' | 'neutral';
}

interface StepItem {
  label: string;
  desc?: string;
  status?: 'done' | 'active' | 'pending';
  effort?: string;
}

type CardData =
  | { type: 'gap-analysis'; title: string; subtitle?: string; score?: string; items: GapItem[] }
  | { type: 'comparison'; title: string; labelA: string; labelB: string; rows: ComparisonRow[]; conclusion?: string }
  | { type: 'checklist'; title: string; items: CheckItem[] }
  | { type: 'metrics'; title: string; items: MetricItem[] }
  | { type: 'steps'; title: string; items: StepItem[] };

// ═══════ Tag 样式 ═══════

const TAG_STYLES = {
  has: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 border border-green-200 dark:border-green-700',
  gap: 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200 border border-red-200 dark:border-red-700',
  opt: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-200 border border-amber-200 dark:border-amber-700',
} as const;

const TAG_LABELS = { has: '已有', gap: '差距', opt: '优化' } as const;

// ★ Badge 语义色彩检测 —— 根据 effort 文字内容自动分配颜色
type BadgeSemantic = 'wait' | 'low' | 'medium' | 'high' | 'duration' | 'neutral';

function detectBadgeSemantic(effort: string): BadgeSemantic {
  const t = effort.trim().toLowerCase();
  // 等待/审核类
  if (/等待|审核|审批|排队|pending|waiting|review/i.test(t)) return 'wait';
  // 时间跨度（含"工作日"/"天"/"周"/"月"等）
  if (/\d+\s*[-~到至]\s*\d+\s*(个?工作日|天|日|周|月|小时)/i.test(t)) return 'duration';
  if (/工作日|个月|business.?day/i.test(t)) return 'duration';
  // 难度/工作量
  if (/^(低|简单|easy|low|快速|一次性)$/i.test(t)) return 'low';
  if (/^(中|中等|moderate|medium|适中)$/i.test(t)) return 'medium';
  if (/^(高|复杂|困难|hard|high|繁琐)$/i.test(t)) return 'high';
  // 纯时间数字
  if (/^\d+\s*(分钟|min|小时|h|天|d)$/i.test(t)) return 'low';
  return 'neutral';
}

const BADGE_STYLES: Record<BadgeSemantic, string> = {
  wait:     'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700',
  duration: 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-300 dark:border-amber-700',
  low:      'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
  medium:   'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800',
  high:     'text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800',
  neutral:  'text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 border-indigo-200 dark:border-indigo-800',
};

// ★ 圆点颜色：根据 effort badge 语义自动区分用户操作 vs 被动等待
function getDotColor(item: StepItem): string {
  if (item.status === 'done') return 'bg-green-500';
  if (item.status === 'active') return 'bg-blue-500 animate-pulse';
  // pending 状态根据 effort 区分
  if (item.effort) {
    const sem = detectBadgeSemantic(item.effort);
    if (sem === 'wait' || sem === 'duration') return 'bg-amber-400';
    if (sem === 'high') return 'bg-rose-400';
  }
  return 'bg-indigo-400';
}

// ★ 连接线颜色：跟随下一个圆点的语义
function getLineColor(nextItem: StepItem): string {
  if (nextItem.effort) {
    const sem = detectBadgeSemantic(nextItem.effort);
    if (sem === 'wait' || sem === 'duration') return 'bg-amber-200 dark:bg-amber-800';
  }
  return 'bg-indigo-200 dark:bg-indigo-800';
}

// ═══════ 子组件 ═══════

function GapAnalysisCard({ data }: { data: Extract<CardData, { type: 'gap-analysis' }> }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">{data.title}</h3>
        {data.score && <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">{data.score}</span>}
      </div>
      {data.subtitle && <p className="text-sm text-foreground/70 mb-3">{data.subtitle}</p>}
      {(data.items || []).map((item, i) => (
        <div key={i} className="flex gap-3 py-3 border-b border-border/40 last:border-0">
          <span className={cn('text-[11px] font-semibold px-2.5 py-0.5 rounded self-start mt-0.5 whitespace-nowrap', TAG_STYLES[item.tag])}>
            {TAG_LABELS[item.tag]}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-foreground">{item.title}</div>
            {item.desc && <div className="text-[13px] text-foreground/65 mt-1 leading-relaxed">{item.desc}</div>}
            {item.fix && <div className="text-[13px] text-blue-600 dark:text-blue-400 mt-1.5">{item.fix}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComparisonCard({ data }: { data: Extract<CardData, { type: 'comparison' }> }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">{data.title}</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/60">
              <th className="text-left py-2 pr-3 text-foreground/60 font-semibold">维度</th>
              <th className="text-left py-2 px-3 font-semibold text-foreground">{data.labelA || 'A'}</th>
              <th className="text-left py-2 px-3 font-semibold text-foreground">{data.labelB || 'B'}</th>
              <th className="text-center py-2 pl-3 text-foreground/60 font-semibold w-12">胜出</th>
            </tr>
          </thead>
          <tbody>
            {(data.rows || []).map((row, i) => (
              <tr key={i} className="border-b border-border/30 last:border-0">
                <td className="py-2.5 pr-3 text-foreground/60 whitespace-nowrap">{row.dim}</td>
                <td className={cn('py-2.5 px-3 text-foreground/80', row.winner === 'a' && 'font-semibold text-green-700 dark:text-green-400')}>{row.a}</td>
                <td className={cn('py-2.5 px-3 text-foreground/80', row.winner === 'b' && 'font-semibold text-green-700 dark:text-green-400')}>{row.b}</td>
                <td className="py-2.5 pl-3 text-center text-foreground/60">
                  {row.winner === 'a' ? (data.labelA || 'A').charAt(0) : row.winner === 'b' ? (data.labelB || 'B').charAt(0) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.conclusion && <p className="text-[13px] text-foreground/60 mt-3 pt-2 border-t border-border/40">{data.conclusion}</p>}
    </div>
  );
}

function ChecklistCard({ data }: { data: Extract<CardData, { type: 'checklist' }> }) {
  // ★ 交互式 checklist：本地状态管理勾选
  const [checkedState, setCheckedState] = useState<boolean[]>(() =>
    (data.items || []).map(item => !!item.checked)
  );

  const toggle = (index: number) => {
    setCheckedState(prev => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  };

  const total = checkedState.length;
  const done = checkedState.filter(Boolean).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-foreground">{data.title}</h3>
        <span className="text-xs text-muted-foreground tabular-nums">{done}/{total}</span>
      </div>
      {/* 进度条 */}
      <div className="h-1.5 rounded-full bg-muted mb-3 overflow-hidden">
        <div
          className={cn(
            'h-full rounded-full transition-all duration-300',
            pct === 100 ? 'bg-green-500' : 'bg-blue-500',
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="space-y-0.5">
        {(data.items || []).map((item, i) => {
          const isChecked = checkedState[i] ?? false;
          return (
            <label
              key={i}
              className="flex items-start gap-2.5 py-1.5 cursor-pointer group hover:bg-accent/30 rounded-md px-1 -mx-1 transition-colors"
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => toggle(i)}
                className="mt-1 h-4 w-4 rounded border-2 border-border text-primary focus:ring-primary/30 cursor-pointer accent-primary"
              />
              <div className="flex-1 select-none">
                <span className={cn(
                  'text-sm transition-all duration-200',
                  isChecked ? 'text-foreground/50 line-through' : 'text-foreground'
                )}>
                  {item.label}
                </span>
                {item.note && <span className="text-[13px] text-foreground/50 ml-2">{item.note}</span>}
              </div>
            </label>
          );
        })}
      </div>
      {pct === 100 && (
        <div className="mt-2 text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
          ✅ 全部完成！
        </div>
      )}
    </div>
  );
}

function MetricsCard({ data }: { data: Extract<CardData, { type: 'metrics' }> }) {
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">{data.title}</h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {(data.items || []).map((item, i) => (
          <div key={i} className="bg-muted/50 rounded-lg p-3">
            <div className="text-[12px] text-foreground/55 mb-1">{item.label}</div>
            <div className="text-lg font-semibold text-foreground">{item.value}</div>
            {item.change && (
              <div className={cn('text-[12px] font-medium mt-0.5',
                item.status === 'up' ? 'text-green-600 dark:text-green-400' :
                item.status === 'down' ? 'text-red-500 dark:text-red-400' : 'text-foreground/50'
              )}>
                {item.change}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function StepsCard({ data }: { data: Extract<CardData, { type: 'steps' }> }) {
  const items = data.items || [];
  return (
    <div>
      <h3 className="text-base font-semibold text-foreground mb-3">{data.title}</h3>
      <div className="space-y-0">
        {items.map((item, i) => {
          const dotColor = getDotColor(item);
          const lineColor = i < items.length - 1
            ? getLineColor(items[i + 1])
            : '';
          const badgeSem = item.effort ? detectBadgeSemantic(item.effort) : 'neutral';
          const badgeStyle = BADGE_STYLES[badgeSem];

          return (
            <div key={i} className="flex gap-3 relative">
              {/* 竖线连接 — 颜色跟随下一节点语义 */}
              {i < items.length - 1 && (
                <div className={cn('absolute left-[7px] top-5 bottom-0 w-px', lineColor)} />
              )}
              {/* 圆点 — 语义着色 */}
              <div className={cn('w-[15px] h-[15px] rounded-full mt-0.5 flex-shrink-0 border-2 border-background', dotColor)} />
              <div className="flex-1 pb-4">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={cn('text-sm font-medium',
                    item.status === 'done' ? 'text-foreground' :
                    item.status === 'active' ? 'text-blue-700 dark:text-blue-300' :
                    'text-foreground'
                  )}>{item.label}</span>
                  {item.effort && (
                    <span className={cn('text-[10px] px-1.5 py-0.5 rounded border', badgeStyle)}>
                      {item.effort}
                    </span>
                  )}
                </div>
                {item.desc && (
                  <div className="text-[13px] text-foreground/60 mt-1 leading-relaxed">
                    {item.desc}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════ 主组件 ═══════

interface InsightCardProps {
  jsonStr: string;
  /** 是否正在流式输入中 */
  streaming?: boolean;
}

/**
 * 从不完整 JSON 中提取 title 和 type（用正则，不依赖完整解析）
 */
function extractPartialMeta(str: string): { title?: string; type?: string } {
  const title = str.match(/"title"\s*:\s*"([^"]*)/)?.[1];
  const type = str.match(/"type"\s*:\s*"([^"]*)/)?.[1];
  return { title, type };
}

const TYPE_LABELS: Record<string, string> = {
  'gap-analysis': '差距分析',
  'comparison': '对比分析',
  'checklist': '检查清单',
  'metrics': '数据指标',
  'steps': '步骤流程',
};

function InsightCardInner({ jsonStr, streaming }: InsightCardProps) {
  const [collapsed, setCollapsed] = useState(false);

  let data: CardData | null = null;
  let parseError: string | null = null;

  { const r = safeParseJson<any>(jsonStr); parseError = r.error;
    // ★ 兼容裸数组
    data = Array.isArray(r.data) ? { layout: 'list', items: r.data } : r.data;
  }

  // ★ 流式中 JSON 不完整：显示骨架卡片
  if (!data && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-4 h-4 rounded-full bg-indigo-400 animate-pulse flex-shrink-0" />
            <h3 className="text-sm font-medium">{partial.title || '生成中...'}</h3>
            {partial.type && (
              <span className="text-[10px] text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/50 px-1.5 py-0.5 rounded border border-indigo-200 dark:border-indigo-800">
                {TYPE_LABELS[partial.type] || partial.type}
              </span>
            )}
          </div>
          <div className="space-y-2">
            {[75, 60, 85, 45, 70].map((w, i) => (
              <div key={i} className="h-2.5 rounded-full bg-muted animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-300 via-indigo-500 to-indigo-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // JSON 解析失败 → 优雅降级
  if (!data) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>卡片数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  let content: React.ReactNode;
  switch (data.type) {
    case 'gap-analysis': content = <GapAnalysisCard data={data} />; break;
    case 'comparison':   content = <ComparisonCard data={data} />; break;
    case 'checklist':    content = <ChecklistCard data={data} />; break;
    case 'metrics':      content = <MetricsCard data={data} />; break;
    case 'steps':        content = <StepsCard data={data} />; break;
    default:
      content = <div className="text-xs text-muted-foreground">未知卡片类型: {(data as any).type}</div>;
  }

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {collapsed ? (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="w-full flex items-center justify-between px-4 py-2.5 text-[13px] text-muted-foreground hover:bg-accent/50 transition-colors"
        >
          <span>{data.title || '分析卡片'}</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      ) : (
        <>
          <div className="px-4 pt-4 pb-3">
            {content}
          </div>
          <button
            type="button"
            onClick={() => setCollapsed(true)}
            className="w-full flex items-center justify-center py-1.5 text-muted-foreground/50 hover:text-muted-foreground hover:bg-accent/30 transition-colors border-t border-border/30"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  );
}

export const InsightCard = memo(InsightCardInner);
