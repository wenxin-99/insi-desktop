/**
 * workflowTypes.ts — 可视化工作流类型定义
 *
 * 覆盖：节点类型、边类型、变量系统、调试状态
 */

// ═══════════ 节点类型系统 ═══════════

export type WorkflowNodeType =
  | "start"           // 开始/触发节点
  | "llm"             // LLM 调用节点
  | "tool"            // 工具节点（搜索、浏览器、SSH、HTTP）
  | "code"            // 代码执行节点（JS/Python）
  | "condition"       // 条件分支节点
  | "loop"            // 循环节点
  | "output"          // 输出/结束节点
  | "template"        // 文本模板节点
  | "variable";       // 变量赋值节点

/** 节点基础数据 */
export interface WorkflowNodeData {
  label: string;
  type: WorkflowNodeType;
  config: Record<string, any>;

  // ── 各类型专有配置 ──

  // start
  triggerType?: "manual" | "cron" | "webhook" | "channel";
  cronExpression?: string;
  parameters?: WorkflowParam[];  // 用户输入参数

  // llm
  model?: string;
  systemPrompt?: string;
  userPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  outputFormat?: "text" | "json" | "markdown";

  // tool
  toolId?: string;
  toolCategory?: string;
  paramTemplate?: Record<string, any>;

  // code
  language?: "javascript" | "python";
  code?: string;
  inputVars?: string[];
  outputVars?: string[];

  // condition
  conditionField?: string;
  conditionOp?: "eq" | "neq" | "gt" | "lt" | "contains" | "regex" | "empty" | "not_empty";
  conditionValue?: string;
  conditionExpression?: string; // 高级：自定义表达式

  // loop
  loopSource?: string;  // 引用的数组变量
  loopMaxIter?: number;
  loopItemVar?: string; // 循环变量名

  // template
  templateText?: string;

  // output
  outputMode?: "channel" | "api" | "variable" | "file";
  channelTitle?: string;

  // 通用
  onError?: "retry" | "skip" | "abort" | "fallback";
  retryCount?: number;
  timeout?: number;      // 秒
  description?: string;  // 节点描述

  // 调试
  _debugStatus?: "idle" | "running" | "success" | "error" | "skipped";
  _debugOutput?: any;
  _debugError?: string;
  _debugDuration?: number;
}

/** 用户输入参数 */
export interface WorkflowParam {
  key: string;
  label: string;
  type: "string" | "number" | "url" | "select" | "textarea" | "boolean" | "cron" | "file";
  required: boolean;
  default?: string;
  placeholder?: string;
  options?: string[];
  validation?: string;
  description?: string;
}

// ═══════════ 变量系统 ═══════════

/** 变量引用：{{nodeId.outputKey}} */
export interface VariableRef {
  nodeId: string;
  nodeLabel: string;
  outputKey: string;
  outputType: "string" | "number" | "boolean" | "object" | "array" | "any";
}

/** 获取节点的输出变量声明 */
export function getNodeOutputVars(nodeType: WorkflowNodeType, data: WorkflowNodeData): Array<{ key: string; type: string }> {
  switch (nodeType) {
    case "start":
      return (data.parameters || []).map(p => ({ key: p.key, type: p.type }));
    case "llm":
      return [
        { key: "text", type: "string" },
        { key: "usage", type: "object" },
      ];
    case "tool":
      return [
        { key: "result", type: "any" },
        { key: "success", type: "boolean" },
        { key: "error", type: "string" },
      ];
    case "code":
      return (data.outputVars || ["result"]).map(k => ({ key: k, type: "any" }));
    case "condition":
      return [{ key: "branch", type: "string" }]; // "true" | "false"
    case "loop":
      return [
        { key: "items", type: "array" },
        { key: "index", type: "number" },
        { key: data.loopItemVar || "item", type: "any" },
      ];
    case "template":
      return [{ key: "text", type: "string" }];
    case "variable":
      return Object.keys(data.config || {}).map(k => ({ key: k, type: "any" }));
    default:
      return [{ key: "output", type: "any" }];
  }
}

// ═══════════ 节点注册表 ═══════════

export interface NodeTypeInfo {
  type: WorkflowNodeType;
  label: string;
  icon: string;
  color: string;       // Tailwind border/accent color
  bgColor: string;     // Tailwind bg color
  category: "trigger" | "ai" | "tool" | "logic" | "data" | "output";
  description: string;
  defaultData: Partial<WorkflowNodeData>;
  maxInputs: number;   // 0 = trigger
  maxOutputs: number;  // 0 = end
}

