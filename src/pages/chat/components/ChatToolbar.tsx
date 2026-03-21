/**
 * ChatToolbar — 顶部工具栏（方案 A）
 *
 * 布局: [≡ 对话历史] .... [套餐选择] .... [语音] [+ 新对话]
 * 移动端: [工作台] [≡] .... [套餐] .... [+]
 */
import { Link } from 'wouter';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
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
    thinkingMode, setThinkingMode,
    previewFile, setPreviewFile,
    previewFiles, activePreviewIndex, setActivePreviewIndex,
    updatePackageMutation,
    createConversationMutation,
  } = state;

  const { setOpenMobile: setGlobalSidebarOpen } = useSidebar();

  const handlePackageChange = async (value: string) => {
    if (!value) return;
    const newPackageId = Number(value);
    setSelectedPackageId(newPackageId);
    setSelectedModelId(null);
    localStorage.setItem('preferredPackageId', newPackageId.toString());
    if (selectedConversationId) {
      try {
        await updatePackageMutation.mutateAsync({ id: selectedConversationId, packageId: newPackageId });
      } catch (error: any) {
        if (error?.data?.code === 'NOT_FOUND' || error?.message?.includes('对话不存在')) {
          setSelectedConversationId(null);
        } else {
          toast.error('切换套餐失败');
        }
      }
    }
  };

  const ThinkingToggle = () =>
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
    ) : null;

  const PackageOptions = () => (
    <>
      {modelPackages?.filter((pkg: any) => pkg.enabled)
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

  return (
    <div className="flex items-center justify-between h-12 px-2 md:px-4 flex-shrink-0 border-b border-border/30">
      {/* ── 左侧 ── */}
      <div className="flex items-center gap-1">
        {/* 移动端：打开全局导航侧边栏 */}
        <Button variant="ghost" size="sm" className="md:hidden h-8 w-8 p-0" onClick={() => setGlobalSidebarOpen(true)} title="导航">
          <LayoutDashboard className="h-4 w-4" />
        </Button>
        {/* ★ 对话历史抽屉按钮 — 所有屏幕可用 */}
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setShowMobileSidebar(true)} title="对话历史">
          <Menu className="h-[18px] w-[18px]" />
        </Button>
      </div>

      {/* ── 中间：套餐选择 ── */}
      <Select value={selectedPackageId?.toString() || ''} onValueChange={handlePackageChange}>
        <SelectTrigger className="text-sm h-8 md:h-9 w-auto min-w-[120px] md:min-w-[180px] border-border/50 mx-auto">
          <div className="font-medium truncate flex items-center gap-1.5">
            {selectedPackageId ? modelPackages?.find((p: any) => p.id === selectedPackageId)?.displayName || '选择套餐' : '选择套餐'}
            {thinkingMode && <Brain className="h-3 w-3 text-purple-500 animate-pulse flex-shrink-0" />}
          </div>
        </SelectTrigger>
        <SelectContent className="w-[280px]"><PackageOptions /></SelectContent>
      </Select>

      {/* ── 右侧 ── */}
      <div className="flex items-center gap-1">
        <Link href={selectedConversationId ? `/voice-chat?conversationId=${selectedConversationId}&from=chat` : '/voice-chat?from=chat'}>
          <Button size="sm" variant="ghost" className="hidden md:flex items-center gap-1.5 h-8 text-muted-foreground hover:text-foreground" title="语音对话">
            <Headphones className="h-3.5 w-3.5" />
            <span className="text-xs">语音</span>
          </Button>
        </Link>
        {/* 移动端文件预览 sheet */}
        <FilePreviewSheet previewFile={previewFile} onClose={() => setPreviewFile(null)} mobile
          files={previewFiles} activeFileIndex={activePreviewIndex}
          onFileSelect={(i) => { setActivePreviewIndex(i); const f = previewFiles[i]; if (f) setPreviewFile(f); }} />
        <Button onClick={handleCreateConversation} disabled={createConversationMutation.isPending}
          size="sm" className="h-8 md:h-9 px-3 md:px-4" title="新对话">
          <Plus className="h-4 w-4 md:mr-1.5" />
          <span className="hidden md:inline text-sm">新对话</span>
        </Button>
      </div>
    </div>
  );
}
