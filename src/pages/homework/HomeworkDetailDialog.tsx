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

export function HomeworkDetailDialog(props: any) {
  return (
    <>
      {/* 详情对话框 */}
      {selectedCorrection && (
        <Dialog open={!!selectedCorrection} onOpenChange={() => setSelectedCorrection(null)}>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedCorrection.title}</DialogTitle>
              <DialogDescription>
                批改时间：{new Date(selectedCorrection.createdAt).toLocaleString('zh-CN')}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              {/* 基本信息 */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
                <div>
                  <span className="text-sm text-muted-foreground">科目：</span>
                  <span className="ml-2 font-semibold">{subjectMap[selectedCorrection.subject]}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">正确率：</span>
                  <span className="ml-2 font-semibold text-green-600">{selectedCorrection.accuracy}%</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">正确题数：</span>
                  <span className="ml-2 font-semibold">{selectedCorrection.correctCount}/{selectedCorrection.totalQuestions}</span>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">得分：</span>
                  <span className="ml-2 font-semibold">{selectedCorrection.accuracy}分</span>
                </div>
              </div>

              {/* 作业图片 */}
              <div>
                <h3 className="font-semibold mb-2">作业图片</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedCorrection.imageUrls.map((url: string, index: number) => (
                    <img
                      key={index}
                      src={url}
                      alt={`作业图片 ${index + 1}`}
                      className="w-full rounded-lg border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() => window.open(url, '_blank')}
                    />
                  ))}
                </div>
              </div>

              {/* AI总结 */}
              {selectedCorrection.summary && (
                <div>
                  <h3 className="font-semibold mb-2">AI总结</h3>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedCorrection.summary}
                  </p>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}