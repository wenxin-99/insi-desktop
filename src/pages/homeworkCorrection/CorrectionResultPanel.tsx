/**
 * homeworkCorrection/CorrectionResultPanel — 批改结果展示面板 (增强版)
 *
 * 新增功能：
 *   - 原图对照查看
 *   - 答案对比可视化（红绿高亮）
 *   - 知识点掌握雷达图
 *   - 用户纠错按钮 (AI判错了)
 *   - 低置信度醒目标注
 *   - 验算过程折叠展示
 *   - 数字滚动动画
 */
import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2, XCircle, TrendingUp, Network, Lightbulb,
  AlertTriangle, ChevronDown, ChevronUp, Eye, Flag,
  ThumbsUp, ThumbsDown, Loader2,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar } from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "../homework/MermaidDiagram";
import { useTranslation } from "react-i18next";

/* ── 去除 AI 返回的代码围栏 ─────────────────────────── */

function stripCodeFences(text: string): string {
  if (!text) return text;
  let s = text.trim();
  s = s.replace(/^```(?:markdown|md|mermaid)?\s*\n?/, "");
  s = s.replace(/\n?```\s*$/, "");
  return s.trim();
}

const SCORE_LEVEL_COLORS: Record<string, string> = {
  excellent: "#22c55e", good: "#3b82f6", pass: "#f59e0b", fail: "#ef4444",
};

/* ── 数字滚动动画 ─────────────────────────────────────── */

function AnimatedNumber({ value, duration = 1000, suffix = "" }: { value: number; duration?: number; suffix?: string }) {
  const [display, setDisplay] = useState(0);
  const startRef = useRef<number | null>(null);
  const rafRef = useRef<number>();

  useEffect(() => {
    startRef.current = null;
    const animate = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased * 100) / 100);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  return <>{Number.isInteger(value) ? Math.round(display) : display.toFixed(1)}{suffix}</>;
}

/* ── 原图查看弹窗（简易 lightbox） ─────────────────────── */

function ImageLightbox({ src, onClose }: { src: string; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <img
        src={src}
        alt="原图"
        className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      />
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white/80 hover:text-white bg-black/50 rounded-full p-2"
      >
        <XCircle className="h-6 w-6" />
      </button>
    </div>
  );
}

/* ── 单道题目展示组件 ─────────────────────────────────── */

