/**
 * TabsBlock — ```tabs 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为标签页切换组件。
 * 每个 tab 内容支持 Markdown 渲染。
 *
 * JSON Schema:
 * {
 *   "tabs": [
 *     {"label":"方案A：React","icon":"⚛️","content":"## 优势\n- 生态丰富\n- JSX 灵活"},
 *     {"label":"方案B：Vue","icon":"💚","content":"## 优势\n- 易上手\n- 模板直观"},
 *     {"label":"方案C：Svelte","icon":"🔥","content":"## 优势\n- 零运行时\n- 编译优化"}
 *   ]
 * }
 */

import { memo, useState } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';
import { SafeMarkdown } from '@/components/SafeMarkdown';

// ═══════ 类型定义 ═══════
interface TabItem {
  label: string;
  icon?: string;
  content: string;
}

interface TabsData {
  title?: string;
  tabs: TabItem[];
}

interface TabsBlockProps {
  jsonStr: string;
  streaming?: boolean;
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

// ═══════ Tab 色彩 ═══════
const TAB_ACCENTS = [
  'border-blue-500 text-blue-700 dark:text-blue-300',
  'border-emerald-500 text-emerald-700 dark:text-emerald-300',
  'border-amber-500 text-amber-700 dark:text-amber-300',
  'border-purple-500 text-purple-700 dark:text-purple-300',
  'border-pink-500 text-pink-700 dark:text-pink-300',
  'border-cyan-500 text-cyan-700 dark:text-cyan-300',
];

function TabsBlockInner({ jsonStr, streaming }: TabsBlockProps) {
  const [activeIdx, setActiveIdx] = useState(0);

  let parsed: TabsData | null = null;
  let parseError: string | null = null;
  { const r = safeParseJson<any>(jsonStr); parseError = r.error;
    // ★ 兼容裸数组
    parsed = Array.isArray(r.data) ? { tabs: r.data } : r.data;
  }

  // 流式骨架
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-purple-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '标签页生成中...'}</h3>
          </div>
          <div className="flex gap-2 mb-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-7 w-20 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
          <div className="space-y-2">
            {[80, 65, 90, 50].map((w, i) => (
              <div key={i} className="h-2.5 rounded-full bg-muted animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }} />
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-purple-300 via-purple-500 to-purple-300 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>标签页数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const tabs = parsed.tabs || [];
  if (!tabs.length) return null;

  const safeIdx = Math.min(activeIdx, tabs.length - 1);
  const activeTab = tabs[safeIdx];

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* 标题栏（可选） */}
      {parsed.title && (
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
          <Layers className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-medium">{parsed.title}</h3>
        </div>
      )}

      {/* Tab 标签栏 */}
      <div className="flex border-b border-border overflow-x-auto no-scrollbar">
        {tabs.map((tab, i) => (
          <button
            key={i}
            onClick={() => setActiveIdx(i)}
            className={cn(
              'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-all border-b-2 -mb-px',
              i === safeIdx
                ? cn('bg-background', TAB_ACCENTS[i % TAB_ACCENTS.length])
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/30'
            )}
          >
            {tab.icon && <span className="text-sm">{tab.icon}</span>}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab 内容区 */}
      <div className="p-4">
        <SafeMarkdown className="[&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_p]:text-sm [&_p]:leading-relaxed [&_li]:text-sm">
          {activeTab?.content || ''}
        </SafeMarkdown>
      </div>
    </div>
  );
}

export const TabsBlock = memo(TabsBlockInner);
