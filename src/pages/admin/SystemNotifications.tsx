import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, Check, CheckCheck, Trash2, AlertCircle, Info, AlertTriangle, CheckCircle, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";

export default function SystemNotifications() {
  const [typeFilter, setTypeFilter] = useState<"all" | "info" | "warning" | "error" | "success">("all");
  const [readFilter, setReadFilter] = useState<boolean | undefined>(undefined);

  const { data: notifications, refetch } = trpc.notification.getAll.useQuery({
    limit: 100,
    offset: 0,
    type: typeFilter,
    isRead: readFilter,
  });

  const { data: unreadCount } = trpc.notification.getUnreadCount.useQuery();

  const markAsReadMutation = trpc.notification.markAsRead.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("已标记为已读");
    },
  });

  const markAllAsReadMutation = trpc.notification.markAllAsRead.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("已全部标记为已读");
    },
  });

  const deleteMutation = trpc.notification.delete.useMutation({
    onSuccess: () => {
      refetch();
      toast.success("通知已删除");
    },
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "info":
        return <Info className="h-5 w-5 text-blue-500" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-500" />;
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      default:
        return <Bell className="h-5 w-5" />;
    }
  };

  const getTypeBadge = (type: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      info: "default",
      warning: "secondary",
      error: "destructive",
      success: "outline",
    };
    return (
      <Badge variant={variants[type] || "default"} className="capitalize">
        {type}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
      <div className="container py-8 max-w-6xl">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold mb-2">系统通知管理</h1>
            <p className="text-muted-foreground">查看和管理所有系统通知记录</p>
          </div>
        </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总通知数</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications?.length || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未读通知</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-500">{unreadCount?.count || 0}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">已读通知</CardTitle>
            <CheckCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              {(notifications?.length || 0) - (unreadCount?.count || 0)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选和操作 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>筛选和操作</CardTitle>
          <CardDescription>按类型和状态筛选通知</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">类型：</label>
              <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="info">信息</SelectItem>
                  <SelectItem value="warning">警告</SelectItem>
                  <SelectItem value="error">错误</SelectItem>
                  <SelectItem value="success">成功</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">状态：</label>
              <Select
                value={readFilter === undefined ? "all" : readFilter ? "read" : "unread"}
                onValueChange={(v) => {
                  if (v === "all") setReadFilter(undefined);
                  else if (v === "read") setReadFilter(true);
                  else setReadFilter(false);
                }}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  <SelectItem value="unread">未读</SelectItem>
                  <SelectItem value="read">已读</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="ml-auto">
              <Button
                onClick={() => markAllAsReadMutation.mutate()}
                disabled={markAllAsReadMutation.isPending || (unreadCount?.count || 0) === 0}
                variant="outline"
              >
                <CheckCheck className="mr-2 h-4 w-4" />
                全部标记为已读
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 通知列表 */}
      <div className="space-y-4">
        {notifications && notifications.length > 0 ? (
          notifications.map((notification) => (
            <Card
              key={notification.id}
              className={`transition-all ${!notification.isRead ? "border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-950/20" : ""}`}
            >
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    {getTypeIcon(notification.type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">{notification.title}</CardTitle>
                        {getTypeBadge(notification.type)}
                        {!notification.isRead && (
                          <Badge variant="outline" className="bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300">
                            未读
                          </Badge>
                        )}
                      </div>
                      <CardDescription className="text-sm">
                        {new Date(notification.createdAt).toLocaleString("zh-CN")}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {!notification.isRead && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markAsReadMutation.mutate({ id: notification.id })}
                        disabled={markAsReadMutation.isPending}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (confirm("确定要删除这条通知吗？")) {
                          deleteMutation.mutate({ id: notification.id });
                        }
                      }}
                      disabled={deleteMutation.isPending}
                    >
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm whitespace-pre-wrap">{notification.content}</p>
                {notification.metadata && (
                  <details className="mt-4">
                    <summary className="text-sm text-muted-foreground cursor-pointer hover:text-foreground">
                      查看详细信息
                    </summary>
                    <pre className="mt-2 text-xs bg-muted p-3 rounded overflow-x-auto">
                      {(() => { try { return JSON.stringify(JSON.parse(notification.metadata), null, 2); } catch { return notification.metadata; } })()}
                    </pre>
                  </details>
                )}
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">暂无通知记录</p>
            </CardContent>
          </Card>
        )}
      </div>
      </div>
    </DashboardLayout>
  );
}
