/**
 * ChatShare — 对话分享公开页面（无需登录）
 *
 * 展示脱敏后的完整对话记录，供他人查看。
 */
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, AlertCircle, MessageCircle, User, Bot, Eye, Clock, Share2 } from "lucide-react";
import { Helmet } from "react-helmet-async";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

function formatTime(timestamp: any): string {
  if (!timestamp) return "";
  const d = new Date(typeof timestamp === "number" ? timestamp : timestamp);
  return d.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
        <Card className="p-8 max-w-md w-full text-center shadow-lg">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-muted-foreground">加载对话中...</p>
        </Card>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
        <Helmet><title>分享链接不可用</title></Helmet>
        <Card className="p-8 max-w-md w-full text-center shadow-lg">
          <AlertCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
          <h2 className="text-lg font-semibold mb-2">无法查看对话</h2>
          <p className="text-muted-foreground text-sm">
            {error?.message || "分享链接不存在或已过期"}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-950 dark:to-blue-950">
      <Helmet>
        <title>{data.title} - 对话分享</title>
      </Helmet>

      {/* 顶部栏 */}
      <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-border/50">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Share2 className="w-5 h-5 text-blue-600" />
            <h1 className="text-base font-semibold truncate">{data.title}</h1>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3.5 h-3.5" />
              {data.messageCount} 条消息
            </span>
            <span className="flex items-center gap-1">
              <Eye className="w-3.5 h-3.5" />
              {data.viewCount} 次查看
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {new Date(data.createdAt).toLocaleDateString("zh-CN")}
            </span>
          </div>
        </div>
      </header>

      {/* 对话内容 */}
      <main className="max-w-4xl mx-auto px-4 py-6 space-y-4">
        {data.messages.map((msg: any, index: number) => (
          <div
            key={index}
            className={`flex gap-3 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role !== "user" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shrink-0 mt-1">
                <Bot className="w-4 h-4 text-white" />
              </div>
            )}

            <div
              className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                msg.role === "user"
                  ? "bg-blue-600 text-white rounded-br-md"
                  : "bg-white dark:bg-slate-800 border border-border/50 shadow-sm rounded-bl-md"
              }`}
            >
              {msg.role === "user" ? (
                <div className="text-sm whitespace-pre-wrap">{msg.content}</div>
              ) : (
                <div className="prose prose-sm dark:prose-invert max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {typeof msg.content === "string" ? msg.content : ""}
                  </ReactMarkdown>
                </div>
              )}

              {/* 图片展示 */}
              {msg.images && msg.images.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {msg.images.map((img: any, imgIdx: number) => (
                    <img
                      key={imgIdx}
                      src={typeof img === "string" ? img : img?.url}
                      alt={img?.name || `图片 ${imgIdx + 1}`}
                      className="max-w-[200px] max-h-[200px] rounded-lg object-cover"
                      loading="lazy"
                    />
                  ))}
                </div>
              )}

              {/* 时间戳 */}
              {msg.timestamp && (
                <div className={`text-[10px] mt-1 ${
                  msg.role === "user" ? "text-white/60" : "text-muted-foreground/50"
                }`}>
                  {formatTime(msg.timestamp)}
                </div>
              )}
            </div>

            {msg.role === "user" && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 mt-1">
                <User className="w-4 h-4 text-white" />
              </div>
            )}
          </div>
        ))}
      </main>

      {/* 底部声明 */}
      <footer className="max-w-4xl mx-auto px-4 py-8 text-center">
        <p className="text-xs text-muted-foreground/50">
          此对话内容由用户主动分享 · 敏感信息已脱敏处理 · 仅供参考
        </p>
      </footer>
    </div>
  );
}
