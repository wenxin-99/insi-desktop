import { Button } from "@/components/ui/button";
import { Download, Loader2, CheckCircle2, XCircle, Clock, Share2, Film, Play, RefreshCw } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { useDownload } from "../hooks/useDownload";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { formatRelativeTime } from "@/lib/timeUtils";

interface VideoTaskCardProps {
  taskId: number;
  prompt: string;
  initialStatus?: string;
}

export function VideoTaskCard({ taskId, prompt, initialStatus = "pending" }: VideoTaskCardProps) {
  const [status, setStatus] = useState(initialStatus);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [estimatedTime, setEstimatedTime] = useState<number | null>(null);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isCreatingShare, setIsCreatingShare] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const createShareMutation = trpc.videos.createShare.useMutation();

  const { data: taskData } = trpc.videos.getTaskStatus.useQuery(
    { taskId },
    {
      enabled: status === "pending" || status === "processing",
      refetchInterval: status === "pending" || status === "processing" ? 5000 : false,
    }
  );

  useEffect(() => {
    if (taskData) {
      setStatus(taskData.status);
      if (taskData.videoUrl) setVideoUrl(taskData.videoUrl);
      if (taskData.errorMessage) setError(taskData.errorMessage);

      if (taskData.progress !== undefined && taskData.progress !== null) {
        setProgress(taskData.progress);
        if (taskData.status === "pending" || taskData.status === "processing") {
          const avgTime = taskData.duration === 10 ? 120 : 60;
          const estimated = Math.ceil(((100 - taskData.progress) / 100) * avgTime);
          setEstimatedTime(estimated > 0 ? estimated : null);
        } else {
          setEstimatedTime(null);
        }
      } else {
        if (taskData.status === "pending") { setProgress(10); setEstimatedTime(taskData.duration === 10 ? 108 : 54); }
        else if (taskData.status === "processing") { setProgress(50); setEstimatedTime(taskData.duration === 10 ? 60 : 30); }
        else if (taskData.status === "completed") { setProgress(100); setEstimatedTime(null); }
        else if (taskData.status === "failed") { setProgress(0); setEstimatedTime(null); }
      }
    }
  }, [taskData]);

  const { download: _dlVideo, isDownloading: _isDling } = useDownload();
  const isDownloading = videoUrl ? _isDling(`/api/video-proxy/download?url=${encodeURIComponent(videoUrl)}&filename=video_${taskId}.mp4`) : false;

  const handleDownload = async () => {
    if (!videoUrl || isDownloading) return;
    const filename = `video_${taskId}.mp4`;
    const proxyUrl = `/api/video-proxy/download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}`;
    await _dlVideo(proxyUrl, {
      filename,
      loadingMsg: '正在下载视频...',
      successMsg: '视频下载成功！',
      errorMsg: '下载失败，请重试',
    });
  };

  const handleShare = async () => {
    const { shareOrCopy, copyToClipboard } = await import('@/utils/clipboard');

    if (shareUrl) {
      const result = await shareOrCopy({ url: shareUrl, title: `AI生成视频 #${taskId}`, text: prompt.substring(0, 100) });
      if (result === 'shared') toast.success("已分享");
      else if (result === 'copied') toast.success("分享链接已复制到剪贴板");
      else toast.info("请手动复制链接", { description: shareUrl, duration: 8000 });
      return;
    }

    setIsCreatingShare(true);
    try {
      const result = await createShareMutation.mutateAsync({ videoId: taskId, expiresInDays: 30 });
      setShareUrl(result.shareUrl);
      const shareResult = await shareOrCopy({ url: result.shareUrl, title: `AI生成视频 #${taskId}`, text: prompt.substring(0, 100) });
      if (shareResult === 'shared') toast.success("已分享");
      else if (shareResult === 'copied') toast.success("分享链接已生成并复制到剪贴板");
      else toast.info("分享链接已生成，请长按复制", { description: result.shareUrl, duration: 10000, action: { label: "复制", onClick: () => copyToClipboard(result.shareUrl) } });
    } catch (err: any) {
      toast.error(err.message || "生成分享链接失败");
    } finally {
      setIsCreatingShare(false);
    }
  };

  const isActive = status === "pending" || status === "processing";

  // ── 进度环 SVG 参数 ──
  const ringR = 28, ringC = 2 * Math.PI * ringR;
  const ringOffset = ringC - (progress / 100) * ringC;

  return (
    <div className="relative max-w-md w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* 活跃态外层光晕 */}
      {isActive && (
        <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-blue-500/25 via-violet-500/15 to-cyan-500/25 blur-[2px] animate-pulse" />
      )}

      <div className="relative rounded-2xl overflow-hidden bg-background border border-border/50 shadow-xl">
        {/* ═══════ 顶部状态条 ═══════ */}
        <div className={`relative h-10 flex items-center px-4 gap-2 overflow-hidden transition-colors ${
          status === 'completed' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' :
          status === 'failed' ? 'bg-gradient-to-r from-red-600 to-rose-600' :
          'bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-600'
        }`}>
          {/* 胶片孔装饰 */}
          <div className="absolute top-0 left-0 right-0 flex justify-between px-2 opacity-10">
            {Array.from({ length: 14 }).map((_, i) => <div key={`t${i}`} className="w-2 h-1 bg-white rounded-sm mt-0.5" />)}
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 opacity-10">
            {Array.from({ length: 14 }).map((_, i) => <div key={`b${i}`} className="w-2 h-1 bg-white rounded-sm mb-0.5" />)}
          </div>

          {status === 'completed' ? <CheckCircle2 className="w-3.5 h-3.5 text-white/90" /> :
           status === 'failed' ? <XCircle className="w-3.5 h-3.5 text-white/90" /> :
           <Film className="w-3.5 h-3.5 text-white/90" />}
          <span className="text-[12px] font-medium text-white">
            {status === 'completed' ? '生成完成' : status === 'failed' ? '生成失败' : status === 'processing' ? '正在生成' : '排队中'}
          </span>
          <span className="text-[10px] text-white/40 font-mono ml-auto">#{taskId}</span>
        </div>

        {/* ═══════ 内容区域 ═══════ */}
        <div className="p-4">
          {/* ── 生成中：进度环 + 文字 ── */}
          {isActive && (
            <div className="flex items-center gap-4 mb-3">
              {/* 进度环 */}
              <div className="relative shrink-0">
                <svg width="68" height="68" viewBox="0 0 68 68" className="-rotate-90">
                  <circle cx="34" cy="34" r={ringR} fill="none" stroke="currentColor" strokeWidth="3" className="text-border/30" />
                  <circle cx="34" cy="34" r={ringR} fill="none" strokeWidth="3"
                    stroke="url(#prog-grad)"
                    strokeLinecap="round"
                    strokeDasharray={ringC}
                    strokeDashoffset={ringOffset}
                    className="transition-all duration-700 ease-out"
                  />
                  <defs>
                    <linearGradient id="prog-grad" x1="0" y1="0" x2="1" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" />
                      <stop offset="100%" stopColor="#8b5cf6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-sm font-bold">{progress}%</span>
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">{prompt}</p>
                {estimatedTime !== null && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground/70">
                    <Clock className="w-3 h-3" />
                    <span>预计还需 {estimatedTime} 秒</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── 生成失败 ── */}
          {status === 'failed' && (
            <div className="space-y-2 mb-3">
              <p className="text-sm text-muted-foreground line-clamp-2">{prompt}</p>
              {error && (
                <div className="text-xs text-red-600 dark:text-red-400 p-2.5 rounded-lg bg-red-500/[0.06] border border-red-500/10 leading-relaxed">
                  {error}
                </div>
              )}
            </div>
          )}

          {/* ── 生成完成：视频 + 按钮 ── */}
          {status === 'completed' && videoUrl && (
            <div className="space-y-3">
              {/* 提示文本 */}
              <p className="text-sm text-muted-foreground line-clamp-1">{prompt}</p>

              {/* 视频播放器 */}
              <div className="relative rounded-xl overflow-hidden bg-black group">
                <video
                  src={videoUrl}
                  controls
                  className="w-full aspect-video"
                  playsInline
                >
                  您的浏览器不支持视频播放
                </video>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 rounded-xl border-border/50 text-xs font-medium"
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  {isDownloading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                  {isDownloading ? "下载中..." : "下载视频"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 h-9 rounded-xl border-border/50 text-xs font-medium"
                  onClick={handleShare}
                  disabled={isCreatingShare}
                >
                  {isCreatingShare ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Share2 className="mr-1.5 h-3.5 w-3.5" />}
                  {shareUrl ? "复制链接" : "分享视频"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ═══════ 底部信息栏 ═══════ */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border/30 bg-muted/20">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
            {taskData?.duration && (
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {taskData.duration}秒
              </span>
            )}
            {taskData?.createdAt && (
              <span>{formatRelativeTime(new Date(taskData.createdAt).getTime())}</span>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground/40 font-mono">ID:{taskId}</span>
        </div>
      </div>
    </div>
  );
}
