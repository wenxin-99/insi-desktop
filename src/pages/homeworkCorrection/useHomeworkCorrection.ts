/**
 * homeworkCorrection/useHomeworkCorrection — 状态管理 + 上传/批改逻辑
 *
 * 增强功能：
 *   - 拖拽上传 (drag & drop)
 *   - 图片压缩预处理
 *   - 分步进度追踪
 *   - 费用确认对话框
 *   - 常用配置记忆
 *   - 用户纠错反馈
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

/* ── 类型定义 ─────────────────────────────────────────── */

export interface ProgressState {
  step: "idle" | "uploading" | "recognizing" | "correcting" | "generating" | "complete";
  current: number;
  total: number;
  percent: number;
}

export interface ImageItem {
  file: File;
  preview: string;
  compressed?: File;
  compressedSize?: number;
  originalSize: number;
}

/* ── 图片压缩工具 ─────────────────────────────────────── */

async function compressImage(file: File, maxWidth = 1920, quality = 0.82): Promise<File> {
  if (file.size < 500 * 1024) return file;

  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob && blob.size < file.size) {
            resolve(new File([blob], file.name, { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(file);
    };
    img.src = url;
  });
}

/* ── 本地配置记忆 ─────────────────────────────────────── */

const STORAGE_KEY = "homework_correction_prefs";

function loadPrefs(): { subject: string; grade: string } {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { subject: "math", grade: "" };
}

function savePrefs(subject: string, grade: string) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ subject, grade }));
  } catch {}
}

/* ── 年级选项 ─────────────────────────────────────────── */

