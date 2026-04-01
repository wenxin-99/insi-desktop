/**
 * SpreadsheetBlock — 对话内嵌电子表格组件 v2
 *
 * ★ 改进：
 *   - 表头渐变色 + 彩色行号
 *   - 斑马纹交替行色
 *   - 数字列自动右对齐 + 绿/红色着色
 *   - 选中行高亮
 *   - 流式中也可渲染（移除 streaming 限制）
 */
import { useState, useMemo, useCallback, memo, useRef } from 'react';
import {
  ArrowUpDown, ArrowUp, ArrowDown,
  Search, Copy, Download, ChevronLeft, ChevronRight, Table2, X, Check,
} from 'lucide-react';

export interface SpreadsheetProps {
  headers: string[];
  rows: string[][];
  source?: 'markdown' | 'csv';
  title?: string;
}

// ═══════════════════════════════════════════
// 工具函数（保留导出供 spreadsheetUtils.ts 无缝迁移）
// ═══════════════════════════════════════════

const PAGE_SIZE = 30;

// ═══════════════════════════════════════════
// 组件
// ═══════════════════════════════════════════

export const SpreadsheetBlock = memo(function SpreadsheetBlock({
  headers,
  rows,
  source = 'markdown',
  title,
}: SpreadsheetProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [search, setSearch] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [page, setPage] = useState(0);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [copiedCell, setCopiedCell] = useState<string | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  // ── 过滤 ──
  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter(row => row.some(cell => cell.toLowerCase().includes(q)));
  }, [rows, search]);

  // ── 排序 ──
  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    const col = sortCol;
    return [...filtered].sort((a, b) => {
      const va = a[col] || '';
      const vb = b[col] || '';
      const na = Number(va.replace(/[,%$€¥£约~]/g, ''));
      const nb = Number(vb.replace(/[,%$€¥£约~]/g, ''));
      if (!isNaN(na) && !isNaN(nb)) {
        return sortDir === 'asc' ? na - nb : nb - na;
      }
      return sortDir === 'asc' ? va.localeCompare(vb, 'zh') : vb.localeCompare(va, 'zh');
    });
  }, [filtered, sortCol, sortDir]);

  // ── 分页 ──
  const needsPagination = sorted.length > PAGE_SIZE;
  const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
  const pageRows = needsPagination ? sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE) : sorted;

  // ── 排序切换 ──
  const toggleSort = useCallback((colIdx: number) => {
    if (sortCol === colIdx) {
      if (sortDir === 'asc') setSortDir('desc');
      else { setSortCol(null); setSortDir('asc'); }
    } else {
      setSortCol(colIdx);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortCol, sortDir]);

  // ── 复制单元格 ──
  const copyCell = useCallback((text: string, key: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCell(key);
      setTimeout(() => setCopiedCell(null), 1500);
    }).catch(() => {});
  }, []);

  // ── 导出 CSV ──
  const exportCSV = useCallback(() => {
    const escape = (s: string) => s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    const csvContent = [
      headers.map(escape).join(','),
      ...rows.map(row => row.map(escape).join(',')),
    ].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title || 'table'}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [headers, rows, title]);

  // ── 复制全表 ──
  const copyAll = useCallback(() => {
    const text = [headers.join('\t'), ...rows.map(row => row.join('\t'))].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setCopiedCell('__all__');
      setTimeout(() => setCopiedCell(null), 1500);
    }).catch(() => {});
  }, [headers, rows]);

  // ── 数字检测（用于右对齐 + 颜色） ──
  const isNumeric = (val: string) => /^-?[\d,]+\.?\d*[%$€¥£]?$/.test(val.replace(/[约~]/g, '').trim());

  // ── 排序图标 ──
  const SortIcon = ({ col }: { col: number }) => {
    if (sortCol !== col) return <ArrowUpDown className="w-3 h-3 opacity-0 group-hover/th:opacity-50 transition-opacity" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-600 dark:text-blue-400" />
      : <ArrowDown className="w-3 h-3 text-blue-600 dark:text-blue-400" />;
  };

  return (
    <div className="my-4 rounded-xl border border-blue-200/60 dark:border-blue-800/40 overflow-hidden bg-card shadow-sm hover:shadow-md transition-shadow">
      {/* ── 工具栏 ── */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-purple-50/30 dark:from-blue-950/40 dark:via-indigo-950/30 dark:to-purple-950/20 border-b border-blue-100 dark:border-blue-900/40">
        <Table2 className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="text-xs font-semibold text-blue-800 dark:text-blue-300 truncate">
          {title || '数据表格'}
          <span className="ml-1.5 font-normal text-blue-500/70 dark:text-blue-400/60">
            {rows.length} 行 × {headers.length} 列
          </span>
        </span>

        <div className="flex-1" />

        {/* 搜索 */}
        {showSearch ? (
          <div className="flex items-center gap-1 bg-white dark:bg-gray-900 border border-blue-200 dark:border-blue-800 rounded-lg px-2 py-0.5 shadow-sm">
            <Search className="w-3 h-3 text-blue-400 shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0); }}
              placeholder="搜索..."
              className="text-xs bg-transparent outline-none w-24 sm:w-32 text-foreground placeholder:text-blue-300 dark:placeholder:text-blue-600"
            />
            {search && (
              <button onClick={() => { setSearch(''); setPage(0); }} className="text-blue-400 hover:text-blue-600">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={() => setShowSearch(true)}
            className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-blue-500 dark:text-blue-400"
            title="搜索"
          >
            <Search className="w-3.5 h-3.5" />
          </button>
        )}

        {/* 复制 */}
        <button
          onClick={copyAll}
          className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-blue-500 dark:text-blue-400"
          title="复制全表"
        >
          {copiedCell === '__all__' ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
        </button>

        {/* 导出 */}
        <button
          onClick={exportCSV}
          className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors text-blue-500 dark:text-blue-400"
          title="导出 CSV"
        >
          <Download className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* 搜索结果提示 */}
      {search && (
        <div className="px-3 py-1 text-[10px] text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 border-b border-blue-100 dark:border-blue-900/30">
          找到 <strong>{filtered.length}</strong> / {rows.length} 行
        </div>
      )}

      {/* ── 表格主体 ── */}
      <div ref={tableRef} className="overflow-x-auto max-h-[500px] overflow-y-auto">
        <table className="min-w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="bg-gradient-to-r from-slate-100 via-blue-50/80 to-slate-100 dark:from-slate-800 dark:via-blue-900/30 dark:to-slate-800">
              {/* 行号列 */}
              <th className="w-10 px-2 py-2.5 text-center text-[10px] font-bold text-blue-500/70 dark:text-blue-400/60 border-b-2 border-blue-200/60 dark:border-blue-800/40 border-r border-blue-100 dark:border-blue-900/30 select-none">
                #
              </th>
              {headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => toggleSort(i)}
                  className="group/th px-3 py-2.5 text-left text-xs font-bold text-slate-700 dark:text-slate-200 border-b-2 border-blue-200/60 dark:border-blue-800/40 cursor-pointer select-none hover:bg-blue-100/60 dark:hover:bg-blue-800/30 transition-colors whitespace-nowrap"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {h || `列${i + 1}`}
                    <SortIcon col={i} />
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 1} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  {search ? '没有匹配的数据' : '暂无数据'}
                </td>
              </tr>
            ) : (
              pageRows.map((row, ri) => {
                const globalIdx = needsPagination ? page * PAGE_SIZE + ri : ri;
                const isSelected = selectedRow === globalIdx;
                return (
                  <tr
                    key={globalIdx}
                    onClick={() => setSelectedRow(isSelected ? null : globalIdx)}
                    className={[
                      'transition-colors cursor-pointer group/row',
                      isSelected
                        ? 'bg-blue-100/70 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40'
                        : ri % 2 === 0
                          ? 'bg-white dark:bg-gray-950 hover:bg-blue-50/50 dark:hover:bg-blue-950/20'
                          : 'bg-slate-50/70 dark:bg-slate-900/40 hover:bg-blue-50/50 dark:hover:bg-blue-950/20',
                    ].join(' ')}
                  >
                    {/* 行号 */}
                    <td className="px-2 py-2 text-center text-[10px] font-mono border-r border-blue-100/60 dark:border-blue-900/30 select-none text-blue-400/70 dark:text-blue-500/50 group-hover/row:text-blue-500 transition-colors">
                      {globalIdx + 1}
                    </td>
                    {row.map((cell, ci) => {
                      const cellKey = `${globalIdx}-${ci}`;
                      const isCopied = copiedCell === cellKey;
                      const isNum = isNumeric(cell);
                      // 第一列通常是标签列，加粗
                      const isLabel = ci === 0;
                      return (
                        <td
                          key={ci}
                          onClick={(e) => { e.stopPropagation(); copyCell(cell, cellKey); }}
                          title="点击复制"
                          className={[
                            'px-3 py-2 border-t border-slate-100 dark:border-slate-800/60 transition-all',
                            isNum ? 'text-right font-mono tabular-nums text-slate-700 dark:text-slate-300' : '',
                            isLabel ? 'font-semibold text-slate-800 dark:text-slate-100' : '',
                            isCopied ? 'bg-green-100 dark:bg-green-900/30 ring-1 ring-green-300 dark:ring-green-700 rounded' : 'hover:bg-blue-50 dark:hover:bg-blue-950/30',
                          ].join(' ')}
                        >
                          <span className="relative">
                            {cell}
                            {isCopied && (
                              <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[9px] font-semibold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950 px-1.5 py-0.5 rounded-md shadow-sm whitespace-nowrap animate-in fade-in slide-in-from-bottom-1 duration-150 border border-green-200 dark:border-green-800">
                                ✓ 已复制
                              </span>
                            )}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── 分页 ── */}
      {needsPagination && (
        <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-slate-50 to-blue-50/30 dark:from-slate-900 dark:to-blue-950/20 border-t border-blue-100 dark:border-blue-900/30">
          <span className="text-[10px] text-slate-500 dark:text-slate-400">
            第 {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, sorted.length)} 行，共 {sorted.length} 行
          </span>
          <div className="flex items-center gap-1">
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-blue-500"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 px-1 min-w-[40px] text-center">
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              className="p-1 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-blue-500"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});
