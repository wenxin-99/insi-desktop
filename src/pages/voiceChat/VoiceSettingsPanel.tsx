/**
 * VoiceSettingsPanel — 语音对话设置面板（卡片化重设计）
 *
 * 核心改进：
 * 1. 套餐卡片横向滚动，展示描述/卖点标签/鱼币消耗
 * 2. 音色选择带试听按钮 + 不可用音色标记
 * 3. 顶部显示今日使用量进度条
 */
import { useState, useRef, useCallback, useEffect } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Volume2, Loader2, Check, Sparkles, Zap, Crown, Star, Ban } from "lucide-react";
import { toast } from "sonner";
import { LANGUAGES, VOICE_LABELS, TIER_COLORS, type VoiceUsageInfo } from './types';

interface VoiceSettingsPanelProps {
  language: string;
  setLanguage: (v: string) => void;
  selectedVoicePackageId: string;
  setSelectedVoicePackageId: (v: string) => void;
  selectedVoice: string;
  setSelectedVoice: (v: string) => void;
  ttsProvider: string;
  voicePackages: any[] | undefined;
  usageInfo?: VoiceUsageInfo | null;
  voiceMode?: "pipeline" | "live";
}

/** 套餐档位图标 */
function TierIcon({ tier }: { tier: string }) {
  switch (tier) {
    case "free": return <Star className="w-3.5 h-3.5" />;
    case "standard": return <Zap className="w-3.5 h-3.5" />;
    case "advanced": return <Sparkles className="w-3.5 h-3.5" />;
    case "premium": return <Crown className="w-3.5 h-3.5" />;
    default: return <Star className="w-3.5 h-3.5" />;
  }
}

