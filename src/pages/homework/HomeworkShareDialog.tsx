import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Eye, Trash2, Share2, Download, Calendar, BookOpen, FileText, MoreVertical, Printer } from "lucide-react";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { useAuth } from "@/_core/hooks/useAuth";
import { ScrollIndicator } from "@/components/ScrollIndicator";
import { PdfPreviewDialog } from "@/components/PdfPreviewDialog";
import { PdfExportSettingsDialog } from "@/components/PdfExportSettingsDialog";
import { Settings } from "lucide-react";
// 已移除前端PDF生成，使用后端接口

export function HomeworkShareDialog(props: any) {
  return (
    <>
      {/* 分享对话框 */}
      <Dialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>分享批改报告</DialogTitle>
            <DialogDescription>
              复制下方链接分享给家长或老师
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="p-4 bg-muted rounded-lg break-all text-sm">
              {window.location.origin}/share/{shareToken}
            </div>
            <Button onClick={copyShareLink} className="w-full">
              复制链接
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PDF生成进度条 */}
      {pdfProgress && (
        <div className="fixed bottom-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 w-80 border">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">生成PDF</span>
              <span className="text-sm text-muted-foreground">{pdfProgress.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
              <div 
                className="bg-primary h-2 rounded-full transition-all duration-300"
                style={{ width: `${pdfProgress.progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">{pdfProgress.stage}</p>
          </div>
        </div>
      )}

      {/* PDF预览对话框 */}
      <PdfPreviewDialog
        open={pdfPreviewOpen}
        onOpenChange={setPdfPreviewOpen}
        pdfUrl={pdfPreviewUrl}
        title={pdfPreviewTitle}
        onDownload={() => {
          if (pdfPreviewUrl) {
            const link = document.createElement('a');
            link.href = pdfPreviewUrl;
            link.download = `${pdfPreviewTitle}.pdf`;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
          }
        }}
      />

    </>
  );
}