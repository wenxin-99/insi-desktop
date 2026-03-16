import { useState } from "react";
import { useTranslation } from "react-i18next";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Coins, CreditCard, Filter, Package, Receipt, Search, ArrowLeft } from "lucide-react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import DashboardLayout from '@/components/DashboardLayout';

type OrderStatus = 'pending' | 'completed' | 'failed' | 'refunded' | 'all';

export default function Orders() {
  const { t } = useTranslation();
  const [statusFilter, setStatusFilter] = useState<OrderStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  const { data: orders, isLoading } = trpc.payment.getOrders.useQuery({
    limit: 50,
  });

  // 过滤订单
  const filteredOrders = orders?.filter(order => {
    // 状态筛选
    if (statusFilter !== 'all' && order.status !== statusFilter) {
      return false;
    }
    
    // 搜索筛选
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        order.productName.toLowerCase().includes(query) ||
        order.stripePaymentIntentId?.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { variant: "default" | "secondary" | "destructive" | "outline", label: string }> = {
      pending: { variant: "secondary", label: t('pages.orders.pending') },
      completed: { variant: "default", label: t('pages.orders.paid') },
      failed: { variant: "destructive", label: t('pages.orders.cancelled') },
      refunded: { variant: "outline", label: t('pages.orders.cancelled') },
    };
    
    const config = variants[status] || { variant: "secondary", label: status };
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getOrderTypeLabel = (type: string) => {
    return type === 'coin_package' ? t('pages.pricing.tabs.packages') : t('pages.pricing.tabs.subscriptions');
  };

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-background">
      <div className="container py-8 space-y-6">
        {/* Back Button */}
        <Button
          variant="ghost"
          size="default"
          onClick={() => window.history.back()}
          className="min-h-[44px] px-4"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          <span className="text-base">{t('pages.orders.backButton')}</span>
        </Button>
        
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">{t('pages.orders.title')}</h1>
          <p className="text-muted-foreground">
            {t('pages.orders.subtitle')}
          </p>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Filter className="w-5 h-5" />
              {t('pages.orders.filterTitle')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              {/* 状态筛选 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('pages.orders.orderStatus')}</label>
                <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as OrderStatus)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t('pages.orders.all')}</SelectItem>
                    <SelectItem value="pending">{t('pages.orders.pending')}</SelectItem>
                    <SelectItem value="completed">{t('pages.orders.paid')}</SelectItem>
                    <SelectItem value="failed">{t('pages.orders.cancelled')}</SelectItem>
                    <SelectItem value="refunded">{t('pages.orders.cancelled')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* 搜索 */}
              <div className="space-y-2">
                <label className="text-sm font-medium">{t('pages.orders.search')}</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder={t('pages.orders.searchPlaceholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Orders List */}
        <div className="space-y-4">
          {isLoading ? (
            // Loading skeleton
            Array.from({ length: 3 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-6">
                  <div className="space-y-3">
                    <Skeleton className="h-6 w-1/3" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                </CardContent>
              </Card>
            ))
          ) : filteredOrders && filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <Card key={order.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    {/* Left: Order Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                          {order.orderType === 'coin_package' ? (
                            <Coins className="w-5 h-5 text-primary" />
                          ) : (
                            <Package className="w-5 h-5 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-lg">{order.productName}</h3>
                            {getStatusBadge(order.status)}
                            <Badge variant="outline">{getOrderTypeLabel(order.orderType)}</Badge>
                          </div>
                          <p className="text-sm text-muted-foreground mt-1">
                            {t('pages.orders.orderNumber')}: {order.stripePaymentIntentId}
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Calendar className="w-4 h-4" />
                          <span>
                            {format(new Date(order.createdAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                          </span>
                        </div>
                        
                        {order.coinAmount && (
                          <div className="flex items-center gap-2 text-primary font-medium">
                            <Coins className="w-4 h-4" />
                            <span>+{order.coinAmount} 🐟币</span>
                          </div>
                        )}
                      </div>

                      {order.paidAt && (
                        <div className="text-xs text-muted-foreground">
                          支付时间: {format(new Date(order.paidAt), 'yyyy年MM月dd日 HH:mm', { locale: zhCN })}
                        </div>
                      )}
                    </div>

                    {/* Right: Amount */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-2xl font-bold">
                        ${order.amount}
                      </div>
                      <div className="text-xs text-muted-foreground uppercase">
                        {order.currency}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            // Empty state
            <Card>
              <CardContent className="p-12">
                <div className="flex flex-col items-center justify-center text-center space-y-4">
                  <div className="p-4 rounded-full bg-muted">
                    <Receipt className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-semibold text-lg">{t('pages.orders.noOrders')}</h3>
                    <p className="text-sm text-muted-foreground max-w-sm">
                      {statusFilter !== 'all' || searchQuery
                        ? (t('pages.dashboard.type') === '类型' ? '没有找到符合条件的订单' : 'No orders found matching the criteria')
                        : (t('pages.dashboard.type') === '类型' ? '您还没有购买任何产品，去看看有什么适合您的吧' : 'You haven\'t purchased any products yet, check out what\'s right for you')}
                    </p>
                  </div>
                  {statusFilter === 'all' && !searchQuery && (
                    <Button onClick={() => window.location.href = '/pricing'}>
                      <CreditCard className="w-4 h-4 mr-2" />
                      浏览产品
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Summary */}
        {filteredOrders && filteredOrders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">统计信息</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">总订单数</p>
                  <p className="text-2xl font-bold">{filteredOrders.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">已完成</p>
                  <p className="text-2xl font-bold text-green-600">
                    {filteredOrders.filter(o => o.status === 'completed').length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">处理中</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {filteredOrders.filter(o => o.status === 'pending').length}
                  </p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">总消费</p>
                  <p className="text-2xl font-bold">
                    ${filteredOrders
                      .filter(o => o.status === 'completed')
                      .reduce((sum, o) => sum + parseFloat(o.amount), 0)
                      .toFixed(2)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </DashboardLayout>
  );
}
