/**
 * RefundTab — 管理员退款管理（安全加固版）
 *
 * 安全措施：
 *   - 退款前需手动输入订单号后4位确认
 *   - 展示退款实际结果（扣除🐟币数、原路退款状态）
 *   - 已退款订单不可重复操作
 *   - 退款原因必填（至少2字）
 */
import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import { RefreshCw, Undo2, Loader2, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";

export function RefundTab() {
  const [statusFilter, setStatusFilter] = useState("paid");
  const [searchTerm, setSearchTerm] = useState("");
  const [refundDialog, setRefundDialog] = useState<any>(null);
  const [reason, setReason] = useState("用户申请退款");
  const [refundCoins, setRefundCoins] = useState(true);
  const [refundPayment, setRefundPayment] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");
  const [resultDialog, setResultDialog] = useState<any>(null);

  const { data: orders, isLoading, refetch } = trpc.fishCoin.getPaymentOrders.useQuery(
    { status: statusFilter as any, limit: 100 },
    { refetchOnWindowFocus: false }
  );
  const refundMutation = trpc.fishCoin.refundOrder.useMutation();

  // 前端搜索过滤（订单号 / 用户名）
  const filteredOrders = orders?.filter((o: any) => {
    if (!searchTerm.trim()) return true;
    const q = searchTerm.trim().toLowerCase();
    return (
      o.outTradeNo?.toLowerCase().includes(q) ||
      o.userName?.toLowerCase().includes(q) ||
      String(o.userId).includes(q)
    );
  });

  const openRefundDialog = (order: any) => {
    setRefundDialog(order);
    setReason("用户申请退款");
    setRefundCoins(true);
    setRefundPayment(false);
    setConfirmInput("");
  };

  // 需要输入订单号后4位才能确认退款
  const confirmCode = refundDialog?.outTradeNo?.slice(-4) || "";
  const canConfirm = confirmInput === confirmCode && reason.trim().length >= 2;

  const handleRefund = async () => {
    if (!refundDialog || !canConfirm) return;

    try {
      const result = await refundMutation.mutateAsync({
        outTradeNo: refundDialog.outTradeNo,
        reason: reason.trim(),
        refundFishCoins: refundCoins,
        refundPayment,
      });

      setRefundDialog(null);
      setResultDialog(result); // 展示退款结果
      refetch();
    } catch (e: any) {
      toast.error("退款失败", { description: e.message });
    }
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

  return (
    <div className="space-y-4">
      {/* 筛选 + 搜索 */}
      <div className="flex items-center gap-3 flex-wrap">
        <Input
          placeholder="搜索订单号 / 用户名"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-64"
        />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">全部</SelectItem>
            <SelectItem value="paid">已支付</SelectItem>
            <SelectItem value="refunded">已退款</SelectItem>
            <SelectItem value="pending">待支付</SelectItem>
            <SelectItem value="expired">已过期</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-1" /> 刷新
        </Button>
        <span className="text-sm text-muted-foreground">
          {searchTerm ? `${filteredOrders?.length || 0} / ${orders?.length || 0}` : `${orders?.length || 0}`} 条
        </span>
      </div>

      {/* 订单列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">支付订单</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">加载中...</div>
          ) : !filteredOrders?.length ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "未找到匹配的订单" : "暂无订单"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">订单号</th>
                    <th className="py-2 pr-3 font-medium">用户</th>
                    <th className="py-2 pr-3 font-medium">金额</th>
                    <th className="py-2 pr-3 font-medium">🐟币</th>
                    <th className="py-2 pr-3 font-medium">方式</th>
                    <th className="py-2 pr-3 font-medium">状态</th>
                    <th className="py-2 pr-3 font-medium">时间</th>
                    <th className="py-2 font-medium">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order: any) => (
                    <tr key={order.id} className="border-b last:border-0 hover:bg-muted/30">
                      <td className="py-2.5 pr-3">
                        <span
                          className="font-mono text-xs cursor-pointer hover:text-primary"
                          title="点击复制"
                          onClick={() => { navigator.clipboard.writeText(order.outTradeNo); toast.success("已复制订单号"); }}
                        >
                          {order.outTradeNo}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3">{order.userName}</td>
                      <td className="py-2.5 pr-3 font-medium">¥{order.amountCny}</td>
                      <td className="py-2.5 pr-3">
                        {order.fishCoinAmount}
                        {order.fishCoinBonus > 0 && (
                          <span className="text-green-600 text-xs ml-0.5">+{order.fishCoinBonus}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3">
                        {order.provider === "wechat" ? "微信" : order.provider === "alipay" ? "支付宝" : order.provider}
                      </td>
                      <td className="py-2.5 pr-3">{statusBadge(order.status)}</td>
                      <td className="py-2.5 pr-3 text-xs text-muted-foreground whitespace-nowrap">
                        {(order.paidAt || order.createdAt) && new Date(order.paidAt || order.createdAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="py-2.5">
                        {order.status === "paid" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => openRefundDialog(order)}
                          >
                            <Undo2 className="h-3.5 w-3.5 mr-1" /> 退款
                          </Button>
                        ) : order.status === "refunded" ? (
                          <span className="text-xs text-muted-foreground">
                            已退 ¥{order.refundAmount}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ 退款确认对话框（带安全确认）═══ */}
      <Dialog open={!!refundDialog} onOpenChange={(open) => !open && setRefundDialog(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              退款确认
            </DialogTitle>
            <DialogDescription>
              退款操作不可撤销
            </DialogDescription>
          </DialogHeader>

          {refundDialog && (
            <div className="space-y-4">
              {/* 订单信息摘要 */}
              <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">订单号</span>
                  <span className="font-mono text-xs">{refundDialog.outTradeNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">用户</span>
                  <span>{refundDialog.userName}（ID: {refundDialog.userId}）</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">支付金额</span>
                  <span className="font-semibold text-red-600">¥{refundDialog.amountCny}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">到账🐟币</span>
                  <span>{refundDialog.fishCoinAmount + refundDialog.fishCoinBonus}🐟</span>
                </div>
              </div>

              {/* 退款原因 */}
              <div className="space-y-1.5">
                <Label>退款原因 <span className="text-red-500">*</span></Label>
                <Input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="请输入退款原因（至少2字）"
                  maxLength={200}
                />
              </div>

              {/* 退款选项 */}
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="refund-coins"
                    checked={refundCoins}
                    onCheckedChange={(v) => setRefundCoins(!!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor="refund-coins" className="font-normal">扣回🐟币</Label>
                    <p className="text-xs text-muted-foreground">
                      从用户余额扣除 {refundDialog.fishCoinAmount + refundDialog.fishCoinBonus}🐟（余额不足则扣至 0）
                    </p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="refund-payment"
                    checked={refundPayment}
                    onCheckedChange={(v) => setRefundPayment(!!v)}
                    className="mt-0.5"
                  />
                  <div>
                    <Label htmlFor="refund-payment" className="font-normal">原路退款</Label>
                    <p className="text-xs text-muted-foreground">
                      退回 ¥{refundDialog.amountCny} 到用户{refundDialog.provider === "wechat" ? "微信" : "支付宝"}
                    </p>
                    {refundPayment && (
                      <p className="text-xs text-amber-600 mt-1">
                        需要配置 API 证书，退款到账需 1-3 个工作日
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* ★ 安全确认：输入订单号后4位 */}
              <Alert className="border-amber-200 bg-amber-50 dark:bg-amber-950/30">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <AlertDescription className="text-sm">
                  请输入订单号后 <strong>4</strong> 位确认退款：
                  <span className="font-mono ml-1 text-muted-foreground">****{confirmCode}</span>
                  <Input
                    className="mt-2 font-mono text-center tracking-widest"
                    value={confirmInput}
                    onChange={(e) => setConfirmInput(e.target.value.slice(0, 4))}
                    placeholder="输入4位确认码"
                    maxLength={4}
                  />
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setRefundDialog(null)}>取消</Button>
            <Button
              variant="destructive"
              onClick={handleRefund}
              disabled={refundMutation.isPending || !canConfirm}
            >
              {refundMutation.isPending ? (
                <><Loader2 className="h-4 w-4 mr-1 animate-spin" />处理中...</>
              ) : (
                "确认退款"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ 退款结果弹窗 ═══ */}
      <Dialog open={!!resultDialog} onOpenChange={(open) => !open && setResultDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              退款已完成
            </DialogTitle>
          </DialogHeader>

          {resultDialog && (
            <div className="space-y-3 text-sm">
              <div className="bg-green-50 dark:bg-green-950/30 rounded-lg p-3 space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">订单号</span>
                  <span className="font-mono text-xs">{resultDialog.outTradeNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">退款金额</span>
                  <span>¥{resultDialog.refundedAmountCny}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">扣回🐟币</span>
                  <span>
                    {resultDialog.refundedCoins}🐟
                    {resultDialog.refundedCoins < resultDialog.totalCoinsInOrder && (
                      <span className="text-amber-600 text-xs ml-1">
                        （订单含 {resultDialog.totalCoinsInOrder}🐟，余额不足仅扣 {resultDialog.refundedCoins}）
                      </span>
                    )}
                  </span>
                </div>
              </div>

              {/* 原路退款状态 */}
              {resultDialog.paymentRefund && (
                <div className={`flex items-center gap-2 p-2 rounded text-sm ${
                  resultDialog.paymentRefund.success
                    ? "bg-green-50 text-green-700 dark:bg-green-950/30 dark:text-green-400"
                    : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-400"
                }`}>
                  {resultDialog.paymentRefund.success ? (
                    <><CheckCircle2 className="h-4 w-4" /> 原路退款已提交</>
                  ) : (
                    <><XCircle className="h-4 w-4" /> 原路退款失败：{resultDialog.paymentRefund.errorMsg}</>
                  )}
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setResultDialog(null)}>关闭</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
