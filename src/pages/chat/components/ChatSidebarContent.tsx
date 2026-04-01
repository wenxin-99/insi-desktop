/**
 * ChatSidebarContent — 内嵌在全局侧边栏中的对话列表
 *
 * 当用户在聊天页时，全局侧边栏的内容自动替换为对话历史列表。
 * 复用 ConversationItem 组件和所有操作逻辑。
 */

import { memo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { FishCoinBalance } from '@/components/FishCoinBalance';
import { ConversationItem } from './ConversationList';
import { Plus, Search, MessageSquare, FolderOpen, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { ChatStateReturn } from '../types';

interface ChatSidebarContentProps {
  state: ChatStateReturn;
  handleCreateConversation: () => void;
  handleDeleteConversation: (id: number) => void;
  handleExportConversation: (id: number) => Promise<void>;
  handleExportPdf: (id: number) => void;
  handleShareConversation: (id: number) => void;
  loadConversationMessages: (id: number, options?: { forceRefresh?: boolean }) => Promise<void>;
  /** 关闭移动端侧边栏 sheet */
  onCloseMobileSidebar?: () => void;
}

export const ChatSidebarContent = memo(function ChatSidebarContent({
  state, handleCreateConversation, handleDeleteConversation,
  handleExportConversation, handleExportPdf, handleShareConversation,
  loadConversationMessages, onCloseMobileSidebar,
}: ChatSidebarContentProps) {
  const { t } = useTranslation();
  const {
    selectedConversationId, setSelectedConversationId,
    setManagingTagsForConversation, setShowTagManagement,
    conversations,
    currentProjectId, setCurrentProjectId,
    balance, refetchBalance, isLoadingBalance,
    createConversationMutation,
  } = state;

  const handleManageTags = useCallback((convId: number) => {
    setManagingTagsForConversation(convId);
    setShowTagManagement(true);
  }, [setManagingTagsForConversation, setShowTagManagement]);

  return (
    <div className="flex flex-col h-full">
      {/* ═══ 固定头部 ═══ */}
      <div className="flex-shrink-0 px-3 pt-3 pb-2 space-y-2.5 border-b border-border/40">
        {/* 标题行 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">对话</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost" size="sm"
              className="h-7 w-7 p-0"
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }));
              }}
              title="搜索对话 (Ctrl+K)"
            >
              <Search className="h-3.5 w-3.5" />
            </Button>
            <Button
              onClick={handleCreateConversation}
              disabled={createConversationMutation.isPending}
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              新对话
            </Button>
          </div>
        </div>
        {/* 余额 */}
        <FishCoinBalance
          showSyncButton={true}
          onBalanceUpdate={() => refetchBalance()}
          balance={balance?.balance}
          loading={isLoadingBalance}
          size="sm"
          showIcon={true}
        />
      </div>

      {/* ═══ 可滚动对话列表 ═══ */}
      <div className="flex-1 overflow-y-auto px-2 py-1.5 space-y-0.5" style={{ overscrollBehavior: 'contain' }}>
        {/* ★ P2: 项目过滤提示 */}
        {currentProjectId && (
          <div className="flex items-center gap-1.5 mb-1.5 px-2 py-1.5 rounded-md bg-primary/5 border border-primary/10 text-[11px] text-primary/80">
            <FolderOpen className="w-3 h-3 shrink-0" />
            <span className="truncate">仅显示项目对话</span>
            <button onClick={() => setCurrentProjectId(null)} className="ml-auto hover:text-primary">
              <X className="w-3 h-3" />
            </button>
          </div>
        )}
        {(() => {
          const filtered = conversations?.filter((conv: any) => !currentProjectId || conv.projectId === currentProjectId) || [];
          if (filtered.length === 0) {
            return (
              <div className="text-sm text-muted-foreground text-center py-8">
                {currentProjectId ? '当前项目没有对话' : <>暂无对话历史<br />{t('chat.clickNewToStart')}</>}
              </div>
            );
          }
          return filtered.map((conv: any) => (
            <ConversationItem
              key={conv.id}
              conv={conv}
              isSelected={selectedConversationId === conv.id}
              onSelect={() => {
                setSelectedConversationId(conv.id);
                loadConversationMessages(conv.id);
                onCloseMobileSidebar?.();
              }}
              onDelete={handleDeleteConversation}
              onExport={(id) => handleExportConversation(id)}
              onExportPdf={handleExportPdf}
              onManageTags={handleManageTags}
              onShare={handleShareConversation}
              onCloseMobileSidebar={onCloseMobileSidebar}
            />
          ));
        })()}
      </div>
    </div>
  );
}, (prev, next) => {
  const ps = prev.state, ns = next.state;
  return (
    ps.conversations === ns.conversations &&
    ps.selectedConversationId === ns.selectedConversationId &&
    ps.currentProjectId === ns.currentProjectId &&
    ps.balance === ns.balance &&
    ps.isLoadingBalance === ns.isLoadingBalance &&
    ps.createConversationMutation?.isPending === ns.createConversationMutation?.isPending &&
    prev.handleCreateConversation === next.handleCreateConversation &&
    prev.handleDeleteConversation === next.handleDeleteConversation &&
    prev.handleShareConversation === next.handleShareConversation
  );
});
