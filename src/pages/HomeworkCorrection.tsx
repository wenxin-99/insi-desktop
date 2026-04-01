/**
 * HomeworkCorrection — 作业批改页面 (增强版)
 *
 * 新增功能：
 *   - 拖拽上传 + 图片压缩
 *   - 年级下拉选择器
 *   - 分步进度条
 *   - 费用确认对话框
 *   - 完成动画
 *   - 空状态引导
 *   - 图片排序
 */
import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Upload, Loader2, History, X, Camera, ImagePlus, GripVertical,
  CheckCircle2, FileText, Sparkles, BarChart3, ArrowRight,
  Coins, AlertTriangle, PartyPopper,
} from "lucide-react";
import { ScrollIndicator } from "@/components/ScrollIndicator";
import DashboardLayout from "@/components/DashboardLayout";
import { useTranslation } from "react-i18next";
import { useHomeworkCorrection } from "./homeworkCorrection/useHomeworkCorrection";
import { CorrectionResultPanel } from "./homeworkCorrection/CorrectionResultPanel";

/* ── 年级选项（内联定义，避免跨文件导出问题） ──────────── */

const GRADE_OPTIONS = [
  { value: "1", labelKey: "homework.form.gradeOptions.g1", group: "primary" },
  { value: "2", labelKey: "homework.form.gradeOptions.g2", group: "primary" },
  { value: "3", labelKey: "homework.form.gradeOptions.g3", group: "primary" },
  { value: "4", labelKey: "homework.form.gradeOptions.g4", group: "primary" },
  { value: "5", labelKey: "homework.form.gradeOptions.g5", group: "primary" },
  { value: "6", labelKey: "homework.form.gradeOptions.g6", group: "primary" },
  { value: "7", labelKey: "homework.form.gradeOptions.g7", group: "middle" },
  { value: "8", labelKey: "homework.form.gradeOptions.g8", group: "middle" },
  { value: "9", labelKey: "homework.form.gradeOptions.g9", group: "middle" },
  { value: "10", labelKey: "homework.form.gradeOptions.g10", group: "high" },
  { value: "11", labelKey: "homework.form.gradeOptions.g11", group: "high" },
  { value: "12", labelKey: "homework.form.gradeOptions.g12", group: "high" },
];

/* ── 流程引导步骤组件 ─────────────────────────────────── */

