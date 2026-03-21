/**
 * CorrectionShare — 分享批改报告页面（公开访问）
 *
 * 增强：展示逐题批改明细、知识点分析、思维导图、学习建议
 */
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle, CheckCircle2, XCircle, Eye, TrendingUp,
  BookOpen, Lightbulb, Network, ChevronDown, ChevronUp,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MermaidDiagram } from "./homework/MermaidDiagram";

/* ── 科目 & 评级映射 ─────────────────────────────────── */

const SUBJECT_MAP: Record<string, string> = {
  math: "数学", chinese: "语文", english: "英语",
  physics: "物理", chemistry: "化学", other: "其他",
};

/* ── 去除 AI 返回的代码围栏 ─────────────────────────── */

function stripCodeFences(text: string): string {
  if (!text) return text;
  let s = text.trim();
  s = s.replace(/^```(?:markdown|md|mermaid)?\s*\n?/, "");
  s = s.replace(/\n?```\s*$/, "");
  return s.trim();
}

const SCORE_LEVEL_MAP: Record<string, { label: string; emoji: string; color: string; bg: string }> = {
  excellent: { label: "优秀", emoji: "🌟", color: "text-green-700", bg: "bg-green-50 dark:bg-green-950 border-green-200" },
  good: { label: "良好", emoji: "👍", color: "text-blue-700", bg: "bg-blue-50 dark:bg-blue-950 border-blue-200" },
  pass: { label: "及格", emoji: "💪", color: "text-amber-700", bg: "bg-amber-50 dark:bg-amber-950 border-amber-200" },
  fail: { label: "需加强", emoji: "📚", color: "text-red-700", bg: "bg-red-50 dark:bg-red-950 border-red-200" },
};

/* ── 知识点统计 ──────────────────────────────────────── */

function buildKnowledgeStats(correctionResults: any[]): Array<{ name: string; total: number; correct: number; rate: number }> {
  const map: Record<string, { total: number; correct: number }> = {};
  (correctionResults || []).forEach((r: any) => {
    (r.questions || []).forEach((q: any) => {
      const kp = q.knowledgePoint || "其他";
      if (!map[kp]) map[kp] = { total: 0, correct: 0 };
      map[kp].total++;
      if (q.isCorrect) map[kp].correct++;
    });
  });
  return Object.entries(map)
    .map(([name, { total, correct }]) => ({ name, total, correct, rate: Math.round((correct / total) * 100) }))
    .sort((a, b) => a.rate - b.rate);
}

/* ── 图片展开组件 ────────────────────────────────────── */

function ImageSection({ correction }: { correction: any }) {
  const [expanded, setExpanded] = useState(false);
  const imageUrls: string[] = correction.imageUrls || [];
  if (imageUrls.length === 0) return null;

  const visible = expanded ? imageUrls : imageUrls.slice(0, 2);

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BookOpen className="h-4 w-4" /> 作业图片
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {visible.map((url: string, i: number) => (
            <img
              key={i}
              src={url}
              alt={`作业图片 ${i + 1}`}
              className="w-full rounded-lg border cursor-pointer hover:opacity-80 transition-opacity object-cover h-40"
              onClick={() => window.open(url, "_blank")}
            />
          ))}
        </div>
        {imageUrls.length > 2 && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 text-sm text-primary hover:underline flex items-center gap-1 mx-auto"
          >
            {expanded ? <><ChevronUp className="h-3 w-3" /> 收起</> : <><ChevronDown className="h-3 w-3" /> 查看全部 {imageUrls.length} 张</>}
          </button>
        )}
      </CardContent>
    </Card>
  );
}

/* ── 主页面 ──────────────────────────────────────────── */

