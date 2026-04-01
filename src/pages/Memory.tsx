/**
 * 用户记忆管理页面（Phase 4 升级版）
 *
 * - 分类展示（个人/偏好/工作/技术/其他），含来源、置信度、被替代历史
 * - 编辑任意记忆内容
 * - 设置面板：自动提取/自动运用/低置信度确认
 * - 导出 JSON / 清空
 */
import { useState, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import {
  Brain, Plus, Trash2, User, Heart, Briefcase, Tag, Cpu,
  AlertCircle, Loader2, RefreshCw, ArrowLeft, Info, X,
  Pencil, Check, Download, Settings, Shield, Sparkles, Eye, EyeOff,
} from "lucide-react";

const CATEGORIES = [
  { id: "personal",   label: "个人信息", icon: <User className="w-4 h-4" />,       color: "bg-blue-100 text-blue-700 border-blue-200",   dot: "bg-blue-400" },
  { id: "preference", label: "偏好设置", icon: <Heart className="w-4 h-4" />,       color: "bg-pink-100 text-pink-700 border-pink-200",   dot: "bg-pink-400" },
  { id: "work",       label: "工作职业", icon: <Briefcase className="w-4 h-4" />,   color: "bg-amber-100 text-amber-700 border-amber-200", dot: "bg-amber-400" },
  { id: "tech",       label: "技术相关", icon: <Cpu className="w-4 h-4" />,         color: "bg-emerald-100 text-emerald-700 border-emerald-200", dot: "bg-emerald-400" },
  { id: "general",    label: "其他",     icon: <Tag className="w-4 h-4" />,         color: "bg-gray-100 text-gray-700 border-gray-200",   dot: "bg-gray-400" },
] as const;

type CategoryId = typeof CATEGORIES[number]["id"];

const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map(c => [c.id, c])) as Record<string, typeof CATEGORIES[number]>;

const SOURCE_LABELS: Record<string, string> = {
  manual: "手动添加",
  auto: "对话提取",
  extractor: "自动提取",
  llm_extract: "AI 深度提取",
  frequency_inference: "行为推断",
  schedule_create: "定时任务",
  channel_command: "渠道命令",
  chat: "对话",
};

function confidenceLabel(c: number): { text: string; color: string } {
  if (c >= 0.9) return { text: "高", color: "text-green-600" };
  if (c >= 0.6) return { text: "中", color: "text-amber-600" };
  return { text: "低", color: "text-red-500" };
}

function formatDate(d: string | null): string {
  if (!d) return "";
  return new Date(d).toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
}

