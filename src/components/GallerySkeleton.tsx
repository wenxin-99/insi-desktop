/**
 * GallerySkeleton — 图片/视频画廊骨架屏
 *
 * 替代单个 Loader2 spinner，在加载时显示内容占位，
 * 减少布局跳动（layout shift），心理感知更快。
 *
 * 用法：
 * import { ImageGallerySkeleton, VideoGallerySkeleton } from '@/components/GallerySkeleton';
 * if (isLoading) return <ImageGallerySkeleton />;
 */

export function ImageGallerySkeleton() {
  return (
    <div className="container mx-auto py-4 md:py-8 px-4 animate-in fade-in duration-300">
      {/* 标题栏骨架 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-6 w-32 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex gap-2">
          <div className="h-9 w-20 rounded-lg bg-muted animate-pulse" />
          <div className="h-9 w-24 rounded-lg bg-muted animate-pulse" />
        </div>
      </div>

      {/* 网格骨架 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-4">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="group" style={{ animationDelay: `${i * 50}ms` }}>
            <div className="aspect-square rounded-xl bg-muted animate-pulse overflow-hidden">
              {/* 模拟图片占位渐变 */}
              <div className="w-full h-full" style={{
                background: `linear-gradient(135deg, hsl(var(--muted)) 0%, hsl(var(--muted-foreground) / 0.05) 50%, hsl(var(--muted)) 100%)`,
                backgroundSize: '200% 200%',
                animation: `shimmer 1.5s ease-in-out infinite ${i * 100}ms`,
              }} />
            </div>
            {/* 底部标签骨架 */}
            <div className="mt-2 space-y-1">
              <div className="h-3 w-4/5 rounded bg-muted animate-pulse" />
              <div className="h-2.5 w-1/2 rounded bg-muted/60 animate-pulse" />
            </div>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 200% 200%; }
          100% { background-position: -200% -200%; }
        }
      `}</style>
    </div>
  );
}

export function VideoGallerySkeleton() {
  return (
    <div className="container py-6 animate-in fade-in duration-300">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-border overflow-hidden bg-card">
            {/* 视频封面骨架 */}
            <div className="aspect-video bg-muted animate-pulse relative">
              {/* 播放按钮占位 */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-12 h-12 rounded-full bg-muted-foreground/10 animate-pulse" />
              </div>
              {/* 时长标签 */}
              <div className="absolute bottom-2 right-2 h-5 w-12 rounded bg-black/20 animate-pulse" />
            </div>
            {/* 信息区 */}
            <div className="p-3 space-y-2">
              <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
              <div className="flex items-center gap-2">
                <div className="h-3 w-16 rounded bg-muted/60 animate-pulse" />
                <div className="h-3 w-20 rounded bg-muted/60 animate-pulse" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
