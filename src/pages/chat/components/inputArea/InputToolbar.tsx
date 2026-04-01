/**
 * InputToolbar — 输入框下方工具栏
 *
 * 布局: [+附件/KB/GitHub] ............. [🎤语音] [▶发送]
 *
 * KB 和 GitHub 选择器已收入 "+" 菜单的子面板，
 * 选中后在 "+" 按钮旁以 Badge 形式展示快速取消入口。
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { PressToTalkButton } from '@/components/PressToTalkButton';
import { Loader2, ArrowUp, Plus, StopCircle, BookOpen, Github, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { AttachMenu } from './AttachMenu';
import type { SelectedKB } from '@/components/KnowledgeBasePicker';
import type { SelectedGitHubRepo } from '@/components/GitHubRepoPicker';

interface InputToolbarProps {
  onAttachment: () => void;
  onImageAttachment: () => void;
  onCamera: () => void;
  onResearchToggle?: () => void;
  onSend: () => void;
  isStreaming: boolean;
  isResearchMode?: boolean;
  t: (key: string) => string;
  isDisabled?: boolean;
  isUploading?: boolean;
  hasContent?: boolean;
  selectedPackageId?: number | null;
  onVoiceTranscribed?: (text: string) => void;
  onVoiceInterimResult?: (text: string) => void;
  onStop?: () => void;
  selectedKB?: SelectedKB | null;
  onKBSelect?: (kb: SelectedKB | null) => void;
  selectedGitHubRepo?: SelectedGitHubRepo | null;
  onGitHubRepoSelect?: (repo: SelectedGitHubRepo | null) => void;
  /** ★ 隐藏 + 按钮（由父级渲染在 textarea 同行） */
  hidePlusButton?: boolean;
  /** ★ 外部控制 AttachMenu 开关 */
  menuOpen?: boolean;
  onMenuToggle?: (open: boolean) => void;
}

export function InputToolbar({
  onAttachment, onImageAttachment, onCamera,
  onSend, isStreaming,
  t, isDisabled = false, isUploading = false,
  hasContent = false, selectedPackageId, onVoiceTranscribed,
  onVoiceInterimResult, onStop,
  selectedKB, onKBSelect,
  selectedGitHubRepo, onGitHubRepoSelect,
  hidePlusButton = false,
  menuOpen: externalMenuOpen,
  onMenuToggle,
}: InputToolbarProps) {
  const [internalMenuOpen, setInternalMenuOpen] = useState(false);
  // ★ 支持外部控制或内部自管理
  const menuOpen = externalMenuOpen !== undefined ? externalMenuOpen : internalMenuOpen;
  const setMenuOpen = (v: boolean) => {
    if (onMenuToggle) onMenuToggle(v);
    else setInternalMenuOpen(v);
  };

  return (
    <div className="flex items-center justify-between">
      {/* ──── 左侧: "+" 菜单 + 已选 Badge ──── */}
      <div className="flex items-center gap-1 relative flex-wrap">
        {/* 弹出菜单（始终渲染，确保 popup 工作） */}
        <AttachMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onImageAttachment={onImageAttachment}
          onFileAttachment={onAttachment}
          onCamera={onCamera}
          t={t}
          selectedKB={selectedKB}
          onKBSelect={onKBSelect}
          selectedGitHubRepo={selectedGitHubRepo}
          onGitHubRepoSelect={onGitHubRepoSelect}
        />

        {/* ★ "+" 按钮 — 可由父级隐藏（改为在 textarea 同行渲染） */}
        {!hidePlusButton && (
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "h-8 w-8 md:h-9 md:w-9 rounded-full flex-shrink-0 transition-all",
              menuOpen ? 'bg-accent rotate-45' : 'hover:bg-accent'
            )}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(!menuOpen); }}
            disabled={isStreaming}
            title="附件/知识库/GitHub"
            type="button"
          >
            <Plus className="h-5 w-5 transition-transform duration-200" />
          </Button>
        )}

        {/* 已选知识库 Badge */}
        {selectedKB && onKBSelect && (
          <Badge
            variant="secondary"
            className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80 transition-colors max-w-[110px]"
            onClick={() => onKBSelect(null)}
            title={`知识库：${selectedKB.name}，点击取消`}
          >
            <BookOpen className="h-3 w-3 flex-shrink-0" />
            <span className="truncate text-xs">{selectedKB.name}</span>
            <X className="h-3 w-3 opacity-60 flex-shrink-0" />
          </Badge>
        )}

        {/* 已选 GitHub 仓库 Badge */}
        {selectedGitHubRepo && onGitHubRepoSelect && (
          <Badge
            variant="secondary"
            className="flex items-center gap-1 cursor-pointer hover:bg-secondary/80 transition-colors max-w-[120px]"
            onClick={() => onGitHubRepoSelect(null)}
            title={`${selectedGitHubRepo.fullName}@${selectedGitHubRepo.branch}，点击取消`}
          >
            <Github className="h-3 w-3 flex-shrink-0" />
            <span className="truncate text-xs">
              {selectedGitHubRepo.fullName.split('/')[1]}
            </span>
            <X className="h-3 w-3 opacity-60 flex-shrink-0" />
          </Badge>
        )}
      </div>

      {/* ──── 右侧: 语音 + 发送（hidePlusButton 时由父级内联渲染，这里隐藏） ──── */}
      {!hidePlusButton && (
      <div className="flex items-center gap-1">
        {onVoiceTranscribed && (
          <PressToTalkButton
            onTranscribed={onVoiceTranscribed}
            onInterimResult={onVoiceInterimResult}
            disabled={false}
            language="zh"
            packageId={selectedPackageId ?? undefined}
          />
        )}
        <Button
          onClick={() => { if (isStreaming && onStop) { onStop(); } else { onSend(); } }}
          disabled={isDisabled || isUploading || (!isStreaming && !hasContent)}
          size="icon"
          className={cn(
            "h-8 w-8 md:h-9 md:w-9 rounded-full flex-shrink-0 shadow-lg transition-all hover:scale-105",
            isStreaming ? 'bg-destructive hover:bg-destructive/90' : 'bg-primary hover:bg-primary/90'
          )}
          type="button"
        >
          {isStreaming ? (
            <StopCircle className="h-4 w-4" />
          ) : isUploading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <ArrowUp className="h-4 w-4" />
          )}
        </Button>
      </div>
      )}
    </div>
  );
}