function QuestionItem({
  q, qi, imageIndex, onReportError, t,
}: {
  q: any; qi: number; imageIndex: number; onReportError?: (imgIdx: number, qIdx: number, correct: boolean) => void; t: (key: string, opts?: any) => string;
}) {
  const [showVerification, setShowVerification] = useState(false);
  const isLowConfidence = q.confidence === "low";
  const isMediumConfidence = q.confidence === "medium";

  return (
    <div className={`p-4 rounded-lg transition-all ${
      isLowConfidence
        ? "bg-amber-50 dark:bg-amber-950/50 border-2 border-amber-300 dark:border-amber-700"
        : q._userCorrected
          ? "bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800"
          : "bg-muted border border-transparent"
    }`}>
      {/* 低置信度警告 */}
      {isLowConfidence && (
        <div className="flex items-center gap-2 mb-3 text-amber-600 dark:text-amber-400 text-xs font-medium">
          <AlertTriangle className="h-4 w-4" />
          {t("homework.results.lowConfidence")}
        </div>
      )}

      <div className="flex items-start gap-3">
        {/* 对错图标 */}
        <div className="flex-shrink-0 mt-0.5">
          {q.isCorrect ? (
            <CheckCircle2 className="h-5 w-5 text-green-600" />
          ) : (
            <XCircle className="h-5 w-5 text-red-600" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          {/* 题号 + 题目内容 */}
          <div className="text-sm font-medium mb-2">
            {q.questionNumber}. {q.questionContent}
          </div>

          {/* 答案对比 */}
          <div className="space-y-1.5 text-sm">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground text-xs w-16 flex-shrink-0">学生答案</span>
              <span className={`px-2 py-0.5 rounded text-sm font-mono ${
                q.isCorrect
                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                  : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 line-through"
              }`}>
                {q.studentAnswer}
              </span>
            </div>

            {!q.isCorrect && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-muted-foreground text-xs w-16 flex-shrink-0">正确答案</span>
                <span className="px-2 py-0.5 rounded text-sm font-mono bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-semibold">
                  {q.correctAnswer}
                </span>
              </div>
            )}

            {!q.isCorrect && q.errorAnalysis && (
              <div className="mt-2 text-xs text-muted-foreground bg-muted/60 rounded px-3 py-2">
                <span className="font-medium">错因分析：</span>{q.errorAnalysis}
              </div>
            )}
          </div>

          {/* 标签行：知识点 + 难度 + 置信度 */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            <Badge variant="secondary" className="text-xs">
              {q.knowledgePoint}
            </Badge>
            {q.difficulty && (
              <Badge variant="outline" className={`text-xs ${
                q.difficulty === "easy" ? "border-green-300 text-green-600" :
                q.difficulty === "medium" ? "border-amber-300 text-amber-600" :
                "border-red-300 text-red-600"
              }`}>
                {q.difficulty === "easy" ? "简单" : q.difficulty === "medium" ? "中等" : "困难"}
              </Badge>
            )}
            {(isLowConfidence || isMediumConfidence) && (
              <Badge variant="outline" className={`text-xs ${
                isLowConfidence ? "border-red-300 text-red-600 bg-red-50 dark:bg-red-950" : "border-orange-300 text-orange-600"
              }`}>
                {isLowConfidence ? "置信度低" : "置信度中"}
              </Badge>
            )}
            {q._userCorrected && (
              <Badge className="text-xs bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                <Flag className="h-3 w-3 mr-1" /> 已人工修正
              </Badge>
            )}
          </div>

          {/* 验算过程（折叠） */}
          {q.verificationSteps && (
            <div className="mt-2">
              <button
                onClick={() => setShowVerification(!showVerification)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {showVerification ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                {t("homework.results.verificationSteps")}
              </button>
              {showVerification && (
                <div className="mt-1.5 text-xs text-muted-foreground bg-muted/40 rounded p-2 whitespace-pre-wrap font-mono">
                  {q.verificationSteps}
                </div>
              )}
            </div>
          )}

          {/* 纠错按钮 */}
          {onReportError && !q._userCorrected && (
            <div className="mt-3 flex items-center gap-2">
              {q.isCorrect ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-red-600"
                  onClick={() => onReportError(imageIndex, qi, false)}
                >
                  <ThumbsDown className="h-3 w-3 mr-1" />
                  {t("homework.results.reportAiError")}
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground hover:text-green-600"
                  onClick={() => onReportError(imageIndex, qi, true)}
                >
                  <ThumbsUp className="h-3 w-3 mr-1" />
                  {t("homework.results.confirmCorrect")}
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── 知识点掌握雷达图 ─────────────────────────────────── */

function KnowledgeRadarChart({ results, t }: { results: any[]; t: (key: string) => string }) {
  // 按知识点聚合
  const kpMap: Record<string, { total: number; correct: number }> = {};
  (results || []).forEach((r: any) => {
    (r.questions || []).forEach((q: any) => {
      const kp = q.knowledgePoint || "其他";
      if (!kpMap[kp]) kpMap[kp] = { total: 0, correct: 0 };
      kpMap[kp].total++;
      if (q.isCorrect) kpMap[kp].correct++;
    });
  });

  const entries = Object.entries(kpMap);
  if (entries.length < 3) return null; // 少于3个知识点不显示雷达图

  const data = entries.map(([name, { total, correct }]) => ({
    name: name.length > 6 ? name.slice(0, 6) + "…" : name,
    fullName: name,
    mastery: Math.round((correct / total) * 100),
    total,
    correct,
  }));

  return (
    <div className="mb-6">
      <h3 className="text-sm font-medium mb-4 flex items-center gap-2">
        <TrendingUp className="h-4 w-4 text-blue-500" />
        {t("homework.results.knowledgeAnalysis")}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <RadarChart data={data}>
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
          <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Radar name="掌握度" dataKey="mastery" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.2} strokeWidth={2} />
          <Tooltip
            content={({ payload }) => {
              if (!payload || payload.length === 0) return null;
              const d = payload[0].payload;
              return (
                <div className="bg-popover text-popover-foreground p-2 rounded-lg border shadow-lg text-xs">
                  <div className="font-medium">{d.fullName}</div>
                  <div>正确率：{d.mastery}%</div>
                  <div>题数：{d.correct}/{d.total}</div>
                </div>
              );
            }}
          />
        </RadarChart>
      </ResponsiveContainer>
      {/* 知识点标签列表 */}
      <div className="flex flex-wrap gap-2 mt-2">
        {data.map((d, i) => (
          <span key={i} className={`text-xs px-2 py-1 rounded-full ${
            d.mastery >= 80 ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
            d.mastery >= 60 ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
            "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
          }`}>
            {d.fullName}: {d.mastery}%
          </span>
        ))}
      </div>
    </div>
  );
}

/* ── 主面板 ──────────────────────────────────────────── */

interface CorrectionResultPanelProps {
  result: any;
  onReportError?: (imageIndex: number, questionIndex: number, isActuallyCorrect: boolean) => void;
}

export function CorrectionResultPanel({ result, onReportError }: CorrectionResultPanelProps) {
  const { t } = useTranslation();
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const [expandedImages, setExpandedImages] = useState<Set<number>>(new Set());

  const SCORE_LEVEL_LABELS: Record<string, string> = {
    excellent: t("homework.results.scoreLevel.excellent"),
    good: t("homework.results.scoreLevel.good"),
    pass: t("homework.results.scoreLevel.pass"),
    fail: t("homework.results.scoreLevel.fail"),
  };

  if (!result) return null;

  const pieData = [
    { name: t("homework.results.correct"), value: result.correctCount, color: "#22c55e" },
    { name: t("homework.results.wrong"), value: result.wrongCount, color: "#ef4444" },
  ];

  const scoreLevelColor = SCORE_LEVEL_COLORS[result.scoreLevel] || "#888";
  const imageUrls: string[] = result.imageUrls ? JSON.parse(typeof result.imageUrls === "string" ? result.imageUrls : "[]") : [];

  const toggleImage = (idx: number) => {
    setExpandedImages((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  return (
    <>
      {lightboxSrc && <ImageLightbox src={lightboxSrc} onClose={() => setLightboxSrc(null)} />}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            {t("homework.results.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* 统计卡片 - 带数字动画 */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="text-2xl font-bold"><AnimatedNumber value={result.totalQuestions} /></div>
              <div className="text-sm text-muted-foreground">{t("homework.results.totalQuestions")}</div>
            </div>
            <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
              <div className="text-2xl font-bold text-green-600"><AnimatedNumber value={result.correctCount} /></div>
              <div className="text-sm text-muted-foreground">{t("homework.results.correct")}</div>
            </div>
            <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
              <div className="text-2xl font-bold text-red-600"><AnimatedNumber value={result.wrongCount} /></div>
              <div className="text-sm text-muted-foreground">{t("homework.results.wrong")}</div>
            </div>
            <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
              <div className="text-2xl font-bold text-blue-600"><AnimatedNumber value={result.accuracy} suffix="%" /></div>
              <div className="text-sm text-muted-foreground">{t("homework.results.accuracy")}</div>
            </div>
          </div>

          {/* 评分等级 */}
          <div
            className="mb-6 p-4 rounded-lg text-center"
            style={{
              backgroundColor: `${scoreLevelColor}15`,
              borderLeft: `4px solid ${scoreLevelColor}`,
            }}
          >
            <div className="text-lg font-semibold" style={{ color: scoreLevelColor }}>
              {SCORE_LEVEL_LABELS[result.scoreLevel] || ""}
            </div>
            <div className="text-sm text-muted-foreground mt-1">{result.summary}</div>
          </div>

          {/* 饼图 + 知识点雷达图 并排 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {result.totalQuestions > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-4">{t("homework.results.accuracy")} 分布</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      dataKey="value"
                    >
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
            <KnowledgeRadarChart results={result.correctionResults || []} t={t} />
          </div>

          {/* 详细批改 - 增强版 */}
          <div>
            <h3 className="text-sm font-medium mb-4">{t("homework.results.detailedCorrection")}</h3>
            {(result.correctionResults || []).map((cr: any, idx: number) => (
              <div key={idx} className="mb-6 border rounded-lg overflow-hidden">
                {/* 图片头部 */}
                <div
                  className="flex items-center justify-between p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => toggleImage(idx)}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-medium">{t("homework.results.imageIndex", { index: cr.imageIndex })}</span>
                    {cr.imageQuality && (
                      <Badge variant="outline" className={`text-xs ${
                        cr.imageQuality === "good" ? "border-green-300 text-green-600" :
                        cr.imageQuality === "fair" ? "border-amber-300 text-amber-600" :
                        "border-red-300 text-red-600"
                      }`}>
                        {cr.imageQuality === "good" ? "图片清晰" : cr.imageQuality === "fair" ? "图片一般" : "图片模糊"}
                      </Badge>
                    )}
                    {cr.error && <span className="text-xs text-red-600">{cr.error}</span>}
                    <span className="text-xs text-muted-foreground">
                      {(cr.questions || []).length} 题 · 正确 {(cr.questions || []).filter((q: any) => q.isCorrect).length}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {/* 原图查看按钮 */}
                    {imageUrls[idx] && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          setLightboxSrc(imageUrls[idx]);
                        }}
                      >
                        <Eye className="h-3 w-3 mr-1" />
                        {t("homework.results.originalImage")}
                      </Button>
                    )}
                    {expandedImages.has(idx) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </div>
                </div>

                {/* 识别备注 */}
                {cr.recognitionNotes && cr.recognitionNotes !== "无" && cr.recognitionNotes !== "处理失败" && (
                  <div className="text-xs text-amber-600 dark:text-amber-400 px-4 py-2 bg-amber-50 dark:bg-amber-950 border-t">
                    <AlertTriangle className="h-3 w-3 inline mr-1" />
                    识别备注：{cr.recognitionNotes}
                  </div>
                )}

                {/* 题目列表（默认展开，可折叠） */}
                {(expandedImages.size === 0 || expandedImages.has(idx)) && cr.questions?.length > 0 && (
                  <div className="p-4 space-y-3">
                    {/* 原图缩略图 */}
                    {imageUrls[idx] && (
                      <div
                        className="w-full max-h-40 overflow-hidden rounded-lg border cursor-pointer hover:opacity-90 transition-opacity mb-3"
                        onClick={() => setLightboxSrc(imageUrls[idx])}
                      >
                        <img
                          src={imageUrls[idx]}
                          alt={`作业原图 ${idx + 1}`}
                          className="w-full h-full object-cover object-top"
                        />
                      </div>
                    )}
                    {cr.questions.map((q: any, qi: number) => (
                      <QuestionItem
                        key={qi}
                        q={q}
                        qi={qi}
                        imageIndex={idx}
                        onReportError={onReportError}
                        t={t}
                      />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 思维导图 */}
          {result.mindMap ? (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Network className="h-5 w-5 text-blue-600" />
                <h3 className="text-lg font-semibold">知识点思维导图</h3>
              </div>
              <MermaidDiagram chart={result.mindMap} />
            </div>
          ) : result.insightsGenerating && (
            <div className="mt-6 p-6 bg-muted/30 rounded-lg border border-dashed flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
              <div>
                <div className="text-sm font-medium">正在生成知识点思维导图...</div>
                <div className="text-xs text-muted-foreground mt-0.5">AI 正在分析知识点关系，请稍候</div>
              </div>
            </div>
          )}

          {/* 学习建议 */}
          {result.studySuggestions ? (
            <div className="mt-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-yellow-600" />
                <h3 className="text-lg font-semibold">学习建议</h3>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg prose prose-sm dark:prose-invert max-w-none [&>*]:break-words" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripCodeFences(result.studySuggestions)}</ReactMarkdown>
              </div>
            </div>
          ) : result.insightsGenerating && (
            <div className="mt-6 p-6 bg-muted/30 rounded-lg border border-dashed flex items-center gap-3">
              <Loader2 className="h-5 w-5 animate-spin text-yellow-500" />
              <div>
                <div className="text-sm font-medium">正在生成学习建议...</div>
                <div className="text-xs text-muted-foreground mt-0.5">AI 正在根据错题生成个性化建议</div>
              </div>
            </div>
          )}

          {/* 错题收集提示 */}
          {result.wrongQuestionsCount > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-950 rounded-lg flex items-center gap-3">
              <div className="bg-yellow-100 dark:bg-yellow-900 rounded-full p-2">
                <Flag className="h-4 w-4 text-yellow-600" />
              </div>
              <div className="text-sm">
                已收集 <span className="font-semibold">{result.wrongQuestionsCount}</span> 道错题到错题本，可前往错题本页面查看和重做。
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
