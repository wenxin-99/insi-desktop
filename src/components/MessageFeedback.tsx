/**
 * MessageFeedback — 对话消息内嵌反馈
 *
 * [FIXED] #12: 使用 Popover 替代 absolute 定位，自动处理视口碰撞
 */

import { useState } from "react";
import { ThumbsUp, ThumbsDown, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const QUICK_TAGS = [
  { id: "wrong_answer", label: "回答不准确", emoji: "❌" },
  { id: "incomplete",   label: "回答不完整", emoji: "📝" },
  { id: "slow_response", label: "响应太慢",  emoji: "🐌" },
  { id: "ui_broken",    label: "显示异常",   emoji: "🖥️" },
  { id: "not_helpful",  label: "没有帮助",   emoji: "😕" },
  { id: "other",        label: "其他问题",   emoji: "💬" },
];

interface MessageFeedbackProps {
  messageId?: string;
  conversationId?: number;
  messageIndex: number;
  messages: Array<{ role: string; content: string; [key: string]: any }>;
  modelName?: string;
  responseTime?: number;
}

export function MessageFeedback({
  messageId, conversationId, messageIndex, messages, modelName, responseTime,
}: MessageFeedbackProps) {
  const [vote, setVote] = useState<"up" | "down" | null>(null);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const submitMutation = trpc.aiOps.submitQuickFeedback.useMutation({ onError: () => {} });

  const buildContext = () => {
    const start = Math.max(0, messageIndex - 4);
    const recentMessages = messages.slice(start, messageIndex + 1).map(m => ({
      role: m.role,
      content: typeof m.content === "string" ? m.content.substring(0, 300) : "[非文本]",
    }));
    return { pageUrl: window.location.pathname, userAgent: navigator.userAgent, timestamp: Date.now(), recentMessages, modelUsed: modelName, responseTime };
  };

  const handleThumbsUp = () => {
    if (submitted) return;
    setVote("up"); setSubmitted(true);
    submitMutation.mutate({ messageId: messageId || `msg-${messageIndex}`, conversationId: conversationId || 0, vote: "up", context: buildContext() });
    setTimeout(() => setVote(null), 2000);
  };

  const handleSubmitNegative = () => {
    setSubmitted(true); setPopoverOpen(false);
    submitMutation.mutate({ messageId: messageId || `msg-${messageIndex}`, conversationId: conversationId || 0, vote: "down", quickTag: selectedTag || undefined, comment: comment.trim() || undefined, context: buildContext() });
    toast.success("感谢反馈，我们会持续改进", { duration: 2000 });
  };

  if (submitted && !popoverOpen) {
    if (vote === "up") return <span className="inline-flex items-center text-emerald-500 text-xs ml-0.5"><ThumbsUp className="h-3 w-3 fill-current" /></span>;
    if (vote === "down") return <span className="inline-flex items-center text-orange-500 text-xs ml-0.5"><ThumbsDown className="h-3 w-3 fill-current" /></span>;
    return null;
  }

  return (
    <div className="inline-flex items-center">
      <Button variant="ghost" size="sm"
        className={`h-7 w-7 p-0 transition-colors ${vote === "up" ? "text-emerald-500" : "hover:text-emerald-500"}`}
        onClick={handleThumbsUp} title="回答有帮助">
        <ThumbsUp className={`h-3.5 w-3.5 ${vote === "up" ? "fill-current" : ""}`} />
      </Button>

      {/* Fix #12: Popover 自动处理碰撞检测 */}
      <Popover open={popoverOpen} onOpenChange={(open) => {
        setPopoverOpen(open);
        if (open) setVote("down");
        else if (!submitted) setVote(null);
      }}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm"
            className={`h-7 w-7 p-0 transition-colors ${vote === "down" ? "text-orange-500" : "hover:text-orange-500"}`}
            title="回答有问题">
            <ThumbsDown className={`h-3.5 w-3.5 ${vote === "down" ? "fill-current" : ""}`} />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-3" side="top" align="start" sideOffset={8}>
          <div className="mb-2.5">
            <span className="text-sm font-medium">哪里不好？</span>
          </div>

          <div className="flex flex-wrap gap-1.5 mb-3">
            {QUICK_TAGS.map(tag => (
              <button key={tag.id}
                onClick={() => setSelectedTag(selectedTag === tag.id ? null : tag.id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium transition-all
                  ${selectedTag === tag.id ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}>
                <span>{tag.emoji}</span><span>{tag.label}</span>
              </button>
            ))}
          </div>

          <textarea value={comment} onChange={(e) => setComment(e.target.value)}
            placeholder="补充说明（可选）..." rows={2} maxLength={500}
            className="w-full text-xs bg-muted/50 border border-border rounded-lg p-2 resize-none placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-ring mb-2.5" />

          <Button size="sm" className="w-full h-8 text-xs" onClick={handleSubmitNegative}
            disabled={!selectedTag && !comment.trim()}>
            <Send className="h-3 w-3 mr-1.5" />提交反馈
          </Button>
        </PopoverContent>
      </Popover>
    </div>
  );
}
