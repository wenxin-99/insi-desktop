/**
 * modelManagement/ImageProviderSelect — 图片生成配置面板
 *
 * ★ Step 2: 一键预设 + 自动检测 + 高级手动覆盖
 *
 * 三层体验：
 *   1. 一键预设卡片 — 点击后自动填充端点 + 模型名 + 显示名（管理员只需粘贴 Key）
 *   2. 自动检测提示 — 绿色条实时显示推断结果
 *   3. 高级手动覆盖 — 折叠区可手动选择协议
 */
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, Sparkles, Zap, Palette, Globe } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { ModelFormData } from "./types";

// ═══ 图片模型预设库 ═══
interface ImageModelPreset {
  id: string;
  name: string;
  description: string;
  icon: typeof Sparkles;
  iconColor: string;
  bgColor: string;
  borderColor: string;
  // 自动填充到 formData 的字段
  apiEndpoint: string;
  apiModel: string;
  displayName: string;
  imageAspectRatio?: string;
}

const IMAGE_PRESETS: ImageModelPreset[] = [
  {
    id: 'gemini-flash-image',
    name: 'Gemini Flash Image',
    description: '中文文字渲染最佳，免费额度大',
    icon: Sparkles,
    iconColor: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-950/40',
    borderColor: 'border-blue-200/60 dark:border-blue-800/40',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
    apiModel: 'gemini-2.5-flash-image',
    displayName: 'Gemini 2.5 Flash Image',
  },
  {
    id: 'imagen-4',
    name: 'Imagen 4',
    description: '谷歌独立图片模型，质量高',
    icon: Palette,
    iconColor: 'text-violet-600 dark:text-violet-400',
    bgColor: 'bg-violet-50 dark:bg-violet-950/20 hover:bg-violet-100 dark:hover:bg-violet-950/40',
    borderColor: 'border-violet-200/60 dark:border-violet-800/40',
    apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-generate-001:predict',
    apiModel: 'imagen-4.0-generate-001',
    displayName: 'Google Imagen 4',
  },
  {
    id: 'wanx-turbo',
    name: '通义万相 Turbo',
    description: '阿里云，国内直连速度快',
    icon: Zap,
    iconColor: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50 dark:bg-orange-950/20 hover:bg-orange-100 dark:hover:bg-orange-950/40',
    borderColor: 'border-orange-200/60 dark:border-orange-800/40',
    apiEndpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis',
    apiModel: 'wanx2.1-t2i-turbo',
    displayName: '通义万相 2.1 Turbo',
  },
  {
    id: 'openai-dalle',
    name: 'DALL·E 3',
    description: 'OpenAI 或兼容 API',
    icon: Globe,
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 dark:hover:bg-emerald-950/40',
    borderColor: 'border-emerald-200/60 dark:border-emerald-800/40',
    apiEndpoint: 'https://api.openai.com/v1',
    apiModel: 'dall-e-3',
    displayName: 'DALL·E 3',
  },
];

// ═══ 前端版自动推断（与服务端 autoDetect.ts 同逻辑） ═══
function autoDetectProvider(endpoint: string, modelName: string): string {
  const url = (endpoint || '').toLowerCase().trim();
  const model = (modelName || '').toLowerCase().trim();

  if (url.includes('googleapis.com')) {
    if (model.includes('imagen') || url.includes(':predict') || url.includes('generateimages')) {
      return 'google-imagen';
    }
    return 'gemini-native';
  }
  if (url.includes('dashscope.aliyuncs.com')) {
    if (url.includes('/image2image/') || (url.includes('image-synthesis') && model.includes('edit'))) {
      return 'dashscope-image-edit';
    }
    if (url.includes('/services/aigc/')) return 'dashscope-async';
    return 'openai-compatible';
  }
  if (url.includes('forge') || url.includes('comfyui') || url.includes('webui') ||
      url.includes('127.0.0.1:7860') || url.includes('localhost:7860')) {
    return 'forge';
  }
  return 'openai-compatible';
}

const PROVIDER_LABELS: Record<string, string> = {
  "gemini-native": "Gemini 原生图片生成",
  "google-imagen": "Google Imagen",
  "openai-compatible": "OpenAI 兼容",
  "dashscope-async": "阿里 DashScope 异步",
  "dashscope-image-edit": "阿里 DashScope 图像编辑",
  "forge": "Forge / ComfyUI",
};

interface ImageProviderSelectProps {
  formData: ModelFormData;
  setFormData: (updater: ModelFormData | ((prev: ModelFormData) => ModelFormData)) => void;
}

