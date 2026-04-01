import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { MessageSquare, Star, ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminFeedbacks() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "in_progress" | "resolved" | "closed" | undefined>(
    undefined
  );
  const [selectedFeedback, setSelectedFeedback] = useState<any>(null);
  const [newStatus, setNewStatus] = useState<"pending" | "in_progress" | "resolved" | "closed">("pending");
  const [adminResponse, setAdminResponse] = useState("");

  const { data: feedbacks, refetch } = trpc.feedback.getAll.useQuery({ status: statusFilter });
  const updateStatus = trpc.feedback.updateStatus.useMutation({
    onSuccess: () => {
      toast.success("反馈状态已更新");
      setSelectedFeedback(null);
      setAdminResponse("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
      pending: "secondary",
      in_progress: "default",
      resolved: "outline",
      closed: "destructive",
    };
    const labels: Record<string, string> = {
      pending: "待处理",
      in_progress: "处理中",
      resolved: "已解决",
      closed: "已关闭",
    };
    return <Badge variant={variants[status] || "default"}>{labels[status] || status}</Badge>;
  };

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      bug: "Bug反馈",
      feature: "功能建议",
      improvement: "改进建议",
      other: "其他",
    };
    return <Badge variant="outline">{labels[type] || type}</Badge>;
  };

  const handleUpdate = () => {
    if (!selectedFeedback) return;
    updateStatus.mutate({
      id: selectedFeedback.id,
      status: newStatus,
      adminResponse: adminResponse.trim() || undefined,
    });
  };

  const stats = {
    total: feedbacks?.length || 0,
    pending: feedbacks?.filter((f) => f.status === "pending").length || 0,
    in_progress: feedbacks?.filter((f) => f.status === "in_progress").length || 0,
    resolved: feedbacks?.filter((f) => f.status === "resolved").length || 0,
  };

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">反馈管理</h1>
            <p className="text-muted-foreground mt-2">查看和处理用户反馈</p>
          </div>
        </div>

        {/* 统计卡片 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">总反馈数</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">待处理</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">处理中</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.in_progress}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">已解决</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.resolved}</div>
            </CardContent>
          </Card>
        </div>

        {/* 反馈列表 */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>用户反馈列表</CardTitle>
                <CardDescription>点击反馈卡片查看详情并处理</CardDescription>
              </div>
              <Select
                value={statusFilter || "all"}
                onValueChange={(v) => setStatusFilter(v === "all" ? undefined : (v as any))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="pending">待处理</SelectItem>
                  <SelectItem value="in_progress">处理中</SelectItem>
                  <SelectItem value="resolved">已解决</SelectItem>
                  <SelectItem value="closed">已关闭</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {!feedbacks || feedbacks.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>暂无反馈</p>
              </div>
            ) : (
              <div className="space-y-4">
                {feedbacks.map((feedback) => (
                  <Card
                    key={feedback.id}
                    className="cursor-pointer hover:shadow-md transition-shadow"
                    onClick={() => {
                      setSelectedFeedback(feedback);
                      setNewStatus(feedback.status);
                      setAdminResponse(feedback.adminResponse || "");
                    }}
                  >
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CardTitle className="text-lg">{feedback.title}</CardTitle>
                            {getTypeBadge(feedback.type)}
                            {getStatusBadge(feedback.status)}
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>用户: {feedback.user?.name || feedback.user?.email || "未知"}</span>
                            <span>{new Date(feedback.createdAt).toLocaleString()}</span>
                            {feedback.rating && (
                              <div className="flex items-center gap-1">
                                {[...Array(feedback.rating)].map((_, i) => (
                                  <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground line-clamp-2">{feedback.content}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 处理反馈对话框 */}
        <Dialog open={!!selectedFeedback} onOpenChange={(open) => !open && setSelectedFeedback(null)}>
          <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>处理反馈</DialogTitle>
              <DialogDescription>更新反馈状态并添加回复</DialogDescription>
            </DialogHeader>

            {selectedFeedback && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{selectedFeedback.title}</h3>
                    {getTypeBadge(selectedFeedback.type)}
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>用户: {selectedFeedback.user?.name || selectedFeedback.user?.email}</span>
                    <span>{new Date(selectedFeedback.createdAt).toLocaleString()}</span>
                    {selectedFeedback.rating && (
                      <div className="flex items-center gap-1">
                        {[...Array(selectedFeedback.rating)].map((_, i) => (
                          <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>反馈内容</Label>
                  <div className="bg-muted p-4 rounded-lg">
                    <p className="text-sm whitespace-pre-wrap">{selectedFeedback.content}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">状态</Label>
                  <Select value={newStatus} onValueChange={(v: any) => setNewStatus(v)}>
                    <SelectTrigger id="status">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">待处理</SelectItem>
                      <SelectItem value="in_progress">处理中</SelectItem>
                      <SelectItem value="resolved">已解决</SelectItem>
                      <SelectItem value="closed">已关闭</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="response">管理员回复</Label>
                  <Textarea
                    id="response"
                    placeholder="输入您的回复..."
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    rows={6}
                    className="resize-none"
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setSelectedFeedback(null)}>
                取消
              </Button>
              <Button onClick={handleUpdate} disabled={updateStatus.isPending}>
                {updateStatus.isPending ? "更新中..." : "更新"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
