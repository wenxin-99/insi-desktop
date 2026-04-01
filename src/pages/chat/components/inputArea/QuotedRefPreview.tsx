/**
 * QuotedRefPreview — 引用内容预览卡片
 * 
 * 显示在输入框上方，表示当前正在引用某个图片/视频结果。
 * 点击 × 可取消引用。
 */

import { X, Image as ImageIcon, Video, MessageSquare } from 'lucide-react';
import type { QuotedReference } from '../../types';

interface QuotedRefPreviewProps {
  quotedRef: QuotedReference;
  onRemove: () => void;
}

export function QuotedRefPreview({ quotedRef, onRemove }: QuotedRefPreviewProps) {
  const isImage = quotedRef.type === 'image';
  const isMessage = quotedRef.type === 'message';

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/5 border border-primary/20 rounded-lg text-sm animate-in fade-in slide-in-from-bottom-2 duration-200">
      {/* 缩略图 */}
      {quotedRef.thumbnailUrl ? (
        <img
          src={quotedRef.thumbnailUrl}
          alt="引用内容"
          className="w-10 h-10 rounded object-cover flex-shrink-0 border border-border/50"
        />
      ) : (
        <div className="w-10 h-10 rounded bg-muted flex items-center justify-center flex-shrink-0">
          {isImage ? (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          ) : isMessage ? (
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          ) : (
            <Video className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      )}

      {/* 标签 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-medium text-primary/70 bg-primary/10 px-1.5 py-0.5 rounded">
            {isImage ? '引用图片' : isMessage ? '引用消息' : '引用视频'}
          </span>
        </div>
        <div className="text-xs text-muted-foreground truncate mt-0.5">
          {quotedRef.label}
        </div>
      </div>

      {/* 关闭按钮 */}
      <button
        onClick={onRemove}
        className="flex-shrink-0 p-1 rounded-full hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
