/**
 * VoiceChat — 语音对话页面（入口编排文件）
 * 
 * 子模块：
 * - voiceChat/types.ts           → 类型/常量/工具函数
 * - voiceChat/SimpleTTSPlayer.ts → TTS 播放器
 * - voiceChat/AudioVisualizer.tsx → 波形可视化
 * - voiceChat/VoiceSettingsPanel.tsx → 设置面板（卡片化套餐+试听）
 * - voiceChat/VoiceHistoryPanel.tsx → 历史面板
 * - voiceChat/VoiceUpgradePrompt.tsx → 柔性升级引导
 * - voiceChat/useVoiceChatHandlers.ts → 录音/AI/TTS 处理
 *
 * 变更：
 * - 接入 checkVoiceUsage / recordVoiceUsage tRPC
 * - 录音前检查额度，额度耗尽时展示升级浮层
 * - 将 usageInfo 传给 VoiceSettingsPanel 用于进度条显示
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import { Mic, ArrowLeft, Volume2, VolumeX, Loader2, Square, Settings, MessageSquare, Zap, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { toast } from "sonner";

import { AudioVisualizer } from "./voiceChat/AudioVisualizer";
import { VoiceSettingsPanel } from "./voiceChat/VoiceSettingsPanel";
import { VoiceHistoryPanel } from "./voiceChat/VoiceHistoryPanel";
import { VoiceUpgradePrompt } from "./voiceChat/VoiceUpgradePrompt";
import { useVoiceChatHandlers } from "./voiceChat/useVoiceChatHandlers";
import { useGeminiLive, type LiveProvider } from "./voiceChat/useGeminiLive";
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
  const [selectedModelId, setSelectedModelId] = useState<number | null>(null);
  const [selectedPackageId, setSelectedPackageId] = useState<number | null>(null);
  const [selectedVoicePackageId, setSelectedVoicePackageId] = useState<string>(() => {
    try { return localStorage.getItem("voiceChat_voicePackageId") || ""; } catch { return ""; }
  });
  const [conversationId, setConversationId] = useState<number | undefined>(undefined);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<string>(() => {
    try { return localStorage.getItem("voiceChat_selectedVoice") || ""; } catch { return ""; }
  });
  const [ttsProvider, setTtsProvider] = useState<string>("");
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

  // 同步 muted ref
  useEffect(() => { isMutedRef.current = isMuted; }, [isMuted]);

  // 获取 TTS 配置
  useEffect(() => {
    fetch("/api/tts/config").then(r => r.json()).then(data => setTtsProvider(data.provider || "")).catch(() => {});
  }, []);

  // 持久化设置
  useEffect(() => { try { if (selectedVoice) localStorage.setItem("voiceChat_selectedVoice", selectedVoice); } catch {} }, [selectedVoice]);
  useEffect(() => { try { localStorage.setItem("voiceChat_language", language); } catch {} }, [language]);
  useEffect(() => { try { localStorage.setItem("voiceChat_voicePackageId", selectedVoicePackageId); } catch {} }, [selectedVoicePackageId]);

  const { data: packages } = trpc.modelPackage.getAll.useQuery();
  const { data: voicePackages } = trpc.system.getVoicePackages.useQuery();
  const transcribeAudioMutation = trpc.ai.transcribeVoiceInput.useMutation();

  // ── 使用量检查 ──
  const { data: usageData, refetch: refetchUsage } = trpc.system.checkVoiceUsage.useQuery(
    { voicePackageId: selectedVoicePackageId || undefined },
    { refetchOnWindowFocus: false }
  );
  const usageInfo: VoiceUsageInfo | null = usageData ?? null;

  const recordUsageMutation = trpc.system.recordVoiceUsage.useMutation({
    onSuccess: () => { refetchUsage(); },
    onError: (err) => {
      if (err.message?.includes("insufficient_balance")) {
        toast.error("鱼币余额不足");
      }
    },
  });

  // 切换套餐时刷新使用量
  useEffect(() => { refetchUsage(); }, [selectedVoicePackageId, refetchUsage]);

  // 对话完成后记录用量
  const handleRoundComplete = useCallback(() => {
    recordUsageMutation.mutate({ voicePackageId: selectedVoicePackageId || undefined });
  }, [recordUsageMutation, selectedVoicePackageId]);

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

  // 获取默认模型
  useEffect(() => {
    if (packages && packages.length > 0 && !selectedPackageId) {
      const defaultPkg = packages.find((p: any) => p.enabled);
      if (defaultPkg) {
        setSelectedPackageId(defaultPkg.id);
        if (defaultPkg.models && defaultPkg.models.length > 0) {
          const primaryModel = defaultPkg.models.find((m: any) => m.isPrimary);
          setSelectedModelId(primaryModel?.modelId || defaultPkg.models[0].modelId);
        }
      }
    }
  }, [packages, selectedPackageId]);

  // 自动选中第一个启用的语音套餐（如果用户还没选）
  useEffect(() => {
    if (voicePackages && voicePackages.length > 0 && !selectedVoicePackageId) {
      const first = voicePackages[0];
      if (first) setSelectedVoicePackageId(first.id);
    }
  }, [voicePackages, selectedVoicePackageId]);

  // 自动滚动
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  // 核心处理器
  const {
    state, currentTranscript, aiResponse, audioStreamRef,
    startListening: rawStartListening, stopListening, cancelListening, stopSpeaking,
  } = useVoiceChatHandlers({
    language, messages, setMessages,
    selectedModelId, selectedPackageId, selectedVoicePackageId, selectedVoice,
    conversationId, setConversationId,
    isMutedRef, voicePackages, transcribeAudioMutation,
    onRoundComplete: handleRoundComplete,
  });

  // ★ Gemini Live 实时语音 Hook
  const geminiLive = useGeminiLive({
    voicePackageId: selectedVoicePackageId || undefined,
    voice: undefined,
    liveProvider,
    messages,
    setMessages,
    conversationId,
    setConversationId,
    onError: (msg) => toast.error(msg),
  });

  // ★ 统一状态：根据当前模式选择对应的状态
  const isLiveMode = voiceMode === "live";
  const effectiveState = isLiveMode
    ? (geminiLive.status === "listening" ? (geminiLive.aiSpeaking ? "speaking" : "listening") : geminiLive.status === "connecting" ? "processing" : "idle")
    : state;
  const effectiveStream = isLiveMode ? geminiLive.micStream : audioStreamRef.current;

  // ★ 录音时自动收起历史面板（露出波形可视化），播放完成后自动展开
  useEffect(() => {
    if (effectiveState === "listening") {
      setShowHistory(false);
    } else if (effectiveState === "idle" && messages.length > 0) {
      setShowHistory(true);
    }
  }, [effectiveState, messages.length]);

  // ── 包装 startListening：录音前检查额度 ──
  const startListening = useCallback(() => {
    if (usageInfo && !usageInfo.canUse) {
      setShowUpgradePrompt(true);
      return;
    }
    rawStartListening();
  }, [usageInfo, rawStartListening]);

  // 升级操作：切换到付费套餐
  const handleUpgrade = useCallback((packageId: string) => {
    setSelectedVoicePackageId(packageId);
    setShowUpgradePrompt(false);
    // 如果套餐有专属音色，同步设置
    const pkg = voicePackages?.find((p: any) => p.id === packageId);
    if (pkg?.ttsVoice) setSelectedVoice(pkg.ttsVoice);
    else setSelectedVoice("");
    toast.success(`已切换到「${pkg?.displayName || "标准版"}」`);
  }, [voicePackages]);

  // 可升级的套餐列表（排除当前选中的，且有 fishCoinCost > 0）
  const upgradeOptions = (voicePackages || [])
    .filter((p: any) => p.id !== selectedVoicePackageId && p.fishCoinCost > 0 && p.enabled)
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
          {/* ★ Live / Pipeline 模式切换 */}
          <Button
            variant="ghost" size="icon"
            onClick={() => {
              if (effectiveState !== "idle" && effectiveState !== "connecting") {
                toast.info("请先结束当前对话再切换模式");
                return;
              }
              setVoiceMode(v => v === "live" ? "pipeline" : "live");
              toast.success(voiceMode === "live" ? "已切换到普通模式" : "已切换到实时模式");
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

      {/* 设置面板 */}
      {showSettings && (
        <VoiceSettingsPanel
          language={language} setLanguage={setLanguage}
          selectedVoicePackageId={selectedVoicePackageId} setSelectedVoicePackageId={setSelectedVoicePackageId}
          selectedVoice={selectedVoice} setSelectedVoice={setSelectedVoice}
          ttsProvider={ttsProvider} voicePackages={voicePackages}
          usageInfo={usageInfo}
          voiceMode={voiceMode}
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

        {/* 波形可视化 */}
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

        {/* 状态文本 */}
        <div className="mt-4 text-center px-4 w-full">
          {isLiveMode ? (
            <>
              <p className={`text-lg font-medium ${geminiLive.interrupted ? "text-amber-500 animate-pulse" : "text-muted-foreground"}`}>
                {geminiLive.status === "idle" && "点击开始实时对话"}
                {geminiLive.status === "connecting" && "正在连接..."}
                {geminiLive.interrupted && "已打断，正在聆听..."}
                {geminiLive.status === "listening" && !geminiLive.interrupted && (geminiLive.aiSpeaking ? "AI 正在回答..." : "正在聆听...")}
              </p>
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

        {/* 最近一条消息预览 */}
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

        {/* 升级引导浮层 */}
        {showUpgradePrompt && usageInfo && (
          <VoiceUpgradePrompt
            usedToday={usageInfo.usedToday}
            dailyLimit={usageInfo.dailyLimit}
            currentPackageName={usageInfo.packageName}
            upgradeOptions={upgradeOptions}
            onUpgrade={handleUpgrade}
            onDismiss={() => setShowUpgradePrompt(false)}
            reason={usageInfo.reason}
          />
        )}
      </div>

      {/* 底部控制区 */}
      <div className="pb-safe px-4 py-6 flex flex-col items-center gap-4">

        {/* ════════ Live 模式控制 ════════ */}
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

            {/* ★ Provider 切换（仅 idle 时显示） */}
            {geminiLive.status === "idle" && (
              <div className="flex items-center justify-center gap-2 mt-1">
                <span className="text-xs text-muted-foreground/60">引擎:</span>
                <button
                  onClick={() => setLiveProvider(liveProvider === "gemini" ? "qwen-omni" : "gemini")}
                  className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border transition-colors hover:bg-muted"
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${liveProvider === "gemini" ? "bg-blue-500" : "bg-green-500"}`} />
                  {liveProvider === "gemini" ? "Gemini" : "通义千问"}
                </button>
              </div>
            )}

            {/* ★ 运行中显示当前 provider */}
            {geminiLive.status === "listening" && geminiLive.activeProvider && (
              <p className="text-[10px] text-muted-foreground/50 text-center mt-0.5">
                {geminiLive.activeProvider === "qwen-omni" ? "通义千问 Qwen-Omni" : "Google Gemini Live"}
              </p>
            )}
          </div>
        )}

        {/* ════════ Pipeline 模式控制（原有） ════════ */}
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

                {/* 底部提示（含套餐和剩余额度） */}
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">
                    {state === "listening" ? "松开发送 · 上滑取消" : "按住说话，松开发送 · 空格键快捷"}
                  </p>
                  {usageInfo && state === "idle" && (
                    <p className="text-[11px] text-muted-foreground/70 mt-0.5">
                      {usageInfo.fishCoinCost > 0
                        ? `${usageInfo.packageName} · ${usageInfo.fishCoinCost} 🐟/轮`
                        : usageInfo.dailyLimit > 0
                          ? `${usageInfo.packageName} · 剩余 ${Math.max(0, usageInfo.dailyLimit - usageInfo.usedToday)} 轮`
                          : usageInfo.packageName
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
