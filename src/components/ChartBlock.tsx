/**
 * ChartBlock — ```chart 代码块渲染组件
 *
 * AI 输出精简 JSON，前端自动渲染为 Recharts 图表。
 * 支持 6 种图表类型：bar / line / area / pie / radar / scatter
 *
 * JSON Schema:
 * {
 *   "type": "bar|line|area|pie|radar|scatter",
 *   "title": "图表标题",
 *   "data": [{"name":"Q1","value":320,"value2":180}, ...],
 *   "xKey": "name",
 *   "series": [{"key":"value","name":"营收","color":"#3b82f6"}, ...],
 *   "yLabel": "万元",
 *   "stacked": false
 * }
 */

import { memo, useState, useRef } from 'react';
import {
  ResponsiveContainer,
  BarChart, Bar,
  LineChart, Line,
  AreaChart, Area,
  PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
  ScatterChart, Scatter,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { Download, Maximize2, Minimize2, BarChart3 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 内置 10 色调色板 ═══════
const PALETTE = [
  '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
  '#ec4899', '#06b6d4', '#f97316', '#6366f1', '#14b8a6',
];

// ═══════ 图表类型映射 ═══════
const CHART_TYPE_LABELS: Record<string, string> = {
  bar: '柱状图', line: '折线图', area: '面积图',
  pie: '饼图', radar: '雷达图', scatter: '散点图',
};

const CHART_TYPES = ['bar', 'line', 'area', 'pie', 'radar', 'scatter'] as const;
type ChartType = typeof CHART_TYPES[number];

interface SeriesItem {
  key: string;
  name?: string;
  color?: string;
}

interface ChartData {
  type: ChartType;
  title?: string;
  data: Record<string, any>[];
  xKey?: string;
  series?: SeriesItem[];
  yLabel?: string;
  stacked?: boolean;
}

interface ChartBlockProps {
  jsonStr: string;
  streaming?: boolean;
}

// ═══════ 通用 axis/grid 样式（模块级常量） ═══════
const AXIS_STYLE = { fontSize: 12, fill: 'var(--muted-foreground, #94a3b8)' };
const GRID_PROPS = { strokeDasharray: '3 3', stroke: 'var(--border, #e2e8f0)', opacity: 0.6 };

/** 从不完整 JSON 中提取 title 和 type */
function extractPartialMeta(str: string): { title?: string; type?: string } {
  const title = str.match(/"title"\s*:\s*"([^"]*)/)?.[1];
  const type = str.match(/"type"\s*:\s*"([^"]*)/)?.[1];
  return { title, type };
}

/** 自动推断 series（从第一条数据中排除 xKey） */
function inferSeries(data: Record<string, any>[], xKey: string): SeriesItem[] {
  if (!data.length) return [];
  return Object.keys(data[0])
    .filter(k => k !== xKey && typeof data[0][k] === 'number')
    .map((k, i) => ({ key: k, name: k, color: PALETTE[i % PALETTE.length] }));
}