export default function CorrectionShare() {
  const [, params] = useRoute("/share/:token");
  const shareToken = params?.token || "";

  const { data, isLoading, error } = trpc.correctionShare.getByToken.useQuery(
    { shareToken },
    { enabled: !!shareToken },
  );

  // SEO meta tags
  useEffect(() => {
    if (data?.correction) {
      document.title = `${data.correction.title} - 作业批改报告`;
      const metas = [
        { property: "og:title", content: `${data.correction.title} - 作业批改报告` },
        { property: "og:description", content: data.correction.summary || "查看Insi批改报告" },
        { property: "og:type", content: "article" },
      ];
      metas.forEach(({ property, content }) => {
        let tag = document.querySelector(`meta[property="${property}"]`);
        if (!tag) { tag = document.createElement("meta"); tag.setAttribute("property", property); document.head.appendChild(tag); }
        tag.setAttribute("content", content);
      });
    }
  }, [data]);

  /* ── 加载 / 错误 ── */

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 max-w-4xl px-4">
        <Skeleton className="h-10 w-64 mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="container mx-auto py-8 max-w-4xl px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>访问失败</AlertTitle>
          <AlertDescription>{error?.message || "分享链接不存在或已过期"}</AlertDescription>
        </Alert>
      </div>
    );
  }

  const { share, correction } = data;
  const scoreLevel = SCORE_LEVEL_MAP[correction.scoreLevel] || null;
  const correctionResults: any[] = correction.correctionResult || [];
  const knowledgeStats = buildKnowledgeStats(correctionResults);

  const pieData = [
    { name: "正确", value: correction.correctCount, color: "#22c55e" },
    { name: "错误", value: correction.wrongCount, color: "#ef4444" },
  ].filter(d => d.value > 0);

  return (
    <div className="container mx-auto py-6 max-w-4xl px-4">
      {/* ── 头部 ── */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          <h1 className="text-2xl md:text-3xl font-bold">{correction.title}</h1>
          <Badge variant="outline">{SUBJECT_MAP[correction.subject] || correction.subject}</Badge>
          {scoreLevel && (
            <Badge className={`${scoreLevel.bg} ${scoreLevel.color} border`}>
              {scoreLevel.emoji} {scoreLevel.label}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1"><Eye className="h-4 w-4" />{share.viewCount} 次查看</span>
          <span>批改时间: {new Date(correction.createdAt).toLocaleString("zh-CN")}</span>
          {correction.grade && <span>年级: {correction.grade}</span>}
        </div>
      </div>

      {/* ── 统计卡片 ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="text-center p-4 bg-muted rounded-lg">
          <div className="text-2xl font-bold">{correction.totalQuestions}</div>
          <div className="text-xs text-muted-foreground">总题数</div>
        </div>
        <div className="text-center p-4 bg-green-50 dark:bg-green-950 rounded-lg">
          <div className="text-2xl font-bold text-green-600">{correction.correctCount}</div>
          <div className="text-xs text-muted-foreground">正确</div>
        </div>
        <div className="text-center p-4 bg-red-50 dark:bg-red-950 rounded-lg">
          <div className="text-2xl font-bold text-red-600">{correction.wrongCount}</div>
          <div className="text-xs text-muted-foreground">错误</div>
        </div>
        <div className="text-center p-4 bg-blue-50 dark:bg-blue-950 rounded-lg">
          <div className="text-2xl font-bold text-blue-600">{correction.accuracy}%</div>
          <div className="text-xs text-muted-foreground">正确率</div>
        </div>
      </div>

      {/* ── 评分等级 + 饼图 ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* 评分等级 + 总结 */}
        <Card>
          <CardContent className="pt-6">
            {scoreLevel && (
              <div className={`p-4 rounded-lg text-center mb-4 border ${scoreLevel.bg}`}>
                <div className={`text-xl font-bold ${scoreLevel.color}`}>{scoreLevel.emoji} {scoreLevel.label}</div>
              </div>
            )}
            {correction.summary && (
              <p className="text-sm text-muted-foreground leading-relaxed">{correction.summary}</p>
            )}
          </CardContent>
        </Card>

        {/* 饼图 */}
        {correction.totalQuestions > 0 && (
          <Card>
            <CardContent className="pt-6">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={65} dataKey="value"
                    startAngle={90} endAngle={-270}
                    label={({ name, percent, x, y, midAngle }) => {
                      const RADIAN = Math.PI / 180;
                      const radius = 10;
                      const nx = x + radius * Math.cos(-midAngle * RADIAN);
                      const ny = y + radius * Math.sin(-midAngle * RADIAN);
                      return (
                        <text x={nx} y={ny} fill="#333" textAnchor={nx > 0 ? "start" : "end"} dominantBaseline="central" fontSize={12}>
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      );
                    }} labelLine={true}>
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip /><Legend />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── 知识点掌握分析 ── */}
      {knowledgeStats.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-blue-500" /> 知识点掌握分析
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {knowledgeStats.map((kp, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{kp.name}</span>
                    <span className={`text-sm font-bold ${kp.rate >= 80 ? "text-green-600" : kp.rate >= 60 ? "text-amber-600" : "text-red-600"}`}>
                      {kp.rate}% ({kp.correct}/{kp.total})
                    </span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className={`h-2 rounded-full transition-all ${kp.rate >= 80 ? "bg-green-500" : kp.rate >= 60 ? "bg-amber-500" : "bg-red-500"}`}
                      style={{ width: `${kp.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 逐题批改明细 ── */}
      {correctionResults.length > 0 && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="h-4 w-4" /> 详细批改
            </CardTitle>
            <CardDescription>逐题查看批改结果和错因分析</CardDescription>
          </CardHeader>
          <CardContent>
            {correctionResults.map((cr: any, idx: number) => (
              <div key={idx} className="mb-6 last:mb-0">
                {/* 图片标题 */}
                <div className="flex items-center gap-2 mb-3 pb-2 border-b">
                  <span className="text-sm font-semibold">第 {cr.imageIndex || idx + 1} 张作业</span>
                  {cr.imageQuality && (
                    <Badge variant="outline" className={`text-xs ${
                      cr.imageQuality === "good" ? "border-green-300 text-green-600" :
                      cr.imageQuality === "fair" ? "border-amber-300 text-amber-600" :
                      "border-red-300 text-red-600"
                    }`}>
                      {cr.imageQuality === "good" ? "图片清晰" : cr.imageQuality === "fair" ? "图片一般" : "图片模糊"}
                    </Badge>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {(cr.questions || []).length} 题 · 正确 {(cr.questions || []).filter((q: any) => q.isCorrect).length}
                  </span>
                </div>

                {/* 题目列表 */}
                <div className="space-y-3">
                  {(cr.questions || []).map((q: any, qi: number) => (
                    <div key={qi} className={`p-3 rounded-lg border ${
                      q.confidence === "low"
                        ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/30"
                        : q.isCorrect
                          ? "border-green-200 bg-green-50/30 dark:bg-green-950/20"
                          : "border-red-200 bg-red-50/30 dark:bg-red-950/20"
                    }`}>
                      <div className="flex items-start gap-2">
                        {q.isCorrect
                          ? <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                          : <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                        }
                        <div className="flex-1 min-w-0">
                          {/* 题目 */}
                          <div className="text-sm font-medium mb-2">{q.questionNumber}. {q.questionContent}</div>

                          {/* 答案对比 */}
                          <div className="space-y-1 text-sm">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-muted-foreground w-14 flex-shrink-0">学生答案</span>
                              <span className={`px-2 py-0.5 rounded font-mono text-sm ${
                                q.isCorrect
                                  ? "bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300"
                                  : "bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 line-through"
                              }`}>{q.studentAnswer}</span>
                            </div>
                            {!q.isCorrect && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-muted-foreground w-14 flex-shrink-0">正确答案</span>
                                <span className="px-2 py-0.5 rounded font-mono text-sm bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 font-semibold">
                                  {q.correctAnswer}
                                </span>
                              </div>
                            )}
                          </div>

                          {/* 错因分析 */}
                          {!q.isCorrect && q.errorAnalysis && (
                            <div className="mt-2 text-xs text-muted-foreground bg-muted/60 rounded px-3 py-2">
                              <span className="font-medium">错因：</span>{q.errorAnalysis}
                            </div>
                          )}

                          {/* 标签 */}
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {q.knowledgePoint && (
                              <Badge variant="secondary" className="text-xs">{q.knowledgePoint}</Badge>
                            )}
                            {q.difficulty && (
                              <Badge variant="outline" className={`text-xs ${
                                q.difficulty === "easy" ? "border-green-300 text-green-600" :
                                q.difficulty === "medium" ? "border-amber-300 text-amber-600" :
                                "border-red-300 text-red-600"
                              }`}>
                                {q.difficulty === "easy" ? "简单" : q.difficulty === "medium" ? "中等" : "困难"}
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ── 作业图片 ── */}
      <ImageSection correction={correction} />

      {/* ── 思维导图 ── */}
      {correction.mindMap && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Network className="h-4 w-4 text-blue-600" /> 知识点思维导图
            </CardTitle>
          </CardHeader>
          <CardContent>
            <MermaidDiagram chart={correction.mindMap} />
          </CardContent>
        </Card>
      )}

      {/* ── 学习建议 ── */}
      {correction.studySuggestions && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-600" /> 学习建议
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm dark:prose-invert max-w-none" style={{ overflowWrap: "break-word", wordBreak: "break-word" }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{stripCodeFences(correction.studySuggestions)}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── 页脚 ── */}
      <div className="mt-8 pb-8 text-center text-sm text-muted-foreground">
        <p>由 Insi智能代理平台 提供技术支持</p>
      </div>
    </div>
  );
}
