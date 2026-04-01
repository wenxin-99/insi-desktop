/**
 * ConversationList — 左侧对话列表
 * 
 * 修复：流式输出时对话列表闪烁
 * 
 * 根因：
 * 1. ConversationItem 定义在渲染函数内 → 每次重渲染都创建新组件类型 → memo 失效
 * 2. ConversationList 接收整个 state → streamedContent 每个 chunk 都变 → 每秒重渲染几十次
 * 
 * 修复方案：
 * 1. ConversationItem 移到模块级别（只创建一次）
 * 2. ConversationList 用 memo 包裹，只在 conversations/selectedId 真正变化时重渲染
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BackgroundTaskBadge } from '@/components/BackgroundTaskIndicator';
import { FishCoinBalance } from '@/components/FishCoinBalance';
import { Plus, Download, Trash2, Tag, X, MoreHorizontal, Search, Share2, FolderOpen, Pin, Archive, ChevronDown } from 'lucide-react';
import { memo, useCallback, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { trpc } from '@/lib/trpc';
import type { ChatStateReturn } from '../types';

// ═══════════ 时间分组工具函数 ═══════════

function groupByTime(conversations: any[]): { label: string; items: any[] }[] {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 86400000);
  const week = new Date(today.getTime() - 7 * 86400000);
  const month = new Date(today.getTime() - 30 * 86400000);

  // 置顶对话单独分组（置顶优先于归档）
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

// ═══════════ 模块级 ConversationItem（只创建一次，memo 生效） ═══════════

export interface ConversationItemProps {
  conv: any;
  onSelect: () => void;
  isMobile?: boolean;
  isSelected: boolean;
  onDelete: (id: number) => void;
  onExport: (id: number) => void;
  onExportPdf: (id: number) => void;
  onManageTags: (id: number) => void;
  onShare: (id: number) => void;
  onPin?: (id: number, pinned: boolean) => void;
  onArchive?: (id: number, archived: boolean) => void;
  onCloseMobileSidebar?: () => void;
}

export const ConversationItem = memo(function ConversationItem({
  conv, onSelect, isMobile, isSelected,
  onDelete, onExport, onExportPdf, onManageTags, onShare, onPin, onArchive, onCloseMobileSidebar,
}: ConversationItemProps) {
  return (
    <div
      className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between group ${
        isSelected ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
      }`}
      onClick={onSelect}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          {conv.pinned && <Pin className={`w-3 h-3 flex-shrink-0 ${isSelected ? 'text-primary-foreground/70' : 'text-primary'}`} />}
          <div className="text-sm font-medium truncate" title={conv.title}>{conv.title}</div>
          <BackgroundTaskBadge conversationId={conv.id} />
        </div>
        <div className={`flex items-center gap-1 mt-1 ${isMobile ? 'flex-wrap' : ''}`}>
          <span className="text-xs opacity-70">
            {new Date(conv.createdAt).toLocaleDateString('zh-CN')}
          </span>
          {/* ★ P0: 项目标记 */}
          {conv.projectId && (
            <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-primary/8 text-primary/70">
              <FolderOpen className="w-2.5 h-2.5" />
              项目
            </span>
          )}
          {conv.tags && conv.tags.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              {conv.tags.slice(0, 2).map((tag: any) => (
                <span
                  key={tag.id}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: tag.color + '20', color: tag.color }}
                >
                  {tag.name}
                </span>
              ))}
              {conv.tags.length > 2 && (
                <span className="text-xs opacity-70">+{conv.tags.length - 2}</span>
              )}
            </div>
          )}
        </div>
      </div>
      {/* 操作菜单 */}
      <div
        className={isMobile ? '' : 'opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity'}
        onClick={(e) => e.stopPropagation()}
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="hover:bg-transparent h-8 w-8 p-0" onClick={(e) => e.stopPropagation()}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onPin && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onPin(conv.id, !conv.pinned);
                if (isMobile && onCloseMobileSidebar) onCloseMobileSidebar();
              }}>
                <Pin className="h-4 w-4 mr-2" />{conv.pinned ? '取消置顶' : '置顶'}
              </DropdownMenuItem>
            )}
            {onArchive && (
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation();
                onArchive(conv.id, !conv.archived);
                if (isMobile && onCloseMobileSidebar) onCloseMobileSidebar();
              }}>
                <Archive className="h-4 w-4 mr-2" />{conv.archived ? '取消归档' : '归档'}
              </DropdownMenuItem>
            )}
            {(onPin || onArchive) && <DropdownMenuSeparator />}
            <DropdownMenuItem onClick={(e) => {
              e.stopPropagation();
              onManageTags(conv.id);
              if (isMobile && onCloseMobileSidebar) onCloseMobileSidebar();
            }}>
              <Tag className="h-4 w-4 mr-2" />管理标签
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              onExport(conv.id);
              if (isMobile && onCloseMobileSidebar) onCloseMobileSidebar();
            }}>
              <Download className="h-4 w-4 mr-2" />导出为Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              onExportPdf(conv.id);
              if (isMobile && onCloseMobileSidebar) onCloseMobileSidebar();
            }}>
              <Download className="h-4 w-4 mr-2" />导出为PDF
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => {
              onShare(conv.id);
              if (isMobile && onCloseMobileSidebar) onCloseMobileSidebar();
            }}>
              <Share2 className="h-4 w-4 mr-2" />分享对话
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={(e) => {
                e.stopPropagation();
                onDelete(conv.id);
                if (isMobile && onCloseMobileSidebar) onCloseMobileSidebar();
              }}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />删除对话
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
});

