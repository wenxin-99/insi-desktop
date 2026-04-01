/**
 * InteractiveTable — 可交互数据表格 (v1)
 *
 * SmartTable 检测到复杂表格时自动升级到此组件。
 * 纯 React 实现，无 iframe、无额外依赖。
 *
 * 功能清单：
 *   ✓ 点击表头排序（asc / desc / 原始序）
 *   ✓ 全局搜索框（模糊过滤所有列）
 *   ✓ 固定表头（滚动时吸顶）
 *   ✓ 分页（20+ 行时出现）
 *   ✓ 导出 CSV
 *   ✓ SmartCell 智能单元格渲染（复用 SmartTable 的渲染器）
 *   ✓ 列统计（数值列自动显示 min/max/avg 汇总行）
 *   ✓ 行高亮（hover + click 选中）
 *   ✓ 数值列数据条（Data Bar）
 *   ✓ 响应式：窄屏横向滚动
 */

import { useState, useMemo, useCallback, useRef, memo } from 'react';
import { cn } from '@/lib/utils';
import { Search, ArrowUpDown, ArrowUp, ArrowDown, Download, ChevronLeft, ChevronRight, Table2, X } from 'lucide-react';

// ═══════ 类型 ═══════

interface TableData {
  headers: string[];
  rows: string[][];
}

type SortDir = 'asc' | 'desc' | null;

interface ColMeta {
  type: 'numeric' | 'percent' | 'text';
  align: 'left' | 'right' | 'center';
  min: number;
  max: number;
  sum: number;
  count: number;
}

// ═══════ 工具函数 ═══════

function parseNum(s: string): number | null {
  const t = s.trim().replace(/,/g, '').replace(/%$/, '');
  if (!t || t === '-' || t === '—' || t === 'N/A') return null;
  const n = Number(t);
  return isNaN(n) ? null : n;
}

function analyzeCol(rows: string[][], ci: number): ColMeta {
  let min = Infinity, max = -Infinity, sum = 0, count = 0;
  let numericCount = 0, percentCount = 0, emptyCount = 0;

  for (const row of rows) {
    const t = (row[ci] || '').trim();
    if (!t || t === '-' || t === '—') { emptyCount++; continue; }
    if (/^-?[\d,.]+%$/.test(t)) percentCount++;
    const n = parseNum(t);
    if (n !== null) {
      numericCount++;
      min = Math.min(min, n);
      max = Math.max(max, n);
      sum += n;
      count++;
    }
  }

  const nonEmpty = rows.length - emptyCount;
  const isNumeric = nonEmpty > 0 && numericCount / nonEmpty >= 0.7;
  const isPercent = nonEmpty > 0 && percentCount / nonEmpty >= 0.7;

  return {
    type: isPercent ? 'percent' : isNumeric ? 'numeric' : 'text',
    align: isNumeric || isPercent ? 'right' : 'left',
    min: min === Infinity ? 0 : min,
    max: max === -Infinity ? 0 : max,
    sum, count,
  };
}

/** 趋势检测 */
const UP = /上升|增长|增加|上涨|提升|升高|新高|领先|超越|活力|↑|\+\d/;
const DOWN = /下降|减少|降低|下跌|下滑|回落|萎缩|放缓|↓|-\d/;

function trendOf(text: string): 'up' | 'down' | null {
  if (UP.test(text)) return 'up';
  if (DOWN.test(text)) return 'down';
  return null;
}

