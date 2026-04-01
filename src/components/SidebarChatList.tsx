/**
 * SidebarChatList — 全局侧边栏内的对话列表（独立组件）
 *
 * 不依赖 Chat.tsx 的状态，自己通过 tRPC 获取数据。
 * 通过 CustomEvent 与 Chat.tsx 双向通信：
 *   - 选择对话: dispatch 'sidebar:selectConversation'
 *   - 新建对话: dispatch 'sidebar:createConversation'
 *   - 删除对话: dispatch 'sidebar:deleteConversation'
 *   - Chat.tsx 状态变化: 监听 'chat:stateSync'
 *
 * tRPC React Query 自动去重：和 Chat.tsx 用同一个 queryKey，不会重复请求。
 *
 * ★ P0-1: 时间分组 + 置顶/归档
 */

import { memo, useCallback, useState, useEffect, useMemo } from 'react';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { FishCoinBalance } from '@/components/FishCoinBalance';
import { BackgroundTaskBadge } from '@/components/BackgroundTaskIndicator';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Plus, Search, MessageSquare, MoreHorizontal,
  Download, Trash2, Tag, Share2, Pin, Archive, ChevronDown, FolderOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';

// ═══════ 时间分组 ═══════

function groupByTime(conversations: any[]): { label: string; items: any[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const week = new Date(today.getTime() - 7 * 86400000);
  const month = new Date(today.getTime() - 30 * 86400000);

  const pinned = conversations.filter((c: any) => c.pinned);
  const unpinned = conversations.filter((c: any) => !c.pinned && !c.archived);
  const archived = conversations.filter((c: any) => c.archived && !c.pinned);

  const groups: { label: string; items: any[] }[] = [];

  if (pinned.length > 0) {
    groups.push({ label: '📌 置顶', items: pinned });
  }

  const timeGroups = [
    { label: '今天', items: [] as any[] },
    { label: '昨天', items: [] as any[] },
    { label: '过去 7 天', items: [] as any[] },
    { label: '过去 30 天', items: [] as any[] },
    { label: '更早', items: [] as any[] },
  ];

  for (const conv of unpinned) {
    const d = new Date(conv.updatedAt || conv.createdAt);
    if (d >= today) timeGroups[0].items.push(conv);
    else if (d >= yesterday) timeGroups[1].items.push(conv);
    else if (d >= week) timeGroups[2].items.push(conv);
    else if (d >= month) timeGroups[3].items.push(conv);
    else timeGroups[4].items.push(conv);
  }

  for (const g of timeGroups) {
    if (g.items.length > 0) groups.push(g);
  }

  if (archived.length > 0) {
    groups.push({ label: '🗄️ 已归档', items: archived });
  }

  return groups;
}

// ═══════ 对话项 ═══════
const ConvItem = memo(function ConvItem({
  conv, isSelected, onSelect, onDelete, onExport, onShare,
  onPin, onArchive, onManageTags, closeSidebar,
}: {
  conv: any;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: (id: number) => void;
  onExport: (id: number) => void;
  onShare: (id: number) => void;
  onPin: (id: number, pinned: boolean) => void;
  onArchive: (id: number, archived: boolean) => void;
  onManageTags: (id: number) => void;
  closeSidebar?: () => void;
}) {
  return (
    <div
      className={`px-2.5 py-2 rounded-lg cursor-pointer transition-colors flex items-center justify-between group ${
        isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      }`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {conv.pinned && <Pin className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-primary-foreground/70' : 'text-primary'}`} />}
          <span className="text-sm font-medium truncate">{conv.title}</span>
          <BackgroundTaskBadge conversationId={conv.id} />
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className="text-[11px] opacity-60">
            {new Date(conv.createdAt).toLocaleDateString('zh-CN')}
          </span>
          {conv.projectId && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1 py-0.5 rounded bg-primary/8 text-primary/70">
              <FolderOpen className="w-2.5 h-2.5" />
            </span>
          )}
          {conv.tags?.slice(0, 2).map((tag: any) => (
            <span
              key={tag.id}
              className="text-[10px] px-1 py-0.5 rounded"
              style={{ backgroundColor: tag.color + '20', color: tag.color }}
            >
              {tag.name}
            </span>
          ))}
        </div>
      </div>
      <div
        className="opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-transparent">
              <MoreHorizontal className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onPin(conv.id, !conv.pinned); }}>
              <Pin className="h-3.5 w-3.5 mr-2" />{conv.pinned ? '取消置顶' : '置顶'}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(conv.id, !conv.archived); }}>
              <Archive className="h-3.5 w-3.5 mr-2" />{conv.archived ? '取消归档' : '归档'}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onManageTags(conv.id); closeSidebar?.(); }}>
              <Tag className="h-3.5 w-3.5 mr-2" />管理标签
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onExport(conv.id); closeSidebar?.(); }}>
              <Download className="h-3.5 w-3.5 mr-2" />导出
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => { onShare(conv.id); closeSidebar?.(); }}>
              <Share2 className="h-3.5 w-3.5 mr-2" />分享
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => { onDelete(conv.id); closeSidebar?.(); }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-3.5 w-3.5 mr-2" />删除
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

