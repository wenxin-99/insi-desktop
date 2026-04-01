/**
 * CompanionScheduleSection.tsx — 定时功能管理区块
 *
 * 放在 CompanionSettings.tsx 中的子组件，提供：
 * ① 定时问候开关 + 时间自定义
 * ② 习惯打卡管理（添加/查看/打卡/删除）
 * ③ 伴侣电台开关 + 时间设置
 *
 * 数据存储在 companionConfig._schedule 子对象中，
 * companionScheduler.ts 在发送前读取此配置决定是否发送。
 *
 * 在 CompanionSettings.tsx 中引入:
 *   import { ScheduleSection, HabitSection } from "./voiceChat/CompanionScheduleSection";
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Bell, Clock, Radio, Plus, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";

// ═══════════ 类型 ═══════════

export interface ScheduleConfig {
  greetingEnabled: boolean;
  greetingTimes: {
    morning: string;    // "08:00"
    noon: string;       // "12:30"
    evening: string;    // "22:30"
  };
  lateNightCare: boolean;
  radioEnabled: boolean;
  radioTime: string;    // "21:00"
}

const DEFAULT_SCHEDULE: ScheduleConfig = {
  greetingEnabled: true,
  greetingTimes: { morning: "08:00", noon: "12:30", evening: "22:30" },
  lateNightCare: true,
  radioEnabled: false,
  radioTime: "21:00",
};

// ═══════════ ① 定时问候 + 电台管理 ═══════════

interface ScheduleSectionProps {
  schedule: ScheduleConfig;
  onChange: (schedule: ScheduleConfig) => void;
  companionName: string;
}

export function ScheduleSection({ schedule, onChange, companionName }: ScheduleSectionProps) {
  const s = { ...DEFAULT_SCHEDULE, ...schedule };

  const updateField = (path: string, value: any) => {
    const updated = { ...s };
    if (path === "greetingEnabled") updated.greetingEnabled = value;
    else if (path === "lateNightCare") updated.lateNightCare = value;
    else if (path === "radioEnabled") updated.radioEnabled = value;
    else if (path === "radioTime") updated.radioTime = value;
    else if (path.startsWith("greetingTimes.")) {
      const key = path.split(".")[1] as keyof typeof updated.greetingTimes;
      updated.greetingTimes = { ...updated.greetingTimes, [key]: value };
    }
    onChange(updated);
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <Bell className="w-4 h-4 text-pink-500" /> 定时消息
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">{companionName} 会在这些时间主动找你</p>
      </div>
      <div className="p-4 space-y-4">

        {/* 定时问候总开关 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">每日问候</p>
            <p className="text-xs text-gray-400">早安 · 午间 · 晚安</p>
          </div>
          <button onClick={() => updateField("greetingEnabled", !s.greetingEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${s.greetingEnabled ? "bg-pink-500" : "bg-gray-300 dark:bg-gray-600"}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${s.greetingEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* 时间自定义 */}
        {s.greetingEnabled && (
          <div className="grid grid-cols-3 gap-2 pl-1">
            {([
              { key: "morning" as const, label: "早安", emoji: "🌅" },
              { key: "noon" as const, label: "午间", emoji: "☀️" },
              { key: "evening" as const, label: "晚安", emoji: "🌙" },
            ]).map(({ key, label, emoji }) => (
              <div key={key} className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-400">{emoji} {label}</span>
                <input
                  type="time"
                  value={s.greetingTimes[key]}
                  onChange={e => updateField(`greetingTimes.${key}`, e.target.value)}
                  className="w-full text-center text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-1.5 py-1 focus:outline-none focus:ring-1 focus:ring-pink-400"
                />
              </div>
            ))}
          </div>
        )}

        {/* 分隔线 */}
        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* 深夜关怀 */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">深夜关怀</p>
            <p className="text-xs text-gray-400">凌晨还在活跃时，{companionName} 会提醒你休息</p>
          </div>
          <button onClick={() => updateField("lateNightCare", !s.lateNightCare)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${s.lateNightCare ? "bg-pink-500" : "bg-gray-300 dark:bg-gray-600"}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${s.lateNightCare ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>

        {/* 分隔线 */}
        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* 伴侣电台 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Radio className="w-4 h-4 text-purple-500" />
            <div>
              <p className="text-sm font-medium">伴侣电台</p>
              <p className="text-xs text-gray-400">每晚一段语音独白，回顾今天的聊天</p>
            </div>
          </div>
          <button onClick={() => updateField("radioEnabled", !s.radioEnabled)}
            className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${s.radioEnabled ? "bg-purple-500" : "bg-gray-300 dark:bg-gray-600"}`}>
            <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${s.radioEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
          </button>
        </div>
        {s.radioEnabled && (
          <div className="flex items-center gap-2 pl-6">
            <Clock className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-400">播放时间</span>
            <input
              type="time"
              value={s.radioTime}
              onChange={e => updateField("radioTime", e.target.value)}
              className="text-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-purple-400"
            />
          </div>
        )}
      </div>
    </section>
  );
}

// ═══════════ ② 习惯打卡管理 ═══════════

export function HabitSection({ companionName }: { companionName: string }) {
  const { data: habits, refetch } = trpc.companion.getHabits.useQuery(undefined, {
    staleTime: 10_000, refetchOnWindowFocus: true,
    refetchInterval: 60_000, // ★ v2 fix: 自动刷新确保打卡状态同步
  });
  const addMutation = trpc.companion.addHabit.useMutation({
    onSuccess: () => { refetch(); setNewGoal(""); toast.success("已添加"); },
    onError: () => toast.error("添加失败"),
  });
  const checkInMutation = trpc.companion.checkInHabit.useMutation({
    onSuccess: (data) => {
      refetch();
      if (data?.streak && data.streak >= 3) toast.success(`连续 ${data.streak} 天！`);
      else toast.success("已打卡 ✓");
    },
  });

  const [newGoal, setNewGoal] = useState("");
  const [newHour, setNewHour] = useState(20);

  if (!habits) return null;

  const today = new Date().toISOString().split("T")[0];

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          📝 学习打卡
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">{companionName} 会在约定时间提醒你，还会根据连续打卡表扬你</p>
      </div>
      <div className="p-4 space-y-3">

        {/* 现有习惯 */}
        {habits.length > 0 ? (
          habits.map((h: any) => {
            const checkedToday = h.lastCheckIn === today;
            return (
              <div key={h.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                checkedToday
                  ? "border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/20"
                  : "border-gray-100 dark:border-gray-800"
              }`}>
                {/* 打卡按钮 */}
                <button
                  onClick={() => checkInMutation.mutate({ habitId: h.id })}
                  disabled={checkedToday || checkInMutation.isPending}
                  className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all ${
                    checkedToday
                      ? "bg-green-500 text-white"
                      : "border-2 border-gray-300 dark:border-gray-600 hover:border-pink-400 text-gray-300 hover:text-pink-500"
                  }`}
                >
                  {checkedToday ? <Check className="w-4 h-4" /> : checkInMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                </button>

                {/* 内容 */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${checkedToday ? "text-green-700 dark:text-green-300" : ""}`}>{h.goal}</p>
                  <p className="text-xs text-gray-400">
                    {h.streak > 0 ? `🔥 连续 ${h.streak} 天` : "尚未开始"}
                    {" · "}
                    每天 {h.reminderHour}:00 提醒
                  </p>
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-center text-xs text-gray-400 py-2">
            还没有打卡目标，添加一个吧
          </p>
        )}

        {/* 添加新习惯 */}
        {habits.length < 5 && (
          <div className="flex gap-2 pt-1">
            <input
              type="text"
              value={newGoal}
              onChange={e => setNewGoal(e.target.value)}
              placeholder="例如：每天背 20 个单词"
              maxLength={50}
              className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-pink-400"
            />
            <select
              value={newHour}
              onChange={e => setNewHour(parseInt(e.target.value))}
              className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-2 text-sm w-20"
            >
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={i}>{String(i).padStart(2, "0")}:00</option>
              ))}
            </select>
            <button
              onClick={() => {
                if (!newGoal.trim()) { toast.error("请填写打卡目标"); return; }
                addMutation.mutate({ goal: newGoal.trim(), reminderHour: newHour });
              }}
              disabled={addMutation.isPending}
              className="px-3 py-2 bg-pink-500 text-white rounded-lg text-sm hover:bg-pink-600 disabled:opacity-40 shrink-0"
            >
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        )}
        {habits.length >= 5 && (
          <p className="text-xs text-gray-400 text-center">最多 5 个打卡目标</p>
        )}
      </div>
    </section>
  );
}
