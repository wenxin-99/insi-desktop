/**
 * pages/playbook/PlaybookEditor.tsx — Playbook 编辑器
 *
 * ★ 新增: 预览/试运行面板、提交审核按钮、费用实时预估
 */
import { useState, useEffect } from "react";
import {
  Save, Plus, Trash2, ArrowUp, ArrowDown,
  Wrench, Settings, Tag, Zap, Loader2, ChevronDown,
  Eye, Play, Send, Coins, AlertCircle, CheckCircle,
  XCircle, FileText, Bot, Clock,
} from "lucide-react";
import { trpc } from "@/lib/trpc";

interface Props {
  playbookId?: string; // 编辑模式
  onSaved: (id: string) => void;
}

const TOOL_OPTIONS = [
  { group: "浏览器", tools: ["browser.navigate", "browser.click", "browser.click_text", "browser.type", "browser.scroll", "browser.submit", "browser.generate_content", "browser.screenshot"] },
  { group: "Shell", tools: ["shell.exec", "shell.exec_remote"] },
  { group: "文件", tools: ["file.read", "file.write", "file.list", "file.patch"] },
  { group: "搜索", tools: ["web.search", "web.fetch", "web.browse"] },
  { group: "代码", tools: ["code.generate", "code.lint", "code.test"] },
  { group: "系统", tools: ["system.done", "system.think", "system.ask_user"] },
];

const PARAM_TYPES = ["string", "number", "url", "select", "textarea", "boolean", "cron"];

interface StepDraft {
  name: string; toolId: string; paramTemplate: Record<string, string>;
  condition: string; onError: "retry" | "skip" | "abort";
}

interface ParamDraft {
  key: string; label: string; type: string; required: boolean;
  default: string; placeholder: string; options: string; validation: string; description: string;
}

/** 编辑器内驳回原因显示 */
function EditorRejectNote({ note }: { note: string }) {
  let aiData: any = null;
  try { const p = JSON.parse(note); if (p && p.ai) aiData = p; } catch {}
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4 mb-4">
      <div className="flex items-start gap-2">
        <XCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-medium text-red-700">
            审核未通过{aiData ? ` (AI 评分 ${String(aiData.score)}/100)` : ""}
          </p>
          <p className="text-sm text-red-600 mt-1">{aiData ? String(aiData.summary || "") : note}</p>
          {aiData && Array.isArray(aiData.issues) && aiData.issues.length > 0 && (
            <div className="mt-2 space-y-0.5">
              {aiData.issues.slice(0, 5).map((issue: any, i: number) => (
                <p key={i} className={`text-xs ${issue.severity === "error" ? "text-red-600" : "text-amber-600"}`}>
                  {issue.severity === "error" ? "❌" : "⚠️"} {String(issue.message || "")}
                </p>
              ))}
            </div>
          )}
          <p className="text-xs text-red-500 mt-2">修改后可重新提交审核</p>
        </div>
      </div>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  draft: { label: "草稿", color: "text-gray-500 bg-gray-100", icon: FileText },
  pending_review: { label: "审核中", color: "text-amber-600 bg-amber-50", icon: Clock },
  published: { label: "已发布", color: "text-green-600 bg-green-50", icon: CheckCircle },
  rejected: { label: "已驳回", color: "text-red-600 bg-red-50", icon: XCircle },
  archived: { label: "已归档", color: "text-gray-400 bg-gray-50", icon: FileText },
};

