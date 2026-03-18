import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNotifications } from "@/contexts/NotificationContext";
import { Bell, BellOff, Check, CheckCheck, Trash2, AlertCircle, Info, TrendingDown, ArrowLeft, MessageSquareText, Video, FlaskConical } from "lucide-react";
import { useState, useMemo } from "react";

export default function Notifications() {
  const { notifications, unreadCount, markAsRead, clearNotifications } = useNotifications();
  const [filter, setFilter] = useState<string>("all");

  // 筛选通知
  const filteredNotifications = useMemo(() => {
    if (filter === "all") return notifications;
    return notifications.filter((n) => n.type === filter);
  }, [notifications, filter]);

  const getNotificationIcon = (type: string) => {
    const icons: Record<string, any> = {
      low_balance: TrendingDown,
      system: AlertCircle,
      transaction: Check,
      info: Info,
      feedback_received: MessageSquareText,
      video_generation_success: Video,
      video_generation_failed: Video,
      research_complete: FlaskConical,
    };
    return icons[type] || Info;
  };

  const getNotificationColor = (type: string) => {
    const colors: Record<string, string> = {
      low_balance: "text-yellow-500",
      system: "text-blue-500",
      transaction: "text-green-500",
      info: "text-gray-500",
      feedback_received: "text-purple-500",
      video_generation_success: "text-green-500",
      video_generation_failed: "text-red-500",
      research_complete: "text-cyan-500",
    };
    return colors[type] || "text-gray-500";
  };

  const getNotificationBadge = (type: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      low_balance: { label: "余额不足", className: "bg-yellow-500/10 text-yellow-500" },
      system: { label: "系统通知", className: "bg-blue-500/10 text-blue-500" },
      transaction: { label: "交易通知", className: "bg-green-500/10 text-green-500" },
      info: { label: "信息", className: "bg-gray-500/10 text-gray-500" },
      feedback_received: { label: "反馈通知", className: "bg-purple-500/10 text-purple-500" },
      video_generation_success: { label: "视频完成", className: "bg-green-500/10 text-green-500" },
      video_generation_failed: { label: "视频失败", className: "bg-red-500/10 text-red-500" },
      research_complete: { label: "研究完成", className: "bg-cyan-500/10 text-cyan-500" },
    };
    const badge = badges[type] || badges.info;
    return <Badge className={badge.className}>{badge.label}</Badge>;
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString();
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回
      </Button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">通知中心</h1>
          <p className="text-muted-foreground mt-2">查看系统通知和重要提醒</p>
        </div>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <>
              <Badge variant="destructive" className="h-6 px-2">
                {unreadCount} 条未读
              </Badge>
              <Button variant="outline" size="sm" onClick={markAsRead}>
                <CheckCheck className="h-4 w-4 mr-2" />
                全部标记已读
              </Button>
            </>
          )}
          <Button variant="outline" size="sm" onClick={clearNotifications}>
            <Trash2 className="h-4 w-4 mr-2" />
            清空通知
          </Button>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-5">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">全部通知</CardTitle>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">未读通知</CardTitle>
            <BellOff className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">{unreadCount}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">余额提醒</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-500">
              {notifications.filter((n) => n.type === "low_balance").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">系统通知</CardTitle>
            <AlertCircle className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {notifications.filter((n) => n.type === "system").length}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">反馈通知</CardTitle>
            <MessageSquareText className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-500">
              {notifications.filter((n) => n.type === "feedback_received").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 通知列表 */}
      <Tabs defaultValue="all" className="space-y-4" onValueChange={setFilter}>
        <TabsList>
          <TabsTrigger value="all">
            <Bell className="mr-2 h-4 w-4" />
            全部 ({notifications.length})
          </TabsTrigger>
          <TabsTrigger value="low_balance">
            <TrendingDown className="mr-2 h-4 w-4" />
            余额不足
          </TabsTrigger>
          <TabsTrigger value="system">
            <AlertCircle className="mr-2 h-4 w-4" />
            系统通知
          </TabsTrigger>
          <TabsTrigger value="transaction">
            <Check className="mr-2 h-4 w-4" />
            交易通知
          </TabsTrigger>
          <TabsTrigger value="feedback_received">
            <MessageSquareText className="mr-2 h-4 w-4" />
            反馈通知
          </TabsTrigger>
        </TabsList>

        <TabsContent value={filter} className="space-y-4">
          {filteredNotifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">暂无通知</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredNotifications.map((notification, index) => {
                const Icon = getNotificationIcon(notification.type);
                const iconColor = getNotificationColor(notification.type);
                
                return (
                  <Card key={index} className="hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg bg-muted ${iconColor}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold">{notification.title}</h3>
                              {getNotificationBadge(notification.type)}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatTime(notification.timestamp)}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {notification.message}
                          </p>
                          {notification.data && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs">
                              <pre className="whitespace-pre-wrap">
                                {JSON.stringify(notification.data, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
