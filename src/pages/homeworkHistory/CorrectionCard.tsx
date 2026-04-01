/**
 * homeworkHistory/CorrectionCard — 批改记录卡片（含桌面端/移动端按钮组）
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Eye, Trash2, Share2, Download, Calendar, BookOpen, FileText, Printer } from "lucide-react";
import { SUBJECT_MAP, SCORE_LEVEL_MAP } from "./useHomeworkHistory";

interface CorrectionCardProps {
  correction: any;
  onView: () => void;
  onPreviewPDF: () => void;
  onPrintPDF: () => void;
  onExportWrongQuestions: () => void;
  onExportMindMap: () => void;
  onShare: () => void;
  onDelete: () => void;
}

export function CorrectionCard({
  correction, onView, onPreviewPDF, onPrintPDF,
  onExportWrongQuestions, onExportMindMap, onShare, onDelete,
}: CorrectionCardProps) {
  const scoreLevel = SCORE_LEVEL_MAP[correction.scoreLevel as keyof typeof SCORE_LEVEL_MAP];

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2 flex-wrap">
              <CardTitle className="text-lg md:text-xl">{correction.title}</CardTitle>
              {scoreLevel && <Badge className={scoreLevel.color}>{scoreLevel.label}</Badge>}
            </div>
            <CardDescription className="flex flex-col md:flex-row md:items-center gap-2 md:gap-4 text-xs md:text-sm">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 md:h-4 md:w-4" />
                {new Date(correction.createdAt).toLocaleString("zh-CN")}
              </span>
              <span className="flex items-center gap-1">
                <BookOpen className="h-3 w-3 md:h-4 md:w-4" />
                {SUBJECT_MAP[correction.subject] || correction.subject}
              </span>
              <span className="flex items-center gap-1">
                <FileText className="h-3 w-3 md:h-4 md:w-4" />
                {correction.totalQuestions} 道题
              </span>
            </CardDescription>
          </div>
          {/* 桌面端按钮组 */}
          <div className="hidden md:flex gap-2">
            <Button variant="outline" size="sm" onClick={onView}><Eye className="h-4 w-4 mr-1" />查看</Button>
            <Button variant="outline" size="sm" onClick={onPreviewPDF}><Eye className="h-4 w-4 mr-1" />预览PDF</Button>
            <Button variant="outline" size="sm" onClick={onPrintPDF}><Printer className="h-4 w-4 mr-1" />打印报告</Button>
            <Button variant="outline" size="sm" onClick={onExportWrongQuestions}><Download className="h-4 w-4 mr-1" />错题本</Button>
            <Button variant="outline" size="sm" onClick={onExportMindMap} disabled={!correction.mindMap}><Download className="h-4 w-4 mr-1" />思维导图</Button>
            <Button variant="outline" size="sm" onClick={onShare}><Share2 className="h-4 w-4 mr-1" />分享</Button>
            <Button variant="destructive" size="sm" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" />删除</Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-3 gap-2 md:gap-4 text-xs md:text-sm mb-3">
          <div><span className="text-muted-foreground">正确率：</span><span className="font-semibold text-green-600 ml-1 md:ml-2">{correction.accuracy}%</span></div>
          <div><span className="text-muted-foreground">正确题数：</span><span className="font-semibold ml-1 md:ml-2">{correction.correctCount}/{correction.totalQuestions}</span></div>
          <div><span className="text-muted-foreground">得分：</span><span className="font-semibold ml-1 md:ml-2">{correction.accuracy}分</span></div>
        </div>
        {/* 移动端按钮组 */}
        <div className="md:hidden space-y-2">
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onView}><Eye className="h-4 w-4 mr-1" />查看</Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onPreviewPDF}><Eye className="h-4 w-4 mr-1" />报告</Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onShare}><Share2 className="h-4 w-4 mr-1" />分享</Button>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" className="flex-1" onClick={onExportWrongQuestions}><Download className="h-4 w-4 mr-1" />错题</Button>
            <Button variant="outline" size="sm" className="flex-1" onClick={onExportMindMap} disabled={!correction.mindMap}><Download className="h-4 w-4 mr-1" />导图</Button>
            <Button variant="destructive" size="sm" className="flex-1" onClick={onDelete}><Trash2 className="h-4 w-4 mr-1" />删除</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
