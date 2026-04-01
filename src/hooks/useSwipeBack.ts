/**
 * useSwipeBack — 左边缘右滑返回手势
 *
 * ★ 改进：
 *   1. 起始区域从 50px 收窄到 20px — 避免与 iOS 系统返回手势区域重叠
 *   2. deltaX 阈值从 100px 提高到 120px — 减少误触
 *   3. 要求水平位移 > 3 倍垂直位移 — 更严格的方向判定
 *   4. 忽略水平可滚动容器内的滑动 — 代码块、表格等不误触发
 *   5. 使用 passive: true 监听，不阻塞浏览器渲染
 *   6. standalone PWA 模式才启用（普通浏览器已有返回手势）
 */

import { useEffect } from "react";

/** 检查元素或其祖先是否有水平滚动 */
function hasHorizontalScroll(el: HTMLElement | null): boolean {
  while (el) {
    if (el.scrollWidth > el.clientWidth + 2) {
      const style = getComputedStyle(el);
      const overflowX = style.overflowX;
      if (overflowX === 'auto' || overflowX === 'scroll') return true;
    }
    el = el.parentElement;
  }
  return false;
}

/** 是否在 standalone / PWA 模式下运行 */
function isStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export function useSwipeBack() {
  useEffect(() => {
    // 非 standalone 模式无需自行实现返回手势（浏览器已有）
    if (!isStandalone()) return;

    let startX = 0;
    let startY = 0;
    let startTarget: HTMLElement | null = null;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      startX = touch.screenX;
      startY = touch.screenY;
      startTarget = e.target as HTMLElement;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const touch = e.changedTouches[0];
      const deltaX = touch.screenX - startX;
      const deltaY = Math.abs(touch.screenY - startY);

      // 条件：
      //   1. 从左边缘 20px 内开始（比系统手势区域更窄）
      //   2. 水平右滑 > 120px
      //   3. 水平位移 > 3 倍垂直位移（确保是水平手势而非对角线）
      //   4. 触摸起始元素没有水平滚动（如代码块、表格）
      if (
        startX < 20 &&
        deltaX > 120 &&
        deltaX > deltaY * 3 &&
        !hasHorizontalScroll(startTarget)
      ) {
        window.history.back();
      }

      startTarget = null;
    };

    document.addEventListener("touchstart", handleTouchStart, { passive: true });
    document.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      document.removeEventListener("touchstart", handleTouchStart);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);
}
