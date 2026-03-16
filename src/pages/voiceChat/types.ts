/**
 * VoiceChat 共享类型和常量
 */

// 语音对话的状态
export type VoiceChatStatus = "idle" | "listening" | "processing" | "speaking" | "thinking";

// 对话消息
export interface VoiceMessage {
  role: "user" | "assistant";
  text: string;
  timestamp: number;
}

// 语言选项
export const LANGUAGES = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
  { value: "auto", label: "自动检测" },
];

// 音色标签
export const VOICE_LABELS: Record<string, string> = {
  "zh_female_wanwanxiaohe_moon_bigtts": "暖心姐姐（大模型）",
  "zh_female_maomao_bigtts": "萌系少女（大模型）",
  "zh_female_shuangkuaisisi_moon_bigtts": "爽快思思（大模型）",
  "zh_female_tianmeixiaoyuan_moon_bigtts": "甜美小源（大模型）",
  "zh_male_qingsong_bigtts": "清爽男声（大模型）",
  "zh_male_xvyuan_moon_bigtts": "醇厚男声（大模型）",
  "BV001_streaming": "标准女声 A（标准）",
  "BV002_streaming": "标准男声 A（标准）",
  "BV700_streaming": "温柔女声（标准）",
  "BV701_streaming": "知性女声（标准）",
};

// 套餐档位配色（用于卡片边框和标签）
export const TIER_COLORS: Record<string, { border: string; badge: string; badgeText: string; glow: string }> = {
  free:     { border: "border-gray-200 dark:border-gray-700", badge: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", badgeText: "体验", glow: "" },
  standard: { border: "border-blue-200 dark:border-blue-800", badge: "bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-400", badgeText: "标准", glow: "" },
  advanced: { border: "border-amber-200 dark:border-amber-800", badge: "bg-amber-50 text-amber-600 dark:bg-amber-950 dark:text-amber-400", badgeText: "进阶", glow: "shadow-amber-200/30 dark:shadow-amber-800/20" },
  premium:  { border: "border-purple-200 dark:border-purple-800", badge: "bg-purple-50 text-purple-600 dark:bg-purple-950 dark:text-purple-400", badgeText: "旗舰", glow: "shadow-purple-200/30 dark:shadow-purple-800/20" },
};

// 使用量检查结果
export interface VoiceUsageInfo {
  usedToday: number;
  dailyLimit: number;
  fishCoinCost: number;
  canUse: boolean;
  reason: string;
  tier: string;
  packageName: string;
}

// 录音波形动画样式（注入一次）
if (typeof document !== 'undefined' && !document.getElementById('voice-bar-style')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'voice-bar-style';
  styleEl.textContent = `
    @keyframes voiceBar {
      from { transform: scaleY(1); }
      to   { transform: scaleY(2.5); }
    }
  `;
  document.head.appendChild(styleEl);
}

// 状态文本
export function getStatusText(state: VoiceChatStatus): string {
  switch (state) {
    case "idle": return "点击麦克风开始对话";
    case "listening": return "正在聆听...";
    case "processing": return "正在识别语音...";
    case "thinking": return "AI 正在思考...";
    case "speaking": return "AI 正在回答...";
    default: return "";
  }
}

// 主按钮样式
export function getButtonStyle(state: VoiceChatStatus): string {
  switch (state) {
    case "listening": return "bg-red-500 hover:bg-red-600 shadow-red-500/30";
    case "processing": case "thinking": return "bg-amber-500 hover:bg-amber-600 shadow-amber-500/30";
    case "speaking": return "bg-green-500 hover:bg-green-600 shadow-green-500/30";
    default: return "bg-blue-500 hover:bg-blue-600 shadow-blue-500/30";
  }
}

// 波形颜色
export function getVisualizerColor(state: VoiceChatStatus): string {
  switch (state) {
    case "listening": return "#ef4444";
    case "processing": case "thinking": return "#f59e0b";
    case "speaking": return "#22c55e";
    default: return "#3b82f6";
  }
}
