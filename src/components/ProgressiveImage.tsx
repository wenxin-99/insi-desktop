import { useState, useEffect } from 'react';
import { ImageGenPlaceholder } from './ImageGenPlaceholder';

interface ProgressiveImageProps {
  src: string; // 高清图片URL
  placeholderSrc?: string; // 低分辨率占位图URL
  alt: string;
  className?: string;
  onClick?: () => void;
  isGenerating?: boolean; // 是否正在生成（显示生成中动效）
  generatingPrompt?: string; // 生成中的 prompt 预览
}

export function ProgressiveImage({ 
  src, 
  placeholderSrc, 
  alt, 
  className = '',
  onClick,
  isGenerating = false,
  generatingPrompt,
}: ProgressiveImageProps) {
  // 有 placeholderSrc 时从模糊图开始，否则直接加载高清图
  const [currentSrc, setCurrentSrc] = useState(placeholderSrc ?? src);
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
    setIsHighResLoaded(false);
    // 如果有占位图，先显示占位图（模糊）
    setCurrentSrc(placeholderSrc ?? src);

    const img = new Image();
    img.src = src;
    img.onload = () => {
      setCurrentSrc(src);        // 切换到高清图
      setIsHighResLoaded(true);  // 触发去模糊过渡
    };
    img.onerror = () => {
      if (placeholderSrc) {
        setCurrentSrc(placeholderSrc);
      } else {
        setHasError(true);
      }
    };
    return () => { img.onload = null; img.onerror = null; };
  }, [src, placeholderSrc]);

  // 正在生成模式：直接渲染 ImageGenPlaceholder（此时没有真实图片 URL）
  if (isGenerating) {
    return (
      <ImageGenPlaceholder
        prompt={generatingPrompt || alt}
        className={className}
      />
    );
  }

  return (
    <div className="relative overflow-hidden rounded-lg bg-muted">
      {hasError ? (
        <div
          className="flex flex-col items-center justify-center gap-2.5 py-8 px-4 bg-muted/30 rounded-xl border border-dashed border-border/60 cursor-pointer hover:bg-muted/50 transition-colors min-h-[120px]"
          onClick={() => { setHasError(false); setCurrentSrc(src); }}
        >
          <svg className="w-8 h-8 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-muted-foreground/60">图片加载失败</span>
          <span className="text-[10px] text-primary/60 hover:text-primary transition-colors">点击重试</span>
        </div>
      ) : (
        <>
          <img
            src={currentSrc}
            alt={alt}
            className={`
              ${className}
              transition-all duration-700 ease-out
              ${!isHighResLoaded && placeholderSrc ? 'blur-md scale-105' : 'blur-0 scale-100'}
            `}
            onClick={isHighResLoaded ? onClick : undefined}
            loading="lazy"
            onError={() => setHasError(true)}
          />
          {/* 加载中 spinner（仅占位图→高清图过渡时） */}
          {!isHighResLoaded && placeholderSrc && !hasError && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-violet-400 drop-shadow-md"></div>
                <span className="text-xs text-muted-foreground font-medium">
                  加载中…
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