// ═══════════ 空状态 ═══════════

const EmptyState = memo(function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-sm text-muted-foreground text-center py-8">
      暂无对话历史<br />{text}
    </div>
  );
});

// ═══════════ 主组件 ═══════════

interface ConversationListProps {
  state: ChatStateReturn;
  handleCreateConversation: () => void;
  handleDeleteConversation: (id: number) => void;
  handleExportConversation: (id: number) => Promise<void>;
  handleExportPdf: (id: number) => void;
  handleShareConversation: (id: number) => void;
  loadConversationMessages: (id: number, options?: { forceRefresh?: boolean }) => Promise<void>;
}

export const ConversationList = memo(function ConversationList({
  state, handleCreateConversation, handleDeleteConversation,
  handleExportConversation, handleExportPdf, handleShareConversation, loadConversationMessages,
}: ConversationListProps) {
  const { t } = useTranslation();
  const {
    selectedConversationId, setSelectedConversationId,
    showMobileSidebar, setShowMobileSidebar,
    isHistoryCollapsed, setIsHistoryCollapsed,
    setManagingTagsForConversation, setShowTagManagement,
    conversations,
    currentProjectId, setCurrentProjectId,
    balance, refetchBalance, isLoadingBalance,
    createConversationMutation,
    refetchConversations,
  } = state;

  // ★ P0-1: 置顶/归档 mutation
  const pinMutation = trpc.conversation.pin.useMutation({
    onSuccess: () => refetchConversations(),
  });
  const archiveMutation = trpc.conversation.archive.useMutation({
    onSuccess: () => refetchConversations(),
  });

  // ★ P0-1: 归档区折叠状态
  const [showArchived, setShowArchived] = useState(false);

  const handleManageTags = useCallback((convId: number) => {
    setManagingTagsForConversation(convId);
    setShowTagManagement(true);
  }, [setManagingTagsForConversation, setShowTagManagement]);

  const handlePin = useCallback((id: number, pinned: boolean) => {
    pinMutation.mutate({ id, pinned });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate is stable
  }, []);

  const handleArchive = useCallback((id: number, archived: boolean) => {
    archiveMutation.mutate({ id, archived });
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mutate is stable
  }, []);

  const closeMobileSidebar = useCallback(() => {
    setShowMobileSidebar(false);
  }, [setShowMobileSidebar]);

  // ★ P0-1: 对话按时间分组
  const groupedConversations = useMemo(() => {
    const filtered = conversations?.filter((conv: any) => !currentProjectId || conv.projectId === currentProjectId) || [];
    return groupByTime(filtered);
  }, [conversations, currentProjectId]);

  const renderGroupedList = (isMobile: boolean) => {
    if (groupedConversations.length === 0) {
      return currentProjectId
        ? <EmptyState text="当前项目没有对话" />
        : <EmptyState text={t('chat.clickNewToStart')} />;
    }

    return groupedConversations.map((group) => {
      const isArchivedGroup = group.label === '🗄️ 已归档';

      return (
        <div key={group.label}>
          {/* 分组标题 */}
          <div
            className={`sticky top-0 z-10 flex items-center gap-1 px-1 py-1.5 text-xs font-medium text-muted-foreground bg-card/95 backdrop-blur-sm ${isArchivedGroup ? 'cursor-pointer hover:text-foreground' : ''}`}
            onClick={isArchivedGroup ? () => setShowArchived(!showArchived) : undefined}
          >
            <span>{group.label}</span>
            <span className="text-[10px] opacity-60">({group.items.length})</span>
            {isArchivedGroup && (
              <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showArchived ? 'rotate-180' : ''}`} />
            )}
          </div>
          {/* 该组对话列表 */}
          {(!isArchivedGroup || showArchived) && (
            <div className="space-y-1">
              {group.items.map((conv: any) => (
                <ConversationItem
                  key={conv.id} conv={conv} isMobile={isMobile} isSelected={selectedConversationId === conv.id}
                  onSelect={() => {
                    setSelectedConversationId(conv.id);
                    loadConversationMessages(conv.id);
                    if (isMobile) closeMobileSidebar();
                  }}
                  onDelete={handleDeleteConversation}
                  onExport={(id) => handleExportConversation(id)}
                  onExportPdf={handleExportPdf}
                  onManageTags={handleManageTags}
                  onShare={handleShareConversation}
                  onPin={handlePin}
                  onArchive={handleArchive}
                  onCloseMobileSidebar={isMobile ? closeMobileSidebar : undefined}
                />
              ))}
            </div>
          )}
        </div>
      );
    });
  };

  return (
    <>
      {/* ═══════════ 对话列表抽屉（移动端+桌面端通用） ═══════════ */}
      {showMobileSidebar && (
        <div className="fixed inset-0 z-50">
          {/* 背景遮罩 */}
          <div className="absolute inset-0 bg-black/50" onClick={closeMobileSidebar} />
          {/* 侧边栏内容 */}
          <Card className="absolute left-0 top-0 bottom-0 w-80 max-w-[85vw] flex flex-col shadow-xl">
            <CardContent className="p-4 overflow-y-auto flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold">对话历史</h3>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => {
                    closeMobileSidebar();
                    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true })), 100);
                  }} title="搜索对话">
                    <Search className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={closeMobileSidebar}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex items-center justify-between mb-3 gap-2">
                <FishCoinBalance showSyncButton={true} onBalanceUpdate={() => refetchBalance()} balance={balance?.balance} loading={isLoadingBalance} size="sm" showIcon={true} />
                <Button
                  onClick={() => { handleCreateConversation(); closeMobileSidebar(); }}
                  size="sm" variant="outline" className="flex items-center gap-1.5 h-8"
                  disabled={createConversationMutation.isPending}
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span className="text-xs">新对话</span>
                </Button>
              </div>
              {/* ★ P2: 项目过滤提示 */}
              {currentProjectId && (
                <div className="flex items-center gap-1.5 mb-2 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/10 text-xs text-primary/80">
                  <FolderOpen className="w-3 h-3 shrink-0" />
                  <span className="truncate">仅显示当前项目对话</span>
                  <button onClick={() => setCurrentProjectId(null)} className="ml-auto hover:text-primary">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
              <div className="space-y-1">
                {renderGroupedList(true)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ═══════════ 桌面端对话列表 — 隐藏独立面板，统一用抽屉 ═══════════ */}
      {/* ★ 方案A: 不再显示独立面板。桌面端通过 ChatToolbar 的按钮触发 showMobileSidebar 打开抽屉 */}
    </>
  );
}, (prev, next) => {
  // 只在对话列表相关数据变化时重渲染，忽略 streamedContent/messages 等高频变化
  const ps = prev.state, ns = next.state;
  return (
    ps.conversations === ns.conversations &&
    ps.selectedConversationId === ns.selectedConversationId &&
    ps.currentProjectId === ns.currentProjectId &&
    ps.showMobileSidebar === ns.showMobileSidebar &&
    ps.isHistoryCollapsed === ns.isHistoryCollapsed &&
    ps.balance === ns.balance &&
    ps.isLoadingBalance === ns.isLoadingBalance &&
    ps.createConversationMutation?.isPending === ns.createConversationMutation?.isPending &&
    prev.handleCreateConversation === next.handleCreateConversation &&
    prev.handleDeleteConversation === next.handleDeleteConversation &&
    prev.handleShareConversation === next.handleShareConversation
  );
});
