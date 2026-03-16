/**
 * 文件预览 — 多文件 Tab 栏
 * 支持多个文件同时打开、切换、关闭
 */
import React from 'react';
import { X, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getFileExtension, getFileIconColor } from './diffUtils';

export interface FileTab {
  name: string;
  content: string;
  isLive: boolean;
}

interface FileTabBarProps {
  files: FileTab[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onClose: (index: number) => void;
}

// ─── 文件扩展名 Badge ───

function ExtBadge({ ext }: { ext: string }) {
  if (!ext) return null;
  const color = getFileIconColor(ext);
  return (
    <span className={cn('text-[9px] font-bold uppercase tracking-wider opacity-70', color)}>
      {ext}
    </span>
  );
}

export function FileTabBar({ files, activeIndex, onSelect, onClose }: FileTabBarProps) {
  if (files.length <= 1) return null;

  return (
    <div className="flex items-center border-b border-border bg-[#161b22] flex-shrink-0 overflow-x-auto scrollbar-none">
      {files.map((file, i) => {
        const isActive = i === activeIndex;
        const ext = getFileExtension(file.name);
        const shortName = file.name.split('/').pop() || file.name;

        return (
          <div
            key={`${file.name}-${i}`}
            onClick={() => onSelect(i)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-mono cursor-pointer',
              'border-r border-border/50 min-w-0 max-w-[200px] group',
              'transition-colors duration-100',
              isActive
                ? 'bg-[#1e1e1e] text-foreground border-b-2 border-b-blue-500'
                : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-[#1e1e2e]',
            )}
          >
            <ExtBadge ext={ext} />
            <span className="truncate">{shortName}</span>
            {file.isLive && (
              <Circle className="h-2 w-2 fill-green-500 text-green-500 flex-shrink-0 animate-pulse" />
            )}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(i);
              }}
              className={cn(
                'ml-auto p-0.5 rounded flex-shrink-0',
                'opacity-0 group-hover:opacity-100 hover:bg-muted/50',
                'transition-opacity duration-100',
                isActive && 'opacity-60',
              )}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