export function PlaybookEditor({ playbookId, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [icon, setIcon] = useState("🤖");
  const [tags, setTags] = useState("");
  const [isPublic, setIsPublic] = useState(false);
  const [price, setPrice] = useState(0);
  const [steps, setSteps] = useState<StepDraft[]>([
    { name: "", toolId: "web.search", paramTemplate: {}, condition: "", onError: "retry" },
  ]);
  const [params, setParams] = useState<ParamDraft[]>([]);
  const [paramTemplateJson, setParamTemplateJson] = useState<Record<number, string>>({});
  const [showPreview, setShowPreview] = useState(false);
  const [previewParams, setPreviewParams] = useState<Record<string, any>>({});

  // 编辑模式加载
  const detailQuery = trpc.playbook.detail.useQuery({ id: playbookId! }, { enabled: !!playbookId });
  const currentStatus = detailQuery.data?.status || "draft";
  const reviewNote = (detailQuery.data as any)?.reviewNote;

  useEffect(() => {
    if (detailQuery.data) {
      const pb = detailQuery.data;
      setTitle(pb.title);
      setDescription(pb.description || "");
      setCategory(pb.category);
      setIcon(pb.icon);
      setTags((pb.tags || []).join(", "));
      setIsPublic(pb.isPublic);
      setPrice(parseFloat(pb.price as any) || 0);
      setSteps((pb.steps || []).map((s: any) => ({
        name: s.name, toolId: s.toolId,
        paramTemplate: s.paramTemplate || {},
        condition: s.condition || "", onError: s.onError || "retry",
      })));
      setParams((pb.parameters || []).map((p: any) => ({
        key: p.key, label: p.label, type: p.type,
        required: p.required, default: p.default || "",
        placeholder: p.placeholder || "", options: (p.options || []).join(", "),
        validation: p.validation || "", description: p.description || "",
      })));
      const ptj: Record<number, string> = {};
      (pb.steps || []).forEach((s: any, i: number) => { ptj[i] = JSON.stringify(s.paramTemplate || {}, null, 2); });
      setParamTemplateJson(ptj);
    }
  }, [detailQuery.data]);

  const createMut = trpc.playbook.create.useMutation({ onSuccess: (r) => onSaved(r.id) });
  const updateMut = trpc.playbook.update.useMutation({ onSuccess: () => onSaved(playbookId!) });
  const [aiReviewResult, setAiReviewResult] = useState<any>(null);
  const submitReviewMut = trpc.playbook.submitForReview.useMutation({
    onSuccess: (data) => {
      detailQuery.refetch();
      if (data.aiReview) setAiReviewResult(data);
    },
  });

  // ★ 编辑器内联预估（纯手动触发）
  const estimateMut = trpc.playbook.estimateInline.useMutation();
  const estimateData = estimateMut.data;

  const doEstimate = () => {
    const validSteps = steps.map((s, i) => {
      let pt: Record<string, any> = s.paramTemplate || {};
      try { pt = JSON.parse(paramTemplateJson[i] || "{}"); } catch {}
      return { name: s.name || "", toolId: s.toolId || "", paramTemplate: pt, condition: s.condition || null, onError: s.onError || "retry" };
    }).filter(s => s.toolId);
    if (validSteps.length > 0) {
      estimateMut.mutate({ steps: validSteps, price });
    }
  };

  // ★ 预览 Prompt（纯手动触发）
  const previewMut = trpc.playbook.preview.useMutation();
  const previewData = previewMut.data;

  const doPreview = () => {
    const finalSteps = steps.map((s, i) => {
      let pt: Record<string, any> = s.paramTemplate || {};
      try { pt = JSON.parse(paramTemplateJson[i] || "{}"); } catch {}
      return { name: s.name || "", toolId: s.toolId || "", paramTemplate: pt, condition: s.condition || null, onError: s.onError || "retry" };
    });
    previewMut.mutate({
      playbookId: playbookId || null,
      steps: playbookId ? undefined : finalSteps,
      parameters: playbookId ? undefined : params.map(p => ({
        key: p.key, label: p.label, type: p.type as any, required: p.required,
        default: p.default || null, placeholder: p.placeholder || null,
        options: p.type === "select" ? p.options.split(",").map(o => o.trim()).filter(Boolean) : null,
        validation: p.validation || null, description: p.description || null,
      })),
      title: playbookId ? undefined : title,
      description: playbookId ? undefined : description,
      params: previewParams,
    });
  };

  const handleSave = () => {
    const finalSteps = steps.map((s, i) => {
      let pt = s.paramTemplate;
      try { pt = JSON.parse(paramTemplateJson[i] || "{}"); } catch {}
      return { name: s.name, toolId: s.toolId, paramTemplate: pt, condition: s.condition || null, onError: s.onError };
    });
    const finalParams = params.map(p => ({
      key: p.key, label: p.label, type: p.type, required: p.required,
      default: p.default || null, placeholder: p.placeholder || null,
      options: p.type === "select" ? p.options.split(",").map(o => o.trim()).filter(Boolean) : null,
      validation: p.validation || null, description: p.description || null,
    }));
    const tagArr = tags.split(",").map(t => t.trim()).filter(Boolean);

    const data = {
      title, description, category, icon, steps: finalSteps, parameters: finalParams,
      tags: tagArr, isPublic, price,
    };

    if (playbookId) {
      updateMut.mutate({ id: playbookId, ...data });
    } else {
      createMut.mutate(data);
    }
  };

  const isSaving = createMut.isPending || updateMut.isPending;

  // ── Step helpers ──
  const addStep = () => setSteps(prev => [...prev, { name: "", toolId: "system.think", paramTemplate: {}, condition: "", onError: "retry" }]);
  const removeStep = (i: number) => {
    setSteps(prev => prev.filter((_, idx) => idx !== i));
    setParamTemplateJson(prev => {
      const next: Record<number, string> = {};
      Object.entries(prev).forEach(([k, v]) => {
        const ki = parseInt(k);
        if (ki < i) next[ki] = v;
        else if (ki > i) next[ki - 1] = v;
      });
      return next;
    });
  };
  const moveStep = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    setSteps(prev => {
      const arr = [...prev];
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
    setParamTemplateJson(prev => {
      if (j < 0 || j >= steps.length) return prev;
      const next = { ...prev };
      const tmp = next[i];
      next[i] = next[j];
      next[j] = tmp;
      return next;
    });
  };
  const updateStep = (i: number, field: string, value: any) => {
    setSteps(prev => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  // ── Param helpers ──
  const addParam = () => setParams(prev => [...prev, { key: "", label: "", type: "string", required: true, default: "", placeholder: "", options: "", validation: "", description: "" }]);
  const removeParam = (i: number) => setParams(prev => prev.filter((_, idx) => idx !== i));
  const updateParam = (i: number, field: string, value: any) => {
    setParams(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));
  };

  const statusInfo = STATUS_MAP[currentStatus] || STATUS_MAP.draft;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">{playbookId ? "编辑 Playbook" : "创建 Playbook"}</h1>
        {/* 当前状态 */}
        {playbookId && (
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.color}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusInfo.label}
          </div>
        )}
      </div>

      {/* ★ 驳回原因提示 */}
      {currentStatus === "rejected" && reviewNote ? (
        <EditorRejectNote note={String(reviewNote)} />
      ) : null}

      {/* 基本信息 */}
      <section className="rounded-2xl border bg-card p-5 mb-4">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Tag className="w-4 h-4 text-blue-500" /> 基本信息</h2>
        <div className="grid grid-cols-[60px_1fr] gap-3 items-start">
          <div>
            <label className="text-xs text-muted-foreground">图标</label>
            <input value={icon} onChange={e => setIcon(e.target.value)} className="w-full p-2 rounded-lg border bg-background text-2xl text-center" maxLength={4} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">标题 *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Playbook 标题" className="w-full p-2 rounded-lg border bg-background text-sm" />
          </div>
        </div>
        <div className="mt-3">
          <label className="text-xs text-muted-foreground">描述</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="简要描述此 Playbook 的功能" className="w-full p-2 rounded-lg border bg-background text-sm h-16 resize-none" />
        </div>
        <div className="grid grid-cols-3 gap-3 mt-3">
          <div>
            <label className="text-xs text-muted-foreground">分类</label>
            <select value={category} onChange={e => setCategory(e.target.value)} className="w-full p-2 rounded-lg border bg-background text-sm">
              {["forum", "code", "research", "monitor", "content", "data", "devops", "general"].map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-muted-foreground">标签</label>
            <input value={tags} onChange={e => setTags(e.target.value)} placeholder="逗号分隔" className="w-full p-2 rounded-lg border bg-background text-sm" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">价格 (🐟)</label>
            <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} min={0} className="w-full p-2 rounded-lg border bg-background text-sm" />
          </div>
        </div>
      </section>

      {/* 步骤编辑 */}
      <section className="rounded-2xl border bg-card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> 执行步骤</h2>
          <button onClick={addStep} className="text-xs text-primary flex items-center gap-1 hover:underline"><Plus className="w-3.5 h-3.5" /> 添加步骤</button>
        </div>
        <div className="space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="p-3 rounded-xl border bg-muted/20">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-bold text-muted-foreground w-5">#{i + 1}</span>
                <input value={step.name} onChange={e => updateStep(i, "name", e.target.value)} placeholder="步骤名称" className="flex-1 p-1.5 rounded-lg border bg-background text-sm" />
                <select value={step.toolId} onChange={e => updateStep(i, "toolId", e.target.value)} className="p-1.5 rounded-lg border bg-background text-xs font-mono">
                  {TOOL_OPTIONS.map(g => (
                    <optgroup key={g.group} label={g.group}>
                      {g.tools.map(t => <option key={t} value={t}>{t}</option>)}
                    </optgroup>
                  ))}
                </select>
                <select value={step.onError} onChange={e => updateStep(i, "onError", e.target.value)} className="p-1.5 rounded-lg border bg-background text-xs w-20">
                  <option value="retry">retry</option>
                  <option value="skip">skip</option>
                  <option value="abort">abort</option>
                </select>
                <div className="flex items-center gap-0.5">
                  <button onClick={() => moveStep(i, -1)} className="p-1 hover:bg-muted rounded" title="上移"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveStep(i, 1)} className="p-1 hover:bg-muted rounded" title="下移"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => removeStep(i)} className="p-1 hover:bg-red-100 rounded text-red-500" title="删除"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="pl-7">
                <label className="text-[10px] text-muted-foreground">参数模板 (JSON，支持 {"{{key}}"} 插值)</label>
                <textarea
                  value={paramTemplateJson[i] || JSON.stringify(step.paramTemplate, null, 2)}
                  onChange={e => setParamTemplateJson(prev => ({ ...prev, [i]: e.target.value }))}
                  className="w-full p-2 rounded-lg border bg-background text-xs font-mono h-12 resize-none"
                  placeholder='{"url": "{{forumUrl}}"}'
                />
                <input value={step.condition} onChange={e => updateStep(i, "condition", e.target.value)} placeholder="条件表达式（可选）" className="w-full p-1.5 rounded-lg border bg-background text-xs mt-1" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 参数编辑 */}
      <section className="rounded-2xl border bg-card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm flex items-center gap-2"><Settings className="w-4 h-4 text-blue-500" /> 用户参数</h2>
          <button onClick={addParam} className="text-xs text-primary flex items-center gap-1 hover:underline"><Plus className="w-3.5 h-3.5" /> 添加参数</button>
        </div>
        <div className="space-y-3">
          {params.map((p, i) => (
            <div key={i} className="p-3 rounded-xl border bg-muted/20">
              <div className="grid grid-cols-[1fr_1fr_80px_auto] gap-2 items-center">
                <input value={p.key} onChange={e => updateParam(i, "key", e.target.value)} placeholder="key" className="p-1.5 rounded-lg border bg-background text-xs font-mono" />
                <input value={p.label} onChange={e => updateParam(i, "label", e.target.value)} placeholder="标签" className="p-1.5 rounded-lg border bg-background text-sm" />
                <select value={p.type} onChange={e => updateParam(i, "type", e.target.value)} className="p-1.5 rounded-lg border bg-background text-xs">
                  {PARAM_TYPES.map(t => <option key={t}>{t}</option>)}
                </select>
                <div className="flex items-center gap-1">
                  <label className="text-[10px] flex items-center gap-0.5">
                    <input type="checkbox" checked={p.required} onChange={e => updateParam(i, "required", e.target.checked)} className="rounded w-3 h-3" /> 必填
                  </label>
                  <button onClick={() => removeParam(i)} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1.5">
                <input value={p.default} onChange={e => updateParam(i, "default", e.target.value)} placeholder="默认值" className="p-1.5 rounded-lg border bg-background text-xs" />
                <input value={p.placeholder} onChange={e => updateParam(i, "placeholder", e.target.value)} placeholder="输入提示" className="p-1.5 rounded-lg border bg-background text-xs" />
              </div>
              {p.type === "select" && (
                <input value={p.options} onChange={e => updateParam(i, "options", e.target.value)} placeholder="选项（逗号分隔）" className="w-full p-1.5 rounded-lg border bg-background text-xs mt-1.5" />
              )}
            </div>
          ))}
          {params.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">无参数（用户无需填写任何配置即可运行）</p>}
        </div>
      </section>

      {/* ★ 费用预估面板 */}
      <section className="rounded-2xl border bg-card p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-sm flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /> 费用预估</h2>
          <button onClick={doEstimate} className="text-xs text-primary hover:underline">
            {estimateMut.isPending ? "计算中..." : "刷新预估"}
          </button>
        </div>
        {estimateData ? (
          <>
            <div className="grid grid-cols-3 gap-3 text-center mb-3">
              <div className="p-2 rounded-lg bg-muted/40">
                <p className="text-lg font-bold text-amber-600">{String(estimateData.playbookPrice)} 🐟</p>
                <p className="text-[10px] text-muted-foreground">Playbook 价格</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/40">
                <p className="text-lg font-bold text-blue-600">~{String(estimateData.estimatedAgentCost)} 🐟</p>
                <p className="text-[10px] text-muted-foreground">Agent 预估消耗</p>
              </div>
              <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                <p className="text-lg font-bold text-primary">~{String(estimateData.totalEstimate)} 🐟</p>
                <p className="text-[10px] text-muted-foreground">预估总费用</p>
              </div>
            </div>
            {Array.isArray(estimateData.breakdown) && estimateData.breakdown.length > 0 && (
              <div className="space-y-1">
                {estimateData.breakdown.map((b: any) => (
                  <div key={String(b.category)} className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="font-mono">{String(b.category)}</span>
                    <span>{String(b.count)} 步 × {String(b.unitCost)} = {String(b.subtotal)} 🐟</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            {estimateMut.isPending ? "计算中..." : "添加步骤后点击「刷新预估」"}
          </p>
        )}
      </section>

      {/* ★ 预览/试运行 面板 */}
      {showPreview && (
        <section className="rounded-2xl border border-primary/30 bg-card p-5 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-bold text-sm flex items-center gap-2"><Eye className="w-4 h-4 text-primary" /> 预览 / 试运行</h2>
            <div className="flex items-center gap-3">
              <button onClick={doPreview} className="text-xs text-primary hover:underline">{previewMut.isPending ? "加载中..." : "刷新"}</button>
              <button onClick={() => setShowPreview(false)} className="text-xs text-muted-foreground hover:text-foreground">关闭</button>
            </div>
          </div>

          {/* 参数填写 */}
          {params.length > 0 && (
            <div className="mb-4 space-y-2">
              <p className="text-xs text-muted-foreground">填写参数查看生成的 Prompt：</p>
              {params.map(p => (
                <div key={p.key} className="flex items-center gap-2">
                  <label className="text-xs w-24 text-right flex-shrink-0">{p.label}:</label>
                  <input
                    value={previewParams[p.key] || ""}
                    onChange={e => setPreviewParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                    placeholder={p.placeholder || p.default || `{{${p.key}}}`}
                    className="flex-1 p-1.5 rounded-lg border bg-background text-xs"
                  />
                </div>
              ))}
            </div>
          )}

          {previewMut.isPending ? (
            <div className="text-center py-4"><Loader2 className="w-5 h-5 animate-spin mx-auto opacity-30" /></div>
          ) : previewData ? (
            <div className="space-y-3">
              {/* 验证状态 */}
              {!previewData.validation.valid && (
                <div className="rounded-lg bg-amber-50 border border-amber-200 p-2">
                  <p className="text-xs text-amber-700 font-medium flex items-center gap-1"><AlertCircle className="w-3 h-3" /> 参数验证问题：</p>
                  {previewData.validation.errors.map((e: string, i: number) => (
                    <p key={i} className="text-xs text-amber-600 ml-4">• {e}</p>
                  ))}
                </div>
              )}

              {/* 元信息 */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Bot className="w-3 h-3" /> Agent 类型: <strong className="text-foreground">{previewData.agentType}</strong></span>
                <span>{previewData.stepsCount} 步骤</span>
                <span>{previewData.toolIds.length} 工具</span>
                <span className="text-amber-600 font-medium">~{previewData.costEstimate.totalEstimate} 🐟</span>
              </div>

              {/* 工具列表 */}
              <div className="flex flex-wrap gap-1">
                {previewData.toolIds.map((t: string) => (
                  <span key={t} className="text-[10px] font-mono bg-muted px-2 py-0.5 rounded">{t}</span>
                ))}
              </div>

              {/* 生成的 Prompt */}
              <div className="rounded-lg bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-2">生成的 Agent Prompt：</p>
                <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed max-h-[300px] overflow-y-auto">
                  {previewData.prompt}
                </pre>
              </div>
            </div>
          ) : null}
        </section>
      )}

      {/* 操作按钮 */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {/* 预览按钮 */}
          <button
            onClick={() => {
              const next = !showPreview;
              setShowPreview(next);
              if (next) doPreview();
            }}
            className={`px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all ${
              showPreview ? "bg-primary/10 text-primary border border-primary/30" : "border hover:bg-muted"
            }`}
          >
            <Eye className="w-4 h-4" /> {showPreview ? "隐藏预览" : "预览"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          {/* 提交审核按钮（仅 draft/rejected 状态） */}
          {playbookId && ["draft", "rejected"].includes(currentStatus) && (
            <button
              onClick={() => submitReviewMut.mutate({ id: playbookId })}
              disabled={submitReviewMut.isPending}
              className="px-4 py-2.5 bg-amber-500 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
            >
              {submitReviewMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              提交审核
            </button>
          )}

          {/* 保存按钮 */}
          <button
            onClick={handleSave}
            disabled={!title.trim() || steps.length === 0 || isSaving}
            className="px-6 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 disabled:opacity-50 flex items-center gap-2 shadow-lg shadow-primary/20"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {playbookId ? "保存修改" : "创建 Playbook"}
          </button>
        </div>
      </div>

      {(createMut.error || updateMut.error || submitReviewMut.error) && (
        <p className="text-sm text-red-500 text-right mt-2">
          {createMut.error?.message || updateMut.error?.message || submitReviewMut.error?.message}
        </p>
      )}

      {/* ★ AI 审核结果卡片 */}
      {submitReviewMut.isSuccess && (
        <div className="mt-4">
          {aiReviewResult?.aiReview ? (
            <div className={`rounded-xl border p-4 ${
              aiReviewResult.status === "published" ? "border-green-200 bg-green-50" :
              aiReviewResult.status === "rejected" ? "border-red-200 bg-red-50" :
              "border-amber-200 bg-amber-50"
            }`}>
              <div className="flex items-start gap-3">
                {aiReviewResult.status === "published" ? (
                  <CheckCircle className="w-5 h-5 text-green-500 mt-0.5 flex-shrink-0" />
                ) : aiReviewResult.status === "rejected" ? (
                  <XCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                ) : (
                  <Clock className="w-5 h-5 text-amber-500 mt-0.5 flex-shrink-0" />
                )}
                <div className="flex-1">
                  <p className="text-sm font-medium">
                    {aiReviewResult.status === "published" ? "AI 审核通过，已自动发布" :
                     aiReviewResult.status === "rejected" ? "AI 审核未通过" :
                     "AI 初审完成，已转人工审核"}
                  </p>
                  <p className="text-xs mt-1 opacity-80">{aiReviewResult.aiReview.summary}</p>

                  {/* 评分条 */}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs">综合: <strong>{aiReviewResult.aiReview.score}</strong>/100</span>
                  </div>

                  {/* 问题列表 */}
                  {aiReviewResult.aiReview.issues?.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {aiReviewResult.aiReview.issues.slice(0, 5).map((issue: any, i: number) => (
                        <p key={i} className={`text-xs flex items-start gap-1 ${
                          issue.severity === "error" ? "text-red-600" :
                          issue.severity === "warning" ? "text-amber-600" : "text-gray-500"
                        }`}>
                          <span className="flex-shrink-0">{issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️"}</span>
                          <span>{issue.message}</span>
                        </p>
                      ))}
                    </div>
                  )}

                  {aiReviewResult.status === "rejected" && (
                    <p className="text-xs text-red-600 mt-2 font-medium">请根据以上问题修改后重新提交</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-green-600 text-right flex items-center justify-end gap-1">
              <CheckCircle className="w-4 h-4" /> 已提交审核，请等待管理员审批
            </p>
          )}
        </div>
      )}
    </div>
  );
}
