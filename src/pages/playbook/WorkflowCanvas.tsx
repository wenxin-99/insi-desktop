/**
 * WorkflowCanvas.tsx — 纯自绘可视化工作流画布编辑器 v3
 *
 * ★ 零外部流程图库依赖 — div 拖拽 + SVG 连线
 * ★ 移动端全适配 — 触摸拖拽/平移/双指缩放
 * ★ 响应式布局 — 配置面板底部抽屉，工具栏精简
 */

import { useState, useCallback, useRef, useMemo, useEffect, memo } from "react";
import {
  Save, Plus, Trash2, Loader2,
  Settings, ArrowLeft, Bug, X,
  CheckCircle, XCircle,
  Box, Wand2, ZoomIn, ZoomOut, Maximize2,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { cn } from "@/lib/utils";
import {
  type WorkflowNodeData, type WorkflowNodeType, type WorkflowParam,
  type SerializedWorkflow, type VariableRef,
  NODE_REGISTRY, TOOL_CATEGORIES, getNodeTypeInfo, getNodeOutputVars,
  stepsToGraph, graphToSteps, extractMaxNodeId,
} from "./workflowTypes";

// ═══════════════════════════════════════════════════════════════════
// 类型 + 常量
// ═══════════════════════════════════════════════════════════════════

interface CanvasNode { id: string; type: string; position: { x: number; y: number }; data: WorkflowNodeData; }
interface CanvasEdge { id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string; }

const NODE_W = 200;
const NODE_H = 86; // header + body
const isMobile = () => typeof window !== "undefined" && window.innerWidth < 640;

// ═══════════════════════════════════════════════════════════════════
// 1. SVG 连线
// ═══════════════════════════════════════════════════════════════════

function getHandlePos(node: CanvasNode, type: "source" | "target", handleId?: string) {
  if (type === "target") return { x: node.position.x + NODE_W / 2, y: node.position.y };
  if (node.data.type === "condition") {
    if (handleId === "true") return { x: node.position.x + NODE_W * 0.3, y: node.position.y + NODE_H };
    if (handleId === "false") return { x: node.position.x + NODE_W * 0.7, y: node.position.y + NODE_H };
  }
  return { x: node.position.x + NODE_W / 2, y: node.position.y + NODE_H };
}

function bezier(x1: number, y1: number, x2: number, y2: number) {
  const cp = Math.max(40, Math.abs(y2 - y1) * 0.4);
  return `M ${x1} ${y1} C ${x1} ${y1 + cp}, ${x2} ${y2 - cp}, ${x2} ${y2}`;
}

function EdgesSVG({ edges, nodes, tempEdge, onEdgeClick }: {
  edges: CanvasEdge[]; nodes: CanvasNode[];
  tempEdge: { x1: number; y1: number; x2: number; y2: number } | null;
  onEdgeClick?: (id: string) => void;
}) {
  const nm = useMemo(() => new Map(nodes.map(n => [n.id, n])), [nodes]);
  return (
    <svg className="absolute inset-0 w-full h-full" style={{ overflow: "visible", pointerEvents: "none" }}>
      <defs>
        <marker id="arr" viewBox="0 0 10 7" refX="9" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
          <polygon points="0 0, 10 3.5, 0 7" className="fill-muted-foreground/50" />
        </marker>
      </defs>
      {edges.map(e => {
        const sn = nm.get(e.source), tn = nm.get(e.target);
        if (!sn || !tn) return null;
        const s = getHandlePos(sn, "source", e.sourceHandle), t = getHandlePos(tn, "target");
        return (
          <g key={e.id}>
            {/* 透明粗线用于点击 */}
            <path d={bezier(s.x, s.y, t.x, t.y)} fill="none" stroke="transparent" strokeWidth={16}
              style={{ pointerEvents: "stroke", cursor: "pointer" }}
              onClick={() => onEdgeClick?.(e.id)} />
            <path d={bezier(s.x, s.y, t.x, t.y)} fill="none" markerEnd="url(#arr)"
              className={cn("stroke-[2] pointer-events-none",
                e.sourceHandle === "true" ? "stroke-green-400" : e.sourceHandle === "false" ? "stroke-red-400" : "stroke-muted-foreground/40"
              )} />
            {e.label && <text x={(s.x + t.x) / 2} y={(s.y + t.y) / 2 - 6} textAnchor="middle" className="fill-muted-foreground text-[10px] font-medium pointer-events-none">{e.label}</text>}
          </g>
        );
      })}
      {tempEdge && <path d={bezier(tempEdge.x1, tempEdge.y1, tempEdge.x2, tempEdge.y2)} fill="none" className="stroke-primary/60 stroke-[2]" strokeDasharray="6 3" />}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 2. 节点视图
// ═══════════════════════════════════════════════════════════════════

const NodeView = memo(({ node, selected, isDragging, onPointerDown, onHandlePointerDown, onClick }: {
  node: CanvasNode; selected: boolean; isDragging: boolean;
  onPointerDown: (e: React.PointerEvent, id: string) => void;
  onHandlePointerDown: (e: React.PointerEvent, nodeId: string, handleId?: string) => void;
  onClick: (id: string) => void;
}) => {
  const d = node.data;
  const info = getNodeTypeInfo(d.type);
  const dbg = d._debugStatus;
  const ring = dbg === "running" ? "ring-2 ring-blue-400 animate-pulse" : dbg === "success" ? "ring-2 ring-green-400" : dbg === "error" ? "ring-2 ring-red-400" : "";

  let summary = "";
  switch (d.type) {
    case "start": summary = d.triggerType === "cron" ? `定时: ${d.cronExpression || "未设"}` : d.triggerType === "webhook" ? "Webhook" : "手动触发"; break;
    case "llm": summary = d.model || "qwen-plus"; break;
    case "tool": summary = TOOL_CATEGORIES.flatMap(c => c.tools).find(t => t.id === d.toolId)?.label || d.toolId || ""; break;
    case "code": summary = d.language === "python" ? "🐍 Python" : "📜 JavaScript"; break;
    case "condition": summary = d.conditionExpression?.substring(0, 25) || (d.conditionField ? `${d.conditionField} ${d.conditionOp || "eq"}` : "未配置"); break;
    case "loop": summary = `遍历 ${d.loopSource || "未设"}`; break;
    case "template": summary = d.templateText?.substring(0, 25) || "空模板"; break;
    case "output": summary = d.outputMode === "api" ? "API" : d.outputMode === "file" ? "文件" : "渠道推送"; break;
  }

  const hc = "w-3.5 h-3.5 rounded-full border-2 border-white dark:border-gray-900 absolute z-10 touch-none";

  return (
    <div
      className={cn(
        "absolute rounded-xl border-2 shadow-sm select-none touch-none transition-shadow",
        info?.color || "border-gray-300", info?.bgColor || "bg-white dark:bg-gray-900",
        selected && "shadow-lg shadow-primary/20 !border-primary",
        isDragging && "shadow-xl scale-[1.03] z-50 opacity-90",
        ring,
      )}
      style={{ left: node.position.x, top: node.position.y, width: NODE_W }}
      onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onPointerDown(e, node.id); }}
      onClick={e => { e.stopPropagation(); onClick(node.id); }}
    >
      <div className="px-3 py-2 flex items-center gap-2 border-b border-black/5 dark:border-white/5">
        <span className="text-sm leading-none">{info?.icon || "⚙"}</span>
        <span className="text-[11px] font-semibold truncate flex-1">{d.label}</span>
        {dbg === "success" && <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" />}
        {dbg === "error" && <XCircle className="w-3 h-3 text-red-500 flex-shrink-0" />}
        {dbg === "running" && <Loader2 className="w-3 h-3 text-blue-500 animate-spin flex-shrink-0" />}
      </div>
      <div className="px-3 py-2 text-[10px] text-muted-foreground truncate min-h-[28px]">{summary}</div>

      {/* Debug output */}
      {dbg === "success" && d._debugOutput && <div className="px-3 py-1 border-t border-black/5 bg-green-50/50 dark:bg-green-950/20"><p className="text-[9px] text-green-700 dark:text-green-400 font-mono truncate">✓ {JSON.stringify(d._debugOutput).substring(0, 50)}</p></div>}
      {dbg === "error" && d._debugError && <div className="px-3 py-1 border-t border-black/5 bg-red-50/50 dark:bg-red-950/20"><p className="text-[9px] text-red-600 dark:text-red-400 truncate">✗ {d._debugError.substring(0, 50)}</p></div>}

      {/* Handles */}
      {d.type !== "start" && <div className={cn(hc, "bg-gray-400 -top-[7px] left-1/2 -translate-x-1/2 cursor-crosshair")} />}
      {d.type !== "output" && d.type !== "condition" && (
        <div className={cn(hc, "bg-gray-400 -bottom-[7px] left-1/2 -translate-x-1/2 cursor-crosshair")}
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onHandlePointerDown(e, node.id); }} />
      )}
      {d.type === "condition" && (<>
        <div className="flex justify-between px-6 -mb-0.5"><span className="text-[8px] text-green-600 font-bold">✓ 是</span><span className="text-[8px] text-red-600 font-bold">✗ 否</span></div>
        <div className={cn(hc, "bg-green-500 -bottom-[7px] cursor-crosshair")} style={{ left: "30%" }}
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onHandlePointerDown(e, node.id, "true"); }} />
        <div className={cn(hc, "bg-red-500 -bottom-[7px] cursor-crosshair")} style={{ left: "70%" }}
          onPointerDown={e => { e.stopPropagation(); e.preventDefault(); onHandlePointerDown(e, node.id, "false"); }} />
      </>)}
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════════
// 3. 节点配置面板（移动端底部抽屉/桌面侧边栏）
// ═══════════════════════════════════════════════════════════════════

function ConfigPanel({ node, allNodes, onUpdate, onClose, onDelete }: {
  node: CanvasNode; allNodes: CanvasNode[];
  onUpdate: (id: string, d: Partial<WorkflowNodeData>) => void; onClose: () => void;
  onDelete: () => void;
}) {
  const d = node.data;
  const info = getNodeTypeInfo(d.type);
  const upd = (f: string, v: any) => onUpdate(node.id, { [f]: v });
  const mobile = isMobile();

  const upstreamVars = useMemo(() => {
    const vars: VariableRef[] = [];
    for (const n of allNodes) { if (n.id === node.id) continue; for (const o of getNodeOutputVars(n.data.type, n.data)) vars.push({ nodeId: n.id, nodeLabel: n.data.label, outputKey: o.key, outputType: o.type as any }); }
    return vars;
  }, [allNodes, node.id]);

  const [showVP, setShowVP] = useState(false);
  const [vpTarget, setVPTarget] = useState("");
  const openVP = (f: string) => { setVPTarget(f); setShowVP(true); };
  const pickVar = (v: VariableRef) => { upd(vpTarget, ((d as any)[vpTarget] || "") + `{{${v.nodeId}.${v.outputKey}}}`); setShowVP(false); };

  const [jsonDraft, setJsonDraft] = useState(() => JSON.stringify(d.paramTemplate || {}, null, 2));
  const [jsonErr, setJsonErr] = useState(false);
  useEffect(() => { const s = JSON.stringify(d.paramTemplate || {}, null, 2); if (s !== jsonDraft && !jsonErr) setJsonDraft(s); }, [d.paramTemplate]);
  const onJson = (v: string) => { setJsonDraft(v); try { upd("paramTemplate", JSON.parse(v)); setJsonErr(false); } catch { setJsonErr(true); } };

  const VB = ({ f }: { f: string }) => <button onClick={() => openVP(f)} className="text-[10px] text-primary hover:underline flex items-center gap-0.5"><Box className="w-3 h-3" /> 变量</button>;
  const LR = ({ l, f }: { l: string; f?: string }) => <div className="flex items-center justify-between mb-1"><label className="text-xs font-medium text-muted-foreground">{l}</label>{f && <VB f={f} />}</div>;

  const content = (
    <div className="p-4 space-y-3 flex-1 overflow-y-auto">
      <div><LR l="名称" /><input value={d.label} onChange={e => upd("label", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background" /></div>

      {d.type === "start" && (<>
        <div><LR l="触发方式" /><select value={d.triggerType} onChange={e => upd("triggerType", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background"><option value="manual">手动</option><option value="cron">定时</option><option value="webhook">Webhook</option><option value="channel">渠道消息</option></select></div>
        {d.triggerType === "cron" && <div><LR l="Cron" /><input value={d.cronExpression || ""} onChange={e => upd("cronExpression", e.target.value)} placeholder="0 30 8 * * *" className="w-full px-3 py-2 text-sm rounded-lg border bg-background font-mono" /></div>}
        <div>
          <div className="flex items-center justify-between mb-1"><label className="text-xs font-medium text-muted-foreground">输入参数</label><button onClick={() => upd("parameters", [...(d.parameters || []), { key: `p${(d.parameters?.length || 0) + 1}`, label: "参数", type: "string", required: true }])} className="text-[10px] text-primary hover:underline flex items-center gap-0.5"><Plus className="w-3 h-3" /> 添加</button></div>
          {(d.parameters || []).length === 0 ? <p className="text-[10px] text-muted-foreground text-center py-2">无参数</p> : (d.parameters || []).map((p, i) => (
            <div key={i} className="flex items-center gap-1.5 mb-1.5">
              <input value={p.key} onChange={e => { const ps = [...(d.parameters || [])]; ps[i] = { ...ps[i], key: e.target.value }; upd("parameters", ps); }} placeholder="key" className="flex-1 px-2 py-1.5 text-[11px] rounded border bg-background font-mono" />
              <input value={p.label} onChange={e => { const ps = [...(d.parameters || [])]; ps[i] = { ...ps[i], label: e.target.value }; upd("parameters", ps); }} placeholder="标签" className="flex-1 px-2 py-1.5 text-[11px] rounded border bg-background" />
              <button onClick={() => upd("parameters", (d.parameters || []).filter((_, j) => j !== i))} className="p-1 hover:bg-red-100 rounded text-red-500"><Trash2 className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      </>)}

      {d.type === "llm" && (<>
        <div><LR l="模型" /><select value={d.model || "qwen-plus"} onChange={e => upd("model", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background">{["qwen-turbo", "qwen-plus", "qwen-max", "deepseek-v3.2", "deepseek-r1", "gpt-4o-mini", "gpt-4o", "claude-sonnet", "gemini-2.0-flash"].map(m => <option key={m} value={m}>{m}</option>)}</select></div>
        <div><LR l="系统提示词" f="systemPrompt" /><textarea value={d.systemPrompt || ""} onChange={e => upd("systemPrompt", e.target.value)} placeholder="你是..." className="w-full px-3 py-2 text-sm rounded-lg border bg-background h-20 resize-none" /></div>
        <div><LR l="用户提示词" f="userPrompt" /><textarea value={d.userPrompt || ""} onChange={e => upd("userPrompt", e.target.value)} placeholder="请帮我..." className="w-full px-3 py-2 text-sm rounded-lg border bg-background h-20 resize-none" /></div>
        <div className="grid grid-cols-2 gap-3"><div><LR l="温度" /><input type="number" value={d.temperature ?? 0.7} onChange={e => upd("temperature", +e.target.value)} step={0.1} min={0} max={2} className="w-full px-3 py-2 text-sm rounded-lg border bg-background" /></div><div><LR l="最大Token" /><input type="number" value={d.maxTokens ?? 2000} onChange={e => upd("maxTokens", +e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background" /></div></div>
      </>)}

      {d.type === "tool" && (<>
        <div><LR l="工具" /><select value={d.toolId || ""} onChange={e => upd("toolId", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background">{TOOL_CATEGORIES.map(c => <optgroup key={c.category} label={`${c.icon} ${c.label}`}>{c.tools.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}</optgroup>)}</select></div>
        <div><LR l="参数 JSON" f="_paramJson" /><textarea value={jsonDraft} onChange={e => onJson(e.target.value)} className={cn("w-full px-3 py-2 text-xs rounded-lg border bg-background font-mono h-24 resize-none", jsonErr && "border-red-400")} />{jsonErr && <p className="text-[10px] text-red-500 mt-0.5">JSON 格式错误</p>}</div>
      </>)}

      {d.type === "code" && (<>
        <div><LR l="语言" /><select value={d.language || "javascript"} onChange={e => upd("language", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background"><option value="javascript">JavaScript</option><option value="python">Python</option></select></div>
        <div><LR l="输入变量" /><input value={(d.inputVars || []).join(", ")} onChange={e => upd("inputVars", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="w-full px-3 py-2 text-xs rounded-lg border bg-background font-mono" /></div>
        <div><LR l="代码" /><textarea value={d.code || ""} onChange={e => upd("code", e.target.value)} className="w-full px-3 py-2 text-xs rounded-lg border bg-background font-mono h-32 resize-none" spellCheck={false} /></div>
        <div><LR l="输出变量" /><input value={(d.outputVars || []).join(", ")} onChange={e => upd("outputVars", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} className="w-full px-3 py-2 text-xs rounded-lg border bg-background font-mono" /></div>
      </>)}

      {d.type === "condition" && (<>
        <div><LR l="条件字段" f="conditionField" /><input value={d.conditionField || ""} onChange={e => upd("conditionField", e.target.value)} placeholder="{{node.output}}" className="w-full px-3 py-2 text-sm rounded-lg border bg-background font-mono" /></div>
        <div className="grid grid-cols-2 gap-3"><div><LR l="运算符" /><select value={d.conditionOp || "eq"} onChange={e => upd("conditionOp", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background"><option value="eq">等于</option><option value="neq">不等于</option><option value="gt">大于</option><option value="lt">小于</option><option value="contains">包含</option><option value="regex">正则</option><option value="empty">为空</option><option value="not_empty">非空</option></select></div><div><LR l="比较值" /><input value={d.conditionValue || ""} onChange={e => upd("conditionValue", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background" /></div></div>
        <div><LR l="或: 自定义表达式" /><input value={d.conditionExpression || ""} onChange={e => upd("conditionExpression", e.target.value)} className="w-full px-3 py-2 text-xs rounded-lg border bg-background font-mono" /></div>
      </>)}

      {d.type === "loop" && (<>
        <div><LR l="数据源" f="loopSource" /><input value={d.loopSource || ""} onChange={e => upd("loopSource", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background font-mono" /></div>
        <div className="grid grid-cols-2 gap-3"><div><LR l="循环变量" /><input value={d.loopItemVar || "item"} onChange={e => upd("loopItemVar", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background font-mono" /></div><div><LR l="最大迭代" /><input type="number" value={d.loopMaxIter ?? 10} onChange={e => upd("loopMaxIter", +e.target.value)} min={1} max={100} className="w-full px-3 py-2 text-sm rounded-lg border bg-background" /></div></div>
      </>)}

      {d.type === "template" && <div><LR l="模板内容" f="templateText" /><textarea value={d.templateText || ""} onChange={e => upd("templateText", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background h-28 resize-none" /></div>}

      {d.type === "output" && (<>
        <div><LR l="输出方式" /><select value={d.outputMode || "channel"} onChange={e => upd("outputMode", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background"><option value="channel">渠道推送</option><option value="api">API</option><option value="variable">变量</option><option value="file">文件</option></select></div>
        {d.outputMode === "channel" && <div><LR l="通知标题" /><input value={d.channelTitle || ""} onChange={e => upd("channelTitle", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background" /></div>}
      </>)}

      {d.type !== "start" && d.type !== "output" && <div><LR l="错误处理" /><select value={d.onError || "retry"} onChange={e => upd("onError", e.target.value)} className="w-full px-3 py-2 text-sm rounded-lg border bg-background"><option value="retry">重试</option><option value="skip">跳过</option><option value="abort">中止</option><option value="fallback">默认值</option></select></div>}

      {d.type !== "start" && (
        <button onClick={onDelete} className="w-full py-2.5 border border-red-200 dark:border-red-900 text-red-500 rounded-lg text-xs font-medium hover:bg-red-50 dark:hover:bg-red-950/20 flex items-center justify-center gap-1.5 mt-2">
          <Trash2 className="w-3.5 h-3.5" /> 删除节点
        </button>
      )}
    </div>
  );

  // 移动端：底部抽屉
  if (mobile) return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl max-h-[75vh] flex flex-col shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center pt-2 pb-1"><div className="w-8 h-1 bg-muted-foreground/20 rounded-full" /></div>
        <div className="px-4 py-2 border-b flex items-center justify-between">
          <div className="flex items-center gap-2"><span className="text-lg">{info?.icon}</span><span className="text-sm font-bold">{info?.label}</span></div>
          <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg"><X className="w-4 h-4" /></button>
        </div>
        {content}
      </div>
    </div>
  );

  // 桌面：右侧面板
  return (
    <div className="w-80 border-l bg-background h-full flex flex-col flex-shrink-0">
      <div className="px-4 py-3 border-b flex items-center justify-between sticky top-0 bg-background z-10">
        <div className="flex items-center gap-2"><span className="text-lg">{info?.icon}</span><span className="text-sm font-bold">{info?.label}</span></div>
        <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button>
      </div>
      {content}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 4. 添加面板（移动端底部抽屉/桌面左上浮层）
// ═══════════════════════════════════════════════════════════════════

function AddPanel({ onAdd, onClose }: { onAdd: (t: WorkflowNodeType) => void; onClose: () => void }) {
  const cats = [{ key: "trigger", label: "触发", icon: "▶" }, { key: "ai", label: "AI", icon: "🧠" }, { key: "tool", label: "工具", icon: "🔧" }, { key: "logic", label: "逻辑", icon: "🔀" }, { key: "data", label: "数据", icon: "📦" }, { key: "output", label: "输出", icon: "📤" }];
  const mobile = isMobile();

  const list = (
    <div className="p-2 max-h-[60vh] sm:max-h-[400px] overflow-y-auto">
      {cats.map(cat => {
        const items = NODE_REGISTRY.filter(n => n.category === cat.key);
        if (!items.length) return null;
        return (<div key={cat.key} className="mb-1.5">
          <p className="text-[10px] font-bold text-muted-foreground uppercase px-2 py-1">{cat.icon} {cat.label}</p>
          {items.map(item => <button key={item.type} onClick={() => { onAdd(item.type); onClose(); }} className="w-full text-left px-3 py-2.5 rounded-lg hover:bg-muted active:bg-muted flex items-center gap-2.5">
            <span className="text-base">{item.icon}</span><div><p className="text-xs font-medium">{item.label}</p><p className="text-[10px] text-muted-foreground">{item.description}</p></div>
          </button>)}
        </div>);
      })}
    </div>
  );

  if (mobile) return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <div className="absolute bottom-0 left-0 right-0 bg-background rounded-t-2xl shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-center pt-2 pb-1"><div className="w-8 h-1 bg-muted-foreground/20 rounded-full" /></div>
        <div className="px-4 py-2 border-b flex items-center justify-between"><span className="text-sm font-bold">添加节点</span><button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button></div>
        {list}
      </div>
    </div>
  );

  return (
    <div className="absolute left-4 top-14 bg-background border rounded-2xl shadow-xl w-60 z-40 overflow-hidden">
      <div className="px-4 py-3 border-b flex items-center justify-between"><span className="text-sm font-bold">添加节点</span><button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-4 h-4" /></button></div>
      {list}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 5. NL 创建对话框
// ═══════════════════════════════════════════════════════════════════

function NLDialog({ onCreated, onClose }: { onCreated: (g: SerializedWorkflow, t: string, d: string, c: string, i: string) => void; onClose: () => void }) {
  const [desc, setDesc] = useState("");
  const nlMut = trpc.playbook.nlToWorkflow.useMutation({ onSuccess: (r: any) => { onCreated(r.graph, r.title, r.description, r.category, r.icon); onClose(); } });
  const examples = ["每天早上搜索 AI 新闻，总结后推送飞书", "监控网页价格变化，低于阈值通知", "登录论坛搜索热帖并自动回复"];
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4" onClick={onClose}>
      <div className="bg-background rounded-t-2xl sm:rounded-2xl border shadow-2xl w-full sm:max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="px-5 sm:px-6 py-4 border-b flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center flex-shrink-0"><Wand2 className="w-4 h-4 sm:w-5 sm:h-5 text-white" /></div>
          <div><h3 className="text-sm sm:text-base font-bold">AI 生成工作流</h3><p className="text-[11px] sm:text-xs text-muted-foreground">描述任务，AI 帮你搭建</p></div>
        </div>
        <div className="p-5 sm:p-6 space-y-4">
          <textarea value={desc} onChange={e => setDesc(e.target.value)} placeholder="描述你想自动化的任务..." className="w-full px-4 py-3 text-sm rounded-xl border bg-background h-24 sm:h-28 resize-none" autoFocus />
          <div><p className="text-xs text-muted-foreground mb-2">试试这些：</p>{examples.map((ex, i) => <button key={i} onClick={() => setDesc(ex)} className="w-full text-left px-3 py-2.5 rounded-lg border border-dashed hover:border-primary hover:bg-primary/5 active:bg-primary/10 text-xs mb-1.5">{ex}</button>)}</div>
        </div>
        <div className="px-5 sm:px-6 py-4 border-t flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2.5 text-sm border rounded-lg hover:bg-muted">取消</button>
          <button onClick={() => nlMut.mutate({ description: desc })} disabled={!desc.trim() || nlMut.isPending} className="px-5 sm:px-6 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
            {nlMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} {nlMut.isPending ? "生成中..." : "生成"}
          </button>
        </div>
        {nlMut.error && <div className="px-5 pb-4"><p className="text-xs text-red-500">{nlMut.error.message}</p></div>}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 6. 调试面板
// ═══════════════════════════════════════════════════════════════════

function DebugPanel({ nodes, debugLog, isRunning, onStep, onAll, onReset, onClose }: {
  nodes: CanvasNode[]; debugLog: Array<{ nodeId: string; status: string; output?: any; error?: string; duration?: number }>;
  isRunning: boolean; onStep: () => void; onAll: () => void; onReset: () => void; onClose: () => void;
}) {
  return (
    <div className={cn("bg-background border-t sm:border-l sm:border-t-0 shadow-xl z-30 flex flex-col",
      "fixed bottom-0 left-0 right-0 h-64 sm:absolute sm:right-0 sm:bottom-0 sm:left-auto sm:w-96 sm:h-72 sm:rounded-tl-2xl"
    )}>
      <div className="px-4 py-2.5 border-b flex items-center justify-between">
        <div className="flex items-center gap-2"><Bug className="w-4 h-4 text-amber-500" /><span className="text-xs font-bold">调试</span>{isRunning && <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-500" />}</div>
        <div className="flex items-center gap-1">
          <button onClick={onStep} disabled={isRunning} className="px-2.5 py-1 bg-blue-500 text-white rounded text-[10px] font-medium disabled:opacity-50">单步</button>
          <button onClick={onAll} disabled={isRunning} className="px-2.5 py-1 bg-green-500 text-white rounded text-[10px] font-medium disabled:opacity-50">全部</button>
          <button onClick={onReset} className="px-2.5 py-1 border rounded text-[10px] hover:bg-muted">重置</button>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded"><X className="w-3.5 h-3.5" /></button>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
        {debugLog.length === 0 ? <p className="text-xs text-muted-foreground text-center py-6">点击「单步」开始调试</p> :
          debugLog.map((l, i) => {
            const label = nodes.find(n => n.id === l.nodeId)?.data.label || l.nodeId;
            return (<div key={i} className={cn("px-3 py-2 rounded-lg border text-xs", l.status === "success" ? "border-green-200 bg-green-50/50 dark:bg-green-950/20" : l.status === "error" ? "border-red-200 bg-red-50/50 dark:bg-red-950/20" : "border-blue-200 bg-blue-50/50 dark:bg-blue-950/20")}>
              <div className="flex items-center justify-between"><span className="font-medium">{label}</span><div className="flex items-center gap-2">{l.duration != null && <span className="text-[10px] text-muted-foreground">{l.duration}ms</span>}{l.status === "success" ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : l.status === "error" ? <XCircle className="w-3.5 h-3.5 text-red-500" /> : <Loader2 className="w-3.5 h-3.5 text-blue-500 animate-spin" />}</div></div>
              {l.output && <p className="text-[10px] text-muted-foreground mt-1 font-mono truncate">{JSON.stringify(l.output).substring(0, 80)}</p>}
              {l.error && <p className="text-[10px] text-red-500 mt-1">{l.error}</p>}
            </div>);
          })
        }
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// 7. 主画布
// ═══════════════════════════════════════════════════════════════════

interface WorkflowCanvasProps { playbookId?: string; onSaved: (id: string) => void; onBack: () => void; }

export function WorkflowCanvas({ playbookId, onSaved, onBack }: WorkflowCanvasProps) {
  const [pan, setPan] = useState({ x: 50, y: 30 });
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);

  const [nodes, setNodes] = useState<CanvasNode[]>([{ id: "start_1", type: "start", position: { x: 300, y: 50 }, data: { label: "开始", type: "start", config: {}, triggerType: "manual", parameters: [] } }]);
  const [edges, setEdges] = useState<CanvasEdge[]>([]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [showNL, setShowNL] = useState(false);
  const [showDebug, setShowDebug] = useState(false);
  const [showMeta, setShowMeta] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);
  const nodeIdCounter = useRef(10);

  const [title, setTitle] = useState("未命名工作流");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [icon, setIcon] = useState("🤖");
  const [tags, setTags] = useState("");
  const [price, setPrice] = useState(0);

  const [debugLog, setDebugLog] = useState<Array<{ nodeId: string; status: string; output?: any; error?: string; duration?: number }>>([]);
  const debugLogRef = useRef(debugLog);
  const [isDebugging, setIsDebugging] = useState(false);
  const setDebugLogSync = useCallback((u: ((p: typeof debugLog) => typeof debugLog) | typeof debugLog) => { setDebugLog(prev => { const next = typeof u === "function" ? u(prev) : u; debugLogRef.current = next; return next; }); }, []);

  const dragRef = useRef<{ nodeId: string; startX: number; startY: number; nx: number; ny: number } | null>(null);
  const panRef = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const [tempEdge, setTempEdge] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const connectRef = useRef<{ sourceId: string; sourceHandle?: string; x1: number; y1: number } | null>(null);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedId) || null, [nodes, selectedId]);

  // ── 加载 ──
  const detailQ = trpc.playbook.detail.useQuery({ id: playbookId! }, { enabled: !!playbookId });
  useEffect(() => {
    if (!detailQ.data) return;
    const pb = detailQ.data as any;
    setTitle(pb.title || ""); setDescription(pb.description || ""); setCategory(pb.category || "general");
    setIcon(pb.icon || "🤖"); setTags((pb.tags || []).join(", ")); setPrice(parseFloat(pb.price) || 0);
    const g = pb.defaultConfig?.graph;
    if (g?.nodes?.length) { setNodes(g.nodes); setEdges(g.edges || []); nodeIdCounter.current = extractMaxNodeId(g) + 1; }
    else if (pb.steps?.length) { const c = stepsToGraph(pb.steps, pb.parameters || []); setNodes(c.nodes); setEdges(c.edges); nodeIdCounter.current = extractMaxNodeId(c) + 1; }
  }, [detailQ.data]);

  // ── 滚轮缩放 ──
  const onWheel = useCallback((e: React.WheelEvent) => { e.preventDefault(); setZoom(z => Math.min(2, Math.max(0.15, z * (e.deltaY > 0 ? 0.92 : 1.08)))); }, []);

  // ── 指针事件（统一 mouse + touch）──
  const screenToCanvas = useCallback((clientX: number, clientY: number) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: (clientX - rect.left - pan.x) / zoom, y: (clientY - rect.top - pan.y) / zoom };
  }, [pan, zoom]);

  const onCanvasPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.target !== canvasRef.current && !(e.target as HTMLElement).classList.contains("canvas-bg")) return;
    setSelectedId(null);
    panRef.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }, [pan]);

  const onNodePointerDown = useCallback((e: React.PointerEvent, nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    dragRef.current = { nodeId, startX: e.clientX, startY: e.clientY, nx: node.position.x, ny: node.position.y };
    setDraggingId(nodeId);
  }, [nodes]);

  const onHandlePointerDown = useCallback((e: React.PointerEvent, nodeId: string, handleId?: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node) return;
    const pos = getHandlePos(node, "source", handleId);
    connectRef.current = { sourceId: nodeId, sourceHandle: handleId, x1: pos.x, y1: pos.y };
  }, [nodes]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (dragRef.current) {
        const d = dragRef.current;
        setNodes(prev => prev.map(n => n.id === d.nodeId ? { ...n, position: { x: d.nx + (e.clientX - d.startX) / zoom, y: d.ny + (e.clientY - d.startY) / zoom } } : n));
      }
      if (panRef.current) {
        const d = panRef.current;
        setPan({ x: d.px + (e.clientX - d.sx), y: d.py + (e.clientY - d.sy) });
      }
      if (connectRef.current) {
        const c = screenToCanvas(e.clientX, e.clientY);
        setTempEdge({ x1: connectRef.current.x1, y1: connectRef.current.y1, x2: c.x, y2: c.y });
      }
    };
    const onUp = (e: PointerEvent) => {
      if (connectRef.current) {
        const c = screenToCanvas(e.clientX, e.clientY);
        const src = connectRef.current;
        let best: CanvasNode | null = null, bestD = 35;
        for (const n of nodes) {
          if (n.id === src.sourceId || n.data.type === "start") continue;
          const tp = getHandlePos(n, "target");
          const dist = Math.hypot(c.x - tp.x, c.y - tp.y);
          if (dist < bestD) { bestD = dist; best = n; }
        }
        if (best && !edges.some(ed => ed.source === src.sourceId && ed.target === best!.id && ed.sourceHandle === src.sourceHandle)) {
          const lbl = nodes.find(n => n.id === src.sourceId)?.data.type === "condition" ? (src.sourceHandle === "true" ? "✓ 是" : src.sourceHandle === "false" ? "✗ 否" : undefined) : undefined;
          setEdges(prev => [...prev, { id: `e_${src.sourceId}_${best!.id}_${Date.now()}`, source: src.sourceId, target: best!.id, sourceHandle: src.sourceHandle, label: lbl }]);
        }
        setTempEdge(null); connectRef.current = null;
      }
      dragRef.current = null; panRef.current = null; setDraggingId(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => { window.removeEventListener("pointermove", onMove); window.removeEventListener("pointerup", onUp); };
  }, [nodes, edges, zoom, screenToCanvas]);

  // ── 双指缩放（touch） ──
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        e.preventDefault();
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        pinchRef.current = { dist: d, zoom };
      }
    };
    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 2 && pinchRef.current) {
        e.preventDefault();
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
        setZoom(Math.min(2, Math.max(0.15, pinchRef.current.zoom * (d / pinchRef.current.dist))));
      }
    };
    const onTouchEnd = () => { pinchRef.current = null; };
    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);
    return () => { el.removeEventListener("touchstart", onTouchStart); el.removeEventListener("touchmove", onTouchMove); el.removeEventListener("touchend", onTouchEnd); };
  }, [zoom]);

  // ── 操作 ──
  const addNode = useCallback((type: WorkflowNodeType) => {
    const info = getNodeTypeInfo(type); if (!info) return;
    nodeIdCounter.current++;
    const cx = canvasRef.current ? (canvasRef.current.clientWidth / 2 - pan.x) / zoom : 300;
    const cy = canvasRef.current ? (canvasRef.current.clientHeight / 2 - pan.y) / zoom : 200;
    setNodes(prev => [...prev, { id: `${type}_${nodeIdCounter.current}`, type, position: { x: cx - NODE_W / 2, y: cy }, data: { ...info.defaultData, label: info.label } as WorkflowNodeData }]);
    setSelectedId(`${type}_${nodeIdCounter.current}`);
  }, [pan, zoom]);

  const updateNodeData = useCallback((id: string, u: Partial<WorkflowNodeData>) => { setNodes(prev => prev.map(n => n.id === id ? { ...n, data: { ...n.data, ...u } } : n)); }, []);
  const deleteSelected = useCallback(() => {
    if (!selectedId || nodes.find(n => n.id === selectedId)?.data.type === "start") return;
    setNodes(p => p.filter(n => n.id !== selectedId)); setEdges(p => p.filter(e => e.source !== selectedId && e.target !== selectedId)); setSelectedId(null);
  }, [selectedId, nodes]);
  const deleteEdge = useCallback((id: string) => { if (confirm("删除此连线？")) setEdges(p => p.filter(e => e.id !== id)); }, []);

  // ── 保存 ──
  const createMut = trpc.playbook.create.useMutation({ onSuccess: (r) => { setSaveToast("创建成功"); setTimeout(() => setSaveToast(null), 2000); onSaved(r.id); } });
  const updateMut = trpc.playbook.update.useMutation({ onSuccess: () => { setSaveToast("保存成功"); setTimeout(() => setSaveToast(null), 2000); onSaved(playbookId!); } });
  const isSaving = createMut.isPending || updateMut.isPending;
  const handleSave = useCallback(() => {
    const clean = (d: any) => { const { _debugStatus, _debugOutput, _debugError, _debugDuration, ...r } = d; return r; };
    const graph: SerializedWorkflow = { nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: clean(n.data) })), edges, version: 2 };
    const { steps, parameters } = graphToSteps(graph);
    const payload = { title, description, category, icon, steps, parameters, tags: tags.split(",").map(t => t.trim()).filter(Boolean), isPublic: false, price, defaultConfig: { graph } };
    playbookId ? updateMut.mutate({ id: playbookId, ...payload }) : createMut.mutate(payload);
  }, [nodes, edges, title, description, category, icon, tags, price, playbookId]);

  const handleNL = useCallback((g: SerializedWorkflow, t: string, d: string, c: string, ic: string) => {
    setNodes(g.nodes); setEdges(g.edges || []); setTitle(t); setDescription(d); setCategory(c); setIcon(ic);
    nodeIdCounter.current = extractMaxNodeId(g) + 1;
  }, []);

  // ── 调试 ──
  const debugMut = trpc.playbook.debugStep.useMutation();
  const runStep = useCallback(async () => {
    const log = debugLogRef.current; const done = new Set(log.filter(l => l.status === "success").map(l => l.nodeId));
    let next: string | null = null;
    for (const n of nodes) { if (!done.has(n.id) && n.data.type === "start") { next = n.id; break; } }
    if (!next) { for (const n of nodes) { if (done.has(n.id)) continue; const ps = edges.filter(e => e.target === n.id).map(e => e.source); if (ps.length > 0 && ps.every(p => done.has(p))) { next = n.id; break; } } }
    if (!next) return false;
    const tid = next; setIsDebugging(true); updateNodeData(tid, { _debugStatus: "running" });
    setDebugLogSync(p => [...p, { nodeId: tid, status: "running" }]);
    try {
      const graph: SerializedWorkflow = { nodes: nodes.map(n => ({ id: n.id, type: n.type, position: n.position, data: n.data })), edges, version: 2 };
      const prev = log.filter(l => l.status === "success").reduce((a, l) => ({ ...a, [l.nodeId]: l.output }), {} as Record<string, any>);
      const res: any = await debugMut.mutateAsync({ playbookId, nodeId: tid, graph, previousOutputs: prev });
      const st = res.success ? "success" : "error";
      updateNodeData(tid, { _debugStatus: st, _debugOutput: res.output, _debugError: res.error, _debugDuration: res.duration });
      setDebugLogSync(p => p.map(l => l.nodeId === tid && l.status === "running" ? { ...l, status: st, output: res.output, error: res.error, duration: res.duration } : l));
    } catch (e: any) {
      updateNodeData(tid, { _debugStatus: "error", _debugError: e.message });
      setDebugLogSync(p => p.map(l => l.nodeId === tid && l.status === "running" ? { ...l, status: "error", error: e.message } : l));
      setIsDebugging(false); return false;
    }
    setIsDebugging(false); return true;
  }, [nodes, edges, playbookId, updateNodeData]);
  const runAll = useCallback(async () => { resetDebug(); await new Promise(r => setTimeout(r, 50)); setIsDebugging(true); for (let i = 0; i < nodes.length; i++) { if (!(await runStep())) break; await new Promise(r => setTimeout(r, 200)); } setIsDebugging(false); }, [nodes.length, runStep]);
  const resetDebug = useCallback(() => { debugLogRef.current = []; setDebugLog([]); setNodes(ns => ns.map(n => ({ ...n, data: { ...n.data, _debugStatus: undefined as any, _debugOutput: undefined, _debugError: undefined, _debugDuration: undefined } }))); }, []);

  // ── 快捷键 ──
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const t = document.activeElement?.tagName;
      if (t === "INPUT" || t === "TEXTAREA" || t === "SELECT" || (document.activeElement as HTMLElement)?.isContentEditable) return;
      if (e.key === "Delete" || e.key === "Backspace") deleteSelected();
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, [deleteSelected, handleSave]);

  const zoomIn = () => setZoom(z => Math.min(2, z * 1.2));
  const zoomOut = () => setZoom(z => Math.max(0.15, z / 1.2));
  const fitView = useCallback(() => {
    if (!nodes.length || !canvasRef.current) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of nodes) { minX = Math.min(minX, n.position.x); minY = Math.min(minY, n.position.y); maxX = Math.max(maxX, n.position.x + NODE_W); maxY = Math.max(maxY, n.position.y + NODE_H); }
    const cw = canvasRef.current.clientWidth, ch = canvasRef.current.clientHeight;
    const pad = 60; const bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2;
    const z = Math.min(cw / bw, ch / bh, 1.5);
    setZoom(z); setPan({ x: (cw - bw * z) / 2 - minX * z + pad * z, y: (ch - bh * z) / 2 - minY * z + pad * z });
  }, [nodes]);

  const mobile = isMobile();

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-background">
      {/* ═══ 工具栏 ═══ */}
      <div className="h-12 sm:h-14 border-b px-2 sm:px-4 flex items-center justify-between bg-background/80 backdrop-blur-sm z-20 flex-shrink-0 gap-1">
        <div className="flex items-center gap-1.5 sm:gap-3 min-w-0">
          <button onClick={onBack} className="p-2 hover:bg-muted rounded-lg flex-shrink-0"><ArrowLeft className="w-4 h-4" /></button>
          <span className="text-base sm:text-lg flex-shrink-0">{icon}</span>
          <input value={title} onChange={e => setTitle(e.target.value)} className="text-xs sm:text-sm font-bold bg-transparent border-none outline-none min-w-0 w-24 sm:w-48" placeholder="工作流名称" />
          <button onClick={() => setShowMeta(!showMeta)} className="p-1.5 hover:bg-muted rounded-lg flex-shrink-0 hidden sm:block"><Settings className="w-4 h-4 text-muted-foreground" /></button>
        </div>
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          <button onClick={() => setShowNL(true)} className="p-2 sm:px-3 sm:py-1.5 text-xs font-medium flex items-center gap-1.5 border rounded-lg hover:bg-muted" title="AI 生成">
            <Wand2 className="w-3.5 h-3.5 text-violet-500" /><span className="hidden sm:inline">AI 生成</span>
          </button>
          <button onClick={() => setShowDebug(!showDebug)} className={cn("p-2 sm:px-3 sm:py-1.5 text-xs font-medium flex items-center gap-1.5 rounded-lg", showDebug ? "bg-amber-100 text-amber-700 border border-amber-200" : "border hover:bg-muted")} title="调试">
            <Bug className="w-3.5 h-3.5" /><span className="hidden sm:inline">调试</span>
          </button>
          <button onClick={() => setShowMeta(!showMeta)} className="p-2 border rounded-lg hover:bg-muted sm:hidden" title="设置"><Settings className="w-3.5 h-3.5" /></button>
          <button onClick={handleSave} disabled={isSaving} className="px-3 sm:px-4 py-2 sm:py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1.5 hover:opacity-90 disabled:opacity-50 shadow-sm">
            {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}<span className="hidden sm:inline">保存</span>
          </button>
        </div>
      </div>

      {/* ═══ 元数据 ═══ */}
      {showMeta && (
        <div className="border-b px-3 sm:px-4 py-3 bg-muted/30 flex-shrink-0">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
              <div className="flex items-center gap-1.5"><label className="text-xs text-muted-foreground">分类</label><select value={category} onChange={e => setCategory(e.target.value)} className="px-2 py-1.5 text-xs rounded border bg-background">{["general", "research", "content", "monitor", "code", "data", "devops", "forum"].map(c => <option key={c}>{c}</option>)}</select></div>
              <div className="flex items-center gap-1.5"><label className="text-xs text-muted-foreground">标签</label><input value={tags} onChange={e => setTags(e.target.value)} placeholder="逗号分隔" className="px-2 py-1.5 text-xs rounded border bg-background w-24 sm:w-32" /></div>
              <div className="flex items-center gap-1.5"><label className="text-xs text-muted-foreground">价格</label><input type="number" value={price} onChange={e => setPrice(+e.target.value)} min={0} className="px-2 py-1.5 text-xs rounded border bg-background w-14 sm:w-16" /> 🐟</div>
            </div>
            <div className="flex items-center gap-1.5 flex-1"><label className="text-xs text-muted-foreground flex-shrink-0">描述</label><input value={description} onChange={e => setDescription(e.target.value)} placeholder="功能描述" className="px-2 py-1.5 text-xs rounded border bg-background flex-1" /></div>
          </div>
        </div>
      )}

      {/* ═══ 主体 ═══ */}
      <div className="flex-1 flex relative overflow-hidden">
        <div className="flex-1 relative overflow-hidden">
          <div ref={canvasRef} className="w-full h-full overflow-hidden cursor-grab active:cursor-grabbing relative touch-none"
            onPointerDown={onCanvasPointerDown} onWheel={onWheel}>
            <div className="canvas-bg absolute inset-0" style={{ backgroundImage: "radial-gradient(circle, var(--color-muted-foreground) 0.8px, transparent 0.8px)", backgroundSize: `${20 * zoom}px ${20 * zoom}px`, backgroundPosition: `${pan.x % (20 * zoom)}px ${pan.y % (20 * zoom)}px`, opacity: 0.12 }} />
            <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "0 0", position: "absolute", top: 0, left: 0 }}>
              <EdgesSVG edges={edges} nodes={nodes} tempEdge={tempEdge} onEdgeClick={deleteEdge} />
              {nodes.map(n => <NodeView key={n.id} node={n} selected={selectedId === n.id} isDragging={draggingId === n.id}
                onPointerDown={onNodePointerDown} onHandlePointerDown={onHandlePointerDown} onClick={id => setSelectedId(id)} />)}
            </div>
          </div>

          {/* 左上：添加 */}
          <div className="absolute left-3 sm:left-4 top-3 sm:top-4 z-20">
            <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-1.5 px-3 py-2 bg-primary text-primary-foreground rounded-xl text-xs font-medium shadow-lg hover:opacity-90 active:scale-95">
              <Plus className="w-4 h-4" /><span className="hidden sm:inline">添加节点</span>
            </button>
          </div>
          {showAdd && <AddPanel onAdd={addNode} onClose={() => setShowAdd(false)} />}

          {/* 左下：缩放 */}
          <div className="absolute left-3 sm:left-4 bottom-3 sm:bottom-4 z-20 flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center gap-0.5 bg-background/80 backdrop-blur-sm border rounded-lg shadow-sm">
              <button onClick={zoomOut} className="p-1.5 hover:bg-muted rounded-l-lg"><ZoomOut className="w-3.5 h-3.5" /></button>
              <span className="text-[10px] text-muted-foreground w-8 sm:w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button onClick={zoomIn} className="p-1.5 hover:bg-muted"><ZoomIn className="w-3.5 h-3.5" /></button>
              <button onClick={fitView} className="p-1.5 hover:bg-muted rounded-r-lg"><Maximize2 className="w-3.5 h-3.5" /></button>
            </div>
            <div className="hidden sm:block px-2.5 py-1.5 bg-background/80 backdrop-blur-sm border rounded-lg text-[10px] text-muted-foreground">{nodes.length} 节点 · {edges.length} 连线</div>
          </div>

          {showDebug && <DebugPanel nodes={nodes} debugLog={debugLog} isRunning={isDebugging} onStep={runStep} onAll={runAll} onReset={resetDebug} onClose={() => setShowDebug(false)} />}
        </div>

        {/* 桌面端右侧配置 */}
        {selectedNode && !mobile && <ConfigPanel node={selectedNode} allNodes={nodes} onUpdate={updateNodeData} onClose={() => setSelectedId(null)} onDelete={deleteSelected} />}
      </div>

      {/* 移动端底部配置 */}
      {selectedNode && mobile && <ConfigPanel node={selectedNode} allNodes={nodes} onUpdate={updateNodeData} onClose={() => setSelectedId(null)} onDelete={deleteSelected} />}

      {showNL && <NLDialog onCreated={handleNL} onClose={() => setShowNL(false)} />}

      {(createMut.error || updateMut.error) && <div className="absolute bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-red-500 text-white rounded-lg text-sm shadow-lg z-50">{createMut.error?.message || updateMut.error?.message}</div>}
      {saveToast && <div className="absolute bottom-16 sm:bottom-4 left-1/2 -translate-x-1/2 px-4 py-2 bg-green-500 text-white rounded-lg text-sm shadow-lg z-50 flex items-center gap-1.5"><CheckCircle className="w-4 h-4" /> {saveToast}</div>}
    </div>
  );
}
