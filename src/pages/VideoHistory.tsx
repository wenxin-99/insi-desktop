/**
 * VideoHistory — 视频历史页面
 *
 * 拆分自原 529 行。子模块：
 *   videoHistory/useVideoHistory.ts - 状态 + 批量操作 + 过滤 + 工具函数
 *   videoHistory/VideoCard.tsx      - 视频任务卡片
 */
import { useTranslation } from "react-i18next";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Video, Loader2, Search, ArrowLeft, Trash2, Download as DownloadIcon } from "lucide-react";
import { useVideoHistory } from "./videoHistory/useVideoHistory";
import { VideoCard } from "./videoHistory/VideoCard";
import DashboardLayout from '@/components/DashboardLayout';

export default function VideoHistory() {
  const { t } = useTranslation();
  const v = useVideoHistory();

  return (
    <DashboardLayout>
    <div className="container py-6 space-y-6">
      <div>
        <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="gap-2">
          <ArrowLeft className="h-4 w-4" /> {t("videoHistory.back")}
        </Button>
      </div>

      {/* 页面标题 + 批量操作 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t("videoHistory.title")}</h1>
          <p className="text-muted-foreground mt-1">{t("videoHistory.description")}</p>
        </div>
        {v.selectedVideos.size > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">{t("videoHistory.selected", { count: v.selectedVideos.size })}</span>
            <Button variant="outline" size="sm" onClick={() => v.setSelectedVideos(new Set())}>{t("videoHistory.cancelSelection")}</Button>
            <Button variant="destructive" size="sm" onClick={v.handleBatchDelete} disabled={v.isDeleting}>
              {v.isDeleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("videoHistory.deleting")}</> : <><Trash2 className="mr-2 h-4 w-4" />{t("videoHistory.batchDelete")}</>}
            </Button>
            <Button size="sm" onClick={v.handleBatchDownload} disabled={v.isDownloading}>
              {v.isDownloading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("videoHistory.packaging")}</> : <><DownloadIcon className="mr-2 h-4 w-4" />{t("videoHistory.batchDownload")}</>}
            </Button>
          </div>
        )}
      </div>

      {/* 筛选栏 */}
      <Card className="p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder={t("videoHistory.searchPlaceholder")} value={v.searchQuery} onChange={(e) => v.setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          <Select value={v.statusFilter} onValueChange={v.setStatusFilter}>
            <SelectTrigger className="w-full md:w-40"><SelectValue placeholder={t("videoHistory.statusFilter")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("videoHistory.allStatus")}</SelectItem>
              <SelectItem value="pending">{t("videoHistory.status.pending")}</SelectItem>
              <SelectItem value="processing">{t("videoHistory.status.processing")}</SelectItem>
              <SelectItem value="completed">{t("videoHistory.status.completed")}</SelectItem>
              <SelectItem value="failed">{t("videoHistory.status.failed")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={v.providerFilter} onValueChange={v.setProviderFilter}>
            <SelectTrigger className="w-full md:w-40"><SelectValue placeholder={t("videoHistory.providerFilter")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("videoHistory.allProviders")}</SelectItem>
              <SelectItem value="Pika">Pika</SelectItem>
            </SelectContent>
          </Select>
          {v.filteredVideos.length > 0 && (
            <Button variant="outline" size="sm" onClick={v.handleToggleSelectAll}>
              {v.selectedVideos.size === v.filteredVideos.filter((vi) => vi.status === "completed" && vi.videoUrl).length
                ? t("videoHistory.deselectAll") : t("videoHistory.selectAll")}
            </Button>
          )}
        </div>
      </Card>

      {/* 列表 */}
      {v.isLoading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : v.filteredVideos.length === 0 ? (
        <Card className="p-12">
          <div className="text-center space-y-2">
            <Video className="h-12 w-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-medium">{t("videoHistory.noVideos")}</h3>
            <p className="text-sm text-muted-foreground">
              {v.searchQuery || v.statusFilter !== "all" || v.providerFilter !== "all" ? t("videoHistory.noVideosFiltered") : t("videoHistory.noVideosDesc")}
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {v.filteredVideos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              isSelected={v.selectedVideos.has(video.id)}
              onToggleSelect={(checked) => {
                const next = new Set(v.selectedVideos);
                if (checked) next.add(video.id); else next.delete(video.id);
                v.setSelectedVideos(next);
              }}
              onToggleFavorite={() => v.toggleFavoriteMutation.mutate({ videoId: video.id })}
              onDelete={() => v.handleDelete(video.id)}
              onDownload={() => v.handleDownload(video.videoUrl!, video.id)}
            />
          ))}
        </div>
      )}
    </div>
    </DashboardLayout>
  );
}
