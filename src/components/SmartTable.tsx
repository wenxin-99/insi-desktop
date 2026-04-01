/**
 * SmartTable v3 — 单元格级智能渲染系统
 *
 * 两层增强：
 * 
 * A) 表格模式检测（整体布局升级）
 *   - comparison: 对比表 → 胜出高亮
 *   - metrics:    指标表 → 网格卡片
 *   - score:      评分表 → 进度条
 *   - ranking:    排名表 → 趋势行底色 + ▲▼
 *   - normal:     普通表 → 斑马纹 + hover
 *
 * B) SmartCell 单元格自动渲染（所有模式通用）
 *   - 百分比 → mini 进度条 + 数值
 *   - 状态词 → 彩色胶囊 pill（绿/红/黄/灰）
 *   - 布尔值 → ✓/✗ 圆形图标
 *   - 趋势词 → ▲/▼ + 红绿色
 *   - 排名1/2/3 → 🥇🥈🥉 奖牌
 *   - 空值/N/A → 统一灰色短横
 *   - 数值列 → 右对齐 + tabular-nums
 */

import { memo, useMemo, lazy, Suspense } from 'react';
import { cn } from '@/lib/utils';

// 可交互表格（懒加载，仅复杂表格时才加载）
const InteractiveTable = lazy(() => import('./InteractiveTable').then(m => ({ default: m.InteractiveTable })));

/** 判断表格是否应升级为 InteractiveTable（内联，避免 static import 破坏 lazy chunk） */
function shouldUpgrade(data: TableData): boolean {
  if (data.rows.length < 5) return false;
  const hasNumeric = data.headers.some((_, ci) => {
    const cells = data.rows.map(r => (r[ci] || '').trim()).filter(t => t && t !== '-' && t !== '—');
    return cells.length > 0 && cells.every(t => /^-?[\d,]+\.?\d*%?$/.test(t));
  });
  return data.rows.length >= 8 || hasNumeric;
}

// ═══════ 表格数据提取 ═══════

interface TableData {
  headers: string[];
  rows: string[][];
}

/** 从 HAST 节点提取纯文本（递归） */
function hastText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (node.type === 'text') return node.value || '';
  if (node.children) return node.children.map(hastText).join('');
  return '';
}

/**
 * ★ 从 HAST node（AST 节点）提取表格数据 — 主提取器
 * 
 * HAST 结构稳定，不受 ReactMarkdown 版本和自定义组件影响：
 *   table → thead → tr → th[]
 *        → tbody → tr[] → td[]
 */
function extractTableDataFromNode(node: any): TableData | null {
  try {
    if (!node?.children) return null;
    const headers: string[] = [];
    const rows: string[][] = [];

    for (const section of node.children) {
      if (!section?.children) continue;
      const tagName = section.tagName || section.type;

      for (const tr of section.children) {
        if (tr?.tagName !== 'tr') continue;
        if (!tr.children) continue;

        const cells = tr.children.filter((c: any) => 
          c.tagName === 'th' || c.tagName === 'td'
        );
        const texts = cells.map((c: any) => hastText(c).trim());

        if ((tagName === 'thead' || cells.some((c: any) => c.tagName === 'th')) && headers.length === 0) {
          headers.push(...texts);
        } else if (texts.length > 0) {
          rows.push(texts);
        }
      }
    }

    if (headers.length < 2 || rows.length < 1) return null;
    return { headers, rows };
  } catch {
    return null;
  }
}

