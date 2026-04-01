/**
 * VoiceChat — 语音对话页面（v2 VoicePlan 版）
 *
 * ★ 变更：
 *   - 双套餐（ModelPackage + VoicePackage）→ 统一 VoicePlan
 *   - voiceSystemPrompt 简化为单参数（伴侣信息由服务端返回）
 *   - VoiceSettingsPanel → VoiceSettingsPanelV2
 *   - Live 模式受 plan.supportsLive 控制
 *   - 关闭伴侣后音色自动回退验证
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import { Mic, ArrowLeft, Volume2, VolumeX, Loader2, Square, Settings, MessageSquare, Zap, Radio, Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { toast } from "sonner";

import { AudioVisualizer } from "./voiceChat/AudioVisualizer";
import { VoiceSettingsPanelV2 } from "./voiceChat/VoiceSettingsPanelV2";
import { VoiceHistoryPanel } from "./voiceChat/VoiceHistoryPanel";
import { VoiceUpgradePrompt } from "./voiceChat/VoiceUpgradePrompt";
import { useVoiceChatHandlers } from "./voiceChat/useVoiceChatHandlers";
import { useGeminiLive, type LiveProvider } from "./voiceChat/useGeminiLive";
import { EmotionIndicator } from "./voiceChat/EmotionIndicator";
import { type TranslationConfig } from "./voiceChat/translationMode";
import { type EmotionState } from "./voiceChat/emotionDetector";
import { buildVoiceSystemPrompt } from "./voiceChat/voicePromptBuilder";
import DashboardLayout from '@/components/DashboardLayout';
import {
  type VoiceMessage,
  type VoiceUsageInfo,
  getStatusText,
  getButtonStyle,
  getVisualizerColor,
} from "./voiceChat/types";

export default function VoiceChat() {
  const [, setLocation] = useLocation();
  const [messages, setMessages] = useState<VoiceMessage[]>([]);
  const [language, setLanguage] = useState<string>(() => {
    try { return localStorage.getItem("voiceChat_language") || "zh"; } catch { return "zh"; }
  });
  const [isMuted, setIsMuted] = useState(false);
  const isMutedRef = useRef(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // ★ 统一语音方案 ID（替代 selectedPackageId + selectedVoicePackageId）
  const [selectedPlanId, setSelectedPlanId] = useState<string>(() => {
    try { return localStorage.getItem("voiceChat_planId") || ""; } catch { return ""; }
  });
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    try { return localStorage.getItem("voiceChat_selectedVoice") || ""; } catch { return ""; }
  });
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ★ Live 模式 vs Pipeline 模式
  const [voiceMode, setVoiceMode] = useState<"pipeline" | "live">(() => {
    try { return (localStorage.getItem("voiceChat_mode") as any) || "pipeline"; } catch { return "pipeline"; }
  });
  const [liveProvider, setLiveProvider] = useState<LiveProvider | undefined>(() => {
    try { return (localStorage.getItem("voiceChat_liveProvider") as LiveProvider) || undefined; } catch { return undefined; }
  });
  useEffect(() => { try { localStorage.setItem("voiceChat_mode", voiceMode); } catch {} }, [voiceMode]);
  useEffect(() => {
    if (liveProvider) try { localStorage.setItem("voiceChat_liveProvider", liveProvider); } catch {}
  }, [liveProvider]);

  // ★ 翻译配置
  const [translationConfig, setTranslationConfig] = useState<TranslationConfig>(() => {
    try {
      const saved = localStorage.getItem("voiceChat_translationConfig");
      return saved ? JSON.parse(saved) : { scenario: "off", sourceLang: "zh", targetLang: "en" };
    } catch { return { scenario: "off", sourceLang: "zh", targetLang: "en" }; }
  });
  const [currentEmotion, setCurrentEmotion] = useState<EmotionState | null>(null);
  useEffect(() => {
    try { localStorage.setItem("voiceChat_translationConfig", JSON.stringify(translationConfig)); } catch {}
  }, [translationConfig]);

  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // 持久化
  useEffect(() => { try { if (selectedVoice) localStorage.setItem("voiceChat_selectedVoice", selectedVoice); } catch {} }, [selectedVoice]);
  useEffect(() => { try { localStorage.setItem("voiceChat_language", language); } catch {} }, [language]);
  useEffect(() => { try { localStorage.setItem("voiceChat_planId", selectedPlanId); } catch {} }, [selectedPlanId]);

  // ★ 数据查询：VoicePlan 替代双套餐
  const { data: voicePlans } = trpc.voicePlan.getAll.useQuery();
  const transcribeAudioMutation = trpc.ai.transcribeVoiceInput.useMutation();

  // ★ 当前方案
  const activePlan = useMemo(() => {
    return voicePlans?.find((p: any) => p.id === selectedPlanId) || null;
  }, [voicePlans, selectedPlanId]);

  // ★ 方案绑定的 chat 模型套餐 ID
  const chatPackageId = activePlan?.chatPackageId || null;

  // ── 人格配置 + 记忆 + 伴侣（★ 服务端统一返回） ──
  const { data: voicePersona } = trpc.persona.getVoicePrompt.useQuery(
    undefined,
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );
  // ★ companion 查询仅用于获取 voiceId（prompt 已由 voicePersona 包含）
  const { data: companionConfig } = trpc.companion.getConfig.useQuery(
    undefined,
    { staleTime: 60_000, refetchOnWindowFocus: false }
  );

  // ★ 简化：prompt 构建单参数（伴侣信息已在 voicePersona 中）
  const voiceSystemPrompt = useMemo(
    () => buildVoiceSystemPrompt(voicePersona ?? undefined),
    [voicePersona]
  );

  // ── 伴侣模式音色覆盖 ──
  const companionVoiceId = companionConfig?.enabled && companionConfig.voiceId
    ? companionConfig.voiceId : null;

  // ★ 关闭伴侣后验证音色在方案范围内
  useEffect(() => {
    if (!companionVoiceId && selectedVoice && activePlan) {
      const inRange = activePlan.availableVoices?.some(
        (v: any) => v.voiceId === selectedVoice
      );
      if (!inRange) {
        setSelectedVoice(activePlan.defaultVoice || "");
      }
    }
  }, [companionVoiceId, selectedVoice, activePlan?.id]);

  // ★ 方案不支持 Live 时自动退回 pipeline
  useEffect(() => {
    if (activePlan && !activePlan.supportsLive && voiceMode === "live") {
      setVoiceMode("pipeline");
      toast.info("当前方案不支持实时模式，已切换为普通模式");
    }
  }, [activePlan?.id]);

  // ── 使用量检查 ──
  const { data: usageData, refetch: refetchUsage } = trpc.voicePlan.checkUsage.useQuery(
    { planId: selectedPlanId || undefined },
    { refetchOnWindowFocus: false }
  );
  const usageInfo: VoiceUsageInfo | null = usageData ?? null;

  const recordUsageMutation = trpc.voicePlan.recordUsage.useMutation({
    onSuccess: () => { refetchUsage(); },
    onError: (err) => {
      if (err.message?.includes("insufficient_balance")) {
        toast.error("鱼币余额不足");
      }
    },
  });

  useEffect(() => { refetchUsage(); }, [selectedPlanId, refetchUsage]);

  const handleRoundComplete = useCallback(() => {
    recordUsageMutation.mutate({ planId: selectedPlanId || undefined });
  }, [recordUsageMutation, selectedPlanId]);

  // 从 URL 加载历史
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cid = params.get('conversationId');
    if (!cid) { setMessages([]); setConversationId(undefined); return; }
    const id = parseInt(cid);
    if (isNaN(id)) return;
    setConversationId(id);
    setIsLoadingHistory(true);
    setShowHistory(true);

    const token = localStorage.getItem('auth_token');
    fetch(`/api/trpc/conversation.getById?input=${encodeURIComponent(JSON.stringify({json:{id}}))}`, {
      credentials: 'include',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    })
      .then(r => r.json())
      .then(data => {
        const conversation = data?.result?.data?.json || data?.result?.data;
        if (conversation?.messages) {
          try {
            const parsed = JSON.parse(conversation.messages);
            const voiceMessages: VoiceMessage[] = parsed
              .filter((m: any) => m.role === 'user' || m.role === 'assistant')
              .map((m: any) => ({
                role: m.role as 'user' | 'assistant',
                text: typeof m.content === 'string' ? m.content
                  : Array.isArray(m.content)
                    ? m.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('')
                    : String(m.content || ''),
                timestamp: m.sentAt || m.timestamp || Date.now(),
              }))
              .filter((m: VoiceMessage) => m.text.trim().length > 0);
            setMessages(voiceMessages);
          } catch (e) { console.warn('[VoiceChat] Failed to parse history:', e); }
        }
      })
      .catch(e => console.warn('[VoiceChat] Failed to load history:', e))
      .finally(() => setIsLoadingHistory(false));
  }, []);

  // ★ 自动选中第一个方案
  useEffect(() => {
    if (voicePlans && voicePlans.length > 0 && !selectedPlanId) {
      const first = voicePlans[0];
      if (first) setSelectedPlanId(first.id);
    }
  }, [voicePlans, selectedPlanId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // ★ 核心处理器（传入 VoicePlan 相关参数）
  const {
    state, currentTranscript, aiResponse, audioStreamRef,
    startListening: rawStartListening, stopListening, cancelListening, stopSpeaking,
  } = useVoiceChatHandlers({
    language, messages, setMessages,
    selectedModelId: null,
    selectedPackageId: chatPackageId,
    selectedVoicePackageId: selectedPlanId,  // ★ handler 内部兼容此字段名
    selectedVoice,
    conversationId, setConversationId,
    isMutedRef, voicePackages: voicePlans, transcribeAudioMutation,
    onRoundComplete: handleRoundComplete,
    systemPrompt: voiceSystemPrompt,
    companionVoiceId,
  });

  // ★ Gemini Live
  const geminiLive = useGeminiLive({
    voicePackageId: selectedPlanId || undefined,
    voice: companionVoiceId || undefined,
    systemPrompt: voiceSystemPrompt,
    liveProvider,
    messages, setMessages,
    conversationId, setConversationId,
    onError: (msg) => toast.error(msg),
    translationConfig,
    onEmotionChange: setCurrentEmotion,
  });

  const isLiveMode = voiceMode === "live";
  const effectiveState = isLiveMode
    ? (geminiLive.status === "listening" ? (geminiLive.aiSpeaking ? "speaking" : "listening") : geminiLive.status === "connecting" ? "processing" : "idle")
    : state;
  const effectiveStream = isLiveMode ? geminiLive.micStream : audioStreamRef.current;

  useEffect(() => {
    if (effectiveState === "listening") setShowHistory(false);
    else if (effectiveState === "idle" && messages.length > 0) setShowHistory(true);
  }, [effectiveState, messages.length]);

  const startListening = useCallback(() => {
    if (usageInfo && !usageInfo.canUse) { setShowUpgradePrompt(true); return; }
    rawStartListening();
  }, [usageInfo, rawStartListening]);

  // ★ 升级操作
  const handleUpgrade = useCallback((planId: string) => {
    setSelectedPlanId(planId);
    setShowUpgradePrompt(false);
    const plan = voicePlans?.find((p: any) => p.id === planId);
    if (plan?.defaultVoice) setSelectedVoice(plan.defaultVoice);
    else setSelectedVoice("");
    toast.success(`已切换到「${plan?.displayName || "标准版"}」`);
  }, [voicePlans]);

  const upgradeOptions = (voicePlans || [])
    .filter((p: any) => p.id !== selectedPlanId && p.fishCoinCost > 0 && p.enabled)
    .sort((a: any, b: any) => (a.fishCoinCost ?? 0) - (b.fishCoinCost ?? 0));

  return (
    <DashboardLayout>
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden z-50">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-background/80 backdrop-blur-sm z-10">
        <Button variant="ghost" size="icon" onClick={() => {
          const params = new URLSearchParams(window.location.search);
          const fromChat = params.get('from') === 'chat';
          if (fromChat) {
            const cid = conversationId || parseInt(params.get('conversationId') || '0', 10) || null;
            setLocation(cid ? `/chat?conversationId=${cid}` : '/chat');
          } else if (window.history.length > 1) {
            window.history.back();
          } else {
            setLocation('/chat');
          }
        }} className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">语音对话</h1>
        <div className="flex items-center gap-1">
          {/* ★ Live 模式切换（受方案控制） */}
          <Button
            variant="ghost" size="icon"
            onClick={() => {
              if (effectiveState !== "idle" && effectiveState !== "connecting") {
                toast.info("请先结束当前对话再切换模式");
                return;
              }
              if (voiceMode === "pipeline" && activePlan && !activePlan.supportsLive) {
                toast.info(`${activePlan.displayName}不支持实时模式，请升级到标准版以上`);
                return;
              }
              setVoiceMode(v => v === "live" ? "pipeline" : "live");
              if (voiceMode === "pipeline") {
                // 切换到实时模式
                toast.success("已切换到实时模式");
                if (companionVoiceId && (companionVoiceId.startsWith("BV") || companionVoiceId.startsWith("long") || companionVoiceId.includes("bigtts"))) {
                  setTimeout(() => toast.info("实时模式暂不支持伴侣自定义音色，将使用引擎默认音色", { duration: 4000 }), 300);
                }
              } else {
                toast.success("已切换到普通模式");
              }
            }}
            title={voiceMode === "live"
              ? `实时模式（${liveProvider === "gemini" ? "Gemini" : "通义千问"}）`
              : "普通模式（ASR+LLM+TTS）"}
          >
            {voiceMode === "live"
              ? <Zap className="h-5 w-5 text-amber-500" />
              : <Radio className="h-5 w-5" />
            }
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setIsMuted(!isMuted)}>
            {isMuted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowHistory(!showHistory)}>
            <MessageSquare className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* ★ 设置面板（VoiceSettingsPanelV2） */}
      {showSettings && (
        <VoiceSettingsPanelV2
          language={language} setLanguage={setLanguage}
          selectedPlanId={selectedPlanId} setSelectedPlanId={setSelectedPlanId}
          selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice}
          voicePlans={voicePlans}
          usageInfo={usageData ?? null}
          voiceMode={voiceMode}
          companionVoiceId={companionVoiceId}
          companionName={companionConfig?.name || null}
          translationConfig={translationConfig}
          onTranslationConfigChange={setTranslationConfig}
        />
      )}

      {/* 主内容区域 */}
      <div className="flex-1 flex flex-col items-center justify-center relative overflow-hidden">
        {showHistory && (
          <VoiceHistoryPanel
            ref={messagesEndRef}
            messages={messages}
            isLoadingHistory={isLoadingHistory}
            onClose={() => setShowHistory(false)}
          />
        )}

        <div className="w-64 h-64 md:w-80 md:h-80">
          <AudioVisualizer
            isActive={isLiveMode ? geminiLive.status === "listening" : state === "listening"}
            audioStream={effectiveStream || undefined}
            color={isLiveMode
              ? (geminiLive.interrupted ? "#f59e0b" : geminiLive.aiSpeaking ? "#22c55e" : "#3b82f6")
              : getVisualizerColor(effectiveState as any)
            }
          />
        </div>

        <div className="mt-4 text-center px-4 w-full">
          {isLiveMode ? (
            <>
              <p className={`text-lg font-medium ${geminiLive.interrupted ? "text-amber-500 animate-pulse" : "text-muted-foreground"}`}>
                {geminiLive.status === "idle" && "点击开始实时对话"}
                {geminiLive.status === "connecting" && "正在连接..."}
                {geminiLive.interrupted && "已打断，正在聆听..."}
                {geminiLive.status === "listening" && !geminiLive.interrupted && (geminiLive.aiSpeaking ? "AI 正在回答..." : "正在聆听...")}
              </p>
              <EmotionIndicator
                emotion={geminiLive.emotionState || currentEmotion}
                active={effectiveState === "listening" || effectiveState === "speaking"}
              />
              {translationConfig.scenario !== "off" && geminiLive.status === "listening" && (
                <p className="mt-1 text-xs text-blue-500/80 flex items-center justify-center gap-1">
                  <Languages className="w-3 h-3" />
                  {translationConfig.scenario === "translate" ? "实时翻译模式" :
                   translationConfig.scenario === "coach" ? "口语教练模式" : "多语言模式"}
                </p>
              )}
              {geminiLive.status === "listening" && (
                <p className="mt-1 text-xs text-amber-500/80 flex items-center justify-center gap-1">
                  <Zap className="w-3 h-3" />
                  {geminiLive.activeProvider === "qwen-omni" ? "通义千问" : geminiLive.connectionMode === "direct" ? "Gemini 直连" : "Gemini 代理"}
                  {geminiLive.elapsedSeconds > 0 && (
                    <span className="ml-1 tabular-nums">
                      · {Math.floor(geminiLive.elapsedSeconds / 60)}:{String(geminiLive.elapsedSeconds % 60).padStart(2, "0")}
                    </span>
                  )}
                </p>
              )}
              {geminiLive.userTranscript && (
                <p className="mt-2 text-sm text-blue-500 max-w-md mx-auto">你：{geminiLive.userTranscript}</p>
              )}
              {geminiLive.aiTranscript && (
                <div className="mt-2 max-w-md mx-auto rounded-xl bg-muted/30 px-4 py-2">
                  <p className="text-sm text-left">{geminiLive.aiTranscript}</p>
                </div>
              )}
            </>
          ) : (
            <>
              <p className="text-lg font-medium text-muted-foreground">{getStatusText(state)}</p>
              {currentTranscript && state !== "idle" && (
                <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{currentTranscript}</p>
              )}
              {aiResponse && (state === "thinking" || state === "speaking") && (
                <div className="mt-3 max-w-md mx-auto max-h-[40vh] overflow-y-auto rounded-xl bg-muted/30 px-4 py-3">
                  <div className="text-sm leading-relaxed prose prose-sm max-w-none text-left"><SafeMarkdown>{aiResponse}</SafeMarkdown></div>
                </div>
              )}
            </>
          )}
        </div>

        {messages.length > 0 && effectiveState === "idle" && !showHistory && (
          <div className="mt-4 max-w-md mx-auto px-4">
            <div className="bg-muted/50 rounded-xl px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">
                {messages[messages.length - 1].role === "user" ? "你说" : "Insi 回答"}
              </p>
              <p className="text-sm line-clamp-3">{messages[messages.length - 1].text}</p>
            </div>
          </div>
        )}

        {showUpgradePrompt && usageInfo && (
          <VoiceUpgradePrompt
            usedToday={usageInfo.usedToday}
            dailyLimit={usageInfo.dailyLimit}
            currentPackageName={(usageInfo as any).planName || usageInfo.packageName}
            upgradeOptions={upgradeOptions}
            onUpgrade={handleUpgrade}
            onDismiss={() => setShowUpgradePrompt(false)}
            reason={usageInfo.reason}
          />
        )}
      </div>

      {/* 底部控制区 */}
      <div className="pb-safe px-4 py-6 flex flex-col items-center gap-4">

        {isLiveMode && (
          <div className="flex flex-col items-center gap-3 w-full max-w-xs">
            {geminiLive.status === "connecting" && (
              <div className="w-20 h-20 rounded-full flex items-center justify-center shadow-lg bg-amber-500 opacity-70">
                <Loader2 className="w-8 h-8 text-white animate-spin" />
              </div>
            )}

            {geminiLive.status === "idle" && (
              <button
                onClick={geminiLive.start}
                className="w-full h-16 rounded-2xl flex items-center justify-center gap-3 shadow-lg bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 active:scale-95 transition-all duration-150"
              >
                <Zap className="w-6 h-6 text-white" />
                <span className="text-white font-semibold text-base">开始实时对话</span>
              </button>
            )}

            {geminiLive.status === "listening" && (
              <button
                onClick={geminiLive.stop}
                className="w-full h-16 rounded-2xl flex items-center justify-center gap-3 shadow-lg bg-red-500 hover:bg-red-600 active:scale-95 transition-all duration-150"
              >
                <Square className="w-6 h-6 text-white" />
                <span className="text-white font-semibold text-base">结束对话</span>
              </button>
            )}

            <p className="text-xs text-muted-foreground text-center">
              {geminiLive.status === "idle"
                ? "实时模式 · 延迟 < 1秒 · 支持随时打断"
                : geminiLive.status === "listening"
                  ? "直接说话即可 · AI 会自动回应 · 点击结束"
                  : "正在连接..."}
            </p>

            {geminiLive.status === "idle" && (
              <div className="flex flex-col items-center gap-1.5 mt-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground/60">引擎:</span>
                  <button
                    onClick={() => setLiveProvider(liveProvider === "gemini" ? "qwen-omni" : "gemini")}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors hover:bg-muted"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${liveProvider === "gemini" ? "bg-blue-500" : "bg-green-500"}`} />
                    {liveProvider === "gemini" ? "Gemini" : "通义千问"}
                  </button>
                </div>
                {companionVoiceId && (companionVoiceId.startsWith("BV") || companionVoiceId.startsWith("long") || companionVoiceId.includes("bigtts")) && (
                  <p className="text-[10px] text-amber-500/70 dark:text-amber-400/60">伴侣音色仅在普通模式下生效，实时模式使用引擎默认音色</p>
                )}
              </div>
            )}

            {geminiLive.status === "listening" && geminiLive.activeProvider && (
              <p className="text-[10px] text-muted-foreground/50 text-center mt-0.5">
                {geminiLive.activeProvider === "qwen-omni" ? "通义千问 Qwen-Omni" : "Google Gemini Live"}
              </p>
            )}
          </div>
        )}

        {!isLiveMode && (
          <>
            {(state === "processing" || state === "thinking") && (
              <div className="flex flex-col items-center gap-3">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${getButtonStyle(state)} opacity-70`}>
                  <Loader2 className="w-8 h-8 text-white animate-spin" />
                </div>
                <p className="text-xs text-muted-foreground">请稍候...</p>
              </div>
            )}

            {state === "speaking" && (
              <div className="flex flex-col items-center gap-3">
                <button onClick={stopSpeaking} className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg ${getButtonStyle(state)} active:scale-95 transition-all duration-300`}>
                  <Square className="w-7 h-7 text-white" />
                </button>
                <p className="text-xs text-muted-foreground">点击打断</p>
              </div>
            )}

            {(state === "idle" || state === "listening") && (
              <div className="flex flex-col items-center gap-3 w-full max-w-xs">
                <button
                  onMouseDown={(e) => { e.preventDefault(); if (state === "idle") startListening(); }}
                  onMouseUp={() => { if (state === "listening") stopListening(); }}
                  onMouseLeave={() => { if (state === "listening") stopListening(); }}
                  onTouchStart={(e) => {
                    e.preventDefault(); e.stopPropagation();
                    (e.currentTarget as any)._touchStartY = e.touches[0].clientY;
                    if (state === "idle") startListening();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    if (state !== "listening") return;
                    const touch = e.changedTouches[0];
                    const startY = (e.currentTarget as any)._touchStartY || touch.clientY;
                    const deltaY = touch.clientY - startY;
                    if (deltaY < -60) cancelListening();
                    else stopListening();
                  }}
                  onTouchCancel={(e) => { e.preventDefault(); if (state === "listening") cancelListening(); }}
                  onTouchMove={() => {}}
                  className={[
                    "w-full h-16 rounded-2xl flex items-center justify-center gap-3",
                    "shadow-lg select-none transition-all duration-150 outline-none",
                    state === "listening"
                      ? "bg-red-500 scale-95 shadow-xl"
                      : "bg-blue-500 hover:bg-blue-600 active:scale-95 active:bg-blue-700",
                  ].join(" ")}
                  style={{ touchAction: "none", WebkitUserSelect: "none" } as React.CSSProperties}
                >
                  {state === "listening" ? (
                    <>
                      <div className="flex gap-1 items-end h-6">
                        {[4, 7, 10, 7, 4].map((h, i) => (
                          <div key={i} className="w-1.5 bg-white rounded-full" style={{
                            height: `${h}px`,
                            animation: "voiceBar 0.5s ease-in-out infinite alternate",
                            animationDelay: `${i * 0.1}s`,
                          }} />
                        ))}
                      </div>
                      <span className="text-white font-semibold text-base">松开 发送</span>
                    </>
                  ) : (
                    <>
                      <Mic className="w-6 h-6 text-white" />
                      <span className="text-white font-semibold text-base">按住 说话</span>
                    </>
                  )}
                </button>

                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    {state === "listening" ? "松开发送 · 上滑取消" : "按住说话，松开发送 · 空格键快捷"}
                  </p>
                  {usageInfo && state === "idle" && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {usageInfo.fishCoinCost > 0
                        ? `${(usageInfo as any).planName || usageInfo.packageName} · ${usageInfo.fishCoinCost} 🐟/轮`
                        : usageInfo.dailyLimit > 0
                          ? `${(usageInfo as any).planName || usageInfo.packageName} · 剩余 ${Math.max(0, usageInfo.dailyLimit - usageInfo.usedToday)} 轮`
                          : (usageInfo as any).planName || usageInfo.packageName
                      }
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
