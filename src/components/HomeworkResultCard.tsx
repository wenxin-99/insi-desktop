/**
 * HomeworkResultCard — 对话内作业批改结果卡片
 *
 * ★ T14-2: 渲染 homework_result SSE 事件
 *
 * 布局：
 *   顶部：总分/满分 + 正确率环形图
 *   中部：题目列表（✓ 绿 / ✗ 红），点击展开详情
 *   底部："收入错题本" 按钮
 */
import { useState, memo } from 'react';
import { ChevronDown, ChevronUp, BookOpen, CheckCircle2, XCircle, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface HomeworkQuestion {
  questionNumber: string;
  questionContent: string;
  studentAnswer: string;
  correctAnswer: string;
  isCorrect: boolean;
  score?: number;
  maxScore?: number;
  errorAnalysis: string;
  knowledgePoint?: string;
  feedback?: string;
}

export interface HomeworkResultData {
  correctionId?: number;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  accuracy: number;
  scoreLevel: 'excellent' | 'good' | 'pass' | 'fail';
  summary?: string;
  questions: HomeworkQuestion[];
}

// ── 环形进度 ──
function ScoreRing({ accuracy, scoreLevel }: { accuracy: number; scoreLevel: string }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - accuracy / 100);

  const color = scoreLevel === 'excellent' ? '#22c55e'
    : scoreLevel === 'good' ? '#3b82f6'
    : scoreLevel === 'pass' ? '#f59e0b'
    : '#ef4444';

  return (
    <div className="relative w-24 h-24 flex-shrink-0">
      <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="currentColor" className="text-muted/30" strokeWidth="6" />
        <circle cx="40" cy="40" r={radius} fill="none" stroke={color} strokeWidth="6"
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" className="transition-all duration-1000 ease-out" />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold" style={{ color }}>{Math.round(accuracy)}%</span>
        <span className="text-[10px] text-muted-foreground">正确率</span>
      </div>
    </div>
  );
}

// ── 题目行 ──
function QuestionRow({ q, idx, expanded, onToggle }: {
  q: HomeworkQuestion; idx: number; expanded: boolean; onToggle: () => void;
}) {
  return (
    <div className="border-b border-border/50 last:border-0">
      <button
        onClick={onToggle}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/30 transition-colors',
          q.isCorrect ? 'text-foreground' : 'text-foreground',
        )}
      >
        {q.isCorrect
          ? <CheckCircle2 className="w-4 h-4 text-green-500 flex-shrink-0" />
          : <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
        }
        <span className="text-xs font-medium min-w-[28px]">{q.questionNumber || `#${idx + 1}`}</span>
        <span className="text-xs truncate flex-1">{q.questionContent || '题目'}</span>
        {q.score !== undefined && q.maxScore !== undefined && (
          <span className={cn('text-xs font-mono', q.isCorrect ? 'text-green-600' : 'text-red-600')}>
            {q.score}/{q.maxScore}
          </span>
        )}
        {expanded ? <ChevronUp className="w-3 h-3 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 text-muted-foreground" />}
      </button>

      {expanded && (
        <div className="px-3 pb-3 pt-1 bg-muted/20 space-y-1.5 text-xs animate-in slide-in-from-top-1 duration-150">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <span className="text-muted-foreground">学生答案：</span>
              <span className={q.isCorrect ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                {q.studentAnswer || '—'}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">正确答案：</span>
              <span className="font-medium">{q.correctAnswer || '—'}</span>
            </div>
          </div>
          {!q.isCorrect && q.errorAnalysis && (
            <div className="pt-1 border-t border-border/30">
              <span className="text-muted-foreground">错因：</span>
              <span className="text-amber-700 dark:text-amber-400">{q.errorAnalysis}</span>
            </div>
          )}
          {q.knowledgePoint && (
            <div className="text-muted-foreground">
              知识点：<span className="text-foreground">{q.knowledgePoint}</span>
            </div>
          )}
          {q.feedback && (
            <div className="text-muted-foreground italic">{q.feedback}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── 主卡片 ──
export const HomeworkResultCard = memo(function HomeworkResultCard({ data }: { data: HomeworkResultData }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const emoji = data.scoreLevel === 'excellent' ? '🌟'
    : data.scoreLevel === 'good' ? '👍'
    : data.scoreLevel === 'pass' ? '💪'
    : '📚';

  const levelLabel = data.scoreLevel === 'excellent' ? '优秀'
    : data.scoreLevel === 'good' ? '良好'
    : data.scoreLevel === 'pass' ? '及格'
    : '需努力';

  const visibleQuestions = showAll ? data.questions : data.questions.slice(0, 10);

  return (
    <div className="my-3 border border-border rounded-xl overflow-hidden bg-card shadow-sm">
      {/* ── 头部：得分 + 环形图 ── */}
      <div className="flex items-center gap-4 p-4 bg-muted/30">
        <ScoreRing accuracy={data.accuracy} scoreLevel={data.scoreLevel} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg">{emoji}</span>
            <span className="font-semibold text-sm">{levelLabel}</span>
          </div>
          <div className="text-xs text-muted-foreground space-y-0.5">
            <p>共 <span className="font-medium text-foreground">{data.totalQuestions}</span> 题，
              正确 <span className="text-green-600 font-medium">{data.correctCount}</span> 题，
              错误 <span className="text-red-600 font-medium">{data.wrongCount}</span> 题</p>
            {data.summary && <p className="line-clamp-2">{data.summary}</p>}
          </div>
        </div>
      </div>

      {/* ── 题目列表 ── */}
      {data.questions.length > 0 && (
        <div className="border-t border-border">
          {visibleQuestions.map((q, i) => (
            <QuestionRow
              key={i}
              q={q}
              idx={i}
              expanded={expandedIdx === i}
              onToggle={() => setExpandedIdx(expandedIdx === i ? null : i)}
            />
          ))}
          {!showAll && data.questions.length > 10 && (
            <button onClick={() => setShowAll(true)}
              className="w-full py-2 text-xs text-blue-500 hover:text-blue-600 hover:bg-muted/30 transition-colors">
              展开全部 {data.questions.length} 题
            </button>
          )}
        </div>
      )}

      {/* ── 底部操作 ── */}
      {data.wrongCount > 0 && (
        <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
            <span>{data.wrongCount} 道错题已自动收录</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => window.open('/wrong-questions', '_blank')}
          >
            <BookOpen className="w-3 h-3" />
            错题本
          </Button>
        </div>
      )}
    </div>
  );
});
