/**
 * AiLogo — 全局统一的 AI 头像/Logo 组件
 *
 * 静态模式：纯 <img> 无额外 DOM
 * 动画模式：Logo 自转 + 双光点螺旋环绕 + 外发光脉冲
 *
 *   <AiLogo />                    // 静态，默认 28px
 *   <AiLogo animated />           // 旋涡动画（AI 回答中）
 *   <AiLogo size="sm" />          // 24px
 *   <AiLogo size="xs" animated /> // 16px 行内指示器
 */

import { cn } from '@/lib/utils';

interface AiLogoProps {
  /** 尺寸预设: xs=16px, sm=24px, md=28px(默认), lg=36px */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** 是否启用旋涡动画（AI 正在回答时开启） */
  animated?: boolean;
  /** 额外 className */
  className?: string;
}

// 各尺寸的像素值（用于精确计算轨道半径和光点大小）
const PX: Record<string, number> = { xs: 16, sm: 24, md: 28, lg: 36 };

export function AiLogo({ size = 'md', animated = false, className }: AiLogoProps) {
  const px = PX[size] ?? 28;

  // 静态模式 — 零额外 DOM
  if (!animated) {
    return (
      <img
        src="/ai-avatar.png"
        alt="AI"
        style={{ width: px, height: px }}
        className={cn('rounded-full flex-shrink-0 object-cover', className)}
      />
    );
  }

  // ── 动画尺寸计算 ──
  const pad = Math.max(7, px * 0.32);        // 动画区域外扩
  const outer = px + pad * 2;                 // 总容器尺寸
  const orbitR = px * 0.58;                   // 光点公转半径
  const dotSz = Math.max(2.5, px * 0.1);     // 主光点直径
  const dotSmall = dotSz * 0.65;             // 副光点直径

  return (
    <div
      className={cn('flex-shrink-0', className)}
      style={{
        width: outer,
        height: outer,
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* ── Keyframes（多实例安全，浏览器会去重同名 keyframes） ── */}
      <style>{`
        @keyframes _ai-spin { to { transform: rotate(360deg); } }
        @keyframes _ai-glow {
          0%, 100% { opacity: .2; transform: scale(1); }
          50%      { opacity: .65; transform: scale(1.18); }
        }
        @keyframes _ai-orbitA {
          from { transform: rotate(0deg)   translateX(var(--_ai-r)) rotate(0deg); }
          to   { transform: rotate(360deg) translateX(var(--_ai-r)) rotate(-360deg); }
        }
        @keyframes _ai-orbitB {
          from { transform: rotate(180deg) translateX(var(--_ai-r)) rotate(-180deg); }
          to   { transform: rotate(540deg) translateX(var(--_ai-r)) rotate(-540deg); }
        }
      `}</style>

      {/* ── 外发光脉冲 ── */}
      <div
        style={{
          position: 'absolute',
          inset: -2,
          borderRadius: '50%',
          boxShadow: `0 0 ${px * 0.5}px ${px * 0.14}px rgba(14,165,233,.45)`,
          animation: '_ai-glow 2.2s ease-in-out infinite',
        }}
      />

      {/* ── 光点 A：主光点，快速公转 ── */}
      <div
        style={{
          '--_ai-r': `${orbitR}px`,
          position: 'absolute',
          width: dotSz,
          height: dotSz,
          borderRadius: '50%',
          background: '#38bdf8',
          boxShadow: `0 0 ${dotSz * 3}px ${dotSz}px rgba(56,189,248,.55), ${-dotSz * 1.5}px 0 ${dotSz * 3}px rgba(56,189,248,.2)`,
          top: '50%',
          left: '50%',
          marginTop: -dotSz / 2,
          marginLeft: -dotSz / 2,
          animation: '_ai-orbitA 1s linear infinite',
        } as React.CSSProperties}
      />

      {/* ── 光点 B：副光点，反向稍慢 ── */}
      <div
        style={{
          '--_ai-r': `${orbitR}px`,
          position: 'absolute',
          width: dotSmall,
          height: dotSmall,
          borderRadius: '50%',
          background: '#7dd3fc',
          boxShadow: `0 0 ${dotSz * 2}px ${dotSz * 0.5}px rgba(125,211,252,.4)`,
          top: '50%',
          left: '50%',
          marginTop: -dotSmall / 2,
          marginLeft: -dotSmall / 2,
          animation: '_ai-orbitB 1.6s linear infinite',
        } as React.CSSProperties}
      />

      {/* ── Logo 图片（自转 2s/圈） ── */}
      <img
        src="/ai-avatar.png"
        alt="AI"
        style={{
          width: px,
          height: px,
          borderRadius: '50%',
          objectFit: 'cover',
          animation: '_ai-spin 2s linear infinite',
          boxShadow: `0 0 ${px * 0.2}px rgba(14,165,233,.3)`,
        }}
      />
    </div>
  );
}
