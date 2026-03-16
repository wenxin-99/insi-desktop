/**
 * InlineThinkingBlock — Claude 风格思考步骤
 *
 * 改造自原版 GPT 风格：
 * - 折叠态：一行语义化摘要 + 步骤计数 + 耗时
 * - 展开态：极简竖线 + 类型图标 + 可展开详情
 * - 每步有 stepType 类型标签（Script / Search / Archive 等）
 * - 智能摘要（优先使用服务端推送的 summary，回退到客户端推断）
 */
import { useState, useEffect, useRef, useMemo } from 'react';
import {
  ChevronDown, ChevronRight, FileText,
  CheckCircle2, Loader2, Brain, Sparkles, Clock,
  FileCode, Package, Search, AlertCircle, Terminal,
  Eye, Link, Zap,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { AiLogo } from '@/components/AiLogo';

// ═══ 数据结构 ═══

export interface OperationDetail {
  type: 'code' | 'output' | 'result' | 'text' | 'files';
  language?: string;
  content: string;
  label?: string;
}

export type OperationStepType =
  | 'script' | 'file' | 'search' | 'generate'
  | 'connect' | 'archive' | 'image' | 'thinking';

export interface OperationItem {
  id: string;
  action: string;
  target?: string;
  operationStatus: 'running' | 'completed';
  timestamp: number;
  detail?: OperationDetail;
  diff?: { fileName: string; before: string; after: string };
  stepType?: OperationStepType;
  description?: string;
}

interface InlineThinkingBlockProps {
  operations: OperationItem[];
  thinkingTime?: number;
  isLive?: boolean;
  onFileClick?: (filename: string) => void;
  thinkingSummary?: string;
  /** 内容是否已开始流式输出（用于自动收起步骤面板） */
  hasStreamedContent?: boolean;
}

// ═══ 内部操作过滤 ═══
const HIDDEN_PATTERNS = [
  '正在调用AI模型', 'AI模型调用完成',
  '正在更新配额', '配额更新完成',
  '正在处理文档', '文档处理完成',
  '对话配额', '图片配额', '文档配额',
];

// ═══ 非展开态隐藏的低价值步骤（展开后仍可见） ═══
const LOW_VALUE_PATTERNS = [
  '回答生成完成', '回答已生成',
  '正在生成回答',
];

// ═══ running → completed 配对 ═══
const ACTION_PAIRS: [string, string][] = [
  ['正在读取文件', '文件读取完成'],
  ['读取文件', '文件读取完成'],
  ['正在解压', '解析完成'],
  ['正在解压', '解压完成'],
  ['解压文件', '解析完成'],
  ['解压压缩包', '压缩包解析完成'],
  ['正在解析文件', '解析完成'],
  ['正在提取关键代码', '代码提取完成'],
  ['提取关键代码', '代码结构分析完成'],
  ['分析代码结构', '代码结构分析完成'],
  ['代码结构分析', '代码结构分析完成'],
  ['正在分析文件内容', '文件分析就绪'],
  ['分析文件内容', '文件加载完成'],
  ['深度分析文件', '文件加载完成'],
  ['正在生成回答', '回答生成完成'],
  ['正在生成图片', '图片生成完成'],
  ['分析图片', '图片识别完成'],
  ['识别图片内容', '图片识别完成'],
  ['正在编写修复方案', '修复方案完成'],
];

function isCompletedBy(r: string, c: string): boolean {
  return ACTION_PAIRS.some(([rk, ck]) => r.includes(rk) && c.includes(ck));
}

// ═══ 自动推断步骤类型（向后兼容旧数据） ═══
function inferStepType(action: string): OperationStepType {
  if (action.includes('压缩') || action.includes('解压') || action.includes('解析压缩')) return 'archive';
  if (action.includes('文件') || action.includes('读取') || action.includes('加载') || action.includes('代码上下文')) return 'file';
  if (action.includes('代码') || action.includes('分析') || action.includes('搜索') || action.includes('识别') || action.includes('编写修复')) return 'search';
  if (action.includes('生成') || action.includes('回答')) return 'generate';
  if (action.includes('SSH') || action.includes('连接') || action.includes('服务器')) return 'connect';
  if (action.includes('图片')) return 'image';
  return 'thinking';
}

// ═══ 类型配置（图标 + 标签 + 颜色） ═══
const STEP_TYPE_CONFIG: Record<OperationStepType, {
  icon: any;
  label: string;
  labelColor: string;
}> = {
  script:   { icon: Terminal,   label: 'Script',  labelColor: 'text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40' },
  file:     { icon: FileText,   label: '',         labelColor: '' },
  search:   { icon: Search,     label: 'Search',  labelColor: 'text-blue-700 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40' },
  generate: { icon: Zap,        label: '',         labelColor: '' },
  connect:  { icon: Link,       label: 'Connect', labelColor: 'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40' },
  archive:  { icon: Package,    label: 'Archive', labelColor: 'text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/40' },
  image:    { icon: Eye,        label: 'Image',   labelColor: 'text-pink-700 dark:text-pink-400 bg-pink-50 dark:bg-pink-950/40' },
  thinking: { icon: Brain,      label: '',         labelColor: '' },
};

// ═══ 显示标签 ═══
function getDisplayLabel(op: OperationItem): string {
  if (op.description) return op.description;
  return getCompactLabel(op.action, op.target);
}

function getCompactLabel(action: string, target?: string): string {
  if (action.includes('读取文件')) return target ? `读取文件 ${fmt(target)}` : '读取文件';
  if (action.includes('压缩包') || action.includes('解压')) return target ? `解析压缩包 ${fmt(target)}` : '解析压缩包';
  if (action.includes('代码结构') || action.includes('代码提取')) return target ? `分析代码结构 ${fmt(target)}` : '分析代码结构';
  if (action.includes('文件加载') || action.includes('文件分析')) return target ? `文件加载完成 ${fmt(target)}` : '文件加载完成';
  if (action.includes('图片识别') || action.includes('分析图片')) return target ? `识别图片内容 ${fmt(target)}` : '识别图片内容';
  if (action.includes('生成回答') || action.includes('回答生成')) return '生成回答';
  if (action.includes('编写修复')) return target ? `编写修复方案 ${fmt(target)}` : '编写修复方案';
  if (action.includes('生成文件')) return target ? `生成文件 ${fmt(target)}` : '生成文件';
  if (action.includes('生成图片') || action.includes('图片生成')) return '生成图片';
  if (action.includes('已加载代码上下文')) return target ? `加载上下文 ${fmt(target)}` : '加载代码上下文';
  return action;
}

function fmt(t: string): string {
  if (!t) return '';
  if (t.length > 32) { const ext = t.includes('.') ? '.' + t.split('.').pop() : ''; return t.substring(0, 24) + '...' + ext; }
  return t;
}

// ═══ 客户端摘要推断（服务端未发送摘要时的回退） ═══
function inferSummary(ops: OperationItem[]): string {
  const actions = ops.map(o => o.action.toLowerCase());
  const descriptions = ops.map(o => (o.description || '').toLowerCase());
  const all = [...actions, ...descriptions];

  const hasArchive = all.some(a => a.includes('压缩') || a.includes('解压'));
  const hasFile = all.some(a => a.includes('文件') || a.includes('读取'));
  const hasCode = all.some(a => a.includes('代码'));
  const hasImage = all.some(a => a.includes('图片'));
  const hasSSH = all.some(a => a.includes('ssh') || a.includes('服务器'));
  const hasFix = all.some(a => a.includes('修复'));
  const hasAuth = all.some(a => a.includes('登录') || a.includes('认证') || a.includes('auth'));
  const hasStyle = all.some(a => a.includes('样式') || a.includes('css') || a.includes('布局'));
  const hasApi = all.some(a => a.includes('接口') || a.includes('api') || a.includes('路由'));

  const parts: string[] = [];

  // 服务器操作
  if (hasSSH) parts.push('执行了服务器操作');

  // 文件分析（按细分场景排列）
  if (hasFix && (hasArchive || hasFile)) parts.push('审视了代码并定位问题');
  else if (hasAuth && (hasArchive || hasFile)) parts.push('审视了身份验证代码与程序入口点');
  else if (hasStyle && (hasArchive || hasFile)) parts.push('分析了界面样式与布局代码');
  else if (hasApi && (hasArchive || hasFile)) parts.push('审视了接口定义与数据流');
  else if (hasArchive && hasCode) parts.push('分析了上传的代码文件');
  else if (hasArchive) parts.push('解析了压缩包内容');
  else if (hasFile && hasCode) parts.push('分析了文件代码结构');
  else if (hasFile) parts.push('读取了上传的文件');

  // 修复方案
  if (hasFix && !parts.some(p => p.includes('修复') || p.includes('定位'))) parts.push('编写了修复方案');

  // 图片
  if (hasImage) parts.push('处理了图片内容');

  // 兜底
  if (parts.length === 0) parts.push('分析了问题并生成了回答');

  return parts.join('，') + '。';
}

// ═══ 详情渲染器 ═══
function DetailBlock({ detail }: { detail: OperationDetail }) {
  if (!detail || !detail.content) return null;

  const label = detail.label || (
    detail.type === 'code' ? (detail.language || 'Code') :
    detail.type === 'output' ? 'Output' :
    detail.type === 'result' ? 'Result' :
    detail.type === 'files' ? 'Files' : 'Detail'
  );

  const isCode = detail.type === 'code' || detail.type === 'output';
  const lines = detail.content.split('\n');
  const isTruncated = lines.length > 12;
  const displayContent = isTruncated ? lines.slice(0, 10).join('\n') + '\n...' : detail.content;

  return (
    <div className="mt-1.5 mb-1 rounded-md border border-border/50 overflow-hidden text-[11px]">
      <div className="flex items-center justify-between px-2.5 py-1 bg-muted/20 border-b border-border/30">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">
          {label}
        </span>
        {isTruncated && (
          <span className="text-[9px] text-muted-foreground/30">{lines.length} lines</span>
        )}
      </div>
      <div className={cn(
        "px-2.5 py-2 max-h-[200px] overflow-auto",
        isCode ? "bg-[#0d1117] dark:bg-[#0d1117] font-mono text-[11px] leading-5" : "bg-muted/5"
      )} style={{ scrollbarWidth: 'thin' }}>
        <pre className={cn(
          "whitespace-pre-wrap break-all m-0",
          isCode ? "text-gray-300" : "text-foreground/70"
        )}>
          {displayContent}
        </pre>
      </div>
    </div>
  );
}

// ═══ 类型标签（Claude 的 "Script" 按钮风格） ═══
function TypeBadge({ stepType }: { stepType: OperationStepType }) {
  const config = STEP_TYPE_CONFIG[stepType];
  if (!config?.label) return null;

  return (
    <span className={cn(
      "inline-flex items-center text-[10px] font-medium px-1.5 py-0.5 rounded mt-0.5",
      config.labelColor
    )}>
      {config.label}
    </span>
  );
}

// ═══ 单步行（Claude 风格） ═══
function StepRow({
  op, isActive, isLast, isLive, onFileClick,
}: {
  op: OperationItem;
  isActive: boolean;
  isLast: boolean;
  isLive: boolean;
  onFileClick?: (f: string) => void;
}) {
  const [showDetail, setShowDetail] = useState(false);
  const stepType = op.stepType || inferStepType(op.action);
  const config = STEP_TYPE_CONFIG[stepType];
  const Icon = config.icon;
  const hasDetail = !!op.detail?.content;
  const label = getDisplayLabel(op);
  const isFile = op.action.includes('文件') || op.action.includes('生成文件') || op.action.includes('编写修复');
  // 只对真正的文件名（含扩展名或路径）显示为可点击链接，忽略描述性文字如"共 1 个文件"
  const rawTarget = op.target && !label.includes(op.target.substring(0, 8)) ? op.target : undefined;
  const isRealFilename = rawTarget && (rawTarget.includes('.') || rawTarget.includes('/'));
  const displayTarget = isRealFilename ? fmt(rawTarget) : undefined;

  return (
    <div className={cn(
      "transition-all duration-200",
      isLast && isLive && "animate-in fade-in slide-in-from-left-1 duration-300"
    )}>
      {/* 主行 */}
      <div
        className={cn(
          "flex items-start gap-2 py-1.5 text-[13px] group",
          hasDetail ? "cursor-pointer" : "cursor-default",
          isActive ? "text-foreground" : "text-foreground/70",
        )}
        onClick={() => hasDetail && setShowDetail(!showDetail)}
      >
        {/* 图标 */}
        <div className="mt-[2px] shrink-0">
          {isActive ? (
            <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
          ) : (
            <Icon className="h-4 w-4 text-muted-foreground/50" />
          )}
        </div>

        {/* 内容区 */}
        <div className="flex-1 min-w-0">
          {/* 步骤名称 */}
          <div className="flex items-center gap-1.5">
            {hasDetail && (
              <ChevronRight className={cn(
                "h-3 w-3 shrink-0 text-muted-foreground/40 transition-transform duration-150",
                showDetail && "rotate-90"
              )} />
            )}

            <span className={cn(
              "truncate flex-1",
              isActive && "font-medium",
              hasDetail && "group-hover:text-foreground transition-colors"
            )}>
              {label}
            </span>

            {displayTarget && isFile && onFileClick && (
              <button
                onClick={(e) => { e.stopPropagation(); onFileClick(displayTarget); }}
                className="text-[11px] text-muted-foreground/70 hover:text-foreground hover:underline truncate max-w-[160px] shrink-0 font-mono"
              >
                {displayTarget}
              </button>
            )}
          </div>

          {/* 类型标签 */}
          {config.label && (
            <div>
              <TypeBadge stepType={stepType} />
            </div>
          )}
        </div>
      </div>

      {/* 展开的详情区 */}
      {showDetail && op.detail && (
        <div className="ml-6">
          <DetailBlock detail={op.detail} />
        </div>
      )}
    </div>
  );
}

// ═══ 主组件 ═══
export function InlineThinkingBlock({ operations, thinkingTime, isLive, onFileClick, thinkingSummary, hasStreamedContent }: InlineThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [userToggled, setUserToggled] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef(Date.now());
  const prevCountRef = useRef(0);

  // 过滤
  const visibleOps = operations.filter(op =>
    !HIDDEN_PATTERNS.some(p => op.action.includes(p) || (op.target && op.target.includes(p)))
  );

  // 合并 running → completed
  const mergedOps = visibleOps.reduce((acc: OperationItem[], op) => {
    if (op.operationStatus === 'completed') {
      let idx = acc.findIndex(l =>
        l.operationStatus === 'running' &&
        (l.action === op.action || (l.target && l.target === op.target))
      );
      if (idx < 0) idx = acc.findIndex(l => l.operationStatus === 'running' && isCompletedBy(l.action, op.action));
      if (idx >= 0) {
        acc[idx] = {
          ...op,
          target: op.target || acc[idx].target,
          detail: op.detail || acc[idx].detail,
          stepType: op.stepType || acc[idx].stepType,
          description: op.description || acc[idx].description,
        };
        return acc;
      }
    }
    acc.push(op);
    return acc;
  }, []);

  const finalOps = mergedOps.map((op, idx) => {
    if (op.operationStatus === 'running' && idx < mergedOps.length - 1) {
      return { ...op, operationStatus: 'completed' as const };
    }
    return op;
  });

  // Timer
  useEffect(() => {
    if (!isLive) return;
    startTimeRef.current = Date.now();
    const t = setInterval(() => setElapsedTime((Date.now() - startTimeRef.current) / 1000), 100);
    return () => clearInterval(t);
  }, [isLive]);

  // 判断是否有"有价值"的步骤（文件处理、代码分析等）
  // 纯 generate 步骤（"正在生成回答"）不值得展开列表
  const hasMeaningfulSteps = useMemo(() => {
    const generatePatterns = ['生成回答', '回答生成', '正在生成', '正在使用'];
    return finalOps.some(op => {
      const text = (op.action + ' ' + (op.description || '')).toLowerCase();
      return !generatePatterns.some(p => text.includes(p));
    });
  }, [finalOps]);

  // 新步骤出现时自动展开 —— 仅当有文件/代码/搜索等有价值步骤时才展开
  useEffect(() => {
    if (isLive && finalOps.length > prevCountRef.current && hasMeaningfulSteps) {
      setIsExpanded(true);
    }
    prevCountRef.current = finalOps.length;
  }, [finalOps.length, isLive, hasMeaningfulSteps]);

  // 内容开始流式输出时自动收起（用户未手动操作时）
  useEffect(() => {
    if (isLive && hasStreamedContent && !userToggled) {
      setIsExpanded(false);
    }
  }, [isLive, hasStreamedContent, userToggled]);

  // 完成后延迟折叠（用户未手动操作时）
  useEffect(() => {
    if (!isLive && finalOps.length > 0 && !userToggled) {
      const t = setTimeout(() => setIsExpanded(false), 1200);
      return () => clearTimeout(t);
    }
  }, [isLive, userToggled]);

  // 摘要文本
  const summary = useMemo(() => {
    if (thinkingSummary) return thinkingSummary;
    if (!isLive && finalOps.length > 0) return inferSummary(finalOps);
    return '';
  }, [thinkingSummary, isLive, finalOps]);

  if (finalOps.length === 0 && !isLive) return null;

  // 区分有价值的步骤（用于计数和摘要）和低价值步骤（"回答已生成"等）
  const isLowValue = (op: OperationItem) =>
    LOW_VALUE_PATTERNS.some(p => op.action.includes(p) || (op.description && op.description.includes(p)));
  const meaningfulOps = finalOps.filter(op => !isLowValue(op));
  const meaningfulCount = meaningfulOps.length;

  const displayTime = isLive ? elapsedTime : (thinkingTime || 0);
  const runningOps = finalOps.filter(op => op.operationStatus === 'running');
  const hasRunning = runningOps.length > 0;
  const activeLabel = hasRunning
    ? getDisplayLabel(runningOps[runningOps.length - 1])
    : '正在思考';

  const handleToggle = () => {
    setUserToggled(true);
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="mb-3">
      {/* ═══ 折叠头部（Claude 风格） ═══ */}
      <button
        onClick={handleToggle}
        className="flex items-start gap-2 w-full py-1 group text-left"
      >
        {/* 摘要图标 — AI Logo 动画 */}
        <div className="mt-0.5 shrink-0">
          <AiLogo size="xs" animated={!!isLive} />
        </div>

        {/* 文本区域 */}
        <div className="flex-1 min-w-0">
          {/* 第一行：语义化摘要 或 当前活动步骤 */}
          <div className={cn(
            "text-[13px] leading-snug",
            isLive ? "text-foreground/90 font-medium" : "text-foreground/70"
          )}>
            {isLive ? (
              <>{activeLabel}<span className="text-muted-foreground/40">...</span></>
            ) : summary ? (
              <span>{summary}</span>
            ) : (
              <span>已完成 {meaningfulCount} 个步骤</span>
            )}
          </div>

          {/* 第二行：展开箭头 + 步骤计数 + 耗时 — 仅当有有价值步骤时显示 */}
          {(hasMeaningfulSteps || !isLive) && (meaningfulCount > 0) && (
          <div className="flex items-center gap-1 mt-0.5">
            <ChevronRight className={cn(
              "h-3 w-3 text-muted-foreground/40 transition-transform duration-200",
              isExpanded && "rotate-90"
            )} />
            <span className="text-[11px] text-muted-foreground/50">
              {isLive
                ? `${meaningfulCount > 0 ? meaningfulCount + ' 个步骤' : '处理中'}`
                : `已完成 ${meaningfulCount} 个步骤`}
            </span>
            {displayTime > 0 && (
              <span className="text-[11px] text-muted-foreground/40 tabular-nums flex items-center gap-0.5">
                · <Clock className="h-2.5 w-2.5" />
                {displayTime.toFixed(1)}s
              </span>
            )}
          </div>
          )}
          {/* 简洁模式（纯生成，无文件步骤）：只显示耗时 */}
          {!hasMeaningfulSteps && isLive && (
            <div className="flex items-center gap-1 mt-0.5">
              {displayTime > 0 && (
                <span className="text-[11px] text-muted-foreground/40 tabular-nums flex items-center gap-0.5">
                  <Clock className="h-2.5 w-2.5" />
                  {displayTime.toFixed(1)}s
                </span>
              )}
            </div>
          )}
        </div>
      </button>

      {/* ═══ 展开内容（竖线时间线） ═══ */}
      <div className={cn(
        "overflow-hidden transition-all duration-300 ease-out",
        isExpanded ? "max-h-[600px] opacity-100 mt-1" : "max-h-0 opacity-0"
      )}>
        <div className="ml-[7px] pl-4 border-l-[1.5px] border-border/40 space-y-0 max-h-[500px] overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
          {finalOps
            .filter(op => isLive || !isLowValue(op))
            .map((op, idx, arr) => (
            <StepRow
              key={op.id}
              op={op}
              isActive={isLive && op.operationStatus === 'running'}
              isLast={idx === arr.length - 1}
              isLive={!!isLive}
              onFileClick={onFileClick}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
