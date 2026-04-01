/**
 * LiveDataCard — ```live-data 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为天气/股票/汇率实时卡片。
 * 按 type 字段分支渲染不同样式。
 *
 * Weather Schema:
 * {
 *   "type": "weather",
 *   "data": {
 *     "city": "北京",
 *     "temp": 18,
 *     "high": 22, "low": 12,
 *     "condition": "晴",
 *     "humidity": 45,
 *     "wind": "北风3级",
 *     "forecast": [
 *       {"day": "周二", "high": 24, "low": 14, "condition": "多云"},
 *       ...
 *     ]
 *   }
 * }
 *
 * Stock Schema:
 * {
 *   "type": "stock",
 *   "data": {
 *     "name": "苹果", "symbol": "AAPL",
 *     "price": 178.52, "currency": "USD",
 *     "change": 2.35, "changePercent": 1.33,
 *     "high": 180.10, "low": 176.20, "open": 176.50,
 *     "volume": "52.3M",
 *     "sparkline": [175, 176, 177, 178, 179, 178.5]
 *   }
 * }
 *
 * Exchange Schema:
 * {
 *   "type": "exchange",
 *   "data": {
 *     "from": "USD", "to": "CNY",
 *     "rate": 7.24,
 *     "amount": 1,
 *     "result": 7.24,
 *     "trend": [7.20, 7.22, 7.25, 7.23, 7.24],
 *     "updated": "2025-03-31 10:00"
 *   }
 * }
 */

