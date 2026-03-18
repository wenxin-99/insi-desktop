/**
 * 管理后台 — 客服工作台
 *
 * 功能:
 * - 工单列表（按优先级排序）
 * - 对话详情查看（AI + 人工消息）
 * - 坐席上下线控制
 * - 人工回复用户
 * - 对话关闭/解决
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Headphones, Phone, PhoneOff, Send, CheckCircle, Clock, AlertTriangle,
  MessageSquare, User, Bot, ChevronRight, RefreshCw, Loader2,
  Ticket, ArrowUpCircle, XCircle,
} from "lucide-react";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "bg-red-500/10 border-red-500/30 text-red-600",
  high: "bg-orange-500/10 border-orange-500/30 text-orange-500",
  medium: "bg-amber-500/10 border-amber-500/30 text-amber-500",
  low: "bg-gray-500/10 border-gray-500/30 text-gray-500",
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  open: { label: "待处理", color: "text-red-500" },
  in_progress: { label: "处理中", color: "text-blue-500" },
  waiting_user: { label: "等用户", color: "text-amber-500" },
  resolved: { label: "已解决", color: "text-emerald-500" },
  closed: { label: "已关闭", color: "text-gray-500" },
};

const ROLE_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  user: { label: "用户", color: "bg-primary text-primary-foreground", icon: User },
  assistant: { label: "AI", color: "bg-violet-500/10", icon: Bot },
  human_agent: { label: "客服", color: "bg-emerald-500/10", icon: Headphones },
  system: { label: "系统", color: "bg-muted", icon: AlertTriangle },
};

export default function CSWorkbench() {
  const [statusFilter, setStatusFilter] = useState("open");
  const [selectedConvId, setSelectedConvId] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [resolution, setResolution] = useState("");
  const [isOnline, setIsOnline] = useState(false);

  // ── 数据 ──
  const { data: tickets, refetch: refetchTickets, isLoading } = trpc.customerService.listTickets.useQuery({
    status: statusFilter === "all" ? undefined : statusFilter,
  });
  const { data: convDetail, refetch: refetchConv } = trpc.customerService.adminGetConversation.useQuery(
    { id: selectedConvId! }, { enabled: !!selectedConvId }
  );

  // ── Mutations ──
  const goOnline = trpc.customerService.agentGoOnline.useMutation({
    onSuccess: () => { toast.success("已上线"); setIsOnline(true); },
  });
  const goOffline = trpc.customerService.agentGoOffline.useMutation({
    onSuccess: () => { toast.success("已下线"); setIsOnline(false); },
  });
  const sendMsg = trpc.customerService.agentSendMessage.useMutation({
    onSuccess: () => { toast.success("已发送"); setReplyText(""); refetchConv(); },
    onError: (e) => toast.error(e.message),
  });
  const finishSession = trpc.customerService.agentFinishSession.useMutation({
    onSuccess: () => { toast.success("对话已解决"); setSelectedConvId(null); setResolution(""); refetchTickets(); },
  });
  const updateTicket = trpc.customerService.updateTicket.useMutation({
    onSuccess: () => { toast.success("工单已更新"); refetchTickets(); },
  });

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-6 space-y-6">
        {/* ═══ 页面标题 ═══ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500
              flex items-center justify-center text-white">
              <Headphones className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">客服工作台</h1>
              <p className="text-sm text-muted-foreground">工单管理 · 对话接入 · 人工回复</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => refetchTickets()}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" />刷新
            </Button>
            {isOnline ? (
              <Button variant="outline" size="sm" onClick={() => goOffline.mutate()}>
                <PhoneOff className="h-3.5 w-3.5 mr-1.5" />下线
              </Button>
            ) : (
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700" onClick={() => goOnline.mutate()}>
                <Phone className="h-3.5 w-3.5 mr-1.5" />上线接客
              </Button>
            )}
          </div>
        </div>

        {/* ═══ 筛选 ═══ */}
        <div className="flex gap-2">
          {["all", "open", "in_progress", "waiting_user", "resolved"].map(s => (
            <Button key={s} size="sm" variant={statusFilter === s ? "default" : "outline"}
              onClick={() => setStatusFilter(s)} className="text-xs h-7">
              {s === "all" ? "全部" : STATUS_LABELS[s]?.label || s}
            </Button>
          ))}
        </div>

        {/* ═══ 工单列表 ═══ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Ticket className="h-4 w-4" />
              工单列表 ({tickets?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin mr-2" />加载中
              </div>
            ) : !tickets?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <CheckCircle className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无工单</p>
              </div>
            ) : (
              <div className="divide-y">
                {tickets.map((ticket: any) => {
                  const st = STATUS_LABELS[ticket.status] || STATUS_LABELS.open;
                  const pColor = PRIORITY_COLORS[ticket.priority] || PRIORITY_COLORS.medium;
                  return (
                    <div key={ticket.id}
                      className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 cursor-pointer"
                      onClick={() => setSelectedConvId(ticket.conversation_id)}>
                      {/* 优先级 */}
                      <div className={`px-2 py-0.5 rounded text-xs font-bold border ${pColor}`}>
                        {ticket.priority?.toUpperCase()}
                      </div>
                      {/* 内容 */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">#{ticket.id} {ticket.title}</div>
                        <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                          <span>{ticket.user_name || "匿名"}</span>
                          <span>·</span>
                          <span>{ticket.category}</span>
                          <span>·</span>
                          <span>{new Date(ticket.created_at).toLocaleString("zh-CN")}</span>
                          {ticket.agent_name && <><span>·</span><span className="text-emerald-500">{ticket.agent_name}</span></>}
                        </div>
                        {ticket.ai_summary && (
                          <p className="text-xs text-muted-foreground/70 mt-1 truncate">{ticket.ai_summary}</p>
                        )}
                      </div>
                      <span className={`text-xs font-medium ${st.color}`}>{st.label}</span>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ 对话详情弹窗 ═══ */}
        <Dialog open={!!selectedConvId} onOpenChange={() => setSelectedConvId(null)}>
          <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                对话 #{selectedConvId}
                {convDetail?.conversation && (
                  <Badge variant="outline" className="ml-2">
                    {convDetail.conversation.status}
                  </Badge>
                )}
              </DialogTitle>
            </DialogHeader>

            {convDetail && (
              <>
                {/* 对话消息 */}
                <div className="flex-1 overflow-y-auto space-y-3 max-h-[50vh] border rounded-lg p-4 bg-muted/10">
                  {convDetail.messages.map((msg: any) => {
                    const roleConfig = ROLE_CONFIG[msg.role] || ROLE_CONFIG.system;
                    const RoleIcon = roleConfig.icon;
                    const isUser = msg.role === "user";

                    return (
                      <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[80%] ${isUser ? "bg-primary text-primary-foreground rounded-2xl rounded-br-md px-4 py-2" : ""}`}>
                          {!isUser && (
                            <div className="flex gap-2 items-start">
                              <div className={`w-6 h-6 rounded-md ${roleConfig.color} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                                <RoleIcon className="h-3 w-3" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-xs text-muted-foreground mb-0.5">{roleConfig.label}</div>
                                <div className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</div>
                                {msg.tool_calls?.length > 0 && (
                                  <div className="mt-1 flex gap-1 flex-wrap">
                                    {msg.tool_calls.map((tc: any, j: number) => (
                                      <Badge key={j} variant="outline" className="text-[10px]">
                                        🔧 {tc.name}: {tc.result?.message?.substring(0, 50) || "执行完成"}
                                      </Badge>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          {isUser && <span className="text-sm">{msg.content}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 操作区域 */}
                <div className="border-t pt-4 space-y-3">
                  {/* 人工回复 */}
                  <div className="flex gap-2">
                    <Textarea value={replyText} onChange={e => setReplyText(e.target.value)}
                      placeholder="输入人工回复..." rows={2} className="text-sm" />
                    <Button className="self-end" disabled={!replyText.trim() || sendMsg.isPending}
                      onClick={() => selectedConvId && sendMsg.mutate({ conversationId: selectedConvId, content: replyText })}>
                      {sendMsg.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                    </Button>
                  </div>

                  {/* 操作按钮 */}
                  <div className="flex gap-2 flex-wrap">
                    <div className="flex-1">
                      <Textarea value={resolution} onChange={e => setResolution(e.target.value)}
                        placeholder="解决方案备注（可选）..." rows={1} className="text-xs" />
                    </div>
                    <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700"
                      disabled={finishSession.isPending}
                      onClick={() => selectedConvId && finishSession.mutate({
                        conversationId: selectedConvId, resolution: resolution || undefined,
                      })}>
                      <CheckCircle className="h-3.5 w-3.5 mr-1" />标记解决
                    </Button>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
