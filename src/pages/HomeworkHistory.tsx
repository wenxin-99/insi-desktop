/**
 * HomeworkHistory — 批改历史页面
 *
 * 拆分自原 565 行。子模块：
 *   homeworkHistory/useHomeworkHistory.ts - 状态管理 + PDF 导出 + 分享逻辑
 *   homeworkHistory/CorrectionCard.tsx    - 批改记录卡片（桌面+移动端按钮组）
 *   homeworkHistory/DetailDialog.tsx      - 批改详情对话框
 *   homeworkHistory/ShareDialog.tsx       - 分享链接对话框
 */
import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, BookOpen, Settings } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { ScrollIndicator } from "@/components/ScrollIndicator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { PdfExportSettingsDialog } from "@/components/PdfExportSettingsDialog";
import { useHomeworkHistory, SUBJECT_MAP } from "./homeworkHistory/useHomeworkHistory";
import { CorrectionCard } from "./homeworkHistory/CorrectionCard";
import { DetailDialog } from "./homeworkHistory/DetailDialog";
import { ShareDialog } from "./homeworkHistory/ShareDialog";

export default function HomeworkHistory() {
  const [, setLocation] = useLocation();
  const mainContainerRef = useRef<HTMLDivElement>(null);
  const h = useHomeworkHistory();

  if (h.isLoading) {
    return (
      <div className="container max-w-6xl py-8">
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div ref={mainContainerRef} className="container max-w-6xl py-4 md:py-8 px-4 overflow-y-auto max-h-screen">
      <ScrollIndicator containerRef={mainContainerRef} />

      {/* 页面标题 */}
      <div className="flex items-center justify-between gap-3 md:gap-4 mb-6 md:mb-8">
        <div className="flex items-center gap-3 md:gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold">批改历史</h1>
            <p className="text-sm md:text-base text-muted-foreground mt-1">查看和管理您的作业批改记录</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => h.setSettingsDialogOpen(true)} className="gap-2">
          <Settings className="h-4 w-4" />
          <span className="hidden md:inline">PDF设置</span>
        </Button>
      </div>

      {/* 筛选器 */}
      <div className="flex gap-2 md:gap-4 mb-4 md:mb-6">
        <Select value={h.selectedSubject} onValueChange={h.setSelectedSubject}>
          <SelectTrigger className="w-full md:w-48"><SelectValue placeholder="选择科目" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部科目</SelectItem>
            {Object.entries(SUBJECT_MAP).map(([key, label]) => (
              <SelectItem key={key} value={key}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* 列表 */}
      {h.filteredCorrections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">暂无批改记录</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {h.filteredCorrections.map((correction) => (
            <CorrectionCard
              key={correction.id}
              correction={correction}
              onView={() => h.setSelectedCorrection(correction)}
              onPreviewPDF={() => h.handleExportPDF(correction, true)}
              onPrintPDF={() => h.handlePrintPDF(correction)}
              onExportWrongQuestions={() => h.handleExportWrongQuestionsPDF(correction)}
              onExportMindMap={() => h.handleExportMindMapPDF(correction)}
              onShare={() => h.handleShare(correction.id, correction.title)}
              onDelete={() => h.handleDelete(correction.id)}
            />
          ))}
        </div>
      )}

      {/* 对话框 */}
      <DetailDialog correction={h.selectedCorrection} onClose={() => h.setSelectedCorrection(null)} />
      <ShareDialog open={h.shareDialogOpen} onOpenChange={h.setShareDialogOpen} shareToken={h.shareToken} onCopyLink={h.copyShareLink} />

      {/* PDF 进度条 */}
      {h.pdfProgress && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-80 border">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">生成PDF</span>
              <span className="text-sm text-muted-foreground">{h.pdfProgress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `${h.pdfProgress.progress}%` }} />
            </div>
            <p className="text-xs text-muted-foreground">{h.pdfProgress.stage}</p>
          </div>
        </div>
      )}

      <PdfPreviewDialog open={h.pdfPreviewOpen} onOpenChange={h.setPdfPreviewOpen} pdfUrl={h.pdfPreviewUrl} title={h.pdfPreviewTitle} />
      <PdfExportSettingsDialog open={h.settingsDialogOpen} onOpenChange={h.setSettingsDialogOpen} />
    </div>
  );
}
