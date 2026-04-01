/**
 * ModelDiscoverDialog — 一键拉取可用模型
 *
 * 输入 API Key + 端点 → 自动发现、分类、勾选 → 批量添加
 */
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Wand2, Check, ChevronDown, ChevronRight, Search } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { MODEL_TYPE_LABELS } from "./types";

interface DiscoveredModel {
  id: string;
  name: string;
  type: string;
  capabilities: string[];
  tier: "lite" | "pro" | "max";
  description: string;
  owned_by?: string;
}

const TIER_LABELS: Record<string, string> = { max: "🔴 Max", pro: "🟡 Pro", lite: "🟢 Lite" };
const CAP_LABELS: Record<string, string> = {
  vision: "👁 视觉", function_calling: "🔧 函数", thinking: "🧠 推理",
  streaming: "📡 流式", long_context: "📏 长上下文", web_search: "🌐 搜索",
  code_interpreter: "💻 代码", image_generation: "🎨 生图",
};

export function ModelDiscoverDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [apiEndpoint, setApiEndpoint] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [models, setModels] = useState<DiscoveredModel[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expandedTypes, setExpandedTypes] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [phase, setPhase] = useState<"input" | "select">("input");

  const discoverMutation = trpc.modelDiscover.discover.useMutation();
  const batchCreateMutation = trpc.modelDiscover.batchCreate.useMutation();

  // 按类型分组
  const grouped = useMemo(() => {
    const q = filter.toLowerCase();
    const filtered = q ? models.filter(m => m.id.toLowerCase().includes(q) || m.name.toLowerCase().includes(q)) : models;
    const map = new Map<string, DiscoveredModel[]>();
    for (const m of filtered) {
      const list = map.get(m.type) || [];
      list.push(m);
      map.set(m.type, list);
    }
    return map;
  }, [models, filter]);

  const handleDiscover = async () => {
    if (!apiEndpoint.trim() || !apiKey.trim()) {
      toast.error("请填写 API 端点和 API Key");
      return;
    }
    try {
      const result = await discoverMutation.mutateAsync({ apiEndpoint: apiEndpoint.trim(), apiKey: apiKey.trim() });
      setModels(result.models);
      setApiEndpoint(result.endpoint);
      // 默认全选 chat 类型
      const chatIds = new Set(result.models.filter(m => m.type === "chat").map(m => m.id));
      setSelected(chatIds);
      // 展开所有类型
      setExpandedTypes(new Set(result.models.map(m => m.type)));
      setPhase("select");
      toast.success(`发现 ${result.total} 个模型`);
    } catch (err: any) {
      toast.error(err.message || "拉取失败");
    }
  };

  const handleBatchAdd = async () => {
    const toAdd = models.filter(m => selected.has(m.id));
    if (toAdd.length === 0) { toast.error("请至少选择一个模型"); return; }

    try {
      const result = await batchCreateMutation.mutateAsync({
        apiEndpoint,
        apiKey,
        models: toAdd.map(m => ({ id: m.id, name: m.name, type: m.type, capabilities: m.capabilities, tier: m.tier })),
      });
      toast.success(`添加完成：成功 ${result.success}，失败 ${result.failed}`);
      if (result.errors.length > 0) {
        console.warn("[ModelDiscover] Errors:", result.errors);
      }
      setOpen(false);
      setPhase("input");
      setModels([]);
      setSelected(new Set());
      onSuccess();
    } catch (err: any) {
      toast.error(err.message || "批量添加失败");
    }
  };

  const toggleType = (type: string) => {
    const typeModels = grouped.get(type) || [];
    const allSelected = typeModels.every(m => selected.has(m.id));
    setSelected(prev => {
      const next = new Set(prev);
      typeModels.forEach(m => allSelected ? next.delete(m.id) : next.add(m.id));
      return next;
    });
  };

  const toggleExpand = (type: string) => {
    setExpandedTypes(prev => {
      const next = new Set(prev);
      next.has(type) ? next.delete(type) : next.add(type);
      return next;
    });
  };

  const toggleModel = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAll = () => setSelected(new Set(models.map(m => m.id)));
  const selectNone = () => setSelected(new Set());

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setPhase("input"); setModels([]); setSelected(new Set()); } }}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Wand2 className="h-4 w-4 mr-2" />
          一键拉取
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-blue-500" />
            {phase === "input" ? "自动发现模型" : `发现 ${models.length} 个模型，已选 ${selected.size} 个`}
          </DialogTitle>
        </DialogHeader>

        {phase === "input" ? (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              填写 API 端点和密钥，系统会自动拉取可用模型列表并分类。支持 OpenAI 兼容、Google Gemini、Anthropic、DashScope 等。
            </p>
            <div>
              <Label>API 端点</Label>
              <Input
                value={apiEndpoint}
                onChange={e => setApiEndpoint(e.target.value)}
                placeholder="https://api.openai.com/v1 或 https://dashscope.aliyuncs.com/compatible-mode"
                autoComplete="off"
                data-1p-ignore
              />
            </div>
            <div>
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder="sk-..."
                autoComplete="new-password"
                data-1p-ignore
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)}>取消</Button>
              <Button onClick={handleDiscover} disabled={discoverMutation.isPending}>
                {discoverMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Search className="h-4 w-4 mr-2" />}
                拉取模型列表
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 min-h-0 flex-1">
            {/* 工具栏 */}
            <div className="flex items-center gap-2 flex-wrap">
              <Input
                placeholder="搜索模型..."
                value={filter}
                onChange={e => setFilter(e.target.value)}
                className="flex-1 min-w-[200px] h-8 text-sm"
              />
              <Button variant="ghost" size="sm" onClick={selectAll} className="text-xs">全选</Button>
              <Button variant="ghost" size="sm" onClick={selectNone} className="text-xs">全不选</Button>
              <Button variant="ghost" size="sm" onClick={() => setPhase("input")} className="text-xs">← 返回</Button>
            </div>

            {/* 模型列表 */}
            <div className="overflow-y-auto flex-1 min-h-0 space-y-1 pr-1" style={{ maxHeight: "calc(85vh - 260px)" }}>
              {Array.from(grouped.entries()).map(([type, typeModels]) => {
                const expanded = expandedTypes.has(type);
                const selectedCount = typeModels.filter(m => selected.has(m.id)).length;
                const allSelected = selectedCount === typeModels.length;

                return (
                  <div key={type} className="border rounded-lg overflow-hidden">
                    {/* 类型分组头 */}
                    <div
                      className="flex items-center gap-2 px-3 py-2 bg-muted/50 cursor-pointer hover:bg-muted/80 transition-colors"
                      onClick={() => toggleExpand(type)}
                    >
                      {expanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                      <span className="font-medium text-sm flex-1">
                        {MODEL_TYPE_LABELS[type] || type}
                        <span className="ml-2 text-xs text-muted-foreground font-normal">
                          {selectedCount}/{typeModels.length}
                        </span>
                      </span>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2" onClick={e => { e.stopPropagation(); toggleType(type); }}>
                        {allSelected ? "取消全选" : "全选"}
                      </Button>
                    </div>

                    {/* 模型行 */}
                    {expanded && (
                      <div className="divide-y">
                        {typeModels.map(m => (
                          <label
                            key={m.id}
                            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-sm ${
                              selected.has(m.id) ? "bg-blue-50/50 dark:bg-blue-950/20" : "hover:bg-muted/30"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selected.has(m.id)}
                              onChange={() => toggleModel(m.id)}
                              className="rounded border-gray-300"
                            />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs truncate">{m.id}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 shrink-0">
                                  {TIER_LABELS[m.tier] || m.tier}
                                </span>
                              </div>
                              {m.capabilities.length > 0 && (
                                <div className="flex gap-1 mt-0.5 flex-wrap">
                                  {m.capabilities.map(c => (
                                    <span key={c} className="text-[10px] text-muted-foreground">{CAP_LABELS[c] || c}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                            {selected.has(m.id) && <Check className="h-4 w-4 text-blue-500 shrink-0" />}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 底部操作 */}
            <div className="flex justify-between items-center pt-2 border-t">
              <span className="text-xs text-muted-foreground">
                已选 {selected.size} 个模型，端点: {apiEndpoint.substring(0, 40)}...
              </span>
              <Button onClick={handleBatchAdd} disabled={batchCreateMutation.isPending || selected.size === 0}>
                {batchCreateMutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
                添加 {selected.size} 个模型
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