/** 状态 pill 检测 */
function statusStyle(text: string): { bg: string; fg: string; dot: string } | null {
  const t = text.trim();
  if (/^(完成|成功|通过|已完成|已上线|正常|可用|活跃|启用|上线|已发布|enabled|active|pass|done|ok|approved|published)$/i.test(t))
    return { bg: 'bg-green-100 dark:bg-green-900/30', fg: 'text-green-700 dark:text-green-300', dot: 'bg-green-500' };
  if (/^(失败|错误|拒绝|异常|不可用|已下线|禁用|过期|超时|rejected|failed|error|disabled|expired|timeout)$/i.test(t))
    return { bg: 'bg-red-100 dark:bg-red-900/30', fg: 'text-red-700 dark:text-red-300', dot: 'bg-red-500' };
  if (/^(进行中|待处理|待审核|处理中|审核中|排队中|pending|processing|in.?progress|review|queued|waiting)$/i.test(t))
    return { bg: 'bg-amber-100 dark:bg-amber-900/30', fg: 'text-amber-700 dark:text-amber-300', dot: 'bg-amber-500' };
  if (/^(已取消|暂停|中止|跳过|cancelled|paused|skipped|aborted|suspended)$/i.test(t))
    return { bg: 'bg-gray-100 dark:bg-gray-800/40', fg: 'text-gray-600 dark:text-gray-300', dot: 'bg-gray-400' };
  return null;
}

/** 布尔值检测 */
function boolOf(text: string): boolean | null {
  const t = text.trim();
  if (/^(是|有|支持|✓|✔|√|Yes|TRUE)$/i.test(t)) return true;
  if (/^(否|无|不支持|✗|✘|×|No|FALSE)$/i.test(t)) return false;
  return null;
}

// ═══════ 单元格渲染 ═══════

function Cell({ text, col, isFirst }: { text: string; col: ColMeta; isFirst?: boolean }) {
  const t = text?.trim() || '';

  // 空值
  if (!t || t === '-' || t === '—' || t === '－') return <span className="text-muted-foreground/40">—</span>;
  if (/^N\/A$/i.test(t)) return <span className="text-[11px] text-muted-foreground/50 italic">N/A</span>;

  // 布尔
  const b = boolOf(t);
  if (b !== null) return b
    ? <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 text-xs font-bold">✓</span>
    : <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-500 dark:text-red-400 text-xs font-bold">✗</span>;

  // 状态 pill
  const st = statusStyle(t);
  if (st) return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium', st.bg, st.fg)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />{t}
    </span>
  );

  // 数值列 data bar
  if ((col.type === 'numeric' || col.type === 'percent') && col.max > col.min) {
    const n = parseNum(t);
    if (n !== null) {
      const range = col.max - col.min;
      const pct = range > 0 ? ((n - col.min) / range) * 100 : 50;
      const color = col.type === 'percent'
        ? (n >= 70 ? 'bg-green-400/25' : n >= 40 ? 'bg-amber-400/20' : 'bg-blue-400/20')
        : 'bg-blue-400/20';
      return (
        <div className="relative">
          <div className={cn('absolute inset-y-0 left-0 rounded-sm', color)}
            style={{ width: `${Math.min(100, Math.max(2, pct))}%` }} />
          <span className="relative tabular-nums">{t}</span>
        </div>
      );
    }
  }

  // 趋势
  const trend = trendOf(t);
  if (trend && !isFirst) return (
    <span className={cn('inline-flex items-center gap-1 font-medium',
      trend === 'up' ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400',
    )}>
      {trend === 'up' ? <span className="text-[10px]">▲</span> : <span className="text-[10px]">▼</span>}
      {t}
    </span>
  );

  return <>{t}</>;
}

// ═══════ CSV 导出 ═══════