export function VoiceSettingsPanel({
  language, setLanguage,
  selectedVoicePackageId, setSelectedVoicePackageId,
  selectedVoice, setSelectedVoice,
  ttsProvider, voicePackages,
  usageInfo,
  voiceMode,
}: VoiceSettingsPanelProps) {
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  /** 音色可用性缓存 { voiceId: true/false } */
  const [voiceAvailability, setVoiceAvailability] = useState<Record<string, boolean>>({});
  const checkedRef = useRef(false);

  // ── 初始化时批量检查音色可用性 ──
  useEffect(() => {
    if (ttsProvider !== "volcengine" || checkedRef.current) return;
    checkedRef.current = true;

    const voices = Object.keys(VOICE_LABELS);
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    fetch("/api/tts/check-voices", {
      method: "POST",
      headers,
      credentials: "include",
      body: JSON.stringify({ voices }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.results) {
          setVoiceAvailability(data.results);
        }
      })
      .catch(() => {
        // 检测失败不影响功能，全部假设可用
      });
  }, [ttsProvider]);

  const handlePreview = useCallback(async (voiceId: string, provider?: string) => {
    // 已知不可用（仅 volcengine 检测结果有意义）
    if (!provider && voiceAvailability[voiceId] === false) {
      toast.error("此音色未在豆包控制台开通");
      return;
    }

    // 停止之前的预览
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
      const providerParam = provider ? `&provider=${encodeURIComponent(provider)}` : "";
      const resp = await fetch(`/api/tts/preview?voice=${encodeURIComponent(voiceId)}${providerParam}`);
      const contentType = resp.headers.get("content-type") || "";

      // 如果返回 JSON 而非音频，说明音色不可用
      if (contentType.includes("application/json")) {
        const data = await resp.json();
        if (data.available === false) {
          setVoiceAvailability(prev => ({ ...prev, [voiceId]: false }));
          toast.error("此音色未开通，请在豆包控制台启用对应资源");
          setPreviewingVoice(null);
          return;
        }
        if (data.error) {
          toast.error(data.error);
          setPreviewingVoice(null);
          return;
        }
      }

      if (!resp.ok) throw new Error("试听失败");

      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      previewAudioRef.current = audio;

      // 标记为可用
      setVoiceAvailability(prev => ({ ...prev, [voiceId]: true }));

      audio.onended = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => {
        setPreviewingVoice(null);
        URL.revokeObjectURL(url);
      };
      await audio.play();
    } catch {
      toast.error("试听失败");
      setPreviewingVoice(null);
    }
  }, [previewingVoice, voiceAvailability]);

  // 当前选中的套餐
  const activePkg = selectedVoicePackageId
    ? voicePackages?.find((p: any) => p.id === selectedVoicePackageId)
    : null;
  const pkgVoice = activePkg?.ttsVoice;

  /** 渲染试听按钮 */
  const renderPreviewBtn = (voiceId: string) => {
    const isUnavailable = voiceAvailability[voiceId] === false;

    if (isUnavailable) {
      return (
        <span
          className="p-1.5 rounded-md text-muted-foreground/40 cursor-not-allowed"
          title="此音色未开通"
        >
          <Ban className="w-4 h-4" />
        </span>
      );
    }

    return (
      <button
        onClick={() => handlePreview(voiceId)}
        className="p-1.5 rounded-md hover:bg-muted transition-colors"
        title="试听"
      >
        {previewingVoice === voiceId ? (
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
        ) : (
          <Volume2 className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
    );
  };

  return (
    <div className="border-b bg-muted/20 space-y-3 py-3 animate-in slide-in-from-top-2 duration-200">
      {/* ── Live 模式提示 ── */}
      {voiceMode === "live" && (
        <div className="mx-4 px-3 py-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-700 dark:text-amber-400">
            <Zap className="w-4 h-4" />
            实时对话模式
          </div>
          <p className="text-xs text-amber-600/80 dark:text-amber-500/70 mt-1 leading-relaxed">
            端到端原生音频，延迟极低。音色由实时模型控制，下方音色设置仅在普通模式生效。
          </p>
        </div>
      )}

      {/* ── 今日使用量 ── */}
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

      {/* ── 语言 ── */}
      <div className="flex items-center gap-3 flex-wrap px-4">
        <label className="text-sm font-medium whitespace-nowrap">语言</label>
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger className="w-28 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {LANGUAGES.map((lang) => (
              <SelectItem key={lang.value} value={lang.value}>{lang.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* ── 套餐卡片 ── */}
      {voicePackages && voicePackages.length > 0 && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium px-4">语音套餐</label>
          <div className="flex gap-2.5 overflow-x-auto px-4 pb-1 scrollbar-none" style={{ scrollbarWidth: "none" }}>
            {voicePackages.map((pkg: any) => {
              const isSelected = selectedVoicePackageId === pkg.id;
              const tier = pkg.tier || "standard";
              const colors = TIER_COLORS[tier] || TIER_COLORS.standard;
              const highlights: string[] = pkg.highlights || [];

              return (
                <button
                  key={pkg.id}
                  onClick={() => {
                    setSelectedVoicePackageId(pkg.id);
                    if (pkg.ttsVoice) setSelectedVoice(pkg.ttsVoice);
                    else setSelectedVoice("");
                  }}
                  className={[
                    "relative flex-shrink-0 w-36 rounded-xl border-2 p-3 text-left transition-all duration-200",
                    "hover:scale-[1.02] active:scale-[0.98]",
                    isSelected
                      ? `${colors.border} ring-2 ring-offset-1 ring-primary/40 bg-background ${colors.glow} shadow-md`
                      : "border-border/50 bg-background/60 hover:border-border",
                  ].join(" ")}
                >
                  {isSelected && (
                    <div className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center shadow-sm">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                  <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${colors.badge} mb-1.5`}>
                    <TierIcon tier={tier} />
                    {colors.badgeText}
                  </div>
                  <div className="font-semibold text-sm leading-tight">{pkg.displayName || pkg.name}</div>
                  {pkg.description && (
                    <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
                      {pkg.description}
                    </div>
                  )}
                  {highlights.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {highlights.slice(0, 3).map((h: string, i: number) => (
                        <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {h}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-2 text-xs font-medium">
                    {pkg.fishCoinCost > 0 ? (
                      <span className="text-primary">{pkg.fishCoinCost} 🐟/轮</span>
                    ) : (
                      <span className="text-green-600 dark:text-green-400">
                        免费{pkg.dailyFreeRounds > 0 ? ` · ${pkg.dailyFreeRounds}轮/天` : ""}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 音色选择（带试听 + 可用性标记） ── */}
      {(() => {
        // 套餐锁定音色
        if (activePkg && pkgVoice) {
          // 套餐自带 TTS 服务商：非 volcengine 的不做可用性检测
          const pkgProvider = activePkg.ttsProvider || "";
          const effectiveProvider = pkgProvider || ttsProvider;
          const isNonVolcengine = effectiveProvider && effectiveProvider !== "volcengine";
          const isUnavailable = isNonVolcengine ? false : voiceAvailability[pkgVoice] === false;

          return (
            <div className="flex items-center gap-3 px-4">
              <label className="text-sm font-medium whitespace-nowrap">音色</label>
              <div className="flex items-center gap-2">
                <span className={`text-sm px-3 py-1.5 rounded-md bg-muted border ${isUnavailable ? "text-muted-foreground/40 line-through" : "text-muted-foreground"}`}>
                  {VOICE_LABELS[pkgVoice] ?? pkgVoice}
                  <span className="ml-1.5 text-xs opacity-60">
                    {isUnavailable ? "（未开通）" : "（套餐专属）"}
                  </span>
                </span>
                <button
                  onClick={() => handlePreview(pkgVoice, pkgProvider || undefined)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors"
                  title="试听"
                >
                  {previewingVoice === pkgVoice ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : (
                    <Volume2 className="w-4 h-4 text-muted-foreground" />
                  )}
                </button>
              </div>
            </div>
          );
        }

        // 可选音色（volcengine 引擎时）
        if (ttsProvider === "volcengine") {
          return (
            <div className="flex items-center gap-3 px-4">
              <label className="text-sm font-medium whitespace-nowrap">音色</label>
              <Select
                value={selectedVoice || "__default__"}
                onValueChange={v => setSelectedVoice(v === "__default__" ? "" : v)}
              >
                <SelectTrigger className="w-48 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__default__">默认（管理员设置）</SelectItem>
                  {Object.entries(VOICE_LABELS).map(([value, label]) => {
                    const isUnavailable = voiceAvailability[value] === false;
                    return (
                      <SelectItem
                        key={value}
                        value={value}
                        disabled={isUnavailable}
                        className={isUnavailable ? "opacity-40" : ""}
                      >
                        {label}
                        {isUnavailable && " (未开通)"}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              {selectedVoice && renderPreviewBtn(selectedVoice)}
            </div>
          );
        }

        return null;
      })()}
    </div>
  );
}
