import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, GripVertical, Mic, Volume2, Star, Zap, Sparkles, Crown } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

const DOUBAO_VOICES = [
  { value: "__default__", label: "使用全局默认" },
  { value: "BV001_streaming", label: "标准女声 A（标准）" },
  { value: "BV002_streaming", label: "标准男声 A（标准）" },
  { value: "BV700_streaming", label: "温柔女声（标准）" },
  { value: "BV701_streaming", label: "知性女声（标准）" },
  { value: "zh_female_wanwanxiaohe_moon_bigtts", label: "暖心姐姐（大模型）" },
  { value: "zh_female_maomao_bigtts", label: "萌系少女（大模型）" },
  { value: "zh_female_shuangkuaisisi_moon_bigtts", label: "爽快思思（大模型）" },
  { value: "zh_female_tianmeixiaoyuan_moon_bigtts", label: "甜美小源（大模型）" },
  { value: "zh_male_qingsong_bigtts", label: "清爽男声（大模型）" },
  { value: "zh_male_xvyuan_moon_bigtts", label: "醇厚男声（大模型）" },
];

const STT_PROVIDERS = [
  { value: "__default__", label: "使用全局配置" },
  { value: "volcengine", label: "🔥 豆包 SeedASR" },
  { value: "dashscope", label: "阿里云 DashScope" },
  { value: "gemini", label: "Google Gemini" },
];

const TTS_PROVIDERS = [
  { value: "__default__", label: "使用全局配置" },
  { value: "volcengine", label: "🔥 豆包 TTS" },
  { value: "dashscope", label: "阿里云 DashScope" },
  { value: "gemini", label: "Google Gemini" },
];

const TIER_OPTIONS = [
  { value: "free", label: "体验版", icon: Star, color: "text-gray-500" },
  { value: "standard", label: "标准版", icon: Zap, color: "text-blue-500" },
  { value: "advanced", label: "进阶版", icon: Sparkles, color: "text-amber-500" },
  { value: "premium", label: "旗舰版", icon: Crown, color: "text-purple-500" },
];

const PRESET_HIGHLIGHTS = [
  "免费体验", "标准音色", "不限次数", "大模型音色", "低延迟识别",
  "高清合成", "多种音色", "情感语音", "专属音色", "极速响应",
];

const toStore = (v: string) => v === "__default__" ? "" : v;
const fromStore = (v: string | undefined | null) => (!v || v === "") ? "__default__" : v;

const EMPTY_FORM = {
  id: "",
  name: "",
  displayName: "",
  description: "",
  sttProvider: "",
  ttsProvider: "",
  ttsVoice: "",
  fishCoinCost: 0,
  enabled: true,
  sortOrder: 0,
  // ---- 新增 ----
  dailyFreeRounds: 0,
  highlights: [] as string[],
  tier: "standard" as string,
};

