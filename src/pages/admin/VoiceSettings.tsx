import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save, TestTube, Loader2, CheckCircle2, XCircle, Mic, Volume2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

interface VoiceConfig {
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
  volcengineSttAppId: string;      // STT 独立 App ID（数字）
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

const DEFAULT_CONFIG: VoiceConfig = {
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

// Provider 预设模板
const STT_TEMPLATES: Record<string, Partial<VoiceConfig>> = {
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

const TTS_TEMPLATES: Record<string, Partial<VoiceConfig>> = {
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

// 豆包可选声音列表
const VOLCENGINE_VOICES = [
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

import { SttConfigPanel } from "./voiceSettings/SttConfigPanel";
import { TtsConfigPanel } from "./voiceSettings/TtsConfigPanel";

export default function VoiceSettings({ embedded = false }: { embedded?: boolean }) {
  const [, setLocation] = useLocation();
  const [config, setConfig] = useState<VoiceConfig>(DEFAULT_CONFIG);
  const [sttTestStatus, setSttTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [sttTestMessage, setSttTestMessage] = useState("");
  const [ttsTestStatus, setTtsTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [ttsTestMessage, setTtsTestMessage] = useState("");

  // 获取语音配置
  const { data: savedConfig, isLoading } = trpc.system.getVoiceConfig.useQuery();

  // 保存语音配置
  const updateConfig = trpc.system.updateVoiceConfig.useMutation({
    onSuccess: () => {
      toast.success("语音设置已保存");
    },
    onError: (error: any) => {
      toast.error(`保存失败: ${error.message}`);
    },
  });

  // 测试 STT
  const testStt = trpc.system.testVoiceSTT.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setSttTestStatus("success");
        setSttTestMessage(data.message || "语音识别服务连接正常");
      } else {
        setSttTestStatus("error");
        setSttTestMessage(data.message || "测试失败");
      }
    },
    onError: (error: any) => {
      setSttTestStatus("error");
      setSttTestMessage(error.message || "测试失败");
    },
  });

  // 测试 TTS
  const testTts = trpc.system.testVoiceTTS.useMutation({
    onSuccess: (data) => {
      if (data.success) {
        setTtsTestStatus("success");
        setTtsTestMessage(data.message || "语音合成服务连接正常");
        // 如果返回了音频数据，播放它
        if (data.audioUrl) {
          const audio = new Audio(data.audioUrl);
          audio.play().catch(() => {});
        }
      } else {
        setTtsTestStatus("error");
        setTtsTestMessage(data.message || "测试失败");
      }
    },
    onError: (error: any) => {
      setTtsTestStatus("error");
      setTtsTestMessage(error.message || "测试失败");
    },
  });

  // 加载配置
  useEffect(() => {
    if (savedConfig) {
      setConfig({ ...DEFAULT_CONFIG, ...savedConfig });
    }
  }, [savedConfig]);

  const handleSave = () => {
    updateConfig.mutate(config);
  };

  const handleSttTest = () => {
    setSttTestStatus("testing");
    setSttTestMessage("");
    testStt.mutate({
      provider: config.sttProvider,
      geminiApiKey: config.geminiApiKey,
      dashscopeApiUrl: config.dashscopeApiUrl,
      dashscopeApiKey: config.dashscopeApiKey,
      dashscopeModel: config.dashscopeModel,
      whisperApiUrl: config.whisperApiUrl,
      whisperApiKey: config.whisperApiKey,
      whisperModel: config.whisperModel,
      volcengineAppId: config.volcengineAppId,
      volcengineAccessToken: config.volcengineAccessToken,
      volcengineSttAppId: config.volcengineSttAppId,
      volcengineSttAccessToken: config.volcengineSttAccessToken,
      volcengineSttResourceId: config.volcengineSttResourceId,
    } as any);
  };

  const handleTtsTest = () => {
    setTtsTestStatus("testing");
    setTtsTestMessage("");
    testTts.mutate({
      provider: config.ttsProvider,
      model: config.ttsProvider === "volcengine" ? (config.volcengineTtsModel || "doubao-tts-hd") : config.ttsModel,
      voice: config.ttsVoice,
      apiUrl: config.ttsApiUrl,
      apiKey: config.ttsApiKey,
      geminiApiKey: config.geminiApiKey,
      volcengineApiKey: config.volcengineApiKey,
      volcengineAppId: config.volcengineAppId,
      volcengineAccessToken: config.volcengineAccessToken,
    } as any);
  };

  const handleSttProviderChange = (value: string) => {
    const provider = value as VoiceConfig["sttProvider"];
    const template = STT_TEMPLATES[provider] || {};
    setConfig((prev) => ({ ...prev, sttProvider: provider, ...template }));
    setSttTestStatus("idle");
    setSttTestMessage("");
  };

  const handleTtsProviderChange = (value: string) => {
    const provider = value as VoiceConfig["ttsProvider"];
    const template = TTS_TEMPLATES[provider] || {};
    setConfig((prev) => ({ ...prev, ttsProvider: provider, ...template }));
    setTtsTestStatus("idle");
    setTtsTestMessage("");
  };

  const renderTestBadge = (status: string, message: string) => {
    if (status === "idle") return null;
    if (status === "testing") {
      return (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          测试中...
        </div>
      );
    }
    if (status === "success") {
      return (
        <div className="flex items-center gap-2 text-sm text-green-600 mt-2">
          <CheckCircle2 className="h-4 w-4" />
          {message}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-red-600 mt-2">
        <XCircle className="h-4 w-4" />
        {message}
      </div>
    );
  };

  const content = (
      <div className={embedded ? "space-y-6" : "container mx-auto p-4 md:p-6 max-w-4xl"}>
        {/* 返回按钮 - 仅独立模式 */}
        {!embedded && (
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => setLocation("/admin")}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            返回管理员后台
          </Button>
        </div>
        )}

        {/* 页面标题 - 仅独立模式 */}
        {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold">语音服务设置</h1>
          <p className="text-muted-foreground mt-2">
            配置语音识别（STT）和语音合成（TTS）服务，支持国内外自动切换
          </p>
        </div>
        )}

        {/* STT 语音识别配置 */}
        <SttConfigPanel config={config} setConfig={setConfig} onProviderChange={handleSttProviderChange} onTest={handleSttTest} isLoading={isLoading} sttTestStatus={sttTestStatus} sttTestMessage={sttTestMessage} renderTestBadge={renderTestBadge} />

        {/* TTS 语音合成配置 */}
        <TtsConfigPanel config={config} setConfig={setConfig} onProviderChange={handleTtsProviderChange} onTest={handleTtsTest} isLoading={isLoading} ttsTestStatus={ttsTestStatus} ttsTestMessage={ttsTestMessage} renderTestBadge={renderTestBadge} />

        {/* 保存按钮 */}
        <div className="flex justify-end">
          <Button
            onClick={handleSave}
            disabled={isLoading || updateConfig.isPending}
            className="gap-2"
            size="lg"
          >
            <Save className="h-4 w-4" />
            {updateConfig.isPending ? "保存中..." : "保存所有设置"}
          </Button>
        </div>
      </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