export default function Memory() {
  const { data: memories, isLoading, refetch } = trpc.memory.list.useQuery();
  const { data: settings } = trpc.memory.getSettings.useQuery();
  const addMutation = trpc.memory.add.useMutation({ onSuccess: () => { refetch(); setForm({ content: "", category: "general" }); setShowAdd(false); } });
  const editMutation = trpc.memory.edit.useMutation({ onSuccess: () => { refetch(); setEditingId(null); } });
  const deleteMutation = trpc.memory.delete.useMutation({ onSuccess: () => refetch() });
  const clearMutation = trpc.memory.clear.useMutation({ onSuccess: () => refetch() });
  const settingsMutation = trpc.memory.updateSettings.useMutation();

  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ content: "", category: "general" as CategoryId });
  const [confirmClear, setConfirmClear] = useState(false);
  const [filter, setFilter] = useState<CategoryId | "all">("all");
  const [showSettings, setShowSettings] = useState(false);
  const [showInactive, setShowInactive] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState("");

  const active = (memories || []).filter(m => m.isActive);
  const inactive = (memories || []).filter(m => !m.isActive);
  const displayed = (showInactive ? memories || [] : active).filter(m => filter === "all" || m.category === filter);

  const handleExport = useCallback(() => {
    if (!memories) return;
    const data = {
      exportedAt: new Date().toISOString(),
      count: active.length,
      memories: active.map(m => ({ content: m.content, category: m.category, memoryKey: m.memoryKey, confidence: m.confidence, source: m.source, createdAt: m.createdAt })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `memories_${new Date().toISOString().slice(0,10)}.json`; a.click();
    URL.revokeObjectURL(url);
  }, [memories, active]);

  const toggleSetting = (key: "autoExtract" | "autoApply" | "confirmLowConfidence") => {
    if (!settings) return;
    settingsMutation.mutate({ [key]: !settings[key] });
  };

  const startEdit = (m: any) => { setEditingId(m.id); setEditContent(m.content); };
  const submitEdit = () => { if (editingId && editContent.trim()) editMutation.mutate({ id: editingId, content: editContent }); };

  // 查找被替代的旧记忆
  const findSuperseded = (memId: number) => (memories || []).filter(m => m.supersededBy === memId);

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => window.history.back()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Brain className="w-6 h-6 text-purple-500" /> 我的记忆
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">Insi 会记住这些信息，在聊天中自然运用</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <button onClick={() => setShowSettings(s => !s)} className={`p-2 rounded-xl hover:bg-gray-100 ${showSettings ? "text-purple-500 bg-purple-50" : "text-gray-400"}`}>
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={() => refetch()} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>

        {/* 设置面板 */}
        {showSettings && (
          <div className="mb-5 p-4 bg-gray-50 rounded-2xl border space-y-3">
            <div className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Settings className="w-4 h-4" /> 记忆设置</div>
            {([
              { key: "autoExtract" as const, label: "允许从对话自动提取记忆", desc: "Insi 在聊天中自动识别和记住关键信息", icon: <Sparkles className="w-4 h-4" /> },
              { key: "autoApply" as const, label: "允许 AI 在回复中运用记忆", desc: "基于记住的信息个性化回答", icon: <Brain className="w-4 h-4" /> },
              { key: "confirmLowConfidence" as const, label: "低置信度记忆需要确认才生效", desc: "行为推断的信息（如「可能在用 Python」）需你确认", icon: <Shield className="w-4 h-4" /> },
            ]).map(item => (
              <label key={item.key} className="flex items-start gap-3 p-2.5 rounded-xl hover:bg-white cursor-pointer transition-colors">
                <div className="pt-0.5 text-purple-400">{item.icon}</div>
                <div className="flex-1">
                  <div className="text-sm text-gray-800">{item.label}</div>
                  <div className="text-xs text-gray-400">{item.desc}</div>
                </div>
                <button onClick={() => toggleSetting(item.key)}
                  className={`w-10 h-6 rounded-full transition-colors relative shrink-0 ${settings?.[item.key] ? "bg-purple-500" : "bg-gray-300"}`}>
                  <div className={`w-4 h-4 bg-white rounded-full absolute top-1 transition-all ${settings?.[item.key] ? "left-5" : "left-1"}`} />
                </button>
              </label>
            ))}
          </div>
        )}

        {/* 说明卡片 */}
        <div className="flex items-start gap-3 p-3 bg-purple-50 rounded-2xl border border-purple-100 mb-5 text-sm text-purple-700">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>在对话中自然交流，Insi 会自动记住关键信息。同一事实只保留最新版本，矛盾信息自动替换。</p>
        </div>

        {/* 统计栏 */}
        {active.length > 0 && (
          <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1">
            <button onClick={() => setFilter("all")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === "all" ? "bg-purple-100 text-purple-700 border border-purple-200" : "bg-white border border-gray-100 text-gray-500 hover:border-gray-200"}`}>
              全部 {active.length}
            </button>
            {CATEGORIES.map(cat => {
              const count = active.filter(m => m.category === cat.id).length;
              if (count === 0) return null;
              return (
                <button key={cat.id} onClick={() => setFilter(filter === cat.id ? "all" : cat.id)}
                  className={`shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${filter === cat.id ? cat.color + " border border-current" : "bg-white border border-gray-100 text-gray-500 hover:border-gray-200"}`}>
                  {cat.icon} {cat.label} {count}
                </button>
              );
            })}
          </div>
        )}

        {/* 记忆列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-16 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载中...
          </div>
        ) : displayed.length === 0 && !showAdd ? (
          <div className="text-center py-16">
            <div className="w-20 h-20 bg-purple-50 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Brain className="w-10 h-10 text-purple-300" />
            </div>
            <p className="font-semibold text-gray-700 mb-1">
              {filter === "all" ? "还没有记忆" : `暂无${CATEGORY_MAP[filter]?.label || "此类"}记忆`}
            </p>
            <p className="text-sm text-gray-400 mb-6">点击下方按钮添加，或在对话中自然交流</p>
          </div>
        ) : (
          <div className="space-y-2 mb-4">
            {displayed.map(mem => {
              const cat = CATEGORY_MAP[mem.category as string] || CATEGORY_MAP.general;
              const conf = confidenceLabel(mem.confidence);
              const isEditing = editingId === mem.id;
              const superseded = findSuperseded(mem.id);

              return (
                <div key={mem.id} className={`rounded-2xl border bg-white transition-shadow hover:shadow-sm ${!mem.isActive ? "opacity-50" : ""}`}>
                  <div className="flex items-start gap-3 p-3.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 border ${cat.color}`}>
                      {cat.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <input className="flex-1 text-sm border rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-400"
                            value={editContent} onChange={e => setEditContent(e.target.value)} autoFocus
                            onKeyDown={e => { if (e.key === "Enter") submitEdit(); if (e.key === "Escape") setEditingId(null); }} />
                          <button onClick={submitEdit} disabled={editMutation.isPending}
                            className="p-1.5 rounded-lg bg-purple-100 text-purple-600 hover:bg-purple-200">
                            {editMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          </button>
                          <button onClick={() => setEditingId(null)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <p className="text-sm text-gray-800">{mem.content}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1.5">
                        <span className={`text-xs px-1.5 py-0.5 rounded-full border ${cat.color}`}>{cat.label}</span>
                        <span className="text-xs text-gray-400">{formatDate(mem.createdAt)}</span>
                        <span className="text-xs text-gray-300">·</span>
                        <span className="text-xs text-gray-400">{SOURCE_LABELS[mem.source] || mem.source}</span>
                        {mem.confidence < 1.0 && (
                          <>
                            <span className="text-xs text-gray-300">·</span>
                            <span className={`text-xs ${conf.color}`}>置信度{conf.text}</span>
                          </>
                        )}
                        {mem.memoryKey && (
                          <>
                            <span className="text-xs text-gray-300">·</span>
                            <span className="text-xs text-gray-300 font-mono">{mem.memoryKey}</span>
                          </>
                        )}
                        {!mem.isActive && (
                          <span className="text-xs text-red-400 font-medium">已失效</span>
                        )}
                      </div>
                      {/* 被替代历史 */}
                      {superseded.length > 0 && (
                        <div className="mt-1.5 pl-2 border-l-2 border-gray-200">
                          {superseded.map(old => (
                            <div key={old.id} className="text-xs text-gray-400 line-through">
                              ↑ 替代了: {old.content}（{formatDate(old.createdAt)}）
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* 操作按钮 */}
                    {mem.isActive && !isEditing && (
                      <div className="flex gap-0.5 shrink-0">
                        <button onClick={() => startEdit(mem)}
                          className="p-1.5 rounded-xl hover:bg-blue-50 text-gray-300 hover:text-blue-400 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => deleteMutation.mutate({ id: mem.id })} disabled={deleteMutation.isPending}
                          className="p-1.5 rounded-xl hover:bg-red-50 text-gray-300 hover:text-red-400 transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* 查看失效记忆 */}
        {inactive.length > 0 && (
          <button onClick={() => setShowInactive(s => !s)}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-gray-600 mb-3">
            {showInactive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            {showInactive ? "隐藏" : "查看"} {inactive.length} 条已失效的旧记忆
          </button>
        )}

        {/* 添加表单 */}
        {showAdd ? (
          <div className="bg-white border-2 border-purple-200 rounded-2xl p-4 mb-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-medium text-sm">添加新记忆</span>
              <button onClick={() => setShowAdd(false)} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <textarea autoFocus
              className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 min-h-[80px] resize-none"
              placeholder="例如：我是一名前端工程师，主要用 React 和 TypeScript..."
              value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} maxLength={500} />
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-400">{form.content.length}/500</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map(cat => (
                <button key={cat.id} onClick={() => setForm(f => ({ ...f, category: cat.id }))}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 text-xs transition-all ${form.category === cat.id ? cat.color + " border-current font-medium" : "border-gray-100 text-gray-500 hover:border-gray-200"}`}>
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
            <button disabled={!form.content.trim() || addMutation.isPending}
              onClick={() => addMutation.mutate({ content: form.content, category: form.category })}
              className="w-full py-2.5 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
              {addMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              保存记忆
            </button>
          </div>
        ) : (
          <button onClick={() => setShowAdd(true)}
            className="w-full flex items-center justify-center gap-2 py-3 border-2 border-dashed border-purple-200 rounded-2xl text-sm text-purple-500 hover:border-purple-400 hover:bg-purple-50 transition-colors mb-4">
            <Plus className="w-4 h-4" /> 添加记忆
          </button>
        )}

        {/* 底部操作区 */}
        {active.length > 0 && (
          <div className="mt-4 pt-4 border-t space-y-3">
            {/* 导出 */}
            <button onClick={handleExport}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-colors">
              <Download className="w-4 h-4" /> 导出记忆 (JSON)
            </button>
            {/* 清空 */}
            {confirmClear ? (
              <div className="flex items-center justify-between p-3 bg-red-50 rounded-xl border border-red-200">
                <span className="text-sm text-red-600 flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" /> 确定清空全部 {active.length} 条记忆？
                </span>
                <div className="flex gap-2">
                  <button onClick={() => setConfirmClear(false)} className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">取消</button>
                  <button onClick={() => { clearMutation.mutate(); setConfirmClear(false); }}
                    className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">
                    {clearMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "确认清空"}
                  </button>
                </div>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} className="w-full text-sm text-gray-400 hover:text-red-500 py-2 transition-colors">
                清空所有记忆
              </button>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
