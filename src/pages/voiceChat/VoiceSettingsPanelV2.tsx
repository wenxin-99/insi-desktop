/**
 * VoiceSettingsPanel v2 — 统一语音方案选择 + 音色选择
 *
 * ★ 重设计：
 *   - 用 VoicePlan 替代 VoicePackage（一个方案 = chat+STT+TTS+音色+价格）
 *   - 伴侣音色覆盖时显示专属指示器
 *   - 音色按方案 availableVoices 渲染，超出范围的标 🔒
 *   - Live 模式支持根据方案 supportsLive 控制
 */
import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import {
  Volume2, Loader2, Check, Sparkles, Zap, Crown, Star,
  Heart, ChevronRight, Lock,
} from "lucide-react";
import { toast } from "sonner";
import { TranslationPanel } from "./TranslationPanel";
import type { TranslationConfig } from "./translationMode";

// ═══════════ 类型 ═══════════

interface VoicePlanVoice {
  voiceId: string;
  label: string;
  provider: string;
  gender?: "female" | "male";
  tags?: string[];
}

interface VoicePlan {
  id: string;
  displayName: string;
  description: string;
  tier: "free" | "standard" | "advanced" | "premium";
  defaultVoice: string;
  availableVoices: VoicePlanVoice[];
  fishCoinCost: number;
  dailyFreeRounds: number;
  highlights: string[];
  enabled: boolean;
  sortOrder: number;
  supportsLive: boolean;
  liveProvider?: string;
}

export interface VoicePlanUsageInfo {
  usedToday: number;
  dailyLimit: number;
  fishCoinCost: number;
  canUse: boolean;
  reason: string;
  tier: string;
  planName: string;
  supportsLive: boolean;
}

interface VoiceSettingsPanelProps {
  language: string;
  setLanguage: (v: string) => void;
  selectedPlanId: string;
  setSelectedPlanId: (v: string) => void;
  selectedVoice: string;
  setSelectedVoice: (v: string) => void;
  voicePlans: VoicePlan[] | undefined;
  usageInfo?: VoicePlanUsageInfo | null;
  voiceMode?: "pipeline" | "live";
  companionVoiceId?: string | null;
  companionName?: string | null;
  translationConfig?: TranslationConfig;
  onTranslationConfigChange?: (config: TranslationConfig) => void;
}

// ═══════════ 常量 ═══════════

const LANGUAGES = [
  { value: "zh", label: "中文" },
  { value: "en", label: "English" },
  { value: "ja", label: "日本語" },
  { value: "ko", label: "한국어" },
];

const TIER_CONFIG: Record<string, {
  icon: typeof Star;
  border: string;
  badge: string;
  badgeText: string;
  glow: string;
}> = {
  free:     { icon: Star,     border: "border-slate-300",  badge: "bg-slate-100 text-slate-600",   badgeText: "体验", glow: "" },
  standard: { icon: Zap,      border: "border-blue-400",   badge: "bg-blue-100 text-blue-700",     badgeText: "标准", glow: "shadow-blue-100" },
  advanced: { icon: Sparkles,  border: "border-purple-400", badge: "bg-purple-100 text-purple-700", badgeText: "进阶", glow: "shadow-purple-100" },
  premium:  { icon: Crown,    border: "border-amber-400",  badge: "bg-amber-100 text-amber-700",   badgeText: "旗舰", glow: "shadow-amber-100" },
};

// ═══════════ 组件 ═══════════

