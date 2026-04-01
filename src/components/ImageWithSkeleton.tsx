import { useState, useEffect, useRef } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Loader2 } from "lucide-react";
import { safeToast } from "@/lib/safeToast";

interface ImageWithSkeletonProps {
  src: string;
  alt: string;
  className?: string;
  onClick?: () => void;
  thumbnail?: boolean; // 是否显示为缩略图模式
  onDownload?: (src: string, alt: string) => void; // 自定义下载函数
}

export function ImageWithSkeleton({ src, alt, className = "", onClick, thumbnail = false, onDownload }: ImageWithSkeletonProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isInView, setIsInView] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);
  const imgRef = useRef<HTMLDivElement>(null);

  // 懒加载：使用 Intersection Observer
  useEffect(() => {
    if (!imgRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setIsInView(true);
            observer.disconnect();
          }
        });
      },
      {
        rootMargin: "50px", // 提前50px开始加载
      }
    );

    observer.observe(imgRef.current);

    return () => {
      observer.disconnect();
    };
  }, []);

  // 下载图片函数
  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation(); // 阻止触发onClick
    console.log("[ImageWithSkeleton] Download clicked", { src, alt });
    
    if (onDownload) {
      // 使用自定义下载函数
      onDownload(src, alt);
    } else {
      // 默认下载方式：使用fetch+Blob解决CORS问题
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error("下载失败");
        
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        
        // 生成时间戳文件名：image_20260128_151230.png
        const now = new Date();
        const timestamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, '').replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/, '$1$2$3_$4$5$6');
        const filename = `image_${timestamp}.png`;
        
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        URL.revokeObjectURL(blobUrl);
        safeToast.success("下载成功");
        console.log("[ImageWithSkeleton] Download completed");
      } catch (error) {
        console.error("[ImageWithSkeleton] Download failed:", error);
        safeToast.error("下载失败");
      }
    }
  };

  return (
    <div 
      ref={imgRef} 
      className={`relative group ${className}`}
    >
      {isLoading && (
        <div className="absolute inset-0 rounded-lg bg-muted flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{loadProgress}%</span>
          </div>
        </div>
      )}
      {isInView && (
        <>
          <img
            src={src}
            alt={alt}
            className={`rounded-lg ${
              thumbnail 
                ? "w-24 h-24 object-cover" 
                : "max-w-full h-auto object-cover"
            } cursor-pointer hover:opacity-80 transition-all duration-500 ${
              isLoading ? "opacity-0 blur-lg scale-95" : "opacity-100 blur-0 scale-100"
            }`}
            onLoad={() => {
              setLoadProgress(100);
              setTimeout(() => setIsLoading(false), 100);
            }}
            onError={() => {
              setLoadProgress(100);
              setIsLoading(false);
            }}
            onProgress={(e: any) => {
              if (e.lengthComputable) {
                const progress = Math.round((e.loaded / e.total) * 100);
                setLoadProgress(progress);
              }
            }}
            onClick={(e) => {
              console.log("[ImageWithSkeleton] Image clicked", { src, alt });
              if (onClick) {
                onClick();
              }
            }}
          />
          
          {/* 下载按钮 - 缩略图模式下显示，移动端始终显示 */}
          {thumbnail && !isLoading && (
            <button
              onClick={handleDownload}
              className="absolute top-1 right-1 p-2 rounded-md bg-black/70 hover:bg-black/90 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:scale-110"
              title="下载图片"
            >
              <Download className="h-4 w-4" />
            </button>
          )}
        </>
      )}
    </div>
  );
}
