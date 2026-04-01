import { useState } from "react";
import { useVideoTaskPolling } from "@/hooks/useVideoTaskPolling";
import { Loader2, CheckCircle, XCircle, Video } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { VideoPlayer } from "@/components/VideoPlayer";

interface VideoTaskProgressProps {
  taskId: number;
  prompt: string;
  onComplete?: (videoUrl: string) => void;
}

export function VideoTaskProgress({ taskId, prompt, onComplete }: VideoTaskProgressProps) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  
  const { task, isPolling } = useVideoTaskPolling(taskId, (completedTask) => {
    if (completedTask.videoUrl) {
      setVideoUrl(completedTask.videoUrl);
      onComplete?.(completedTask.videoUrl);
    }
  });

  const getStatusText = () => {
    if (!task) return "准备中...";
    
    switch (task.status) {
      case "pending":
        return "等待处理...";
      case "processing":
        return "正在生成视频...";
      case "completed":
        return "生成完成！";
      case "failed":
        return "生成失败";
      default:
        return "未知状态";
    }
  };

  const getStatusIcon = () => {
    if (!task) {
      return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
    }

    switch (task.status) {
      case "pending":
      case "processing":
        return <Loader2 className="w-5 h-5 animate-spin text-blue-500" />;
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Video className="w-5 h-5 text-gray-500" />;
    }
  };

  return (
    <div className="my-4 p-4 border rounded-lg bg-card">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-1">
          {getStatusIcon()}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-sm">视频生成任务</h4>
            <span className="text-xs text-muted-foreground">
              任务ID: {taskId}
            </span>
          </div>

          <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
            {prompt}
          </p>

          {task && (task.status === "pending" || task.status === "processing") && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span>{getStatusText()}</span>
                <span>{task.progress}%</span>
              </div>
              <Progress value={task.progress} className="h-2" />
            </div>
          )}

          {task?.status === "completed" && videoUrl && (
            <div className="mt-3">
              <VideoPlayer
                src={videoUrl}
                poster={videoUrl.replace(/\.(mp4|webm)$/, "-thumbnail.jpg")}
                className="max-h-96"
              />
            </div>
          )}

          {task?.status === "failed" && (
            <div className="mt-2 p-2 bg-destructive/10 text-destructive text-sm rounded">
              {task.error || "视频生成失败，请重试"}
            </div>
          )}

          {task?.status === "completed" && !videoUrl && (
            <div className="mt-2 text-sm text-muted-foreground">
              视频已生成，请前往"视频历史"页面查看
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
