/**
 * videoHistory/useVideoHistory — 状态管理 + 批量下载/删除
 */
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useDownload } from "@/hooks/useDownload";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import JSZip from "jszip";

export function useVideoHistory() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [providerFilter, setProviderFilter] = useState<string>("all");
  const [selectedVideos, setSelectedVideos] = useState<Set<number>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { data: videos, isLoading, refetch } = trpc.videos.getTasks.useQuery({ limit: 50 });

  // 活跃任务自动刷新
  useEffect(() => {
    const hasActive = videos?.some((v) => v.status === "pending" || v.status === "processing");
    if (!hasActive) return;
    const interval = setInterval(refetch, 5000);
    return () => clearInterval(interval);
  }, [videos, refetch]);

  const toggleFavoriteMutation = trpc.videos.toggleFavorite.useMutation({
    onSuccess: () => { refetch(); toast.success(t("videoHistory.toast.success")); },
    onError: (error) => toast.error(error.message || t("videoHistory.toast.error")),
  });

  const deleteTaskMutation = trpc.videos.deleteTask.useMutation({
    onSuccess: () => { refetch(); toast.success(t("videoHistory.toast.deleteSuccess")); },
    onError: (error) => toast.error(error.message || t("videoHistory.toast.deleteError")),
  });

  const deleteTasksMutation = trpc.videos.deleteTasks.useMutation({
    onSuccess: (data) => { refetch(); setSelectedVideos(new Set()); toast.success(t("videoHistory.toast.batchDeleteSuccess", { count: data.deletedCount })); },
    onError: (error) => toast.error(error.message || t("videoHistory.toast.batchDeleteError")),
  });

  const { download: _dlVideo } = useDownload();

  // ════════ 过滤 ════════

  const filteredVideos = videos?.filter((video) => {
    const matchesSearch = video.prompt.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || video.status === statusFilter;
    const matchesProvider = providerFilter === "all" || video.provider === providerFilter;
    return matchesSearch && matchesStatus && matchesProvider;
  }) || [];

  // ════════ Handlers ════════

  const handleDownload = async (videoUrl: string, taskId: number) => {
    const filename = `video_${taskId}_${Date.now()}.mp4`;
    const proxyUrl = `/api/video-proxy/download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(filename)}`;
    await _dlVideo(proxyUrl, { filename, loadingMsg: "正在下载视频...", successMsg: t("videoHistory.toast.downloadSuccess"), errorMsg: t("videoHistory.toast.downloadError") });
  };

  const handleToggleSelectAll = () => {
    const completed = filteredVideos.filter((v) => v.status === "completed" && v.videoUrl);
    if (selectedVideos.size === completed.length) setSelectedVideos(new Set());
    else setSelectedVideos(new Set(completed.map((v) => v.id)));
  };

  const handleDelete = async (taskId: number) => {
    if (!confirm("确定要删除这个视频任务吗？")) return;
    await deleteTaskMutation.mutateAsync({ taskId });
  };

  const handleBatchDelete = async () => {
    if (selectedVideos.size === 0) { toast.error(t("videoHistory.toast.selectVideosToDelete")); return; }
    if (!confirm(`确定要删除选中的 ${selectedVideos.size} 个视频任务吗？此操作不可恢复！`)) return;
    setIsDeleting(true);
    try { await deleteTasksMutation.mutateAsync({ taskIds: Array.from(selectedVideos) }); }
    catch (e) { console.error("Batch delete error:", e); }
    finally { setIsDeleting(false); }
  };

  const handleBatchDownload = async () => {
    if (selectedVideos.size === 0) { toast.error(t("videoHistory.toast.selectVideosToDownload")); return; }
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const list = videos?.filter((v) => selectedVideos.has(v.id) && v.videoUrl) || [];
      for (const video of list) {
        try {
          const filename = `video_${video.id}_${video.prompt.substring(0, 20)}.mp4`;
          const res = await fetch(`/api/video-proxy/download?url=${encodeURIComponent(video.videoUrl!)}&filename=${encodeURIComponent(filename)}`, { credentials: "include" });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          zip.file(filename, await res.blob());
        } catch (e) { console.error(`Failed to download video ${video.id}:`, e); toast.error(t("videoHistory.toast.videoDownloadFailed", { id: video.id })); }
      }
      const zipBlob = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a"); a.href = url; a.download = `videos_${Date.now()}.zip`;
      document.body.appendChild(a); a.click(); window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast.success(t("videoHistory.toast.batchDownloadSuccess", { count: list.length }));
      setSelectedVideos(new Set());
    } catch (e) { console.error("Batch download error:", e); toast.error(t("videoHistory.toast.batchDownloadError")); }
    finally { setIsDownloading(false); }
  };

  return {
    searchQuery, setSearchQuery, statusFilter, setStatusFilter,
    providerFilter, setProviderFilter,
    selectedVideos, setSelectedVideos,
    isDownloading, isDeleting, isLoading,
    filteredVideos, toggleFavoriteMutation,
    handleDownload, handleToggleSelectAll,
    handleDelete, handleBatchDelete, handleBatchDownload,
  };
}

// ════════ 工具函数 ════════

export function calculateProgress(status: string, createdAt: string | Date): number {
  if (status === "completed") return 100;
  if (status === "failed") return 0;
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
  if (status === "pending") return Math.min(20, (elapsed / 30) * 20);
  if (status === "processing") return 20 + Math.min(75, (elapsed / 180) * 75);
  return 0;
}

export function getEstimatedTime(status: string, createdAt: string | Date, t: (key: string, opts?: any) => string): string | null {
  if (status === "completed" || status === "failed") return null;
  const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000;
  if (status === "pending") return t("videoHistory.estimatedTime.pending", { seconds: Math.ceil(Math.max(0, 30 - elapsed)) });
  if (status === "processing") {
    const remaining = Math.max(0, 180 - elapsed);
    return remaining > 60
      ? t("videoHistory.estimatedTime.minutes", { minutes: Math.ceil(remaining / 60) })
      : t("videoHistory.estimatedTime.seconds", { seconds: Math.ceil(remaining) });
  }
  return null;
}
