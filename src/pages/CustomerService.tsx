/**
 * AI 智能客服 — 用户对话页面（V2: + 语音 + Widget 模式）
 */

import { useState, useRef, useEffect, lazy, Suspense } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Headphones, Send, Loader2, RotateCcw, Star, MessageSquare,
  Bot, User, Phone, Mic,
} from "lucide-react";

const VoiceCS = lazy(() => import("@/components/VoiceCS"));
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { AiLogo } from "@/components/AiLogo";

const PRESETS = [
  "你们平台支持哪些 AI 模型？",
  "如何充值鱼币？",
  "图片生成功能怎么使用？",
  "套餐价格是多少？",
  "如何修改密码？",
  "我想退款",
];

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ documentId: number; title: string; section?: string }>;
  shouldHandoff?: boolean;
  handoffReason?: string;
  inFlow?: boolean;
  flowType?: string;
  toolCalls?: Array<{ name: string; result: any }>;
  timestamp: number;
}

export default function CustomerServicePage() {
  // Widget 模式检测（通过 URL 参数或 iframe 判断）
  const isWidget = new URLSearchParams(window.location.search).has("widget") ||
    window.self !== window.top;

  const [conversationId, setConversationId] = useState<number | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [rating, setRating] = useState<number>(0);
  const [showRating, setShowRating] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [lastBotReply, setLastBotReply] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const sendMutation = trpc.customerService.sendMessage.useMutation();
  const { data: historyList } = trpc.customerService.listMyConversations.useQuery(
    undefined, { enabled: showHistory }
  );
  const rateMutation = trpc.customerService.rateConversation.useMutation();
  const handoffMutation = trpc.customerService.requestHandoff.useMutation();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: Message = { role: "user", content: text.trim(), timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);

    try {
      const result = await sendMutation.mutateAsync({
        conversationId: conversationId || undefined,
        message: text.trim(),
      });
      if (!conversationId) setConversationId(result.conversationId);

      const assistantMsg: Message = {
        role: "assistant",
        content: result.answer,
        sources: result.sources,
        shouldHandoff: result.shouldHandoff,
        handoffReason: result.handoffReason,
        inFlow: (result as any).inFlow,
        flowType: (result as any).flowType,
        toolCalls: (result as any).toolCalls,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);
      setLastBotReply(result.answer);

      if (result.shouldHandoff) setShowRating(true);
    } catch (err: any) {
      setMessages(prev => [...prev, {
        role: "assistant", content: `抱歉，发生了错误: ${err.message || "请稍后再试"}`, timestamp: Date.now(),
      }]);
    } finally {
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const startNewChat = () => {
    setConversationId(null); setMessages([]); setShowRating(false); setRating(0); setLastBotReply("");
  };

  const submitRating = () => {
    if (conversationId && rating > 0) {
      rateMutation.mutate({ conversationId, rating });
      setShowRating(false);
    }
  };

  const trpcUtils = trpc.useUtils();

  const loadConversation = async (convId: number) => {
    try {
      const data = await trpcUtils.customerService.getHistory.fetch({ conversationId: convId });
      if (data) {
        setConversationId(convId);
        setMessages(data.messages.map((m: any) => ({
          role: m.role === "human_agent" ? "assistant" as const : m.role as "user" | "assistant",
          content: m.content,
          sources: m.sources,
          timestamp: new Date(m.created_at).getTime(),
        })));
        setShowHistory(false);
        setLastBotReply(data.messages.filter((m: any) => m.role === "assistant").pop()?.content || "");
      }
    } catch {
      setShowHistory(false);
    }
  };

  const doHandoff = () => {
    if (conversationId) {
      handoffMutation.mutate({ conversationId }, {
        onSuccess: (result) => {
          setMessages(prev => [...prev, {
            role: "assistant",
            content: result.message,
            shouldHandoff: true,
            timestamp: Date.now(),
          }]);
        },
      });
    }
  };

  // Widget 模式下不使用 DashboardLayout
  const Wrapper = isWidget ? ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col h-screen bg-background">{children}</div>
  ) : DashboardLayout;

  return (
    <Wrapper>
      <div className={`flex flex-col ${isWidget ? "h-screen" : "h-[calc(100vh-3.5rem)]"}`}>
        {/* ═══ 头部 ═══ */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-b bg-muted/20">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500
            flex items-center justify-center text-white">
            <Headphones className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold">Insi 智能客服</h1>
            <p className="text-xs text-muted-foreground truncate">7×24 小时在线 · 有问题随时问我</p>
          </div>
          <div className="flex gap-1">
            {!isWidget && (
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2"
                onClick={() => setShowHistory(!showHistory)}>
                <MessageSquare className="h-3 w-3 mr-1" />历史
              </Button>
            )}
            <Button variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={startNewChat}>
              <RotateCcw className="h-3 w-3 mr-1" />新对话
            </Button>
            {conversationId && (
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2 text-amber-500" onClick={doHandoff}>
                <Phone className="h-3 w-3 mr-1" />转人工
              </Button>
            )}
          </div>
        </div>

        {/* ═══ 历史对话面板 ═══ */}
        {showHistory && (
          <div className="border-b bg-muted/10 px-4 py-3 max-h-60 overflow-y-auto">
            <p className="text-xs font-medium text-muted-foreground mb-2">历史对话（保留 30 天）</p>
            {!historyList?.length ? (
              <p className="text-xs text-muted-foreground py-4 text-center">暂无历史对话</p>
            ) : (
              <div className="space-y-1">
                {historyList.map((conv: any) => (
                  <button key={conv.id}
                    className={`w-full text-left px-3 py-2 rounded-lg text-xs hover:bg-muted/50 flex justify-between items-center
                      ${conversationId === conv.id ? "bg-primary/10 border border-primary/20" : ""}`}
                    onClick={() => loadConversation(conv.id)}>
                    <div className="flex items-center gap-2 min-w-0">
                      <MessageSquare className="h-3 w-3 flex-shrink-0 text-muted-foreground" />
                      <span className="truncate">对话 #{conv.id}</span>
                      <Badge variant="outline" className="text-[10px] flex-shrink-0">
                        {conv.message_count} 条
                      </Badge>
                      {conv.status === "resolved" && (
                        <Badge variant="secondary" className="text-[10px] flex-shrink-0 text-emerald-500">已解决</Badge>
                      )}
                    </div>
                    <span className="text-muted-foreground/60 flex-shrink-0 ml-2">
                      {new Date(conv.updated_at).toLocaleDateString("zh-CN")}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ 消息区域 ═══ */}
        <div className="flex-1 overflow-y-auto px-4 py-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full max-w-md mx-auto">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20
                flex items-center justify-center mb-3">
                <Headphones className="h-7 w-7 text-cyan-500" />
              </div>
              <h2 className="text-base font-semibold mb-1">Insi 智能客服</h2>
              <p className="text-xs text-muted-foreground text-center mb-4">
                您好！我可以帮您查余额、查订单、了解产品功能。如需人工服务，随时告诉我。
              </p>
              <div className="grid grid-cols-2 gap-1.5 w-full">
                {PRESETS.map((q, i) => (
                  <button key={i} onClick={() => sendMessage(q)}
                    className="text-left p-2.5 rounded-xl border bg-card
                      hover:bg-muted/50 hover:border-primary/30 transition-all text-xs leading-snug">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-2xl mx-auto space-y-3">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] ${
                    msg.role === "user"
                      ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-3.5 py-2"
                      : ""
                  }`}>
                    {msg.role === "assistant" ? (
                      <div className="flex gap-2.5">
                        <AiLogo size="sm" className="mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm leading-relaxed cs-markdown">
                            <SafeMarkdown>{msg.content}</SafeMarkdown>
                          </div>

                          {/* 工具调用标签 */}
                          {msg.toolCalls?.length ? (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {msg.toolCalls.map((tc, j) => (
                                <Badge key={j} variant="outline" className="text-[10px]">
                                  🔧 {tc.name}
                                </Badge>
                              ))}
                            </div>
                          ) : null}

                          {/* 转人工提示 */}
                          {msg.shouldHandoff && (
                            <div className="mt-2 p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                              <div className="flex items-center gap-1.5 text-xs text-amber-600">
                                <Phone className="h-3 w-3" />
                                <span className="font-medium">建议联系人工客服</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm">{msg.content}</span>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-2.5">
                  <AiLogo size="sm" />
                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> 正在查找答案...
                  </span>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* ═══ 评价栏 ═══ */}
        {showRating && conversationId && (
          <div className="border-t bg-muted/20 px-4 py-1.5 flex items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">满意吗？</span>
            {[1, 2, 3, 4, 5].map(n => (
              <button key={n} onClick={() => setRating(n)}
                className={`${rating >= n ? "text-amber-500" : "text-muted-foreground/30"}`}>
                <Star className={`h-4 w-4 ${rating >= n ? "fill-current" : ""}`} />
              </button>
            ))}
            {rating > 0 && <Button size="sm" variant="outline" className="h-6 text-xs" onClick={submitRating}>提交</Button>}
          </div>
        )}

        {/* ═══ 输入区域 ═══ */}
        <div className="border-t bg-background px-4 py-2.5">
          <div className="max-w-2xl mx-auto flex gap-2">
            {/* 语音按钮 */}
            <Button variant="outline" size="sm" className="h-[42px] px-3 rounded-xl"
              onClick={() => setShowVoice(!showVoice)}>
              <Mic className={`h-4 w-4 ${showVoice ? "text-cyan-500" : ""}`} />
            </Button>

            <div className="flex-1 relative">
              <textarea ref={inputRef} value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
                placeholder="描述您的问题..."
                rows={1} disabled={isLoading}
                className="w-full resize-none rounded-xl border border-input bg-muted/30
                  px-4 py-2.5 text-sm placeholder:text-muted-foreground/50
                  focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
                style={{ minHeight: 42, maxHeight: 100 }}
                onInput={(e) => { const t = e.target as HTMLTextAreaElement; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 100) + "px"; }}
              />
            </div>
            <Button onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading} className="h-[42px] px-4 rounded-xl">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </div>

          {/* 语音面板 */}
          {showVoice && (
            <div className="max-w-2xl mx-auto mt-2">
              <Suspense fallback={<div className="text-xs text-muted-foreground">加载语音组件...</div>}>
                <VoiceCS onTranscript={sendMessage} lastBotReply={lastBotReply} disabled={isLoading} />
              </Suspense>
            </div>
          )}
        </div>
      </div>
    </Wrapper>
  );
}
