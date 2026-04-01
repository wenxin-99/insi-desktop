import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Users, Coins, Bot, TrendingUp } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminDashboard() {
  const { data: users, isLoading: usersLoading } = trpc.user.getAll.useQuery();
  const { data: models, isLoading: modelsLoading } = trpc.aiModel.getAll.useQuery();
  const { data: transactions, isLoading: transactionsLoading } = trpc.fishCoin.getAllTransactions.useQuery({ limit: 20 });

  const isLoading = usersLoading || modelsLoading || transactionsLoading;

  // 统计数据
  const totalUsers = users?.length || 0;
  const totalModels = models?.length || 0;
  const enabledModels = models?.filter((m) => m.enabled).length || 0;
  
  // 计算总🐟币余额
  const totalBalance = users?.reduce((sum, user) => sum + parseFloat(user.fishCoinBalance), 0) || 0;

  // 最近消费统计
  const recentConsumption = transactions
    ?.filter((t) => t.type === "consume")
    .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0) || 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">管理员仪表板</h1>
        <p className="text-muted-foreground mt-2">平台运营数据概览</p>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总用户数</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalUsers}</div>
            <p className="text-xs text-muted-foreground mt-1">注册用户总数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">AI模型</CardTitle>
            <Bot className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {enabledModels} / {totalModels}
            </div>
            <p className="text-xs text-muted-foreground mt-1">启用 / 总数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">🐟币总余额</CardTitle>
            <Coins className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBalance.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">所有用户余额总和</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">最近消费</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{recentConsumption.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground mt-1">最近20笔消费总额</p>
          </CardContent>
        </Card>
      </div>

      {/* 最近交易记录 */}
      <Card>
        <CardHeader>
          <CardTitle>最近交易记录</CardTitle>
          <CardDescription>最近20笔🐟币交易</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>用户ID</TableHead>
                <TableHead>类型</TableHead>
                <TableHead>金额</TableHead>
                <TableHead>余额</TableHead>
                <TableHead>描述</TableHead>
                <TableHead>时间</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions?.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>{transaction.userId}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        transaction.type === "consume"
                          ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                          : transaction.type === "recharge"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }`}
                    >
                      {transaction.type === "consume"
                        ? "消费"
                        : transaction.type === "recharge"
                        ? "充值"
                        : "调整"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={`font-semibold ${
                        parseFloat(transaction.amount) < 0 ? "text-red-600" : "text-green-600"
                      }`}
                    >
                      {transaction.amount}
                    </span>
                  </TableCell>
                  <TableCell>{transaction.balanceAfter}</TableCell>
                  <TableCell className="max-w-xs truncate">{transaction.description}</TableCell>
                  <TableCell>{new Date(transaction.createdAt).toLocaleString("zh-CN")}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
