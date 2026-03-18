/**
 * Admin AI-Ops Chat Console
 *
 * 管理员用自然语言查询系统状态的对话界面。
 * 预设常用问题快捷按钮 + 自由输入。
 */

import { useState, useRef, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Bot, Send, Sparkles, ArrowLeft, RotateCcw, Loader2,
} from "lucide-react";
import { useLocation } from "wouter";
// 简单 Markdown 渲染（避免依赖 SafeMarkdown 可能的渲染崩溃）
function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function applyMarkdown(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-xs">$1</code>');
}
function SimpleMarkdown({ content }: { content: string }) {
  if (!content) return <p className="text-muted-foreground">（无内容）</p>;
  // 按段落拆分，简单处理 **加粗** 和 `代码`
  const paragraphs = content.split("\n");
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {paragraphs.map((line, i) => {
        if (!line.trim()) return <div key={i} className="h-1.5" />;
        // 列表项
        const isList = line.trim().startsWith("* ") || line.trim().startsWith("- ") || /^\d+\./.test(line.trim());
        if (isList) {
          const text = line.trim().replace(/^[\*\-]\s+/, "").replace(/^\d+\.\s+/, "");
          return <div key={i} className="flex gap-1.5 pl-2"><span className="text-muted-foreground">•</span><span dangerouslySetInnerHTML={{ __html: applyMarkdown(text) }} /></div>;
        }
        return <p key={i} dangerouslySetInnerHTML={{ __html: applyMarkdown(line) }} />;
      })}
    </div>
  );
}

// ── 预设问题 ──
const PRESETS = [
  { label: "今日概况", question: "今天的反馈和Issue情况怎么样？有什么需要关注的吗？" },
  { label: "P0/P1 问题", question: "当前有哪些P0和P1级别的紧急问题？" },
  { label: "问题最多的模块", question: "最近哪个模块的问题最多？分析一下原因。" },
  { label: "本周趋势", question: "帮我总结一下本周的用户反馈趋势，跟上周比有什么变化？" },
  { label: "对话模块", question: "对话(chat)模块最近有什么问题？用户主要反馈了什么？" },
  { label: "被动信号", question: "最近的被动信号（自动采集的错误和异常）有哪些？严重吗？" },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  dataSources?: string[];
  tokensUsed?: number;
  timestamp: number;
}

export default function AdminAIOpsChat() {
  const [, navigate] = useLocation();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const chatMutation = trpc.aiOps.chat.useMutation();

  // 自动滚动
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // 发送消息
  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const history = messages.map(m => ({
        role: m.role as "user" | "assistant",
        content: m.content,
      }));

      const result = await chatMutation.mutateAsync({
        question: text.trim(),
        conversationHistory: history,
      });

      console.log("[AIOpsChat] mutation result:", JSON.stringify(result).substring(0, 300));

      const assistantMsg: ChatMessage = {
        role: "assistant",
        content: result.answer || result?.toString() || "(空回复)",
        dataSources: result.dataSources,
        tokensUsed: result.tokensUsed,
        timestamp: Date.now(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        role: "assistant",
        content: `查询失败: ${err.message || "未知错误"}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-[calc(100vh-3.5rem)] max-h-[calc(100vh-3.5rem)]">
        {/* ═══ 头部 ═══ */}
        <div className="flex items-center gap-3 px-6 py-3 border-b bg-muted/20">
          <Button
            variant="ghost" size="sm"
            onClick={() => navigate("/admin/ai-ops")}
            className="h-8 px-2"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500
            flex items-center justify-center text-white">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1">
            <h1 className="text-sm font-semibold">AI 运维助手</h1>
            <p className="text-xs text-muted-foreground">
              用自然语言查询系统状态、反馈趋势、Issue 详情
            </p>
          </div>
          <Button
            variant="ghost" size="sm"
            onClick={() => setMessages([])}
            className="h-8 text-xs"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1" />
            清空对话
          </Button>
        </div>

        {/* ═══ 消息区域 ═══ */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-lg mx-auto">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500/20 to-blue-500/20
                flex items-center justify-center mb-4">
                <Bot className="h-8 w-8 text-violet-500" />
              </div>
              <h2 className="text-lg font-semibold mb-2">AI 运维助手</h2>
              <p className="text-sm text-muted-foreground text-center mb-6">
                我可以帮你查看系统健康状态、分析用户反馈趋势、了解 Issue 详情。
                试试下面的快捷问题，或直接输入你想问的。
              </p>

              {/* 预设问题 */}
              <div className="grid grid-cols-2 gap-2 w-full">
                {PRESETS.map((preset, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(preset.question)}
                    className="text-left p-3 rounded-xl border border-border bg-card
                      hover:bg-muted/50 hover:border-primary/30 transition-all
                      text-sm"
                  >
                    <span className="font-medium text-foreground">{preset.label}</span>
                    <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-1">
                      {preset.question}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5"
                      : ""
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500
                          flex items-center justify-center text-white flex-shrink-0 mt-0.5">
                          <Bot className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="prose prose-sm dark:prose-invert max-w-none
                            [&>p]:mb-2 [&>ul]:mb-2 [&>ol]:mb-2 [&>h3]:text-sm [&>h3]:font-semibold">
                            <SimpleMarkdown content={msg.content} />
                          </div>
                          {/* 元信息 */}
                          {(msg.dataSources?.length || msg.tokensUsed) ? (
                            <div className="flex gap-3 mt-2 text-[11px] text-muted-foreground/60">
                              {msg.dataSources?.length ? (
                                <span>数据源: {msg.dataSources.join(", ")}</span>
                              ) : null}
                              {msg.tokensUsed ? (
                                <span>{msg.tokensUsed} tokens</span>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}

              {/* 加载中 */}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500
                      flex items-center justify-center text-white flex-shrink-0">
                      <Bot className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>正在查询系统数据并分析...</span>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ═══ 输入区域 ═══ */}
        <div className="border-t bg-background px-6 py-3">
          <div className="max-w-3xl mx-auto flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="询问系统状态、反馈趋势、Issue 详情..."
                rows={1}
                className="w-full resize-none rounded-xl border border-input bg-muted/30
                  px-4 py-2.5 text-sm
                  placeholder:text-muted-foreground/50
                  focus:outline-none focus:ring-2 focus:ring-ring
                  disabled:opacity-50"
                disabled={isLoading}
                style={{ minHeight: 42, maxHeight: 120 }}
                onInput={(e) => {
                  const target = e.target as HTMLTextAreaElement;
                  target.style.height = "auto";
                  target.style.height = Math.min(target.scrollHeight, 120) + "px";
                }}
              />
            </div>
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              className="h-[42px] px-4 rounded-xl"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          {/* 快捷问题标签（对话进行中时也显示） */}
          {messages.length > 0 && !isLoading && (
            <div className="max-w-3xl mx-auto mt-2 flex gap-1.5 flex-wrap">
              {PRESETS.slice(0, 4).map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p.question)}
                  className="text-xs px-2.5 py-1 rounded-full bg-muted text-muted-foreground
                    hover:bg-muted/80 transition-colors"
                >
                  {p.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
