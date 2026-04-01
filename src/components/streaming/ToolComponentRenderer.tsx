/**
 * ToolComponentRenderer — 工具组件统一渲染路由
 *
 * 根据 ToolComponentData.type 自动选择对应的渲染组件。
 * 所有工具组件共享统一的 Start→Chunk→End 生命周期。
 */
import { memo } from 'react';
import type { ToolComponentData, ToolType } from '@/types/toolComponent';
import { WebSearchStreamCard } from './WebSearchStreamCard';
import { CodeStreamCard } from './CodeStreamCard';
import { DocumentStreamCard } from './DocumentStreamCard';
import { FileGenStreamCard } from './FileGenStreamCard';
import { DataAnalysisStreamCard } from './DataAnalysisStreamCard';

// ═══ 组件注册表 ═══

const TOOL_RENDERERS: Record<ToolType, React.ComponentType<any>> = {
  web_search: WebSearchStreamCard,
  code_gen: CodeStreamCard,
  doc_gen: DocumentStreamCard,
  file_gen: FileGenStreamCard,
  data_analysis: DataAnalysisStreamCard,
};

// ═══ Props ═══

interface ToolComponentRendererProps {
  /** 工具组件数据 */
  tool: ToolComponentData;
  /** 用户操作回调 */
  onAction?: (toolId: string, action: string, payload?: any) => void;
  /** 是否在流式消息中 */
  isLive?: boolean;
}

/**
 * 渲染单个工具组件，自动路由到对应的卡片组件
 */
export const ToolComponentRenderer = memo(function ToolComponentRenderer({
  tool, onAction, isLive,
}: ToolComponentRendererProps) {
  const Renderer = TOOL_RENDERERS[tool.type];

  if (!Renderer) {
    console.warn(`[ToolComponentRenderer] Unknown tool type: ${tool.type}`);
    return null;
  }

  return (
    <Renderer
      tool={tool}
      onAction={onAction ? (action: string, payload?: any) => onAction(tool.id, action, payload) : undefined}
      isLive={isLive}
    />
  );
});

/**
 * 渲染工具组件列表
 */
interface ToolComponentListProps {
  tools: ToolComponentData[];
  onAction?: (toolId: string, action: string, payload?: any) => void;
  isLive?: boolean;
}

export const ToolComponentList = memo(function ToolComponentList({
  tools, onAction, isLive,
}: ToolComponentListProps) {
  if (!tools || tools.length === 0) return null;

  return (
    <>
      {tools.map(tool => (
        <ToolComponentRenderer
          key={tool.id}
          tool={tool}
          onAction={onAction}
          isLive={isLive}
        />
      ))}
    </>
  );
});