/** 从 React children 中提取纯文本（fallback 用） */
function childText(node: any): string {
  if (!node) return '';
  if (typeof node === 'string') return node;
  if (typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(childText).join('');
  if (node?.props?.children) return childText(node.props.children);
  return '';
}

/** 从 React children 提取表格数据 — 后备提取器 */
function extractTableDataFromChildren(children: any): TableData | null {
  try {
    const childArr = Array.isArray(children) ? children : [children];
    const headers: string[] = [];
    const rows: string[][] = [];

    for (const child of childArr) {
      if (!child?.props?.children) continue;
      const trList = Array.isArray(child.props.children) ? child.props.children : [child.props.children];

      for (const tr of trList) {
        if (!tr?.props?.children) continue;
        const cells = Array.isArray(tr.props.children) ? tr.props.children : [tr.props.children];
        const texts = cells.map((cell: any) => childText(cell).trim());

        const isHeader = cells.some((c: any) => c?.type === 'th' || c?.props?.as === 'th') ||
          (child.type === 'thead' || child.props?.className?.includes('bg-muted'));

        if (isHeader && headers.length === 0) {
          headers.push(...texts);
        } else {
          rows.push(texts);
        }
      }
    }

    if (headers.length < 2 || rows.length < 1) return null;
    return { headers, rows };
  } catch {
    return null;
  }
}

/** 统一提取入口：优先 HAST node，后备 React children */
export function extractTableData(node: any, children: any): TableData | null {
  return extractTableDataFromNode(node) || extractTableDataFromChildren(children);
}

// ═══════════════════════════════════════
// §2  模式检测
// ═══════════════════════════════════════

type TablePattern = 'comparison' | 'metrics' | 'score' | 'ranking' | 'normal';

const COMPARISON_HEADERS = /^(维度|方面|特性|对比项|功能|feature|aspect|dimension)$/i;
const WINNER_HEADERS = /^(胜出|推荐|优势方|winner|better|胜)$/i;
const METRICS_HEADERS = /^(指标|数值|变化|增长|数据|值|metric|value|change)$/i;
const SCORE_HEADERS = /^(评分|分数|得分|星级|等级|score|rating|level|状态|status)$/i;
const RANKING_HEADERS = /排名|排行|排序|名次|rank/i;
const TREND_HEADERS = /变化|趋势|涨跌|增减|走势|trend|change/i;

const UP_TREND = /上升|增长|增加|上涨|提升|升高|新高|领先|超越|活力|↑|\+\d/;
const DOWN_TREND = /下降|减少|降低|下跌|下滑|回落|萎缩|放缓|↓|-\d/;
const FLAT_TREND = /持平|稳定|不变|保持|平稳|—|－/;

function detectPattern(data: TableData): TablePattern {
  const h = data.headers;
  if (h.length >= 3 && h.length <= 5 && COMPARISON_HEADERS.test(h[0])) return 'comparison';
  if (h.some(x => WINNER_HEADERS.test(x))) return 'comparison';
  if (h.some(x => SCORE_HEADERS.test(x))) return 'score';
  if (h.some(x => RANKING_HEADERS.test(x) || TREND_HEADERS.test(x))) return 'ranking';
  const allText = data.rows.map(r => r.join(' ')).join(' ');
  if ((UP_TREND.test(allText) || DOWN_TREND.test(allText)) && data.rows.length >= 3) return 'ranking';
  if (h.some(x => METRICS_HEADERS.test(x)) && data.rows.length <= 8) return 'metrics';
  return 'normal';
}

// ═══════════════════════════════════════
// §3  SmartCell — 单元格级智能渲染
// ═══════════════════════════════════════

type CellHint = 'rank' | 'trend' | 'numeric' | 'status' | 'boolean' | 'percent' | 'text';

/** 检测单元格内容类型 */
function detectCellType(text: string, header: string): CellHint {
  const t = text.trim();
  if (!t || t === '-' || t === '—' || t === '－' || t === 'N/A' || t === 'n/a') return 'text';
  // 百分比
  if (/^-?[\d,.]+%$/.test(t)) return 'percent';
  // 布尔
  if (/^(是|否|有|无|支持|不支持|✓|✗|✔|✘|√|×|Yes|No|TRUE|FALSE)$/i.test(t)) return 'boolean';
  // 状态 pill
  if (/^(完成|成功|通过|已完成|已上线|正常|可用|活跃|启用|上线|已发布|enabled|active|pass|done|ok|approved|published)$/i.test(t)) return 'status';
  if (/^(失败|错误|拒绝|异常|不可用|已下线|禁用|过期|超时|rejected|failed|error|disabled|expired|timeout)$/i.test(t)) return 'status';
  if (/^(进行中|待处理|待审核|处理中|审核中|排队中|pending|processing|in.?progress|review|queued|waiting)$/i.test(t)) return 'status';
  if (/^(已取消|暂停|中止|跳过|cancelled|paused|skipped|aborted|suspended)$/i.test(t)) return 'status';
  // 趋势
  if (TREND_HEADERS.test(header) || RANKING_HEADERS.test(header)) {
    if (UP_TREND.test(t) || DOWN_TREND.test(t)) return 'trend';
  }
  // 排名列前3
  if (RANKING_HEADERS.test(header) && /^[123]$/.test(t)) return 'rank';
  // 纯数值
  if (/^-?[\d,]+\.?\d*$/.test(t)) return 'numeric';
  return 'text';
}

/** 状态颜色映射 */
function statusColor(text: string): { bg: string; text: string; dot: string } {
  const t = text.trim().toLowerCase();
  if (/^(完成|成功|通过|已完成|已上线|正常|可用|活跃|启用|上线|已发布|enabled|active|pass|done|ok|approved|published)$/i.test(t))
    return { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' };
  if (/^(失败|错误|拒绝|异常|不可用|已下线|禁用|过期|超时|rejected|failed|error|disabled|expired|timeout)$/i.test(t))
    return { bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' };
  if (/^(进行中|待处理|待审核|处理中|审核中|排队中|pending|processing|in.?progress|review|queued|waiting)$/i.test(t))
    return { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' };
  return { bg: 'bg-gray-100 dark:bg-gray-800/40', text: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' };
}

/** 布尔值渲染 */
function booleanIcon(text: string) {
  const positive = /^(是|有|支持|✓|✔|√|Yes|TRUE)$/i.test(text.trim());
  return positive
    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
    : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 text-xs font-bold">✗</span>;
}

/** 排名奖牌 */
const MEDALS: Record<string, string> = { '1': '🥇', '2': '🥈', '3': '🥉' };

/** 百分比 mini-bar */
function PercentBar({ value, text }: { value: number; text: string }) {
  const pct = Math.min(100, Math.max(0, Math.abs(value)));
  const color = value < 0 ? 'bg-red-400' : pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-amber-400' : 'bg-blue-400';
  return (
    <div className="inline-flex items-center gap-2 min-w-[90px]">
      <div className="flex-1 h-[6px] bg-muted/60 rounded-full overflow-hidden min-w-[40px]">
        <div className={cn('h-full rounded-full transition-all', color)} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[12px] tabular-nums whitespace-nowrap">{text}</span>
    </div>
  );
}

/** 通用 SmartCell 渲染器 */
function SmartCell({ text, header, isFirstCol }: { text: string; header: string; isFirstCol?: boolean }) {
  const t = text?.trim() || '';
  // 空值
  if (!t || t === '-' || t === '—' || t === '－') {
    return <span className="text-muted-foreground/40">—</span>;
  }
  if (/^N\/A$/i.test(t)) {
    return <span className="text-[11px] text-muted-foreground/50 italic">N/A</span>;
  }

  const hint = detectCellType(t, header);

  switch (hint) {
    case 'percent': {
      const num = parseFloat(t.replace(/,/g, ''));
      return <PercentBar value={num} text={t} />;
    }
    case 'boolean':
      return booleanIcon(t);
    case 'status': {
      const sc = statusColor(t);
      return (
        <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium', sc.bg, sc.text)}>
          <span className={cn('w-1.5 h-1.5 rounded-full', sc.dot)} />
          {t}
        </span>
      );
    }
    case 'trend':
      return (
        <span className={cn('inline-flex items-center gap-1 font-medium',
          UP_TREND.test(t) && 'text-green-600 dark:text-green-400',
          DOWN_TREND.test(t) && 'text-red-500 dark:text-red-400',
        )}>
          {UP_TREND.test(t) && <span className="text-green-500 text-[10px]">▲</span>}
          {DOWN_TREND.test(t) && <span className="text-red-400 text-[10px]">▼</span>}
          {t}
        </span>
      );
    case 'rank':
      return <span>{MEDALS[t] || t} {t}</span>;
    default:
      // 文本中含趋势词也着色（非趋势列）
      if (!isFirstCol && UP_TREND.test(t)) return <span className="text-green-600 dark:text-green-400">{t}</span>;
      if (!isFirstCol && DOWN_TREND.test(t)) return <span className="text-red-500 dark:text-red-400">{t}</span>;
      return <>{t}</>;
  }
}

// ═══════════════════════════════════════
// §4  列分析器
// ═══════════════════════════════════════

interface ColMeta {
  isNumeric: boolean;
  isTrend: boolean;
  isRank: boolean;
  isStatus: boolean;
  isBoolean: boolean;
  isPercent: boolean;
  align: 'left' | 'right' | 'center';
}

function analyzeColumns(data: TableData): ColMeta[] {
  return data.headers.map((h, ci) => {
    const cells = data.rows.map(r => (r[ci] || '').trim()).filter(t => t && t !== '-' && t !== '—');
    const isNumeric = cells.length > 0 && cells.every(t => /^-?[\d,]+\.?\d*$/.test(t));
    const isPercent = cells.length > 0 && cells.every(t => /^-?[\d,.]+%$/.test(t));
    const isTrend = TREND_HEADERS.test(h) || RANKING_HEADERS.test(h);
    const isRank = RANKING_HEADERS.test(h) && isNumeric;
    const isBoolean = cells.length > 0 && cells.every(t => /^(是|否|有|无|支持|不支持|✓|✗|✔|✘|√|×|Yes|No|TRUE|FALSE)$/i.test(t));
    const isStatus = cells.length > 0 && cells.every(t => detectCellType(t, h) === 'status');

    let align: ColMeta['align'] = 'left';
    if (isNumeric || isPercent) align = 'right';
    if (isBoolean || isStatus) align = 'center';

    return { isNumeric, isTrend, isRank, isStatus, isBoolean, isPercent, align };
  });
}

// ═══════════════════════════════════════
// §5  视图组件 — 使用 SmartCell
// ═══════════════════════════════════════

// ── 对比表 ──

function ComparisonView({ data }: { data: TableData }) {
  const dimIdx = 0;
  const winnerIdx = data.headers.findIndex(h => WINNER_HEADERS.test(h));
  const valueIdxs = data.headers.map((_, i) => i).filter(i => i !== dimIdx && i !== winnerIdx);
  const labels = valueIdxs.map(i => data.headers[i]);
  const cols = analyzeColumns(data);

  return (
    <div className="my-3 rounded-xl border border-border/50 overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="border-b border-border/60 bg-muted/50">
              <th className="text-left py-2.5 px-3 text-muted-foreground font-medium text-[11px]">{data.headers[dimIdx]}</th>
              {labels.map((l, i) => (
                <th key={i} className="text-left py-2.5 px-3 font-medium text-[11px]">{l}</th>
              ))}
              {winnerIdx >= 0 && <th className="text-center py-2.5 px-3 text-muted-foreground font-medium text-[11px] w-16">{data.headers[winnerIdx]}</th>}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => {
              const winner = winnerIdx >= 0 ? row[winnerIdx]?.trim() : '';
              const winLabel = labels.find(l => winner.includes(l));
              const winColIdx = winLabel ? labels.indexOf(winLabel) : -1;
              return (
                <tr key={i} className="border-b border-border/30 last:border-0">
                  <td className="py-2 px-3 text-muted-foreground whitespace-nowrap">{row[dimIdx]}</td>
                  {valueIdxs.map((vi, ci) => (
                    <td key={ci} className={cn('py-2 px-3', ci === winColIdx && 'font-medium text-green-700 dark:text-green-400')}>
                      <SmartCell text={row[vi]} header={data.headers[vi]} />
                    </td>
                  ))}
                  {winnerIdx >= 0 && (
                    <td className="py-2 px-3 text-center text-[11px] text-muted-foreground">{winner}</td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 指标卡片 ──

function MetricsView({ data }: { data: TableData }) {
  const labelIdx = 0;
  const valueIdx = data.headers.findIndex(h => METRICS_HEADERS.test(h)) || 1;
  const changeIdx = data.headers.findIndex((h, i) => i > valueIdx && /变化|增长|change|趋势/.test(h));

  return (
    <div className="my-3 grid grid-cols-2 sm:grid-cols-3 gap-2.5">
      {data.rows.map((row, i) => {
        const change = changeIdx >= 0 ? row[changeIdx]?.trim() : '';
        const isUp = UP_TREND.test(change);
        const isDown = DOWN_TREND.test(change);
        return (
          <div key={i} className="bg-muted/40 rounded-lg p-3 border border-border/30">
            <div className="text-[11px] text-muted-foreground mb-1 truncate">{row[labelIdx]}</div>
            <div className="text-base font-medium">{row[valueIdx] || row[1]}</div>
            {change && (
              <div className={cn('text-[11px] font-medium mt-0.5',
                isUp && 'text-green-600 dark:text-green-400',
                isDown && 'text-red-500 dark:text-red-400',
                !isUp && !isDown && 'text-muted-foreground',
              )}>
                {isUp && '▲ '}{isDown && '▼ '}{change}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── 评分表 ──

function ScoreView({ data }: { data: TableData }) {
  const nameIdx = 0;
  const scoreIdx = data.headers.findIndex(h => SCORE_HEADERS.test(h));

  return (
    <div className="my-3 rounded-xl border border-border/50 overflow-hidden bg-card divide-y divide-border/30">
      {data.rows.map((row, i) => {
        const scoreText = row[scoreIdx]?.trim() || '';
        const numMatch = scoreText.match(/([\d.]+)/);
        const score = numMatch ? parseFloat(numMatch[1]) : 0;
        const stars = (scoreText.match(/★/g) || []).length;
        const maxScore = score > 10 ? 100 : stars > 0 ? 5 : 10;
        const pct = stars > 0 ? (stars / 5) * 100 : score > 0 ? (score / maxScore) * 100 : 0;
        const otherCols = data.headers.map((_, ci) => ci).filter(ci => ci !== nameIdx && ci !== scoreIdx);

        return (
          <div key={i} className="px-3.5 py-2.5 flex items-center gap-3">
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium truncate">{row[nameIdx]}</div>
              {otherCols.length > 0 && (
                <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                  {otherCols.map(ci => row[ci]).filter(Boolean).join(' · ')}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {pct > 0 && (
                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className={cn('h-full rounded-full', pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-red-500')} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              )}
              <span className="text-[12px] font-medium min-w-[40px] text-right">{scoreText}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 排名/排行表（使用 SmartCell） ──

function RankingView({ data }: { data: TableData }) {
  const cols = analyzeColumns(data);

  const rowTrends = data.rows.map(row => {
    for (let ci = 0; ci < row.length; ci++) {
      if (!cols[ci]?.isTrend) continue;
      const t = row[ci]?.trim() || '';
      if (UP_TREND.test(t)) return 'up';
      if (DOWN_TREND.test(t)) return 'down';
    }
    for (const cell of row) {
      if (UP_TREND.test(cell || '')) return 'up';
      if (DOWN_TREND.test(cell || '')) return 'down';
    }
    return 'neutral';
  });

  return (
    <div className="my-3 rounded-xl border border-border/50 overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-800/60 dark:to-slate-800/40 border-b border-border/60">
              {data.headers.map((h, i) => (
                <th key={i} className={cn(
                  'py-2.5 px-3.5 font-semibold text-[12px] text-slate-600 dark:text-slate-300 whitespace-nowrap',
                  cols[i]?.align === 'right' && 'text-right',
                  cols[i]?.align === 'center' && 'text-center',
                )}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => {
              const trend = rowTrends[ri];
              return (
                <tr key={ri} className={cn(
                  'border-b border-border/20 last:border-0 transition-colors',
                  trend === 'up'   && 'bg-green-50/50 dark:bg-green-950/15',
                  trend === 'down' && 'bg-red-50/40 dark:bg-red-950/10',
                  trend === 'neutral' && ri % 2 === 1 && 'bg-muted/20',
                )}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={cn(
                      'py-2.5 px-3.5',
                      ci === 0 && 'font-medium',
                      cols[ci]?.align === 'right' && 'text-right tabular-nums',
                      cols[ci]?.align === 'center' && 'text-center',
                    )}>
                      <SmartCell text={cell} header={data.headers[ci]} isFirstCol={ci === 0} />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── 增强版普通表格（所有表格的最终后备） ──

function EnhancedNormalTable({ data, children, ...props }: { data: TableData | null; children: any; [key: string]: any }) {
  if (!data) {
    return (
      <div className="table-scroll-wrapper relative overflow-x-auto my-4 rounded-xl border border-border/50 bg-card">
        <table className="min-w-full border-collapse text-sm" {...props}>{children}</table>
      </div>
    );
  }

  const cols = analyzeColumns(data);

  return (
    <div className="my-3 rounded-xl border border-border/50 overflow-hidden bg-card">
      <div className="overflow-x-auto">
        <table className="w-full text-[13px]">
          <thead>
            <tr className="bg-muted/60 border-b border-border/60">
              {data.headers.map((h, i) => (
                <th key={i} className={cn(
                  'py-2.5 px-3.5 font-semibold text-[12px] whitespace-nowrap',
                  cols[i]?.align === 'right' ? 'text-right' : cols[i]?.align === 'center' ? 'text-center' : 'text-left',
                )}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, ri) => (
              <tr key={ri} className={cn(
                'border-b border-border/20 last:border-0',
                ri % 2 === 1 && 'bg-muted/15',
                'hover:bg-muted/30 transition-colors',
              )}>
                {row.map((cell, ci) => (
                  <td key={ci} className={cn(
                    'py-2 px-3.5',
                    ci === 0 && 'font-medium',
                    cols[ci]?.align === 'right' && 'text-right tabular-nums',
                    cols[ci]?.align === 'center' && 'text-center',
                  )}>
                    <SmartCell text={cell} header={data.headers[ci]} isFirstCol={ci === 0} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════
// §6  主组件
// ═══════════════════════════════════════

interface SmartTableProps {
  children: any;
  node?: any;
  streaming?: boolean;
}

function SmartTableInner({ children, node, streaming, ...props }: SmartTableProps) {
  const tableData = useMemo(() => extractTableData(node, children), [node, children]);
  const pattern = useMemo(() => tableData ? detectPattern(tableData) : 'normal', [tableData]);
  const upgrade = useMemo(() => tableData ? shouldUpgrade(tableData) : false, [tableData]);

  if (streaming) {
    // ★ 流式中也用 SmartCell 渲染 + 基础模式检测，只跳过 InteractiveTable 升级
    if (tableData) {
      const cols = analyzeColumns(tableData);
      return (
        <div className="my-3 rounded-xl border border-border/50 overflow-hidden bg-card">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-muted/60 border-b border-border/60">
                  {tableData.headers.map((h, i) => (
                    <th key={i} className={cn(
                      'py-2.5 px-3.5 font-semibold text-[12px] whitespace-nowrap',
                      cols[i]?.align === 'right' ? 'text-right' : cols[i]?.align === 'center' ? 'text-center' : 'text-left',
                    )}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tableData.rows.map((row, ri) => (
                  <tr key={ri} className={cn(
                    'border-b border-border/20 last:border-0',
                    ri % 2 === 1 && 'bg-muted/15',
                  )}>
                    {row.map((cell, ci) => (
                      <td key={ci} className={cn(
                        'py-2 px-3.5',
                        ci === 0 && 'font-medium',
                        cols[ci]?.align === 'right' && 'text-right tabular-nums',
                        cols[ci]?.align === 'center' && 'text-center',
                      )}>
                        <SmartCell text={cell} header={tableData.headers[ci]} isFirstCol={ci === 0} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="h-0.5 bg-muted overflow-hidden">
            <div className="h-full bg-gradient-to-r from-indigo-300 via-indigo-500 to-indigo-300 animate-pulse" />
          </div>
        </div>
      );
    }
    // tableData 提取失败，回退原生表格
    return (
      <div className="table-scroll-wrapper relative overflow-x-auto my-4 rounded-lg border border-border">
        <table className="min-w-full border-collapse text-sm" {...props}>{children}</table>
      </div>
    );
  }

  // ★ 复杂表格 → 自动升级为可交互表格（排序/搜索/分页/导出）
  if (upgrade && tableData) {
    return (
      <Suspense fallback={
        <div className="my-3 rounded-xl border border-border/50 bg-card p-4 animate-pulse">
          <div className="h-4 bg-muted rounded w-1/3 mb-3" />
          <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-3 bg-muted rounded" />)}</div>
        </div>
      }>
        <InteractiveTable data={tableData} />
      </Suspense>
    );
  }

  switch (pattern) {
    case 'comparison': return <ComparisonView data={tableData!} />;
    case 'metrics':    return <MetricsView data={tableData!} />;
    case 'score':      return <ScoreView data={tableData!} />;
    case 'ranking':    return <RankingView data={tableData!} />;
    default:           return <EnhancedNormalTable data={tableData} {...props}>{children}</EnhancedNormalTable>;
  }
}

export const SmartTable = memo(SmartTableInner);
