import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Download, Trash2, Video as VideoIcon, Loader2, Clock, CheckCircle, XCircle, ArrowLeft } from "lucide-react";
import { VideoPlayer } from "@/components/VideoPlayer";
import { safeToast } from "@/lib/safeToast";
import { useDownload } from "../hooks/useDownload";
import { formatRelativeTime } from "@/lib/timeUtils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function VideoGallery() {
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [selectedVideo, setSelectedVideo] = useState<any>(null);
  const [playerOpen, setPlayerOpen] = useState(false);

  // 获取视频列表
  const { data: videos, isLoading, refetch } = trpc.videos.getAll.useQuery(
    { limit: 100, onlyFavorites: filter === "favorites" }
  );

  const { data: stats } = trpc.videos.getStats.useQuery();

  // 切换收藏状态
  const toggleFavoriteMutation = trpc.videos.toggleFavorite.useMutation({
    onSuccess: () => {
      refetch();
      safeToast.success("操作成功");
    },
    onError: (error) => {
      safeToast.error(error.message);
    },
  });

  // 删除视频
  const deleteMutation = trpc.videos.delete.useMutation({
    onSuccess: () => {
      refetch();
      safeToast.success("删除成功");
    },
    onError: (error) => {
      safeToast.error(error.message);
    },
  });

  const displayedVideos = videos || [];

  const { download: _dlVideo } = useDownload();
  const handleDownload = async (videoUrl: string, prompt: string) => {
    const proxyUrl = `/api/video-proxy/download?url=${encodeURIComponent(videoUrl)}&filename=${encodeURIComponent(`video-${prompt.substring(0, 30)}.mp4`)}`;
    await _dlVideo(proxyUrl, {
      filename: `video-${prompt.substring(0, 30)}.mp4`,
      loadingMsg: '正在下载视频...',
      successMsg: '视频下载成功！',
      errorMsg: '视频下载失败，请重试',
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      default:
        return <Clock className="w-4 h-4 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "completed":
        return "已完成";
      case "failed":
        return "失败";
      case "processing":
        return "生成中";
      default:
        return "等待中";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* 顶部统计和筛选 */}
      <div className="border-b bg-card">
        <div className="container py-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.history.back()}
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            返回
          </Button>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold">视频历史</h1>
              <p className="text-sm text-muted-foreground mt-1">
                共 {stats?.total || 0} 个视频 · 收藏 {stats?.favorites || 0} 个
              </p>
            </div>

            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                onClick={() => setFilter("all")}
                size="sm"
              >
                全部
              </Button>
              <Button
                variant={filter === "favorites" ? "default" : "outline"}
                onClick={() => setFilter("favorites")}
                size="sm"
              >
                收藏
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* 视频网格 */}
      <div className="container py-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : displayedVideos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <VideoIcon className="w-16 h-16 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">还没有视频</h3>
            <p className="text-sm text-muted-foreground">
              在对话中说"生成一段视频"来创建您的第一个视频
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {displayedVideos.map((video: any) => (
              <Card
                key={video.id}
                className="group overflow-hidden hover:shadow-lg transition-shadow"
              >
                <CardContent className="p-0">
                  {/* 视频缩略图 */}
                  <div
                    className="relative aspect-video bg-muted cursor-pointer overflow-hidden"
                    onClick={() => {
                      if (video.videoUrl) {
                        setSelectedVideo(video);
                        setPlayerOpen(true);
                      }
                    }}
                  >
                    {video.thumbnailUrl ? (
                      <img
                        src={video.thumbnailUrl}
                        alt={video.prompt}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <VideoIcon className="w-12 h-12 text-muted-foreground" />
                      </div>
                    )}

                    {/* 状态标识 */}
                    <div className="absolute top-2 left-2 flex items-center gap-1 bg-black/60 text-white px-2 py-1 rounded text-xs">
                      {getStatusIcon(video.status || "completed")}
                      <span>{getStatusText(video.status || "completed")}</span>
                    </div>

                    {/* 时长标识 */}
                    {video.duration && (
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                        {video.duration}s
                      </div>
                    )}

                    {/* 悬浮播放按钮 */}
                    {video.videoUrl && (
                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                        <div className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center">
                          <div className="w-0 h-0 border-l-[12px] border-l-black border-y-[8px] border-y-transparent ml-1" />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 视频信息 */}
                  <div className="p-3">
                    <p className="text-sm line-clamp-2 mb-2 min-h-[2.5rem]">
                      {video.prompt}
                    </p>

                    <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                      <span>{formatRelativeTime(new Date(video.createdAt).getTime())}</span>
                      {video.cost && (
                        <span className="text-primary font-medium">
                          {parseFloat(video.cost).toFixed(0)}🐟币
                        </span>
                      )}
                    </div>

                    {/* 操作按钮 */}
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8"
                        onClick={() =>
                          toggleFavoriteMutation.mutate({ videoId: video.id })
                        }
                      >
                        <Heart
                          className={`w-4 h-4 ${
                            video.isFavorite
                              ? "fill-red-500 text-red-500"
                              : ""
                          }`}
                        />
                      </Button>

                      {video.videoUrl && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="flex-1 h-8"
                          onClick={() => handleDownload(video.videoUrl, video.prompt)}
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                      )}

                      <Button
                        variant="ghost"
                        size="sm"
                        className="flex-1 h-8 text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm("确定要删除这个视频吗？")) {
                            deleteMutation.mutate({ videoId: video.id });
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* 视频播放器对话框 */}
      <Dialog open={playerOpen} onOpenChange={setPlayerOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{selectedVideo?.prompt}</DialogTitle>
          </DialogHeader>
          {selectedVideo?.videoUrl && (
            <div className="aspect-video bg-black rounded-lg overflow-hidden">
              <VideoPlayer
                src={selectedVideo.videoUrl}
                onDownload={() => handleDownload(selectedVideo.videoUrl, selectedVideo.prompt)}
                className="w-full h-full"
              />
            </div>
          )}
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatRelativeTime(new Date(selectedVideo?.createdAt).getTime())}</span>
            <span>{selectedVideo?.duration}秒</span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
