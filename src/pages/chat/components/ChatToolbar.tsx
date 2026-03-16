/**
 * ChatToolbar — 顶部工具栏（重构版）
 * 
 * P0: 使用共享 FilePreviewSheet，消除重复代码
 */
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { FishCoinBalance } from '@/components/FishCoinBalance';
import { FilePreviewSheet } from '@/components/FilePreviewSheet';
import { useSidebar } from '@/components/ui/sidebar';
import { Menu, Plus, Headphones, Brain, LayoutDashboard } from 'lucide-react';
import { toast } from 'sonner';
import type { ChatStateReturn } from '../types';

interface ChatToolbarProps {
  state: ChatStateReturn;
  handleCreateConversation: () => void;
}

export function ChatToolbar({ state, handleCreateConversation }: ChatToolbarProps) {
  const {
    selectedConversationId, setSelectedConversationId,
    selectedPackageId, setSelectedPackageId,
    setSelectedModelId,
    setShowMobileSidebar,
    modelPackages,
    balance, refetchBalance, isLoadingBalance,
    thinkingMode, setThinkingMode,
    previewFile, setPreviewFile,
    previewFiles, activePreviewIndex, setActivePreviewIndex,
    updatePackageMutation,
    createConversationMutation,
  } = state;

  // 全局侧边栏（工作台、设置等页面导航）
  const { setOpenMobile: setGlobalSidebarOpen } = useSidebar();

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
        // ★ 对话不存在（跨用户残留 / 已删除）→ 静默清除，不阻塞套餐切换
        if (error?.data?.code === 'NOT_FOUND' || error?.message?.includes('对话不存在')) {
          console.warn('[Chat] Stale conversationId during package switch, clearing');
          setSelectedConversationId(null);
        } else {
          console.error('更新对话套餐失败:', error);
          toast.error('切换套餐失败');
        }
      }
    }
  };

  // 深度思考开关
  const ThinkingToggle = () => (
    selectedPackageId ? (
      <div
        className={`flex items-center justify-between px-3 py-2.5 mx-1 mt-1 mb-1 rounded-md cursor-pointer transition-colors border ${thinkingMode ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700' : 'hover:bg-accent border-transparent'}`}
        onPointerDown={(e) => { e.preventDefault(); setThinkingMode(!thinkingMode); }}
      >
        <div className="flex items-center gap-2">
          <Brain className={`h-4 w-4 ${thinkingMode ? 'text-purple-500' : 'text-muted-foreground'}`} />
          <span className={`text-sm font-medium ${thinkingMode ? 'text-purple-700 dark:text-purple-300' : ''}`}>深度思考</span>
        </div>
        <div className={`w-8 h-4.5 rounded-full transition-colors flex items-center ${thinkingMode ? 'bg-purple-500 justify-end' : 'bg-gray-300 dark:bg-gray-600 justify-start'}`}>
          <div className="w-3.5 h-3.5 bg-white rounded-full mx-0.5 shadow-sm" />
        </div>
      </div>
    ) : null
  );

  // 套餐选项列表
  const PackageOptions = () => (
    <>
      {modelPackages && modelPackages
        .filter((pkg: any) => pkg.enabled)
        .sort((a: any, b: any) => a.sortOrder - b.sortOrder)
        .map((pkg: any) => (
          <SelectItem key={pkg.id} value={pkg.id.toString()} className="py-3 cursor-pointer">
            <div className="flex flex-col items-start w-full">
              <div className="font-medium mb-1">{pkg.displayName}</div>
              <div className="text-xs text-muted-foreground">{pkg.description}</div>
            </div>
          </SelectItem>
        ))}
      <ThinkingToggle />
    </>
  );

  const handleClosePreview = () => setPreviewFile(null);

  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-1 md:mb-2 flex-shrink-0 gap-1 md:gap-3">
      {/* ═══════════ 移动端行（紧凑版 ~40px） ═══════════ */}
      <div className="flex items-center gap-1.5 md:gap-4 flex-shrink-0 w-full md:w-auto">
        {/* 全局导航（工作台等页面） */}
        <Button
          variant="ghost" size="sm"
          className="md:hidden flex-shrink-0 h-8 w-8 p-0"
          onClick={() => setGlobalSidebarOpen(true)}
          title="工作台导航"
        >
          <LayoutDashboard className="h-4 w-4" />
        </Button>
        {/* 对话列表 */}
        <Button
          variant="ghost" size="sm"
          className="md:hidden flex-shrink-0 h-8 w-8 p-0"
          onClick={() => setShowMobileSidebar(true)}
          title="对话列表"
        >
          <Menu className="h-5 w-5" />
        </Button>
        
        {/* 移动端鱼币余额 — 紧凑显示 */}
        <div className="md:hidden flex-shrink-0">
          <FishCoinBalance showSyncButton={false} onBalanceUpdate={() => refetchBalance()} balance={balance?.balance} loading={isLoadingBalance} size="sm" showIcon={true} />
        </div>
        <div className="hidden md:flex flex-shrink-0 ml-auto md:ml-0">
          <FishCoinBalance showSyncButton={true} onBalanceUpdate={() => refetchBalance()} balance={balance?.balance} loading={isLoadingBalance} size="sm" showIcon={true} />
        </div>
        
        <div className="md:hidden flex-1 min-w-0">
          <Select value={selectedPackageId?.toString() || ''} onValueChange={handlePackageChange}>
            <SelectTrigger className="text-sm h-[32px] w-full" style={{ paddingLeft: '8px', paddingRight: '4px' }}>
              <div className="font-medium truncate flex items-center gap-1">
                {selectedPackageId ? modelPackages?.find((p: any) => p.id === selectedPackageId)?.displayName || '选择套餐' : '选择套餐'}
                {thinkingMode && <Brain className="h-3 w-3 text-purple-500 animate-pulse flex-shrink-0" />}
              </div>
            </SelectTrigger>
            <SelectContent className="w-[280px]"><PackageOptions /></SelectContent>
          </Select>
        </div>
        
        {/* 移动端文件预览 — 全屏模式 */}
        <FilePreviewSheet
          previewFile={previewFile}
          onClose={handleClosePreview}
          mobile
          files={previewFiles}
          activeFileIndex={activePreviewIndex}
          onFileSelect={(index) => {
            setActivePreviewIndex(index);
            const file = previewFiles[index];
            if (file) setPreviewFile(file);
          }}
        />
        
        <Button
          onClick={handleCreateConversation} size="sm"
          className="md:hidden h-8 w-8 p-0 flex-shrink-0"
          title="新对话"
          disabled={createConversationMutation.isPending}
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* ═══════════ 桌面端行 ═══════════ */}
      <div className="hidden md:flex items-center gap-2 w-full md:w-auto flex-wrap md:flex-nowrap">
        <Link href={selectedConversationId ? `/voice-chat?conversationId=${selectedConversationId}&from=chat` : '/voice-chat?from=chat'}>
          <Button size="sm" variant="outline" className="hidden md:flex items-center gap-1.5 h-8" title="语音对话">
            <Headphones className="h-3.5 w-3.5" />
            <span className="text-xs">语音对话</span>
          </Button>
        </Link>
        
        <Select value={selectedPackageId?.toString() || ''} onValueChange={handlePackageChange}>
          <SelectTrigger
            className="text-sm md:text-base h-auto py-2 w-[160px] h-[37px] mt-0 mr-0 mb-0 ml-0 md:w-56 md:h-auto md:mt-0 md:mr-0 md:mb-0 md:ml-0"
            style={{ paddingTop: '0px', paddingRight: '0px', paddingBottom: '0px', paddingLeft: '10px' }}
          >
            <div className="flex flex-col items-start gap-0.5 w-full">
              <div className="font-medium flex items-center gap-1.5">
                {selectedPackageId ? modelPackages?.find((p: any) => p.id === selectedPackageId)?.displayName || '选择套餐' : '选择AI模型套餐'}
                {thinkingMode && <Brain className="h-3.5 w-3.5 text-purple-500 animate-pulse" />}
              </div>
              {selectedPackageId && (
                <div className="text-xs text-muted-foreground truncate max-w-full">
                  {thinkingMode ? '深度思考模式已开启' : (modelPackages?.find((p: any) => p.id === selectedPackageId)?.description || '')}
                </div>
              )}
            </div>
          </SelectTrigger>
          <SelectContent className="w-[280px]"><PackageOptions /></SelectContent>
        </Select>
        
        <Button onClick={handleCreateConversation} disabled={createConversationMutation.isPending} className="hidden md:flex">
          <Plus className="mr-2 h-4 w-4" />
          新对话
        </Button>
        
        {/* 桌面端文件预览由右侧 RightSidePanel 承载，此处不再重复 */}
      </div>
    </div>
  );
}
