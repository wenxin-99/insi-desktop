/**
 * Orders — 用户订单历史
 * 显示微信/支付宝充值订单，支持状态筛选和订单号搜索
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, Receipt, Search, ArrowLeft, Copy, CheckCircle2 } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

export default function Orders() {
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [copiedId, setCopiedId] = useState("");

  const { data: orders, isLoading } = trpc.fishCoin.getMyOrders.useQuery({ limit: 50 });

  const filteredOrders = orders?.filter((order: any) => {
    if (statusFilter !== "all" && order.status !== statusFilter) return false;
    if (searchQuery) {
      return order.outTradeNo?.toLowerCase().includes(searchQuery.toLowerCase());
    }
    return true;
  });

  const copyOrderNo = (no: string) => {
    navigator.clipboard.writeText(no);
    setCopiedId(no);
    toast.success("订单号已复制");
    setTimeout(() => setCopiedId(""), 2000);
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
      paid: { label: "已支付", variant: "default" },
      refunded: { label: "已退款", variant: "secondary" },
      pending: { label: "待支付", variant: "outline" },
      failed: { label: "失败", variant: "destructive" },
      expired: { label: "已过期", variant: "outline" },
    };
    const s = map[status] || { label: status, variant: "outline" as const };
    return <Badge variant={s.variant}>{s.label}</Badge>;
  };

  const providerLabel = (p: string) =>
    p === "wechat" ? "微信支付" : p === "alipay" ? "支付宝" : p;

  const stats = filteredOrders ? {
    total: filteredOrders.length,
    paid: filteredOrders.filter((o: any) => o.status === "paid").length,
    totalAmount: filteredOrders.filter((o: any) => o.status === "paid").reduce((s: number, o: any) => s + (o.amountCny || 0), 0),
    totalCoins: filteredOrders.filter((o: any) => o.status === "paid").reduce((s: number, o: any) => s + (o.fishCoinAmount || 0) + (o.fishCoinBonus || 0), 0),
  } : null;

  return (
    <DashboardLayout>
      <div className="container max-w-4xl py-8 space-y-6">
        <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" /> 返回
        </Button>

        <div>
          <h1 className="text-2xl font-bold">充值订单</h1>
          <p className="text-muted-foreground text-sm mt-1">查看您的🐟币充值记录</p>
        </div>

        {/* 筛选 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex gap-4 flex-wrap">
              <div className="space-y-1.5 flex-1 min-w-[140px]">
                <label className="text-sm font-medium">订单状态</label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部</SelectItem>
                    <SelectItem value="paid">已支付</SelectItem>
                    <SelectItem value="refunded">已退款</SelectItem>
                    <SelectItem value="pending">待支付</SelectItem>
                    <SelectItem value="expired">已过期</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-[2] min-w-[200px]">
                <label className="text-sm font-medium">搜索订单</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input placeholder="输入订单号搜索..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* 订单列表 */}
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Card key={i}><CardContent className="p-5"><Skeleton className="h-5 w-1/3 mb-2" /><Skeleton className="h-4 w-2/3" /></CardContent></Card>
            ))}
          </div>
        ) : filteredOrders && filteredOrders.length > 0 ? (
          <div className="space-y-3">
            {filteredOrders.map((order: any) => (
              <Card key={order.outTradeNo} className="hover:shadow-sm transition-shadow">
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xl font-bold">¥{order.amountCny}</span>
                        {statusBadge(order.status)}
                        <span className="text-sm text-muted-foreground">{providerLabel(order.provider)}</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <Coins className="h-4 w-4 text-amber-500" />
                        <span>{order.fishCoinAmount}🐟</span>
                        {order.fishCoinBonus > 0 && <span className="text-green-600">+{order.fishCoinBonus}🐟 赠送</span>}
                        {order.status === "refunded" && order.refundAmount && <span className="text-red-500 ml-2">已退 ¥{order.refundAmount}</span>}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>订单号：</span>
                        <button className="font-mono hover:text-primary transition-colors flex items-center gap-1" onClick={() => copyOrderNo(order.outTradeNo)} title="点击复制">
                          {order.outTradeNo}
                          {copiedId === order.outTradeNo ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground whitespace-nowrap">
                      <div>{new Date(order.paidAt || order.createdAt).toLocaleDateString("zh-CN")}</div>
                      <div>{new Date(order.paidAt || order.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16">
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-muted"><Receipt className="w-8 h-8 text-muted-foreground" /></div>
                <div>
                  <h3 className="font-semibold text-lg">暂无订单记录</h3>
                  <p className="text-sm text-muted-foreground mt-1">
                    {statusFilter !== "all" || searchQuery ? "没有找到符合条件的订单" : "充值🐟币后订单会显示在这里"}
                  </p>
                </div>
                {statusFilter === "all" && !searchQuery && (
                  <Button onClick={() => (window.location.href = "/recharge")}><Coins className="w-4 h-4 mr-2" /> 去充值</Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* 统计 */}
        {stats && stats.total > 0 && (
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                <div><p className="text-sm text-muted-foreground">总订单</p><p className="text-2xl font-bold">{stats.total}</p></div>
                <div><p className="text-sm text-muted-foreground">已支付</p><p className="text-2xl font-bold text-green-600">{stats.paid}</p></div>
                <div><p className="text-sm text-muted-foreground">总充值</p><p className="text-2xl font-bold">¥{stats.totalAmount.toFixed(0)}</p></div>
                <div><p className="text-sm text-muted-foreground">总获得</p><p className="text-2xl font-bold text-amber-600">{stats.totalCoins}🐟</p></div>
              </div>
            </CardContent>
          </Card>
        )}

        <p className="text-xs text-muted-foreground text-center">如需退款，请将订单号发送给客服处理</p>
      </div>
    </DashboardLayout>
  );
}
