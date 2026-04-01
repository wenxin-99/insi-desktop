/**
 * translationMode.ts — 多语言实时翻译模式
 *
 * ChatGPT Advanced Voice Mode 支持 50+ 语言即时互译。
 * 我们通过 system prompt 工程实现类似效果，支持以下场景：
 *
 * 1. 同语言对话（默认）：用户和 AI 使用同一语言
 * 2. 实时翻译模式：用户说 A 语言，AI 用 B 语言回复
 *    - 旅行助手：用户说中文描述需求，AI 直接用当地语言说出翻译
 *    - 会议翻译：用户说英文，AI 实时翻译成中文
 * 3. 口语教练模式：AI 用目标语言回复，并在必要时解释
 * 4. 自动检测模式：检测用户语言，用指定目标语言回复
 *
 * 架构：纯 prompt 驱动，无需修改音频管线。
 * Gemini Live 和 Qwen-Omni 都原生支持多语言。
 */

// ═══════════ 类型定义 ═══════════

export type TranslationScenario =
  | "off"            // 关闭翻译，普通对话
  | "translate"      // 实时翻译：用户说 A → AI 说 B
  | "coach"          // 口语教练：AI 用目标语言 + 母语解释
  | "auto";          // 自动检测 → 目标语言回复

export interface TranslationConfig {
  scenario: TranslationScenario;
  /** 用户的母语 / 输入语言（"auto" = 自动检测） */
  sourceLang: string;
  /** 目标语言 / AI 回复语言 */
  targetLang: string;
}

export interface LanguageOption {
  code: string;
  label: string;
  nativeName: string;
  /** 对应 Gemini/Qwen 的 voice 名称建议 */
  suggestedVoice?: { gemini?: string; qwen?: string };
}

// ═══════════ 支持的语言列表 ═══════════

export const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: "zh", label: "中文", nativeName: "中文",
    suggestedVoice: { gemini: "Aoede", qwen: "Cherry" } },
  { code: "en", label: "英语", nativeName: "English",
    suggestedVoice: { gemini: "Kore", qwen: "Ethan" } },
  { code: "ja", label: "日语", nativeName: "日本語",
    suggestedVoice: { gemini: "Aoede", qwen: "Cherry" } },
  { code: "ko", label: "韩语", nativeName: "한국어",
    suggestedVoice: { gemini: "Aoede", qwen: "Cherry" } },
  { code: "es", label: "西班牙语", nativeName: "Español",
    suggestedVoice: { gemini: "Kore", qwen: "Ethan" } },
  { code: "fr", label: "法语", nativeName: "Français",
    suggestedVoice: { gemini: "Kore", qwen: "Ethan" } },
  { code: "de", label: "德语", nativeName: "Deutsch",
    suggestedVoice: { gemini: "Kore", qwen: "Ethan" } },
  { code: "pt", label: "葡萄牙语", nativeName: "Português",
    suggestedVoice: { gemini: "Kore", qwen: "Ethan" } },
  { code: "ru", label: "俄语", nativeName: "Русский",
    suggestedVoice: { gemini: "Kore", qwen: "Ethan" } },
  { code: "ar", label: "阿拉伯语", nativeName: "العربية",
    suggestedVoice: { gemini: "Puck", qwen: "Ethan" } },
  { code: "th", label: "泰语", nativeName: "ภาษาไทย",
    suggestedVoice: { gemini: "Aoede", qwen: "Cherry" } },
  { code: "vi", label: "越南语", nativeName: "Tiếng Việt",
    suggestedVoice: { gemini: "Aoede", qwen: "Cherry" } },
  { code: "id", label: "印尼语", nativeName: "Bahasa Indonesia",
    suggestedVoice: { gemini: "Kore", qwen: "Ethan" } },
  { code: "it", label: "意大利语", nativeName: "Italiano",
    suggestedVoice: { gemini: "Kore", qwen: "Ethan" } },
  { code: "auto", label: "自动检测", nativeName: "Auto" },
];

export function getLangLabel(code: string): string {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.label || code;
}

export function getLangNativeName(code: string): string {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.nativeName || code;
}

// ═══════════ Prompt 生成 ═══════════

/**
 * 根据翻译配置生成 system prompt 片段
 * 返回空字符串表示不需要翻译相关 prompt
 */
