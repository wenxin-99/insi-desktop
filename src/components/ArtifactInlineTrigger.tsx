/**
 * ArtifactInlineTrigger — 消息内的紧凑 Artifact 触发卡片
 *
 * 不内联渲染完整预览，只显示：
 *   [✨ 界面预览 · HTML · 512行]  [打开预览 →]
 *
 * 点击后在右侧面板打开完整的 ArtifactCard。
 * 移动端点击后全屏打开。
 */
import { memo } from 'react';
import {
  Sparkles, Loader2, Code2, Eye, ExternalLink,
  ThumbsUp, Monitor,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { ArtifactData } from '@/types/artifact';

interface ArtifactInlineTriggerProps {
  artifact: ArtifactData;
  onOpen: () => void;
}

export const ArtifactInlineTrigger = memo(function ArtifactInlineTrigger({
  artifact,
  onOpen,
}: ArtifactInlineTriggerProps) {
  const isStreaming = artifact.status === 'streaming';
  const isApproved = artifact.status === 'approved';
  const lines = artifact.code ? artifact.code.split('\n').length : 0;

  return (
    <div
      onClick={onOpen}
      className={cn(
        "my-3 group cursor-pointer",
        "border border-border rounded-xl overflow-hidden bg-card",
        "hover:border-primary/30 hover:shadow-md transition-all duration-200",
      )}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        {/* 左侧图标 */}
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
          isStreaming
            ? "bg-blue-50 dark:bg-blue-950/30"
            : isApproved
              ? "bg-green-50 dark:bg-green-950/30"
              : "bg-primary/5"
        )}>
          {isStreaming ? (
            <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
          ) : isApproved ? (
            <ThumbsUp className="w-4 h-4 text-green-600 dark:text-green-400" />
          ) : (
            <Monitor className="w-5 h-5 text-primary/70" />
          )}
        </div>

        {/* 中间信息 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground truncate">
              {artifact.title || '界面预览'}
            </span>
            {artifact.version > 1 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium shrink-0">
                v{artifact.version}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Code2 className="w-3 h-3" />
              {artifact.language.toUpperCase()}
            </span>
            {lines > 0 && (
              <span className="text-[11px] text-muted-foreground">
                · {lines} 行
              </span>
            )}
            {isStreaming && (
              <span className="text-[11px] text-blue-500 font-medium">
                生成中...
              </span>
            )}
            {artifact.description && !isStreaming && (
              <span className="text-[11px] text-muted-foreground truncate">
                · {artifact.description}
              </span>
            )}
          </div>
        </div>

        {/* 右侧打开按钮 */}
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 text-xs shrink-0 transition-colors",
            "text-muted-foreground group-hover:text-primary"
          )}
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
        >
          <Eye className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">打开预览</span>
          <ExternalLink className="w-3 h-3 opacity-50" />
        </Button>
      </div>

      {/* 流式进度条 */}
      {isStreaming && (
        <div className="h-0.5 bg-muted">
          <div
            className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-blue-500 transition-all duration-300"
            style={{ width: `${Math.min(90, Math.max(5, (artifact.code?.length || 0) / 50))}%` }}
          />
        </div>
      )}
    </div>
  );
});
