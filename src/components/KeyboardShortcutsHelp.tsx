import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

interface KeyboardShortcutsHelpProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function KeyboardShortcutsHelp({ open, onOpenChange }: KeyboardShortcutsHelpProps) {
  const shortcuts = [
    {
      category: "对话操作",
      items: [
        { keys: ["Ctrl", "Enter"], description: "发送消息" },
        { keys: ["Ctrl", "N"], description: "新建对话" },
        { keys: ["Ctrl", "K"], description: "搜索对话历史" },
      ],
    },
    {
      category: "通用操作",
      items: [
        { keys: ["Esc"], description: "关闭对话框/取消操作" },
        { keys: ["Shift", "?"], description: "显示快捷键帮助" },
      ],
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Keyboard className="h-5 w-5" />
            键盘快捷键
          </DialogTitle>
          <DialogDescription>使用快捷键提升操作效率</DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {shortcuts.map((category) => (
            <div key={category.category}>
              <h3 className="text-sm font-semibold mb-3 text-muted-foreground">{category.category}</h3>
              <div className="space-y-2">
                {category.items.map((item, index) => (
                  <div key={index} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-muted/50">
                    <span className="text-sm">{item.description}</span>
                    <div className="flex items-center gap-1">
                      {item.keys.map((key, keyIndex) => (
                        <span key={keyIndex} className="flex items-center gap-1">
                          <kbd className="px-2 py-1 text-xs font-semibold bg-muted border border-border rounded">
                            {key}
                          </kbd>
                          {keyIndex < item.keys.length - 1 && <span className="text-muted-foreground">+</span>}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 p-4 rounded-lg bg-muted/50 text-sm text-muted-foreground">
          <p>💡 提示：在输入框中按 <kbd className="px-1.5 py-0.5 text-xs font-semibold bg-background border border-border rounded">Ctrl+Enter</kbd> 可以快速发送消息</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
