import { useState, useEffect, useRef } from "react";

/**
 * 打字机效果Hook
 * 将接收到的文本以固定速度逐字显示
 * @param sourceText 源文本（来自流式输出）
 * @param speed 打字速度（毫秒/字符），默认30ms
 * @param enabled 是否启用打字机效果，默认true
 * @returns 当前显示的文本
 */
export function useTypewriterEffect(
  sourceText: string,
  speed: number = 30,
  enabled: boolean = true
): string {
  const [displayedText, setDisplayedText] = useState("");
  const sourceTextRef = useRef(sourceText);
  const displayedLengthRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    sourceTextRef.current = sourceText;

    // 如果禁用打字机效果，直接显示全部文本
    if (!enabled) {
      setDisplayedText(sourceText);
      displayedLengthRef.current = sourceText.length;
      return;
    }

    // 如果源文本变短了（例如重置），重置显示
    if (sourceText.length < displayedLengthRef.current) {
      setDisplayedText(sourceText);
      displayedLengthRef.current = sourceText.length;
      return;
    }

    // 如果已经显示完全部内容，不需要继续
    if (displayedLengthRef.current >= sourceText.length) {
      return;
    }

    // 清除之前的定时器
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // 启动打字机效果
    timerRef.current = setInterval(() => {
      const currentSource = sourceTextRef.current;
      const currentDisplayed = displayedLengthRef.current;

      if (currentDisplayed >= currentSource.length) {
        // 已经显示完全部内容，停止定时器
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
        return;
      }

      // 每次显示1个字符
      const nextLength = currentDisplayed + 1;
      setDisplayedText(currentSource.slice(0, nextLength));
      displayedLengthRef.current = nextLength;
    }, speed);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [sourceText, speed, enabled]);

  return displayedText;
}