export const NODE_REGISTRY: NodeTypeInfo[] = [
  {
    type: "start", label: "开始", icon: "▶", color: "border-emerald-400", bgColor: "bg-emerald-50 dark:bg-emerald-950/40",
    category: "trigger", description: "工作流入口，定义触发方式和输入参数",
    defaultData: { label: "开始", type: "start", config: {}, triggerType: "manual", parameters: [] },
    maxInputs: 0, maxOutputs: 1,
  },
  {
    type: "llm", label: "大模型", icon: "🧠", color: "border-violet-400", bgColor: "bg-violet-50 dark:bg-violet-950/40",
    category: "ai", description: "调用 LLM 生成文本、分析、总结",
    defaultData: { label: "LLM 调用", type: "llm", config: {}, model: "qwen-plus", temperature: 0.7, maxTokens: 2000, outputFormat: "text" },
    maxInputs: 5, maxOutputs: 1,
  },
  {
    type: "tool", label: "工具", icon: "🔧", color: "border-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/40",
    category: "tool", description: "调用工具：搜索、浏览器、SSH、HTTP 请求",
    defaultData: { label: "工具", type: "tool", config: {}, toolId: "web.search", paramTemplate: {} },
    maxInputs: 5, maxOutputs: 1,
  },
  {
    type: "code", label: "代码", icon: "💻", color: "border-amber-400", bgColor: "bg-amber-50 dark:bg-amber-950/40",
    category: "data", description: "执行 JavaScript 或 Python 代码",
    defaultData: { label: "代码", type: "code", config: {}, language: "javascript", code: "// 输入: input\n// 输出: return result\nreturn { result: input };", inputVars: ["input"], outputVars: ["result"] },
    maxInputs: 5, maxOutputs: 1,
  },
  {
    type: "condition", label: "条件", icon: "🔀", color: "border-orange-400", bgColor: "bg-orange-50 dark:bg-orange-950/40",
    category: "logic", description: "根据条件走不同分支",
    defaultData: { label: "条件判断", type: "condition", config: {}, conditionOp: "eq" },
    maxInputs: 1, maxOutputs: 2,  // true + false
  },
  {
    type: "loop", label: "循环", icon: "🔄", color: "border-cyan-400", bgColor: "bg-cyan-50 dark:bg-cyan-950/40",
    category: "logic", description: "遍历数组或重复执行",
    defaultData: { label: "循环", type: "loop", config: {}, loopMaxIter: 10, loopItemVar: "item" },
    maxInputs: 1, maxOutputs: 1,
  },
  {
    type: "template", label: "文本模板", icon: "📝", color: "border-teal-400", bgColor: "bg-teal-50 dark:bg-teal-950/40",
    category: "data", description: "模板文本，支持变量插值",
    defaultData: { label: "文本模板", type: "template", config: {}, templateText: "" },
    maxInputs: 5, maxOutputs: 1,
  },
  {
    type: "variable", label: "变量", icon: "📦", color: "border-slate-400", bgColor: "bg-slate-50 dark:bg-slate-950/40",
    category: "data", description: "设置或转换变量",
    defaultData: { label: "变量", type: "variable", config: {} },
    maxInputs: 5, maxOutputs: 1,
  },
  {
    type: "output", label: "输出", icon: "📤", color: "border-rose-400", bgColor: "bg-rose-50 dark:bg-rose-950/40",
    category: "output", description: "工作流结束，输出结果或推送通知",
    defaultData: { label: "输出", type: "output", config: {}, outputMode: "channel" },
    maxInputs: 5, maxOutputs: 0,
  },
];

export function getNodeTypeInfo(type: WorkflowNodeType): NodeTypeInfo | undefined {
  return NODE_REGISTRY.find(n => n.type === type);
}

// ═══════════ 工具子类 ═══════════

