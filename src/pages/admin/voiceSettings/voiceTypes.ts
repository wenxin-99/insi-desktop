/**
 * voiceTypes.ts — 语音设置共享类型与常量
 * 从 SttConfigPanel.tsx / TtsConfigPanel.tsx 提取
 */

export interface VoiceConfig {
  // STT (Speech-to-Text) 配置
  sttProvider: "auto" | "gemini" | "dashscope" | "whisper-compatible" | "volcengine";
  sttModel: string;
  geminiApiKey: string;
  dashscopeApiUrl: string;
  dashscopeApiKey: string;
  dashscopeModel: string;
  whisperApiUrl: string;
  whisperApiKey: string;
  whisperModel: string;
  // 火山引擎/豆包
  volcengineApiKey: string;
  volcengineAppId: string;
  volcengineAccessToken: string;
  volcengineSttAppId: string;
  volcengineSttAccessToken: string;
  volcengineSttResourceId: string;
  volcengineTtsModel: string;
  volcengineSttModel: string;
  // TTS (Text-to-Speech) 配置
  ttsEnabled: boolean;
  ttsProvider: "gemini" | "dashscope" | "openai-compatible" | "volcengine";
  ttsModel: string;
  ttsVoice: string;
  ttsApiUrl: string;
  ttsApiKey: string;
}

export const DEFAULT_CONFIG: VoiceConfig = {
  sttProvider: "auto",
  sttModel: "",
  geminiApiKey: "",
  dashscopeApiUrl: "https://dashscope.aliyuncs.com/compatible-mode",
  dashscopeApiKey: "",
  dashscopeModel: "qwen-omni-turbo",
  whisperApiUrl: "",
  whisperApiKey: "",
  whisperModel: "whisper-1",
  volcengineApiKey: "",
  volcengineAppId: "",
  volcengineAccessToken: "",
  volcengineSttAppId: "",
  volcengineSttAccessToken: "",
  volcengineSttResourceId: "volc.seedasr.sauc.duration",
  volcengineTtsModel: "doubao-tts-hd",
  volcengineSttModel: "doubao-asr",
  ttsEnabled: true,
  ttsProvider: "volcengine",
  ttsModel: "doubao-tts-hd",
  ttsVoice: "zh_female_wanwanxiaohe_moon_bigtts",
  ttsApiUrl: "",
  ttsApiKey: "",
};

export const STT_TEMPLATES: Record<string, Partial<VoiceConfig>> = {
  gemini: {
    sttModel: "gemini-2.0-flash",
  },
  dashscope: {
    dashscopeApiUrl: "https://dashscope.aliyuncs.com/compatible-mode",
    dashscopeModel: "qwen-omni-turbo",
  },
  "whisper-compatible": {
    whisperModel: "whisper-1",
  },
};

export const TTS_TEMPLATES: Record<string, Partial<VoiceConfig>> = {
  gemini: {
    ttsModel: "gemini-2.5-flash-preview-tts",
    ttsVoice: "Aoede",
  },
  dashscope: {
    ttsModel: "cosyvoice-v2",
    ttsVoice: "longxiaochun",
  },
  "openai-compatible": {
    ttsModel: "tts-1",
    ttsVoice: "alloy",
  },
  volcengine: {
    ttsModel: "doubao-tts-hd",
    ttsVoice: "zh_female_wanwanxiaohe_moon_bigtts",
  },
};

export const VOLCENGINE_VOICES = [
  { id: "zh_female_wanwanxiaohe_moon_bigtts", label: "暖心姐姐", desc: "温柔女声，亲切自然" },
  { id: "zh_female_maomao_bigtts", label: "萌系少女", desc: "活泼可爱，情感丰富" },
  { id: "zh_female_shuangkuaisisi_moon_bigtts", label: "爽快思思", desc: "干练清爽女声" },
  { id: "zh_female_tianmeixiaoyuan_moon_bigtts", label: "甜美小源", desc: "甜美细腻女声" },
  { id: "zh_female_yuanxin_moon_bigtts", label: "温柔小柔", desc: "柔和舒缓女声" },
  { id: "zh_male_qingsong_bigtts", label: "清爽男声", desc: "清晰流畅，商务风格" },
  { id: "zh_male_xvyuan_moon_bigtts", label: "醇厚男声", desc: "低沉有磁性" },
  { id: "zh_male_zhihao_bigtts", label: "知性男声", desc: "稳重知性，适合资讯" },
  { id: "zh_male_shaonian_bigtts", label: "阳光少年", desc: "年轻有活力" },
  { id: "zh_male_jingqiang_bigtts", label: "精强男声", desc: "干练专业" },
];