/** 自定义 Tooltip */
function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-popover border border-border rounded-lg shadow-lg p-2.5 text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <div key={i} className="flex items-center gap-2 py-0.5">
          <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: entry.color }} />
          <span className="text-muted-foreground">{entry.name}:</span>
          <span className="font-medium text-foreground ml-auto">
            {typeof entry.value === 'number' ? entry.value.toLocaleString() : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 自定义 Pie Label */
function renderPieLabel({ name, percent }: any) {
  return `${name} ${(percent * 100).toFixed(0)}%`;
}

function ChartBlockInner({ jsonStr, streaming }: ChartBlockProps) {
  const [chartType, setChartType] = useState<ChartType | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  let parsed: ChartData | null = null;
  let parseError: string | null = null;

  const result = safeParseJson<any>(jsonStr);
  parseError = result.error;

  // ★ 兼容裸数组：AI 可能直接输出 [{x,y,...},...] 而非 {data:[...]}
  if (Array.isArray(result.data)) {
    parsed = { data: result.data };
  } else {
    parsed = result.data;
  }

  // 流式中 JSON 不完整 → 显示骨架卡片
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-blue-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '图表生成中...'}</h3>
            {partial.type && (
              <span className="text-[10px] text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
                {CHART_TYPE_LABELS[partial.type] || partial.type}
              </span>
            )}
          </div>
          <div className="h-[200px] bg-muted/30 rounded-lg flex items-end justify-center gap-2 p-4">
            {[40, 65, 50, 80, 35, 70, 55].map((h, i) => (
              <div key={i} className="w-8 bg-muted rounded-t animate-pulse" style={{ height: `${h}%`, animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-300 via-blue-500 to-blue-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // JSON 解析失败 → 优雅降级
  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <BarChart3 className="w-3.5 h-3.5" />
          <span>图表数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const activeType = chartType || parsed.type || 'bar';
  const xKey = parsed.xKey || 'name';
  const series = parsed.series?.length
    ? parsed.series.map((s, i) => ({ ...s, color: s.color || PALETTE[i % PALETTE.length] }))
    : inferSeries(parsed.data || [], xKey);
  const data = parsed.data || [];

  // ── 下载 PNG ──
  const handleDownloadPng = () => {
    const svgEl = chartRef.current?.querySelector('svg');
    if (!svgEl) return;
    // ★ 获取 SVG 实际渲染尺寸（ResponsiveContainer 用百分比宽度）
    const rect = svgEl.getBoundingClientRect();
    const w = Math.round(rect.width) || 800;
    const h = Math.round(rect.height) || 400;
    // 克隆并设置明确宽高（确保 Image 解析正确）
    const clone = svgEl.cloneNode(true) as SVGElement;
    clone.setAttribute('width', String(w));
    clone.setAttribute('height', String(h));
    const svgData = new XMLSerializer().serializeToString(clone);
    const canvas = document.createElement('canvas');
    const dpr = 2; // 2x 高清
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    const img = new window.Image();
    img.onload = () => {
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.scale(dpr, dpr);
        ctx.drawImage(img, 0, 0, w, h);
      }
      const a = document.createElement('a');
      a.download = `${parsed?.title || 'chart'}.png`;
      a.href = canvas.toDataURL('image/png');
      a.click();
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svgData);
  };

  // ── 图表渲染 ──
  const renderChart = () => {
    const h = isFullscreen ? 500 : 300;
    const margin = { top: 5, right: 20, bottom: 5, left: 10 };

    switch (activeType) {
      case 'pie':
        return (
          <ResponsiveContainer width="100%" height={h}>
            <PieChart>
              <Pie
                data={data}
                dataKey={series[0]?.key || 'value'}
                nameKey={xKey}
                cx="50%" cy="50%"
                outerRadius={isFullscreen ? 180 : 110}
                label={renderPieLabel}
                labelLine={{ stroke: 'var(--muted-foreground, #94a3b8)', strokeWidth: 1 }}
              >
                {data.map((entry, i) => (
                  <Cell key={i} fill={entry.color || PALETTE[i % PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        );

      case 'radar':
        return (
          <ResponsiveContainer width="100%" height={h}>
            <RadarChart data={data} cx="50%" cy="50%" outerRadius={isFullscreen ? 170 : 100}>
              <PolarGrid stroke="var(--border, #e2e8f0)" />
              <PolarAngleAxis dataKey={xKey} tick={AXIS_STYLE} />
              <PolarRadiusAxis tick={AXIS_STYLE} />
              {series.map((s) => (
                <Radar key={s.key} name={s.name || s.key} dataKey={s.key}
                  stroke={s.color} fill={s.color} fillOpacity={0.2} strokeWidth={2} />
              ))}
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </RadarChart>
          </ResponsiveContainer>
        );

      case 'scatter':
        return (
          <ResponsiveContainer width="100%" height={h}>
            <ScatterChart margin={margin}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey={xKey} tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} label={parsed?.yLabel ? { value: parsed.yLabel, angle: -90, position: 'insideLeft', style: AXIS_STYLE } : undefined} />
              {series.map((s) => (
                <Scatter key={s.key} name={s.name || s.key} data={data} dataKey={s.key}
                  fill={s.color} />
              ))}
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </ScatterChart>
          </ResponsiveContainer>
        );

      case 'area':
        return (
          <ResponsiveContainer width="100%" height={h}>
            <AreaChart data={data} margin={margin}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey={xKey} tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} label={parsed?.yLabel ? { value: parsed.yLabel, angle: -90, position: 'insideLeft', style: AXIS_STYLE } : undefined} />
              {series.map((s) => (
                <Area key={s.key} type="monotone" dataKey={s.key} name={s.name || s.key}
                  stroke={s.color} fill={s.color} fillOpacity={0.15} strokeWidth={2}
                  stackId={parsed?.stacked ? 'stack' : undefined} />
              ))}
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </AreaChart>
          </ResponsiveContainer>
        );

      case 'line':
        return (
          <ResponsiveContainer width="100%" height={h}>
            <LineChart data={data} margin={margin}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey={xKey} tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} label={parsed?.yLabel ? { value: parsed.yLabel, angle: -90, position: 'insideLeft', style: AXIS_STYLE } : undefined} />
              {series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} name={s.name || s.key}
                  stroke={s.color} strokeWidth={2} dot={{ r: 3, fill: s.color }} activeDot={{ r: 5 }} />
              ))}
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </LineChart>
          </ResponsiveContainer>
        );

      case 'bar':
      default:
        return (
          <ResponsiveContainer width="100%" height={h}>
            <BarChart data={data} margin={margin}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey={xKey} tick={AXIS_STYLE} />
              <YAxis tick={AXIS_STYLE} label={parsed?.yLabel ? { value: parsed.yLabel, angle: -90, position: 'insideLeft', style: AXIS_STYLE } : undefined} />
              {series.map((s) => (
                <Bar key={s.key} dataKey={s.key} name={s.name || s.key}
                  fill={s.color} radius={[4, 4, 0, 0]}
                  stackId={parsed?.stacked ? 'stack' : undefined} />
              ))}
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'var(--muted, #f1f5f9)', opacity: 0.3 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </BarChart>
          </ResponsiveContainer>
        );
    }
  };

  return (
    <div className={cn(
      'my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm',
      isFullscreen && 'fixed inset-4 z-50 rounded-2xl shadow-2xl'
    )}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 min-w-0">
          <BarChart3 className="w-4 h-4 text-blue-500 flex-shrink-0" />
          <h3 className="text-sm font-medium truncate">{parsed.title || '数据图表'}</h3>
          <span className="text-[10px] text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800 flex-shrink-0">
            {CHART_TYPE_LABELS[activeType] || activeType}
          </span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          {/* 切换图表类型 */}
          <div className="hidden sm:flex items-center bg-muted rounded-lg p-0.5 mr-1">
            {CHART_TYPES.map(t => (
              <button key={t} onClick={() => setChartType(t)} title={CHART_TYPE_LABELS[t]}
                className={cn('px-1.5 py-0.5 rounded-md text-[10px] font-medium transition-all',
                  activeType === t ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground')}>
                {CHART_TYPE_LABELS[t]}
              </button>
            ))}
          </div>
          <button onClick={handleDownloadPng} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title="下载 PNG">
            <Download className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => setIsFullscreen(!isFullscreen)} className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground" title={isFullscreen ? '退出全屏' : '全屏'}>
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* 图表区 */}
      <div ref={chartRef} className="px-2 py-3">
        {renderChart()}
      </div>

      {/* 全屏遮罩 */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm -z-10" onClick={() => setIsFullscreen(false)} />
      )}
    </div>
  );
}

export const ChartBlock = memo(ChartBlockInner);