function exportCSV(data: TableData, filename: string) {
  const escape = (s: string) => s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [data.headers.map(escape).join(','), ...data.rows.map(r => r.map(escape).join(','))];
  const blob = new Blob(['\ufeff' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `${filename}.csv`;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a); URL.revokeObjectURL(url);
}

// ═══════ 主组件 ═══════

const PAGE_SIZE = 15;

interface InteractiveTableProps {
  data: TableData;
}

function InteractiveTableInner({ data }: InteractiveTableProps) {
  const [search, setSearch] = useState('');
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>(null);
  const [page, setPage] = useState(0);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // 列分析
  const colMetas = useMemo(() => data.headers.map((_, ci) => analyzeCol(data.rows, ci)), [data]);

  // 过滤
  const filtered = useMemo(() => {
    if (!search.trim()) return data.rows;
    const q = search.toLowerCase();
    return data.rows.filter(row => row.some(cell => cell.toLowerCase().includes(q)));
  }, [data.rows, search]);

  // 排序
  const sorted = useMemo(() => {
    if (sortCol === null || sortDir === null) return filtered;
    const ci = sortCol;
    const col = colMetas[ci];
    const dir = sortDir === 'asc' ? 1 : -1;

    return [...filtered].sort((a, b) => {
      const va = a[ci] || '', vb = b[ci] || '';
      if (col.type === 'numeric' || col.type === 'percent') {
        const na = parseNum(va), nb = parseNum(vb);
        if (na === null && nb === null) return 0;
        if (na === null) return 1;
        if (nb === null) return -1;
        return (na - nb) * dir;
      }
      return va.localeCompare(vb, 'zh-CN') * dir;
    });
  }, [filtered, sortCol, sortDir, colMetas]);

  // 分页
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const showPagination = sorted.length > PAGE_SIZE;
  const pageRows = useMemo(
    () => showPagination ? sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : sorted,
    [sorted, page, showPagination]
  );

  // 汇总行（数值列显示 avg/sum）
  const hasSummary = colMetas.some(c => (c.type === 'numeric' || c.type === 'percent') && c.count > 0);

  const handleSort = useCallback((ci: number) => {
    if (sortCol === ci) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortCol(null); setSortDir(null); }
    } else {
      setSortCol(ci);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortCol, sortDir]);

  const toggleSearch = useCallback(() => {
    setShowSearch(v => {
      if (!v) setTimeout(() => searchRef.current?.focus(), 50);
      else setSearch('');
      return !v;
    });
    setPage(0);
  }, []);

  return (
    <div className="my-3 rounded-xl border border-border/50 overflow-hidden bg-card shadow-sm">
      {/* ── 工具栏 ── */}
      <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/40">
        <div className="flex items-center gap-2 min-w-0">
          <Table2 className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <span className="text-[12px] text-muted-foreground">
            {filtered.length === data.rows.length
              ? <>{data.rows.length} 行 · {data.headers.length} 列</>
              : <>{filtered.length}/{data.rows.length} 行（已筛选）</>
            }
          </span>
        </div>

        <div className="flex items-center gap-1">
          {showSearch && (
            <div className="relative animate-in fade-in slide-in-from-right-2 duration-200">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0); }}
                placeholder="搜索..."
                className="h-7 w-[140px] sm:w-[180px] pl-7 pr-7 text-[12px] rounded-md border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
              />
              {search && (
                <button onClick={() => { setSearch(''); searchRef.current?.focus(); }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-muted">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
          )}
          <button onClick={toggleSearch} title="搜索"
            className={cn('p-1.5 rounded-md transition-colors', showSearch ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}>
            <Search className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => exportCSV(data, '表格数据')} title="导出 CSV"
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors">
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── 表格 ── */}
      <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="w-full text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr className="bg-muted/80 backdrop-blur-sm border-b border-border/60">
              {data.headers.map((h, ci) => {
                const isActive = sortCol === ci;
                const SortIcon = isActive
                  ? sortDir === 'asc' ? ArrowUp : ArrowDown
                  : ArrowUpDown;
                return (
                  <th key={ci}
                    onClick={() => handleSort(ci)}
                    className={cn(
                      'py-2.5 px-3.5 font-semibold text-[12px] whitespace-nowrap cursor-pointer select-none',
                      'hover:bg-muted transition-colors group',
                      colMetas[ci]?.align === 'right' ? 'text-right' : 'text-left',
                      isActive && 'text-primary',
                    )}>
                    <span className="inline-flex items-center gap-1">
                      {h}
                      <SortIcon className={cn('w-3 h-3 flex-shrink-0 transition-opacity',
                        isActive ? 'opacity-100 text-primary' : 'opacity-0 group-hover:opacity-40')} />
                    </span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={data.headers.length} className="py-8 text-center text-muted-foreground text-sm">
                  {search ? '没有匹配的结果' : '暂无数据'}
                </td>
              </tr>
            ) : pageRows.map((row, ri) => {
              const absIdx = showPagination ? page * PAGE_SIZE + ri : ri;
              const isSelected = selectedRow === absIdx;
              // 行趋势底色
              const rowText = row.join(' ');
              const rowTrend = trendOf(rowText);

              return (
                <tr key={absIdx}
                  onClick={() => setSelectedRow(isSelected ? null : absIdx)}
                  className={cn(
                    'border-b border-border/15 last:border-0 cursor-pointer transition-colors',
                    isSelected
                      ? 'bg-primary/5 dark:bg-primary/10 ring-1 ring-inset ring-primary/20'
                      : rowTrend === 'up' ? 'bg-green-50/40 dark:bg-green-950/10'
                      : rowTrend === 'down' ? 'bg-red-50/30 dark:bg-red-950/8'
                      : ri % 2 === 1 ? 'bg-muted/10' : '',
                    !isSelected && 'hover:bg-muted/30',
                  )}>
                  {row.map((cell, ci) => (
                    <td key={ci} className={cn(
                      'py-2.5 px-3.5 relative',
                      ci === 0 && 'font-medium',
                      colMetas[ci]?.align === 'right' && 'text-right',
                    )}>
                      <Cell text={cell} col={colMetas[ci]} isFirst={ci === 0} />
                    </td>
                  ))}
                </tr>
              );
            })}

            {/* 汇总行 */}
            {hasSummary && !search && (
              <tr className="bg-muted/40 border-t-2 border-border/40 font-medium text-[12px]">
                {data.headers.map((_, ci) => {
                  const col = colMetas[ci];
                  if (ci === 0) return <td key={ci} className="py-2 px-3.5 text-muted-foreground">汇总</td>;
                  if ((col.type === 'numeric' || col.type === 'percent') && col.count > 0) {
                    const avg = col.sum / col.count;
                    return (
                      <td key={ci} className="py-2 px-3.5 text-right tabular-nums text-muted-foreground">
                        <div className="text-[11px] leading-tight">
                          <span title="平均">μ {col.type === 'percent' ? avg.toFixed(1) + '%' : avg.toLocaleString('zh-CN', { maximumFractionDigits: 1 })}</span>
                        </div>
                      </td>
                    );
                  }
                  return <td key={ci} className="py-2 px-3.5" />;
                })}
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── 分页 ── */}
      {showPagination && (
        <div className="flex items-center justify-between px-3 py-2 border-t border-border/40 bg-muted/20">
          <span className="text-[11px] text-muted-foreground">
            第 {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sorted.length)} 行，共 {sorted.length} 行
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            {/* 页码按钮 */}
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 5) pageNum = i;
              else if (page < 3) pageNum = i;
              else if (page > totalPages - 4) pageNum = totalPages - 5 + i;
              else pageNum = page - 2 + i;
              return (
                <button key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={cn('w-7 h-7 rounded text-[12px] font-medium transition-colors',
                    page === pageNum ? 'bg-primary text-primary-foreground' : 'hover:bg-muted text-muted-foreground')}>
                  {pageNum + 1}
                </button>
              );
            })}
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1 rounded hover:bg-muted disabled:opacity-30 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export const InteractiveTable = memo(InteractiveTableInner);

/** 判断表格是否应升级为 InteractiveTable */
export function shouldUpgrade(data: TableData): boolean {
  // 5+ 行数据才值得升级
  if (data.rows.length < 5) return false;
  // 有数值列（排序有意义）
  const hasNumeric = data.headers.some((_, ci) => {
    const col = analyzeCol(data.rows, ci);
    return col.type === 'numeric' || col.type === 'percent';
  });
  // 8+ 行或有数值列 → 升级
  return data.rows.length >= 8 || hasNumeric;
}
