/**
 * ChatShare — 对话分享公开页面（无需登录）
 *
 * ★ v2: 使用 SafeMarkdown 渲染（代码高亮、数学公式、Callout）
 *        编辑器级排版：舒适的行距、合理的间距、清晰的层次
 */
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Loader2, AlertCircle, MessageCircle, User, Bot, Eye, Clock, Share2 } from "lucide-react";
import { Helmet } from "react-helmet-async";

function formatTime(timestamp: any): string {
  if (!timestamp) return "";
  const d = new Date(typeof timestamp === "number" ? timestamp : timestamp);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
}

export default function ChatShare() {
  const [, params] = useRoute("/share/chat/:token");
  const token = params?.token || "";

  const { data, isLoading, error } = trpc.conversation.getShared.useQuery(
    { token },
    { enabled: !!token, retry: false }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 max-w-md w-full text-center">
          <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground text-sm">加载对话中...</p>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Helmet><title>分享链接不可用</title></Helmet>
        <Card className="p-8 max-w-md w-full text-center">
          <AlertCircle className="w-10 h-10 mx-auto mb-4 text-destructive" />
          <h2 className="text-base font-semibold mb-2">无法查看对话</h2>
          <p className="text-muted-foreground text-sm">{error?.message || "分享链接不存在或已过期"}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Helmet>
        <title>{data.title} - 对话分享 | Insi</title>
        <meta name="description" content={`AI 对话分享 - ${data.title}`} />
      </Helmet>

      {/* ── 顶部栏 ── */}
      <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-lg border-b">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Share2 className="w-4 h-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold truncate">{data.title}</h1>
              <p className="text-[11px] text-muted-foreground">{formatDate(data.createdAt)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground shrink-0">
            <span className="hidden sm:flex items-center gap-1"><MessageCircle className="w-3 h-3" />{data.messageCount}</span>
            <span className="flex items-center gap-1"><Eye className="w-3 h-3" />{data.viewCount}</span>
          </div>
        </div>
      </header>

      {/* ── 对话内容 ── */}
      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-6">
        <div className="space-y-5">
          {data.messages.map((msg: any, index: number) => (
            <div key={index} className={`flex gap-3 ${msg.role === "user" ? "justify-end" : ""}`}>

              {/* AI 头像 */}
              {msg.role !== "user" && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shrink-0 mt-0.5">
                  <Bot className="w-3.5 h-3.5 text-white" />
                </div>
              )}

              {/* 消息体 */}
              <div className={`min-w-0 ${msg.role === "user" ? "max-w-[85%]" : "max-w-[calc(100%-2.5rem)]"}`}>
                {msg.role === "user" ? (
                  /* 用户消息 */
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap inline-block">
                    {msg.content}
                  </div>
                ) : (
                  /* AI 回复 */
                  <div className="bg-card border rounded-2xl rounded-bl-md px-4 sm:px-5 py-3.5">
                    <div className="prose prose-sm dark:prose-invert max-w-none
                      prose-headings:font-semibold prose-headings:tracking-tight
                      prose-h2:text-base prose-h2:mt-5 prose-h2:mb-2
                      prose-h3:text-sm prose-h3:mt-4 prose-h3:mb-1.5
                      prose-p:leading-[1.75] prose-p:my-2
                      prose-li:leading-[1.7] prose-li:my-0.5
                      prose-strong:font-semibold prose-strong:text-foreground
                      prose-blockquote:border-l-primary/40 prose-blockquote:text-muted-foreground prose-blockquote:not-italic prose-blockquote:pl-4
                      prose-code:text-[13px] prose-code:font-medium
                      prose-pre:bg-muted prose-pre:border prose-pre:rounded-lg
                      prose-table:text-sm
                      prose-th:px-3 prose-th:py-1.5 prose-th:text-left prose-th:font-medium
                      prose-td:px-3 prose-td:py-1.5
                      prose-img:rounded-lg prose-img:shadow-sm
                      [&>*:first-child]:mt-0 [&>*:last-child]:mb-0
                      text-[14px]">
                      <SafeMarkdown>{typeof msg.content === "string" ? msg.content : ""}</SafeMarkdown>
                    </div>
                  </div>
                )}

                {/* 图片 */}
                {msg.images && msg.images.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {msg.images.map((img: any, i: number) => (
                      <img
                        key={i}
                        src={typeof img === "string" ? img : img?.url}
                        alt={img?.name || `图片 ${i + 1}`}
                        className="max-w-[240px] max-h-[240px] rounded-xl object-cover border"
                        loading="lazy"
                      />
                    ))}
                  </div>
                )}

                {/* 时间 */}
                {msg.timestamp && (
                  <div className={`text-[10px] mt-1.5 ${msg.role === "user" ? "text-right" : ""} text-muted-foreground/40`}>
                    {formatTime(msg.timestamp)}
                  </div>
                )}
              </div>

              {/* 用户头像 */}
              {msg.role === "user" && (
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-0.5">
                  <User className="w-3.5 h-3.5 text-white" />
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* ── 底部 ── */}
      <footer className="max-w-3xl mx-auto px-4 sm:px-6 py-10 text-center">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/40">
          <Share2 className="w-3 h-3" />
          此对话内容由用户主动分享 · 敏感信息已脱敏
        </div>
      </footer>
    </div>
  );
}
