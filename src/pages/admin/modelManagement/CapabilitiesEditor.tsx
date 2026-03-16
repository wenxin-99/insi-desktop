/**
 * modelManagement/CapabilitiesEditor — 模型能力标签编辑器
 *
 * 多选 checkbox 组，带分组和描述，保存为 string[] 传给后端
 */
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import type { ModelFormData } from "./types";

/** 能力定义 */
const CAPABILITY_OPTIONS = [
  // ── 核心能力 ──
  { key: "vision",           label: "👁 视觉理解",     group: "核心", desc: "支持图片输入和理解" },
  { key: "function_calling", label: "🔧 函数调用",     group: "核心", desc: "支持 tool use / function calling" },
  { key: "thinking",         label: "🧠 深度推理",     group: "核心", desc: "R1/o1 等推理模型，生成 reasoning 链" },
  { key: "streaming",        label: "📡 流式输出",     group: "核心", desc: "支持 SSE 流式返回" },
  // ── 扩展能力 ──
  { key: "long_context",     label: "📏 长上下文",     group: "扩展", desc: "128K+ token 上下文窗口" },
  { key: "web_search",       label: "🌐 联网搜索",     group: "扩展", desc: "内置 web search 能力" },
  { key: "code_interpreter", label: "💻 代码执行",     group: "扩展", desc: "内置代码解释器" },
  { key: "image_generation", label: "🎨 图片生成",     group: "扩展", desc: "内置文生图能力（如 GPT-4o 画图）" },
] as const;

type CapabilityKey = typeof CAPABILITY_OPTIONS[number]["key"];

interface CapabilitiesEditorProps {
  capabilities: string[];
  onChange: (caps: string[]) => void;
}

export function CapabilitiesEditor({ capabilities, onChange }: CapabilitiesEditorProps) {
  const caps = new Set(capabilities || []);

  const toggle = (key: string) => {
    const next = new Set(caps);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    onChange(Array.from(next));
  };

  const groups = ["核心", "扩展"] as const;

  return (
    <div className="border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold">模型能力标签</h3>
        {capabilities.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {capabilities.map((c) => (
              <Badge key={c} variant="secondary" className="text-xs">
                {CAPABILITY_OPTIONS.find((o) => o.key === c)?.label || c}
              </Badge>
            ))}
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        选择该模型支持的能力，系统将据此自动路由（替代正则匹配模型名）
      </p>

      {groups.map((group) => (
        <div key={group} className="mb-3">
          <p className="text-xs font-medium text-muted-foreground mb-2">{group}能力</p>
          <div className="grid grid-cols-2 gap-2">
            {CAPABILITY_OPTIONS.filter((o) => o.group === group).map((opt) => (
              <label
                key={opt.key}
                className="flex items-start space-x-2 p-2 rounded-md border cursor-pointer hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={caps.has(opt.key)}
                  onCheckedChange={() => toggle(opt.key)}
                  className="mt-0.5"
                />
                <div className="leading-tight">
                  <span className="text-sm font-medium">{opt.label}</span>
                  <p className="text-xs text-muted-foreground">{opt.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** 所有可用能力 key 列表（供 zod schema 校验） */
export const ALL_CAPABILITY_KEYS: string[] = CAPABILITY_OPTIONS.map((o) => o.key);

/** 能力 key → 中文标签映射 */
export const CAPABILITY_LABELS: Record<string, string> = Object.fromEntries(
  CAPABILITY_OPTIONS.map((o) => [o.key, o.label])
);
