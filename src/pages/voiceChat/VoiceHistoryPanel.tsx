/**
 * VoiceHistoryPanel — 语音对话历史面板（T8-3 增强版）
 *
 * 增强功能：
 *   - 时间轴视图（按日期分组）
 *   - 每条记录显示：文字内容 + 时长 + 播放按钮
 *   - 搜索框（文字搜索）
 *   - 导出为文本文件
 */
import { forwardRef, useState, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Search, Download, Volume2, X, Calendar } from "lucide-react";
import type { VoiceMessage } from './types';

interface VoiceHistoryPanelProps {
  messages: VoiceMessage[];
  isLoadingHistory: boolean;
  onClose: () => void;
}

/** 按日期分组消息 */
function groupByDate(messages: VoiceMessage[]): Array<{ date: string; label: string; items: VoiceMessage[] }> {
  const groups = new Map<string, VoiceMessage[]>();
  const today = new Date().toLocaleDateString('zh-CN');
  const yesterday = new Date(Date.now() - 86400000).toLocaleDateString('zh-CN');

  for (const msg of messages) {
    const dateStr = new Date(msg.timestamp).toLocaleDateString('zh-CN');
    if (!groups.has(dateStr)) groups.set(dateStr, []);
    groups.get(dateStr)!.push(msg);
  }

  return Array.from(groups.entries()).map(([date, items]) => ({
    date,
    label: date === today ? '今天' : date === yesterday ? '昨天' : date,
    items,
  }));
}

export const VoiceHistoryPanel = forwardRef<HTMLDivElement, VoiceHistoryPanelProps>(
  ({ messages, isLoadingHistory, onClose }, ref) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [playingIdx, setPlayingIdx] = useState<number | null>(null);

    const filtered = useMemo(() => {
      const base = messages.filter(m => m.role !== 'system');
      if (!searchQuery.trim()) return base;
      const q = searchQuery.toLowerCase();
      return base.filter(m => m.text.toLowerCase().includes(q));
    }, [messages, searchQuery]);

    const dateGroups = useMemo(() => groupByDate(filtered), [filtered]);

    // ★ T8-3: 浏览器 SpeechSynthesis 播放单条消息
    const handlePlay = useCallback((text: string, idx: number) => {
      if (playingIdx !== null) {
        window.speechSynthesis?.cancel();
        if (playingIdx === idx) { setPlayingIdx(null); return; }
      }
      if (!window.speechSynthesis) return;

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.05;
      utterance.onend = () => setPlayingIdx(null);
      utterance.onerror = () => setPlayingIdx(null);
      setPlayingIdx(idx);
      window.speechSynthesis.speak(utterance);
    }, [playingIdx]);

    // ★ T8-3: 导出为文本文件
    const handleExport = useCallback(() => {
      const lines = filtered.map(m => {
        const time = new Date(m.timestamp).toLocaleString('zh-CN');
        const role = m.role === 'user' ? '我' : 'AI';
        return `[${time}] ${role}: ${m.text}`;
      });
      const content = `语音对话记录\n导出时间: ${new Date().toLocaleString('zh-CN')}\n共 ${filtered.length} 条消息\n${'─'.repeat(40)}\n\n${lines.join('\n\n')}`;
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice-history-${new Date().toISOString().split('T')[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, [filtered]);

    return (
      <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-20 overflow-y-auto p-4 pb-40">
        <div className="max-w-lg mx-auto space-y-3">
          {/* 头部 */}
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-semibold">对话历史</h2>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={handleExport} title="导出" disabled={filtered.length === 0}>
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* ★ T8-3: 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="搜索对话内容..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg bg-muted/50 border border-border focus:border-primary focus:outline-none transition-colors"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* 统计 */}
          <div className="text-xs text-muted-foreground">
            {searchQuery ? `找到 ${filtered.length} 条匹配` : `共 ${filtered.length} 条消息`}
          </div>

          {isLoadingHistory && (
            <div className="flex items-center justify-center py-12 gap-3 text-muted-foreground">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary" />
              正在加载历史记录...
            </div>
          )}

          {!isLoadingHistory && filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <p className="text-sm">{searchQuery ? '没有匹配的记录' : '暂无对话记录'}</p>
              <p className="text-xs mt-1 opacity-60">{searchQuery ? '试试其他关键词' : '开始说话后记录将显示在这里'}</p>
            </div>
          )}

          {/* ★ T8-3: 按日期分组的时间轴 */}
          {dateGroups.map(group => (
            <div key={group.date} className="space-y-2">
              {/* 日期分隔线 */}
              <div className="flex items-center gap-2 pt-2">
                <Calendar className="w-3 h-3 text-muted-foreground/50" />
                <span className="text-[11px] font-medium text-muted-foreground/70">{group.label}</span>
                <div className="flex-1 h-px bg-border/50" />
              </div>

              {group.items.map((msg, i) => {
                const globalIdx = filtered.indexOf(msg);
                const isPlaying = playingIdx === globalIdx;
                return (
                  <div key={`${group.date}-${i}`} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 relative group ${
                      msg.role === "user" ? "bg-blue-500 text-white" : "bg-muted"
                    }`}>
                      {msg.role === 'assistant' ? (
                        <div className="text-sm prose prose-sm max-w-none dark:prose-invert">
                          <SafeMarkdown>{msg.text}</SafeMarkdown>
                        </div>
                      ) : (
                        <p className="text-sm">{msg.text}</p>
                      )}

                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <p className="text-[10px] opacity-50">
                          {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {/* ★ T8-3: 播放按钮 */}
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => handlePlay(msg.text, globalIdx)}
                            className={`p-0.5 rounded-full transition-all opacity-0 group-hover:opacity-100 ${
                              isPlaying ? 'opacity-100 text-blue-500 animate-pulse' : 'text-muted-foreground hover:text-foreground'
                            }`}
                            title={isPlaying ? '停止播放' : '播放'}
                          >
                            <Volume2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          <div ref={ref} />
        </div>
      </div>
    );
  }
);

VoiceHistoryPanel.displayName = 'VoiceHistoryPanel';