export function VoiceSettingsPanelV2({
  language, setLanguage,
  selectedPlanId, setSelectedPlanId,
  selectedVoice, setSelectedVoice,
  voicePlans,
  usageInfo,
  voiceMode,
  companionVoiceId, companionName,
  translationConfig, onTranslationConfigChange,
}: VoiceSettingsPanelProps) {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);

  // 当前选中的方案
  const activePlan = useMemo(() => {
    if (!voicePlans) return null;
    return voicePlans.find(p => p.id === selectedPlanId) || voicePlans[0] || null;
  }, [voicePlans, selectedPlanId]);

  // 方案内的可用音色
  const planVoices = useMemo(() => {
    if (!activePlan) return [];
    return activePlan.availableVoices;
  }, [activePlan]);

  // 伴侣模式激活
  const isCompanionActive = !!(companionVoiceId && companionName);

  // ── 试听 ──
  const handlePreview = useCallback(async (voiceId: string, provider?: string) => {
    if (previewAudioRef.current) {
      previewAudioRef.current.pause();
      previewAudioRef.current = null;
    }
    if (previewingVoice === voiceId) {
      setPreviewingVoice(null);
      return;
    }

    setPreviewingVoice(voiceId);
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const params = new URLSearchParams({ voice: voiceId });
      if (provider) params.set("provider", provider);

      const resp = await fetch(`/api/tts/preview?${params.toString()}`, {
        headers, credentials: "include",
      });

      if (!resp.ok) {
        toast.error("试听失败");
        setPreviewingVoice(null);
        return;
      }

      const contentType = resp.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        if (data.error || data.available === false) {
          toast.error(data.error || "此音色暂不可用");
          setPreviewingVoice(null);
          return;
        }
      }

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;
      audio.onended = () => { setPreviewingVoice(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPreviewingVoice(null); URL.revokeObjectURL(url); };
      await audio.play();
    } catch {
      toast.error("试听失败");
      setPreviewingVoice(null);
    }
  }, [previewingVoice]);

  return (
    <div className="border-b bg-muted/20 space-y-3 py-3 animate-in slide-in-from-top-2 duration-200">

      {/* ── Live 模式提示 ── */}
      {voiceMode === "live" && (
        <div className="mx-4 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <Zap className="w-4 h-4" />
            实时对话模式
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-500/70 mt-1">
            端到端原生音频，延迟极低。音色由实时模型控制。
          </p>
        </div>
      )}

      {/* ── 今日用量 ── */}
      {usageInfo && usageInfo.dailyLimit > 0 && (
        <div className="px-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
            <span>今日已用 {usageInfo.usedToday}/{usageInfo.dailyLimit} 轮</span>
            {usageInfo.usedToday >= usageInfo.dailyLimit && (
              <span className="text-amber-500 font-medium">已达上限</span>
            )}
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.min(100, (usageInfo.usedToday / usageInfo.dailyLimit) * 100)}%`,
                background: usageInfo.usedToday >= usageInfo.dailyLimit
                  ? "linear-gradient(90deg, #f59e0b, #ef4444)"
                  : "linear-gradient(90deg, #3b82f6, #6366f1)",
              }}
            />
          </div>
        </div>
      )}

      {/* ── 语言选择 ── */}
      <div className="flex items-center gap-3 flex-wrap px-4">
        <label className="text-sm font-medium whitespace-nowrap">语言</label>
        <select
          value={language}
          onChange={e => setLanguage(e.target.value)}
          className="h-8 px-2 rounded-lg border border-border bg-background text-sm"
        >
          {LANGUAGES.map(lang => (
            <option key={lang.value} value={lang.value}>{lang.label}</option>
          ))}
        </select>
      </div>

      {/* ★ 翻译模式 */}
      {translationConfig && onTranslationConfigChange && (
        <TranslationPanel
          config={translationConfig}
          onChange={onTranslationConfigChange}
        />
      )}

      {/* ── 语音方案卡片 ── */}
      {voicePlans && voicePlans.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium px-4">语音方案</label>
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {voicePlans.map(plan => {
              const isSelected = selectedPlanId === plan.id;
              const config = TIER_CONFIG[plan.tier] || TIER_CONFIG.standard;
              const TierIcon = config.icon;

              return (
                <button
                  key={plan.id}
                  onClick={() => {
                    setSelectedPlanId(plan.id);
                    // 如果当前音色不在新方案范围内，重置为方案默认
                    if (selectedVoice && !plan.availableVoices.some(v => v.voiceId === selectedVoice)) {
                      setSelectedVoice(plan.defaultVoice || "");
                    }
                  }}
                  className={[
                    "relative flex-shrink-0 w-36 rounded-xl border-2 p-3 text-left transition-all duration-200",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    isSelected
                      ? `${config.border} ring-2 ring-offset-1 ring-primary/40 bg-background ${config.glow} shadow-md`
                      : "border-border/50 bg-background/60 hover:border-border",
                  ].join(" ")}
                >
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${config.badge} mb-1.5`}>
                    <TierIcon className="w-3 h-3" />
                    {config.badgeText}
                  </div>
                  <div className="font-semibold text-sm leading-tight">{plan.displayName}</div>
                  {plan.description && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                      {plan.description}
                    </div>
                  )}
                  {plan.highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {plan.highlights.slice(0, 3).map((h, i) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-xs font-medium">
                    {plan.fishCoinCost > 0 ? (
                      <span className="text-primary">{plan.fishCoinCost} 🐟/轮</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">
                        免费{plan.dailyFreeRounds > 0 ? ` · ${plan.dailyFreeRounds}轮/天` : ""}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 音色选择 ── */}
      {activePlan && voiceMode !== "live" && (
        <div className="space-y-1.5 px-4">
          <label className="text-sm font-medium flex items-center gap-1.5">
            🎤 音色
            {isCompanionActive && (
              <span className="text-xs text-pink-500 font-normal flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {companionName}专属
              </span>
            )}
          </label>

          {isCompanionActive ? (
            /* ── 伴侣音色覆盖模式 ── */
            <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-pink-300 bg-pink-50/50 dark:border-pink-700 dark:bg-pink-950/20">
              <Heart className="w-5 h-5 text-pink-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-pink-800 dark:text-pink-200">
                  {(() => {
                    const found = planVoices.find(v => v.voiceId === companionVoiceId);
                    return found ? found.label : companionVoiceId;
                  })()}
                </div>
                <div className="text-xs text-pink-600/70 dark:text-pink-400/70 mt-0.5">
                  来自伴侣设置 · 优先于方案音色
                </div>
              </div>
              <button
                onClick={() => handlePreview(companionVoiceId!, undefined)}
                className="p-1.5 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/30 text-pink-400 hover:text-pink-600 transition-colors shrink-0"
              >
                {previewingVoice === companionVoiceId
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Volume2 className="w-4 h-4" />}
              </button>
              <button
                onClick={() => { window.location.href = "/settings/companion"; }}
                className="text-xs text-pink-500 hover:text-pink-700 flex items-center gap-0.5 shrink-0"
              >
                更改 <ChevronRight className="w-3 h-3" />
              </button>
            </div>
          ) : (
            /* ── 正常音色选择 ── */
            <div className="space-y-1">
              {planVoices.map(voice => {
                const isSelected = selectedVoice === voice.voiceId ||
                  (!selectedVoice && activePlan.defaultVoice === voice.voiceId);

                return (
                  <div
                    key={voice.voiceId}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border-2 transition-all cursor-pointer ${
                      isSelected
                        ? "border-primary/50 bg-primary/5"
                        : "border-transparent hover:border-border hover:bg-muted/30"
                    }`}
                    onClick={() => setSelectedVoice(voice.voiceId)}
                  >
                    <div className="flex-1 min-w-0">
                      <span className="text-sm">{voice.label}</span>
                      {voice.tags && voice.tags.length > 0 && (
                        <span className="ml-2 text-[10px] text-muted-foreground">
                          {voice.tags.join(" · ")}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handlePreview(voice.voiceId, voice.provider); }}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors shrink-0"
                      title="试听"
                    >
                      {previewingVoice === voice.voiceId
                        ? <Loader2 className="w-4 h-4 animate-spin text-primary" />
                        : <Volume2 className="w-4 h-4 text-muted-foreground" />}
                    </button>
                    {isSelected && <Check className="w-4 h-4 text-primary shrink-0" />}
                  </div>
                );
              })}

              {/* 如果音色列表为空 */}
              {planVoices.length === 0 && (
                <div className="text-xs text-muted-foreground text-center py-3">
                  此方案使用默认音色
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
