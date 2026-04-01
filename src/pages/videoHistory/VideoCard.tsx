/**
 * videoHistory/VideoCard — 视频任务卡片
 */
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Video, Download, Loader2, CheckCircle2, XCircle, Clock, Star, StarOff, Trash2 } from "lucide-react";
import { formatRelativeTime } from "@/lib/timeUtils";
import { useTranslation } from "react-i18next";
import { calculateProgress, getEstimatedTime } from "./useVideoHistory";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "pending": return <Clock className="h-4 w-4 text-yellow-600" />;
    case "processing": return <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />;
    case "completed": return <CheckCircle2 className="h-4 w-4 text-green-600" />;
    case "failed": return <XCircle className="h-4 w-4 text-red-600" />;
    default: return <Video className="h-4 w-4 text-gray-600" />;
  }
}

interface VideoCardProps {
  video: any;
  isSelected: boolean;
  onToggleSelect: (checked: boolean) => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
  onDownload: () => void;
}

export function VideoCard({ video, isSelected, onToggleSelect, onToggleFavorite, onDelete, onDownload }: VideoCardProps) {
  const { t } = useTranslation();

  const statusTextMap: Record<string, string> = {
    pending: t("videoHistory.status.pending"),
    processing: t("videoHistory.status.processing"),
    completed: t("videoHistory.status.completed"),
    failed: t("videoHistory.status.failed"),
  };

  return (
    <Card className="p-4 space-y-3 relative">
      {/* 批量选择复选框 */}
      {video.status === "completed" && video.videoUrl && (
        <div className="absolute top-2 left-2 z-10">
          <Checkbox checked={isSelected} onCheckedChange={onToggleSelect} />
        </div>
      )}

      {/* 标题和状态 */}
      <div className="flex items-start justify-between gap-2 ml-8">
        <div className="flex items-center gap-2 flex-1">
          <StatusIcon status={video.status} />
          <div className="flex-1">
            <div className="font-medium text-sm">{t("videoHistory.task")} #{video.id}</div>
            <div className="text-xs text-muted-foreground">{statusTextMap[video.status] || t("videoHistory.status.unknown")}</div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={onToggleFavorite}>
            {(video as any).isFavorite
              ? <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              : <StarOff className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={onDelete} title="删除">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* 描述 */}
      <div className="text-sm text-muted-foreground line-clamp-2">{video.prompt}</div>

      {/* 进度条 */}
      {(video.status === "pending" || video.status === "processing") && (
        <div className="space-y-2">
          <Progress value={calculateProgress(video.status, video.createdAt)} className="h-2" />
          <div className="text-xs text-muted-foreground">{getEstimatedTime(video.status, video.createdAt, t)}</div>
        </div>
      )}

      {/* 视频预览 */}
      {video.status === "completed" && video.videoUrl && (
        <div className="space-y-2">
          <video src={video.videoUrl} controls className="w-full rounded-md bg-black" style={{ maxHeight: "200px" }}>
            您的浏览器不支持视频播放
          </video>
          <Button variant="outline" size="sm" className="w-full" onClick={onDownload}>
            <Download className="mr-2 h-4 w-4" /> 下载视频
          </Button>
        </div>
      )}

      {/* 错误信息 */}
      {video.status === "failed" && video.errorMessage && (
        <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{video.errorMessage}</div>
      )}

      {/* 任务信息 */}
      <div className="text-xs text-muted-foreground space-y-1">
        <div>服务商: {video.provider}</div>
        <div>时长: {video.duration}秒</div>
        <div>创建时间: {formatRelativeTime(new Date(video.createdAt).getTime())}</div>
      </div>
    </Card>
  );
}
