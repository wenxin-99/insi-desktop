import { useState, useCallback } from "react";
import { X, RotateCcw, ZoomIn, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploadPreviewProps {
  url: string;
  name: string;
  progress?: number; // 0-100的进度值，undefined表示已完成
  error?: string;    // ★ P2-7: 上传错误信息
  onRemove: () => void;
  onRetry?: () => void;  // ★ P2-7: 重试回调
  onPreview?: (url: string) => void;  // ★ P2-7: 点击预览回调
}

export function ImageUploadPreview({ url, name, progress, error, onRemove, onRetry, onPreview }: ImageUploadPreviewProps) {
  const isUploading = progress !== undefined && progress < 100 && !error;
  const isCompleted = !isUploading && !error;
  const [imgError, setImgError] = useState(false);

  const handleClick = useCallback(() => {
    if (isCompleted && onPreview && url && !url.startsWith('blob:')) {
      onPreview(url);
    }
  }, [isCompleted, onPreview, url]);

  return (
    <div className="relative w-20 h-20 md:w-24 md:h-24 rounded-lg overflow-hidden group flex-shrink-0">
      {/* 图片预览 */}
      {!imgError ? (
        <img
          src={url}
          alt={name}
          className={`w-full h-full object-cover transition-all duration-200 ${
            isUploading ? "opacity-40 scale-[1.02]" : error ? "opacity-30 grayscale" : "cursor-pointer hover:brightness-90"
          }`}
          onClick={handleClick}
          onError={() => setImgError(true)}
          draggable={false}
        />
      ) : (
        <div className="w-full h-full bg-muted flex items-center justify-center">
          <AlertTriangle className="h-5 w-5 text-muted-foreground" />
        </div>
      )}
      
      {/* 上传进度圆环 */}
      {isUploading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/10">
          <svg className="w-10 h-10 md:w-12 md:h-12 transform -rotate-90">
            <circle
              cx="50%" cy="50%" r="18"
              stroke="currentColor" strokeWidth="2.5" fill="none"
              className="text-white/30"
            />
            <circle
              cx="50%" cy="50%" r="18"
              stroke="currentColor" strokeWidth="2.5" fill="none"
              strokeDasharray={`${2 * Math.PI * 18}`}
              strokeDashoffset={`${2 * Math.PI * 18 * (1 - (progress || 0) / 100)}`}
              className="text-primary transition-all duration-300"
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-white text-[10px] font-semibold drop-shadow-sm">
            {Math.round(progress || 0)}%
          </span>
        </div>
      )}

      {/* ★ 错误状态覆盖层 */}
      {error && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 gap-1.5">
          <AlertTriangle className="h-4 w-4 text-red-400" />
          <span className="text-white text-[9px] text-center px-1 leading-tight line-clamp-2">
            {error.length > 20 ? '上传失败' : error}
          </span>
          {onRetry && (
            <button
              onClick={(e) => { e.stopPropagation(); onRetry(); }}
              className="flex items-center gap-0.5 text-[10px] text-blue-300 hover:text-blue-200 font-medium"
            >
              <RotateCcw className="h-2.5 w-2.5" />
              重试
            </button>
          )}
        </div>
      )}

      {/* 放大图标（已完成状态 hover 时） */}
      {isCompleted && onPreview && !imgError && (
        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20 pointer-events-none">
          <ZoomIn className="h-5 w-5 text-white drop-shadow" />
        </div>
      )}

      {/* 文件名 tooltip */}
      {name && (
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent py-0.5 px-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="text-white text-[9px] truncate block">{name}</span>
        </div>
      )}
      
      {/* 删除按钮 */}
      <Button
        variant="ghost"
        size="sm"
        className="absolute top-0.5 right-0.5 h-5 w-5 p-0 bg-black/50 hover:bg-red-600/80 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all rounded-full"
        onClick={(e) => { e.stopPropagation(); onRemove(); }}
      >
        <X className="h-2.5 w-2.5" />
      </Button>
    </div>
  );
}