export function buildTranslationPrompt(config: TranslationConfig): string {
  if (config.scenario === "off") return "";
  // P7: 源=目标时翻译无意义，跳过
  if (config.sourceLang !== "auto" && config.sourceLang === config.targetLang) return "";

  const srcLabel = getLangLabel(config.sourceLang);
  const tgtLabel = getLangLabel(config.targetLang);
  const tgtNative = getLangNativeName(config.targetLang);

  switch (config.scenario) {
    case "translate":
      return [
        `\n[实时翻译模式]`,
        `你现在是一个实时语音翻译助手。`,
        config.sourceLang === "auto"
          ? `用户可能使用任何语言说话，请自动识别。`
          : `用户使用${srcLabel}说话。`,
        `你的回复必须全部使用${tgtLabel}（${tgtNative}）。`,
        `翻译规则：`,
        `- 直接输出翻译结果，不要加"翻译如下"之类的前缀`,
        `- 保持口语化和自然，不要书面翻译腔`,
        `- 如果用户只是在打招呼或闲聊，用${tgtLabel}自然回应即可`,
        `- 如果用户说的话有歧义，选择最自然的翻译`,
        `- 保留专有名词不翻译（人名、品牌名等）`,
      ].join("\n");

    case "coach":
      return [
        `\n[口语教练模式]`,
        `你现在是一个${tgtLabel}（${tgtNative}）口语教练。`,
        `规则：`,
        `- 主要使用${tgtLabel}回复，语速适中，用词简单`,
        `- 当用户可能听不懂时，在${tgtLabel}之后用${srcLabel}简短解释`,
        `- 如果用户尝试用${tgtLabel}说话，温和纠正发音或语法错误`,
        `- 鼓励用户多说${tgtLabel}，不要用${srcLabel}替代`,
        `- 保持耐心和鼓励的语气`,
        `- 每次回复不超过 2-3 句，等用户消化`,
      ].join("\n");

    case "auto":
      return [
        `\n[多语言自动模式]`,
        `你能识别用户使用的语言。`,
        `你的回复使用${tgtLabel}（${tgtNative}）。`,
        `- 无论用户使用什么语言，你都用${tgtLabel}回复`,
        `- 如果用户明确要求切换语言，遵从用户要求`,
        `- 保持口语化和自然`,
      ].join("\n");

    default:
      return "";
  }
}

// ═══════════ 场景预设（快速选择） ═══════════

export interface TranslationPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  config: TranslationConfig;
}

export const TRANSLATION_PRESETS: TranslationPreset[] = [
  {
    id: "off",
    name: "普通对话",
    description: "不翻译，正常对话",
    icon: "💬",
    config: { scenario: "off", sourceLang: "zh", targetLang: "zh" },
  },
  {
    id: "zh2en",
    name: "中→英翻译",
    description: "你说中文，AI 翻译成英文",
    icon: "🇺🇸",
    config: { scenario: "translate", sourceLang: "zh", targetLang: "en" },
  },
  {
    id: "en2zh",
    name: "英→中翻译",
    description: "你说英文，AI 翻译成中文",
    icon: "🇨🇳",
    config: { scenario: "translate", sourceLang: "en", targetLang: "zh" },
  },
  {
    id: "zh2ja",
    name: "中→日翻译",
    description: "你说中文，AI 翻译成日语",
    icon: "🇯🇵",
    config: { scenario: "translate", sourceLang: "zh", targetLang: "ja" },
  },
  {
    id: "auto2en",
    name: "任意→英语",
    description: "自动检测语言，翻译成英文",
    icon: "🌍",
    config: { scenario: "auto", sourceLang: "auto", targetLang: "en" },
  },
  {
    id: "coach_en",
    name: "英语口语教练",
    description: "AI 用英语对话，帮你练口语",
    icon: "🎓",
    config: { scenario: "coach", sourceLang: "zh", targetLang: "en" },
  },
  {
    id: "coach_ja",
    name: "日语口语教练",
    description: "AI 用日语对话，帮你练口语",
    icon: "🎌",
    config: { scenario: "coach", sourceLang: "zh", targetLang: "ja" },
  },
];

/**
 * 获取翻译模式推荐的语音名（匹配目标语言）
 */
export function getSuggestedVoice(
  targetLang: string,
  provider: "gemini" | "qwen-omni",
): string | undefined {
  const lang = SUPPORTED_LANGUAGES.find(l => l.code === targetLang);
  if (!lang?.suggestedVoice) return undefined;
  return provider === "gemini"
    ? lang.suggestedVoice.gemini
    : lang.suggestedVoice.qwen;
}
