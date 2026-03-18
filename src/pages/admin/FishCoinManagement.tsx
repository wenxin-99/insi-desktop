/**
 * FishCoinManagement — 鱼币管理页面（入口编排文件）
 * 原始 604 行 → 拆分为 4 个文件
 */
import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";

import { UsersTab } from "./fishCoinManagement/UsersTab";
import { TransactionsTab } from "./fishCoinManagement/TransactionsTab";
import { SyncTab } from "./fishCoinManagement/SyncTab";

export default function FishCoinManagement() {
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [adjustType, setAdjustType] = useState<"add" | "deduct">("add");
  const [filterType, setFilterType] = useState("all");
  const [filterSyncStatus, setFilterSyncStatus] = useState("all");
  const [filterDateRange, setFilterDateRange] = useState("all");
  const [selectedTransactions, setSelectedTransactions] = useState<number[]>([]);
  const [userSearchTerm, setUserSearchTerm] = useState("");

  const { data: users, isLoading: usersLoading, refetch: refetchUsers } = trpc.admin.getAllUsers.useQuery();
  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = trpc.admin.getFishCoinTransactions.useQuery({
    userId: selectedUserId ?? undefined, limit: 50,
    type: filterType as any, syncStatus: filterSyncStatus as any, dateRange: filterDateRange as any,
  }, { enabled: !!selectedUserId });
  const { data: syncStatus, isLoading: syncStatusLoading, refetch: refetchSyncStatus } = trpc.admin.getForumSyncStatus.useQuery();

  const adjustBalance = trpc.admin.adjustUserBalance.useMutation({
    onSuccess: () => { toast.success("余额调整成功"); refetchUsers(); setAdjustAmount(""); setAdjustReason(""); },
    onError: (e) => toast.error(`余额调整失败：${e.message}`),
  });
  const triggerSync = trpc.admin.triggerForumSync.useMutation({
    onSuccess: (r) => { toast.success(`同步完成：检查${r.totalChecked}个用户，补偿${r.totalCompensated}笔交易`); refetchSyncStatus(); },
    onError: (e) => toast.error(`同步失败：${e.message}`),
  });
  const reverseDeduction = trpc.admin.reverseForumDeduction.useMutation({
    onSuccess: () => { toast.success("撤销成功"); refetchTransactions(); refetchUsers(); },
    onError: (e) => toast.error(`撤销失败：${e.message}`),
  });
  const batchReverse = trpc.admin.batchReverseForumDeduction.useMutation({
    onSuccess: (r: any) => { toast.success(`批量撤销：${r.successCount}成功，${r.failedCount}失败`); refetchTransactions(); refetchUsers(); setSelectedTransactions([]); },
    onError: (e: any) => toast.error(`批量撤销失败：${e.message}`),
  });

  const handleAdjustBalance = () => {
    if (!selectedUserId || !adjustAmount || !adjustReason) { toast.error("请填写完整信息"); return; }
    const amount = parseFloat(adjustAmount);
    if (isNaN(amount) || amount <= 0) { toast.error("请输入有效的金额"); return; }
    adjustBalance.mutate({ userId: selectedUserId, amount: adjustType === "add" ? amount : -amount, reason: adjustReason });
  };

  const handleReverseDeduction = (transactionId: number) => {
    if (confirm("确认要撤销该笔论坛积分扣除吗？")) reverseDeduction.mutate({ transactionId });
  };
  const handleBatchReverse = () => {
    if (selectedTransactions.length === 0) { toast.error("请先选择要撤销的交易"); return; }
    if (confirm(`确认批量撤销 ${selectedTransactions.length} 笔？`)) batchReverse.mutate({ transactionIds: selectedTransactions });
  };

  const filteredUsers = users?.filter(u =>
    u.name?.toLowerCase().includes(searchTerm.toLowerCase()) || u.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => setLocation("/admin")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">鱼币管理</h1>
            <p className="text-sm text-gray-500">管理用户鱼币余额、查看交易记录和同步状态</p>
          </div>
        </div>

        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="bg-white/80 backdrop-blur-sm">
            <TabsTrigger value="users">用户余额</TabsTrigger>
            <TabsTrigger value="transactions">交易记录</TabsTrigger>
            <TabsTrigger value="sync">同步状态</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            <UsersTab
              filteredUsers={filteredUsers} usersLoading={usersLoading}
              searchTerm={searchTerm} setSearchTerm={setSearchTerm}
              refetchUsers={refetchUsers} setSelectedUserId={setSelectedUserId}
              adjustType={adjustType} setAdjustType={setAdjustType}
              adjustAmount={adjustAmount} setAdjustAmount={setAdjustAmount}
              adjustReason={adjustReason} setAdjustReason={setAdjustReason}
              handleAdjustBalance={handleAdjustBalance} adjustBalancePending={adjustBalance.isPending}
            />
          </TabsContent>

          <TabsContent value="transactions" className="space-y-4">
            <TransactionsTab
              users={users} transactions={transactions} transactionsLoading={transactionsLoading}
              selectedUserId={selectedUserId} setSelectedUserId={setSelectedUserId}
              userSearchTerm={userSearchTerm} setUserSearchTerm={setUserSearchTerm}
              filterType={filterType} setFilterType={setFilterType}
              filterSyncStatus={filterSyncStatus} setFilterSyncStatus={setFilterSyncStatus}
              filterDateRange={filterDateRange} setFilterDateRange={setFilterDateRange}
              selectedTransactions={selectedTransactions} setSelectedTransactions={setSelectedTransactions}
              handleReverseDeduction={handleReverseDeduction}
              handleBatchReverse={handleBatchReverse} batchReversePending={batchReverse.isPending}
            />
          </TabsContent>

          <TabsContent value="sync" className="space-y-4">
            <SyncTab
              syncStatus={syncStatus} syncStatusLoading={syncStatusLoading}
              triggerSync={() => triggerSync.mutate()} triggerSyncPending={triggerSync.isPending}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