import { memo, useState, useEffect, useCallback } from 'react';
import {
  Cloud, Sun, CloudRain, CloudSnow, CloudLightning, Wind, Droplets,
  TrendingUp, TrendingDown, Minus, ArrowRightLeft, Activity,
  CloudDrizzle, CloudFog, Snowflake, CloudSun, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════

interface ForecastDay {
  day: string;
  high: number;
  low: number;
  condition: string;
}

interface WeatherData {
  city: string;
  temp: number;
  high?: number;
  low?: number;
  condition: string;
  humidity?: number;
  wind?: string;
  forecast?: ForecastDay[];
}

interface StockData {
  name: string;
  symbol?: string;
  price: number;
  currency?: string;
  change?: number;
  changePercent?: number;
  high?: number;
  low?: number;
  open?: number;
  volume?: string;
  sparkline?: number[];
}

interface ExchangeData {
  from: string;
  to: string;
  rate: number;
  amount?: number;
  result?: number;
  trend?: number[];
  updated?: string;
}

type LiveData =
  | { type: 'weather'; data: WeatherData }
  | { type: 'stock'; data: StockData }
  | { type: 'exchange'; data: ExchangeData };

interface LiveDataCardProps {
  jsonStr: string;
  streaming?: boolean;
}

// ═══════ 天气图标映射 ═══════

const WEATHER_ICONS: Record<string, typeof Sun> = {
  '晴': Sun, '大晴天': Sun, 'sunny': Sun, 'clear': Sun,
  '多云': CloudSun, 'cloudy': CloudSun, '少云': CloudSun,
  '阴': Cloud, 'overcast': Cloud, '阴天': Cloud,
  '雨': CloudRain, '小雨': CloudDrizzle, '中雨': CloudRain, '大雨': CloudRain, 'rain': CloudRain, 'drizzle': CloudDrizzle,
  '雪': CloudSnow, '小雪': Snowflake, '中雪': CloudSnow, '大雪': CloudSnow, 'snow': CloudSnow,
  '雷': CloudLightning, '雷阵雨': CloudLightning, 'thunder': CloudLightning, 'storm': CloudLightning,
  '雾': CloudFog, '霾': CloudFog, 'fog': CloudFog, 'haze': CloudFog,
};

function getWeatherIcon(condition: string) {
  const lower = condition.toLowerCase();
  for (const [key, Icon] of Object.entries(WEATHER_ICONS)) {
    if (lower.includes(key.toLowerCase())) return Icon;
  }
  return Cloud;
}

const WEATHER_BG: Record<string, string> = {
  '晴': 'from-amber-400 to-orange-500',
  '多云': 'from-blue-400 to-slate-500',
  '阴': 'from-slate-400 to-slate-600',
  '雨': 'from-blue-500 to-indigo-600',
  '雪': 'from-blue-200 to-slate-400',
  '雷': 'from-purple-500 to-slate-700',
};

function getWeatherGradient(condition: string): string {
  for (const [key, gradient] of Object.entries(WEATHER_BG)) {
    if (condition.includes(key)) return gradient;
  }
  return 'from-sky-400 to-blue-500';
}

// ═══════ 迷你折线图（纯 SVG） ═══════

function Sparkline({ data, color = '#10b981', width = 80, height = 24 }: {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}) {
  if (!data || data.length < 2) return null;
  // ★ 过滤非数值数据
  const clean = data.filter(v => typeof v === 'number' && isFinite(v));
  if (clean.length < 2) return null;
  const min = Math.min(...clean);
  const max = Math.max(...clean);
  const range = max - min || 1;
  const step = width / (clean.length - 1);

  const points = clean.map((v, i) => {
    const x = i * step;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={width} height={height} className="flex-shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ═══════ 天气卡片 ═══════

function WeatherCard({ data }: { data: WeatherData }) {
  const WeatherIcon = getWeatherIcon(data.condition);
  const gradient = getWeatherGradient(data.condition);

  return (
    <div className="my-3 rounded-xl overflow-hidden shadow-sm border border-border">
      {/* 主卡片 — 渐变背景 */}
      <div className={cn('bg-gradient-to-br text-white px-4 py-4', gradient)}>
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs font-medium opacity-80">{data.city}</div>
            <div className="text-4xl font-bold tracking-tight mt-1">{data.temp}°</div>
            <div className="text-sm font-medium mt-0.5">{data.condition}</div>
          </div>
          <WeatherIcon className="w-12 h-12 opacity-80" />
        </div>

        {/* 详情行 */}
        <div className="flex items-center gap-4 mt-3 text-xs opacity-80">
          {data.high != null && data.low != null && (
            <span>↑{data.high}° ↓{data.low}°</span>
          )}
          {data.humidity != null && (
            <span className="flex items-center gap-0.5">
              <Droplets className="w-3 h-3" />{data.humidity}%
            </span>
          )}
          {data.wind && (
            <span className="flex items-center gap-0.5">
              <Wind className="w-3 h-3" />{data.wind}
            </span>
          )}
        </div>
      </div>

      {/* 预报行 */}
      {data.forecast && data.forecast.length > 0 && (
        <div className="flex divide-x divide-border bg-card">
          {data.forecast.slice(0, 5).map((f, i) => {
            const FIcon = getWeatherIcon(f.condition);
            return (
              <div key={i} className="flex-1 text-center py-2.5 px-1">
                <div className="text-[10px] text-muted-foreground">{f.day}</div>
                <FIcon className="w-4 h-4 mx-auto my-1 text-muted-foreground" />
                <div className="text-[10px] text-foreground font-medium">{f.high}°</div>
                <div className="text-[10px] text-muted-foreground">{f.low}°</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════ 股票卡片 ═══════

function StockCard({ data }: { data: StockData }) {
  const isUp = (data.change ?? 0) > 0;
  const isDown = (data.change ?? 0) < 0;
  const TrendIcon = isUp ? TrendingUp : isDown ? TrendingDown : Minus;
  const trendColor = isUp ? 'text-red-500' : isDown ? 'text-green-500' : 'text-muted-foreground';
  const trendBg = isUp ? 'bg-red-50 dark:bg-red-950/30' : isDown ? 'bg-green-50 dark:bg-green-950/30' : 'bg-muted/30';
  const sparkColor = isUp ? '#ef4444' : isDown ? '#22c55e' : '#94a3b8';

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-4 py-3">
        {/* 头部 */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-semibold text-foreground">{data.name}</span>
              {data.symbol && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">{data.symbol}</span>
              )}
            </div>
          </div>
          {data.sparkline && (
            <Sparkline data={data.sparkline} color={sparkColor} width={72} height={28} />
          )}
        </div>

        {/* 价格 */}
        <div className="flex items-end gap-3 mt-2">
          <span className="text-2xl font-bold text-foreground tabular-nums">
            {data.currency && <span className="text-sm font-normal text-muted-foreground mr-0.5">{data.currency}</span>}
            {data.price}
          </span>
          <div className={cn('flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold', trendBg, trendColor)}>
            <TrendIcon className="w-3 h-3" />
            {data.change != null && (
              <span>{isUp ? '+' : ''}{data.change}</span>
            )}
            {data.changePercent != null && (
              <span>({isUp ? '+' : ''}{data.changePercent}%)</span>
            )}
          </div>
        </div>

        {/* 详情网格 */}
        <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-border">
          {data.open != null && (
            <div>
              <div className="text-[10px] text-muted-foreground">开盘</div>
              <div className="text-xs font-medium tabular-nums">{data.open}</div>
            </div>
          )}
          {data.high != null && (
            <div>
              <div className="text-[10px] text-muted-foreground">最高</div>
              <div className="text-xs font-medium tabular-nums text-red-500">{data.high}</div>
            </div>
          )}
          {data.low != null && (
            <div>
              <div className="text-[10px] text-muted-foreground">最低</div>
              <div className="text-xs font-medium tabular-nums text-green-500">{data.low}</div>
            </div>
          )}
          {data.volume && (
            <div>
              <div className="text-[10px] text-muted-foreground">成交量</div>
              <div className="text-xs font-medium">{data.volume}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════ 汇率卡片 ═══════

function ExchangeCard({ data }: { data: ExchangeData }) {
  const [reversed, setReversed] = useState(false);
  const safeRate = data.rate || 1; // 防除零
  const from = reversed ? data.to : data.from;
  const to = reversed ? data.from : data.to;
  const rate = reversed ? (1 / safeRate) : safeRate;
  const amount = data.amount ?? 1;
  const result = reversed ? amount / safeRate : amount * safeRate;

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      <div className="px-4 py-3">
        {/* 头部 */}
        <div className="flex items-center gap-2 mb-3">
          <ArrowRightLeft className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-foreground">汇率换算</span>
          {data.updated && (
            <span className="text-[10px] text-muted-foreground ml-auto">{data.updated}</span>
          )}
        </div>

        {/* 换算显示 */}
        <div className="flex items-center gap-3 justify-center">
          <div className="text-center">
            <div className="text-2xl font-bold text-foreground tabular-nums">{amount}</div>
            <div className="text-xs font-semibold text-muted-foreground mt-0.5">{from}</div>
          </div>

          <button
            onClick={() => setReversed(!reversed)}
            className="p-1.5 rounded-full hover:bg-muted transition-colors"
            title="交换方向"
          >
            <ArrowRightLeft className="w-4 h-4 text-muted-foreground" />
          </button>

          <div className="text-center">
            <div className="text-2xl font-bold text-foreground tabular-nums">{result.toFixed(result < 1 ? 6 : 2)}</div>
            <div className="text-xs font-semibold text-muted-foreground mt-0.5">{to}</div>
          </div>
        </div>

        {/* 汇率行 */}
        <div className="flex items-center justify-center gap-2 mt-3 pt-3 border-t border-border">
          <span className="text-xs text-muted-foreground">1 {from} = {rate.toFixed(rate < 1 ? 6 : 4)} {to}</span>
          {data.trend && data.trend.length > 1 && (
            <Sparkline data={data.trend} color="#3b82f6" width={60} height={20} />
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════ 主组件 ═══════

/** 从不完整 JSON 中提取 type */
function extractPartialMeta(str: string): { type?: string } {
  return { type: str.match(/"type"\s*:\s*"([^"]*)/)?.[1] };
}

const TYPE_LABELS: Record<string, string> = {
  weather: '天气',
  stock: '行情',
  exchange: '汇率',
};

function LiveDataCardInner({ jsonStr, streaming }: LiveDataCardProps) {
  let parsed: LiveData | null = null;
  {
    const r = safeParseJson<any>(jsonStr);
    parsed = r.data;
  }

  // ═══════ 流式骨架 ═══════
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    const label = partial.type ? (TYPE_LABELS[partial.type] || partial.type) : '数据';
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 py-4">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-blue-500 animate-pulse" />
            <span className="text-sm font-medium">{label}加载中...</span>
          </div>
          <div className="space-y-2">
            <div className="h-10 w-32 rounded bg-muted animate-pulse" />
            <div className="h-4 w-48 rounded bg-muted animate-pulse" style={{ animationDelay: '100ms' }} />
            <div className="h-4 w-36 rounded bg-muted animate-pulse" style={{ animationDelay: '200ms' }} />
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-blue-300 via-blue-500 to-blue-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // ═══════ 解析失败降级 ═══════
  if (!parsed || !parsed.type || !parsed.data) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>实时数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  // ★ 自动刷新 + 数据时效
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh] = useState(() => Date.now());
  const [dataAge, setDataAge] = useState('刚刚');
  const COOLDOWN_MS = 60_000; // 刷新冷却 60 秒
  const AUTO_REFRESH_MS: Record<string, number> = { weather: 30 * 60_000, stock: 5 * 60_000, exchange: 10 * 60_000 };

  // 数据时效倒计时
  useEffect(() => {
    const update = () => {
      const mins = Math.floor((Date.now() - lastRefresh) / 60_000);
      setDataAge(mins < 1 ? '刚刚' : mins < 60 ? `${mins}分钟前` : `${Math.floor(mins / 60)}小时前`);
    };
    update();
    const timer = setInterval(update, 30_000);
    return () => clearInterval(timer);
  }, [lastRefresh]);

  // 自动刷新定时器
  useEffect(() => {
    if (!parsed?.type) return;
    const interval = AUTO_REFRESH_MS[parsed.type];
    if (!interval) return;
    const timer = setInterval(() => {
      handleRefresh();
    }, interval);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed?.type]);

  const handleRefresh = useCallback(() => {
    if (refreshing) return;
    setRefreshing(true);
    const prompts: Record<string, string> = {
      weather: `请重新查询${(parsed?.data as any)?.city || ''}的最新天气`,
      stock: `请重新查询${(parsed?.data as any)?.name || (parsed?.data as any)?.symbol || ''}的最新行情`,
      exchange: `请重新查询${(parsed?.data as any)?.from || 'USD'}兑${(parsed?.data as any)?.to || 'CNY'}的最新汇率`,
    };
    const prompt = prompts[parsed!.type] || '请刷新数据';
    window.dispatchEvent(new CustomEvent('chat:sendPrompt', { detail: { prompt } }));
    // 冷却期后恢复
    setTimeout(() => setRefreshing(false), COOLDOWN_MS);
  }, [parsed, refreshing]);

  // ═══════ 按 type 路由 ═══════
  let card: React.ReactNode;
  switch (parsed.type) {
    case 'weather':
      card = <WeatherCard data={parsed.data} />;
      break;
    case 'stock':
      card = <StockCard data={parsed.data} />;
      break;
    case 'exchange':
      card = <ExchangeCard data={parsed.data} />;
      break;
    default:
      return (
        <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            <span>未知数据类型：{(parsed as any).type}</span>
          </div>
          <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
        </div>
      );
  }

  return (
    <div className="relative group">
      {card}
      {/* 数据时效 + 刷新按钮 */}
      <div className="absolute top-2 right-2 flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <span className="text-[9px] text-white/70 bg-black/30 px-1.5 py-0.5 rounded-full backdrop-blur-sm">
          {dataAge}
        </span>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className={cn(
            'p-1 rounded-full bg-white/80 dark:bg-zinc-800/80 text-muted-foreground hover:text-foreground shadow-sm transition-all',
            refreshing && 'opacity-50 cursor-not-allowed'
          )}
          title={refreshing ? '刷新冷却中...' : '刷新数据'}
        >
          <RefreshCw className={cn('w-3 h-3', refreshing && 'animate-spin')} />
        </button>
      </div>
    </div>
  );
}

export const LiveDataCard = memo(LiveDataCardInner);
