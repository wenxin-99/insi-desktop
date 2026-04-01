/**
 * MathBlock — ```math-steps 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为数学推导步骤卡片（KaTeX 公式渲染）。
 *
 * JSON Schema:
 * {
 *   "title": "求解一元二次方程",
 *   "steps": [
 *     { "label": "原方程", "latex": "x^2 + 5x + 6 = 0", "note": "标准形式", "highlight": false },
 *     { "label": "因式分解", "latex": "(x + 2)(x + 3) = 0" },
 *     { "label": "解", "latex": "x_1 = -2, \\quad x_2 = -3", "highlight": true }
 *   ],
 *   "answer": "x = -2 或 x = -3"
 * }
 */

import { memo, useState, useRef, useEffect } from 'react';
import { Calculator, ChevronDown, ChevronRight, Zap, Copy, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';
import katex from 'katex';

// ═══════ 类型定义 ═══════

interface MathStep {
  label: string;
  latex: string;
  note?: string;
  highlight?: boolean;
}

interface MathData {
  title?: string;
  steps: MathStep[];
  answer?: string;
}

interface MathBlockProps {
  jsonStr: string;
  streaming?: boolean;
}

/** 安全渲染 KaTeX — 失败时回退显示原始 LaTeX */
function renderKatex(latex: string, displayMode = true): string {
  try {
    return katex.renderToString(latex, {
      displayMode,
      throwOnError: false,
      strict: false,
      trust: true,
    });
  } catch {
    // ★ 转义 HTML 实体防止 XSS
    const escaped = latex.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    return `<code class="text-xs text-red-500">${escaped}</code>`;
  }
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

function KatexSpan({ latex, display = true }: { latex: string; display?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = renderKatex(latex, display);
    }
  }, [latex, display]);

  return <div ref={ref} className="overflow-x-auto" />;
}

function MathBlockInner({ jsonStr, streaming }: MathBlockProps) {
  const [collapsedNotes, setCollapsedNotes] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const answerRef = useRef<HTMLDivElement>(null);

  let parsed: MathData | null = null;
  {
    const r = safeParseJson<any>(jsonStr);
    // ★ 兼容裸数组
    if (Array.isArray(r.data)) {
      parsed = { steps: r.data };
    } else {
      parsed = r.data;
    }
  }

  const handleJumpToAnswer = () => {
    answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleCopyLatex = async () => {
    if (!parsed) return;
    const allLatex = parsed.steps.map(s => s.latex).join('\n');
    try {
      await navigator.clipboard.writeText(allLatex);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* ignore */ }
  };

  const toggleNote = (idx: number) => {
    setCollapsedNotes(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  // ═══════ 流式骨架 ═══════
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-indigo-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '数学推导生成中...'}</h3>
          </div>
          <div className="space-y-3">
            {[0, 1, 2].map(i => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
                <div className="flex-1 h-10 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 100 + 50}ms` }} />
              </div>
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-indigo-300 via-indigo-500 to-indigo-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // ═══════ 解析失败降级 ═══════
  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>数学推导数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const steps = parsed.steps || [];

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* ═══════ 标题栏 ═══════ */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <Calculator className="w-4 h-4 text-indigo-500" />
          <h3 className="text-sm font-medium">{parsed.title || '数学推导'}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {steps.length} 步
          </span>
        </div>
        <div className="flex items-center gap-1">
          {parsed.answer && (
            <button
              onClick={handleJumpToAnswer}
              className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/30 rounded hover:bg-indigo-100 dark:hover:bg-indigo-950/50 transition-colors"
            >
              <Zap className="w-3 h-3" />跳到答案
            </button>
          )}
          <button
            onClick={handleCopyLatex}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            title="复制 LaTeX"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ═══════ 步骤列表 ═══════ */}
      <div className="px-4 py-3 space-y-3">
        {steps.map((step, i) => (
          <div
            key={i}
            className={cn(
              'flex gap-3 p-2.5 rounded-lg transition-colors',
              step.highlight ? 'bg-indigo-50/80 dark:bg-indigo-950/20 ring-1 ring-indigo-200 dark:ring-indigo-800' : 'hover:bg-muted/30'
            )}
          >
            {/* 步骤序号 */}
            <div className={cn(
              'flex-shrink-0 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center',
              step.highlight
                ? 'bg-indigo-500 text-white'
                : 'bg-muted text-muted-foreground'
            )}>
              {i + 1}
            </div>

            <div className="flex-1 min-w-0">
              {/* 标签 */}
              <div className="text-[11px] font-semibold text-foreground mb-1">{step.label}</div>

              {/* 公式 */}
              <div className="overflow-x-auto">
                <KatexSpan latex={step.latex} />
              </div>

              {/* 注释 */}
              {step.note && (
                <div className="mt-1">
                  <button
                    onClick={() => toggleNote(i)}
                    className="flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {collapsedNotes.has(i) ? <ChevronRight className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    说明
                  </button>
                  {!collapsedNotes.has(i) && (
                    <p className="text-[11px] text-muted-foreground leading-relaxed mt-0.5 ml-3.5">{step.note}</p>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* ═══════ 答案区 ═══════ */}
      {parsed.answer && (
        <div
          ref={answerRef}
          className="border-t border-border bg-gradient-to-r from-indigo-50/50 via-transparent to-transparent dark:from-indigo-950/20 px-4 py-3"
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-indigo-500" />
            <span className="text-xs font-semibold text-foreground">答案：</span>
            <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">{parsed.answer}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export const MathBlock = memo(MathBlockInner);
