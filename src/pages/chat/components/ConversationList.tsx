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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { BackgroundTaskBadge } from '@/components/BackgroundTaskIndicator';
import { FishCoinBalance } from '@/components/FishCoinBalance';
import { Plus, Download, Trash2, Tag, X, ChevronLeft, ChevronRight, MoreHorizontal, Search, Share2 } from 'lucide-react';
import { memo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import type { ChatStateReturn } from '../types';

// ═══════════ 模块级 ConversationItem（只创建一次，memo 生效） ═══════════

interface ConversationItemProps {
  conv: any;
  onSelect: () => void;
  isMobile?: boolean;
  isSelected: boolean;
  onDelete: (id: number) => void;
  onExport: (id: number) => void;
  onExportPdf: (id: number) => void;
  onManageTags: (id: number) => void;
  onShare: (id: number) => void;
  onCloseMobileSidebar?: () => void;
}

const ConversationItem = memo(function ConversationItem({
  conv, onSelect, isMobile, isSelected,
  onDelete, onExport, onExportPdf, onManageTags, onShare, onCloseMobileSidebar,
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
          <div className="text-sm font-medium truncate" title={conv.title}>{conv.title}</div>
          <BackgroundTaskBadge conversationId={conv.id} />
        </div>
        <div className={`flex items-center gap-1 mt-1 ${isMobile ? 'flex-wrap' : ''}`}>
          <span className="text-xs opacity-70">
            {new Date(conv.createdAt).toLocaleDateString('zh-CN')}
          </span>
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
    balance, refetchBalance, isLoadingBalance,
    createConversationMutation,
  } = state;

  const handleManageTags = useCallback((convId: number) => {
    setManagingTagsForConversation(convId);
    setShowTagManagement(true);
  }, [setManagingTagsForConversation, setShowTagManagement]);

  const closeMobileSidebar = useCallback(() => {
    setShowMobileSidebar(false);
  }, [setShowMobileSidebar]);

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
              <div className="space-y-2">
                {conversations?.map((conv: any) => (
                  <ConversationItem
                    key={conv.id} conv={conv} isMobile isSelected={selectedConversationId === conv.id}
                    onSelect={() => {
                      setSelectedConversationId(conv.id);
                      loadConversationMessages(conv.id);
                      closeMobileSidebar();
                    }}
                    onDelete={handleDeleteConversation}
                    onExport={(id) => handleExportConversation(id)}
                    onExportPdf={handleExportPdf}
                    onManageTags={handleManageTags}
                    onShare={handleShareConversation}
                    onCloseMobileSidebar={closeMobileSidebar}
                  />
                ))}
                {(!conversations || conversations.length === 0) && <EmptyState text={t('chat.clickNewToStart')} />}
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
