/**
 * CompanionSettings — 伴侣模式配置页面（v2 全功能版）
 *
 * 集成功能：
 * - 一键套装预设（9 种）
 * - 10 种性格模板 + 自定义
 * - 6 种关系类型
 * - 音色-性格推荐匹配 + 试听
 * - 试聊预览（3 个场景气泡）
 * - 特殊日期
 * - EmotionDashboard v2（趋势+能量值）
 * - 周报查看器
 * - 时间胶囊查看
 * - 伴侣日记
 * - 优先级说明
 */
import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
  ArrowLeft, Save, Heart, Loader2, Check, Volume2,
  Sparkles, X, Mic, ChevronRight, ChevronDown, MessageCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import {
  PERSONALITY_TEMPLATES,
  RELATIONSHIP_TYPES,
  RECOMMENDED_VOICES,
  VOICE_PERSONALITY_MATCH,
  COMPANION_PRESETS,
  type CompanionConfig,
} from "./voiceChat/companionPrompts";
import { AlarmVoicePack } from "./voiceChat/CompanionWidgets";
import { ScheduleSection, HabitSection } from "./voiceChat/CompanionScheduleSection";
import { ReminderSection } from "./voiceChat/CompanionReminderSection";

// ═══════════ Mood 配置 ═══════════

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊", neutral: "😐", worried: "😟", sad: "😢",
  excited: "🤩", tired: "😴", none: "·",
};

const TREND_LABELS: Record<string, { text: string; color: string }> = {
  improving: { text: "↗ 好转", color: "text-green-500" },
  declining: { text: "↘ 走低", color: "text-amber-500" },
  stable:    { text: "→ 平稳", color: "text-gray-400" },
  insufficient_data: { text: "", color: "text-gray-300" },
};

// ═══════════ 子组件：EmotionDashboard v2 ═══════════

