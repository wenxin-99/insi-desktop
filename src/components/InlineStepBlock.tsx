/**
 * InlineStepBlock — 单个思考步骤的行内渲染组件
 *
 * 每个 AI 思考/操作步骤作为独立段落插入消息流，
 * 类似 Claude 的逐步展示风格。
 *
 * 使用方式：
 *   <InlineStepBlock text="解析压缩包 server.tar.gz" isLive />
 *   <InlineStepBlock text="审视了代码结构" detail={...} />
 */

import { useState, useRef, useEffect } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';
import { AiLogo } from '@/components/AiLogo';
import { cn } from '@/lib/utils';

interface StepDetail {
  type: 'code' | 'output' | 'result' | 'text' | 'files';
  language?: string;
  content: string;
  label?: string;
}

interface InlineStepBlockProps {
  /** 步骤描述文字 */
  text: string;
  /** 可展开的详情（代码/文件内容等） */
  detail?: StepDetail | null;
  /** 是否正在进行中（显示动画 Logo + 光标） */
  isLive?: boolean;
  /** 是否为低价值步骤（完成后淡化显示） */
  dimmed?: boolean;
  /** 点击文件名回调 */
  onFileClick?: (filename: string) => void;
}

export function InlineStepBlock({ text, detail, isLive = false, dimmed = false, onFileClick }: InlineStepBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const hasDetail = detail && detail.content;

  return (
    <div className={cn(
      'animate-in fade-in slide-in-from-bottom-1 duration-300',
      dimmed && 'opacity-50',
    )}>
      {/* 步骤行 */}
      <div
        className={cn(
          'flex items-center gap-1.5 py-0.5 group',
          hasDetail && 'cursor-pointer',
        )}
        onClick={() => hasDetail && setExpanded(!expanded)}
      >
        <AiLogo size="xs" animated={isLive} />
        <span className={cn(
          'text-[13px] leading-snug',
          isLive ? 'text-foreground/80' : 'text-muted-foreground/70',
        )}>
          {text}
          {isLive && (
            <span className="inline-block w-[2px] h-[0.9em] bg-current opacity-50 ml-0.5 animate-pulse align-text-bottom" />
          )}
        </span>
        {hasDetail && (
          <ChevronRight className={cn(
            'h-3 w-3 text-muted-foreground/30 transition-transform duration-200 shrink-0',
            expanded && 'rotate-90',
          )} />
        )}
      </div>

      {/* 可展开详情 */}
      {hasDetail && (
        <div className={cn(
          'overflow-hidden transition-all duration-300 ease-out ml-5',
          expanded ? 'max-h-[300px] opacity-100 mt-1 mb-1' : 'max-h-0 opacity-0',
        )}>
          <div className={cn(
            'rounded-md border border-border/40 overflow-hidden text-[11px]',
          )}>
            {/* Header */}
            <div className="flex items-center justify-between px-2.5 py-1 bg-muted/20 border-b border-border/30">
              <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/50">
                {detail!.label || (detail!.type === 'code' ? (detail!.language || 'Code') : detail!.type === 'output' ? 'Output' : 'Detail')}
              </span>
            </div>
            {/* Content */}
            <div className={cn(
              'px-2.5 py-2 max-h-[200px] overflow-auto',
              (detail!.type === 'code' || detail!.type === 'output')
                ? 'bg-[#0d1117] dark:bg-[#0d1117] font-mono text-[11px] leading-5'
                : 'bg-muted/5',
            )} style={{ scrollbarWidth: 'thin' }}>
              <pre className={cn(
                'whitespace-pre-wrap break-all m-0',
                (detail!.type === 'code' || detail!.type === 'output') ? 'text-gray-300' : 'text-foreground/70',
              )}>
                {detail!.content.length > 500
                  ? detail!.content.substring(0, 480) + '\n...'
                  : detail!.content}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * InlineStepList — 将 operationLogs 渲染为逐步可见的步骤列表
 *
 * 用于 StreamingMessage（isLive=true）和 MessageItem（isLive=false）
 */

// 隐藏的内部操作
const HIDDEN_PATTERNS = [
  '正在调用AI模型', 'AI模型调用完成',
  '正在更新配额', '配额更新完成',
  '正在处理文档', '文档处理完成',
  '对话配额', '图片配额', '文档配额',
];

// 低价值步骤（完成后淡化）
const LOW_VALUE_PATTERNS = [
  '回答生成完成', '回答已生成',
  '正在生成回答',
];

// running → completed 配对
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

function isHidden(action: string, target?: string): boolean {
  return HIDDEN_PATTERNS.some(p => action.includes(p) || (target && target.includes(p)));
}

function isLowValue(action: string, desc?: string): boolean {
  return LOW_VALUE_PATTERNS.some(p => action.includes(p) || (desc && desc.includes(p)));
}

function getDisplayText(op: { action: string; target?: string; description?: string }): string {
  if (op.description) return op.description;
  if (op.target) return `${op.action} ${op.target}`;
  return op.action;
}

interface OperationLogItem {
  id: string;
  action: string;
  target?: string;
  operationStatus: 'running' | 'completed';
  timestamp: number;
  detail?: StepDetail;
  diff?: { fileName: string; before: string; after: string };
  stepType?: string;
  description?: string;
}

interface ThinkingStepItem {
  id: string;
  content: string;
  timestamp: number;
}

interface InlineStepListProps {
  operations: OperationLogItem[];
  /** 思考步骤（对话式过渡文字） */
  thinkingSteps?: ThinkingStepItem[];
  isLive?: boolean;
  onFileClick?: (filename: string) => void;
}

// 统一时间线项
type TimelineItem =
  | { kind: 'operation'; data: OperationLogItem }
  | { kind: 'thinking'; data: ThinkingStepItem };

export function InlineStepList({ operations, thinkingSteps = [], isLive = false, onFileClick }: InlineStepListProps) {
  const [collapsed, setCollapsed] = useState(!isLive);
  const prevIsLiveRef = useRef(isLive);

  // ★ 流式结束瞬间自动折叠
  useEffect(() => {
    if (prevIsLiveRef.current && !isLive) {
      // isLive 从 true → false，说明流式刚结束
      setCollapsed(true);
    }
    prevIsLiveRef.current = isLive;
  }, [isLive]);

  // ★ 流式开始时展开
  useEffect(() => {
    if (isLive) setCollapsed(false);
  }, [isLive]);

  // 1. 过滤隐藏的内部操作
  const visible = operations.filter(op => !isHidden(op.action, op.target));

  // 2. 合并 running → completed
  const merged = visible.reduce((acc: OperationLogItem[], op) => {
    if (op.operationStatus === 'completed') {
      const idx = acc.findIndex(l =>
        l.operationStatus === 'running' &&
        (l.action === op.action || (l.target && l.target === op.target) || isCompletedBy(l.action, op.action))
      );
      if (idx >= 0) {
        acc[idx] = { ...op, target: op.target || acc[idx].target, detail: op.detail || acc[idx].detail, description: op.description || acc[idx].description };
        return acc;
      }
    }
    acc.push(op);
    return acc;
  }, []);

  // 3. 非最后一个 running 自动标为 completed
  const finalOps = merged.map((op, idx) => {
    if (op.operationStatus === 'running' && idx < merged.length - 1) {
      return { ...op, operationStatus: 'completed' as const };
    }
    return op;
  });

  // 4. 合并 thinkingSteps + operationLogs 按时间排序
  const timeline: TimelineItem[] = [
    ...thinkingSteps.map(s => ({ kind: 'thinking' as const, data: s })),
    ...finalOps.map(op => ({ kind: 'operation' as const, data: op })),
  ].sort((a, b) => {
    const ta = a.kind === 'thinking' ? a.data.timestamp : a.data.timestamp;
    const tb = b.kind === 'thinking' ? b.data.timestamp : b.data.timestamp;
    return ta - tb;
  });

  if (timeline.length === 0) return null;

  // ★ 完成态折叠：只显示摘要行
  if (collapsed && !isLive) {
    // 提取关键数字摘要
    const stepCount = timeline.filter(i => i.kind === 'operation').length;
    return (
      <div className="my-1">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          className="flex items-center gap-1.5 py-0.5 text-[13px] text-muted-foreground/60 hover:text-muted-foreground transition-colors group cursor-pointer"
        >
          <AiLogo size="xs" />
          <span>已完成 {stepCount} 个步骤</span>
          <ChevronRight className="h-3 w-3 opacity-40 group-hover:opacity-70 transition-opacity" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-0.5 my-1">
      {/* 折叠按钮（展开态，仅完成后显示） */}
      {!isLive && (
        <button
          type="button"
          onClick={() => setCollapsed(true)}
          className="flex items-center gap-1 mb-0.5 text-[11px] text-muted-foreground/40 hover:text-muted-foreground/60 transition-colors cursor-pointer"
        >
          <ChevronDown className="h-3 w-3" />
          <span>收起步骤</span>
        </button>
      )}
      {timeline.map((item) => {
        if (item.kind === 'thinking') {
          // 思考步骤 → 对话式过渡文字（普通文本段落）
          const step = item.data;
          return (
            <div
              key={step.id}
              className="text-[14px] leading-relaxed text-foreground/85 py-0.5 animate-in fade-in slide-in-from-bottom-1 duration-300"
            >
              {step.content}
            </div>
          );
        }

        // 操作步骤 → 带 Logo 的步骤行
        const op = item.data;
        const text = getDisplayText(op);
        const isRunning = isLive && op.operationStatus === 'running';
        const dimmed = !isLive && isLowValue(op.action, op.description);

        return (
          <InlineStepBlock
            key={op.id}
            text={text}
            detail={op.detail as StepDetail | undefined}
            isLive={isRunning}
            dimmed={dimmed}
            onFileClick={onFileClick}
          />
        );
      })}
    </div>
  );
}
