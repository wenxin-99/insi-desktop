/**
 * Insi 人格配置面板 - PersonaSettings
 *
 * 三层结构：
 * ┌─────────────────────────────────────────┐
 * │  人格层（SOUL）                          │
 * │  人格提示词，定义 Insi 整体性格            │
 * ├─────────────────────────────────────────┤
 * │  记忆层（MEMORY）                        │
 * │  已有 user_memories，跳转记忆管理页面    │
 * ├─────────────────────────────────────────┤
 * │  行为规范层（RULES）                     │
 * │  可拖拽排序的规则列表                    │
 * └─────────────────────────────────────────┘
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";
import {
  ArrowLeft, Save, Sparkles, Brain, Shield, ChevronRight, Heart,
  Plus, Trash2, GripVertical, RotateCcw, Loader2, Check,
  Info, X, Wand2, Zap, BookOpen, Palette,
} from "lucide-react";
import { ResponsePreferences } from "@/components/ResponsePreferences";

// ── 预设模板元信息（仅前端展示用，真正的模板数据在后端）──
const TEMPLATES = [
  {
    id: "professional",
    label: "专业助理",
    icon: <Zap className="w-4 h-4" />,
    color: "bg-blue-50 text-blue-600 border-blue-200",
    desc: "简洁专业，直击要点",
  },
  {
    id: "techAdvisor",
    label: "技术顾问",
    icon: <Wand2 className="w-4 h-4" />,
    color: "bg-emerald-50 text-emerald-600 border-emerald-200",
    desc: "架构设计、代码审查",
  },
  {
    id: "creativePartner",
    label: "创意伙伴",
    icon: <Palette className="w-4 h-4" />,
    color: "bg-orange-50 text-orange-600 border-orange-200",
    desc: "发散思维、灵感启发",
  },
  {
    id: "studyBuddy",
    label: "学习搭档",
    icon: <BookOpen className="w-4 h-4" />,
    color: "bg-purple-50 text-purple-600 border-purple-200",
    desc: "耐心讲解、巩固知识",
  },
];

export default function PersonaSettings() {
  const [, setLocation] = useLocation();

  // ── 数据加载 ──
  const { data: personaConfig, isLoading, refetch } = trpc.persona.get.useQuery();
  const { data: memoryList } = trpc.memory.list.useQuery();
   const { data: companionConfig } = trpc.companion.getConfig.useQuery(undefined, {
    staleTime: 60_000, refetchOnWindowFocus: false,
  });

  const updateAllMutation = trpc.persona.updateAll.useMutation({
    onSuccess: () => {
      refetch();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
  });
  const applyTemplateMutation = trpc.persona.applyTemplate.useMutation({
    onSuccess: (data: any) => {
      setSoulPrompt(data.soulPrompt || "");
      setBehaviorRules(data.behaviorRules || []);
      refetch();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
  });
  const resetMutation = trpc.persona.reset.useMutation({
    onSuccess: () => {
      setSoulPrompt("");
      setBehaviorRules([]);
      refetch();
      setSaveStatus("saved");
      setTimeout(() => setSaveStatus("idle"), 2000);
    },
  });

  // ── 本地状态 ──
  const [soulPrompt, setSoulPrompt] = useState("");
  const [behaviorRules, setBehaviorRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState("");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [confirmReset, setConfirmReset] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");

  // 从服务端同步到本地
  useEffect(() => {
    if (personaConfig) {
      setSoulPrompt(personaConfig.soulPrompt || "");
      setBehaviorRules(personaConfig.behaviorRules || []);
    }
  }, [personaConfig]);

  // ── 判断是否有未保存的变更 ──
  const hasChanges = useCallback(() => {
    if (!personaConfig) return false;
    const origSoul = personaConfig.soulPrompt || "";
    const origRules = personaConfig.behaviorRules || [];
    if (soulPrompt !== origSoul) return true;
    if (behaviorRules.length !== origRules.length) return true;
    return behaviorRules.some((r, i) => r !== origRules[i]);
  }, [personaConfig, soulPrompt, behaviorRules]);

  // ── 保存 ──
  const isBusy = updateAllMutation.isPending || applyTemplateMutation.isPending || resetMutation.isPending;

  const handleSave = () => {
    setSaveStatus("saving");
    updateAllMutation.mutate({
      soulPrompt: soulPrompt.trim() || null,
      behaviorRules: behaviorRules.filter(r => r.trim()),
    });
  };

  // ── 规则操作 ──
  const addRule = () => {
    if (!newRule.trim() || behaviorRules.length >= 20) return;
    setBehaviorRules(prev => [...prev, newRule.trim()]);
    setNewRule("");
  };

  const removeRule = (index: number) => {
    setBehaviorRules(prev => prev.filter((_, i) => i !== index));
  };

  const startEditing = (index: number) => {
    setEditingIndex(index);
    setEditingText(behaviorRules[index]);
  };

  const commitEdit = () => {
    if (editingIndex === null) return;
    const trimmed = editingText.trim();
    if (trimmed) {
      setBehaviorRules(prev => prev.map((r, i) => i === editingIndex ? trimmed : r));
    }
    setEditingIndex(null);
    setEditingText("");
  };

  // ── Ctrl+S 快捷保存 + 未保存离开保护 ──
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') {
        e.preventDefault();
        if (hasChanges() && !isBusy) handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [hasChanges, isBusy, soulPrompt, behaviorRules]);

  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (hasChanges()) { e.preventDefault(); e.returnValue = ''; }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasChanges]);

  // ── 拖拽排序（桌面 HTML5 + 移动端 Touch） ──
  const handleDragStart = (index: number) => setDragIndex(index);

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...behaviorRules];
    const [item] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, item);
    setBehaviorRules(updated);
    setDragIndex(index);
  };

  const handleDragEnd = () => setDragIndex(null);

  // ── 移动端 Touch 拖拽 ──
  const ruleListRef = useRef<HTMLDivElement>(null);
  const touchDragRef = useRef<{ startIndex: number; currentIndex: number; startY: number } | null>(null);
  const [touchDragIndex, setTouchDragIndex] = useState<number | null>(null);

  const handleTouchStart = useCallback((index: number, e: React.TouchEvent) => {
    // 只在 GripVertical 手柄上触发（通过 data-grip 属性标识）
    const touch = e.touches[0];
    touchDragRef.current = { startIndex: index, currentIndex: index, startY: touch.clientY };
    setTouchDragIndex(index);
    setDragIndex(index);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchDragRef.current || !ruleListRef.current) return;
    e.preventDefault(); // 阻止页面滚动

    const touch = e.touches[0];
    const listEl = ruleListRef.current;
    const children = Array.from(listEl.children) as HTMLElement[];

    // 找到当前触摸位置对应的规则项索引
    let targetIndex = touchDragRef.current.currentIndex;
    for (let i = 0; i < children.length; i++) {
      const rect = children[i].getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      if (touch.clientY < midY) {
        targetIndex = i;
        break;
      }
      if (i === children.length - 1) {
        targetIndex = i;
      }
    }

    if (targetIndex !== touchDragRef.current.currentIndex) {
      setBehaviorRules(prev => {
        const updated = [...prev];
        const [item] = updated.splice(touchDragRef.current!.currentIndex, 1);
        updated.splice(targetIndex, 0, item);
        return updated;
      });
      touchDragRef.current.currentIndex = targetIndex;
      setTouchDragIndex(targetIndex);
      setDragIndex(targetIndex);
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    touchDragRef.current = null;
    setTouchDragIndex(null);
    setDragIndex(null);
  }, []);

  // 合并的拖拽高亮索引（桌面 or 移动端）
  const activeDragIndex = touchDragIndex ?? dragIndex;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => window.history.back()}
            className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="w-6 h-6 text-indigo-500" /> Insi 人格配置
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">
              自定义 Insi 的性格、记忆和行为规范
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={!hasChanges() || isBusy}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              saveStatus === "saved"
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : hasChanges()
                  ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
                  : "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600 cursor-not-allowed"
            }`}
          >
            {saveStatus === "saving" ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saveStatus === "saved" ? (
              <Check className="w-4 h-4" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saveStatus === "saved" ? "已保存" : "保存"}
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载中...
          </div>
        ) : (
          <div className="space-y-6">
            {/* ── 说明卡片 ── */}
            <div className="flex items-start gap-3 p-3 bg-indigo-50 dark:bg-indigo-950/30 rounded-2xl border border-indigo-100 dark:border-indigo-900/50 text-sm text-indigo-700 dark:text-indigo-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>
                Insi 的行为由三层配置控制：<strong>人格设定</strong>定义性格风格，<strong>记忆</strong>记录关于你的事实，<strong>行为规范</strong>设定硬性约束。所有配置跨会话生效。
              </p>
            </div>

            {/* ── 快速模板 ── */}
            <section>
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3 flex items-center gap-1.5">
                <Wand2 className="w-4 h-4" /> 快速应用模板
              </h2>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map(tmpl => (
                  <button
                    key={tmpl.id}
                    onClick={() => applyTemplateMutation.mutate({ templateId: tmpl.id })}
                    disabled={isBusy}
                    className={`flex items-center gap-2.5 p-3 rounded-xl border-2 text-left transition-all hover:shadow-sm disabled:opacity-50 ${tmpl.color} dark:bg-opacity-20 dark:border-opacity-30`}
                  >
                    <div className="shrink-0">{tmpl.icon}</div>
                    <div>
                      <div className="text-sm font-medium">{tmpl.label}</div>
                      <div className="text-xs opacity-70">{tmpl.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            {/* ── 第 1 层：SOUL 人格提示词 ── */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">人格设定</h2>
                  <p className="text-xs text-gray-400">定义 AI 的整体性格和说话风格</p>
                </div>
              </div>
              <div className="p-4">
                <textarea
                  value={soulPrompt}
                  onChange={e => setSoulPrompt(e.target.value)}
                  placeholder="例如：你是我的私人助理，语气要简洁专业，喜欢用类比来解释复杂概念..."
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent min-h-[100px] resize-none transition-shadow"
                  maxLength={2000}
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-400">{soulPrompt.length}/2000</span>
                  {soulPrompt && (
                    <button
                      onClick={() => setSoulPrompt("")}
                      className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                    >
                      清除
                    </button>
                  )}
                </div>
              </div>
            </section>

            {/* ── 第 2 层：MEMORY 记忆（跳转入口） ── */}
            <section
              onClick={() => setLocation("/memory")}
              className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden cursor-pointer hover:shadow-sm transition-shadow"
            >
              <div className="px-4 py-3 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                  <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">记忆管理</h2>
                  <p className="text-xs text-gray-400">
                    Insi 跨会话记住的关于你的信息
                    {memoryList && memoryList.length > 0 && (
                      <span className="ml-1.5 inline-flex items-center justify-center px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 text-xs font-medium">
                        {memoryList.length} 条
                      </span>
                    )}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            </section>

           {/* ── 伴侣模式（跳转入口 + 状态显示） ── */}
            <section
              onClick={() => setLocation("/settings/companion")}
              className={`bg-white dark:bg-gray-900 rounded-2xl border overflow-hidden cursor-pointer hover:shadow-sm transition-shadow ${
                companionConfig?.enabled ? "border-pink-300 dark:border-pink-700" : "border-gray-200 dark:border-gray-700"
              }`}
            >
              <div className="px-4 py-3 flex items-center gap-2">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  companionConfig?.enabled ? "bg-pink-200 dark:bg-pink-800/60" : "bg-pink-100 dark:bg-pink-900/40"
                }`}>
                  <Heart className={`w-4 h-4 ${companionConfig?.enabled ? "text-pink-600 dark:text-pink-300" : "text-pink-600 dark:text-pink-400"}`} />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
                    伴侣模式
                    {companionConfig?.enabled && companionConfig?.name && (
                      <span className="text-xs font-normal text-pink-500 bg-pink-50 dark:bg-pink-900/30 px-1.5 py-0.5 rounded-full">
                        {companionConfig.name} · 已启用
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-gray-400">
                    {companionConfig?.enabled ? "伴侣性格已覆盖人格设定，行为规范和记忆仍生效" : "设置一个有性格、有记忆的 AI 伴侣"}
                  </p>
                </div>
                <ChevronRight className="w-5 h-5 text-gray-300" />
              </div>
            </section>

            {/* ── 第 3 层：RULES 行为规范 ── */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center">
                  <Shield className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-gray-800 dark:text-gray-200">行为规范</h2>
                  <p className="text-xs text-gray-400">Insi 必须遵守的硬性规则，拖拽可排序</p>
                </div>
              </div>
              <div className="p-4 space-y-2">
                {/* 规则列表 */}
                {behaviorRules.length > 0 ? (
                  <div
                    ref={ruleListRef}
                    className="space-y-1.5"
                    onTouchMove={handleTouchMove}
                    onTouchEnd={handleTouchEnd}
                  >
                    {behaviorRules.map((rule, index) => (
                      <div
                        key={index}
                        draggable
                        onDragStart={() => handleDragStart(index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragEnd={handleDragEnd}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border transition-all group ${
                          activeDragIndex === index
                            ? "border-indigo-300 bg-indigo-50 dark:border-indigo-600 dark:bg-indigo-950/30 shadow-sm scale-[1.02]"
                            : "border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 hover:border-gray-200 dark:hover:border-gray-600"
                        }`}
                        style={activeDragIndex === index ? { zIndex: 10, position: 'relative' } : undefined}
                      >
                        {/* 拖拽手柄 — 桌面用 draggable，移动端用 touchStart */}
                        <div
                          onTouchStart={(e) => handleTouchStart(index, e)}
                          className="touch-none select-none shrink-0 p-0.5"
                        >
                          <GripVertical className="w-4 h-4 text-gray-300 cursor-grab shrink-0 group-hover:text-gray-500 active:cursor-grabbing" />
                        </div>
                        <span className="text-xs font-mono text-gray-400 w-5 text-center shrink-0">
                          {index + 1}
                        </span>
                        {editingIndex === index ? (
                          <input
                            autoFocus
                            className="flex-1 text-sm text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-900 border border-indigo-300 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-indigo-400"
                            value={editingText}
                            onChange={e => setEditingText(e.target.value)}
                            onBlur={commitEdit}
                            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') { setEditingIndex(null); setEditingText(""); } }}
                          />
                        ) : (
                          <span
                            className="flex-1 text-sm text-gray-700 dark:text-gray-300 cursor-pointer hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                            onClick={() => startEditing(index)}
                            title="点击编辑"
                          >{rule}</span>
                        )}
                        <button
                          onClick={() => removeRule(index)}
                          className="p-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-300 hover:text-red-400 transition-colors shrink-0 sm:opacity-0 sm:group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <Shield className="w-8 h-8 text-gray-200 dark:text-gray-700 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">
                      暂无行为规范，添加规则来约束 Insi 的行为
                    </p>
                  </div>
                )}

                {/* 添加规则输入 */}
                <div className="flex items-center gap-2 pt-2">
                  <input
                    type="text"
                    value={newRule}
                    onChange={e => setNewRule(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        addRule();
                      }
                    }}
                    placeholder='输入规则，如"回复用中文"、"代码用 TypeScript"...'
                    className="flex-1 border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent transition-shadow"
                    maxLength={200}
                  />
                  <button
                    onClick={addRule}
                    disabled={!newRule.trim() || behaviorRules.length >= 20}
                    className="p-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {behaviorRules.length > 0 && (
                  <p className="text-xs text-gray-400 text-right">{behaviorRules.length}/20 条</p>
                )}
              </div>
            </section>

            {/* ── 重置 ── */}
            <div className="pt-2 border-t border-gray-100 dark:border-gray-800">
              {confirmReset ? (
                <div className="flex items-center justify-between p-3 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900/50">
                  <span className="text-sm text-red-600 dark:text-red-400">
                    确定重置所有人格配置？记忆不受影响。
                  </span>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setConfirmReset(false)}
                      className="px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                    >
                      取消
                    </button>
                    <button
                      onClick={() => { resetMutation.mutate(); setConfirmReset(false); }}
                      className="px-3 py-1 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                    >
                      {resetMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "确认重置"}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmReset(true)}
                  className="w-full flex items-center justify-center gap-1.5 text-sm text-gray-400 hover:text-red-500 py-2 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> 重置为默认
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ★ P2-1: 回答偏好设置 */}
      <div className="mt-8 p-5 rounded-2xl border border-border bg-card">
        <ResponsePreferences />
      </div>
    </DashboardLayout>
  );
}
