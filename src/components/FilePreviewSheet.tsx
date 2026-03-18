/**
 * FilePreviewSheet — 移动端文件预览（全屏模式）
 *
 * 移动端点击按钮后以全屏 overlay 展示文件内容，
 * 代替之前狭窄的 Sheet 抽屉。桌面端文件预览由 RightSidePanel 承载。
 */
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { FilePreviewPanel, type PreviewFile } from './FilePreviewPanel';
import { cn } from '@/lib/utils';
import { getFileExtension, getFileIconColor } from './filePreview/diffUtils';

interface FilePreviewSheetProps {
  /** 当前预览的文件 */
  previewFile: PreviewFile | null;
  /** 关闭预览 */
  onClose: () => void;
  /** 多文件支持 */
  files?: PreviewFile[];
  activeFileIndex?: number;
  onFileSelect?: (index: number) => void;
  onFileClose?: (index: number) => void;
  /** 最近文件 */
  recentFiles?: PreviewFile[];
  onRestoreFile?: (file: PreviewFile) => void;
  /** 移动端模式 */
  mobile?: boolean;
}

export function FilePreviewSheet({
  previewFile,
  onClose,
  files,
  activeFileIndex = 0,
  onFileSelect,
  onFileClose,
  recentFiles,
  onRestoreFile,
  mobile,
}: FilePreviewSheetProps) {
  const [open, setOpen] = useState(false);

  if (!previewFile) return null;

  const ext = getFileExtension(previewFile.name);
  const color = getFileIconColor(ext);
  const fileCount = files?.length || 0;

  const handleClose = () => {
    onClose();
    setOpen(false);
  };

  const handlePrev = () => {
    if (files && activeFileIndex > 0) onFileSelect?.(activeFileIndex - 1);
  };

  const handleNext = () => {
    if (files && activeFileIndex < files.length - 1) onFileSelect?.(activeFileIndex + 1);
  };

  // ── 触发按钮（仅移动端显示） ──
  const triggerButton = mobile ? (
    <Button
      size="sm"
      variant="outline"
      className="md:hidden h-8 px-2 flex-shrink-0 relative gap-1.5"
      title="查看文件"
      onClick={() => setOpen(true)}
    >
      <FileText className={cn('h-3.5 w-3.5', color)} />
      <span className="text-xs font-mono truncate max-w-[80px]">
        {previewFile.name.split('/').pop() || '文件'}
      </span>
      {previewFile.isLive && (
        <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-pulse" />
      )}
      {fileCount > 1 && (
        <span className="text-[10px] text-muted-foreground">{fileCount}</span>
      )}
    </Button>
  ) : null;

  return (
    <>
      {triggerButton}

      {/* ── 全屏预览 Overlay ── */}
      {open && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col md:hidden">
          {/* 顶部导航栏 */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/30 flex-shrink-0">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <FileText className={cn('h-4 w-4 shrink-0', color)} />
              <span className="text-sm font-mono font-medium truncate">
                {previewFile.name.split('/').pop() || '文件预览'}
              </span>
              {ext && (
                <span className={cn('text-[9px] font-bold uppercase px-1.5 py-0.5 rounded bg-muted/50 shrink-0', color)}>
                  {ext}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {/* 文件切换箭头 */}
              {fileCount > 1 && (
                <>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handlePrev} disabled={activeFileIndex <= 0}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground tabular-nums">{activeFileIndex + 1}/{fileCount}</span>
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleNext} disabled={activeFileIndex >= fileCount - 1}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </>
              )}
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* 文件内容 */}
          <div className="flex-1 min-h-0 overflow-hidden">
            <FilePreviewPanel
              fileName={previewFile.name}
              content={previewFile.content}
              isLive={previewFile.isLive}
              onClose={handleClose}
              files={files}
              activeFileIndex={activeFileIndex}
              onFileSelect={onFileSelect}
              onFileClose={onFileClose}
              recentFiles={recentFiles}
              onRestoreFile={onRestoreFile}
            />
          </div>
        </div>
      )}
    </>
  );
}
