/**
 * ChatHeader — 顶部工具栏（重构版）
 * 
 * P0: 使用共享 FilePreviewSheet，消除重复的 Sheet 代码
 * 移除对 showThinkingPanel 的复用
 * ★ P2: 分享对话按钮 + ShareDialog
 */
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Link } from 'wouter';
import { Menu, Plus, Brain, Headphones, Zap, Share2 } from 'lucide-react';
import { FishCoinBalance } from '@/components/FishCoinBalance';
import { FilePreviewSheet } from '@/components/FilePreviewSheet';
import { ShareDialog } from '@/components/ShareDialog';
import { toast } from 'sonner';
import type { PreviewFile } from '@/components/FilePreviewPanel';

interface ChatHeaderProps {
  selectedConversationId: number | null;
  selectedPackageId: number | null;
  conversationTitle?: string;
  thinkingMode: boolean;
  autoMode: boolean;
  previewFile: PreviewFile | null;
  modelPackages: any[] | undefined;
  balance: any;
  isLoadingBalance: boolean;
  createConversationIsPending: boolean;
  setSelectedPackageId: (id: number) => void;
  setSelectedModelId: (id: null) => void;
  setShowMobileSidebar: (v: boolean) => void;
  setThinkingMode: (v: boolean) => void;
  setAutoMode: (v: boolean) => void;
  setPreviewFile: (v: null) => void;
  handleCreateConversation: () => void;
  refetchBalance: () => void;
  updatePackageMutation: { mutateAsync: (args: { id: number; packageId: number }) => Promise<any> };
  t: (key: string) => string;
}

