/**
 * CalendarEvent — ```calendar 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为日历事件卡片。
 * 支持列表视图 + .ics 导出下载。
 *
 * JSON Schema:
 * {
 *   "events": [
 *     {
 *       "title": "产品评审会",
 *       "date": "2025-04-02",
 *       "time": "14:00-16:00",
 *       "location": "3楼会议室",
 *       "color": "#3b82f6",
 *       "desc": "讨论 Q2 产品路线图"
 *     }
 *   ]
 * }
 */

import { memo, useMemo, useState } from 'react';
import { CalendarDays, MapPin, Download, Clock, Bell, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════

interface CalendarEventItem {
  title: string;
  date: string;       // YYYY-MM-DD
  time?: string;       // HH:MM 或 HH:MM-HH:MM
  location?: string;
  color?: string;
  desc?: string;
}

interface CalendarData {
  title?: string;
  events: CalendarEventItem[];
}

interface CalendarEventProps {
  jsonStr: string;
  streaming?: boolean;
}

// ═══════ 默认事件颜色 ═══════
const EVENT_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

/** 解析日期的星期 */
function getWeekday(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][d.getDay()];
  } catch { return ''; }
}

/** 格式化日期显示 */
function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return `${d.getMonth() + 1}月${d.getDate()}日`;
  } catch { return dateStr; }
}

/** 判断是否是今天 */
function isToday(dateStr: string): boolean {
  try {
    const today = new Date();
    const d = new Date(dateStr + 'T00:00:00');
    return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
  } catch { return false; }
}

/** 生成 .ics 文件内容 */
function generateICS(events: CalendarEventItem[]): string {
  // RFC 5545 文本转义
  const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//InsiAI//Calendar//CN',
    'CALSCALE:GREGORIAN',
  ];

  events.forEach(evt => {
    const dateClean = evt.date.replace(/-/g, '');

    lines.push('BEGIN:VEVENT');

    if (evt.time) {
      // 有时间 → 日期时间事件
      const parts = evt.time.split('-');
      // ★ 零补齐：确保 "9:00" → "090000" 而非 "90000"
      const formatTime = (t: string) => {
        const [h, m] = t.trim().split(':');
        return `${h.padStart(2, '0')}${(m || '00').padStart(2, '0')}00`;
      };
      const startTime = formatTime(parts[0]);
      const dtStart = `${dateClean}T${startTime}`;
      let dtEnd: string;
      if (parts[1]) {
        dtEnd = `${dateClean}T${formatTime(parts[1])}`;
      } else {
        // 只有开始时间，默认 1 小时
        const h = (parseInt(startTime.slice(0, 2)) + 1) % 24;
        dtEnd = `${dateClean}T${String(h).padStart(2, '0')}${startTime.slice(2)}`;
      }
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
    } else {
      // 无时间 → 全天事件（VALUE=DATE）
      lines.push(`DTSTART;VALUE=DATE:${dateClean}`);
      // 全天事件 DTEND 为次日
      const nextDay = new Date(evt.date + 'T00:00:00');
      nextDay.setDate(nextDay.getDate() + 1);
      const nextStr = nextDay.toISOString().slice(0, 10).replace(/-/g, '');
      lines.push(`DTEND;VALUE=DATE:${nextStr}`);
    }

    lines.push(`SUMMARY:${icsEscape(evt.title)}`);
    if (evt.location) lines.push(`LOCATION:${icsEscape(evt.location)}`);
    if (evt.desc) lines.push(`DESCRIPTION:${icsEscape(evt.desc)}`);
    lines.push(`UID:${Date.now()}-${Math.random().toString(36).slice(2)}@insiai`);
    lines.push('END:VEVENT');
  });

  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}

