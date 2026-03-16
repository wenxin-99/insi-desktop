/**
 * ImageGallery — 图片画廊页面
 *
 * 拆分自原 569 行单文件。子模块：
 *   imageGallery/useImageGallery.ts    - 状态管理 + 下载/收藏/生成逻辑
 *   imageGallery/ImageDetailDialog.tsx  - 图片详情灯箱
 *   imageGallery/EditPromptDialog.tsx   - 编辑描述重新生成
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Heart, Download, Image as ImageIcon, Loader2, CheckSquare, Square, ArrowLeft } from "lucide-react";
import { formatRelativeTime } from "@/lib/timeUtils";
import { useImageGallery } from "./imageGallery/useImageGallery";
import { ImageDetailDialog } from "./imageGallery/ImageDetailDialog";
import { EditPromptDialog } from "./imageGallery/EditPromptDialog";
import { ImageGallerySkeleton } from "@/components/GallerySkeleton";
import DashboardLayout from '@/components/DashboardLayout';

export default function ImageGallery() {
  const { t } = useTranslation();
  const g = useImageGallery();

  if (g.isLoading) return <ImageGallerySkeleton />;

  return (
    <DashboardLayout>
    <div className="container mx-auto py-4 md:py-8 px-4">
      <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mb-4">
        <ArrowLeft className="h-4 w-4 mr-2" /> 返回
      </Button>

      {/* 顶部统计和筛选 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold mb-2">{t("imageGallery.title")}</h1>
          {g.stats && (
            <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span>{t("imageGallery.stats.total")}: {g.stats.total}</span>
              <span>{t("imageGallery.stats.favorites")}: {g.stats.favorites}</span>
              <span>总消费: {Number(g.stats.totalCost).toFixed(2)} 🐟币</span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="flex gap-2">
            <Button variant={g.filter === "all" ? "default" : "outline"} onClick={() => g.setFilter("all")} className="flex-1 md:flex-none">
              <ImageIcon className="h-4 w-4 mr-2" /> {t("imageGallery.all")}
            </Button>
            <Button variant={g.filter === "favorites" ? "default" : "outline"} onClick={() => g.setFilter("favorites")} className="flex-1 md:flex-none">
              <Heart className="h-4 w-4 mr-2" /> {t("imageGallery.favorites")}
            </Button>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant={g.selectionMode ? "default" : "outline"} onClick={() => { g.setSelectionMode(!g.selectionMode); g.deselectAll(); }}>
              {g.selectionMode ? <CheckSquare className="h-4 w-4 mr-2" /> : <Square className="h-4 w-4 mr-2" />}
              {g.selectionMode ? `${t("imageGallery.selectAll")} ${g.selectedImages.size}` : t("imageGallery.selectionMode")}
            </Button>
            {g.selectionMode && (
              <>
                <Button variant="outline" onClick={g.selectAll}>{t("imageGallery.selectAll")}</Button>
                <Button variant="outline" onClick={g.deselectAll}>{t("imageGallery.deselectAll")}</Button>
                <Button variant="default" onClick={g.handleBatchDownload} disabled={g.selectedImages.size === 0 || g.isDownloading} className="relative">
                  {g.isDownloading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("imageGallery.toast.downloadingZip")} {g.downloadProgress}%</>
                  ) : (
                    <><Download className="h-4 w-4 mr-2" />{t("imageGallery.batchDownload")} ({g.selectedImages.size})</>
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 图片网格 */}
      {g.images && g.images.length > 0 ? (
        <>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {g.images.map((image: any) => (
            <Card
              key={image.id}
              className={`group overflow-hidden hover:shadow-lg transition-shadow cursor-pointer ${
                g.selectionMode && g.selectedImages.has(image.id) ? "ring-2 ring-primary" : ""
              }`}
              onClick={() => {
                if (g.selectionMode) g.toggleSelection(image.id);
                else { g.setSelectedImage(image); g.setLightboxOpen(true); }
              }}
            >
              <CardContent className="p-0">
                <div className="relative aspect-square bg-muted overflow-hidden">
                  <img src={image.imageUrl} alt={image.prompt} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" loading="lazy" />
                  {g.selectionMode && (
                    <div className="absolute top-2 left-2 p-2 rounded-full bg-background/80 backdrop-blur-sm">
                      {g.selectedImages.has(image.id) ? <CheckSquare className="h-5 w-5 text-primary" /> : <Square className="h-5 w-5 text-muted-foreground" />}
                    </div>
                  )}
                  {!g.selectionMode && (
                    <button
                      onClick={(e) => { e.stopPropagation(); g.toggleFavoriteMutation.mutate({ imageId: image.id }); }}
                      className="absolute top-2 right-2 p-2 rounded-full bg-background/80 backdrop-blur-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                    >
                      <Heart className={`h-4 w-4 ${image.isFavorite ? "fill-red-500 text-red-500" : "text-foreground"}`} />
                    </button>
                  )}
                </div>
                <div className="p-3 space-y-2">
                  <p className="text-sm line-clamp-2 text-foreground">{image.prompt}</p>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{formatRelativeTime(new Date(image.createdAt).getTime())}</span>
                    <span>{Number(image.cost).toFixed(2)} 🐟币</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* ★ 滚动加载更多哨兵 */}
        {g.filter === "all" && (
          <div ref={g.loadMoreRef} className="flex justify-center py-8">
            {g.isLoadingMore ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载更多...
              </div>
            ) : g.hasMore ? (
              <Button variant="ghost" size="sm" onClick={g.loadMore} className="text-muted-foreground">
                滚动加载更多
              </Button>
            ) : g.images.length > 0 ? (
              <span className="text-xs text-muted-foreground/50">
                已加载全部 {g.totalCount ?? g.images.length} 张图片
              </span>
            ) : null}
          </div>
        )}
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ImageIcon className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">
            {g.filter === "favorites" ? t("imageGallery.noFavorites") : t("imageGallery.noImages")}
          </h3>
          <p className="text-sm text-muted-foreground">
            {g.filter === "favorites" ? t("imageGallery.noFavoritesDesc") : t("imageGallery.noImagesDesc")}
          </p>
        </div>
      )}

      {/* 对话框 */}
      <ImageDetailDialog
        open={g.lightboxOpen} onOpenChange={g.setLightboxOpen}
        image={g.selectedImage} isRegenerating={g.isRegenerating}
        onToggleFavorite={() => g.toggleFavoriteMutation.mutate({ imageId: g.selectedImage?.id })}
        onDownload={() => g.handleDownload(g.selectedImage?.imageUrl, g.selectedImage?.prompt)}
        onDelete={() => { if (confirm("确定要删除这张图片吗？")) g.deleteMutation.mutate({ imageId: g.selectedImage?.id }); }}
        onRegenerate={() => g.handleRegenerate(g.selectedImage?.prompt)}
        onOpenEdit={() => { g.setEditedPrompt(g.selectedImage?.prompt); g.setEditDialogOpen(true); }}
        favoritePending={g.toggleFavoriteMutation.isPending}
        deletePending={g.deleteMutation.isPending}
      />
      <EditPromptDialog
        open={g.editDialogOpen} onOpenChange={g.setEditDialogOpen}
        prompt={g.editedPrompt} onPromptChange={g.setEditedPrompt}
        onRegenerate={g.handleRegenerateWithNewPrompt} isRegenerating={g.isRegenerating}
      />
    </div>
    </DashboardLayout>
  );
}
