/**
 * QuizBlock — ```quiz 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为交互式测验。
 * 用户选择答案 → 即时判分 → 显示解析。
 *
 * JSON Schema:
 * {
 *   "title": "JavaScript 基础测验",
 *   "questions": [
 *     {
 *       "q": "const 和 let 的区别是什么？",
 *       "type": "choice",
 *       "options": ["作用域不同", "完全相同", "const 不能重新赋值", "A 和 C"],
 *       "answer": 3,
 *       "explain": "const 是块级作用域 + 不可重新赋值"
 *     },
 *     {
 *       "q": "Promise.all 在某个 promise reject 时会怎样？",
 *       "type": "choice",
 *       "options": ["等所有完成", "立即 reject", "忽略错误", "返回 undefined"],
 *       "answer": 1,
 *       "explain": "Promise.all 是 fail-fast，任何一个 reject 立即整体 reject"
 *     }
 *   ]
 * }
 */

import { memo, useState } from 'react';
import { HelpCircle, CheckCircle2, XCircle, Award, RotateCcw, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════
interface QuizQuestion {
  q: string;
  type?: 'choice' | 'truefalse';
  options: string[];
  answer: number;   // 正确答案的索引（0-based）
  explain?: string;
}

interface QuizData {
  title?: string;
  questions: QuizQuestion[];
}

interface QuizBlockProps {
  jsonStr: string;
  streaming?: boolean;
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];

function getOptionLetter(idx: number): string {
  return idx < OPTION_LETTERS.length ? OPTION_LETTERS[idx] : String(idx + 1);
}

function QuizBlockInner({ jsonStr, streaming }: QuizBlockProps) {
  const [answers, setAnswers] = useState<Record<number, number>>({}); // qIdx → selectedOptionIdx
  const [revealed, setRevealed] = useState<Set<number>>(new Set());   // 已揭晓答案的题号
  const [showResults, setShowResults] = useState(false);

  let parsed: QuizData | null = null;
  let parseError: string | null = null;
  { const r = safeParseJson<any>(jsonStr); parseError = r.error;
    // ★ 兼容裸数组
    parsed = Array.isArray(r.data) ? { questions: r.data } : r.data;
  }

  // 流式骨架
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <HelpCircle className="w-4 h-4 text-violet-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '测验生成中...'}</h3>
          </div>
          <div className="space-y-4">
            {[0, 1].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-3 w-3/4 rounded bg-muted animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />
                <div className="grid grid-cols-2 gap-2">
                  {[0, 1, 2, 3].map(j => (
                    <div key={j} className="h-8 rounded-lg bg-muted animate-pulse" style={{ animationDelay: `${(i * 4 + j) * 60}ms` }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-violet-300 via-violet-500 to-violet-300 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>测验数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const questions = parsed.questions || [];
  const totalQ = questions.length;
  const answeredCount = Object.keys(answers).length;
  const correctCount = questions.filter((q, i) => answers[i] === q.answer).length;

  const selectOption = (qIdx: number, optIdx: number) => {
    if (revealed.has(qIdx)) return; // 已揭晓不可改
    setAnswers(prev => ({ ...prev, [qIdx]: optIdx }));
  };

  const revealAnswer = (qIdx: number) => {
    setRevealed(prev => new Set(prev).add(qIdx));
  };

  const submitAll = () => {
    const allRevealed = new Set<number>();
    questions.forEach((_, i) => allRevealed.add(i));
    setRevealed(allRevealed);
    setShowResults(true);
  };

  const reset = () => {
    setAnswers({});
    setRevealed(new Set());
    setShowResults(false);
  };

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-4 h-4 text-violet-500" />
          <h3 className="text-sm font-medium">{parsed.title || '测验'}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {totalQ} 题
          </span>
        </div>
        {showResults && (
          <button onClick={reset} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <RotateCcw className="w-3 h-3" /> 重做
          </button>
        )}
      </div>

      {/* 成绩摘要 */}
      {showResults && (
        <div className={cn(
          'flex items-center gap-3 px-4 py-3 border-b border-border',
          correctCount === totalQ ? 'bg-emerald-50 dark:bg-emerald-950/20' : correctCount >= totalQ * 0.6 ? 'bg-amber-50 dark:bg-amber-950/20' : 'bg-red-50 dark:bg-red-950/20'
        )}>
          <Award className={cn('w-8 h-8', correctCount === totalQ ? 'text-emerald-500' : correctCount >= totalQ * 0.6 ? 'text-amber-500' : 'text-red-500')} />
          <div>
            <div className="text-sm font-semibold text-foreground">
              {correctCount}/{totalQ} 正确 · {Math.round(correctCount / totalQ * 100)}%
            </div>
            <div className="text-[11px] text-muted-foreground">
              {correctCount === totalQ ? '满分！太棒了！' : correctCount >= totalQ * 0.6 ? '不错，继续加油！' : '还需要多练习哦'}
            </div>
          </div>
        </div>
      )}

      {/* 题目列表 */}
      <div className="divide-y divide-border">
        {questions.map((q, qi) => {
          const userAnswer = answers[qi];
          const isRevealed = revealed.has(qi);
          const isCorrect = userAnswer === q.answer;

          return (
            <div key={qi} className="p-4">
              {/* 题号 + 题目 */}
              <div className="flex gap-2 mb-3">
                <span className={cn(
                  'flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold',
                  isRevealed
                    ? isCorrect ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300' : 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-300'
                    : 'bg-muted text-muted-foreground'
                )}>
                  {qi + 1}
                </span>
                <p className="text-sm text-foreground leading-relaxed pt-0.5">{q.q}</p>
              </div>

              {/* 选项 */}
              <div className="grid gap-2 ml-8">
                {q.options.map((opt, oi) => {
                  const isSelected = userAnswer === oi;
                  const isAnswer = q.answer === oi;
                  let optClass = 'border-border hover:border-primary/40 hover:bg-muted/30 cursor-pointer';

                  if (isRevealed) {
                    if (isAnswer) optClass = 'border-emerald-400 bg-emerald-50/70 dark:bg-emerald-950/30';
                    else if (isSelected && !isAnswer) optClass = 'border-red-400 bg-red-50/70 dark:bg-red-950/30';
                    else optClass = 'border-border/50 opacity-60';
                  } else if (isSelected) {
                    optClass = 'border-primary bg-primary/5';
                  }

                  return (
                    <button
                      key={oi}
                      onClick={() => selectOption(qi, oi)}
                      disabled={isRevealed}
                      className={cn(
                        'flex items-center gap-2.5 px-3 py-2 rounded-lg border text-left transition-all text-sm',
                        optClass
                      )}
                    >
                      <span className={cn(
                        'flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border',
                        isRevealed && isAnswer ? 'border-emerald-500 text-emerald-600 bg-emerald-100 dark:bg-emerald-900/50' :
                        isRevealed && isSelected ? 'border-red-500 text-red-600 bg-red-100 dark:bg-red-900/50' :
                        isSelected ? 'border-primary text-primary bg-primary/10' :
                        'border-muted-foreground/30 text-muted-foreground'
                      )}>
                        {getOptionLetter(oi)}
                      </span>
                      <span className="flex-1">{opt}</span>
                      {isRevealed && isAnswer && <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />}
                      {isRevealed && isSelected && !isAnswer && <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />}
                    </button>
                  );
                })}
              </div>

              {/* 单题确认 + 解析 */}
              <div className="ml-8 mt-2.5">
                {!isRevealed && userAnswer !== undefined && (
                  <button onClick={() => revealAnswer(qi)}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 font-medium transition-colors">
                    查看答案 <ChevronRight className="w-3 h-3" />
                  </button>
                )}
                {isRevealed && q.explain && (
                  <div className={cn(
                    'mt-2 px-3 py-2 rounded-lg text-xs leading-relaxed',
                    isCorrect ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-200' : 'bg-amber-50 dark:bg-amber-950/20 text-amber-800 dark:text-amber-200'
                  )}>
                    <span className="font-medium">{isCorrect ? '✅ 正确！' : '💡 解析：'}</span> {q.explain}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 底部操作栏 */}
      {!showResults && totalQ > 1 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20">
          <span className="text-[11px] text-muted-foreground">
            已答 {answeredCount}/{totalQ}
          </span>
          <button
            onClick={submitAll}
            disabled={answeredCount < totalQ}
            className={cn(
              'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
              answeredCount >= totalQ
                ? 'bg-primary text-primary-foreground hover:bg-primary/90'
                : 'bg-muted text-muted-foreground cursor-not-allowed'
            )}
          >
            提交全部
          </button>
        </div>
      )}
    </div>
  );
}

export const QuizBlock = memo(QuizBlockInner);
