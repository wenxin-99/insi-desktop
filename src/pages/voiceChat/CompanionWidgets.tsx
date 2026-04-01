/**
 * CompanionWidgets.tsx — 伴侣前端小组件
 *
 * ① 好感度涟漪（WarmthRipple）— 设置页伴侣名字区域的光晕效果
 * ② 闹钟语音包（AlarmVoicePack）— 生成 + 下载伴侣音色的闹钟铃声
 *
 * 在 CompanionSettings.tsx 中引入使用。
 *
 * ★ v2 fixes:
 *   - [].every(Boolean) 空数组 vacuous truth → 按钮永远 disabled → 加 length 检查
 *   - generatedFlags/audioUrls 组件级 state 刷新后丢失 → localStorage 持久化 + 按天重置
 *   - 试听播放按钮只在当次会话有 audioUrls 时显示 → 从 localStorage 恢复 base64 音频
 */
import { useState, useEffect, useCallback } from "react";
import { Loader2, Download, Volume2, Play } from "lucide-react";
import { toast } from "sonner";

// ═══════════════════════════════════════════
// ① 好感度涟漪
// ═══════════════════════════════════════════

interface WarmthRippleProps {
  chatStreak: number;
  lastChatAt: string | null;
  companionName: string;
  children?: React.ReactNode;
}

/**
 * 基于关系温度显示光晕效果的容器
 *
 * 用法：
 * <WarmthRipple chatStreak={state.chatStreak} lastChatAt={state.lastChatAt} companionName={name}>
 *   <Heart className="w-6 h-6" />
 * </WarmthRipple>
 */
