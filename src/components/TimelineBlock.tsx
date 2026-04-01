/**
 * TimelineBlock — ```timeline 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为竖向时间轴。
 *
 * JSON Schema:
 * {
 *   "title": "项目里程碑",
 *   "items": [
 *     {"date":"2024-01","label":"立项","desc":"完成需求文档","status":"done"},
 *     {"date":"2024-03","label":"开发","desc":"核心功能开发","status":"active"},
 *     {"date":"2024-06","label":"上线","desc":"正式发布","status":"pending"}
 *   ]
 * }
 */

import { memo } from 'react';
import { Clock, Check, Circle, Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════
interface TimelineItem {
  date?: string;
  label: string;
  desc?: string;
  status?: 'done' | 'active' | 'pending';
}

interface TimelineData {
  title?: string;
  items: TimelineItem[];
}

interface TimelineBlockProps {
  jsonStr: string;
  streaming?: boolean;
}

// ═══════ 状态样式 ═══════
const STATUS_CONFIG = {
  done: {
    dot: 'bg-green-500 ring-green-100 dark:ring-green-900/50',
    line: 'bg-green-500',
    badge: 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800',
    icon: Check,
    label: '已完成',
  },
  active: {
    dot: 'bg-blue-500 ring-blue-100 dark:ring-blue-900/50 animate-pulse',
    line: 'bg-blue-500',
    badge: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
    icon: Timer,
    label: '进行中',
  },
  pending: {
    dot: 'bg-gray-300 dark:bg-gray-600 ring-gray-100 dark:ring-gray-800',
    line: 'bg-gray-200 dark:bg-gray-700',
    badge: 'bg-gray-50 text-gray-500 border-gray-200 dark:bg-gray-900/50 dark:text-gray-400 dark:border-gray-700',
    icon: Circle,
    label: '待开始',
  },
};

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  const title = str.match(/"title"\s*:\s*"([^"]*)/)?.[1];
  return { title };
}

function TimelineBlockInner({ jsonStr, streaming }: TimelineBlockProps) {
  let parsed: TimelineData | null = null;
  let parseError: string | null = null;

  const result = safeParseJson<any>(jsonStr);
  parseError = result.error;

  // ★ 兼容裸数组：AI 可能直接输出 [{date,label,desc,status},...] 而非 {items:[...]}
  if (Array.isArray(result.data)) {
    parsed = { items: result.data };
  } else if (result.data && !result.data.items && Array.isArray(result.data.data)) {
    parsed = { title: result.data.title, items: result.data.data };
  } else {
    parsed = result.data;
  }

  // 流式中 JSON 不完整 → 骨架
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Clock className="w-4 h-4 text-blue-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '时间轴生成中...'}</h3>
          </div>
          <div className="space-y-4 pl-4">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex gap-3 items-start">
                <div className="w-3 h-3 rounded-full bg-muted animate-pulse mt-1" style={{ animationDelay: `${i * 100}ms` }} />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-20 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                  <div className="h-2.5 w-40 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
                </div>
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

  // 解析失败 → 优雅降级
  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <Clock className="w-3.5 h-3.5" />
          <span>时间轴数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const items = parsed.items || [];

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* 标题 */}
      {parsed.title && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
          <Clock className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-medium">{parsed.title}</h3>
          <span className="text-[10px] text-blue-600 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/50 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-800">
            时间轴
          </span>
        </div>
      )}

      {/* 时间轴内容 */}
      <div className="px-4 py-4">
        <div className="relative">
          {items.map((item, i) => {
            const status = item.status || 'pending';
            const config = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            const isLast = i === items.length - 1;
            const Icon = config.icon;

            return (
              <div key={i} className="flex gap-4 pb-6 last:pb-0 group">
                {/* 竖线 + 圆点 */}
                <div className="relative flex flex-col items-center flex-shrink-0" style={{ width: 24 }}>
                  {/* 圆点 */}
                  <div className={cn(
                    'w-6 h-6 rounded-full flex items-center justify-center ring-4 z-10 relative',
                    config.dot
                  )}>
                    <Icon className="w-3 h-3 text-white" strokeWidth={3} />
                  </div>
                  {/* 连接线 */}
                  {!isLast && (
                    <div className={cn('absolute top-6 w-0.5 bottom-0', config.line, status === 'pending' && 'opacity-40')} />
                  )}
                </div>

                {/* 内容区 */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <span className="text-sm font-semibold text-foreground">{item.label}</span>
                    {item.date && (
                      <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded border whitespace-nowrap', config.badge)}>
                        {item.date}
                      </span>
                    )}
                  </div>
                  {item.desc && (
                    <p className="text-[13px] text-muted-foreground leading-relaxed break-words" style={{ overflowWrap: 'anywhere' }}>{item.desc}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const TimelineBlock = memo(TimelineBlockInner);
