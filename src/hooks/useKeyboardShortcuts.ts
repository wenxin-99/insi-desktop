import { useEffect, useCallback } from "react";

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean;
  handler: () => void;
  description: string;
  enabled?: boolean;
}

export function useKeyboardShortcuts(shortcuts: KeyboardShortcut[]) {
  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      // 忽略在输入框、文本域中的快捷键（除了Ctrl+Enter）
      const target = event.target as HTMLElement;
      const isInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      for (const shortcut of shortcuts) {
        // 检查快捷键是否启用
        if (shortcut.enabled === false) continue;

        // 检查按键是否匹配
        const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatch = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatch = shortcut.alt ? event.altKey : !event.altKey;
        const metaMatch = shortcut.meta ? event.metaKey : !event.metaKey;

        if (keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch) {
          // Ctrl+Enter 在输入框中也可以使用
          if (shortcut.key === "Enter" && shortcut.ctrl && isInput) {
            event.preventDefault();
            shortcut.handler();
            return;
          }

          // 其他快捷键在输入框中不生效
          if (isInput) continue;

          event.preventDefault();
          shortcut.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleKeyDown]);
}

// 预定义的快捷键列表
export const KEYBOARD_SHORTCUTS = {
  SEND_MESSAGE: {
    key: "Enter",
    ctrl: true,
    description: "发送消息",
  },
  NEW_CONVERSATION: {
    key: "n",
    ctrl: true,
    description: "新建对话",
  },
  SEARCH: {
    key: "k",
    ctrl: true,
    description: "搜索对话",
  },
  ESCAPE: {
    key: "Escape",
    description: "关闭对话框/取消操作",
  },
  HELP: {
    key: "?",
    shift: true,
    description: "显示快捷键帮助",
  },
};
