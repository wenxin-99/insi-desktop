/**
 * imageGallery/useImageGallery — 状态管理与业务逻辑
 * 
 * ★ 改进：支持滚动加载更多（每次 24 张），替代之前的硬编码 100 张
 */
import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { safeToast } from "@/lib/safeToast";
import { toast } from "sonner";
import JSZip from "jszip";

const PAGE_SIZE = 24;

export function useImageGallery() {
  const { t } = useTranslation();
  const [filter, setFilter] = useState<"all" | "favorites">("all");
  const [selectedImage, setSelectedImage] = useState<any>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedImages, setSelectedImages] = useState<Set<number>>(new Set());
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState("");
  const [isRegenerating, setIsRegenerating] = useState(false);

  // ★ 分页状态
  const [allLoadedImages, setAllLoadedImages] = useState<any[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // 初始加载
  const { data: initialImages, isLoading, refetch } = trpc.images.getAll.useQuery(
    { limit: PAGE_SIZE, offset: 0 }, { enabled: filter === "all" }
  );
  const { data: favoriteImages, refetch: refetchFavorites } = trpc.images.getFavorites.useQuery(
    undefined, { enabled: filter === "favorites" }
  );
  const { data: stats, refetch: refetchStats } = trpc.images.getStats.useQuery();
  const { data: totalCount } = trpc.images.getCount.useQuery(
    { favoritesOnly: filter === "favorites" }
  );

  // 初始数据同步到 allLoadedImages
  useEffect(() => {
    if (filter === "all" && initialImages) {
      setAllLoadedImages(initialImages);
      setOffset(initialImages.length);
      setHasMore(initialImages.length >= PAGE_SIZE);
    }
  }, [initialImages, filter]);

  // 切换 filter 时重置分页
  useEffect(() => {
    setOffset(0);
    setHasMore(true);
    setAllLoadedImages([]);
  }, [filter]);

  // ★ 加载更多
  const trpcContext = trpc.useUtils();
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || filter !== "all") return;
    setIsLoadingMore(true);
    try {
      const nextBatch = await trpcContext.images.getAll.fetch({ limit: PAGE_SIZE, offset });
      if (nextBatch.length < PAGE_SIZE) setHasMore(false);
      setAllLoadedImages(prev => {
        // 去重（防止 refetch 导致重复）
        const existingIds = new Set(prev.map((img: any) => img.id));
        const newItems = nextBatch.filter((img: any) => !existingIds.has(img.id));
        return [...prev, ...newItems];
      });
      setOffset(prev => prev + nextBatch.length);
    } catch (err) {
      console.error('[Gallery] Load more failed:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, offset, filter, trpcContext]);

  // ★ IntersectionObserver 触发加载更多
  useEffect(() => {
    if (!loadMoreRef.current || filter !== "all") return;
    const observer = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting && hasMore && !isLoadingMore) loadMore(); },
      { rootMargin: '200px' }
    );
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [loadMore, hasMore, isLoadingMore, filter]);

  const toggleFavoriteMutation = trpc.images.toggleFavorite.useMutation({
    onSuccess: (result) => {
      refetch(); refetchFavorites(); refetchStats();
      // 更新本地缓存
      setAllLoadedImages(prev => prev.map((img: any) =>
        img.id === result.id ? { ...img, isFavorite: result.isFavorite } : img
      ));
    },
    onError: (error) => { toast.error(error.message); },
  });

  const deleteMutation = trpc.images.delete.useMutation({
    onSuccess: (_data, variables) => {
      refetch(); refetchFavorites(); refetchStats();
      setAllLoadedImages(prev => prev.filter((img: any) => img.id !== variables.imageId));
      toast.success(t("imageGallery.toast.deleteSuccess"));
      setLightboxOpen(false);
    },
    onError: (error) => { toast.error(error.message); },
  });

  const generateImageMutation = trpc.images.generate.useMutation({
    onSuccess: () => { refetch(); refetchFavorites(); refetchStats(); safeToast.success(t("imageGallery.toast.regenerateSuccess")); setIsRegenerating(false); setLightboxOpen(false); setEditDialogOpen(false); },
    onError: (error) => { safeToast.error(t("imageGallery.toast.regenerateError") + error.message); setIsRegenerating(false); },
  });

  // 当前显示的图片列表
  const images = filter === "all" ? allLoadedImages : favoriteImages;

  const handleRegenerate = (prompt: string) => {
    setIsRegenerating(true);
    generateImageMutation.mutate({ prompt });
  };

  const handleRegenerateWithNewPrompt = (prompt: string) => {
    if (!prompt.trim()) { safeToast.error(t("imageGallery.toast.emptyPrompt")); return; }
    setIsRegenerating(true);
    generateImageMutation.mutate({ prompt: prompt.trim() });
  };

  const handleDownload = async (imageUrl: string, prompt: string) => {
    try {
      const response = await fetch(imageUrl);
      if (!response.ok) throw new Error("下载失败");
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `${prompt.slice(0, 30)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
      safeToast.success("下载成功");
    } catch { safeToast.error("下载失败"); }
  };

  const handleBatchDownload = async () => {
    if (selectedImages.size === 0) { safeToast.error("请先选择图片"); return; }
    setIsDownloading(true);
    setDownloadProgress(0);
    try {
      const zip = new JSZip();
      const list = images?.filter((img: any) => selectedImages.has(img.id)) || [];
      let completed = 0;
      const downloadOne = async (image: any, index: number) => {
        try {
          const response = await fetch(image.imageUrl);
          const blob = await response.blob();
          zip.file(`${index + 1}_${image.prompt.slice(0, 20).replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "_")}.png`, blob);
          completed++;
          setDownloadProgress(Math.round((completed / list.length) * 100));
        } catch (e) { console.error(`下载图片失败: ${image.id}`, e); }
      };
      for (let i = 0; i < list.length; i += 3) {
        await Promise.all(list.slice(i, i + 3).map((img, j) => downloadOne(img, i + j)));
      }
      if (completed === 0) throw new Error("所有图片下载失败");
      safeToast.info("正在生成ZIP文件...");
      const zipBlob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url; a.download = `images_${Date.now()}.zip`;
      document.body.appendChild(a); a.click(); document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      safeToast.success(`成功下载 ${completed} 张图片`);
      setSelectedImages(new Set());
      setSelectionMode(false);
    } catch (error) {
      safeToast.error("批量下载失败：" + (error instanceof Error ? error.message : "未知错误"));
    } finally { setIsDownloading(false); setDownloadProgress(0); }
  };

  const toggleSelection = (imageId: number) => {
    const next = new Set(selectedImages);
    if (next.has(imageId)) next.delete(imageId); else next.add(imageId);
    setSelectedImages(next);
  };

  const selectAll = () => { if (images) setSelectedImages(new Set(images.map((img: any) => img.id))); };
  const deselectAll = () => setSelectedImages(new Set());

  return {
    filter, setFilter, images, stats, isLoading, totalCount,
    selectedImage, setSelectedImage, lightboxOpen, setLightboxOpen,
    selectionMode, setSelectionMode, selectedImages, toggleSelection, selectAll, deselectAll,
    isDownloading, downloadProgress,
    editDialogOpen, setEditDialogOpen, editedPrompt, setEditedPrompt, isRegenerating,
    toggleFavoriteMutation, deleteMutation,
    handleRegenerate, handleRegenerateWithNewPrompt,
    handleDownload, handleBatchDownload,
    // ★ 分页
    hasMore, isLoadingMore, loadMore, loadMoreRef,
  };
}