export default function VoicePackageManagement({ embedded = false }: { embedded?: boolean }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);
  const [highlightInput, setHighlightInput] = useState("");

  const utils = trpc.useUtils();
  const { data: packages = [], isLoading } = trpc.system.getAllVoicePackages.useQuery();

  const saveMutation = trpc.system.saveVoicePackages.useMutation({
    onSuccess: () => {
      toast.success("语音套餐已保存");
      utils.system.getAllVoicePackages.invalidate();
      utils.system.getVoicePackages.invalidate();
      setEditing(null);
    },
    onError: (e) => toast.error(`保存失败: ${e.message}`),
  });

  const openNew = () => {
    setForm({ ...EMPTY_FORM, id: crypto.randomUUID(), sortOrder: packages.length + 1 });
    setHighlightInput("");
    setEditing("new");
  };

  const openEdit = (pkg: any) => {
    setForm({
      ...EMPTY_FORM,
      ...pkg,
      fishCoinCost: pkg.fishCoinCost ?? 0,
      dailyFreeRounds: pkg.dailyFreeRounds ?? 0,
      highlights: Array.isArray(pkg.highlights) ? pkg.highlights : [],
      tier: pkg.tier ?? "standard",
    });
    setHighlightInput("");
    setEditing(pkg.id);
  };

  const savePackage = () => {
    if (!form.displayName.trim()) { toast.error("请填写套餐名称"); return; }
    const isNew = editing === "new";
    const updated = isNew
      ? [...packages, form]
      : packages.map((p: any) => (p.id === editing ? form : p));
    saveMutation.mutate(updated as any);
  };

  const deletePackage = (id: string) => {
    if (!confirm("确定删除此语音套餐？")) return;
    saveMutation.mutate(packages.filter((p: any) => p.id !== id) as any);
  };

  const toggleEnabled = (pkg: any) => {
    saveMutation.mutate(
      packages.map((p: any) => p.id === pkg.id ? { ...p, enabled: !p.enabled } : p) as any
    );
  };

  const addHighlight = (tag: string) => {
    const t = tag.trim();
    if (!t || form.highlights.includes(t)) return;
    setForm(p => ({ ...p, highlights: [...p.highlights, t] }));
    setHighlightInput("");
  };

  const removeHighlight = (tag: string) => {
    setForm(p => ({ ...p, highlights: p.highlights.filter(h => h !== tag) }));
  };

  const voiceLabel = (v: string) =>
    DOUBAO_VOICES.find(d => d.value === v)?.label || v || "全局默认";
  const providerLabel = (list: typeof STT_PROVIDERS, v: string) =>
    list.find(d => d.value === v)?.label?.replace("使用全局配置", "全局默认") || "全局默认";

  /* ─── 编辑表单 ─── */
  if (editing !== null) {
    const editContent = (
        <div className="max-w-xl mx-auto p-6 space-y-5">
          <h2 className="text-xl font-semibold">
            {editing === "new" ? "新建语音套餐" : "编辑语音套餐"}
          </h2>

          <div className="space-y-2">
            <Label>套餐名称（展示给用户）</Label>
            <Input
              value={form.displayName}
              onChange={e => setForm(p => ({ ...p, displayName: e.target.value }))}
              placeholder="如：豆包·暖心版"
            />
          </div>

          <div className="space-y-2">
            <Label>描述（可选）</Label>
            <Textarea
              value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="简短描述此套餐的特点"
              rows={2}
            />
          </div>

          {/* ── 新增：套餐档位 ── */}
          <div className="space-y-2">
            <Label>套餐档位</Label>
            <div className="flex gap-2 flex-wrap">
              {TIER_OPTIONS.map(opt => {
                const Icon = opt.icon;
                const isActive = form.tier === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setForm(p => ({ ...p, tier: opt.value }))}
                    className={[
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all",
                      isActive
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40",
                    ].join(" ")}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? "text-primary" : opt.color}`} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">影响前端卡片的视觉样式和排版</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Mic className="h-3.5 w-3.5" />语音识别（STT）
              </Label>
              <Select
                value={fromStore(form.sttProvider)}
                onValueChange={v => setForm(p => ({ ...p, sttProvider: toStore(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STT_PROVIDERS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="flex items-center gap-1">
                <Volume2 className="h-3.5 w-3.5" />语音合成（TTS）
              </Label>
              <Select
                value={fromStore(form.ttsProvider)}
                onValueChange={v => setForm(p => ({ ...p, ttsProvider: toStore(v) }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TTS_PROVIDERS.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* 音色 */}
          {(form.ttsProvider === "volcengine" || form.ttsProvider === "") ? (
            <div className="space-y-2">
              <Label>音色（TTS 豆包专属音色）</Label>
              <Select
                value={fromStore(form.ttsVoice)}
                onValueChange={v => setForm(p => ({ ...p, ttsVoice: toStore(v) }))}
              >
                <SelectTrigger><SelectValue placeholder="选择音色" /></SelectTrigger>
                <SelectContent>
                  {DOUBAO_VOICES.map(o => (
                    <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">选择后，使用此套餐时固定使用此音色，用户无法更改</p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>音色（可选）</Label>
              <Input
                value={form.ttsVoice}
                onChange={e => setForm(p => ({ ...p, ttsVoice: e.target.value }))}
                placeholder="留空则使用全局默认音色"
              />
              <p className="text-xs text-muted-foreground">选择后，使用此套餐时固定使用此音色，用户无法更改</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>🐟 鱼币消耗（每轮）</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={form.fishCoinCost}
                onChange={e => setForm(p => ({ ...p, fishCoinCost: parseFloat(e.target.value) || 0 }))}
                placeholder="0 = 免费"
              />
              <p className="text-xs text-muted-foreground">每完成一轮语音对话扣除的鱼币，0 为免费</p>
            </div>

            {/* ── 新增：每日免费轮次 ── */}
            <div className="space-y-2">
              <Label>每日免费轮次</Label>
              <Input
                type="number"
                min={0}
                value={form.dailyFreeRounds}
                onChange={e => setForm(p => ({ ...p, dailyFreeRounds: parseInt(e.target.value) || 0 }))}
                placeholder="0 = 不限制"
              />
              <p className="text-xs text-muted-foreground">0=不限制。对免费套餐建议设 5-10</p>
            </div>

            <div className="space-y-2">
              <Label>排序（越小越靠前）</Label>
              <Input
                type="number"
                value={form.sortOrder}
                onChange={e => setForm(p => ({ ...p, sortOrder: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* ── 新增：卖点标签 ── */}
          <div className="space-y-2">
            <Label>卖点标签（前台套餐卡片展示）</Label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.highlights.map(tag => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
                  onClick={() => removeHighlight(tag)}
                  title="点击移除"
                >
                  {tag} ×
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={highlightInput}
                onChange={e => setHighlightInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addHighlight(highlightInput); }}}
                placeholder="输入标签后回车"
                className="flex-1"
              />
              <Button
                variant="outline" size="sm"
                onClick={() => addHighlight(highlightInput)}
                disabled={!highlightInput.trim()}
              >
                添加
              </Button>
            </div>
            <div className="flex flex-wrap gap-1 mt-1">
              {PRESET_HIGHLIGHTS.filter(h => !form.highlights.includes(h)).map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => addHighlight(h)}
                  className="px-2 py-0.5 rounded-full text-xs border border-dashed border-muted-foreground/30 text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                >
                  + {h}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <div className="flex items-center gap-2">
              <Switch
                checked={form.enabled}
                onCheckedChange={v => setForm(p => ({ ...p, enabled: v }))}
              />
              <Label>{form.enabled ? "已启用" : "已禁用"}</Label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button onClick={savePackage} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "保存中..." : "保存"}
            </Button>
            <Button variant="outline" onClick={() => setEditing(null)}>取消</Button>
          </div>
        </div>
    );
    if (embedded) return editContent;
    return <DashboardLayout>{editContent}</DashboardLayout>;
  }

  /* ─── 列表 ─── */
  const tierIcon = (tier: string) => {
    const opt = TIER_OPTIONS.find(t => t.value === tier);
    if (!opt) return null;
    const Icon = opt.icon;
    return <Icon className={`w-3 h-3 ${opt.color}`} />;
  };

  const listContent = (
      <div className={embedded ? "space-y-4" : "p-6 space-y-4"}>
        <div className="flex items-center justify-between">
          {!embedded && (
          <div>
            <h1 className="text-2xl font-bold">语音套餐管理</h1>
            <p className="text-sm text-muted-foreground mt-1">
              配置供用户在语音对话页面选择的语音套餐
            </p>
          </div>
          )}
          {embedded && <div />}
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" />新建套餐</Button>
        </div>

        {isLoading && <p className="text-sm text-muted-foreground">加载中...</p>}

        {!isLoading && packages.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            <p>暂无语音套餐</p>
            <Button className="mt-4" onClick={openNew}>
              <Plus className="h-4 w-4 mr-2" />新建第一个套餐
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {packages.map((pkg: any, i: number) => (
            <div key={pkg.id} className="flex items-center gap-4 p-4 border rounded-lg bg-card">
              <GripVertical className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {tierIcon(pkg.tier || "standard")}
                  <span className="font-medium">{pkg.displayName || pkg.name}</span>
                  <Badge variant={pkg.enabled ? "default" : "outline"}>
                    {pkg.enabled ? "启用" : "禁用"}
                  </Badge>
                  {(pkg.fishCoinCost ?? 0) > 0 && (
                    <Badge variant="outline" className="text-amber-600 border-amber-300">
                      🐟 {pkg.fishCoinCost}/轮
                    </Badge>
                  )}
                  {(pkg.dailyFreeRounds ?? 0) > 0 && (
                    <Badge variant="outline" className="text-green-600 border-green-300">
                      {pkg.dailyFreeRounds}轮/天
                    </Badge>
                  )}
                </div>
                {pkg.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{pkg.description}</p>
                )}
                <div className="flex gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  <span>
                    <Mic className="h-3 w-3 inline mr-0.5" />
                    {providerLabel(STT_PROVIDERS, pkg.sttProvider)}
                  </span>
                  <span>
                    <Volume2 className="h-3 w-3 inline mr-0.5" />
                    {providerLabel(TTS_PROVIDERS, pkg.ttsProvider)}
                  </span>
                  {pkg.ttsVoice && <span>音色: {voiceLabel(pkg.ttsVoice)}</span>}
                </div>
                {/* 卖点标签预览 */}
                {pkg.highlights && pkg.highlights.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {pkg.highlights.map((h: string) => (
                      <span key={h} className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">{h}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Switch checked={pkg.enabled} onCheckedChange={() => toggleEnabled(pkg)} />
                <Button variant="ghost" size="icon" onClick={() => openEdit(pkg)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost" size="icon"
                  onClick={() => deletePackage(pkg.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {packages.length > 0 && (
          <p className="text-xs text-muted-foreground">
            💡 前台语音对话页展示所有已启用的套餐。通过排序字段（数字越小越靠前）调整顺序。
          </p>
        )}
      </div>
  );

  if (embedded) return listContent;
  return <DashboardLayout>{listContent}</DashboardLayout>;
}
