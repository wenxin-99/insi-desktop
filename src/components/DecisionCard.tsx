/**
 * DecisionCard — ```decision 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为决策助手卡片。
 * 展示多个选项的优缺点、评分，用户可点选后深入分析。
 *
 * JSON Schema:
 * {
 *   "question": "周末去哪玩？",
 *   "options": [
 *     {
 *       "name": "爬山",
 *       "pros": ["锻炼身体", "风景好", "免费"],
 *       "cons": ["累", "天气不确定"],
 *       "score": 8.2
 *     }
 *   ],
 *   "suggestion": "推荐爬山，天气预报周末晴天"
 * }
 */

import { memo, useState } from 'react';
import { HelpCircle, ThumbsUp, ThumbsDown, Star, Lightbulb, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════

interface DecisionOption {
  name: string;
  pros?: string[];
  cons?: string[];
  score?: number;      // 0-10
  icon?: string;       // emoji
}

interface DecisionData {
  question?: string;
  options: DecisionOption[];
  suggestion?: string;
}

interface DecisionCardProps {
  jsonStr: string;
  streaming?: boolean;
}

// ═══════ 颜色方案 ═══════

const CARD_ACCENTS = [
  { bg: 'bg-blue-50 dark:bg-blue-950/20', border: 'border-blue-200 dark:border-blue-800', ring: 'ring-blue-400', accent: 'text-blue-600 dark:text-blue-400' },
  { bg: 'bg-emerald-50 dark:bg-emerald-950/20', border: 'border-emerald-200 dark:border-emerald-800', ring: 'ring-emerald-400', accent: 'text-emerald-600 dark:text-emerald-400' },
  { bg: 'bg-amber-50 dark:bg-amber-950/20', border: 'border-amber-200 dark:border-amber-800', ring: 'ring-amber-400', accent: 'text-amber-600 dark:text-amber-400' },
  { bg: 'bg-purple-50 dark:bg-purple-950/20', border: 'border-purple-200 dark:border-purple-800', ring: 'ring-purple-400', accent: 'text-purple-600 dark:text-purple-400' },
  { bg: 'bg-rose-50 dark:bg-rose-950/20', border: 'border-rose-200 dark:border-rose-800', ring: 'ring-rose-400', accent: 'text-rose-600 dark:text-rose-400' },
];

/** 从不完整 JSON 中提取 question */
function extractPartialMeta(str: string): { question?: string } {
  return { question: str.match(/"question"\s*:\s*"([^"]*)/)?.[1] };
}

/** 评分星星 */
function ScoreStars({ score }: { score: number }) {
  const fullStars = Math.floor(score / 2);
  const halfStar = score % 2 >= 1;
  return (
    <div className="flex items-center gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={cn('w-3 h-3', i < fullStars ? 'text-amber-400 fill-amber-400' : halfStar && i === fullStars ? 'text-amber-400 fill-amber-400/50' : 'text-muted-foreground/20')}
        />
      ))}
      <span className="text-[10px] font-bold text-muted-foreground ml-1 tabular-nums">{score}</span>
    </div>
  );
}

function DecisionCardInner({ jsonStr, streaming }: DecisionCardProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);

  let parsed: DecisionData | null = null;
  {
    const r = safeParseJson<any>(jsonStr);
    if (Array.isArray(r.data)) {
      parsed = { options: r.data };
    } else {
      parsed = r.data;
    }
  }

  // ═══════ 流式骨架 ═══════
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-amber-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.question || '决策分析生成中...'}</h3>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[0, 1].map(i => (
              <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" style={{ animationDelay: `${i * 100}ms` }} />
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-amber-300 via-amber-500 to-amber-300 animate-pulse" />
        </div>
      </div>
    );
  }

  // ═══════ 解析失败降级 ═══════
  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>决策数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const options = parsed.options || [];

  const handleSelect = (idx: number) => {
    setSelectedIdx(idx === selectedIdx ? null : idx);
  };

  // 通过 CustomEvent 发送深入分析请求
  const handleDeepAnalysis = (option: DecisionOption) => {
    const prompt = `请深入分析"${option.name}"这个选择，包括具体实施建议、可能遇到的问题和解决方案`;
    window.dispatchEvent(new CustomEvent('chat:sendPrompt', { detail: { prompt } }));
  };

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* ═══════ 标题栏 ═══════ */}
      <div className="px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-medium">{parsed.question || '决策助手'}</h3>
        </div>
      </div>

      {/* ═══════ 选项卡片 ═══════ */}
      <div className={cn(
        'p-3 grid gap-2',
        options.length === 1 ? 'grid-cols-1' :
        options.length === 2 ? 'grid-cols-1 sm:grid-cols-2' :
        'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
      )}>
        {options.map((opt, idx) => {
          const accent = CARD_ACCENTS[idx % CARD_ACCENTS.length];
          const isSelected = selectedIdx === idx;

          return (
            <div
              key={idx}
              role="button"
              tabIndex={0}
              onClick={() => handleSelect(idx)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleSelect(idx); } }}
              className={cn(
                'text-left rounded-lg border p-3 transition-all cursor-pointer',
                isSelected ? `${accent.bg} ${accent.border} ring-2 ${accent.ring}` : 'border-border hover:border-muted-foreground/30 hover:bg-muted/20'
              )}
            >
              {/* 名称 */}
              <div className="flex items-center gap-1.5 mb-2">
                {opt.icon && <span className="text-base">{opt.icon}</span>}
                <span className={cn('text-xs font-semibold', isSelected ? accent.accent : 'text-foreground')}>
                  {opt.name}
                </span>
              </div>

              {/* 评分 */}
              {opt.score != null && (
                <div className="mb-2">
                  <ScoreStars score={opt.score} />
                </div>
              )}

              {/* 优势 */}
              {opt.pros && opt.pros.length > 0 && (
                <div className="space-y-0.5 mb-1.5">
                  {opt.pros.map((p, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <ThumbsUp className="w-3 h-3 text-emerald-500 mt-0.5 flex-shrink-0" />
                      <span className="text-[11px] text-muted-foreground leading-tight" style={{ overflowWrap: 'anywhere' }}>{p}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 劣势 */}
              {opt.cons && opt.cons.length > 0 && (
                <div className="space-y-0.5">
                  {opt.cons.map((c, i) => (
                    <div key={i} className="flex items-start gap-1">
                      <ThumbsDown className="w-3 h-3 text-red-400 mt-0.5 flex-shrink-0" />
                      <span className="text-[11px] text-muted-foreground leading-tight" style={{ overflowWrap: 'anywhere' }}>{c}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* 深入分析按钮 */}
              {isSelected && (
                <button
                  className={cn('mt-2 pt-2 border-t w-full flex items-center justify-center gap-1 text-[10px] font-medium', accent.border, accent.accent)}
                  onClick={(e) => { e.stopPropagation(); handleDeepAnalysis(opt); }}
                >
                  <Send className="w-3 h-3" />深入分析
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ═══════ 建议区 ═══════ */}
      {parsed.suggestion && (
        <div className="border-t border-border bg-gradient-to-r from-amber-50/50 via-transparent to-transparent dark:from-amber-950/20 px-4 py-3">
          <div className="flex items-start gap-2">
            <Lightbulb className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div className="text-[11px] text-muted-foreground leading-relaxed" style={{ overflowWrap: 'anywhere' }}>
              {parsed.suggestion}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export const DecisionCard = memo(DecisionCardInner);
