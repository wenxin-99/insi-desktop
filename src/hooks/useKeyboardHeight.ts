/**
 * useKeyboardHeight — 虚拟键盘高度检测 Hook
 *
 * 利用 visualViewport API 精确检测移动端虚拟键盘弹出 / 收起，
 * 返回当前键盘高度（像素），可用于：
 *   - 输入框聚焦时调整布局，避免被键盘遮挡
 *   - "回到最新" 按钮动态定位
 *   - 替代不靠谱的 setTimeout + scrollIntoView
 *
 * 原理：
 *   window.innerHeight 是布局视口高度（不随键盘变化），
 *   visualViewport.height 是视觉视口高度（键盘弹出时缩小），
 *   两者之差即为键盘高度。
 *
 * 兼容性：
 *   - iOS 13+ / Android Chrome 62+ / 所有现代浏览器均支持
 *   - 不支持时返回 0，不影响功能（降级为无感知）
 */

import { useState, useEffect, useRef } from 'react';

export function useKeyboardHeight() {
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const isKeyboardOpenRef = useRef(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return; // 不支持 visualViewport

    let rafId: number | null = null;

    const handleResize = () => {
      // 使用 rAF 防抖，避免高频触发
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        rafId = null;
        // window.innerHeight: 布局视口（固定）
        // vv.height: 视觉视口（键盘弹出时缩小）
        const diff = Math.round(window.innerHeight - vv.height);
        // 阈值 100px：排除地址栏收缩等小幅变化
        const kb = diff > 100 ? diff : 0;
        isKeyboardOpenRef.current = kb > 0;
        setKeyboardHeight(kb);
      });
    };

    vv.addEventListener('resize', handleResize);
    // 初始化一次
    handleResize();

    return () => {
      vv.removeEventListener('resize', handleResize);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  return { keyboardHeight, isKeyboardOpen: isKeyboardOpenRef.current };
}
