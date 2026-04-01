import { useState, useEffect } from "react";
import { X, ChevronLeft, ChevronRight, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeToast } from "@/lib/safeToast";

interface ImageLightboxProps {
  images: Array<{ url: string; name: string }>;
  currentIndex: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
  onDownload?: (imageUrl: string, imageName: string) => Promise<void>;
}

export function ImageLightbox({
  images,
  currentIndex,
  onClose,
  onPrevious,
  onNext,
  onDownload,
}: ImageLightboxProps) {
  const currentImage = images[currentIndex];
  const hasMultiple = images.length > 1;

  // 键盘快捷键
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft" && hasMultiple) {
        onPrevious();
      } else if (e.key === "ArrowRight" && hasMultiple) {
        onNext();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrevious, onNext, hasMultiple]);

  // 阻止背景滚动
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
      onClick={onClose}
    >
      {/* 顶部按钮组 */}
      <div className="absolute top-4 right-4 flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={async (e) => {
            e.stopPropagation();
            if (onDownload) {
              await onDownload(currentImage.url, currentImage.name);
            } else {
              safeToast.error("下载功能未配置");
            }
          }}
        >
          <Download className="h-6 w-6" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="text-white hover:bg-white/20"
          onClick={onClose}
        >
          <X className="h-6 w-6" />
        </Button>
      </div>

      {/* 左箭头 */}
      {hasMultiple && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-4 text-white hover:bg-white/20 hidden md:flex"
          onClick={(e) => {
            e.stopPropagation();
            onPrevious();
          }}
        >
          <ChevronLeft className="h-8 w-8" />
        </Button>
      )}

      {/* 图片容器 */}
      <div
        className="max-w-[90vw] max-h-[90vh] flex items-center justify-center"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={currentImage.url}
          alt={currentImage.name}
          className="max-w-full max-h-[90vh] object-contain rounded-lg"
        />
      </div>

      {/* 右箭头 */}
      {hasMultiple && (
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 text-white hover:bg-white/20 hidden md:flex"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
        >
          <ChevronRight className="h-8 w-8" />
        </Button>
      )}

      {/* 图片计数器 */}
      {hasMultiple && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white bg-black/50 px-4 py-2 rounded-full text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* 移动端左右滑动区域 */}
      {hasMultiple && (
        <>
          <div
            className="absolute left-0 top-0 bottom-0 w-1/3 md:hidden"
            onClick={(e) => {
              e.stopPropagation();
              onPrevious();
            }}
          />
          <div
            className="absolute right-0 top-0 bottom-0 w-1/3 md:hidden"
            onClick={(e) => {
              e.stopPropagation();
              onNext();
            }}
          />
        </>
      )}
    </div>
  );
}
