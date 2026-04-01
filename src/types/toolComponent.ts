/**
 * ToolComponent 统一流式工具组件类型系统
 *
 * 核心理念：将 Artifact 已验证的 Start→Chunk→End 三阶段模式
 * 推广到所有工具组件，实现"预创建容器 + 流式填充内容"的统一 UX。
 *
 * SSE 协议：
 *   tool_start  → 前端立即创建组件容器（骨架屏/占位 UI）
 *   tool_chunk  → 内容增量追加到组件中（用户看到实时打字效果）
 *   tool_end    → 组件切换到完成态（启用交互/操作按钮）
 *   tool_error  → 组件切换到错误态
 */

// ═══════ 工具类型枚举 ═══════

export type ToolType =
  | 'web_search'      // 联网搜索：搜索关键词 → 结果逐条出现 → 来源列表
  | 'code_gen'        // 代码生成/编辑：创建编辑器 → 代码逐行流入 → 语法高亮
  | 'doc_gen'         // 文档生成：创建文档面板 → Markdown 流式渲染
  | 'file_gen'        // 文件创建/修改：文件卡片 → 内容流式填充 → diff 对比
  | 'data_analysis';  // 数据分析：分析面板 → 结果逐步呈现 → 图表渲染

// ═══════ 各工具类型的元数据 ═══════

export interface WebSearchMeta {
  query: string;
  isMultiRound?: boolean;
}

export interface CodeGenMeta {
  fileName: string;
  language: string;
  action: 'create' | 'modify' | 'refactor';
  description?: string;
  oldCode?: string; // modify 时的原始代码
}

export interface DocGenMeta {
  title: string;
  format: 'markdown' | 'html' | 'pdf' | 'word';
  description?: string;
}

export interface FileGenMeta {
  fileName: string;
  action: 'create' | 'modify' | 'delete';
  language?: string;
  description?: string;
  oldContent?: string; // modify 时原始内容
}

export interface DataAnalysisMeta {
  title: string;
  dataSource?: string;
  analysisType?: 'summary' | 'chart' | 'table' | 'insight';
}

export type ToolMeta =
  | ({ toolType: 'web_search' } & WebSearchMeta)
  | ({ toolType: 'code_gen' } & CodeGenMeta)
  | ({ toolType: 'doc_gen' } & DocGenMeta)
  | ({ toolType: 'file_gen' } & FileGenMeta)
  | ({ toolType: 'data_analysis' } & DataAnalysisMeta);

// ═══════ 工具组件统一状态 ═══════

export type ToolComponentStatus = 'streaming' | 'complete' | 'error';

export interface ToolComponentData {
  id: string;
  type: ToolType;
  meta: ToolMeta;
  /** 累积的流式内容（纯文本/JSON，由各组件自行解析） */
  streamedContent: string;
  /** 当前状态 */
  status: ToolComponentStatus;
  /** 完成后的结构化结果 */
  result?: any;
  /** 错误信息 */
  error?: string;
  /** 创建时间 */
  createdAt: number;

  // ═══ Web Search 专用字段 ═══
  /** 搜索结果列表（逐条追加） */
  searchResults?: SearchResultItem[];
  /** 当前搜索轮次 */
  searchRound?: number;
  /** 当前正在搜索的查询词 */
  currentQuery?: string;

  // ═══ Code Gen 专用字段 ═══
  /** 高亮范围（modify 时标记变更行） */
  changedLines?: Array<{ start: number; end: number; type: 'add' | 'remove' | 'modify' }>;
}

export interface SearchResultItem {
  title: string;
  url: string;
  snippet: string;
  favicon?: string;
}

// ═══════ SSE 事件类型 ═══════

export interface ToolStartEvent {
  type: 'tool_start';
  toolId: string;
  toolType: ToolType;
  meta: Record<string, any>;
}

export interface ToolChunkEvent {
  type: 'tool_chunk';
  toolId: string;
  chunk: string;
  /** 可选：指定写入的字段（默认追加到 streamedContent） */
  field?: string;
  /** Web Search: 追加搜索结果 */
  searchResult?: SearchResultItem;
  /** Web Search: 更新搜索轮次/查询词 */
  searchRound?: number;
  currentQuery?: string;
}

export interface ToolEndEvent {
  type: 'tool_end';
  toolId: string;
  result?: any;
}

export interface ToolErrorEvent {
  type: 'tool_error';
  toolId: string;
  error: string;
}

// ═══════ 渲染组件 Props ═══════

export interface ToolComponentRenderProps {
  tool: ToolComponentData;
  /** 工具组件内的用户操作回调（如：应用代码、重新搜索） */
  onAction?: (action: string, payload?: any) => void;
  /** 是否在流式消息中（true）还是在已完成消息中（false） */
  isLive?: boolean;
}
