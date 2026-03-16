/**
 * GeminiFileSearchPicker — 对话输入框旁的 Gemini 文件搜索选择器
 *
 * 用法: 在 ChatInputArea 的工具栏中插入此组件（与 KnowledgeBasePicker 并列）。
 * 选中存储区后，发送消息时将 store name 传给后端，LLM 调用时自动启用 File Search。
 *
 * Props:
 *   selectedStore: { id, name, geminiStoreName } | null
 *   onSelect: (store) => void
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { FolderSearch, X, Loader2, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectedGeminiStore {
  id: number;
  displayName: string;
  geminiStoreName: string;
}

interface GeminiFileSearchPickerProps {
  selectedStore: SelectedGeminiStore | null;
  onSelect: (store: SelectedGeminiStore | null) => void;
  className?: string;
}

export function GeminiFileSearchPicker({ selectedStore, onSelect, className }: GeminiFileSearchPickerProps) {
  const [open, setOpen] = useState(false);
  const { data: stores, isLoading } = trpc.geminiFileSearch.listStores.useQuery(undefined, {
    enabled: open, // 展开时才加载
  });

  const handleSelect = (store: any) => {
    if (selectedStore?.id === store.id) {
      onSelect(null); // 取消选择
    } else {
      onSelect({
        id: store.id,
        displayName: store.displayName,
        geminiStoreName: store.geminiStoreName,
      });
    }
    setOpen(false);
  };

  // 已选中时显示标签
  if (selectedStore) {
    return (
      <Badge
        variant="secondary"
        className={cn(
          "flex items-center gap-1 cursor-pointer hover:bg-secondary/80 transition-colors bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
          className
        )}
        onClick={() => onSelect(null)}
      >
        <FolderSearch className="h-3 w-3" />
        <span className="max-w-[100px] truncate">🔍 {selectedStore.displayName}</span>
        <X className="h-3 w-3 ml-0.5 opacity-60" />
      </Badge>
    );
  }

  // 未选中时显示按钮
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 px-2 text-muted-foreground hover:text-foreground", className)}
          title="关联 Gemini 文件搜索"
        >
          <FolderSearch className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start" side="top">
        <p className="text-xs font-medium text-muted-foreground px-2 pb-2">
          选择 Gemini 文件搜索存储区
        </p>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !stores || stores.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground">还没有存储区</p>
            <a
              href="/admin/gemini-file-search"
              className="text-xs text-blue-500 hover:underline mt-1 inline-block"
            >
              前往创建 →
            </a>
          </div>
        ) : (
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {stores.map((store: any) => (
              <button
                key={store.id}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left",
                  selectedStore?.id === store.id && "bg-blue-50 dark:bg-blue-950"
                )}
                onClick={() => handleSelect(store)}
              >
                <FolderSearch className="h-3.5 w-3.5 text-blue-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <span className="block truncate">{store.displayName}</span>
                  <span className="text-xs text-muted-foreground">{store.docCount} 个文档</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
