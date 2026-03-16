import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, ArrowLeft, MessageSquare, Eye, Image, Volume2, Mic, Search, Film, Brain } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { parseConfig, buildConfigString, PackageSlots, SlotPricing, SlotType, SLOT_DEFS } from "./packagemanagement/types";


// 类型定义已移至 ./packagemanagement/types.ts

export default function PackageManagement({ embedded = false }: { embedded?: boolean }) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: "", displayName: "", description: "",
    primaryModelId: 0, fallbackModelIds: [] as number[],
    enabled: true, sortOrder: 0, fishCoinCost: 0,
    maxConcurrentTasks: 3, maxMessagesPerConversation: 50,
    slots: {} as PackageSlots,
  });

  const utils = trpc.useUtils();
  const { data: packages, isLoading } = trpc.modelPackage.getAll.useQuery();
  const { data: models } = trpc.aiModel.getAll.useQuery();

  const modelsByType = useMemo(() => {
    if (!models) return {};
    const map: Record<string, typeof models> = {};
    for (const m of models) {
      const t = (m as any).type || "chat";
      if (!map[t]) map[t] = [];
      map[t].push(m);
    }
    return map;
  }, [models]);

  const getModelsForSlot = (slot: typeof SLOT_DEFS[0]) => {
    const result: NonNullable<typeof models> = [];
    for (const t of slot.modelTypes) {
      if (modelsByType[t]) result.push(...modelsByType[t]!);
    }
    return result;
  };

  // ─── Mutations ───
  const createMutation = trpc.modelPackage.create.useMutation({
    onSuccess: () => { toast.success("套餐创建成功"); utils.modelPackage.getAll.invalidate(); setEditDialogOpen(false); },
    onError: (e) => { toast.error("创建失败：" + e.message); },
  });
  const updateMutation = trpc.modelPackage.update.useMutation({
    onSuccess: () => { toast.success("套餐更新成功"); utils.modelPackage.getAll.invalidate(); setEditDialogOpen(false); },
    onError: (e) => { toast.error("更新失败：" + e.message); },
  });
  const deleteMutation = trpc.modelPackage.delete.useMutation({
    onSuccess: () => { toast.success("套餐删除成功"); utils.modelPackage.getAll.invalidate(); },
    onError: (e) => { toast.error("删除失败：" + e.message); },
  });

  // ─── Handlers ───
  const handleAdd = () => {
    setEditingPackage(null);
    setFormData({
      name: "", displayName: "", description: "",
      primaryModelId: 0, fallbackModelIds: [],
      enabled: true, sortOrder: 0, fishCoinCost: 0,
      maxConcurrentTasks: 3, maxMessagesPerConversation: 50,
      slots: {},
    });
    setEditDialogOpen(true);
  };

  const handleEdit = (pkg: any) => {
    setEditingPackage(pkg);
    const config = parseConfig(pkg.config);
    const slots = { ...config.slots };
    if (!slots.chat && pkg.primaryModelId) {
      slots.chat = { modelId: pkg.primaryModelId };
    }
    setFormData({
      name: pkg.name, displayName: pkg.displayName, description: pkg.description || "",
      primaryModelId: pkg.primaryModelId,
      fallbackModelIds: pkg.fallbackModelIds ? pkg.fallbackModelIds.split(",").map(Number) : [],
      enabled: pkg.enabled, sortOrder: pkg.sortOrder, fishCoinCost: pkg.fishCoinCost || 0,
      maxConcurrentTasks: pkg.maxConcurrentTasks ?? 3,
      maxMessagesPerConversation: pkg.maxMessagesPerConversation ?? 50,
      slots,
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.name || !formData.displayName) {
      toast.error("请填写套餐名称和显示名称"); return;
    }
    const chatModelId = formData.slots.chat?.modelId || formData.primaryModelId;
    if (!chatModelId) {
      toast.error("请至少指定对话/推理模型"); return;
    }
    const existingConfig = editingPackage ? parseConfig(editingPackage.config) : {};
    const configStr = buildConfigString(formData.slots, existingConfig);

    const payload = {
      displayName: formData.displayName,
      description: formData.description,
      primaryModelId: chatModelId,
      fallbackModelIds: formData.fallbackModelIds.join(","),
      enabled: formData.enabled, sortOrder: formData.sortOrder,
      fishCoinCost: formData.fishCoinCost,
      maxConcurrentTasks: formData.maxConcurrentTasks,
      maxMessagesPerConversation: formData.maxMessagesPerConversation,
      config: configStr,
    };

    if (editingPackage) {
      updateMutation.mutate({ id: editingPackage.id, ...payload });
    } else {
      createMutation.mutate({ name: formData.name, ...payload });
    }
  };

  const handleDelete = (id: number, name: string) => {
    if (!confirm(`确定删除「${name}」套餐？`)) return;
    deleteMutation.mutate({ id });
  };

  // ─── Slot helpers ───
  const setSlot = (slot: SlotType, modelId: number | null) => {
    setFormData(prev => {
      const newSlots = { ...prev.slots };
      if (modelId) {
        const old = newSlots[slot];
        newSlots[slot] = {
          modelId,
          fishCoinCost: old?.fishCoinCost,
          fishCoinCost5s: old?.fishCoinCost5s,
          fishCoinCost10s: old?.fishCoinCost10s,
          // 保留研究定价字段
          researchBaseCost: old?.researchBaseCost,
          researchStepCost: old?.researchStepCost,
          researchMaxSteps: old?.researchMaxSteps,
          sshBaseCost: old?.sshBaseCost,
          sshStepCost: old?.sshStepCost,
          sshMaxSteps: old?.sshMaxSteps,
        };
      } else {
        delete newSlots[slot];
      }
      const newPrimary = slot === "chat" ? (modelId || prev.primaryModelId) : prev.primaryModelId;
      return { ...prev, slots: newSlots, primaryModelId: newPrimary };
    });
  };

  const setSlotField = (slot: SlotType, field: keyof SlotPricing, value: number) => {
    setFormData(prev => {
      const newSlots = { ...prev.slots };
      const existing = newSlots[slot];
      if (existing) {
        newSlots[slot] = { ...existing, [field]: value };
      }
      return { ...prev, slots: newSlots };
    });
  };

  const getModelName = (modelId: number | undefined) => {
    if (!modelId || !models) return null;
    return models.find(m => m.id === modelId)?.displayName || "#" + modelId;
  };

  const getSlotSummary = (pkg: any) => {
    const config = parseConfig(pkg.config);
    const slots = config.slots || {};
    const parts: string[] = [];
    const add = (emoji: string, key: string) => {
      const s = (slots as any)[key];
      if (!s?.modelId) return;
      const name = getModelName(s.modelId) || "";
      if (key === "video") {
        const c5 = s.fishCoinCost5s; const c10 = s.fishCoinCost10s;
        const price = c5 || c10 ? ` ${c5 || "?"}/${c10 || "?"}🐟` : "";
        parts.push(`${emoji}${name}${price}`);
      } else {
        const cost = s.fishCoinCost ? ` ${s.fishCoinCost}🐟` : "";
        parts.push(`${emoji}${name}${cost}`);
      }
    };
    add("💬", "chat"); add("🧠", "thinking"); add("👁", "vision"); add("🎨", "image");
    add("✏️", "image_edit"); add("🎬", "video"); add("🎞", "video_i2v"); add("🔊", "tts"); add("🎤", "asr");
    add("📦", "embedding"); add("↕️", "rerank"); add("🔍", "research"); add("🌐", "web_search");
    return parts.length > 0 ? parts : null;
  };

  // ─── Render ───
  if (isLoading) return <div className="p-6"><div className="text-center text-muted-foreground">加载中...</div></div>;

  const content = (
    <div className={embedded ? "" : "p-6"}>
      <div className="flex items-center justify-between mb-6">
        {!embedded && (
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">模型套餐管理</h1>
              <p className="text-sm text-muted-foreground mt-1">为每个套餐配置各能力对应的AI模型和计费方式</p>
            </div>
          </div>
        )}
        {embedded && <div />}
        <Button onClick={handleAdd}><Plus className="h-4 w-4 mr-2" />添加套餐</Button>
      </div>

      {/* ─── 套餐列表 ─── */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>套餐</TableHead>
              <TableHead>模型配置</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>并发/轮次</TableHead>
              <TableHead>排序</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {packages && packages.length > 0 ? packages.map((pkg) => {
              const slotSummary = getSlotSummary(pkg);
              return (
                <TableRow key={pkg.id}>
                  <TableCell>
                    <div className="font-medium">{pkg.displayName}</div>
                    <div className="text-xs text-muted-foreground">{pkg.name}</div>
                  </TableCell>
                  <TableCell>
                    {slotSummary ? (
                      <div className="flex flex-wrap gap-1">
                        {slotSummary.map((s, i) => <Badge key={i} variant="outline" className="text-xs font-normal">{s}</Badge>)}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        主模型: {models?.find(m => m.id === pkg.primaryModelId)?.displayName || "-"}
                      </span>
                    )}
                  </TableCell>
                  <TableCell><Badge variant={pkg.enabled ? "default" : "secondary"}>{pkg.enabled ? "启用" : "禁用"}</Badge></TableCell>
                  <TableCell className="text-sm">{pkg.maxConcurrentTasks ?? 3} / {pkg.maxMessagesPerConversation ?? 50}</TableCell>
                  <TableCell>{pkg.sortOrder}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(pkg)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(pkg.id, pkg.displayName)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            }) : (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">暂无套餐数据</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* ─── 编辑对话框 ─── */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-2xl lg:max-w-5xl max-h-[90dvh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle>{editingPackage ? "编辑套餐" : "添加套餐"}</DialogTitle>
            <DialogDescription>为每种能力指定 AI 模型和独立计费</DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 py-4">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>套餐标识 *</Label>
                <Input placeholder="basic / standard / premium" value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })} disabled={!!editingPackage} />
              </div>
              <div className="grid gap-2">
                <Label>显示名称 *</Label>
                <Input placeholder="基础套餐" value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })} />
              </div>
            </div>

            <div className="grid gap-2">
              <Label>描述</Label>
              <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} rows={2} />
            </div>

            {/* ═══ 能力模型 + 分类计费 ═══ */}
            <div className="border rounded-lg overflow-hidden">
              <div className="px-4 py-3 bg-muted/50 border-b">
                <h3 className="font-medium text-sm">🎯 能力模型 &amp; 计费配置</h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  为每种能力指定模型并设置独立定价。留空则沿用基础对话费用。
                </p>
              </div>

              {/* 桌面端表头（md以上显示） */}
              <div className="hidden md:grid md:grid-cols-[110px_1fr_180px_160px] gap-2 px-4 py-2 border-b bg-muted/30 text-xs font-medium text-muted-foreground">
                <div>能力</div>
                <div>模型</div>
                <div className="text-center">🐟 定价</div>
                <div className="hidden lg:block">说明</div>
              </div>

              {/* 各行 */}
              <div className="divide-y">
                {SLOT_DEFS.map(slot => {
                  const Icon = slot.icon;
                  const availableModels = getModelsForSlot(slot);
                  const sd = formData.slots[slot.key];
                  const hasModel = !!sd?.modelId;
                  const isChat = slot.key === "chat";
                  const isVideo = slot.billing === "per_video";

                  return (
                    <div key={slot.key} className="px-3 py-3 sm:px-4">
                      <div className="flex flex-col gap-2 md:grid md:grid-cols-[110px_1fr_180px_160px] md:gap-2 md:items-center">
                      {/* 能力名 */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <span className="text-sm font-medium">
                            {slot.label}
                            {isChat && <span className="text-red-500 ml-0.5">*</span>}
                          </span>
                        </div>
                        {/* 移动端说明 */}
                        <span className="text-xs text-muted-foreground md:hidden">{slot.desc}</span>
                      </div>

                      {/* 模型选择 */}
                      <div>
                        <Select
                          value={sd?.modelId?.toString() || "none"}
                          onValueChange={(v) => setSlot(slot.key, v === "none" ? null : Number(v))}
                        >
                          <SelectTrigger className="h-9 w-full"><SelectValue placeholder="未配置" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">
                              <span className="text-muted-foreground">
                                {slot.key === "research" ? "继承对话模型" : slot.key === "image_edit" ? "复用图片生成" : slot.key === "video_i2v" ? "复用文生视频" : "未配置"}
                              </span>
                            </SelectItem>
                            {availableModels.map(m => (
                              <SelectItem key={m.id} value={m.id.toString()}>
                                {m.displayName}
                                {!(m as any).enabled && <span className="text-muted-foreground ml-1">(已禁用)</span>}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* 定价区 — 按 billing 类型渲染 */}
                      <div>
                        {!hasModel ? (
                          <span className="block text-center text-xs text-muted-foreground">—</span>
                        ) : isChat ? (
                          <div className="text-center">
                            <span className="text-xs text-muted-foreground">← 用基础对话费用</span>
                          </div>
                        ) : isVideo ? (
                          /* 视频：5秒 / 10秒 两档 */
                          <div className="flex items-center gap-1.5">
                            <div className="flex-1 relative">
                              <Input
                                type="number" step="1" min="0"
                                placeholder="30"
                                value={sd?.fishCoinCost5s ?? ""}
                                onChange={(e) => setSlotField(slot.key, "fishCoinCost5s", Number(e.target.value) || 0)}
                                className="h-8 text-center text-sm pr-8"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">/5s</span>
                            </div>
                            <div className="flex-1 relative">
                              <Input
                                type="number" step="1" min="0"
                                placeholder="50"
                                value={sd?.fishCoinCost10s ?? ""}
                                onChange={(e) => setSlotField(slot.key, "fishCoinCost10s", Number(e.target.value) || 0)}
                                className="h-8 text-center text-sm pr-9"
                              />
                              <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">/10s</span>
                            </div>
                          </div>
                        ) : (
                          /* 图片/语音/研究：单价 + 单位 */
                          <div className="relative">
                            <Input
                              type="number" step="0.1" min="0"
                              placeholder="基础"
                              value={sd?.fishCoinCost ?? ""}
                              onChange={(e) => setSlotField(slot.key, "fishCoinCost", Number(e.target.value) || 0)}
                              className="h-8 text-center text-sm pr-10"
                            />
                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground pointer-events-none">
                              🐟{slot.unit}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* 说明（桌面端独立列） */}
                      <span className="text-xs text-muted-foreground hidden lg:block">{slot.desc}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ═══ 研究代理定价（底价 + 按步计费） ═══ */}
            {formData.slots.research?.modelId && (
              <div className="border rounded-lg overflow-hidden">
                <div className="px-4 py-3 bg-amber-50 dark:bg-amber-950/30 border-b">
                  <h3 className="font-medium text-sm">🔍 研究代理按步计费</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    总费用 = 底价（启动时扣） + 实际步数 × 每步费用。余额不足时自动停止并生成报告。
                  </p>
                </div>
                <div className="p-4 space-y-4">
                  {/* 普通研究 */}
                  <div>
                    <div className="text-xs font-medium mb-2 text-muted-foreground">📖 普通研究（搜索 + 总结）</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="grid gap-1">
                        <Label className="text-xs">底价（🐟）</Label>
                        <Input type="number" step="0.5" min="0" placeholder="3"
                          value={formData.slots.research?.researchBaseCost ?? ""}
                          onChange={(e) => setSlotField("research", "researchBaseCost", Number(e.target.value) || 0)}
                          className="h-8 text-sm" />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">每步费用（🐟）</Label>
                        <Input type="number" step="0.1" min="0" placeholder="0.5"
                          value={formData.slots.research?.researchStepCost ?? ""}
                          onChange={(e) => setSlotField("research", "researchStepCost", Number(e.target.value) || 0)}
                          className="h-8 text-sm" />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">最大步数</Label>
                        <Input type="number" step="5" min="5" max="200" placeholder="50"
                          value={formData.slots.research?.researchMaxSteps ?? ""}
                          onChange={(e) => setSlotField("research", "researchMaxSteps", Number(e.target.value) || 0)}
                          className="h-8 text-sm" />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">示例：底价3 + 50步×0.5 = 最高28🐟 | 简单任务10步 = 8🐟</p>
                  </div>
                  {/* SSH 运维 */}
                  <div>
                    <div className="text-xs font-medium mb-2 text-muted-foreground">🖥️ SSH 远程运维</div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="grid gap-1">
                        <Label className="text-xs">底价（🐟）</Label>
                        <Input type="number" step="0.5" min="0" placeholder="5"
                          value={formData.slots.research?.sshBaseCost ?? ""}
                          onChange={(e) => setSlotField("research", "sshBaseCost", Number(e.target.value) || 0)}
                          className="h-8 text-sm" />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">每步费用（🐟）</Label>
                        <Input type="number" step="0.1" min="0" placeholder="1"
                          value={formData.slots.research?.sshStepCost ?? ""}
                          onChange={(e) => setSlotField("research", "sshStepCost", Number(e.target.value) || 0)}
                          className="h-8 text-sm" />
                      </div>
                      <div className="grid gap-1">
                        <Label className="text-xs">最大步数</Label>
                        <Input type="number" step="5" min="5" max="200" placeholder="120"
                          value={formData.slots.research?.sshMaxSteps ?? ""}
                          onChange={(e) => setSlotField("research", "sshMaxSteps", Number(e.target.value) || 0)}
                          className="h-8 text-sm" />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">示例：底价5 + 120步×1 = 最高125🐟 | 简单修复15步 = 20🐟</p>
                  </div>
                </div>
              </div>
            )}

            {/* ═══ 底部参数 ═══ */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              <div className="grid gap-1.5 col-span-2 sm:col-span-1">
                <Label className="text-xs">基础对话费用（🐟/轮）</Label>
                <Input type="number" step="0.01" value={formData.fishCoinCost}
                  onChange={(e) => setFormData({ ...formData, fishCoinCost: Number(e.target.value) })} />
                <p className="text-[10px] text-muted-foreground leading-tight">
                  对话/推理 每轮扣费；其他能力未单独定价时也用此值
                </p>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">多任务上限</Label>
                <Input type="number" min="1" max="20" value={formData.maxConcurrentTasks}
                  onChange={(e) => setFormData({ ...formData, maxConcurrentTasks: Number(e.target.value) })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">对话轮次上限</Label>
                <Input type="number" min="10" max="500" value={formData.maxMessagesPerConversation}
                  onChange={(e) => setFormData({ ...formData, maxMessagesPerConversation: Number(e.target.value) })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">排序</Label>
                <Input type="number" value={formData.sortOrder}
                  onChange={(e) => setFormData({ ...formData, sortOrder: Number(e.target.value) })} />
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs">状态</Label>
                <Select value={formData.enabled.toString()} onValueChange={(v) => setFormData({ ...formData, enabled: v === "true" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">启用</SelectItem>
                    <SelectItem value="false">禁用</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>取消</Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending || createMutation.isPending}>
              {(updateMutation.isPending || createMutation.isPending) ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );

  if (embedded) return content;
  return <DashboardLayout>{content}</DashboardLayout>;
}
