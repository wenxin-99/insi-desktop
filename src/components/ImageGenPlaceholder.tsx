/**
 * ImageGenPlaceholder — 图片生成过程中的渐进式动画占位符
 *
 * 在 AI 生成图片的 10-30 秒等待期间，展示一个视觉丰富的动画占位卡片：
 *   - 柔和的渐变色块动画模拟"画面成型"
 *   - 时间估算进度条
 *   - 阶段文字提示
 *   - 可选的 prompt 预览
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';

interface ImageGenPlaceholderProps {
  prompt?: string;
  className?: string;
}

// 生成阶段定义
const PHASES = [
  { label: '准备画布', duration: 3 },
  { label: '构图布局', duration: 5 },
  { label: '绘制细节', duration: 12 },
  { label: '渲染光影', duration: 8 },
  { label: '精修优化', duration: 5 },
] as const;

const TOTAL_ESTIMATED = PHASES.reduce((s, p) => s + p.duration, 0); // ~33s

export function ImageGenPlaceholder({ prompt, className }: ImageGenPlaceholderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const startTimeRef = useRef(Date.now());
  const [elapsed, setElapsed] = useState(0);
  const [currentPhase, setCurrentPhase] = useState(0);

  // 计时 & 阶段推进
  useEffect(() => {
    const timer = setInterval(() => {
      const e = (Date.now() - startTimeRef.current) / 1000;
      setElapsed(e);

      let accumulated = 0;
      for (let i = 0; i < PHASES.length; i++) {
        accumulated += PHASES[i].duration;
        if (e < accumulated) { setCurrentPhase(i); break; }
        if (i === PHASES.length - 1) setCurrentPhase(PHASES.length - 1);
      }
    }, 200);
    return () => clearInterval(timer);
  }, []);

  // Canvas 动画 — 柔和的有机渐变色块
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // 使用 CSS 尺寸（逻辑像素）进行绘图计算
    const W = canvas.clientWidth || canvas.width;
    const H = canvas.clientHeight || canvas.height;
    const t = (Date.now() - startTimeRef.current) / 1000;
    const progress = Math.min(t / TOTAL_ESTIMATED, 1);

    // 清空
    ctx.clearRect(0, 0, W, H);

    // 基底渐变 — 随时间从冷色调逐渐变暖
    const baseGrad = ctx.createLinearGradient(0, 0, W, H);
    const warmth = progress * 0.3;
    baseGrad.addColorStop(0, `hsl(${250 - warmth * 40}, ${30 + progress * 25}%, ${94 - progress * 6}%)`);
    baseGrad.addColorStop(0.5, `hsl(${270 - warmth * 30}, ${25 + progress * 20}%, ${92 - progress * 5}%)`);
    baseGrad.addColorStop(1, `hsl(${260 - warmth * 50}, ${28 + progress * 22}%, ${95 - progress * 7}%)`);
    ctx.fillStyle = baseGrad;
    ctx.fillRect(0, 0, W, H);

    // 有机色块（4-6 个缓慢移动的椭圆，随进度增加对比度和清晰度）
    const blobs = [
      { cx: 0.3, cy: 0.35, rx: 0.28, ry: 0.22, hue: 255, speed: 0.15, phase: 0 },
      { cx: 0.7, cy: 0.6, rx: 0.25, ry: 0.3, hue: 280, speed: 0.12, phase: 2 },
      { cx: 0.5, cy: 0.25, rx: 0.35, ry: 0.18, hue: 240, speed: 0.1, phase: 4 },
      { cx: 0.25, cy: 0.7, rx: 0.2, ry: 0.25, hue: 300, speed: 0.18, phase: 1 },
      { cx: 0.8, cy: 0.3, rx: 0.22, ry: 0.2, hue: 220, speed: 0.14, phase: 3 },
    ];

    for (const b of blobs) {
      const cx = W * (b.cx + Math.sin(t * b.speed + b.phase) * 0.08);
      const cy = H * (b.cy + Math.cos(t * b.speed * 0.8 + b.phase) * 0.06);
      const rx = W * b.rx * (0.8 + Math.sin(t * b.speed * 0.5) * 0.2);
      const ry = H * b.ry * (0.8 + Math.cos(t * b.speed * 0.6) * 0.2);

      const alpha = 0.04 + progress * 0.12;
      const sat = 20 + progress * 30;
      const light = 75 - progress * 15;

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      grad.addColorStop(0, `hsla(${b.hue + Math.sin(t * 0.3) * 15}, ${sat}%, ${light}%, ${alpha})`);
      grad.addColorStop(0.6, `hsla(${b.hue + 20}, ${sat * 0.7}%, ${light + 10}%, ${alpha * 0.5})`);
      grad.addColorStop(1, `hsla(${b.hue}, ${sat * 0.5}%, ${light + 15}%, 0)`);

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, Math.sin(t * b.speed * 0.3) * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    }

    // 随进度增加的水平参考线（隐约的构图网格感）
    if (progress > 0.2) {
      const gridAlpha = Math.min((progress - 0.2) * 0.15, 0.06);
      ctx.strokeStyle = `rgba(139, 92, 246, ${gridAlpha})`;
      ctx.lineWidth = 0.5;
      // 三分线
      for (const frac of [1/3, 2/3]) {
        ctx.beginPath();
        ctx.moveTo(0, H * frac);
        ctx.lineTo(W, H * frac);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(W * frac, 0);
        ctx.lineTo(W * frac, H);
        ctx.stroke();
      }
    }

    // 随进度增加的微粒噪点（增添质感）
    if (progress > 0.15) {
      const noiseAlpha = Math.min((progress - 0.15) * 0.04, 0.025);
      const noiseCount = Math.floor(progress * 120);
      for (let i = 0; i < noiseCount; i++) {
        const nx = Math.random() * W;
        const ny = Math.random() * H;
        const size = 0.5 + Math.random() * 1.5;
        ctx.fillStyle = `rgba(100, 70, 160, ${noiseAlpha + Math.random() * 0.015})`;
        ctx.fillRect(nx, ny, size, size);
      }
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // 设置 canvas 实际尺寸（retina 友好）
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    // canvas 物理分辨率 = CSS 尺寸 × DPR
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext('2d');
    // 缩放坐标系使绘图代码用 CSS 像素
    if (ctx) ctx.scale(dpr, dpr);

    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  const progressPercent = Math.min(elapsed / TOTAL_ESTIMATED * 100, 98);

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl border border-violet-200/50 dark:border-violet-800/30",
      "bg-gradient-to-br from-violet-50/80 to-purple-50/60 dark:from-violet-950/30 dark:to-purple-950/20",
      className
    )}
      style={{ width: '100%', maxWidth: 400, aspectRatio: '1 / 1' }}
    >
      {/* 动画画布 */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
        style={{ opacity: 0.85 }}
      />

      {/* 上方扫光 */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(105deg, transparent 40%, rgba(139,92,246,0.06) 48%, rgba(255,255,255,0.12) 50%, rgba(139,92,246,0.06) 52%, transparent 60%)',
          backgroundSize: '200% 100%',
          animation: 'genSweep 3s ease-in-out infinite',
        }}
      />

      {/* 底部信息叠层 */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-white/90 via-white/60 to-transparent dark:from-gray-900/90 dark:via-gray-900/60 p-4 pt-10">
        {/* 阶段文字 */}
        <div className="flex items-center gap-2 mb-2.5">
          {/* 旋转的小图标 */}
          <div className="relative w-4 h-4 shrink-0">
            <div
              className="absolute inset-0 rounded-full border-2 border-violet-400/40"
              style={{ borderTopColor: 'rgb(139 92 246)', animation: 'genSpin 1s linear infinite' }}
            />
          </div>
          <span className="text-xs font-medium text-violet-600 dark:text-violet-400">
            {PHASES[currentPhase]?.label || '渲染中'}
          </span>
          <span className="text-[10px] text-muted-foreground/50 tabular-nums ml-auto">
            {Math.floor(elapsed)}s
          </span>
        </div>

        {/* 进度条 */}
        <div className="h-1 rounded-full bg-violet-200/60 dark:bg-violet-800/40 overflow-hidden mb-2">
          <div
            className="h-full rounded-full bg-gradient-to-r from-violet-400 to-purple-500 transition-[width] duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Prompt 预览 */}
        {prompt && (
          <p className="text-[10px] leading-relaxed text-muted-foreground/60 line-clamp-2 mt-1">
            <span className="text-violet-500/70 font-medium">Prompt: </span>
            {prompt}
          </p>
        )}
      </div>

      {/* CSS */}
      <style>{`
        @keyframes genSweep {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        @keyframes genSpin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
