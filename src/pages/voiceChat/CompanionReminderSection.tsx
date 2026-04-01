/**
 * CompanionReminderSection.tsx — 自定义提醒管理（v2）
 *
 * 支持：
 *   频率：每天 / 工作日 / 每周X / 每月X号 / 仅一次（指定日期）
 *   限制：执行次数上限 / 到期日期
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { AlarmClock, Plus, Trash2, Loader2, Power, PowerOff, CalendarDays } from "lucide-react";
import { toast } from "sonner";

// ═══════════ 类型 ═══════════

interface Reminder {
  id: number;
  content: string;
  cronHuman: string;
  repeatType: string;
  enabled: boolean;
  lastTriggeredAt: string | null;
  totalTriggered: number;
  maxTriggers: number | null;
  expireAt: string | null;
}

type RepeatType = "daily" | "weekday" | "weekly" | "monthly" | "once";

const REPEAT_OPTIONS: Array<{ value: RepeatType; label: string }> = [
  { value: "daily", label: "每天" },
  { value: "weekday", label: "工作日" },
  { value: "weekly", label: "每周" },
  { value: "monthly", label: "每月" },
  { value: "once", label: "仅一次" },
];

const WEEKDAY_OPTIONS = [
  { value: 1, label: "一" }, { value: 2, label: "二" },
  { value: 3, label: "三" }, { value: 4, label: "四" },
  { value: 5, label: "五" }, { value: 6, label: "六" },
  { value: 0, label: "日" },
];

// ═══════════ 组件 ═══════════

export function ReminderSection({ companionName }: { companionName: string }) {
  const { data: reminders, refetch } = trpc.companion.getReminders.useQuery(undefined, {
    staleTime: 10_000,
    refetchOnWindowFocus: true,
    refetchInterval: 60_000, // ★ v2 fix: 每 60s 自动刷新，确保执行后状态更新
  });

  const addMut = trpc.companion.addReminder.useMutation({
    onSuccess: () => { refetch(); resetForm(); toast.success("提醒已创建"); },
    onError: (e) => toast.error(e.message || "创建失败"),
  });
  const toggleMut = trpc.companion.toggleReminder.useMutation({
    onSuccess: (data) => { refetch(); toast.success(data.enabled ? "已启用" : "已暂停"); },
  });
  const deleteMut = trpc.companion.deleteReminder.useMutation({
    onSuccess: () => { refetch(); toast.success("已删除"); },
  });

  // 表单状态
  const [showForm, setShowForm] = useState(false);
  const [content, setContent] = useState("");
  const [time, setTime] = useState("21:00");
  const [repeatType, setRepeatType] = useState<RepeatType>("daily");
  const [weekday, setWeekday] = useState(1);
  const [monthDay, setMonthDay] = useState(1);
  const [onceDate, setOnceDate] = useState("");
  const [maxTriggers, setMaxTriggers] = useState<string>("");
  const [expireAt, setExpireAt] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const resetForm = () => {
    setContent(""); setTime("21:00"); setRepeatType("daily");
    setWeekday(1); setMonthDay(1); setOnceDate("");
    setMaxTriggers(""); setExpireAt(""); setShowAdvanced(false); setShowForm(false);
  };

  const handleAdd = () => {
    const trimmed = content.trim();
    if (!trimmed) { toast.error("请填写提醒内容"); return; }
    if (repeatType === "once" && !onceDate) { toast.error("请选择日期"); return; }

    addMut.mutate({
      content: trimmed,
      time,
      repeatType,
      weekday: repeatType === "weekly" ? weekday : undefined,
      monthDay: repeatType === "monthly" ? monthDay : undefined,
      onceDate: repeatType === "once" ? onceDate : undefined,
      maxTriggers: maxTriggers ? parseInt(maxTriggers) : undefined,
      expireAt: expireAt || undefined,
    });
  };

  // 预览文案
  const previewText = (() => {
    switch (repeatType) {
      case "daily": return `每天 ${time}`;
      case "weekday": return `工作日 ${time}`;
      case "weekly": return `每周${WEEKDAY_OPTIONS.find(w => w.value === weekday)?.label || ""} ${time}`;
      case "monthly": return `每月 ${monthDay} 号 ${time}`;
      case "once": return onceDate ? `${onceDate} ${time}` : `指定日期 ${time}`;
    }
  })();

  const limitText = (() => {
    const parts: string[] = [];
    if (maxTriggers) parts.push(`共 ${maxTriggers} 次`);
    if (expireAt) parts.push(`到 ${expireAt}`);
    return parts.length > 0 ? `（${parts.join("，")}）` : "";
  })();

  if (!reminders) return null;

  const isExpired = (r: Reminder) => {
    if (r.maxTriggers && r.totalTriggered >= r.maxTriggers) return true;
    if (r.expireAt && new Date(r.expireAt) < new Date()) return true;
    return false;
  };

  /** ★ v2: 格式化最后执行时间 */
  const formatLastTriggered = (dt: string | null): string => {
    if (!dt) return "";
    try {
      const d = new Date(dt);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffMin = Math.floor(diffMs / 60000);
      if (diffMin < 1) return "刚刚执行";
      if (diffMin < 60) return `${diffMin} 分钟前执行`;
      const diffHr = Math.floor(diffMin / 60);
      if (diffHr < 24) return `${diffHr} 小时前执行`;
      const diffDay = Math.floor(diffHr / 24);
      if (diffDay === 1) return "昨天执行";
      if (diffDay < 7) return `${diffDay} 天前执行`;
      return `${d.getMonth() + 1}/${d.getDate()} 执行`;
    } catch { return ""; }
  };

  return (
    <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <AlarmClock className="w-4 h-4 text-orange-500" /> 自定义提醒
        </h2>
        <p className="text-xs text-gray-400 mt-0.5">
          {companionName} 会在你设定的时间用 TA 的方式提醒你
        </p>
      </div>

      <div className="p-4 space-y-3">
        {/* 已有提醒列表 */}
        {reminders.length > 0 ? (
          reminders.map((r: Reminder) => {
            const expired = isExpired(r);
            return (
              <div key={r.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                expired ? "border-gray-200 bg-gray-50/50 dark:border-gray-800 dark:bg-gray-800/30 opacity-50"
                : r.enabled ? "border-orange-200 bg-orange-50/30 dark:border-orange-800/40 dark:bg-orange-950/10"
                : "border-gray-100 dark:border-gray-800 opacity-50"
              }`}>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${!r.enabled || expired ? "line-through text-gray-400" : ""}`}>
                    {r.content}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-gray-400">{r.cronHuman}</span>
                    {r.maxTriggers ? (
                      <span className="text-xs text-gray-300">{r.totalTriggered}/{r.maxTriggers} 次</span>
                    ) : r.totalTriggered > 0 ? (
                      <span className="text-xs text-gray-300">已提醒 {r.totalTriggered} 次</span>
                    ) : null}
                    {/* ★ v2: 显示最后执行时间 */}
                    {r.lastTriggeredAt && (
                      <span className="text-xs text-green-500 flex items-center gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-green-500 inline-block" />
                        {formatLastTriggered(r.lastTriggeredAt)}
                      </span>
                    )}
                    {r.expireAt && <span className="text-xs text-gray-300">截止 {r.expireAt.substring(0, 10)}</span>}
                    {expired && <span className="text-xs text-red-400 font-medium">已结束</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {!expired && (
                    <button onClick={() => toggleMut.mutate({ reminderId: r.id })} disabled={toggleMut.isPending}
                      className={`p-1.5 rounded-lg transition-colors ${r.enabled ? "text-orange-500 hover:bg-orange-100 dark:hover:bg-orange-900/30" : "text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"}`}
                      title={r.enabled ? "暂停" : "启用"}>
                      {r.enabled ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {confirmDeleteId === r.id ? (
                    <div className="flex items-center gap-1">
                      <button onClick={() => { deleteMut.mutate({ reminderId: r.id }); setConfirmDeleteId(null); }}
                        className="px-2 py-1 text-xs bg-red-500 text-white rounded-lg">确认</button>
                      <button onClick={() => setConfirmDeleteId(null)}
                        className="px-2 py-1 text-xs bg-gray-200 dark:bg-gray-700 rounded-lg">取消</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(r.id)}
                      className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : !showForm ? (
          <p className="text-center text-xs text-gray-400 py-2">还没有自定义提醒，点下方添加</p>
        ) : null}

        {/* 添加表单 */}
        {showForm ? (
          <div className="rounded-xl border border-orange-200 dark:border-orange-800/40 bg-orange-50/20 dark:bg-orange-950/10 p-3 space-y-3">
            {/* 内容 */}
            <input type="text" value={content} onChange={e => setContent(e.target.value)}
              placeholder="例如：洗澡、喝水、做眼保健操..." maxLength={100}
              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400"
              autoFocus onKeyDown={e => { if (e.key === "Enter" && !e.nativeEvent.isComposing) handleAdd(); }} />

            {/* 频率选择 */}
            <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
              {REPEAT_OPTIONS.map(opt => (
                <button key={opt.value} onClick={() => setRepeatType(opt.value)}
                  className={`flex-1 px-2 py-1.5 text-xs rounded-md transition-colors ${
                    repeatType === opt.value ? "bg-white dark:bg-gray-700 shadow-sm font-medium" : "text-gray-400 hover:text-gray-600"
                  }`}>{opt.label}</button>
              ))}
            </div>

            {/* 日期/周几/月号 + 时间 */}
            <div className="flex items-center gap-2 flex-wrap">
              {repeatType === "weekly" && (
                <div className="flex items-center gap-0.5 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
                  {WEEKDAY_OPTIONS.map(wd => (
                    <button key={wd.value} onClick={() => setWeekday(wd.value)}
                      className={`w-7 h-7 text-xs rounded-md transition-colors ${
                        weekday === wd.value ? "bg-white dark:bg-gray-700 shadow-sm font-medium" : "text-gray-400 hover:text-gray-600"
                      }`}>{wd.label}</button>
                  ))}
                </div>
              )}

              {repeatType === "monthly" && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-gray-400">每月</span>
                  <select value={monthDay} onChange={e => setMonthDay(Number(e.target.value))}
                    className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm w-20">
                    {Array.from({ length: 31 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>{i + 1} 号</option>
                    ))}
                  </select>
                </div>
              )}

              {repeatType === "once" && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3.5 h-3.5 text-gray-400" />
                  <input type="date" value={onceDate} onChange={e => setOnceDate(e.target.value)}
                    min={new Date().toISOString().split("T")[0]}
                    className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                </div>
              )}

              <input type="time" value={time} onChange={e => setTime(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
            </div>

            {/* 高级选项 */}
            <div>
              <button onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-gray-400 hover:text-orange-500 transition-colors">
                {showAdvanced ? "▾ 收起高级选项" : "▸ 执行次数 / 到期日期"}
              </button>
              {showAdvanced && (
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">最多执行</span>
                    <input type="number" value={maxTriggers} onChange={e => setMaxTriggers(e.target.value)}
                      placeholder="不限" min={1} max={9999}
                      className="w-16 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-1 focus:ring-orange-400" />
                    <span className="text-xs text-gray-400">次</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-gray-400">到期</span>
                    <input type="date" value={expireAt} onChange={e => setExpireAt(e.target.value)}
                      min={new Date().toISOString().split("T")[0]}
                      className="border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-orange-400" />
                    {expireAt && <button onClick={() => setExpireAt("")} className="text-xs text-gray-300 hover:text-red-400">清除</button>}
                  </div>
                </div>
              )}
            </div>

            {/* 预览 + 按钮 */}
            <div className="flex items-center justify-between pt-1">
              <span className="text-xs text-gray-400">
                {companionName} 会{previewText}提醒你「{content || "..."}」{limitText}
              </span>
              <div className="flex items-center gap-2">
                <button onClick={resetForm} className="px-3 py-1.5 text-xs text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors">取消</button>
                <button onClick={handleAdd} disabled={addMut.isPending || !content.trim()}
                  className="px-3 py-1.5 text-xs bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-40 transition-colors">
                  {addMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "添加"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          reminders.length < 20 && (
            <button onClick={() => setShowForm(true)}
              className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 text-gray-400 hover:text-orange-500 hover:border-orange-300 transition-colors text-sm">
              <Plus className="w-4 h-4" /> 添加自定义提醒
            </button>
          )
        )}
      </div>
    </section>
  );
}