export const TOOL_CATEGORIES = [
  {
    category: "search", label: "搜索", icon: "🔍",
    tools: [
      { id: "web.search", label: "网页搜索" },
      { id: "web.fetch", label: "网页抓取" },
      { id: "web.browse", label: "网页浏览" },
    ],
  },
  {
    category: "browser", label: "浏览器", icon: "🌐",
    tools: [
      { id: "browser.navigate", label: "导航" },
      { id: "browser.click", label: "点击" },
      { id: "browser.click_text", label: "点击文本" },
      { id: "browser.type", label: "输入" },
      { id: "browser.scroll", label: "滚动" },
      { id: "browser.submit", label: "提交" },
      { id: "browser.generate_content", label: "生成内容" },
      { id: "browser.screenshot", label: "截图" },
    ],
  },
  {
    category: "shell", label: "Shell", icon: "⌨️",
    tools: [
      { id: "shell.exec", label: "本地执行" },
      { id: "shell.exec_remote", label: "远程 SSH" },
    ],
  },
  {
    category: "file", label: "文件", icon: "📁",
    tools: [
      { id: "file.read", label: "读取" },
      { id: "file.write", label: "写入" },
      { id: "file.list", label: "列表" },
      { id: "file.patch", label: "修改" },
    ],
  },
  {
    category: "http", label: "HTTP", icon: "🔗",
    tools: [
      { id: "http.get", label: "GET 请求" },
      { id: "http.post", label: "POST 请求" },
      { id: "http.put", label: "PUT 请求" },
      { id: "http.delete", label: "DELETE 请求" },
    ],
  },
  {
    category: "system", label: "系统", icon: "⚙️",
    tools: [
      { id: "system.think", label: "思考" },
      { id: "system.done", label: "完成" },
      { id: "system.ask_user", label: "询问用户" },
    ],
  },
];

// ═══════════ 序列化：Graph ↔ Steps (兼容旧格式) ═══════════

export interface SerializedWorkflow {
  nodes: Array<{ id: string; type: string; position: { x: number; y: number }; data: WorkflowNodeData }>;
  edges: Array<{ id: string; source: string; target: string; sourceHandle?: string; targetHandle?: string; label?: string }>;
  version: number;
}

/** 将旧格式 steps 转为 graph 布局 */
export function stepsToGraph(
  steps: Array<{ name: string; toolId: string; paramTemplate: Record<string, any>; condition?: string; onError?: string }>,
  parameters: WorkflowParam[],
): SerializedWorkflow {
  const nodes: SerializedWorkflow["nodes"] = [];
  const edges: SerializedWorkflow["edges"] = [];

  // 开始节点
  const startId = "start_1";
  nodes.push({
    id: startId, type: "start",
    position: { x: 250, y: 50 },
    data: { label: "开始", type: "start", config: {}, triggerType: "manual", parameters },
  });

  let prevId = startId;
  steps.forEach((step, i) => {
    const nodeId = `step_${i + 1}`;
    const nodeType = inferNodeType(step.toolId);
    const y = 180 + i * 160;
    const pt = step.paramTemplate || {};

    // ★ 从 paramTemplate 还原各类型节点的专有字段
    const specializedData: Partial<WorkflowNodeData> = {};
    if (nodeType === "llm") {
      specializedData.model = pt.model; specializedData.systemPrompt = pt.systemPrompt;
      specializedData.userPrompt = pt.userPrompt; specializedData.temperature = pt.temperature;
      specializedData.maxTokens = pt.maxTokens;
    } else if (nodeType === "code") {
      specializedData.language = pt.language || "javascript"; specializedData.code = pt.code;
      specializedData.inputVars = pt.inputVars; specializedData.outputVars = pt.outputVars;
    } else if (nodeType === "condition") {
      specializedData.conditionField = pt.field; specializedData.conditionOp = pt.op;
      specializedData.conditionValue = pt.value; specializedData.conditionExpression = pt.expression || step.condition;
    } else if (nodeType === "loop") {
      specializedData.loopSource = pt.loopSource; specializedData.loopItemVar = pt.loopItemVar;
      specializedData.loopMaxIter = pt.loopMaxIter;
    } else if (nodeType === "template") {
      specializedData.templateText = pt.text;
    }

    nodes.push({
      id: nodeId, type: nodeType,
      position: { x: 250, y },
      data: {
        label: step.name || step.toolId,
        type: nodeType,
        config: {},
        toolId: nodeType === "tool" ? step.toolId : undefined,
        paramTemplate: nodeType === "tool" ? step.paramTemplate : undefined,
        onError: (step.onError as any) || "retry",
        conditionExpression: step.condition || undefined,
        ...specializedData,
      },
    });
    edges.push({ id: `e_${prevId}_${nodeId}`, source: prevId, target: nodeId });
    prevId = nodeId;
  });

  // 输出节点
  const endId = "output_1";
  nodes.push({
    id: endId, type: "output",
    position: { x: 250, y: 180 + steps.length * 160 },
    data: { label: "输出", type: "output", config: {}, outputMode: "channel" },
  });
  edges.push({ id: `e_${prevId}_${endId}`, source: prevId, target: endId });

  return { nodes, edges, version: 2 };
}