export function WarmthRipple({ chatStreak, lastChatAt, companionName, children }: WarmthRippleProps) {
  // 计算温度 0-1
  let warmth = 0;
  if (lastChatAt) {
    const hoursSince = (Date.now() - new Date(lastChatAt).getTime()) / (1000 * 60 * 60);
    // 最近聊天 → 高温度；超过 3 天 → 逐渐降低
    const recencyFactor = Math.max(0, 1 - hoursSince / 72); // 72小时内从 1→0
    const streakFactor = Math.min(1, chatStreak / 7); // 7天连续聊 → 满分
    warmth = recencyFactor * 0.6 + streakFactor * 0.4;
  }

  // 温度 → 视觉效果
  const glowIntensity = Math.round(warmth * 100);
  const glowColor = warmth > 0.6 ? "rgba(236,72,153," : warmth > 0.3 ? "rgba(249,168,212," : "rgba(209,213,219,";
  const pulseSpeed = warmth > 0.6 ? "2s" : warmth > 0.3 ? "3s" : "0s";

  return (
    <div className="relative inline-flex items-center justify-center">
      {/* 光晕层 */}
      {warmth > 0.1 && (
        <div
          className="absolute inset-0 rounded-full"
          style={{
            boxShadow: `0 0 ${12 + glowIntensity * 0.2}px ${4 + glowIntensity * 0.1}px ${glowColor}${(warmth * 0.4).toFixed(2)})`,
            animation: pulseSpeed !== "0s" ? `warmth-pulse ${pulseSpeed} ease-in-out infinite` : "none",
          }}
        />
      )}
      {/* 内容 */}
      <div className="relative z-10">{children}</div>

      {/* 注入动画 keyframes（只注入一次） */}
      <style>{`
        @keyframes warmth-pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════
// ② 闹钟语音包
// ═══════════════════════════════════════════

interface AlarmVoicePackProps {
  voiceId: string;
  personality: string;
  companionName: string;
  gender: "female" | "male";
}

// 各性格的闹钟文案
const ALARM_SCRIPTS: Record<string, { female: string[]; male: string[] }> = {
  gentle: {
    female: [
      "早安呀，该起床了哦，新的一天在等你呢",
      "嗯…起来吧，今天也要好好的",
      "别赖床了，我给你倒了一杯温水，快来",
    ],
    male: [
      "早安，该起床了，今天也会是好的一天",
      "醒醒，我在呢，慢慢起来就好",
      "新的一天开始了，别急，先伸个懒腰",
    ],
  },
  playful: {
    female: [
      "起床起床！太阳都晒屁股了！再不起我要掀被子了！",
      "叮咚！您的专属闹钟已到达战场！快起来打怪！",
      "喂！都几点了！你的早餐在哭泣！快去拯救它！",
    ],
    male: [
      "兄弟醒醒！再睡就要迟到了！三二一起！",
      "起来！今天的快乐在等着你呢！别让它等太久！",
      "再不起来我就要唱歌了哦，你确定要听？",
    ],
  },
  tsundere: {
    female: [
      "哼，才不是特意来叫你起床的，只是顺便路过而已",
      "都几点了还在睡？我…我不是担心你迟到啦",
      "起来！再不起我就不理你了…才怪",
    ],
    male: [
      "喂，该起了。别多想，我只是设了提醒而已",
      "起床。不是为你，是怕你迟到给我丢脸",
      "还在睡？随便你…但你最好五分钟内起来",
    ],
  },
  humorous: {
    female: [
      "紧急通知！你的被窝使用权已到期，请立即撤离！",
      "据报道，有人的闹钟响了十分钟还在装死，疑似是你",
      "起床啦！你知道吗，每天叫你起床消耗了我百分之八十的可爱",
    ],
    male: [
      "早上好！你又成功打败了闹钟，但被窝不是你的盟友",
      "全球最新研究：赖床不会变帅，但起床可以吃早餐",
      "提示：您的起床困难症已连续发作，建议立即治疗，药方是站起来",
    ],
  },
  cool: {
    female: ["该起了。", "时间到。起床。", "醒了吗。新的一天。"],
    male: ["起来。", "时间不等人。", "……该起了。"],
  },
  caring: {
    female: [
      "早安呀，昨晚睡得好吗？慢慢起来，别着急",
      "起床了，记得先喝杯温水再洗漱哦",
      "新的一天开始了，不管今天怎么样，我都在",
    ],
    male: [
      "早上好，该起床了，今天降温了记得多穿点",
      "醒了吗？别急，先活动活动再起来",
      "起来吧，今天的事情一件一件来，别有压力",
    ],
  },
};

// ── localStorage 持久化工具 ──

/** 今天的日期字符串 YYYY-MM-DD */
function getTodayKey(): string {
  return new Date().toISOString().split("T")[0];
}

/** 构造 localStorage key */
function storageKey(voiceId: string, personality: string): string {
  return `alarm_voice_pack_${voiceId}_${personality}`;
}

interface PersistedAlarmState {
  date: string;              // YYYY-MM-DD
  generatedFlags: boolean[]; // 每条是否已生成
  audioBase64: (string | null)[];  // base64 编码的音频（null=未生成）
}

function loadPersistedState(voiceId: string, personality: string): PersistedAlarmState | null {
  try {
    const raw = localStorage.getItem(storageKey(voiceId, personality));
    if (!raw) return null;
    const parsed: PersistedAlarmState = JSON.parse(raw);
    // 只返回今天的数据；跨天自动失效
    if (parsed.date !== getTodayKey()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function savePersistedState(voiceId: string, personality: string, state: PersistedAlarmState): void {
  try {
    localStorage.setItem(storageKey(voiceId, personality), JSON.stringify(state));
  } catch {
    // localStorage 空间不足时静默失败
  }
}

/** 将 Blob 转为 base64 字符串 */
async function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/** 将 base64 字符串转为 Object URL（用于 Audio 播放） */
function base64ToObjectUrl(base64: string): string {
  try {
    const parts = base64.split(",");
    const mime = parts[0].match(/:(.*?);/)?.[1] || "audio/mpeg";
    const raw = atob(parts[1]);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    return URL.createObjectURL(blob);
  } catch {
    return "";
  }
}

export function AlarmVoicePack({ voiceId, personality, companionName, gender }: AlarmVoicePackProps) {
  const [generating, setGenerating] = useState(false);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [playingIdx, setPlayingIdx] = useState<number | null>(null);
  const [generatedFlags, setGeneratedFlags] = useState<boolean[]>([]);
  // ★ base64 缓存（用于持久化到 localStorage）
  const [audioBase64Cache, setAudioBase64Cache] = useState<(string | null)[]>([]);

  const scripts = ALARM_SCRIPTS[personality]?.[gender] || ALARM_SCRIPTS.gentle[gender];

  // ★ v2: 组件挂载时从 localStorage 恢复今天的状态
  useEffect(() => {
    if (!voiceId || !personality) return;
    const persisted = loadPersistedState(voiceId, personality);
    if (persisted && persisted.generatedFlags?.length > 0) {
      setGeneratedFlags(persisted.generatedFlags);
      // 恢复 base64 → object URL
      const urls: string[] = [];
      for (let i = 0; i < persisted.audioBase64.length; i++) {
        const b64 = persisted.audioBase64[i];
        if (b64) {
          urls[i] = base64ToObjectUrl(b64);
        }
      }
      setAudioUrls(urls);
      setAudioBase64Cache(persisted.audioBase64);
    } else {
      // 新的一天 / 无缓存 → 重置
      setGeneratedFlags([]);
      setAudioUrls([]);
      setAudioBase64Cache([]);
    }
  }, [voiceId, personality]);

  // ★ v2 fix: allGenerated 避免 [].every(Boolean) vacuous truth
  const allGenerated = generatedFlags.length === scripts.length && generatedFlags.every(Boolean);

  const handleGenerate = async () => {
    if (!voiceId) { toast.error("请先选择伴侣音色"); return; }
    setGenerating(true);

    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const newUrls = [...audioUrls];
      const newFlags = [...generatedFlags];
      const newBase64 = [...audioBase64Cache];
      let successCount = 0;
      let rateLimited = false;

      for (let i = 0; i < scripts.length; i++) {
        // 已生成过的跳过
        if (newFlags[i]) continue;

        const text = scripts[i];
        const params = new URLSearchParams({ voice: voiceId });
        const resp = await fetch(`/api/tts/preview?${params.toString()}`, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ text }),
        });

        if (resp.status === 429) {
          const data = await resp.json().catch(() => ({ error: "生成次数已达上限" }));
          toast.error(data.error || "生成过于频繁");
          rateLimited = true;
          break;
        }

        if (!resp.ok) {
          console.warn(`[AlarmVoice] Line ${i} failed: ${resp.status}`);
          continue;
        }

        const blob = await resp.blob();
        newUrls[i] = URL.createObjectURL(blob);
        newFlags[i] = true;
        // ★ v2: 同时缓存 base64 用于持久化
        try {
          newBase64[i] = await blobToBase64(blob);
        } catch {
          newBase64[i] = null;
        }
        successCount++;
      }

      setAudioUrls(newUrls);
      setGeneratedFlags(newFlags);
      setAudioBase64Cache(newBase64);

      // ★ v2: 持久化到 localStorage
      savePersistedState(voiceId, personality, {
        date: getTodayKey(),
        generatedFlags: newFlags,
        audioBase64: newBase64,
      });

      if (successCount > 0) toast.success(`已生成 ${successCount} 条闹钟语音`);
      else if (!rateLimited) toast.error("语音生成失败");
    } catch {
      toast.error("语音生成失败");
    } finally {
      setGenerating(false);
    }
  };

  const playPreview = useCallback((idx: number) => {
    if (!audioUrls[idx]) return;
    setPlayingIdx(idx);
    const audio = new Audio(audioUrls[idx]);
    audio.onended = () => setPlayingIdx(null);
    audio.onerror = () => setPlayingIdx(null);
    audio.play().catch(() => setPlayingIdx(null));
  }, [audioUrls]);

  const downloadAll = () => {
    audioUrls.forEach((url, i) => {
      if (!url) return;
      const a = document.createElement("a");
      a.href = url;
      a.download = `${companionName}_闹钟${i + 1}.mp3`;
      a.click();
    });
    toast.success("开始下载，保存后可设为手机闹钟铃声");
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
        <h2 className="text-sm font-semibold">⏰ 闹钟语音包</h2>
        <button onClick={handleGenerate} disabled={generating || !voiceId || allGenerated}
          className="text-xs px-3 py-1.5 rounded-lg bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-40 transition-colors flex items-center gap-1">
          {generating ? <><Loader2 className="w-3 h-3 animate-spin" /> 生成中...</>
            : allGenerated ? "已全部生成"
            : "生成语音"}
        </button>
      </div>
      <div className="p-4 space-y-2">
        {scripts.map((text, i) => (
          <div key={i} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-800">
            <span className="text-xs text-gray-400 w-6 text-center shrink-0">{i + 1}</span>
            <span className="flex-1 text-sm text-gray-600 dark:text-gray-300 line-clamp-1">{text}</span>
            {generatedFlags[i] && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-600 dark:bg-green-900/40 dark:text-green-400 shrink-0">已生成</span>}
            {/* ★ v2: 试听按钮 — 有音频就显示（包括从 localStorage 恢复的） */}
            {audioUrls[i] && (
              <button onClick={() => playPreview(i)} className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
                title="试听">
                {playingIdx === i
                  ? <Volume2 className="w-4 h-4 text-purple-500 animate-pulse" />
                  : <Play className="w-4 h-4 text-gray-400" />}
              </button>
            )}
          </div>
        ))}
        {audioUrls.length > 0 && audioUrls.some(Boolean) && (
          <button onClick={downloadAll}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl border-2 border-dashed border-purple-200 text-purple-600 text-sm hover:bg-purple-50 dark:border-purple-800 dark:text-purple-400 dark:hover:bg-purple-950/20 transition-colors">
            <Download className="w-4 h-4" /> 下载全部（可设为手机闹钟铃声）
          </button>
        )}
        {!voiceId && (
          <p className="text-xs text-gray-400 text-center py-2">请先在上方选择伴侣音色后再生成</p>
        )}
        <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center">每条限生成一次 · 每天最多 3 条 · 次日自动重置</p>
      </div>
    </section>
  );
}