// ═══════ 主组件 ═══════
export function SidebarChatList({ closeSidebar }: { closeSidebar?: () => void }) {
  const confirm = useConfirm();

  // ★ 独立 tRPC 查询（React Query 自动去重，不会重复请求）
  const { data: conversations, refetch } = trpc.conversation.getAll.useQuery();
  const { data: balance, refetch: refetchBalance, isLoading: isLoadingBalance } = trpc.fishCoin.getBalance.useQuery();
  const deleteMutation = trpc.conversation.delete.useMutation({
    onSuccess: () => { refetch(); toast.success('对话已删除'); },
    onError: (e) => toast.error(e.message || '删除失败'),
  });
  const pinMutation = trpc.conversation.pin.useMutation({
    onSuccess: () => refetch(),
    onError: (e: any) => toast.error(e.message || '操作失败'),
  });
  const archiveMutation = trpc.conversation.archive.useMutation({
    onSuccess: () => refetch(),
    onError: (e: any) => toast.error(e.message || '操作失败'),
  });

  // ★ 归档区折叠
  const [showArchived, setShowArchived] = useState(false);

  // ★ 从 Chat.tsx 同步 selectedConversationId
  const [selectedId, setSelectedId] = useState<number | null>(() => {
    const saved = localStorage.getItem('selectedConversationId');
    return saved ? parseInt(saved, 10) : null;
  });

  // 监听 Chat.tsx 的状态同步事件
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.selectedConversationId !== undefined) {
        setSelectedId(detail.selectedConversationId);
      }
    };
    window.addEventListener('chat:stateSync', handler);
    return () => window.removeEventListener('chat:stateSync', handler);
  }, []);

  // 监听 localStorage 变化（跨标签页 + 同标签页）
  useEffect(() => {
    const handler = () => {
      const saved = localStorage.getItem('selectedConversationId');
      setSelectedId(saved ? parseInt(saved, 10) : null);
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  // ★ P0-1: 时间分组
  const grouped = useMemo(() => groupByTime(conversations || []), [conversations]);

  const handleSelect = useCallback((id: number) => {
    setSelectedId(id);
    window.dispatchEvent(new CustomEvent('sidebar:selectConversation', { detail: { id } }));
    closeSidebar?.();
  }, [closeSidebar]);

  const handleCreate = useCallback(() => {
    window.dispatchEvent(new CustomEvent('sidebar:createConversation'));
    closeSidebar?.();
  }, [closeSidebar]);

  const handleDelete = useCallback(async (id: number) => {
    const ok = await confirm({
      title: '删除对话',
      description: '确定要删除这条对话吗？此操作无法撤销。',
      confirmText: '删除',
      variant: 'destructive',
    });
    if (ok) {
      deleteMutation.mutate({ id });
      if (selectedId === id) {
        window.dispatchEvent(new CustomEvent('sidebar:deleteConversation', { detail: { id } }));
      }
    }
  }, [confirm, deleteMutation, selectedId]);

  const handleExport = useCallback((id: number) => {
    window.dispatchEvent(new CustomEvent('sidebar:exportConversation', { detail: { id } }));
  }, []);

  const handleShare = useCallback((id: number) => {
    window.dispatchEvent(new CustomEvent('sidebar:shareConversation', { detail: { id } }));
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate is stable
  const handlePin = useCallback((id: number, pinned: boolean) => {
    pinMutation.mutate({ id, pinned });
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate is stable
  const handleArchive = useCallback((id: number, archived: boolean) => {
    archiveMutation.mutate({ id, archived });
  }, []);

  const handleManageTags = useCallback((id: number) => {
    window.dispatchEvent(new CustomEvent('sidebar:manageTags', { detail: { id } }));
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* ═══ 头部 ═══ */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2 border-b border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5 text-primary" />
            <span className="text-sm font-semibold">对话</span>
          </div>
          <div className="flex items-center gap-0.5">
            <Button
              variant="ghost" size="sm" className="h-7 w-7 p-0"
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              title="搜索 (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
            <Button onClick={handleCreate} size="sm" className="h-7 gap-1 px-2 text-xs">
              <Plus className="h-3 w-3" />
              新建
            </Button>
          </div>
        </div>
        <FishCoinBalance
          showSyncButton onBalanceUpdate={() => refetchBalance()}
          balance={balance?.balance} loading={isLoadingBalance} size="sm" showIcon
        />
      </div>

      {/* ═══ 对话列表（时间分组） ═══ */}
      <div className="flex-1 overflow-y-auto px-1.5 py-1 space-y-0.5" style={{ overscrollBehavior: 'contain' }}>
        {grouped.length > 0 ? (
          grouped.map((group) => {
            const isArchivedGroup = group.label === '🗄️ 已归档';
            return (
              <div key={group.label}>
                {/* 分组标题 */}
                <div
                  className={`sticky top-0 z-10 flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium text-muted-foreground/70 bg-background/95 backdrop-blur-sm ${isArchivedGroup ? 'cursor-pointer hover:text-foreground' : ''}`}
                  onClick={isArchivedGroup ? () => setShowArchived(!showArchived) : undefined}
                >
                  <span>{group.label}</span>
                  <span className="text-[10px] opacity-50">({group.items.length})</span>
                  {isArchivedGroup && (
                    <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showArchived ? 'rotate-180' : ''}`} />
                  )}
                </div>
                {/* 该组对话 */}
                {(!isArchivedGroup || showArchived) && (
                  <div className="space-y-0.5">
                    {group.items.map((conv: any) => (
                      <ConvItem
                        key={conv.id}
                        conv={conv}
                        isSelected={selectedId === conv.id}
                        onSelect={() => handleSelect(conv.id)}
                        onDelete={handleDelete}
                        onExport={handleExport}
                        onShare={handleShare}
                        onPin={handlePin}
                        onArchive={handleArchive}
                        onManageTags={handleManageTags}
                        closeSidebar={closeSidebar}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div className="text-sm text-muted-foreground/60 text-center py-12">
            暂无对话<br />
            <span className="text-xs">点击上方"新建"开始</span>
          </div>
        )}
      </div>
    </div>
  );
}
