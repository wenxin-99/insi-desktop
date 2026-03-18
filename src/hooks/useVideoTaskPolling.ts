import { useEffect, useRef, useState } from "react";
import { trpc } from "@/lib/trpc";

interface VideoTask {
  id: number;
  status: string;
  progress: number;
  videoUrl?: string;
  error?: string;
}

export function useVideoTaskPolling(taskId: number | null, onComplete?: (task: VideoTask) => void) {
  const [task, setTask] = useState<VideoTask | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const completedRef = useRef(false);

  const { refetch } = trpc.videos.getTaskStatus.useQuery(
    { taskId: taskId! },
    {
      enabled: false, // 手动触发查询
    }
  );

  useEffect(() => {
    if (!taskId || completedRef.current) {
      return;
    }

    setIsPolling(true);

    const pollTask = async () => {
      try {
        const result = await refetch();
        if (result.data) {
          const taskData = result.data as VideoTask;
          setTask(taskData);

          // 如果任务完成或失败，停止轮询
          if (taskData.status === "completed" || taskData.status === "failed") {
            setIsPolling(false);
            completedRef.current = true;
            
            if (intervalRef.current) {
              clearInterval(intervalRef.current);
              intervalRef.current = null;
            }

            if (onComplete) {
              onComplete(taskData);
            }
          }
        }
      } catch (error) {
        console.error("轮询视频任务状态失败:", error);
      }
    };

    // 立即执行一次
    pollTask();

    // 每3秒轮询一次
    intervalRef.current = setInterval(pollTask, 3000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [taskId, refetch, onComplete]);

  return { task, isPolling };
}
