/**
 * types.ts 增量补丁 — 在现有 types.ts 末尾追加以下内容
 */

// ═══════════ 情绪感知类型（re-export） ═══════════
export type { EmotionLabel, EmotionState, AudioFeatures } from "./emotionDetector";

// ═══════════ 翻译模式类型（re-export） ═══════════
export type { TranslationConfig, TranslationScenario } from "./translationMode";
export { TRANSLATION_PRESETS, SUPPORTED_LANGUAGES, getLangLabel } from "./translationMode";

// ═══════════ 打断恢复（re-export） ═══════════
export type { InterruptionRecord } from "./interruptionTracker";
