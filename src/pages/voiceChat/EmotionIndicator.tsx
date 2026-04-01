/**
 * EmotionIndicator.tsx — 情绪状态指示器
 *
 * 在语音对话界面显示检测到的用户情绪状态。
 * 轻量级浮层，不干扰主交互。
 */

import { type EmotionLabel, type EmotionState } from "./emotionDetector";

interface EmotionIndicatorProps {
  emotion: EmotionState | null;
  /** 是否处于活跃状态（录音/对话中） */
  active: boolean;
}

const EMOTION_DISPLAY: Record<EmotionLabel, { icon: string; label: string; color: string; bgColor: string }> = {
  neutral:  { icon: "😐", label: "平静",   color: "text-gray-500",   bgColor: "bg-gray-100 dark:bg-gray-800" },
  happy:    { icon: "😊", label: "愉快",   color: "text-green-600",  bgColor: "bg-green-50 dark:bg-green-950" },
  sad:      { icon: "😔", label: "低落",   color: "text-blue-600",   bgColor: "bg-blue-50 dark:bg-blue-950" },
  anxious:  { icon: "😰", label: "焦虑",   color: "text-amber-600",  bgColor: "bg-amber-50 dark:bg-amber-950" },
  excited:  { icon: "🤩", label: "兴奋",   color: "text-orange-600", bgColor: "bg-orange-50 dark:bg-orange-950" },
  tired:    { icon: "😴", label: "疲倦",   color: "text-purple-600", bgColor: "bg-purple-50 dark:bg-purple-950" },
  angry:    { icon: "😤", label: "生气",   color: "text-red-600",    bgColor: "bg-red-50 dark:bg-red-950" },
};

export function EmotionIndicator({ emotion, active }: EmotionIndicatorProps) {
  if (!active || !emotion || emotion.confidence < 0.4) return null;

  const display = EMOTION_DISPLAY[emotion.label];
  if (!display || emotion.label === "neutral") return null;

  return (
    <div
      className={[
        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium",
        "transition-all duration-500 animate-in fade-in slide-in-from-bottom-2",
        display.bgColor, display.color,
      ].join(" ")}
    >
      <span className="text-sm">{display.icon}</span>
      <span>检测到{display.label}</span>
      {emotion.confidence > 0.6 && (
        <span className="opacity-50 text-[10px]">
          {Math.round(emotion.confidence * 100)}%
        </span>
      )}
    </div>
  );
}
