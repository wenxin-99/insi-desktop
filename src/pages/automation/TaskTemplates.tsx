/**
 * Phase 3.1: 结构化任务创建页面
 *
 * 预置任务模板 + 结构化表单 + 多账号选择 + 定时配置
 * 从 /automation 页面的模板弹窗独立出来，作为一键执行入口。
 */
import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Play, Clock, Users, FileText, MessageSquare, Sparkles,
  ChevronDown, ChevronRight, AlertCircle, CheckCircle2, Loader2,
  Zap, ArrowLeft, Calendar, Settings2,
} from "lucide-react";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "./templates";
import { apiFetch } from "./types";
import type { SiteAccount, Template } from "./types";

// ============ 费用估算 ============

function estimateCost(template: Template, accountCount: number): { fishCoins: number; minutes: number } {
  const stepsPerAccount = template.estimatedSteps || 10;
  const isSimple = stepsPerAccount <= 8;
  const perAccount = isSimple ? 2 : 5;
  const minutesPerAccount = isSimple ? 1 : 3;
  return {
    fishCoins: perAccount * accountCount,
    minutes: minutesPerAccount * accountCount,
  };
}

// ============ Cron 预设 ============

const SCHEDULE_PRESETS = [
  { label: "不定时（立即执行）", value: "" },
  { label: "每天早上 9:00", value: "0 9 * * *" },
  { label: "每天中午 12:00", value: "0 12 * * *" },
  { label: "每天晚上 20:00", value: "0 20 * * *" },
  { label: "每 6 小时", value: "0 */6 * * *" },
  { label: "每周一早上 9:00", value: "0 9 * * 1" },
  { label: "自定义 Cron", value: "custom" },
];

const CONTENT_STYLES = [
  { label: "随意聊天", value: "casual" },
  { label: "技术分享", value: "technical" },
  { label: "生活感悟", value: "lifestyle" },
  { label: "热点评论", value: "trending" },
  { label: "幽默搞笑", value: "humor" },
  { label: "专业严肃", value: "formal" },
];

// ============ 主组件 ============