/** 下载 .ics 文件 */
function downloadICS(events: CalendarEventItem[]) {
  const content = generateICS(events);
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'events.ics';
  a.click();
  URL.revokeObjectURL(url);
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

function CalendarEventInner({ jsonStr, streaming }: CalendarEventProps) {
  const [remindersSet, setRemindersSet] = useState<Set<string>>(new Set());

  /** ★ 创建提醒：调用后端定时任务 */
  const handleCreateReminder = (evt: CalendarEventItem, idx: string) => {
    if (remindersSet.has(idx)) return;
    const timeStr = evt.time ? ` ${evt.time.split('-')[0]}` : ' 08:00';
    const prompt = `请帮我创建一个定时提醒：在${evt.date}${timeStr}提醒我"${evt.title}"${evt.location ? `，地点：${evt.location}` : ''}`;
    window.dispatchEvent(new CustomEvent('chat:sendPrompt', { detail: { prompt } }));
    setRemindersSet(prev => new Set(prev).add(idx));
  };

  let parsed: CalendarData | null = null;
  {
    const r = safeParseJson<any>(jsonStr);
    if (Array.isArray(r.data)) {
      parsed = { events: r.data };
    } else {
      parsed = r.data;
    }
  }

  // 按日期分组
  const grouped = useMemo(() => {
    if (!parsed) return [];
    const map = new Map<string, CalendarEventItem[]>();
    (parsed.events || []).forEach(evt => {
      const key = evt.date || 'unknown';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(evt);
    });
    // 按日期排序
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [parsed]);

  // ═══════ 流式骨架 ═══════
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <CalendarDays className="w-4 h-4 text-blue-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '日程安排生成中...'}</h3>
          </div>
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
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
          <span>日历数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const events = parsed.events || [];

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* ═══════ 标题栏 ═══════ */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-medium">{parsed.title || '日程安排'}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {events.length} 项
          </span>
        </div>
        {events.length > 0 && (
          <button
            onClick={() => downloadICS(events)}
            className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 rounded hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors"
          >
            <Download className="w-3 h-3" />导出日历
          </button>
        )}
      </div>

      {/* ═══════ 事件列表（按日期分组） ═══════ */}
      <div className="divide-y divide-border">
        {grouped.map(([dateStr, dayEvents]) => {
          const today = isToday(dateStr);
          return (
            <div key={dateStr}>
              {/* 日期标题 */}
              <div className={cn('px-4 py-1.5 text-[10px] font-semibold flex items-center gap-2', today ? 'bg-blue-50 dark:bg-blue-950/20 text-blue-600 dark:text-blue-400' : 'bg-muted/20 text-muted-foreground')}>
                <span>{formatDate(dateStr)}</span>
                <span>{getWeekday(dateStr)}</span>
                {today && <span className="px-1 py-0.5 text-[9px] bg-blue-500 text-white rounded">今天</span>}
              </div>

              {/* 当天事件 */}
              {dayEvents.map((evt, ei) => {
                const color = evt.color || EVENT_COLORS[(grouped.findIndex(g => g[0] === dateStr) * 3 + ei) % EVENT_COLORS.length];
                return (
                  <div key={ei} className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/10 transition-colors group">
                    {/* 色条 */}
                    <div className="w-1 self-stretch rounded-full flex-shrink-0 mt-0.5" style={{ background: color }} />

                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-foreground" style={{ overflowWrap: 'anywhere' }}>{evt.title}</div>

                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {evt.time && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <Clock className="w-3 h-3" />{evt.time}
                          </span>
                        )}
                        {evt.location && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                            <MapPin className="w-3 h-3" />{evt.location}
                          </span>
                        )}
                      </div>

                      {evt.desc && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2" style={{ overflowWrap: 'anywhere' }}>{evt.desc}</p>
                      )}
                    </div>

                    {/* ★ 创建提醒按钮 */}
                    {(() => {
                      const key = `${dateStr}-${ei}`;
                      const isSet = remindersSet.has(key);
                      return (
                        <button
                          onClick={() => handleCreateReminder(evt, key)}
                          disabled={isSet}
                          className={cn(
                            'flex-shrink-0 p-1.5 rounded-md transition-all sm:opacity-0 sm:group-hover:opacity-100',
                            isSet
                              ? 'text-emerald-500 cursor-default opacity-100'
                              : 'text-muted-foreground hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                          )}
                          title={isSet ? '已创建提醒' : '创建提醒'}
                        >
                          {isSet ? <Check className="w-3.5 h-3.5" /> : <Bell className="w-3.5 h-3.5" />}
                        </button>
                      );
                    })()}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const CalendarEvent = memo(CalendarEventInner);
