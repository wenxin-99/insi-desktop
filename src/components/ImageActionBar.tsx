/**
 * ImageActionBar — 图片快捷操作栏
 *
 * 渲染在每张 AI 生成图片的底部/角落：
 *   - 右下角 ❤️ 收藏按钮
 *   - 底部 hover 工具栏: 🔄 重试 · 🔍 高清 · ⬇️ 下载 · 🖼️ 画廊
 */
import { useState } from 'react';
import { Heart, RotateCcw, Download, Images, Loader2, ZoomIn } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ImageActionBarProps {
  imageUrl: string;
  imagePrompt?: string;
  isFavorite?: boolean;
  onDownload: () => void;
  onRetrySuccess?: (newImageUrl: string, newPlaceholderUrl?: string) => void;
  onOpenGallery?: () => void;
  onFavoriteChange?: (isFavorite: boolean) => void;
  /** 放大成功后的回调（传入新图片 URL，替换当前图片） */
  onUpscaleSuccess?: (newImageUrl: string, info: { width: number; height: number; method: string; scale: number }) => void;
}

export function ImageActionBar({
  imageUrl, imagePrompt, isFavorite: initialFavorite,
  onDownload, onRetrySuccess, onOpenGallery, onFavoriteChange, onUpscaleSuccess,
}: ImageActionBarProps) {
  const [isFavorite, setIsFavorite] = useState(initialFavorite ?? false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isUpscaling, setIsUpscaling] = useState(false);
  const [isUpscaled, setIsUpscaled] = useState(false);

  const toggleFavMutation = trpc.images.toggleFavoriteByUrl.useMutation({
    onSuccess: (data) => {
      setIsFavorite(data.isFavorite);
      onFavoriteChange?.(data.isFavorite);
      toast.success(data.isFavorite ? '已收藏' : '已取消收藏', { duration: 1500 });
    },
    onError: (err) => {
      if (err.message.includes('不存在')) {
        toast.error('图片记录尚未就绪，请稍后再试');
      } else {
        toast.error('收藏失败');
      }
    },
  });

  const retryMutation = trpc.images.retryGenerate.useMutation({
    onSuccess: (data) => {
      setIsRetrying(false);
      toast.success('重试成功！新图片已追加', { duration: 2000 });
      onRetrySuccess?.(data.imageUrl, data.placeholderUrl || undefined);
    },
    onError: (err) => {
      setIsRetrying(false);
      toast.error('重试失败：' + (err.message || '未知错误'));
    },
  });

  const upscaleMutation = trpc.images.upscale.useMutation({
    onSuccess: (data) => {
      setIsUpscaling(false);
      setIsUpscaled(true);
      toast.success(`已放大至 ${data.width}×${data.height}（${data.method === 'realesrgan' ? 'AI 超分辨率' : '高质量插值'}）`, { duration: 3000 });
      onUpscaleSuccess?.(data.imageUrl, { width: data.width, height: data.height, method: data.method, scale: data.scale });
    },
    onError: (err) => {
      setIsUpscaling(false);
      toast.error('放大失败：' + (err.message || '未知错误'));
    },
  });

  const handleFavorite = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (toggleFavMutation.isPending) return;
    const normalizedUrl = imageUrl.startsWith('http')
      ? new URL(imageUrl).pathname
      : imageUrl;
    toggleFavMutation.mutate({ imageUrl: normalizedUrl });
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isRetrying || !imagePrompt) return;
    setIsRetrying(true);
    retryMutation.mutate({ prompt: imagePrompt });
  };

  const handleUpscale = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isUpscaling || isUpscaled) return;
    setIsUpscaling(true);
    const toastId = toast.loading('正在放大图片，请稍候...', { duration: 120000 });
    const normalizedUrl = imageUrl.startsWith('http')
      ? new URL(imageUrl).pathname
      : imageUrl;
    upscaleMutation.mutate(
      { imageUrl: normalizedUrl, scale: 2 },
      {
        onSettled: () => { toast.dismiss(toastId); },
      }
    );
  };

  return (
    <>
      {/* ❤️ 收藏按钮 — 右下角 */}
      <button
        onClick={handleFavorite}
        className={cn(
          "absolute bottom-2 right-2 p-1.5 rounded-full backdrop-blur-sm transition-all z-10",
          "opacity-100 md:opacity-0 md:group-hover:opacity-100",
          isFavorite
            ? "bg-red-500/20 hover:bg-red-500/30"
            : "bg-black/40 hover:bg-black/60"
        )}
        title={isFavorite ? '取消收藏' : '收藏'}
      >
        <Heart className={cn(
          "h-4 w-4 transition-colors",
          isFavorite ? "fill-red-500 text-red-500" : "text-white"
        )} />
      </button>

      {/* 底部 hover 工具栏 */}
      <div className={cn(
        "absolute bottom-0 left-0 right-0 flex items-center justify-center gap-0.5 md:gap-1 py-2 px-2",
        "bg-gradient-to-t from-black/70 via-black/40 to-transparent",
        "opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-200",
        "pr-12"
      )}>
        {/* 重试 */}
        {imagePrompt && (
          <button
            onClick={handleRetry}
            disabled={isRetrying}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/20 active:bg-white/30 transition-colors text-xs min-h-[32px]"
            title="重试（不扣费）"
          >
            {isRetrying
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <RotateCcw className="h-3.5 w-3.5" />
            }
            <span className="hidden sm:inline">重试</span>
          </button>
        )}
        {/* ★ 高清放大 */}
        <button
          onClick={handleUpscale}
          disabled={isUpscaling || isUpscaled}
          className={cn(
            "flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-colors text-xs min-h-[32px]",
            isUpscaled
              ? "text-emerald-300 cursor-default"
              : "text-white/90 hover:text-white hover:bg-white/20 active:bg-white/30"
          )}
          title={isUpscaled ? '已放大' : '超分辨率放大 2x'}
        >
          {isUpscaling
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <ZoomIn className="h-3.5 w-3.5" />
          }
          <span className="hidden sm:inline">{isUpscaled ? '已高清' : '高清'}</span>
        </button>
        {/* 下载 */}
        <button
          onClick={(e) => { e.stopPropagation(); onDownload(); }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/20 active:bg-white/30 transition-colors text-xs min-h-[32px]"
          title="下载"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">下载</span>
        </button>
        {/* 画廊 */}
        {onOpenGallery && (
          <button
            onClick={(e) => { e.stopPropagation(); onOpenGallery(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-white/90 hover:text-white hover:bg-white/20 active:bg-white/30 transition-colors text-xs min-h-[32px]"
            title="查看画廊"
          >
            <Images className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">画廊</span>
          </button>
        )}
      </div>
    </>
  );
}
