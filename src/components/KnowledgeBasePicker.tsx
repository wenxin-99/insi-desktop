/**
 * KnowledgeBasePicker — 对话输入框旁的知识库选择器
 *
 * 用法: 在 ChatInputArea 的工具栏中插入此组件。
 * 选中知识库后，发送消息时自动在消息前拼接 @知识库名。
 *
 * Props:
 *   selectedKB: { id, name } | null — 当前选中的知识库
 *   onSelect: (kb) => void         — 选中/取消回调
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { BookOpen, X, Database, ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectedKB {
  id: number;
  name: string;
}

interface KnowledgeBasePickerProps {
  selectedKB: SelectedKB | null;
  onSelect: (kb: SelectedKB | null) => void;
  className?: string;
}

export function KnowledgeBasePicker({ selectedKB, onSelect, className }: KnowledgeBasePickerProps) {
  const [open, setOpen] = useState(false);
  const { data: kbs, isLoading } = trpc.knowledgeBase.list.useQuery(undefined, {
    enabled: open, // 展开时才加载
  });

  const handleSelect = (kb: any) => {
    if (selectedKB?.id === kb.id) {
      onSelect(null); // 取消选择
    } else {
      onSelect({ id: kb.id, name: kb.name });
    }
    setOpen(false);
  };

  // 已选中时显示标签
  if (selectedKB) {
    return (
      <Badge
        variant="secondary"
        className={cn("flex items-center gap-1 cursor-pointer hover:bg-secondary/80 transition-colors", className)}
        onClick={() => onSelect(null)}
      >
        <BookOpen className="h-3 w-3" />
        <span className="max-w-[100px] truncate">@{selectedKB.name}</span>
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
          title="关联知识库"
        >
          <BookOpen className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-2" align="start" side="top">
        <p className="text-xs font-medium text-muted-foreground px-2 pb-2">选择知识库</p>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : !kbs || kbs.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">还没有知识库</p>
        ) : (
          <div className="space-y-1 max-h-[200px] overflow-y-auto">
            {kbs.map((kb: any) => (
              <button
                key={kb.id}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted transition-colors text-left"
                onClick={() => handleSelect(kb)}
              >
                <BookOpen className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                <span className="flex-1 truncate">{kb.name}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">{kb.chunkCount}片段</span>
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