function EmotionDashboard() {
  const { data } = trpc.companion.getEmotionStats.useQuery(undefined, {
    staleTime: 120_000, refetchOnWindowFocus: false,
  });
  if (!data || data.days.length === 0) return null;

  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
  const trendInfo = TREND_LABELS[data.trend] || TREND_LABELS.stable;

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold">📊 本周情绪</h2>
        {trendInfo.text && <span className={`text-xs font-medium ${trendInfo.color}`}>{trendInfo.text}</span>}
      </div>
      <div className="p-4">
        <div className="flex justify-around mb-3">
          {data.days.map((d: any) => {
            const date = new Date(d.date + "T00:00:00");
            const wd = weekdays[date.getDay()];
            const isToday = d.date === new Date().toISOString().split("T")[0];
            return (
              <div key={d.date} className={`flex flex-col items-center gap-1 ${isToday ? "font-bold" : ""}`}>
                <span className="text-xl">{MOOD_EMOJI[d.mood] || "·"}</span>
                <span className={`text-xs ${isToday ? "text-pink-500" : "text-gray-400"}`}>{wd}</span>
              </div>
            );
          })}
        </div>
        {data.avgEnergy > 0 && (
          <div className="px-1">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>能量值</span><span>{data.avgEnergy}/100</span>
            </div>
            <div className="h-1.5 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500" style={{
                width: `${data.avgEnergy}%`,
                background: data.avgEnergy > 60 ? "linear-gradient(90deg,#34d399,#10b981)"
                  : data.avgEnergy > 30 ? "linear-gradient(90deg,#fbbf24,#f59e0b)"
                  : "linear-gradient(90deg,#f87171,#ef4444)",
              }} />
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════ 子组件：周报查看器 ═══════════

function WeeklyReportViewer({ companionName }: { companionName: string }) {
  const { data: report } = trpc.companion.getWeeklyReport.useQuery(undefined, {
    staleTime: 300_000, refetchOnWindowFocus: false,
  });
  if (!report) return null;

  const moodLabel: Record<string, string> = {
    happy: "开心", neutral: "平静", worried: "焦虑", sad: "低落", excited: "兴奋", tired: "疲惫",
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold">📋 {companionName} 的周回顾</h2>
        <span className="text-xs text-gray-400">{report.weekStart?.replace(/-/g, ".")} - {report.weekEnd?.replace(/-/g, ".")}</span>
      </div>
      <div className="p-4 space-y-3">
        <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{report.summary}</p>
        {report.highlights?.length > 0 && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-gray-500">本周亮点</p>
            {report.highlights.map((h: string, i: number) => (
              <div key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                <span className="text-pink-400 mt-0.5">✦</span><span>{h}</span>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-3 text-xs text-gray-400">
          <span>共聊 {report.totalEntries} 次</span>
          <span>·</span>
          <span>主导情绪：{moodLabel[report.dominantMood] || report.dominantMood}</span>
        </div>
      </div>
    </section>
  );
}

// ═══════════ 子组件：日记查看器 ═══════════

function DiaryViewer({ companionName }: { companionName: string }) {
  const { data, isLoading } = trpc.companion.getDiary.useQuery(
    { limit: 10, offset: 0 }, { staleTime: 60_000, refetchOnWindowFocus: false }
  );
  if (isLoading) return null;
  if (!data || data.entries.length === 0) {
    return (
      <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-sm font-semibold">📔 {companionName} 的日记</h2>
        </div>
        <div className="p-6 text-center text-gray-400 text-sm">
          <p>日记本还是空的</p>
          <p className="text-xs mt-1">和 {companionName} 多聊聊，TA 会把感受写在日记里</p>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold">📔 {companionName} 的日记</h2>
        <span className="text-xs text-gray-400">{data.total} 篇</span>
      </div>
      <div className="p-4 space-y-3 max-h-80 overflow-y-auto">
        {data.entries.map((entry: any) => {
          const date = new Date(entry.createdAt);
          const dateStr = `${date.getMonth() + 1}月${date.getDate()}日`;
          return (
            <div key={entry.id} className="relative pl-4 border-l-2 border-pink-200 dark:border-pink-800">
              <p className="text-xs text-gray-400 mb-1">{MOOD_EMOJI[entry.mood] || ""} {dateStr}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{entry.content}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ═══════════ 子组件：试聊预览 ═══════════

function TrialChatPreview({ config }: { config: CompanionConfig }) {
  const trialMutation = trpc.companion.trialChat.useMutation();
  const [samples, setSamples] = useState<string[]>([]);

  const handleTrial = () => {
    if (!config.name) { toast.error("请先填写名字"); return; }
    trialMutation.mutate({
      name: config.name, gender: config.gender,
      personality: config.personality, relationship: config.relationship,
      customSoul: config.customSoul,
    }, {
      onSuccess: (data) => setSamples(data.samples),
      onError: () => toast.error("试聊生成失败"),
    });
  };

  const scenes = ["你好", "今天好累啊", "你在干嘛"];

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <MessageCircle className="w-4 h-4 text-pink-500" /> 试聊预览
        </h2>
        <button onClick={handleTrial} disabled={trialMutation.isPending || !config.name}
          className="text-xs px-3 py-1.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 disabled:opacity-40 transition-colors flex items-center gap-1">
          {trialMutation.isPending ? <><Loader2 className="w-3 h-3 animate-spin" /> 生成中...</> : samples.length > 0 ? "换一批" : "生成试聊"}
        </button>
      </div>
      <div className="p-4">
        {samples.length > 0 ? (
          <div className="space-y-3">
            {scenes.map((scene, idx) => (
              <div key={idx} className="space-y-1.5">
                <div className="flex justify-end">
                  <div className="bg-blue-500 text-white text-sm px-3 py-1.5 rounded-2xl rounded-tr-sm max-w-[70%]">{scene}</div>
                </div>
                <div className="flex justify-start">
                  <div className="bg-pink-50 dark:bg-pink-950/30 text-sm px-3 py-1.5 rounded-2xl rounded-tl-sm max-w-[80%] border border-pink-100 dark:border-pink-900/50">
                    {samples[idx] || "..."}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-xs text-gray-400 py-4">
            <p>点击「生成试聊」预览 {config.name || "TA"} 的说话风格</p>
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════ 子组件：时间胶囊列表 ═══════════

function TimeCapsuleViewer() {
  const { data } = trpc.companion.getPendingCapsules.useQuery(undefined, {
    staleTime: 60_000, refetchOnWindowFocus: false,
  });
  if (!data || data.length === 0) return null;

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Clock className="w-4 h-4 text-purple-500" /> 时间胶囊
        </h2>
      </div>
      <div className="p-4 space-y-2">
        {data.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-purple-50 dark:bg-purple-950/20 border border-purple-100 dark:border-purple-900/50">
            <span className="text-lg">⏳</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-purple-800 dark:text-purple-300 truncate">{c.content}</p>
              <p className="text-[10px] text-purple-500 mt-0.5">还有 {c.daysLeft} 天解锁</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ═══════════ 主页面 ═══════════

export default function CompanionSettings() {
  const { data: serverConfig, isLoading, refetch } = trpc.companion.getConfig.useQuery();
  const updateMutation = trpc.companion.update.useMutation({
    onSuccess: () => { refetch(); setSaveStatus("saved"); setTimeout(() => setSaveStatus("idle"), 2000); },
    onError: (err) => toast.error("保存失败: " + err.message),
  });

  const [config, setConfig] = useState<CompanionConfig>({
    enabled: false, name: "", gender: "female", personality: "gentle",
    relationship: "girlfriend", voiceId: "", customSoul: "", specialDates: [],
  });
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const [sdDate, setSdDate] = useState("");
  const [sdLabel, setSdLabel] = useState("");
  const [sdType, setSdType] = useState("birthday");
  const [collapsedProviders, setCollapsedProviders] = useState<Record<string, boolean>>({ volcengine: false, dashscope: true });
  const toggleProvider = (p: string) => setCollapsedProviders(prev => ({ ...prev, [p]: !prev[p] }));

  useEffect(() => { if (serverConfig) setConfig(prev => ({ ...prev, ...serverConfig })); }, [serverConfig]);

  const handleSave = () => { setSaveStatus("saving"); updateMutation.mutate(config); };

  // Ctrl+S
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); if (!updateMutation.isPending) handleSave(); } };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [config]);

  // 音色试听
  const previewVoice = async (voiceId: string, provider?: string) => {
    if (previewingVoice) return;
    setPreviewingVoice(voiceId);
    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const params = new URLSearchParams({ voice: voiceId });
      if (provider) params.set("provider", provider);
      const resp = await fetch(`/api/tts/preview?${params.toString()}`, { headers, credentials: "include" });
      if (!resp.ok) { toast.error("试听失败"); setPreviewingVoice(null); return; }
      const ct = resp.headers.get("content-type") || "";
      if (ct.includes("application/json")) { const d = await resp.json(); if (d.error || d.available === false) { toast.error(d.error || "此音色不可用"); setPreviewingVoice(null); return; } }
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.onended = () => { setPreviewingVoice(null); URL.revokeObjectURL(url); };
      audio.onerror = () => { setPreviewingVoice(null); URL.revokeObjectURL(url); };
      audio.play();
    } catch { toast.error("试听失败"); setPreviewingVoice(null); }
  };

  // 推荐音色
  const recommendedVoices = VOICE_PERSONALITY_MATCH[config.personality]?.[config.gender] || [];
  const genderVoices = RECOMMENDED_VOICES[config.gender] || RECOMMENDED_VOICES.female;
  const sortedVoices = [...genderVoices].sort((a, b) => {
    const aR = recommendedVoices.includes(a.voiceId) ? 0 : 1;
    const bR = recommendedVoices.includes(b.voiceId) ? 0 : 1;
    return aR - bR;
  });

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => window.history.back()} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Heart className="w-6 h-6 text-pink-500" /> 伴侣模式
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">为语音和文字对话设置一个有性格、有记忆的 AI 伴侣</p>
          </div>
          <button onClick={handleSave} disabled={updateMutation.isPending}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              saveStatus === "saved" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-pink-600 text-white hover:bg-pink-700 shadow-sm"
            }`}>
            {saveStatus === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : saveStatus === "saved" ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saveStatus === "saved" ? "已保存" : "保存"}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载中...</div>
        ) : (
          <div className="space-y-5">

            {/* ── 总开关 ── */}
            <div className={`p-4 rounded-2xl border-2 transition-all ${
              config.enabled ? "border-pink-300 bg-pink-50/50 dark:border-pink-700 dark:bg-pink-950/20"
                : "border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900"
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                    config.enabled ? "bg-pink-100 dark:bg-pink-900/40" : "bg-gray-100 dark:bg-gray-800"
                  }`}><Heart className={`w-5 h-5 ${config.enabled ? "text-pink-500" : "text-gray-400"}`} /></div>
                  <div>
                    <p className="font-semibold text-sm">启用伴侣模式</p>
                    <p className="text-xs text-gray-400">{config.enabled ? "AI 将以伴侣人格与你对话" : "开启后 AI 将扮演你设定的伴侣"}</p>
                  </div>
                </div>
                <button onClick={() => setConfig(c => ({ ...c, enabled: !c.enabled }))}
                  className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${config.enabled ? "bg-pink-500" : "bg-gray-300 dark:bg-gray-600"}`}>
                  <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${config.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>

            {/* ── 优先级说明 ── */}
            {config.enabled && (
              <div className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/20 rounded-2xl border border-amber-100 dark:border-amber-900/50 text-sm text-amber-700 dark:text-amber-300">
                <span className="text-base shrink-0 mt-0.5">⚡</span>
                <div className="text-xs leading-relaxed">
                  <p className="font-medium mb-0.5">优先级说明</p>
                  <p>开启后，<strong>伴侣性格</strong>会覆盖「AI 人格配置」中的人格设定，但<strong>行为规范</strong>和<strong>记忆</strong>仍然生效。发送代码时会自动切换到专业模式。</p>
                </div>
              </div>
            )}

            {config.enabled && (
              <>
                {/* ── 一键套装 ── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-sm font-semibold">🎭 一键套装</h2>
                    <p className="text-xs text-gray-400 mt-0.5">选择预设快速配置，也可以之后微调</p>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-2">
                    {COMPANION_PRESETS.map(preset => (
                      <button key={preset.id} onClick={() => {
                        setConfig(c => ({
                          ...c, enabled: true, name: c.name || preset.suggestedName,
                          gender: preset.gender, personality: preset.personality,
                          relationship: preset.relationship, voiceId: preset.voiceId,
                        }));
                        toast.success(`已应用「${preset.label}」`);
                      }} className="flex flex-col items-center gap-1 p-3 rounded-xl border-2 border-gray-100 dark:border-gray-800 hover:border-pink-300 dark:hover:border-pink-700 hover:bg-pink-50/50 dark:hover:bg-pink-950/20 transition-all text-center">
                        <span className="text-2xl">{preset.emoji}</span>
                        <span className="text-xs font-medium">{preset.label}</span>
                        <span className="text-[10px] text-gray-400 line-clamp-1">{preset.desc}</span>
                      </button>
                    ))}
                  </div>
                </section>

                {/* ── 基本信息 ── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-sm font-semibold">基本信息</h2>
                  </div>
                  <div className="p-4 space-y-4">
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">TA 的名字</label>
                      <input type="text" value={config.name} onChange={e => setConfig(c => ({ ...c, name: e.target.value }))}
                        placeholder="给 TA 取个名字吧" maxLength={20}
                        className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 focus:border-transparent" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">TA 的性别</label>
                      <div className="flex gap-2">
                        {(["female", "male"] as const).map(g => (
                          <button key={g} onClick={() => setConfig(c => ({ ...c, gender: g, voiceId: "" }))}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                              config.gender === g ? "border-pink-400 bg-pink-50 text-pink-700 dark:border-pink-600 dark:bg-pink-950/30 dark:text-pink-300"
                                : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                            }`}>{g === "female" ? "👩 女生" : "👨 男生"}</button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500 mb-1.5 block">你们的关系</label>
                      <div className="grid grid-cols-3 gap-2">
                        {RELATIONSHIP_TYPES.map(rel => (
                          <button key={rel.id} onClick={() => setConfig(c => ({ ...c, relationship: rel.id }))}
                            className={`py-2.5 rounded-xl text-sm font-medium border-2 transition-all text-center ${
                              config.relationship === rel.id ? "border-pink-400 bg-pink-50 text-pink-700 dark:border-pink-600 dark:bg-pink-950/30 dark:text-pink-300"
                                : "border-gray-200 text-gray-500 hover:border-gray-300 dark:border-gray-700 dark:text-gray-400"
                            }`}>
                            <span className="block text-base">{rel.emoji}</span>
                            <span className="text-xs">{rel.label[config.gender]}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* ── 性格选择（10+自定义） ── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5"><Sparkles className="w-4 h-4 text-pink-500" /> TA 的性格</h2>
                  </div>
                  <div className="p-4 space-y-2">
                    {PERSONALITY_TEMPLATES.map(tmpl => (
                      <button key={tmpl.id} onClick={() => setConfig(c => ({ ...c, personality: tmpl.id }))}
                        className={`w-full flex items-start gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                          config.personality === tmpl.id ? "border-pink-400 bg-pink-50/50 dark:border-pink-600 dark:bg-pink-950/20"
                            : "border-gray-100 hover:border-gray-200 dark:border-gray-800 dark:hover:border-gray-700"
                        }`}>
                        <span className="text-xl shrink-0 mt-0.5">{tmpl.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{tmpl.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{tmpl.desc}</p>
                        </div>
                        {config.personality === tmpl.id && <Check className="w-4 h-4 text-pink-500 shrink-0 mt-1" />}
                      </button>
                    ))}
                    {config.personality === "custom" && (
                      <div className="mt-3 pl-10">
                        <textarea value={config.customSoul} onChange={e => setConfig(c => ({ ...c, customSoul: e.target.value }))}
                          placeholder='描述 TA 的性格，例如："说话慢悠悠的，喜欢讲冷笑话..."'
                          className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400 min-h-[80px] resize-none"
                          maxLength={2000} />
                        <p className="text-xs text-gray-400 text-right mt-1">{config.customSoul.length}/2000</p>
                      </div>
                    )}
                  </div>
                </section>

                {/* ── 专属音色（按服务商分组折叠） ── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-sm font-semibold flex items-center gap-1.5"><Mic className="w-4 h-4 text-pink-500" /> TA 的声音</h2>
                    <p className="text-xs text-gray-400 mt-0.5">选择一个专属音色，语音对话时自动使用</p>
                  </div>
                  <div className="p-4 space-y-1.5">
                    <button onClick={() => setConfig(c => ({ ...c, voiceId: "" }))}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${
                        !config.voiceId ? "border-pink-400 bg-pink-50/50 dark:border-pink-600 dark:bg-pink-950/20" : "border-gray-100 hover:border-gray-200 dark:border-gray-800"
                      }`}>
                      <span className="text-gray-400 text-sm">🔊</span>
                      <span className="text-sm flex-1">跟随语音方案设置</span>
                      {!config.voiceId && <Check className="w-4 h-4 text-pink-500" />}
                    </button>

                    {/* 按服务商分组 */}
                    {(() => {
                      const volcVoices = sortedVoices.filter(v => v.provider === "volcengine");
                      const dashVoices = sortedVoices.filter(v => v.provider === "dashscope");
                      const groups = [
                        { key: "volcengine", label: "🔥 火山引擎·豆包", voices: volcVoices },
                        { key: "dashscope", label: "🍃 阿里·CosyVoice", voices: dashVoices },
                      ];
                      return groups.map(group => {
                        if (group.voices.length === 0) return null;
                        const isCollapsed = collapsedProviders[group.key];
                        const hasSelected = group.voices.some(v => v.voiceId === config.voiceId);
                        return (
                          <div key={group.key} className="mt-2">
                            <button onClick={() => toggleProvider(group.key)}
                              className="w-full flex items-center gap-2 py-2 px-1 text-left group">
                              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isCollapsed ? "-rotate-90" : ""}`} />
                              <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{group.label}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-400">{group.voices.length}</span>
                              {hasSelected && isCollapsed && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400">已选</span>}
                              <span className="flex-1" />
                              <span className="text-[10px] text-gray-300 dark:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity">{isCollapsed ? "展开" : "收起"}</span>
                            </button>
                            {!isCollapsed && (
                              <div className="space-y-1.5 mt-1">
                                {group.voices.map(v => {
                                  const isRecommended = recommendedVoices.includes(v.voiceId);
                                  return (
                                    <div key={v.voiceId} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                                      config.voiceId === v.voiceId ? "border-pink-400 bg-pink-50/50 dark:border-pink-600 dark:bg-pink-950/20"
                                        : "border-gray-100 hover:border-gray-200 dark:border-gray-800"
                                    }`}>
                                      <button onClick={() => setConfig(c => ({ ...c, voiceId: v.voiceId }))} className="flex-1 text-left text-sm flex items-center gap-2">
                                        {v.label}
                                        {isRecommended && (
                                          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400 font-medium">推荐</span>
                                        )}
                                      </button>
                                      <button onClick={() => previewVoice(v.voiceId, v.provider)} disabled={previewingVoice !== null}
                                        className="p-1.5 rounded-lg hover:bg-pink-100 dark:hover:bg-pink-900/30 text-gray-400 hover:text-pink-500 transition-colors shrink-0">
                                        {previewingVoice === v.voiceId ? <Loader2 className="w-4 h-4 animate-spin text-pink-500" /> : <Volume2 className="w-4 h-4" />}
                                      </button>
                                      {config.voiceId === v.voiceId && <Check className="w-4 h-4 text-pink-500 shrink-0" />}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                </section>

                {/* ── 特殊日期 ── */}
                <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                    <h2 className="text-sm font-semibold">🎂 重要日期</h2>
                    <p className="text-xs text-gray-400 mt-0.5">设置生日、纪念日，{config.name || "TA"} 会在当天特别问候你</p>
                  </div>
                  <div className="p-4 space-y-2">
                    {(config.specialDates || []).map((sd: any, idx: number) => (
                      <div key={idx} className="flex items-center gap-2 p-2 rounded-xl border border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                        <span className="text-sm flex-1">{sd.type === "birthday" ? "🎂" : sd.type === "anniversary" ? "💕" : "📅"} {sd.label}（{sd.date}）</span>
                        <button onClick={() => setConfig(c => ({ ...c, specialDates: (c.specialDates || []).filter((_: any, i: number) => i !== idx) }))}
                          className="text-xs text-gray-400 hover:text-red-400 px-2">删除</button>
                      </div>
                    ))}
                    {(config.specialDates || []).length < 10 && (
                      <div className="flex gap-2 pt-1">
                        <input type="text" placeholder="MM-DD" maxLength={5} value={sdDate} onChange={e => setSdDate(e.target.value)}
                          className="w-24 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm" />
                        <input type="text" placeholder="备注" maxLength={30} value={sdLabel} onChange={e => setSdLabel(e.target.value)}
                          className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm" />
                        <select value={sdType} onChange={e => setSdType(e.target.value)}
                          className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm">
                          <option value="birthday">生日</option><option value="anniversary">纪念日</option><option value="custom">其他</option>
                        </select>
                        <button onClick={() => {
                          if (!sdDate || !sdLabel) { toast.error("请填写日期和备注"); return; }
                          if (!/^\d{2}-\d{2}$/.test(sdDate)) { toast.error("日期格式：MM-DD"); return; }
                          setConfig(c => ({ ...c, specialDates: [...(c.specialDates || []), { date: sdDate, label: sdLabel, type: sdType }] }));
                          setSdDate(""); setSdLabel("");
                        }} className="px-3 py-1.5 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600">添加</button>
                      </div>
                    )}
                  </div>
                </section>

                {/* ── 定时消息管理 ── */}
                <ScheduleSection
                  schedule={(config as any)._schedule || {}}
                  onChange={(s) => setConfig(c => ({ ...c, _schedule: s } as any))}
                  companionName={config.name || "TA"}
                />

                {/* ── 自定义提醒 ── */}
                <ReminderSection companionName={config.name || "TA"} />

                {/* ── 习惯打卡 ── */}
                <HabitSection companionName={config.name || "TA"} />

                {/* ── 试聊预览 ── */}
                <TrialChatPreview config={config} />

                {/* ── 闹钟语音包 ── */}
                <AlarmVoicePack
                  voiceId={config.voiceId}
                  personality={config.personality}
                  companionName={config.name || "TA"}
                  gender={config.gender}
                />

                {/* ── 情绪追踪 v2 ── */}
                <EmotionDashboard />

                {/* ── 周报 ── */}
                <WeeklyReportViewer companionName={config.name || "TA"} />

                {/* ── 时间胶囊 ── */}
                <TimeCapsuleViewer />

                {/* ── 日记 ── */}
                <DiaryViewer companionName={config.name || "TA"} />

                {/* ── 使用提示 ── */}
                <div className="flex items-start gap-3 p-3 bg-pink-50 dark:bg-pink-950/20 rounded-2xl border border-pink-100 dark:border-pink-900/50 text-sm text-pink-700 dark:text-pink-300">
                  <Heart className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <p>保存后进入<strong>语音对话</strong>或<strong>文字聊天</strong>即可体验。{config.name || "TA"} 会跨会话记住你说过的事。</p>
                    <p className="mt-1 text-xs opacity-70">提示：在「AI 人格配置」中设置的记忆和行为规范同样生效。</p>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
