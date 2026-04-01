/**
 * ComparisonBlock — ```comparison 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为结构化对比表格。
 * 支持 2~N 项对比，winner 高亮，可选评分条，底部推荐区。
 *
 * JSON Schema:
 * {
 *   "title": "iPhone 16 vs Samsung S25",
 *   "items": ["iPhone 16", "Samsung S25"],
 *   "dimensions": [
 *     {
 *       "name": "价格",
 *       "values": ["6999元", "7999元"],
 *       "winner": 0,
 *       "note": "iPhone 便宜 1000 元"
 *     },
 *     {
 *       "name": "拍照",
 *       "values": ["4800万主摄", "2亿像素"],
 *       "scores": [8.5, 9.0],
 *       "winner": 1
 *     }
 *   ],
 *   "recommendation": {
 *     "pick": 1,
 *     "reason": "如果预算充足且注重拍照，S25 更适合"
 *   }
 * }
 */

import { memo, useState, useRef } from 'react';
import { Scale, Trophy, ChevronUp, Info, Camera, GripVertical, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════

interface ComparisonDimension {
  name: string;
  values: string[];
  winner?: number;      // 胜出项索引，-1 或 undefined 表示平手
  scores?: number[];    // 可选评分（0-10）
  note?: string;        // 补充说明
}

interface ComparisonRecommendation {
  pick: number;         // 推荐项索引
  reason: string;
}

interface ComparisonData {
  title?: string;
  items: string[];
  dimensions: ComparisonDimension[];
  recommendation?: ComparisonRecommendation;
}

interface ComparisonBlockProps {
  jsonStr: string;
  streaming?: boolean;
}

// ═══════ 颜色方案 ═══════

/** 每列对比项的主题色（最多支持 5 列） */
const ITEM_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-950/30', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-800', bar: 'bg-blue-500', accent: '#3b82f6' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/30', text: 'text-emerald-700 dark:text-emerald-300', border: 'border-emerald-200 dark:border-emerald-800', bar: 'bg-emerald-500', accent: '#10b981' },
  { bg: 'bg-amber-50 dark:bg-amber-950/30', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-800', bar: 'bg-amber-500', accent: '#f59e0b' },
  { bg: 'bg-purple-50 dark:bg-purple-950/30', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-800', bar: 'bg-purple-500', accent: '#8b5cf6' },
  { bg: 'bg-rose-50 dark:bg-rose-950/30', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-800', bar: 'bg-rose-500', accent: '#f43f5e' },
];

const WINNER_BG = 'bg-emerald-50/80 dark:bg-emerald-950/20';
const WINNER_RING = 'ring-1 ring-emerald-300/50 dark:ring-emerald-700/50';

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

/** 评分条 */
function ScoreBar({ score, maxScore = 10, colorClass }: { score: number; maxScore?: number; colorClass: string }) {
  const safeMax = maxScore || 10;
  const pct = Math.min(100, Math.max(0, (score / safeMax) * 100));
  return (
    <div className="flex items-center gap-1.5 mt-1">
      <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={cn('h-full rounded-full transition-all duration-500', colorClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-[10px] font-semibold text-muted-foreground tabular-nums w-6 text-right">
        {score}
      </span>
    </div>
  );
}

/** 胜出标记 */
function WinnerBadge() {
  return (
    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-900/50 px-1.5 py-0.5 rounded-full leading-none whitespace-nowrap">
      <Trophy className="w-2.5 h-2.5" />
      胜
    </span>
  );
}

/** 下载 Blob 为 PNG 文件 */
function downloadBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `comparison-${Date.now()}.png`;
  a.click();
  URL.revokeObjectURL(url);
}

/** 纯 Canvas API 渲染对比表格为图片（不依赖 html2canvas） */
function renderComparisonToImage(data: ComparisonData): Promise<Blob | null> {
  return new Promise(resolve => {
    const items = data.items || [];
    const dims = data.dimensions || [];
    const itemCount = items.length || 2;

    // 尺寸计算
    const dpr = 2;
    const colWidth = 200;
    const dimColWidth = 100;
    const rowHeight = 40;
    const headerHeight = 50;
    const titleHeight = 48;
    const padding = 16;
    const width = dimColWidth + itemCount * colWidth + padding * 2;
    const height = titleHeight + headerHeight + dims.length * rowHeight + padding * 2 + (data.recommendation ? 50 : 0);

    const canvas = document.createElement('canvas');
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) { resolve(null); return; }
    ctx.scale(dpr, dpr);

    // 背景
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // 标题
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 16px system-ui, -apple-system, sans-serif';
    ctx.fillText(`⚖️ ${data.title || '对比分析'}`, padding, padding + 20);

    // 维度数 badge
    ctx.fillStyle = '#94a3b8';
    ctx.font = '11px system-ui';
    const badgeText = `${dims.length} 项维度`;
    const titleWidth = ctx.measureText(`⚖️ ${data.title || '对比分析'}`).width;
    ctx.fillText(badgeText, padding + titleWidth + 12, padding + 20);

    const tableTop = padding + titleHeight;
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e'];

    // 表头
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(padding, tableTop, width - padding * 2, headerHeight);
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.strokeRect(padding, tableTop, width - padding * 2, headerHeight);

    items.forEach((item, idx) => {
      const x = padding + dimColWidth + idx * colWidth;
      ctx.fillStyle = colors[idx % colors.length] + '15';
      ctx.fillRect(x, tableTop, colWidth, headerHeight);
      ctx.fillStyle = colors[idx % colors.length];
      ctx.font = 'bold 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(item, x + colWidth / 2, tableTop + headerHeight / 2 + 5);
    });

    // 维度行
    dims.forEach((dim, di) => {
      const y = tableTop + headerHeight + di * rowHeight;

      // 交替行背景
      if (di % 2 === 0) {
        ctx.fillStyle = '#fafafa';
        ctx.fillRect(padding, y, width - padding * 2, rowHeight);
      }

      // 行底线
      ctx.strokeStyle = '#f1f5f9';
      ctx.beginPath();
      ctx.moveTo(padding, y + rowHeight);
      ctx.lineTo(width - padding, y + rowHeight);
      ctx.stroke();

      // 维度名
      ctx.fillStyle = '#64748b';
      ctx.font = '12px system-ui';
      ctx.textAlign = 'left';
      ctx.fillText(dim.name, padding + 8, y + rowHeight / 2 + 4);

      // 值
      (dim.values || []).forEach((val, vi) => {
        const x = padding + dimColWidth + vi * colWidth;
        const isWinner = dim.winner != null && dim.winner === vi;

        if (isWinner) {
          ctx.fillStyle = '#f0fdf4';
          ctx.fillRect(x, y, colWidth, rowHeight);
        }

        ctx.fillStyle = isWinner ? '#166534' : '#475569';
        ctx.font = isWinner ? 'bold 12px system-ui' : '12px system-ui';
        ctx.textAlign = 'left';
        const truncated = val.length > 18 ? val.slice(0, 17) + '…' : val;
        ctx.fillText(truncated, x + 8, y + rowHeight / 2 + 4);

        if (isWinner) {
          const valWidth = ctx.measureText(truncated).width;
          ctx.fillStyle = '#16a34a';
          ctx.font = 'bold 10px system-ui';
          ctx.fillText('🏆胜', x + 8 + valWidth + 6, y + rowHeight / 2 + 4);
        }
      });
    });

    // 推荐区
    if (data.recommendation) {
      const recY = tableTop + headerHeight + dims.length * rowHeight + 8;
      ctx.fillStyle = '#f0fdf4';
      ctx.fillRect(padding, recY, width - padding * 2, 40);
      ctx.fillStyle = '#166534';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'left';
      const pickName = items[data.recommendation.pick] || `选项 ${data.recommendation.pick + 1}`;
      ctx.fillText(`🏆 推荐：${pickName} — ${data.recommendation.reason || ''}`, padding + 8, recY + 24);
    }

    // 品牌水印
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'right';
    ctx.fillText('Insi AI', width - padding, height - 8);

    canvas.toBlob(blob => resolve(blob), 'image/png');
  });
}

/** 生成文字摘要（Canvas 失败时的降级方案） */
function generateTextSummary(data: ComparisonData): string {
  const items = data.items || ['A', 'B'];
  const dims = data.dimensions || [];
  const lines = [`📊 ${data.title || '对比分析'}\n`];
  lines.push(`${items.join(' vs ')}\n`);
  dims.forEach(d => {
    const winner = d.winner != null && d.winner >= 0 ? ` ✅${items[d.winner]}` : '';
    lines.push(`▸ ${d.name}: ${(d.values || []).join(' | ')}${winner}`);
  });
  if (data.recommendation) {
    lines.push(`\n🏆 推荐：${items[data.recommendation.pick] || ''} — ${data.recommendation.reason || ''}`);
  }
  return lines.join('\n');
}

function ComparisonBlockInner({ jsonStr, streaming }: ComparisonBlockProps) {
  const [expandedNotes, setExpandedNotes] = useState<Set<number>>(new Set());
  const [sharing, setSharing] = useState(false);
  const [dimOrder, setDimOrder] = useState<number[] | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [userDims, setUserDims] = useState<ComparisonDimension[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDimName, setNewDimName] = useState('');
  const [newDimValues, setNewDimValues] = useState<string[]>([]);
  const cardRef = useRef<HTMLDivElement>(null);

  let parsed: ComparisonData | null = null;
  {
    const r = safeParseJson<any>(jsonStr);
    if (Array.isArray(r.data)) {
      parsed = { items: [], dimensions: r.data };
    } else {
      parsed = r.data;
    }
  }

  // ★ 分享为图片（纯 Canvas API，不依赖 html2canvas）
  const handleShareImage = async () => {
    if (!parsed || sharing) return;
    setSharing(true);
    try {
      const blob = await renderComparisonToImage(parsed);
      if (!blob) return;
      if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
        try {
          await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        } catch {
          downloadBlob(blob);
        }
      } else {
        downloadBlob(blob);
      }
    } catch {
      const text = generateTextSummary(parsed);
      try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
    } finally {
      setSharing(false);
    }
  };

  // ═══════ 流式骨架 ═══════
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Scale className="w-4 h-4 text-blue-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '对比表生成中...'}</h3>
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex gap-2">
                <div className="w-16 h-8 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                <div className="flex-1 h-8 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                <div className="flex-1 h-8 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 100 + 100}ms` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-300 via-blue-500 to-blue-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // ═══════ 解析失败降级 ═══════
  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>对比数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  // ═══════ 数据规范化 ═══════
  const items = parsed.items || [];
  const allDims = [...(parsed.dimensions || []), ...userDims];
  const dims = allDims;
  const itemCount = items.length || (dims[0]?.values?.length ?? 2);

  // 统计每项胜出次数
  const winCounts = new Array(itemCount).fill(0);
  dims.forEach(d => {
    if (d.winner != null && d.winner >= 0 && d.winner < itemCount) {
      winCounts[d.winner]++;
    }
  });

  // ★ 拖拽排序：orderedDims 为显示顺序
  const order = dimOrder || dims.map((_, i) => i);
  const orderedDims = order.map(i => dims[i]).filter(Boolean);

  const handleDragStart = (idx: number) => { setDragIdx(idx); };
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const newOrder = [...order];
    const [moved] = newOrder.splice(dragIdx, 1);
    newOrder.splice(idx, 0, moved);
    setDimOrder(newOrder);
    setDragIdx(idx);
  };
  const handleDragEnd = () => { setDragIdx(null); };

  const toggleNote = (idx: number) => {
    setExpandedNotes(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div ref={cardRef} className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* ═══════ 标题栏 ═══════ */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Scale className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-medium">{parsed.title || '对比分析'}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {dims.length} 项维度
          </span>
        </div>
        <button
          onClick={handleShareImage}
          disabled={sharing}
          className="p-1 text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          title="分享为图片"
        >
          <Camera className={cn('w-3.5 h-3.5', sharing && 'animate-pulse')} />
        </button>
      </div>

      {/* ═══════ 可滚动对比区域（移动端 3+ 列可横滑） ═══════ */}
      <div className="overflow-x-auto">
        <div style={{ minWidth: itemCount > 2 ? `${120 + itemCount * 140}px` : undefined }}>
          {/* 对比头部 */}
          {items.length > 0 && (
            <div className="grid border-b border-border bg-muted/10" style={{ gridTemplateColumns: `120px repeat(${itemCount}, 1fr)` }}>
              {/* 空白角 */}
              <div className="px-3 py-2.5" />
              {/* 产品头 */}
              {items.map((item, idx) => {
                const color = ITEM_COLORS[idx % ITEM_COLORS.length];
                return (
                  <div
                    key={idx}
                    className={cn('px-3 py-2.5 text-center border-l border-border', color.bg)}
                  >
                    <div className={cn('text-xs font-semibold', color.text)}>
                      {item}
                    </div>
                    {winCounts[idx] > 0 && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {winCounts[idx]} 项胜出
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 维度行 */}
          <div className="divide-y divide-border">
            {orderedDims.map((dim, oi) => {
              const hasNote = !!dim.note;
              const noteExpanded = expandedNotes.has(oi);
              const colCount = items.length > 0 ? itemCount : (dim.values?.length ?? 2);

              return (
                <div
                  key={dim.name + oi}
                  draggable
                  onDragStart={() => handleDragStart(oi)}
                  onDragOver={e => handleDragOver(e, oi)}
                  onDragEnd={handleDragEnd}
                  className={cn('transition-opacity', dragIdx === oi && 'opacity-50')}
                >
                  <div
                    className="grid items-center"
                    style={{ gridTemplateColumns: `120px repeat(${colCount}, 1fr)` }}
                  >
                    {/* 维度名 + 拖拽手柄 */}
                    <div className="px-3 py-2.5 flex items-center gap-1">
                      <GripVertical className="w-3 h-3 text-muted-foreground/30 cursor-grab active:cursor-grabbing flex-shrink-0" />
                      <span className="text-xs font-medium text-foreground">{dim.name}</span>
                      {hasNote && (
                        <button
                          onClick={() => toggleNote(oi)}
                          className="text-muted-foreground hover:text-foreground transition-colors"
                          title={dim.note}
                        >
                          {noteExpanded ? <ChevronUp className="w-3 h-3" /> : <Info className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {/* 值 */}
                    {(dim.values || []).map((val, vi) => {
                      const isWinner = dim.winner != null && dim.winner === vi;
                      const color = ITEM_COLORS[vi % ITEM_COLORS.length];

                      return (
                        <div
                          key={vi}
                          className={cn(
                            'px-3 py-2.5 border-l border-border transition-colors',
                            isWinner ? WINNER_BG + ' ' + WINNER_RING : ''
                          )}
                        >
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={cn('text-xs break-words', isWinner ? 'font-semibold text-foreground' : 'text-muted-foreground')} style={{ overflowWrap: 'anywhere' }}>
                              {val}
                            </span>
                            {isWinner && <WinnerBadge />}
                          </div>
                          {/* 可选评分条 */}
                          {dim.scores && dim.scores[vi] != null && (
                            <ScoreBar score={dim.scores[vi]} colorClass={color.bar} />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* 展开说明 */}
                  {hasNote && noteExpanded && (
                    <div className="px-3 pb-2 -mt-1">
                      <div className="ml-[120px] text-[11px] text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-md">
                        {dim.note}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ═══════ 添加维度 ═══════ */}
      <div className="border-t border-border px-4 py-2">
        {showAddForm ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newDimName}
              onChange={e => setNewDimName(e.target.value)}
              placeholder="维度名称（如：续航、售后）"
              className="w-full text-xs px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${itemCount}, 1fr)` }}>
              {items.map((item, idx) => (
                <input
                  key={idx}
                  type="text"
                  value={newDimValues[idx] || ''}
                  onChange={e => {
                    const vals = [...newDimValues];
                    vals[idx] = e.target.value;
                    setNewDimValues(vals);
                  }}
                  placeholder={item}
                  className="text-xs px-2 py-1.5 rounded border border-border bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                />
              ))}
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setShowAddForm(false); setNewDimName(''); setNewDimValues([]); }}
                className="text-[10px] px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
              >取消</button>
              <button
                onClick={() => {
                  if (!newDimName.trim()) return;
                  const newDim: ComparisonDimension = {
                    name: newDimName.trim(),
                    values: items.map((_, i) => newDimValues[i]?.trim() || '-'),
                  };
                  setUserDims(prev => [...prev, newDim]);
                  setDimOrder(null); // 重置排序
                  setShowAddForm(false);
                  setNewDimName('');
                  setNewDimValues([]);
                }}
                disabled={!newDimName.trim()}
                className="text-[10px] px-3 py-1 font-medium text-white bg-blue-500 rounded hover:bg-blue-600 disabled:opacity-40 transition-colors"
              >添加</button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => { setShowAddForm(true); setNewDimValues(new Array(itemCount).fill('')); }}
            className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus className="w-3 h-3" />添加对比维度
          </button>
        )}
      </div>

      {/* ═══════ 推荐区 ═══════ */}
      {parsed.recommendation && (
        <div className="border-t border-border bg-gradient-to-r from-emerald-50/50 via-transparent to-transparent dark:from-emerald-950/20 px-4 py-3">
          <div className="flex items-start gap-2">
            <Trophy className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
            <div>
              <div className="text-xs font-semibold text-foreground">
                推荐：{items[parsed.recommendation.pick] || `选项 ${parsed.recommendation.pick + 1}`}
              </div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                {parsed.recommendation.reason}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════ 移动端横滑提示 ═══════ */}
      {itemCount > 2 && (
        <div className="sm:hidden text-center py-1.5 text-[10px] text-muted-foreground/60 border-t border-border">
          ← 横向滑动查看更多 →
        </div>
      )}
    </div>
  );
}

export const ComparisonBlock = memo(ComparisonBlockInner);