export function ChatHeader({
  selectedConversationId,
  selectedPackageId,
  conversationTitle,
  thinkingMode,
  autoMode,
  previewFile,
  modelPackages,
  balance,
  isLoadingBalance,
  createConversationIsPending,
  setSelectedPackageId,
  setSelectedModelId,
  setShowMobileSidebar,
  setThinkingMode,
  setAutoMode,
  setPreviewFile,
  handleCreateConversation,
  refetchBalance,
  updatePackageMutation,
  t,
}: ChatHeaderProps) {

  const [showShareDialog, setShowShareDialog] = useState(false);

  const handlePackageChange = async (value: string) => {
    if (!value) return;
    const newPackageId = Number(value);
    setSelectedPackageId(newPackageId);
    setSelectedModelId(null);
    localStorage.setItem('preferredPackageId', newPackageId.toString());
    if (selectedConversationId) {
      try {
        await updatePackageMutation.mutateAsync({
          id: selectedConversationId,
          packageId: newPackageId,
        });
      } catch (error: any) {
        // ★ 对话不存在（跨用户残留）→ 静默忽略，不阻塞套餐切换
        if (error?.data?.code === 'NOT_FOUND' || error?.message?.includes('对话不存在')) {
          console.warn('[ChatHeader] Stale conversationId during package switch');
        } else {
          console.error("更新对话套餐失败:", error);
          toast.error("切换套餐失败");
        }
      }
    }
  };

  // 套餐下拉选项
  const packageItems = modelPackages && modelPackages
    .filter((pkg: any) => pkg.enabled)
    .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
    .map((pkg: any) => (
      <SelectItem key={pkg.id} value={pkg.id.toString()} className="py-3 cursor-pointer">
        <div className="flex flex-col items-start w-full">
          <div className="font-medium mb-1">{pkg.displayName}</div>
          <div className="text-xs text-muted-foreground">{pkg.description}</div>
        </div>
      </SelectItem>
    ));

  // 深度思考开关
  const thinkingToggle = selectedPackageId && (
    <div
      className={`flex items-center justify-between px-3 py-2.5 mx-1 mt-1 mb-1 rounded-md cursor-pointer transition-colors border ${thinkingMode ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700' : 'hover:bg-accent border-transparent'}`}
      onPointerDown={(e) => { e.preventDefault(); setThinkingMode(!thinkingMode); if (!thinkingMode) setAutoMode(false); }}
    >
      <div className="flex items-center gap-2">
        <Brain className={`h-4 w-4 ${thinkingMode ? 'text-purple-500' : 'text-muted-foreground'}`} />
        <span className={`text-sm font-medium ${thinkingMode ? 'text-purple-700 dark:text-purple-300' : ''}`}>深度思考</span>
      </div>
      <div className={`w-8 h-4.5 rounded-full transition-colors flex items-center ${thinkingMode ? 'bg-purple-500 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'}`}>
        <div className="w-3.5 h-3.5 bg-white rounded-full mx-0.5 shadow-sm" />
      </div>
    </div>
  );

  // ★ Auto Mode 开关
  const autoToggle = selectedPackageId && (
    <div
      className={`flex items-center justify-between px-3 py-2.5 mx-1 mb-1 rounded-md cursor-pointer transition-colors border ${autoMode ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700' : 'hover:bg-accent border-transparent'}`}
      onPointerDown={(e) => { e.preventDefault(); setAutoMode(!autoMode); if (!autoMode) setThinkingMode(false); }}
    >
      <div className="flex items-center gap-2">
        <Zap className={`h-4 w-4 ${autoMode ? 'text-blue-500' : 'text-muted-foreground'}`} />
        <div className="flex flex-col">
          <span className={`text-sm font-medium ${autoMode ? 'text-blue-700 dark:text-blue-300' : ''}`}>Auto</span>
          <span className="text-[10px] text-muted-foreground leading-tight">自动选择模型</span>
        </div>
      </div>
      <div className={`w-8 h-4.5 rounded-full transition-colors flex items-center ${autoMode ? 'bg-blue-500 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'}`}>
        <div className="w-3.5 h-3.5 bg-white rounded-full mx-0.5 shadow-sm" />
      </div>
    </div>
  );

  const handleClosePreview = () => setPreviewFile(null);

  return (
    <>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 md:mb-2 flex-shrink-0 gap-2 md:gap-3">
          <div className="flex items-center gap-3 md:gap-4 flex-shrink-0 w-full md:w-auto">
            {/* 移动端汉堡菜单 */}
            <Button
              variant="ghost" size="sm"
              className="md:hidden flex-shrink-0"
              onClick={() => setShowMobileSidebar(true)}
              style={{marginRight: '-8px', marginBottom: '-2px', marginLeft: '-13px'}}
            >
              <Menu className="h-5 w-5" />
            </Button>
            {/* 移动端鱼币余额 */}
            <div className="md:hidden flex-shrink-0">
              <FishCoinBalance
                showSyncButton={false}
                onBalanceUpdate={() => refetchBalance()} 
                balance={balance?.balance}
                loading={isLoadingBalance}
                size="sm" showIcon={true}
              />
            </div>
            {/* 桌面端鱼币余额 */}
            <div className="hidden md:flex flex-shrink-0 ml-auto md:ml-0">
              <FishCoinBalance
                showSyncButton={true}
                onBalanceUpdate={() => refetchBalance()} 
                balance={balance?.balance}
                loading={isLoadingBalance}
                size="sm" showIcon={true}
              />
            </div>
            {/* 移动端套餐选择器 */}
            <div className="md:hidden flex-1 min-w-0">
              <Select
                value={selectedPackageId?.toString() || ""}
                onValueChange={handlePackageChange}
              >
                <SelectTrigger className="text-sm h-[34px] w-full" style={{paddingLeft: '8px', paddingRight: '4px'}}>
                  <div className="font-medium truncate flex items-center gap-1">
                    {selectedPackageId
                      ? modelPackages?.find((p: any) => p.id === selectedPackageId)?.displayName || '选择套餐'
                      : '选择套餐'}
                    {thinkingMode && <Brain className="h-3 w-3 text-purple-500 animate-pulse flex-shrink-0" />}
                  </div>
                </SelectTrigger>
                <SelectContent className="w-[280px]">
                  {packageItems}
                  {thinkingToggle}
                  {autoToggle}
                </SelectContent>
              </Select>
            </div>
            {/* 移动端文件预览 — 使用共享组件 */}
            <FilePreviewSheet
              previewFile={previewFile}
              onClose={handleClosePreview}
              mobile
            />
            {/* 移动端语音对话 */}
            <Link href={selectedConversationId ? `/voice-chat?conversationId=${selectedConversationId}&from=chat` : "/voice-chat?from=chat"}>
              <Button size="sm" variant="ghost" className="md:hidden h-8 w-8 p-0 flex-shrink-0" title="语音对话">
                <Headphones className="h-4 w-4" />
              </Button>
            </Link>
            {/* 移动端分享 */}
            {selectedConversationId && (
              <Button size="sm" variant="ghost" className="md:hidden h-8 w-8 p-0 flex-shrink-0"
                onClick={() => setShowShareDialog(true)} title="分享对话">
                <Share2 className="h-4 w-4" />
              </Button>
            )}
            {/* 移动端新对话 */}
            <Button
              onClick={handleCreateConversation} size="sm"
              className="md:hidden h-8 w-8 p-0 flex-shrink-0 ml-auto"
              title={t('chat.newConversation')}
              disabled={createConversationIsPending}
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="hidden md:flex items-center gap-2 w-full md:w-auto flex-wrap md:flex-nowrap">
            {/* 分享对话 */}
            {selectedConversationId && (
              <Button size="sm" variant="outline" className="hidden md:flex items-center gap-1.5 h-8"
                onClick={() => setShowShareDialog(true)} title="分享对话">
                <Share2 className="h-3.5 w-3.5" />
                <span className="text-xs">分享</span>
              </Button>
            )}
            {/* 语音对话入口 */}
            <Link href={selectedConversationId ? `/voice-chat?conversationId=${selectedConversationId}&from=chat` : "/voice-chat?from=chat"}>
              <Button size="sm" variant="outline" className="hidden md:flex items-center gap-1.5 h-8" title="语音对话">
                <Headphones className="h-3.5 w-3.5" />
                <span className="text-xs">语音对话</span>
              </Button>
            </Link>
            {/* 模型档次选择器 */}
            <Select
              value={selectedPackageId?.toString() || ""}
              onValueChange={handlePackageChange}
            >
              <SelectTrigger 
                className="text-sm md:text-base h-auto py-2 w-[160px] h-[37px] mt-0 mr-0 mb-0 ml-0 md:w-56 md:h-auto md:mt-0 md:mr-0 md:mb-0 md:ml-0" 
                style={{paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '10px'}}
              >
                <div className="flex flex-col items-start gap-0.5 w-full">
                  <div className="font-medium flex items-center gap-1.5">
                    {selectedPackageId
                      ? modelPackages?.find((p: any) => p.id === selectedPackageId)?.displayName || '选择套餐'
                      : '选择AI模型套餐'}
                    {thinkingMode && <Brain className="h-3.5 w-3.5 text-purple-500 animate-pulse" />}
                  </div>
                  {selectedPackageId && (
                    <div className="text-xs text-muted-foreground truncate max-w-full">
                      {thinkingMode ? '深度思考模式已开启' : (modelPackages?.find((p: any) => p.id === selectedPackageId)?.description || '')}
                    </div>
                  )}
                </div>
              </SelectTrigger>
              <SelectContent className="w-[280px]">
                {packageItems}
                {thinkingToggle}
                {autoToggle}
              </SelectContent>
            </Select>
            <Button onClick={handleCreateConversation} disabled={createConversationIsPending} className="hidden md:flex">
              <Plus className="mr-2 h-4 w-4" />
              {t('chat.newConversation')}
            </Button>
            {/* 桌面端文件预览 — 使用共享组件 */}
            <FilePreviewSheet
              previewFile={previewFile}
              onClose={handleClosePreview}
            />
          </div>
        </div>

      {/* ★ 分享对话弹窗 */}
      <ShareDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        conversationId={selectedConversationId}
        conversationTitle={conversationTitle}
      />
    </>
  );
}
