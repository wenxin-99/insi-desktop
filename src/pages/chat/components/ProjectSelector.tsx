/**
 * ProjectSelector — 聊天页项目指示器 + 选择器
 *
 * 紧凑标签式设计，显示当前对话所属项目。
 * 点击展开下拉菜单可：切换项目 / 取消关联 / 查看项目。
 * 在 ChatToolbar 中使用。
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { FolderOpen, X, ChevronDown, ExternalLink } from 'lucide-react';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProjectSelectorProps {
  conversationId: number | null;
  currentProjectId: number | null;
  onProjectChange?: (projectId: number | null) => void;
}

export function ProjectSelector({ conversationId, currentProjectId, onProjectChange }: ProjectSelectorProps) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const utils = trpc.useUtils();

  const { data: projects } = trpc.project.list.useQuery(undefined, {
    staleTime: 60_000,
  });

  const addChatMutation = trpc.project.addChat.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
      utils.conversation.getAll.invalidate();
      toast.success('对话已关联到项目');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeChatMutation = trpc.project.removeChat.useMutation({
    onSuccess: () => {
      utils.project.list.invalidate();
      utils.conversation.getAll.invalidate();
      onProjectChange?.(null);
      toast.success('已取消项目关联');
    },
    onError: (e: any) => toast.error(e.message),
  });

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  const currentProject = projects?.find((p: any) => p.id === currentProjectId);

  const handleSelect = useCallback((projectId: number) => {
    if (!conversationId) {
      // 未创建对话时，仅设置 state，待创建时传入
      onProjectChange?.(projectId);
      setOpen(false);
      return;
    }
    // 如果选的是当前项目，不做操作
    if (projectId === currentProjectId) {
      setOpen(false);
      return;
    }
    // addConversationToProject 本身就是 UPDATE SET projectId = ?
    // 直接 add 即可覆盖旧项目，不需要先 remove
    addChatMutation.mutate({ projectId, conversationId });
    onProjectChange?.(projectId);
    setOpen(false);
  }, [conversationId, currentProjectId, addChatMutation, onProjectChange]);

  const handleRemove = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    if (!conversationId) {
      onProjectChange?.(null);
      setOpen(false);
      return;
    }
    removeChatMutation.mutate({ conversationId });
    setOpen(false);
  }, [conversationId, removeChatMutation, onProjectChange]);

  // 没有项目时不显示
  if (!projects || projects.length === 0) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-all',
          'hover:shadow-sm active:scale-[0.97]',
          currentProject
            ? 'text-foreground border'
            : 'text-muted-foreground hover:bg-accent hover:text-foreground'
        )}
        style={currentProject ? {
          backgroundColor: currentProject.color + '10',
          borderColor: currentProject.color + '30',
        } : undefined}
      >
        <FolderOpen
          className="w-3.5 h-3.5 shrink-0"
          style={currentProject ? { color: currentProject.color } : undefined}
        />
        <span className="truncate max-w-[100px]">
          {currentProject ? currentProject.name : '选择项目'}
        </span>
        {currentProject ? (
          <X
            className="w-3 h-3 shrink-0 opacity-40 hover:opacity-100 transition-opacity"
            onClick={handleRemove}
          />
        ) : (
          <ChevronDown className={cn('w-3 h-3 shrink-0 transition-transform', open && 'rotate-180')} />
        )}
      </button>

      {/* 下拉菜单 */}
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 min-w-[220px] max-w-[300px] bg-popover border border-border rounded-xl shadow-xl py-1.5 max-h-[320px] overflow-y-auto animate-in fade-in-0 zoom-in-95 duration-150">
          {/* 取消关联 */}
          {currentProject && conversationId && (
            <>
              <button
                onClick={handleRemove}
                className="w-full px-3 py-2 text-left text-xs text-destructive hover:bg-destructive/10 flex items-center gap-2 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                取消项目关联
              </button>
              <div className="h-px bg-border mx-2 my-1" />
            </>
          )}

          {/* 项目列表 */}
          {projects.map((p: any) => {
            const isActive = p.id === currentProjectId;
            return (
              <button
                key={p.id}
                onClick={() => handleSelect(p.id)}
                className={cn(
                  'w-full px-3 py-2 text-left text-xs flex items-center gap-2.5 transition-colors',
                  isActive
                    ? 'bg-accent font-medium'
                    : 'hover:bg-accent/60'
                )}
              >
                <div
                  className="w-6 h-6 rounded-md flex items-center justify-center shrink-0"
                  style={{ backgroundColor: p.color + '18', color: p.color }}
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate">{p.name}</div>
                  {p.description && (
                    <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                      {p.description}
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                  {p.chatCount}
                </span>
              </button>
            );
          })}

          {/* 底部链接 */}
          <div className="h-px bg-border mx-2 my-1" />
          <a
            href="/projects"
            className="w-full px-3 py-2 text-left text-xs text-muted-foreground hover:text-foreground hover:bg-accent/60 flex items-center gap-2 transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            管理所有项目
          </a>
        </div>
      )}
    </div>
  );
}