export function ImageProviderSelect({ formData, setFormData }: ImageProviderSelectProps) {
  const [showAdvanced, setShowAdvanced] = useState(
    !!formData.imageProvider && formData.imageProvider !== 'auto' && formData.imageProvider !== ''
  );

  const isAutoMode = !formData.imageProvider || formData.imageProvider === '' || formData.imageProvider === 'auto';
  const detected = autoDetectProvider(formData.apiEndpoint || '', formData.apiModel || '');
  const effectiveProvider = isAutoMode ? detected : formData.imageProvider;

  // 根据当前 formData 判断哪个预设被选中
  const activePreset = IMAGE_PRESETS.find(p =>
    formData.apiEndpoint === p.apiEndpoint && formData.apiModel === p.apiModel
  );

  const handlePresetClick = (preset: ImageModelPreset) => {
    setFormData((prev: ModelFormData) => ({
      ...prev,
      apiEndpoint: preset.apiEndpoint,
      apiModel: preset.apiModel,
      displayName: prev.displayName || preset.displayName,
      name: prev.name || preset.apiModel,
      imageProvider: '',  // 清空 → 走自动检测
      imageAspectRatio: preset.imageAspectRatio || prev.imageAspectRatio || '1:1',
      type: 'image' as const,
    }));
    toast.success(`已应用预设：${preset.name}`, {
      description: '端点和模型名已自动填入，只需粘贴 API Key 即可',
      duration: 3000,
    });
  };

  return (
    <div className="border-t pt-4">
      <h3 className="font-semibold mb-3">🎨 图片生成配置</h3>
      <div className="space-y-3">

        {/* ═══ 一键预设卡片 ═══ */}
        <div>
          <Label className="text-xs text-muted-foreground mb-2 block">一键配置（点击自动填充端点和模型名）</Label>
          <div className="grid grid-cols-2 gap-2">
            {IMAGE_PRESETS.map((preset) => {
              const Icon = preset.icon;
              const isActive = activePreset?.id === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handlePresetClick(preset)}
                  className={cn(
                    "flex items-start gap-2.5 p-2.5 rounded-lg border text-left transition-all duration-150",
                    preset.bgColor,
                    isActive
                      ? `${preset.borderColor} ring-1 ring-offset-1 ring-current shadow-sm`
                      : `${preset.borderColor}`,
                  )}
                >
                  <Icon className={cn("h-4 w-4 mt-0.5 shrink-0", preset.iconColor)} />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-foreground leading-tight">{preset.name}</div>
                    <div className="text-[10px] text-muted-foreground leading-snug mt-0.5">{preset.description}</div>
                  </div>
                  {isActive && (
                    <div className="ml-auto shrink-0 w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ═══ 自动检测结果展示 ═══ */}
        {formData.apiEndpoint && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200/50 dark:border-emerald-800/30">
            <div className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
            <span className="text-xs text-emerald-700 dark:text-emerald-400">
              {isAutoMode ? '自动检测' : '手动指定'}协议：
            </span>
            <span className="text-xs font-medium text-emerald-800 dark:text-emerald-300">
              {PROVIDER_LABELS[effectiveProvider] || effectiveProvider}
            </span>
            {isAutoMode && (
              <span className="text-[10px] text-emerald-600/60 dark:text-emerald-400/50 ml-auto">
                从端点 URL 推断
              </span>
            )}
          </div>
        )}

        {/* ═══ 高级选项折叠 ═══ */}
        <button
          type="button"
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowAdvanced(!showAdvanced)}
        >
          <ChevronDown className={cn(
            "h-3 w-3 transition-transform duration-200",
            showAdvanced && "rotate-180"
          )} />
          高级：手动指定 API 协议
        </button>

        {showAdvanced && (
          <div className="ml-4 space-y-3 border-l-2 border-muted pl-3">
            <div>
              <Label>
                API 协议{" "}
                <span className="text-xs text-muted-foreground font-normal ml-1">
                  留空 = 自动检测（推荐）
                </span>
              </Label>
              <Select
                value={formData.imageProvider || 'auto'}
                onValueChange={(value) => {
                  setFormData((prev: ModelFormData) => ({
                    ...prev,
                    imageProvider: value === 'auto' ? '' : value,
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">🔍 自动检测（推荐）</SelectItem>
                  <SelectItem value="gemini-native">Gemini 原生图片生成</SelectItem>
                  <SelectItem value="google-imagen">Google Imagen</SelectItem>
                  <SelectItem value="openai-compatible">OpenAI 兼容</SelectItem>
                  <SelectItem value="dashscope-async">阿里 DashScope 异步</SelectItem>
                  <SelectItem value="dashscope-image-edit">阿里 DashScope 图像编辑</SelectItem>
                  <SelectItem value="forge">Forge / ComfyUI</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        {/* ═══ 宽高比（始终显示） ═══ */}
        <div>
          <Label>默认宽高比</Label>
          <Select
            value={formData.imageAspectRatio}
            onValueChange={(value) =>
              setFormData((prev: ModelFormData) => ({ ...prev, imageAspectRatio: value }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1:1">1:1（方形）</SelectItem>
              <SelectItem value="16:9">16:9（横屏）</SelectItem>
              <SelectItem value="9:16">9:16（竖屏）</SelectItem>
              <SelectItem value="4:3">4:3</SelectItem>
              <SelectItem value="3:4">3:4</SelectItem>
              <SelectItem value="3:2">3:2</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