export const GRADE_OPTIONS = [
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

/* ── 主 Hook ──────────────────────────────────────────── */

export function useHomeworkCorrection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const prefs = useRef(loadPrefs());

  /* 表单状态 */
  const [images, setImages] = useState<ImageItem[]>([]);
  const [subject, setSubject] = useState<string>(prefs.current.subject);
  const [grade, setGrade] = useState<string>(prefs.current.grade);
  const [title, setTitle] = useState<string>("");

  /* 流程状态 */
  const [progress, setProgress] = useState<ProgressState>({
    step: "idle", current: 0, total: 0, percent: 0,
  });
  const [correctionResult, setCorrectionResult] = useState<any>(null);

  /* 费用确认对话框 */
  const [showCostDialog, setShowCostDialog] = useState(false);
  const [estimatedCost, setEstimatedCost] = useState(0);

  /* 拖拽状态 */
  const [isDragOver, setIsDragOver] = useState(false);

  /* 压缩状态 */
  const [isCompressing, setIsCompressing] = useState(false);
  const [compressionSaved, setCompressionSaved] = useState(0);

  /* 完成动画 */
  const [showCompletionAnim, setShowCompletionAnim] = useState(false);

  /* 异步 insights 轮询 */
  const [insightsPollingId, setInsightsPollingId] = useState<number | null>(null);

  /* tRPC */
  const correctBatchMutation = trpc.homework.correctBatch.useMutation();
  const { data: correctionHistory } = trpc.homework.getList.useQuery({ limit: 10 });
  const { data: pricingConfigs } = trpc.homework.getPublicPricing.useQuery();

  /* 轮询异步 insights（思维导图 + 学习建议） */
  const { data: insightsData } = trpc.homework.getInsights.useQuery(
    { id: insightsPollingId! },
    {
      enabled: insightsPollingId !== null,
      refetchInterval: (query) => {
        // 已获取到数据就停止轮询
        if (query.state.data?.ready) return false;
        return 3000; // 每 3 秒轮询一次
      },
    },
  );

  // insights 到达后合并到 correctionResult
  useEffect(() => {
    if (insightsData?.ready && correctionResult && insightsPollingId !== null) {
      setCorrectionResult((prev: any) => ({
        ...prev,
        mindMap: insightsData.mindMap,
        studySuggestions: insightsData.studySuggestions,
        insightsGenerating: false,
      }));
      setInsightsPollingId(null); // 停止轮询
    }
  }, [insightsData, insightsPollingId]);

  // ★ 刷新恢复：页面加载后，如果没有当前批改结果且有历史记录，自动显示最近一次
  const autoLoadedRef = useRef(false);
  useEffect(() => {
    if (autoLoadedRef.current) return;
    if (correctionResult) return; // 已有结果（刚完成批改），不覆盖
    if (!correctionHistory || correctionHistory.length === 0) return;
    autoLoadedRef.current = true;
    const latest = correctionHistory[0];
    setCorrectionResult({
      correctionId: latest.id,
      totalQuestions: latest.totalQuestions,
      correctCount: latest.correctCount,
      wrongCount: latest.wrongCount ?? (latest.totalQuestions - latest.correctCount),
      accuracy: typeof latest.accuracy === 'string' ? parseFloat(latest.accuracy) : latest.accuracy,
      scoreLevel: latest.scoreLevel,
      summary: latest.summary,
      correctionResults: latest.correctionResult,
      imageUrls: Array.isArray(latest.imageUrls) ? JSON.stringify(latest.imageUrls) : latest.imageUrls,
      mindMap: latest.mindMap || null,
      studySuggestions: latest.studySuggestions || null,
      insightsGenerating: false,
    });
  }, [correctionHistory, correctionResult]);

  const SUBJECTS = [
    { value: "math", label: t("homework.subjects.math") },
    { value: "chinese", label: t("homework.subjects.chinese") },
    { value: "english", label: t("homework.subjects.english") },
    { value: "physics", label: t("homework.subjects.physics") },
    { value: "chemistry", label: t("homework.subjects.chemistry") },
    { value: "other", label: t("homework.subjects.other") },
  ];

  /* 保存配置 */
  useEffect(() => {
    savePrefs(subject, grade);
  }, [subject, grade]);

  /* ── 图片处理 ─────────────────────────────────── */

  const processFiles = useCallback(async (files: File[]) => {
    const imageFiles = files.filter((f) => f.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const remaining = 10 - images.length;
    if (remaining <= 0) {
      toast({ title: t("homework.errors.fileLimitExceeded"), description: t("homework.errors.maxTenImages"), variant: "destructive" });
      return;
    }

    const toAdd = imageFiles.slice(0, remaining);
    if (imageFiles.length > remaining) {
      toast({ title: t("homework.errors.fileLimitExceeded"), description: t("homework.errors.maxTenImages"), variant: "destructive" });
    }

    setIsCompressing(true);
    let totalOriginal = 0;
    let totalCompressed = 0;

    const newItems: ImageItem[] = [];
    for (const file of toAdd) {
      const compressed = await compressImage(file);
      totalOriginal += file.size;
      totalCompressed += compressed.size;
      newItems.push({
        file,
        preview: URL.createObjectURL(file),
        compressed: compressed !== file ? compressed : undefined,
        compressedSize: compressed.size,
        originalSize: file.size,
      });
    }

    setIsCompressing(false);
    const savedPercent = totalOriginal > 0 ? Math.round((1 - totalCompressed / totalOriginal) * 100) : 0;
    if (savedPercent > 5) {
      setCompressionSaved(savedPercent);
      toast({ title: t("homework.compressComplete", { saved: savedPercent }) });
    }

    setImages((prev) => [...prev, ...newItems]);
  }, [images.length, t, toast]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    e.target.value = "";
  }, [processFiles]);

  const handleRemoveImage = useCallback((index: number) => {
    setImages((prev) => {
      const removed = prev[index];
      if (removed?.preview) URL.revokeObjectURL(removed.preview);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const handleImagePreview = useCallback((index: number) => {
    const img = images[index];
    if (img?.preview) window.open(img.preview, "_blank");
  }, [images]);

  /* 图片排序 */
  const handleReorderImages = useCallback((fromIndex: number, toIndex: number) => {
    setImages((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  /* ── 拖拽上传 ─────────────────────────────────── */

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files);
    processFiles(files);
  }, [processFiles]);

  /* ── 费用确认 & 提交 ─────────────────────────── */

  const handleSubmitClick = useCallback(() => {
    if (images.length === 0) {
      toast({ title: t("homework.errors.selectImages"), description: t("homework.errors.uploadAtLeastOne"), variant: "destructive" });
      return;
    }
    const defaultCost = 5;
    const costPerImage = pricingConfigs?.length ? parseFloat((pricingConfigs[0] as any).pricePerCorrection || "5") : defaultCost;
    const totalCost = images.length * costPerImage;
    setEstimatedCost(totalCost);
    setShowCostDialog(true);
  }, [images.length, pricingConfigs, t, toast]);

  const handleConfirmSubmit = useCallback(async () => {
    setShowCostDialog(false);
    const totalImages = images.length;

    try {
      /* Step 1: 上传 */
      setProgress({ step: "uploading", current: 0, total: totalImages, percent: 5 });
      const imageUrls: string[] = [];
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const fileToUpload = img.compressed || img.file;
        const formData = new FormData();
        formData.append("file", fileToUpload);
        const token = localStorage.getItem("auth_token");
        const response = await fetch("/api/upload", {
          method: "POST", body: formData, credentials: "include",
          headers: token ? { Authorization: "Bearer " + token } : {},
        });
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData.error || t("homework.errors.uploadFailed"));
        }
        const { url } = await response.json();
        imageUrls.push(url);
        setProgress({
          step: "uploading",
          current: i + 1,
          total: totalImages,
          percent: 5 + Math.round(((i + 1) / totalImages) * 25),
        });
      }

      /* Step 2: 批改 (OCR + 分析) */
      setProgress({ step: "correcting", current: 0, total: totalImages, percent: 35 });

      // 模拟中间进度（实际批改在后端执行）
      const progressInterval = setInterval(() => {
        setProgress((prev) => {
          if (prev.percent >= 80) { clearInterval(progressInterval); return prev; }
          return { ...prev, percent: prev.percent + 2 };
        });
      }, 1500);

      const result = await correctBatchMutation.mutateAsync({
        imageUrls,
        subject: subject as any,
        grade: grade || undefined,
        title: title || undefined,
      });

      clearInterval(progressInterval);

      /* Step 3: 生成报告 */
      setProgress({ step: "generating", current: 0, total: 1, percent: 90 });
      await new Promise((r) => setTimeout(r, 500));

      /* Step 4: 完成 */
      setProgress({ step: "complete", current: result.totalQuestions, total: result.totalQuestions, percent: 100 });

      setCorrectionResult(result);
      // 启动 insights 轮询（思维导图+学习建议在后台生成）
      if (result.insightsGenerating && result.correctionId) {
        setInsightsPollingId(result.correctionId);
      }
      setShowCompletionAnim(true);
      setTimeout(() => setShowCompletionAnim(false), 3000);

      toast({
        title: t("homework.gradingComplete"),
        description: t("homework.completeNotice.description", { total: result.totalQuestions, accuracy: result.accuracy }),
      });

      images.forEach((img) => URL.revokeObjectURL(img.preview));
      setImages([]);
      setTitle("");

      setTimeout(() => {
        setProgress({ step: "idle", current: 0, total: 0, percent: 0 });
      }, 2000);
    } catch (error: any) {
      toast({ title: t("homework.errors.gradingFailed"), description: error.message || t("homework.errors.gradingError"), variant: "destructive" });
      setProgress({ step: "idle", current: 0, total: 0, percent: 0 });
    }
  }, [images, subject, grade, title, correctBatchMutation, t, toast]);

  /* ── 用户纠错 ─────────────────────────────────── */

  const handleReportError = useCallback((imageIndex: number, questionIndex: number, isActuallyCorrect: boolean) => {
    if (!correctionResult) return;
    const updated = { ...correctionResult };
    const results = [...(updated.correctionResults || [])];
    const imgResult = { ...results[imageIndex] };
    const questions = [...(imgResult.questions || [])];
    const q = { ...questions[questionIndex] };

    q.isCorrect = isActuallyCorrect;
    q._userCorrected = true;
    questions[questionIndex] = q;
    imgResult.questions = questions;
    results[imageIndex] = imgResult;
    updated.correctionResults = results;

    let correct = 0, wrong = 0, total = 0;
    results.forEach((r: any) => {
      (r.questions || []).forEach((qq: any) => {
        total++;
        if (qq.isCorrect) correct++; else wrong++;
      });
    });
    updated.correctCount = correct;
    updated.wrongCount = wrong;
    updated.totalQuestions = total;
    updated.accuracy = total > 0 ? parseFloat(((correct / total) * 100).toFixed(2)) : 0;

    setCorrectionResult(updated);
    toast({ title: t("homework.results.reportAiErrorSuccess") });
  }, [correctionResult, t, toast]);

  /* ── 便利属性 ─────────────────────────────────── */

  const isProcessing = progress.step !== "idle" && progress.step !== "complete";
  const selectedFiles = images.map((i) => i.compressed || i.file);

  return {
    images, selectedFiles, isCompressing, compressionSaved,
    isDragOver, handleDragOver, handleDragLeave, handleDrop,
    subject, setSubject, grade, setGrade, title, setTitle, SUBJECTS,
    progress, isProcessing,
    showCostDialog, setShowCostDialog, estimatedCost,
    showCompletionAnim,
    correctionResult, setCorrectionResult, correctionHistory, pricingConfigs,
    handleFileSelect, handleRemoveImage, handleImagePreview,
    handleReorderImages, handleSubmitClick, handleConfirmSubmit, handleReportError,
  };
}
