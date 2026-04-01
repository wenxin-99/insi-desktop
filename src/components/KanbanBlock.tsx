/**
 * KanbanBlock — ```kanban 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为看板视图。
 *
 * JSON Schema:
 * {
 *   "title": "开发任务",
 *   "columns": [
 *     {"name":"待办","color":"#94a3b8","items":[
 *       {"title":"登录页","tag":"前端","desc":"用户登录注册页面"},
 *       {"title":"API网关","tag":"后端","priority":"high"}
 *     ]},
 *     {"name":"进行中","color":"#3b82f6","items":[...]},
 *     {"name":"已完成","color":"#10b981","items":[...]}
 *   ]
 * }
 */

import { memo, useState } from 'react';
import { LayoutGrid, Clock, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════
interface KanbanItem {
  title: string;
  desc?: string;
  tag?: string;
  priority?: 'high' | 'medium' | 'low';
  assignee?: string;
  due?: string;
}

interface KanbanColumn {
  name: string;
  color?: string;
  items: KanbanItem[];
}

interface KanbanData {
  title?: string;
  columns: KanbanColumn[];
}

interface KanbanBlockProps {
  jsonStr: string;
  streaming?: boolean;
}

// ═══════ 默认列颜色 ═══════
const COL_COLORS = ['#94a3b8', '#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444'];

const PRIORITY_STYLES: Record<string, { dot: string; label: string }> = {
  high: { dot: 'bg-red-500', label: '高' },
  medium: { dot: 'bg-amber-500', label: '中' },
  low: { dot: 'bg-blue-400', label: '低' },
};

const TAG_COLORS = [
  'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800',
  'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800',
  'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800',
  'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800',
  'bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/50 dark:text-pink-300 dark:border-pink-800',
  'bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/50 dark:text-cyan-300 dark:border-cyan-800',
];

/** 简易 tag 颜色分配（基于字符串 hash） */
function tagColor(tag: string): string {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h + tag.charCodeAt(i)) | 0;
  return TAG_COLORS[Math.abs(h) % TAG_COLORS.length];
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

function KanbanBlockInner({ jsonStr, streaming }: KanbanBlockProps) {
  const [collapsedCols, setCollapsedCols] = useState<Set<number>>(new Set());

  let parsed: KanbanData | null = null;
  let parseError: string | null = null;
  { const r = safeParseJson<any>(jsonStr); parseError = r.error;
    // ★ 兼容裸数组：AI 可能直接输出列数组
    parsed = Array.isArray(r.data) ? { columns: r.data } : r.data;
  }

  // 流式骨架
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <LayoutGrid className="w-4 h-4 text-blue-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '看板生成中...'}</h3>
          </div>
          <div className="flex gap-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex-1 space-y-2">
                <div className="h-3 w-16 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                {[0, 1].map(j => (
                  <div key={j} className="h-16 rounded-lg bg-muted animate-pulse" style={{ animationDelay: `${(i * 2 + j) * 80}ms` }} />
                ))}
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

  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>看板数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const columns = parsed.columns || [];
  const totalItems = columns.reduce((s, c) => s + c.items.length, 0);

  const toggleCol = (idx: number) => {
    setCollapsedCols(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <LayoutGrid className="w-4 h-4 text-blue-500" />
          <h3 className="text-sm font-medium">{parsed.title || '看板'}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {totalItems} 项
          </span>
        </div>
      </div>

      {/* 看板列 */}
      <div className="flex gap-3 p-3 overflow-x-auto">
        {columns.map((col, ci) => {
          const color = col.color || COL_COLORS[ci % COL_COLORS.length];
          const collapsed = collapsedCols.has(ci);

          return (
            <div key={ci} className="flex-shrink-0 w-[240px] flex flex-col">
              {/* 列头 */}
              <button
                onClick={() => toggleCol(ci)}
                className="flex items-center gap-2 px-2.5 py-2 rounded-lg mb-2 hover:bg-muted/50 transition-colors"
              >
                <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: color }} />
                <span className="text-xs font-semibold text-foreground">{col.name}</span>
                <span className="text-[10px] text-muted-foreground bg-muted rounded-full px-1.5 py-0.5 min-w-[20px] text-center">
                  {col.items.length}
                </span>
              </button>

              {/* 卡片列表 */}
              {!collapsed && (
                <div className="space-y-2 flex-1 min-h-[60px] p-1 rounded-lg bg-muted/20">
                  {col.items.map((item, ii) => (
                    <div key={ii}
                      className="group bg-card border border-border/60 rounded-lg p-2.5 shadow-sm hover:shadow-md hover:border-border transition-all cursor-default"
                    >
                      {/* 优先级 + 标题 */}
                      <div className="flex items-start gap-1.5 mb-1">
                        {item.priority && (
                          <div className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', PRIORITY_STYLES[item.priority]?.dot || 'bg-gray-400')} title={`优先级：${PRIORITY_STYLES[item.priority]?.label || item.priority}`} />
                        )}
                        <span className="text-xs font-medium text-foreground leading-snug">{item.title}</span>
                      </div>

                      {/* 描述 */}
                      {item.desc && (
                        <p className="text-[11px] text-muted-foreground leading-relaxed mb-1.5 line-clamp-2">{item.desc}</p>
                      )}

                      {/* 底部标签行 */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.tag && (
                          <span className={cn('text-[9px] font-medium px-1.5 py-0.5 rounded border', tagColor(item.tag))}>
                            {item.tag}
                          </span>
                        )}
                        {item.assignee && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <User className="w-2.5 h-2.5" />{item.assignee}
                          </span>
                        )}
                        {item.due && (
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5 ml-auto">
                            <Clock className="w-2.5 h-2.5" />{item.due}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {col.items.length === 0 && (
                    <div className="text-[11px] text-muted-foreground/50 text-center py-4">暂无项目</div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const KanbanBlock = memo(KanbanBlockInner);
