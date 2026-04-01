/**
 * SlideBlock — ```slide 代码块渲染组件
 *
 * AI 输出 JSON，前端渲染为可翻页的幻灯片预览。
 *
 * JSON Schema:
 * {
 *   "title": "产品发布会",
 *   "slides": [
 *     {"title":"市场背景","bullets":["AI 市场 1850 亿美元","年增长率 42%"],"note":"开场数据"},
 *     {"title":"核心功能","bullets":["智能对话","数据分析","自动化任务"]},
 *     {"title":"技术架构","bullets":["React + Node.js","MySQL + Redis","Docker 容器化"]}
 *   ]
 * }
 */

import { memo, useState, useCallback } from 'react';
import { Presentation, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════
interface SlideItem {
  title: string;
  subtitle?: string;
  bullets?: string[];
  note?: string;
}

interface SlideData {
  title?: string;
  slides: SlideItem[];
}

interface SlideBlockProps {
  jsonStr: string;
  streaming?: boolean;
}

/** 从不完整 JSON 中提取 title */
function extractPartialMeta(str: string): { title?: string } {
  return { title: str.match(/"title"\s*:\s*"([^"]*)/)?.[1] };
}

// ═══════ 幻灯片背景渐变 ═══════
const SLIDE_GRADIENTS = [
  'from-indigo-600 to-blue-700',
  'from-emerald-600 to-teal-700',
  'from-violet-600 to-purple-700',
  'from-rose-600 to-pink-700',
  'from-amber-600 to-orange-700',
  'from-cyan-600 to-sky-700',
  'from-fuchsia-600 to-purple-700',
  'from-lime-600 to-green-700',
];

function SlideBlockInner({ jsonStr, streaming }: SlideBlockProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ★ Hooks 必须在所有条件 return 之前
  const prev = useCallback(() => setCurrentSlide(i => Math.max(0, i - 1)), []);
  const next = useCallback(() => setCurrentSlide(i => i + 1), []);

  let parsed: SlideData | null = null;
  let parseError: string | null = null;
  { const r = safeParseJson<any>(jsonStr); parseError = r.error;
    // ★ 兼容裸数组
    parsed = Array.isArray(r.data) ? { slides: r.data } : r.data;
  }

  // 流式骨架
  if (!parsed && streaming) {
    const partial = extractPartialMeta(jsonStr);
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-2 mb-3">
            <Presentation className="w-4 h-4 text-orange-500 animate-pulse" />
            <h3 className="text-sm font-medium">{partial.title || '幻灯片生成中...'}</h3>
          </div>
          <div className="aspect-[16/9] bg-gradient-to-br from-indigo-600 to-blue-700 rounded-lg animate-pulse" />
        </div>
        <div className="h-0.5 bg-muted overflow-hidden">
          <div className="h-full bg-gradient-to-r from-orange-300 via-orange-500 to-orange-300 animate-pulse" />
        </div>
      </div>
    );
  }

  if (!parsed) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>幻灯片数据格式异常，已显示原始内容</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const slides = parsed.slides || [];
  if (!slides.length) return null;

  const safeIdx = Math.min(currentSlide, slides.length - 1);
  const slide = slides[safeIdx];
  const gradient = SLIDE_GRADIENTS[safeIdx % SLIDE_GRADIENTS.length];
  const isFirst = safeIdx === 0;
  const isTitleSlide = isFirst && parsed.title;

  return (
    <div className={cn(
      'my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm',
      isFullscreen && 'fixed inset-4 z-50 rounded-2xl shadow-2xl flex flex-col'
    )}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Presentation className="w-4 h-4 text-orange-500" />
          <h3 className="text-sm font-medium">{parsed.title || '演示文稿'}</h3>
          <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
            {safeIdx + 1}/{slides.length}
          </span>
        </div>
        <button onClick={() => setIsFullscreen(!isFullscreen)}
          className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* 幻灯片内容 */}
      <div className={cn('relative', isFullscreen ? 'flex-1' : '')}>
        <div className={cn(
          'bg-gradient-to-br text-white flex flex-col justify-center px-8 py-10 sm:px-12 sm:py-14 transition-all duration-300',
          gradient,
          isFullscreen ? 'min-h-0 h-full' : 'aspect-[16/9]'
        )}>
          {/* 演示标题页（第一页特殊样式） */}
          {isTitleSlide && (
            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold mb-2 drop-shadow-lg">{parsed.title}</h2>
              <div className="w-16 h-0.5 bg-white/40 mx-auto" />
            </div>
          )}

          {/* 幻灯片标题 */}
          <h3 className={cn(
            'font-bold drop-shadow-md mb-4',
            isTitleSlide ? 'text-lg sm:text-xl text-center' : 'text-xl sm:text-2xl'
          )}>
            {slide.title}
          </h3>

          {/* 副标题 */}
          {slide.subtitle && (
            <p className="text-white/70 text-sm sm:text-base mb-4">{slide.subtitle}</p>
          )}

          {/* 要点列表 */}
          {slide.bullets && slide.bullets.length > 0 && (
            <ul className="space-y-2.5 mt-2">
              {slide.bullets.map((bullet, bi) => (
                <li key={bi} className="flex items-start gap-3 text-sm sm:text-base text-white/90">
                  <span className="w-2 h-2 rounded-full bg-white/50 flex-shrink-0 mt-2" />
                  <span className="leading-relaxed">{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {/* 页码指示器 */}
          <div className="absolute bottom-3 right-4 text-white/30 text-xs font-mono">
            {safeIdx + 1} / {slides.length}
          </div>
        </div>

        {/* 导航按钮（悬浮在幻灯片上） */}
        <button
          onClick={prev}
          disabled={safeIdx === 0}
          className={cn(
            'absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/30 transition-all',
            safeIdx === 0 && 'opacity-0 pointer-events-none'
          )}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <button
          onClick={next}
          disabled={safeIdx === slides.length - 1}
          className={cn(
            'absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/20 backdrop-blur-sm flex items-center justify-center text-white/70 hover:text-white hover:bg-black/30 transition-all',
            safeIdx === slides.length - 1 && 'opacity-0 pointer-events-none'
          )}
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 演讲备注（可选） */}
      {slide.note && (
        <div className="px-4 py-2 border-t border-border bg-muted/20 text-xs text-muted-foreground">
          <span className="font-medium">备注：</span>{slide.note}
        </div>
      )}

      {/* 底部缩略图导航 */}
      {slides.length > 1 && (
        <div className="flex gap-1.5 px-4 py-2 border-t border-border overflow-x-auto no-scrollbar">
          {slides.map((s, i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={cn(
                'flex-shrink-0 px-2.5 py-1 rounded text-[10px] font-medium transition-all whitespace-nowrap',
                i === safeIdx
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
              )}
            >
              {i + 1}. {[...s.title].length > 8 ? [...s.title].slice(0, 8).join('') + '…' : s.title}
            </button>
          ))}
        </div>
      )}

      {/* 全屏遮罩 */}
      {isFullscreen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-sm -z-10" onClick={() => setIsFullscreen(false)} />
      )}
    </div>
  );
}

export const SlideBlock = memo(SlideBlockInner);
