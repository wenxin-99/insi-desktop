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


interface TtsConfigPanelProps { config: any; setConfig: (fn: any) => void; onProviderChange: (v: string) => void; onTest: () => void; isLoading: boolean; ttsTestStatus: string; ttsTestMessage: string; renderTestBadge: (status: string, message: string) => any; }

export function TtsConfigPanel({ config, setConfig, onProviderChange: handleTtsProviderChange, onTest: handleTtsTest, isLoading, ttsTestStatus, ttsTestMessage, renderTestBadge }: TtsConfigPanelProps) {
  return (
    <>
        {/* TTS 语音合成配置 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Volume2 className="h-5 w-5" />
              语音合成（TTS）
            </CardTitle>
            <CardDescription>
              配置文字转语音服务，用于语音对话模式中 AI 回复的语音播放
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* TTS 开关 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label>启用语音合成</Label>
                <p className="text-sm text-muted-foreground">
                  开启后，语音对话模式中 AI 回复将自动朗读
                </p>
              </div>
              <Switch
                checked={config.ttsEnabled}
                onCheckedChange={(checked) => setConfig((prev) => ({ ...prev, ttsEnabled: checked }))}
              />
            </div>

            {config.ttsEnabled && (
              <>
                {/* TTS Provider 选择 */}
                <div className="space-y-2">
                  <Label>合成服务商</Label>
                  <Select value={config.ttsProvider} onValueChange={handleTtsProviderChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择服务商" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="volcengine">🔥 火山引擎·豆包（推荐）</SelectItem>
                      <SelectItem value="gemini">Google Gemini</SelectItem>
                      <SelectItem value="dashscope">阿里云 DashScope CosyVoice</SelectItem>
                      <SelectItem value="openai-compatible">OpenAI TTS 兼容</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* TTS 配置 */}
                <div className="space-y-4 p-4 border rounded-lg">
                  <h4 className="font-medium text-sm">
                    {config.ttsProvider === "volcengine" ? "🔥 火山引擎·豆包 TTS 配置"
                      : config.ttsProvider === "gemini" ? "Google Gemini TTS 配置"
                      : config.ttsProvider === "dashscope" ? "DashScope CosyVoice 配置"
                      : "OpenAI TTS 兼容 API 配置"}
                  </h4>

                  {/* 豆包专属配置 */}
                  {config.ttsProvider === "volcengine" && (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="volcengineAppId">豆包语音 App ID（数字）</Label>
                        <Input id="volcengineAppId"
                          value={config.volcengineAppId}
                          onChange={(e) => setConfig((prev) => ({ ...prev, volcengineAppId: e.target.value }))}
                          placeholder="纯数字，如 1234567890（控制台→语音合成2.0→服务详情→App ID）"
                          disabled={isLoading} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="volcengineAccessToken">Access Token</Label>
                        <Input id="volcengineAccessToken" type="password"
                          value={config.volcengineAccessToken}
                          onChange={(e) => setConfig((prev) => ({ ...prev, volcengineAccessToken: e.target.value }))}
                          placeholder="火山引擎控制台 → 语音合成2.0 → 服务详情 → Access Token"
                          disabled={isLoading} />
                      </div>
                      <div className="space-y-2">
                        <Label>模型</Label>
                        <Select value={config.volcengineTtsModel || "doubao-tts-hd"}
                          onValueChange={(v) => setConfig((prev) => ({ ...prev, volcengineTtsModel: v, ttsModel: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="doubao-tts-hd">doubao-tts-hd（高清版，推荐）</SelectItem>
                            <SelectItem value="doubao-tts">doubao-tts（标准版）</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>默认声音角色（用户可在对话界面自行切换）</Label>
                        <Select value={config.ttsVoice}
                          onValueChange={(v) => setConfig((prev) => ({ ...prev, ttsVoice: v }))}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="zh_female_wanwanxiaohe_moon_bigtts">暖心姐姐 - 温柔女声</SelectItem>
                            <SelectItem value="zh_female_maomao_bigtts">萌系少女 - 活泼可爱</SelectItem>
                            <SelectItem value="zh_female_shuangkuaisisi_moon_bigtts">爽快思思 - 干练清爽</SelectItem>
                            <SelectItem value="zh_female_tianmeixiaoyuan_moon_bigtts">甜美小源 - 甜美细腻</SelectItem>
                            <SelectItem value="zh_female_yuanxin_moon_bigtts">温柔小柔 - 柔和舒缓</SelectItem>
                            <SelectItem value="zh_male_qingsong_bigtts">清爽男声 - 清晰流畅</SelectItem>
                            <SelectItem value="zh_male_xvyuan_moon_bigtts">醇厚男声 - 低沉磁性</SelectItem>
                            <SelectItem value="zh_male_zhihao_bigtts">知性男声 - 稳重专业</SelectItem>
                            <SelectItem value="zh_male_shaonian_bigtts">阳光少年 - 年轻活力</SelectItem>
                            <SelectItem value="zh_male_jingqiang_bigtts">精强男声 - 干练专业</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">以上为系统默认，前台用户可在语音对话界面自行切换音色</p>
                      </div>
                    </div>
                  )}

                  {config.ttsProvider !== "gemini" && config.ttsProvider !== "volcengine" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ttsApiUrl">API 地址</Label>
                        <Input id="ttsApiUrl" value={config.ttsApiUrl}
                          onChange={(e) => setConfig((prev) => ({ ...prev, ttsApiUrl: e.target.value }))}
                          placeholder={config.ttsProvider === "dashscope" ? "https://dashscope.aliyuncs.com/compatible-mode" : "https://api.openai.com"}
                          disabled={isLoading} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ttsApiKey">API Key</Label>
                        <Input id="ttsApiKey" type="password" value={config.ttsApiKey}
                          onChange={(e) => setConfig((prev) => ({ ...prev, ttsApiKey: e.target.value }))}
                          placeholder="sk-..." disabled={isLoading} />
                      </div>
                    </div>
                  )}

                  {config.ttsProvider === "gemini" && (
                    <p className="text-sm text-muted-foreground">使用上方 STT 配置中的 Gemini API Key</p>
                  )}

                  {config.ttsProvider !== "volcengine" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="ttsModel">模型名称</Label>
                        <Input id="ttsModel" value={config.ttsModel}
                          onChange={(e) => setConfig((prev) => ({ ...prev, ttsModel: e.target.value }))}
                          placeholder={config.ttsProvider === "gemini" ? "gemini-2.0-flash" : config.ttsProvider === "dashscope" ? "cosyvoice-v2" : "tts-1"}
                          disabled={isLoading} />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="ttsVoice">语音角色</Label>
                        <Input id="ttsVoice" value={config.ttsVoice}
                          onChange={(e) => setConfig((prev) => ({ ...prev, ttsVoice: e.target.value }))}
                          placeholder={config.ttsProvider === "gemini" ? "Kore / Puck / Charon" : config.ttsProvider === "dashscope" ? "longxiaochun" : "alloy / nova / shimmer"}
                          disabled={isLoading} />
                        <p className="text-sm text-muted-foreground">
                          {config.ttsProvider === "gemini" ? "可选：Kore, Puck, Charon, Fenrir, Aoede, Leda, Orus, Zephyr"
                            : config.ttsProvider === "dashscope" ? "可选：longxiaochun, longhua, longshuo 等"
                            : "可选：alloy, echo, fable, onyx, nova, shimmer"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* TTS 测试按钮 */}
                <div className="flex items-center gap-4">
                  <Button
                    variant="outline"
                    onClick={handleTtsTest}
                    disabled={ttsTestStatus === "testing"}
                    className="gap-2"
                  >
                    {ttsTestStatus === "testing" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TestTube className="h-4 w-4" />
                    )}
                    测试语音合成
                  </Button>
                  {renderTestBadge(ttsTestStatus, ttsTestMessage)}
                </div>
              </>
            )}
          </CardContent>
        </Card>

    </>
  );
}