export default function TaskTemplates({ onBack }: { onBack?: () => void }) {
  const [accounts, setAccounts] = useState<SiteAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  // 表单状态
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<number>>(new Set());
  const [contentStyle, setContentStyle] = useState("casual");
  const [schedulePreset, setSchedulePreset] = useState("");
  const [customCron, setCustomCron] = useState("0 9 * * *");
  const [showAdvanced, setShowAdvanced] = useState(false);

  // 加载账号
  useEffect(() => {
    apiFetch("/accounts")
      .then((data: any) => {
        const accts = data.accounts || data || [];
        setAccounts(accts);
        if (accts.length === 1) setSelectedAccountIds(new Set([accts[0].id]));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // 过滤模板
  const filteredTemplates = useMemo(() => {
    if (selectedCategory === "all") return TEMPLATES;
    return TEMPLATES.filter(t => t.category === selectedCategory);
  }, [selectedCategory]);

  // 费用估算
  const costEstimate = useMemo(() => {
    if (!selectedTemplate) return null;
    return estimateCost(selectedTemplate, Math.max(1, selectedAccountIds.size));
  }, [selectedTemplate, selectedAccountIds.size]);

  // 切换账号选择
  const toggleAccount = useCallback((id: number) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // Cron 值
  const effectiveCron = schedulePreset === "custom" ? customCron : schedulePreset;

  // 提交执行
  const handleSubmit = async () => {
    if (!selectedTemplate || selectedAccountIds.size === 0) return;
    setSubmitting(true);
    setResult(null);

    try {
      const selectedAccounts = accounts.filter(a => selectedAccountIds.has(a.id));

      // 构建每个账号的任务
      const tasks = selectedAccounts.map(account => ({
        siteAccountId: account.id,
        taskType: selectedTemplate.taskType,
        name: `${selectedTemplate.title} - ${account.username}`,
        instruction: selectedTemplate.buildInstruction(account),
        contentStyle,
      }));

      if (effectiveCron) {
        // 定时任务：创建 scheduledTask
        const res = await apiFetch("/schedule-template", {
          method: "POST",
          body: JSON.stringify({
            templateId: selectedTemplate.id,
            accountIds: Array.from(selectedAccountIds),
            contentStyle,
            cronExpression: effectiveCron,
            name: `[定时] ${selectedTemplate.title}`,
          }),
        });
        setResult({ ok: true, message: `定时任务已创建！将按 "${SCHEDULE_PRESETS.find(p => p.value === schedulePreset)?.label || effectiveCron}" 自动执行` });
      } else {
        // 立即执行：批量创建任务
        const res = await apiFetch("/batch-run", {
          method: "POST",
          body: JSON.stringify({ tasks }),
        });
        const taskCount = res.tasks?.length || tasks.length;
        setResult({ ok: true, message: `已创建 ${taskCount} 个任务并开始执行！请前往自动化面板查看进度。` });
      }
    } catch (err: any) {
      setResult({ ok: false, message: err.message || "创建失败" });
    } finally {
      setSubmitting(false);
    }
  };

  // ============ 渲染 ============

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 标题栏 */}
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button onClick={onBack} className="p-2 rounded-xl hover:bg-gray-100 transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1 className="text-xl font-bold">快速执行</h1>
          <p className="text-sm text-gray-500">选择模板 → 选择账号 → 一键执行</p>
        </div>
      </div>

      {/* Step 1: 选择模板 */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">1</span>
          选择任务模板
        </h2>

        {/* 分类标签 */}
        <div className="flex gap-2 mb-3 overflow-x-auto pb-1">
          {TEMPLATE_CATEGORIES.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs whitespace-nowrap transition-colors ${
                selectedCategory === cat.id
                  ? "bg-blue-100 text-blue-700 font-medium"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* 模板网格 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {filteredTemplates.map(t => (
            <button
              key={t.id}
              onClick={() => setSelectedTemplate(t)}
              className={`text-left p-3 rounded-xl border-2 transition-all ${
                selectedTemplate?.id === t.id
                  ? "border-blue-400 bg-blue-50 shadow-sm"
                  : "border-gray-200 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <div className={`p-1.5 rounded-lg ${t.color.split(' ').slice(0, 1).join(' ')}`}>
                  {t.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm">{t.title}</div>
                  <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{t.desc}</div>
                  <div className="flex gap-1 mt-1.5">
                    {t.tags.map(tag => (
                      <span key={tag} className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                        {tag}
                      </span>
                    ))}
                    <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">
                      ~{t.estimatedSteps}步
                    </span>
                  </div>
                </div>
                {selectedTemplate?.id === t.id && (
                  <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Step 2: 选择账号 */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
          <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">2</span>
          选择账号
          {selectedAccountIds.size > 0 && (
            <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full">
              已选 {selectedAccountIds.size}
            </span>
          )}
        </h2>

        {loading ? (
          <div className="flex items-center gap-2 text-gray-400 text-sm py-4">
            <Loader2 className="w-4 h-4 animate-spin" /> 加载账号...
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-sm text-gray-500 py-4 bg-gray-50 rounded-xl text-center">
            暂无账号，请先在自动化页面添加站点账号
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {accounts.map(a => (
              <button
                key={a.id}
                onClick={() => toggleAccount(a.id)}
                className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                  selectedAccountIds.has(a.id)
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  selectedAccountIds.has(a.id) ? "bg-blue-500 text-white" : "bg-gray-200 text-gray-600"
                }`}>
                  {a.username.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{a.username}</div>
                  <div className="text-xs text-gray-500 truncate">{a.siteName || a.siteUrl}</div>
                </div>
                {a.lastLoginSuccess === false && (
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Step 3: 高级选项 */}
      <div className="mb-6">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2 hover:text-gray-900"
        >
          <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-xs font-bold">3</span>
          高级选项
          {showAdvanced ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
        </button>

        {showAdvanced && (
          <div className="space-y-4 p-4 bg-gray-50 rounded-xl">
            {/* 内容风格 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 block">内容风格</label>
              <div className="flex flex-wrap gap-2">
                {CONTENT_STYLES.map(s => (
                  <button
                    key={s.value}
                    onClick={() => setContentStyle(s.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      contentStyle === s.value
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 定时执行 */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-1.5 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> 定时执行
              </label>
              <div className="flex flex-wrap gap-2">
                {SCHEDULE_PRESETS.map(p => (
                  <button
                    key={p.value || "now"}
                    onClick={() => setSchedulePreset(p.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs transition-colors ${
                      schedulePreset === p.value
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              {schedulePreset === "custom" && (
                <input
                  type="text"
                  value={customCron}
                  onChange={e => setCustomCron(e.target.value)}
                  placeholder="Cron 表达式，如 0 9 * * *"
                  className="mt-2 w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-200"
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 费用估算 + 执行按钮 */}
      <div className="sticky bottom-0 bg-white border-t pt-4 pb-6 -mx-4 px-4">
        {/* 费用预估 */}
        {costEstimate && selectedTemplate && selectedAccountIds.size > 0 && (
          <div className="flex items-center justify-between text-sm mb-3 px-1">
            <div className="text-gray-500">
              预估：~{costEstimate.minutes} 分钟 / {selectedAccountIds.size} 账号
            </div>
            <div className="font-medium text-blue-600">
              ~{costEstimate.fishCoins} 🐟
            </div>
          </div>
        )}

        {/* 结果提示 */}
        {result && (
          <div className={`flex items-start gap-2 p-3 rounded-xl mb-3 text-sm ${
            result.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"
          }`}>
            {result.ok ? <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" /> : <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />}
            {result.message}
          </div>
        )}

        {/* 执行按钮 */}
        <button
          onClick={handleSubmit}
          disabled={!selectedTemplate || selectedAccountIds.size === 0 || submitting}
          className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all ${
            !selectedTemplate || selectedAccountIds.size === 0 || submitting
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : effectiveCron
                ? "bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-200"
                : "bg-blue-500 hover:bg-blue-600 text-white shadow-lg shadow-blue-200"
          }`}
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> 创建中...</>
          ) : effectiveCron ? (
            <><Clock className="w-4 h-4" /> 创建定时任务</>
          ) : (
            <><Play className="w-4 h-4" /> 立即执行</>
          )}
        </button>
      </div>
    </div>
  );
}
