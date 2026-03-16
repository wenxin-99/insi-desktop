/**
 * homeworkHistory/DetailDialog — 批改记录详情对话框
 *
 * ★ 升级：使用 CorrectionResultPanel 展示完整批改结果（饼图、详细批改、思维导图等）
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { SUBJECT_MAP, SCORE_LEVEL_MAP } from "./useHomeworkHistory";
import { CorrectionResultPanel } from "../homeworkCorrection/CorrectionResultPanel";

interface DetailDialogProps {
  correction: any;
  onClose: () => void;
}

export function DetailDialog({ correction, onClose }: DetailDialogProps) {
  if (!correction) return null;

  const scoreLevel = SCORE_LEVEL_MAP[correction.scoreLevel as keyof typeof SCORE_LEVEL_MAP];

  // ★ 将 getList 返回的字段映射为 CorrectionResultPanel 期望的格式
  const mappedResult = {
    correctionId: correction.id,
    totalQuestions: correction.totalQuestions,
    correctCount: correction.correctCount,
    wrongCount: correction.wrongCount ?? (correction.totalQuestions - correction.correctCount),
    accuracy: typeof correction.accuracy === 'string' ? parseFloat(correction.accuracy) : correction.accuracy,
    scoreLevel: correction.scoreLevel,
    summary: correction.summary,
    // ★ 核心：correctionResult（单数）→ correctionResults（复数）
    correctionResults: correction.correctionResult,
    // ★ 如果已是数组则重新 stringify，因为面板内部会再 JSON.parse
    imageUrls: Array.isArray(correction.imageUrls) ? JSON.stringify(correction.imageUrls) : correction.imageUrls,
    mindMap: correction.mindMap || null,
    studySuggestions: correction.studySuggestions || null,
    insightsGenerating: false,
  };

  return (
    <Dialog open={!!correction} onOpenChange={() => onClose()}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-4xl max-h-[85vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <DialogTitle className="text-base sm:text-lg">{correction.title}</DialogTitle>
            {scoreLevel && (
              <Badge className={scoreLevel.color}>{scoreLevel.label}</Badge>
            )}
          </div>
          <DialogDescription>
            {SUBJECT_MAP[correction.subject] || correction.subject} · 批改时间：{new Date(correction.createdAt).toLocaleString("zh-CN")}
          </DialogDescription>
        </DialogHeader>

        {/* ★ 使用完整的批改结果面板，展示饼图、详细批改、思维导图等 */}
        <CorrectionResultPanel result={mappedResult} />
      </DialogContent>
    </Dialog>
  );
}