function GuideSteps({ t }: { t: (key: string) => string }) {
  const steps = [
    { icon: <Camera className="h-5 w-5" />, title: t("homework.guide.step1"), desc: t("homework.guide.step1Desc"), color: "text-blue-500 bg-blue-50 dark:bg-blue-950" },
    { icon: <FileText className="h-5 w-5" />, title: t("homework.guide.step2"), desc: t("homework.guide.step2Desc"), color: "text-purple-500 bg-purple-50 dark:bg-purple-950" },
    { icon: <Sparkles className="h-5 w-5" />, title: t("homework.guide.step3"), desc: t("homework.guide.step3Desc"), color: "text-amber-500 bg-amber-50 dark:bg-amber-950" },
    { icon: <BarChart3 className="h-5 w-5" />, title: t("homework.guide.step4"), desc: t("homework.guide.step4Desc"), color: "text-green-500 bg-green-50 dark:bg-green-950" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
      {steps.map((s, i) => (
        <div key={i} className="relative flex flex-col items-center text-center p-3 rounded-xl bg-muted/30 border border-border/50">
          {i < steps.length - 1 && (
            <ArrowRight className="hidden md:block absolute -right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/40 z-10" />
          )}
          <div className={`rounded-full p-2 mb-2 ${s.color}`}>{s.icon}</div>
          <div className="text-xs font-medium">{s.title}</div>
          <div className="text-[10px] text-muted-foreground mt-0.5">{s.desc}</div>
        </div>
      ))}
    </div>
  );
}

/* ── 进度追踪面板 ────────────────────────────────────── */

function ProgressPanel({ progress, t }: { progress: any; t: (key: string, opts?: any) => string }) {
  if (progress.step === "idle") return null;

  const stepConfig: Record<string, { label: string; detail: string; icon: React.ReactNode; color: string }> = {
    uploading: {
      label: t("homework.progress.uploading"),
      detail: t("homework.progress.uploadingDetail", { current: progress.current, total: progress.total }),
      icon: <Upload className="h-5 w-5 animate-bounce" />,
      color: "text-blue-500",
    },
    recognizing: {
      label: t("homework.progress.recognizing"),
      detail: t("homework.progress.recognizingDetail", { current: progress.current, total: progress.total }),
      icon: <FileText className="h-5 w-5 animate-pulse" />,
      color: "text-purple-500",
    },
    correcting: {
      label: t("homework.progress.correcting"),
      detail: t("homework.progress.correctingDetail", { current: progress.current, total: progress.total }),
      icon: <Sparkles className="h-5 w-5 animate-pulse" />,
      color: "text-amber-500",
    },
    generating: {
      label: t("homework.progress.generating"),
      detail: t("homework.progress.generatingDetail"),
      icon: <BarChart3 className="h-5 w-5 animate-pulse" />,
      color: "text-green-500",
    },
    complete: {
      label: t("homework.progress.complete"),
      detail: t("homework.progress.completeDetail", { total: progress.total, accuracy: progress.current }),
      icon: <CheckCircle2 className="h-5 w-5" />,
      color: "text-green-600",
    },
  };

  const cfg = stepConfig[progress.step];
  if (!cfg) return null;

  const allSteps = ["uploading", "correcting", "generating", "complete"];
  const currentIdx = allSteps.indexOf(progress.step);

  return (
    <Card className="mb-6 overflow-hidden">
      <CardContent className="pt-6">
        {/* 步骤指示器 */}
        <div className="flex items-center justify-between mb-4">
          {allSteps.map((step, i) => {
            const isActive = i === currentIdx;
            const isDone = i < currentIdx;
            const stepCfg = stepConfig[step];
            return (
              <div key={step} className="flex items-center flex-1">
                <div className={`flex flex-col items-center flex-1 ${isActive ? "opacity-100" : isDone ? "opacity-60" : "opacity-30"}`}>
                  <div className={`rounded-full p-1.5 ${isActive ? stepCfg?.color : isDone ? "text-green-500" : "text-muted-foreground"} ${isActive ? "bg-current/10 ring-2 ring-current/20" : ""}`}>
                    {isDone ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : stepCfg?.icon}
                  </div>
                  <span className="text-[10px] mt-1 text-center leading-tight">{stepCfg?.label}</span>
                </div>
                {i < allSteps.length - 1 && (
                  <div className={`h-0.5 flex-1 mx-1 rounded ${i < currentIdx ? "bg-green-500" : "bg-border"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* 进度条 */}
        <Progress value={progress.percent} className="h-2 mb-3" />

        {/* 当前状态 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className={cfg.color}>{cfg.icon}</span>
            <span className="text-sm font-medium">{cfg.label}</span>
          </div>
          <span className="text-sm text-muted-foreground">{cfg.detail}</span>
        </div>
      </CardContent>
    </Card>
  );
}

/* ── 完成撒花动画 ────────────────────────────────────── */

function CompletionAnimation({ show, result }: { show: boolean; result: any }) {
  if (!show || !result) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div className="animate-in fade-in zoom-in-95 duration-500 bg-background/95 backdrop-blur-sm rounded-2xl shadow-2xl p-8 text-center max-w-sm pointer-events-auto border">
        <PartyPopper className="h-12 w-12 mx-auto text-amber-500 mb-4 animate-bounce" />
        <h2 className="text-2xl font-bold mb-2">批改完成！</h2>
        <div className="flex justify-center gap-6 mb-4">
          <div>
            <div className="text-3xl font-bold text-green-600">{result.accuracy}%</div>
            <div className="text-xs text-muted-foreground">正确率</div>
          </div>
          <div>
            <div className="text-3xl font-bold">{result.totalQuestions}</div>
            <div className="text-xs text-muted-foreground">总题数</div>
          </div>
          <div>
            <div className="text-3xl font-bold text-red-500">{result.wrongCount}</div>
            <div className="text-xs text-muted-foreground">错题</div>
          </div>
        </div>
        <div className={`text-sm font-medium px-3 py-1.5 rounded-full inline-block ${
          result.scoreLevel === "excellent" ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300" :
          result.scoreLevel === "good" ? "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300" :
          result.scoreLevel === "pass" ? "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300" :
          "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
        }`}>
          {result.scoreLevel === "excellent" ? "🌟 优秀" :
           result.scoreLevel === "good" ? "👍 良好" :
           result.scoreLevel === "pass" ? "💪 及格，继续加油" : "📚 需要多练习"}
        </div>
      </div>
    </div>
  );
}

/* ── 主页面组件 ──────────────────────────────────────── */

export default function HomeworkCorrection() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const c = useHomeworkCorrection();

  /* 拖拽排序状态 */
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  return (
    <DashboardLayout>
      <div ref={mainContainerRef} className="container max-w-4xl py-8 overflow-y-auto max-h-screen">
        <ScrollIndicator containerRef={mainContainerRef} />

        {/* 完成动画 */}
        <CompletionAnimation show={c.showCompletionAnim} result={c.correctionResult} />

        {/* 页面标题 */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold">{t("homework.title")}</h1>
            <Button variant="outline" onClick={() => setLocation("/homework/history")}>
              <History className="mr-2 h-4 w-4" /> {t("homework.viewHistory")}
            </Button>
          </div>
          <p className="text-muted-foreground">{t("homework.subtitle")}</p>
        </div>

        {/* 流程引导 */}
        <GuideSteps t={t} />

        {/* 进度面板 */}
        <ProgressPanel progress={c.progress} t={t} />

        {/* 上传表单卡片 */}
        <Card className={c.isProcessing ? "opacity-60 pointer-events-none" : ""}>
          <CardHeader>
            <CardTitle>{t("homework.uploadHomework")}</CardTitle>
            <CardDescription>{t("homework.uploadDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* 科目选择 */}
            <div>
              <Label htmlFor="subject">{t("homework.form.subject")}</Label>
              <Select value={c.subject} onValueChange={c.setSubject}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {c.SUBJECTS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* 年级选择 - 改为下拉 */}
            <div>
              <Label htmlFor="grade">{t("homework.form.grade")}</Label>
              <Select value={c.grade || undefined} onValueChange={(v) => c.setGrade(v === "none" ? "" : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={t("homework.form.gradePlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">不限年级</SelectItem>
                  <SelectGroup>
                    <SelectLabel>小学</SelectLabel>
                    {GRADE_OPTIONS.filter((g) => g.group === "primary").map((g) => (
                      <SelectItem key={g.value} value={g.value}>{t(g.labelKey)}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>初中</SelectLabel>
                    {GRADE_OPTIONS.filter((g) => g.group === "middle").map((g) => (
                      <SelectItem key={g.value} value={g.value}>{t(g.labelKey)}</SelectItem>
                    ))}
                  </SelectGroup>
                  <SelectGroup>
                    <SelectLabel>高中</SelectLabel>
                    {GRADE_OPTIONS.filter((g) => g.group === "high").map((g) => (
                      <SelectItem key={g.value} value={g.value}>{t(g.labelKey)}</SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            {/* 标题输入 */}
            <div>
              <Label htmlFor="title">{t("homework.form.title")}</Label>
              <Input
                id="title"
                value={c.title}
                onChange={(e) => c.setTitle(e.target.value)}
                placeholder={t("homework.form.titlePlaceholder")}
              />
            </div>

            {/* 图片上传区域 - 拖拽增强 */}
            <div>
              <Label>{t("homework.form.uploadImages")}</Label>
              <div className="mt-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={c.handleFileSelect}
                  className="hidden"
                  id="file-upload"
                />

                {/* 拖拽上传区 */}
                <div
                  onDragOver={c.handleDragOver}
                  onDragLeave={c.handleDragLeave}
                  onDrop={c.handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`
                    flex flex-col items-center justify-center w-full h-36 border-2 border-dashed rounded-xl
                    cursor-pointer transition-all duration-200
                    ${c.isDragOver
                      ? "border-primary bg-primary/5 scale-[1.01] shadow-lg"
                      : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50"}
                    ${c.isCompressing ? "animate-pulse" : ""}
                  `}
                >
                  {c.isCompressing ? (
                    <>
                      <Loader2 className="h-8 w-8 text-primary animate-spin mb-2" />
                      <span className="text-sm text-muted-foreground">{t("homework.compressing")}</span>
                    </>
                  ) : c.isDragOver ? (
                    <>
                      <ImagePlus className="h-10 w-10 text-primary mb-2 animate-bounce" />
                      <span className="text-sm font-medium text-primary">{t("homework.dragDropActive")}</span>
                    </>
                  ) : (
                    <>
                      <Upload className="h-8 w-8 text-muted-foreground mb-2" />
                      <span className="text-sm text-muted-foreground">{t("homework.dragDropHint")}</span>
                      <span className="text-xs text-muted-foreground/60 mt-1">{t("homework.form.clickToUpload")}</span>
                    </>
                  )}
                </div>
              </div>

              {/* 已选图片预览 - 支持拖拽排序 */}
              {c.images.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-muted-foreground">
                      {t("homework.selectedCount", { count: c.images.length })}
                      {c.compressionSaved > 5 && (
                        <span className="ml-2 text-green-600 text-xs">
                          (已压缩，节省 {c.compressionSaved}%)
                        </span>
                      )}
                    </span>
                    {c.images.length > 1 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <GripVertical className="h-3 w-3" /> {t("homework.imageOrder")}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {c.images.map((img, index) => (
                      <div
                        key={index}
                        draggable
                        onDragStart={() => setDragIdx(index)}
                        onDragOver={(e) => { e.preventDefault(); setDragOverIdx(index); }}
                        onDragEnd={() => {
                          if (dragIdx !== null && dragOverIdx !== null && dragIdx !== dragOverIdx) {
                            c.handleReorderImages(dragIdx, dragOverIdx);
                          }
                          setDragIdx(null);
                          setDragOverIdx(null);
                        }}
                        className={`
                          relative group rounded-lg overflow-hidden border transition-all duration-200
                          ${dragOverIdx === index && dragIdx !== index ? "ring-2 ring-primary scale-[1.02]" : ""}
                          ${dragIdx === index ? "opacity-50" : ""}
                        `}
                      >
                        <img
                          src={img.preview}
                          alt={`预览 ${index + 1}`}
                          className="w-full h-28 object-cover cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => c.handleImagePreview(index)}
                        />
                        {/* 删除按钮 */}
                        <button
                          onClick={(e) => { e.stopPropagation(); c.handleRemoveImage(index); }}
                          className="absolute top-1.5 right-1.5 bg-red-500/90 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <X className="h-3 w-3" />
                        </button>
                        {/* 序号标签 */}
                        <div className="absolute bottom-1.5 left-1.5 bg-black/70 text-white text-xs px-2 py-0.5 rounded font-medium">
                          {index + 1}
                        </div>
                        {/* 拖拽手柄 */}
                        {c.images.length > 1 && (
                          <div className="absolute top-1.5 left-1.5 bg-black/50 text-white rounded p-0.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                            <GripVertical className="h-3 w-3" />
                          </div>
                        )}
                        {/* 压缩标识 */}
                        {img.compressed && (
                          <div className="absolute bottom-1.5 right-1.5 bg-green-500/80 text-white text-[10px] px-1.5 py-0.5 rounded">
                            已压缩
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 提交按钮 */}
            <Button
              onClick={c.handleSubmitClick}
              disabled={c.isProcessing || c.images.length === 0}
              className="w-full h-12 text-base font-medium"
              size="lg"
            >
              {c.isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {c.progress.step === "uploading" ? t("homework.uploading") : t("homework.gradingInProgress")}
                </>
              ) : (
                <>
                  <Sparkles className="mr-2 h-5 w-5" />
                  {t("homework.startGrading")}
                  {c.images.length > 0 && (
                    <span className="ml-2 text-sm opacity-80">
                      ({c.images.length} 张图片)
                    </span>
                  )}
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* 费用确认对话框 */}
        <AlertDialog open={c.showCostDialog} onOpenChange={c.setShowCostDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                {t("homework.costConfirm.title")}
              </AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-3">
                  <p className="text-base font-medium text-foreground">
                    {t("homework.costConfirm.description", { cost: c.estimatedCost })}
                  </p>
                  <div className="bg-muted rounded-lg p-3 space-y-1.5 text-sm">
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">图片数量：</span>
                      <span className="font-medium">{c.images.length} 张</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">科目：</span>
                      <span className="font-medium">{c.SUBJECTS.find((s) => s.value === c.subject)?.label}</span>
                    </div>
                    {c.grade && (
                      <div className="flex items-center gap-2">
                        <span className="text-muted-foreground">年级：</span>
                        <span className="font-medium">{t(GRADE_OPTIONS.find((g) => g.value === c.grade)?.labelKey || "")}</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-start gap-2 text-xs text-amber-600 dark:text-amber-400">
                    <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>提交后将自动扣除🐟币，请确认后再操作</span>
                  </div>
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t("homework.costConfirm.cancel")}</AlertDialogCancel>
              <AlertDialogAction onClick={c.handleConfirmSubmit}>
                {t("homework.costConfirm.confirm")} ({c.estimatedCost} 🐟)
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* 批改结果 */}
        <CorrectionResultPanel result={c.correctionResult} onReportError={c.handleReportError} />

        {/* 批改历史 */}
        {c.correctionHistory && c.correctionHistory.length > 0 && (
          <Card className="mt-8">
            <CardHeader>
              <CardTitle>{t("homework.gradingHistory")}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {c.correctionHistory.map((record: any) => (
                  <div
                    key={record.id}
                    className="p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
                    onClick={() => {
                      // ★ 字段映射：getList 返回的字段名与 CorrectionResultPanel 期望的不同
                      c.setCorrectionResult({
                        correctionId: record.id,
                        totalQuestions: record.totalQuestions,
                        correctCount: record.correctCount,
                        wrongCount: record.wrongCount ?? (record.totalQuestions - record.correctCount),
                        accuracy: typeof record.accuracy === 'string' ? parseFloat(record.accuracy) : record.accuracy,
                        scoreLevel: record.scoreLevel,
                        summary: record.summary,
                        // ★ 核心修复：DB 字段名 correctionResult（单数）→ 面板期望 correctionResults（复数）
                        correctionResults: record.correctionResult,
                        // ★ 核心修复：getList 已 parse 为数组，面板内部会再 JSON.parse，需要重新 stringify
                        imageUrls: Array.isArray(record.imageUrls) ? JSON.stringify(record.imageUrls) : record.imageUrls,
                        mindMap: record.mindMap || null,
                        studySuggestions: record.studySuggestions || null,
                        insightsGenerating: false,
                      });
                    }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium group-hover:text-primary transition-colors">
                        {record.title || t("homework.history.untitled")}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {new Date(record.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>{record.subject}</span>
                      <span>{t("homework.results.totalQuestions")}：{record.totalQuestions}</span>
                      <span className="text-green-600">{t("homework.results.correct")}：{record.correctCount}</span>
                      <span className="text-red-600">{t("homework.results.wrong")}：{record.wrongCount}</span>
                      <span className="text-blue-600 font-medium">{record.accuracy}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
