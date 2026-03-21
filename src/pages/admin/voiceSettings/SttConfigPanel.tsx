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

import type { VoiceConfig } from './voiceTypes';
import { DEFAULT_CONFIG, STT_TEMPLATES, TTS_TEMPLATES, VOLCENGINE_VOICES } from './voiceTypes';


interface SttConfigPanelProps { config: any; setConfig: (fn: any) => void; onProviderChange: (v: string) => void; onTest: () => void; isLoading: boolean; sttTestStatus: string; sttTestMessage: string; renderTestBadge: (status: string, message: string) => any; }

export function SttConfigPanel({ config, setConfig, onProviderChange: handleSttProviderChange, onTest: handleSttTest, isLoading, sttTestStatus, sttTestMessage, renderTestBadge }: SttConfigPanelProps) {
  return (
    <>
        {/* STT 语音识别配置 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mic className="h-5 w-5" />
              语音识别（STT）
            </CardTitle>
            <CardDescription>
              配置语音转文字服务。支持自动检测、Google Gemini、DashScope 和 OpenAI Whisper 兼容 API
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Provider 选择 */}
            <div className="space-y-2">
              <Label>识别服务商</Label>
              <Select value={config.sttProvider} onValueChange={handleSttProviderChange}>
                <SelectTrigger>
                  <SelectValue placeholder="选择服务商" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">自动检测（推荐）</SelectItem>
                  <SelectItem value="volcengine">🔥 火山引擎·豆包（推荐）</SelectItem>
                  <SelectItem value="gemini">Google Gemini</SelectItem>
                  <SelectItem value="dashscope">阿里云 DashScope</SelectItem>
                  <SelectItem value="whisper-compatible">OpenAI Whisper 兼容</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                {config.sttProvider === "auto"
                  ? "自动模式：优先使用 DashScope（国内），失败后降级到 Gemini（国外），再降级到 Whisper 兼容 API"
                  : config.sttProvider === "volcengine"
                  ? "使用火山引擎豆包大模型流式语音识别（SeedASR），与豆包 TTS 共用 App ID 和 Access Token"
                  : config.sttProvider === "gemini"
                  ? "使用 Google Gemini 多模态 API 进行语音识别（适合海外服务器）"
                  : config.sttProvider === "dashscope"
                  ? "使用阿里云 DashScope qwen-omni-turbo 进行语音识别（适合国内服务器）"
                  : "使用 OpenAI Whisper 兼容 API 进行语音识别（如 Groq、SiliconFlow 等）"}
              </p>
            </div>

            {/* 豆包 STT 配置 */}
            {config.sttProvider === "volcengine" && (
              <div className="space-y-4 p-4 border rounded-lg bg-orange-50/30">
                <h4 className="font-medium text-sm">🔥 火山引擎·豆包 STT 配置</h4>
                <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded p-3 space-y-1">
                  <p>⚠️ <strong>注意：STT 和 TTS 的 App ID 格式不同：</strong></p>
                  <p>• TTS 的 App ID 是在请求体中传递的，格式比较灵活</p>
                  <p>• STT 的 App ID 是 <strong>纯数字</strong>（如 <code>1234567890</code>），在控制台「流式语音识别2.0 → 服务详情」里查看</p>
                  <p>• 如果 TTS 和 STT 的 App ID 相同（都是数字），可以只填下面一行，否则分开填</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sttVolcengineAppId">STT App ID（数字）</Label>
                  <Input id="sttVolcengineAppId"
                    value={config.volcengineSttAppId}
                    onChange={(e) => setConfig((prev) => ({ ...prev, volcengineSttAppId: e.target.value }))}
                    placeholder="纯数字，如 1234567890（控制台→流式语音识别2.0→App ID）"
                    disabled={isLoading} />
                  <p className="text-xs text-muted-foreground">为空时使用 TTS 的 App ID（如果两者相同）</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sttVolcengineToken">STT Access Token</Label>
                  <Input id="sttVolcengineToken" type="password"
                    value={config.volcengineSttAccessToken}
                    onChange={(e) => setConfig((prev) => ({ ...prev, volcengineSttAccessToken: e.target.value }))}
                    placeholder="为空时使用 TTS 的 Access Token"
                    disabled={isLoading} />
                </div>

                <div className="space-y-2">
                  <Label>服务资源 ID</Label>
                  <select
                    value={config.volcengineSttResourceId}
                    onChange={(e) => setConfig((prev) => ({ ...prev, volcengineSttResourceId: e.target.value }))}
                    disabled={isLoading}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
                  >
                    <option value="volc.seedasr.sauc.duration">豆包流式语音识别模型2.0 - 小时版（推荐）</option>
                    <option value="volc.seedasr.sauc.concurrent">豆包流式语音识别模型2.0 - 并发版</option>
                    <option value="volc.bigasr.sauc.duration">豆包流式语音识别模型1.0 - 小时版</option>
                    <option value="volc.bigasr.sauc.concurrent">豆包流式语音识别模型1.0 - 并发版</option>
                  </select>
                  <p className="text-xs text-muted-foreground">根据控制台开通的版本选择，开通了哪个版本选哪个</p>
                </div>
              </div>
            )}

            {/* Gemini 配置 */}
            {(config.sttProvider === "auto" || config.sttProvider === "gemini") && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium text-sm">Google Gemini 配置</h4>
                <div className="space-y-2">
                  <Label htmlFor="geminiApiKey">API Key</Label>
                  <Input
                    id="geminiApiKey"
                    type="password"
                    value={config.geminiApiKey}
                    onChange={(e) => setConfig((prev) => ({ ...prev, geminiApiKey: e.target.value }))}
                    placeholder="AIzaSy..."
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* DashScope 配置 */}
            {(config.sttProvider === "auto" || config.sttProvider === "dashscope") && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium text-sm">阿里云 DashScope 配置</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="dashscopeApiUrl">API 地址</Label>
                    <Input
                      id="dashscopeApiUrl"
                      value={config.dashscopeApiUrl}
                      onChange={(e) => setConfig((prev) => ({ ...prev, dashscopeApiUrl: e.target.value }))}
                      placeholder="https://dashscope.aliyuncs.com/compatible-mode"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="dashscopeApiKey">API Key</Label>
                    <Input
                      id="dashscopeApiKey"
                      type="password"
                      value={config.dashscopeApiKey}
                      onChange={(e) => setConfig((prev) => ({ ...prev, dashscopeApiKey: e.target.value }))}
                      placeholder="sk-..."
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dashscopeModel">模型名称</Label>
                  <Input
                    id="dashscopeModel"
                    value={config.dashscopeModel}
                    onChange={(e) => setConfig((prev) => ({ ...prev, dashscopeModel: e.target.value }))}
                    placeholder="qwen-omni-turbo"
                    disabled={isLoading}
                  />
                </div>
              </div>
            )}

            {/* Whisper 兼容 API 配置 */}
            {(config.sttProvider === "auto" || config.sttProvider === "whisper-compatible") && (
              <div className="space-y-4 p-4 border rounded-lg">
                <h4 className="font-medium text-sm">OpenAI Whisper 兼容 API 配置</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="whisperApiUrl">API Base 地址</Label>
                    <Input
                      id="whisperApiUrl"
                      value={config.whisperApiUrl}
                      onChange={(e) => setConfig((prev) => ({ ...prev, whisperApiUrl: e.target.value }))}
                      placeholder="https://api.groq.com/openai"
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">
                      填写 Base URL，<strong>不要</strong>加 <code>/v1/audio/transcriptions</code> 后缀。<br/>
                      豆包语音识别填：<code>https://ark.cn-beijing.volces.com/api/v3</code>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="whisperApiKey">API Key</Label>
                    <Input
                      id="whisperApiKey"
                      type="password"
                      value={config.whisperApiKey}
                      onChange={(e) => setConfig((prev) => ({ ...prev, whisperApiKey: e.target.value }))}
                      placeholder="gsk_... 或火山方舟 API Key"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="whisperModel">模型名称</Label>
                  <Input
                    id="whisperModel"
                    value={config.whisperModel}
                    onChange={(e) => setConfig((prev) => ({ ...prev, whisperModel: e.target.value }))}
                    placeholder="whisper-1 / whisper-large-v3 / doubao-asr"
                    disabled={isLoading}
                  />
                  <p className="text-xs text-muted-foreground">
                    豆包语音识别模型填：<code>doubao-asr</code>
                  </p>
                </div>
              </div>
            )}

            {/* STT 测试按钮 */}
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleSttTest}
                disabled={sttTestStatus === "testing"}
                className="gap-2"
              >
                {sttTestStatus === "testing" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <TestTube className="h-4 w-4" />
                )}
                测试语音识别
              </Button>
              {renderTestBadge(sttTestStatus, sttTestMessage)}
            </div>
          </CardContent>
        </Card>

    </>
  );
}