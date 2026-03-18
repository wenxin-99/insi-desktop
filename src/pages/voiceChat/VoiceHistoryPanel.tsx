/**
 * VoiceHistoryPanel — 对话历史面板
 * 从 VoiceChat.tsx 拆分，原始行号 1222-1272
 */
import { forwardRef } from "react";
import { Button } from "@/components/ui/button";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import type { VoiceMessage } from './types';

interface VoiceHistoryPanelProps {
  messages: VoiceMessage[];
  isLoadingHistory: boolean;
  onClose: () => void;
}

export const VoiceHistoryPanel = forwardRef<HTMLDivElement, VoiceHistoryPanelProps>(
  ({ messages, isLoadingHistory, onClose }, ref) => {
    const filtered = messages.filter(m => m.role !== 'system');

    return (
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-20 overflow-y-auto p-4">
        <div className="max-w-lg mx-auto space-y-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">对话历史</h2>
            <Button variant="ghost" size="sm" onClick={onClose}>关闭</Button>
          </div>

          {isLoadingHistory && (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
              正在加载历史记录...
            </div>
          )}

          {!isLoadingHistory && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">暂无对话记录</p>
              <p className="text-xs mt-1 opacity-60">开始说话后记录将显示在这里</p>
            </div>
          )}

          {filtered.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 ${
                msg.role === "user" ? "bg-blue-500 text-white" : "bg-muted"
              }`}>
                {msg.role === 'assistant' ? (
                  <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                    <SafeMarkdown>{msg.text}</SafeMarkdown>
                  </div>
                ) : (
                  <p className="text-sm">{msg.text}</p>
                )}
                <p className="text-xs opacity-60 mt-1">
                  {new Date(msg.timestamp).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          <div ref={ref} />
        </div>
      </div>
    );
  }
);

VoiceHistoryPanel.displayName = 'VoiceHistoryPanel';
