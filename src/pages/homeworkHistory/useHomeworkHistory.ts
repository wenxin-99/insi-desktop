/**
 * homeworkHistory/useHomeworkHistory — 状态管理与业务逻辑
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { shareOrCopy } from "@/utils/clipboard";

export const SUBJECT_MAP: Record<string, string> = {
  math: "数学", chinese: "语文", english: "英语",
  physics: "物理", chemistry: "化学", other: "其他",
};

export const SCORE_LEVEL_MAP: Record<string, { label: string; color: string }> = {
  excellent: { label: "优秀", color: "bg-green-500" },
  good: { label: "良好", color: "bg-blue-500" },
  pass: { label: "及格", color: "bg-yellow-500" },
  fail: { label: "不及格", color: "bg-red-500" },
};

/** 检测是否移动端 */
function isMobile(): boolean {
  return /Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

export function useHomeworkHistory() {
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedCorrection, setSelectedCorrection] = useState<any>(null);
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareToken, setShareToken] = useState<string>("");
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPreviewTitle, setPdfPreviewTitle] = useState<string>("");
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [pdfProgress, setPdfProgress] = useState<{ correctionId: number; progress: number; stage: string } | null>(null);

  const { data: corrections, isLoading, refetch } = trpc.homework.getList.useQuery({ limit: 50 });
  const deleteMutation = trpc.homework.delete.useMutation({
    onSuccess: () => { toast.success("删除成功"); refetch(); },
    onError: (error) => toast.error(`删除失败：${error.message}`),
  });

  const createShareMutation = trpc.correctionShare.create.useMutation({
    onSuccess: (data) => { setShareToken(data.shareToken); setShareDialogOpen(true); toast.success("分享链接已生成"); },
    onError: (error) => toast.error(`生成分享链接失败：${error.message}`),
  });

  const generatePDFMutation = trpc.homework.generatePDF.useMutation();
  const generateErrorsPDFMutation = trpc.homework.generateErrorsPDF.useMutation();
  const generateMindMapPDFMutation = trpc.homework.generateMindMapPDF.useMutation();

  const filteredCorrections = corrections?.filter((c) => selectedSubject === "all" || c.subject === selectedSubject) || [];

  const handleDelete = (id: number) => {
    if (confirm("确定要删除这条批改记录吗？")) deleteMutation.mutate({ id });
  };

  const handleShare = (correctionId: number, title: string) => {
    createShareMutation.mutate({ correctionId, shareTitle: title });
  };

  const handleExportPDF = async (correction: any, preview: boolean = false) => {
    try {
      setPdfProgress({ correctionId: correction.id, progress: 10, stage: "正在生成PDF..." });
      const result = await generatePDFMutation.mutateAsync({ id: correction.id });
      setPdfProgress({ correctionId: correction.id, progress: 100, stage: "完成" });
      setTimeout(() => setPdfProgress(null), 1000);
      if (preview || isMobile()) {
        // 移动端也走预览弹窗，让用户手动点下载（避免 window.open 被拦截）
        setPdfPreviewUrl(result.url);
        setPdfPreviewTitle(`作业批改报告-${correction.title || "未命名"}`);
        setPdfPreviewOpen(true);
      } else {
        const link = document.createElement("a");
        link.href = result.url; link.download = `作业批改报告-${correction.title || "未命名"}.pdf`;
        link.target = "_blank"; link.rel = "noopener noreferrer";
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        toast.success("批改报告PDF已生成");
      }
    } catch { toast.error("导出PDF失败，请重试"); setPdfProgress(null); }
  };

  const handleExportMindMapPDF = async (correction: any) => {
    if (!correction.mindMap) { toast.error("该作业没有思维导图"); return; }
    try {
      setPdfProgress({ correctionId: correction.id, progress: 0, stage: "正在生成思维导图PDF..." });
      const result = await generateMindMapPDFMutation.mutateAsync({ id: correction.id });
      setPdfProgress({ correctionId: correction.id, progress: 100, stage: "完成" });

      // 移动端使用预览弹窗，桌面端打开新标签
      if (isMobile()) {
        setPdfPreviewUrl(result.url);
        setPdfPreviewTitle(`${correction.title}-思维导图`);
        setPdfPreviewOpen(true);
      } else {
        window.open(result.url, "_blank");
      }
      toast.success("思维导图PDF已生成");
      setTimeout(() => setPdfProgress(null), 2000);
    } catch (error: any) { toast.error(error.message || "导出PDF失败，请重试"); setPdfProgress(null); }
  };

  const handleExportWrongQuestionsPDF = async (correction: any) => {
    try {
      setPdfProgress({ correctionId: correction.id, progress: 0, stage: "正在生成错题本PDF..." });
      const result = await generateErrorsPDFMutation.mutateAsync({ id: correction.id });
      setPdfProgress({ correctionId: correction.id, progress: 100, stage: "完成" });

      if (isMobile()) {
        setPdfPreviewUrl(result.url);
        setPdfPreviewTitle(`${correction.title}-错题本`);
        setPdfPreviewOpen(true);
      } else {
        window.open(result.url, "_blank");
      }
      toast.success("错题本PDF已生成");
      setTimeout(() => setPdfProgress(null), 2000);
    } catch (error: any) { toast.error(error.message || "导出PDF失败，请重试"); setPdfProgress(null); }
  };

  const handlePrintPDF = async (correction: any) => {
    try {
      setPdfProgress({ correctionId: correction.id, progress: 10, stage: "正在生成PDF..." });
      const result = await generatePDFMutation.mutateAsync({ id: correction.id });
      setPdfProgress({ correctionId: correction.id, progress: 100, stage: "完成" });
      setTimeout(() => setPdfProgress(null), 1000);

      if (isMobile()) {
        setPdfPreviewUrl(result.url);
        setPdfPreviewTitle(`作业批改报告-${correction.title || "未命名"}`);
        setPdfPreviewOpen(true);
        toast.success("PDF已生成，请在预览中下载");
      } else {
        window.open(result.url, "_blank");
        toast.success("批改报告PDF已在新窗口打开，可以使用浏览器打印功能");
      }
    } catch { toast.error("生成PDF失败"); setPdfProgress(null); }
  };

  // ★ iOS 上优先使用原生分享面板（最可靠），桌面端走剪贴板
  const copyShareLink = async () => {
    const link = `${window.location.origin}/share/${shareToken}`;
    if (!shareToken) {
      toast.error("分享链接尚未生成，请稍候");
      return;
    }
    const result = await shareOrCopy({
      url: link,
      title: "批改报告分享",
      text: "查看我的作业批改报告",
    });
    if (result === "shared") {
      toast.success("已分享");
    } else if (result === "copied") {
      toast.success("链接已复制到剪贴板");
    } else {
      toast.info("请手动复制链接", { description: link, duration: 10000 });
    }
  };

  return {
    selectedSubject, setSelectedSubject,
    selectedCorrection, setSelectedCorrection,
    shareDialogOpen, setShareDialogOpen, shareToken,
    pdfPreviewOpen, setPdfPreviewOpen, pdfPreviewUrl, pdfPreviewTitle,
    settingsDialogOpen, setSettingsDialogOpen,
    pdfProgress, isLoading, filteredCorrections,
    handleDelete, handleShare, handleExportPDF,
    handleExportMindMapPDF, handleExportWrongQuestionsPDF, handlePrintPDF,
    copyShareLink,
  };
}