/** 将 graph 序列化回 steps (用于执行引擎) */
export function graphToSteps(graph: SerializedWorkflow): {
  steps: Array<{ name: string; toolId: string; paramTemplate: Record<string, any>; condition: string | null; onError: string }>;
  parameters: WorkflowParam[];
} {
  // 拓扑排序 (BFS)
  const adj = new Map<string, string[]>();
  const inDeg = new Map<string, number>();
  for (const n of graph.nodes) { adj.set(n.id, []); inDeg.set(n.id, 0); }
  for (const e of graph.edges) { adj.get(e.source)?.push(e.target); inDeg.set(e.target, (inDeg.get(e.target) || 0) + 1); }

  const queue = graph.nodes.filter(n => (inDeg.get(n.id) || 0) === 0).map(n => n.id);
  const sorted: string[] = [];
  while (queue.length) {
    const id = queue.shift()!;
    sorted.push(id);
    for (const next of adj.get(id) || []) {
      const deg = (inDeg.get(next) || 1) - 1;
      inDeg.set(next, deg);
      if (deg === 0) queue.push(next);
    }
  }

  const nodeMap = new Map(graph.nodes.map(n => [n.id, n]));
  const steps: Array<{ name: string; toolId: string; paramTemplate: Record<string, any>; condition: string | null; onError: string }> = [];
  let parameters: WorkflowParam[] = [];

  for (const id of sorted) {
    const node = nodeMap.get(id);
    if (!node) continue;
    const d = node.data;
    if (d.type === "start") {
      parameters = d.parameters || [];
      continue;
    }
    if (d.type === "output") continue;

    const toolId = d.type === "tool" ? (d.toolId || "system.think") :
      d.type === "llm" ? "llm.invoke" :
      d.type === "code" ? `code.${d.language || "javascript"}` :
      d.type === "condition" ? "system.condition" :
      d.type === "loop" ? "system.loop" :
      d.type === "template" ? "template.render" :
      d.type === "variable" ? "system.variable" :
      "system.think";

    steps.push({
      name: d.label || "",
      toolId,
      paramTemplate: {
        ...(d.type === "tool" ? d.paramTemplate : {}),
        ...(d.type === "llm" ? { model: d.model, systemPrompt: d.systemPrompt, userPrompt: d.userPrompt, temperature: d.temperature, maxTokens: d.maxTokens } : {}),
        ...(d.type === "code" ? { language: d.language, code: d.code, inputVars: d.inputVars, outputVars: d.outputVars } : {}),
        ...(d.type === "condition" ? { field: d.conditionField, op: d.conditionOp, value: d.conditionValue, expression: d.conditionExpression } : {}),
        ...(d.type === "loop" ? { loopSource: d.loopSource, loopItemVar: d.loopItemVar, loopMaxIter: d.loopMaxIter } : {}),
        ...(d.type === "template" ? { text: d.templateText } : {}),
        ...(d.type === "variable" ? d.config : {}),
      },
      condition: d.conditionExpression || null,
      onError: d.onError || "retry",
    });
  }

  return { steps, parameters };
}

function inferNodeType(toolId: string): WorkflowNodeType {
  if (!toolId) return "tool";
  if (toolId.startsWith("code.")) return "code";
  if (toolId.startsWith("llm.")) return "llm";
  if (toolId === "system.condition") return "condition";
  if (toolId === "system.loop") return "loop";
  if (toolId === "system.variable") return "variable";
  if (toolId === "template.render") return "template";
  return "tool";
}

/** ★ 从 graph 中提取最大数字 ID 后缀，用于生成不冲突的新节点 ID */
export function extractMaxNodeId(graph: SerializedWorkflow): number {
  let max = 0;
  for (const n of graph.nodes) {
    const m = n.id.match(/_(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1]));
  }
  return max;
}

// ═══════════ NL 创建 ═══════════

export interface NLCreateRequest {
  description: string;
  category?: string;
}

export interface NLCreateResponse {
  title: string;
  description: string;
  category: string;
  icon: string;
  graph: SerializedWorkflow;
}
