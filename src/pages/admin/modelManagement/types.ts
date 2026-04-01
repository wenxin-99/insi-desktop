/**
 * modelManagement/types — 共享类型与工具函数
 *
 * ★ 改动：
 *   1. ModelFormData 新增 capabilities: string[]
 *   2. type 联合扩展 "embedding" | "rerank"
 *   3. MODEL_TYPE_LABELS 对应新增
 */

export interface ModelFormData {
  name: string;
  modelIdentifier: string;
  displayName: string;
  description: string;
  type:
    | "chat"
    | "image"
    | "video"
    | "vision"
    | "tts"
    | "asr"
    | "text"
    | "transcription"
    | "search"
    | "embedding"   // ← 新增
    | "rerank";      // ← 新增
  costPerUse: string;
  enabled: boolean;
  source: "builtin" | "custom";
  apiEndpoint: string;
  apiKey: string;
  apiModel: string;
  tier: "lite" | "pro" | "max";
  visibleToUser: boolean;
  supportsVision: boolean;
  // ★ 新增：能力标签
  capabilities: string[];
  // 图片模型专属
  imageProvider:
    | ""
    | "auto"
    | "gemini-native"
    | "google-imagen"
    | "dashscope-async"
    | "dashscope-image-edit"
    | "openai-compatible"
    | "forge";
  imageAspectRatio: string;
  // 视频模型专属
  videoCost5s: string;
  videoCost10s: string;
}

export const DEFAULT_FORM_DATA: ModelFormData = {
  name: "",
  modelIdentifier: "",
  displayName: "",
  description: "",
  type: "chat",
  costPerUse: "0.10",
  enabled: true,
  source: "custom",
  apiEndpoint: "",
  apiKey: "",
  apiModel: "",
  tier: "pro",
  visibleToUser: false,
  supportsVision: false,
  capabilities: [],       // ← 新增
  imageProvider: "",
  imageAspectRatio: "1:1",
  videoCost5s: "30",
  videoCost10s: "50",
};

/** 根据 API 端点 URL + 模型名 自动推断图片生成协议（与服务端 autoDetect.ts 同步） */
export function autoDetectImageProvider(endpoint: string, modelName?: string): string {
  if (!endpoint) return "";
  const url = endpoint.toLowerCase();
  const model = (modelName || '').toLowerCase();

  // Google 系
  if (url.includes('googleapis.com')) {
    if (model.includes('imagen') || url.includes(':predict') || url.includes('generateimages')) {
      return 'google-imagen';
    }
    return 'gemini-native';
  }
  // 阿里云 DashScope
  if (url.includes('dashscope.aliyuncs.com')) {
    if (url.includes('/image2image/') || (url.includes('image-synthesis') && model.includes('edit'))) {
      return 'dashscope-image-edit';
    }
    if (url.includes('/services/aigc/')) return 'dashscope-async';
    return 'openai-compatible';
  }
  // Forge / ComfyUI
  if (url.includes('forge') || url.includes('comfyui') || url.includes('webui') ||
      url.includes('127.0.0.1:7860') || url.includes('localhost:7860')) {
    return 'forge';
  }
  return 'openai-compatible';
}

/** 构建 config JSON（图片/视频模型专属） */
export function buildConfigJson(formData: ModelFormData): string | undefined {
  if (formData.type === "image") {
    const provider = formData.imageProvider && formData.imageProvider !== 'auto'
      ? formData.imageProvider
      : autoDetectImageProvider(formData.apiEndpoint, formData.apiModel);
    return JSON.stringify({
      imageProvider: provider || undefined,
      aspectRatio: formData.imageAspectRatio || "1:1",
    });
  }
  if (formData.type === "video") {
    return JSON.stringify({
      videoCost: {
        cost5s: parseFloat(formData.videoCost5s) || 30,
        cost10s: parseFloat(formData.videoCost10s) || 50,
      },
    });
  }
  return undefined;
}

/** 模型类型对应的显示标签 */
export const MODEL_TYPE_LABELS: Record<string, string> = {
  chat: "💬 对话/推理",
  image: "🎨 图片生成",
  video: "🎬 视频生成",
  tts: "🔊 语音合成",
  asr: "🎤 语音识别",
  vision: "👁 视觉理解",
  search: "🌐 搜索API",
  text: "📝 文本",
  transcription: "🎤 语音",
  embedding: "📐 向量嵌入",   // ← 新增
  rerank: "🔀 重排序",        // ← 新增
};

/** 图片协议的中文标签 */
export const IMAGE_PROVIDER_LABELS: Record<string, string> = {
  "gemini-native": "Gemini原生",
  "openai-compatible": "OpenAI兼容",
  "dashscope-async": "DashScope异步",
  "dashscope-image-edit": "DashScope编辑",
  "google-imagen": "Imagen",
  forge: "Forge",
};
