import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Coins, TrendingUp, TrendingDown, ArrowUpDown, Filter, ArrowLeft } from "lucide-react";
import { useState, useMemo } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useTranslation } from "react-i18next";
import DashboardLayout from '@/components/DashboardLayout';

export default function Transactions() {
  const { t } = useTranslation();
  const [typeFilter, setTypeFilter] = useState<string>("all");
  
  const { data: transactions, isLoading } = trpc.fishCoin.getTransactions.useQuery({ limit: 100 });
  const { data: balance } = trpc.fishCoin.getBalance.useQuery();

  // 筛选交易记录
  const filteredTransactions = useMemo(() => {
    if (!transactions) return [];
    if (typeFilter === "all") return transactions;
    return transactions.filter((t) => t.type === typeFilter);
  }, [transactions, typeFilter]);

  // 计算统计数据
  const stats = useMemo(() => {
    if (!transactions) return { totalIncome: 0, totalExpense: 0, transactionCount: 0 };
    
    const totalIncome = transactions
      .filter((t) => t.type === "recharge")
      .reduce((sum, t) => sum + parseFloat(t.amount), 0);
    
    const totalExpense = transactions
      .filter((t) => t.type === "consume")
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount)), 0);
    
    return {
      totalIncome,
      totalExpense,
      transactionCount: transactions.length,
    };
  }, [transactions]);

  // 生成余额趋势图数据
  const chartData = useMemo(() => {
    if (!transactions || transactions.length === 0) return [];
    
    // 按时间排序
    const sorted = [...transactions].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
    
    let runningBalance = 0;
    const data = sorted.map((t) => {
      runningBalance += parseFloat(t.amount);
      return {
        date: new Date(t.createdAt).toLocaleDateString(),
        balance: parseFloat(runningBalance.toFixed(2)),
      };
    });
    
    // 只显示最近30条记录
    return data.slice(-30);
  }, [transactions]);

  const getTransactionTypeBadge = (type: string) => {
    const badges: Record<string, { label: string; icon: any; className: string }> = {
      recharge: { 
        label: t('pages.transactions.type') === '类型' ? '充值' : 'Recharge', 
        icon: TrendingUp, 
        className: "bg-green-500/10 text-green-500" 
      },
      consume: { 
        label: t('pages.transactions.type') === '类型' ? '消费' : 'Consume', 
        icon: TrendingDown, 
        className: "bg-red-500/10 text-red-500" 
      },
    };
    const badge = badges[type] || badges.consume;
    const Icon = badge.icon;
    return (
      <Badge className={badge.className}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.label}
      </Badge>
    );
  };

  return (
    <DashboardLayout>
    <div className="container mx-auto py-8 space-y-6">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        {t('pages.dashboard.backToHome').replace('首页', '').replace('Home', 'Back')}
      </Button>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('pages.transactions.title')}</h1>
          <p className="text-muted-foreground mt-2">{t('pages.transactions.transactionHistory')}</p>
        </div>
        <div className="flex items-center gap-2">
          <Coins className="h-5 w-5 text-yellow-500" />
          <span className="text-lg font-semibold">
            {balance ? parseFloat(balance.balance).toFixed(2) : "0.00"} 🐟币
          </span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pages.transactions.type') === '类型' ? '总充值' : 'Total Recharge'}</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-500">
              +{stats.totalIncome.toFixed(2)} 🐟币
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.transactions.type') === '类型' ? '累计充值金额' : 'Total recharge amount'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pages.transactions.type') === '类型' ? '总消费' : 'Total Expense'}</CardTitle>
            <TrendingDown className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-500">
              -{stats.totalExpense.toFixed(2)} 🐟币
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.transactions.type') === '类型' ? '累计消费金额' : 'Total expense amount'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('pages.transactions.type') === '类型' ? '交易次数' : 'Transaction Count'}</CardTitle>
            <ArrowUpDown className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {stats.transactionCount}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {t('pages.transactions.type') === '类型' ? '总交易记录数' : 'Total transaction records'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 余额趋势图 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('pages.transactions.type') === '类型' ? '余额变动趋势' : 'Balance Trend'}</CardTitle>
          <CardDescription>{t('pages.transactions.type') === '类型' ? '最近30次交易的余额变化' : 'Balance changes for the last 30 transactions'}</CardDescription>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <YAxis 
                  className="text-xs"
                  tick={{ fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip 
                  contentStyle={{
                    backgroundColor: 'hsl(var(--popover))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'hsl(var(--popover-foreground))' }}
                />
                <Line 
                  type="monotone" 
                  dataKey="balance" 
                  stroke="hsl(var(--primary))" 
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground">
              {t('pages.transactions.noTransactions')}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 交易记录列表 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('pages.transactions.transactionHistory')}</CardTitle>
              <CardDescription>{t('pages.transactions.type') === '类型' ? '所有充值和消费记录' : 'All recharge and expense records'}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder={t('pages.transactions.type') === '类型' ? '筛选类型' : 'Filter type'} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('pages.transactions.type') === '类型' ? '全部' : 'All'}</SelectItem>
                  <SelectItem value="recharge">{t('pages.transactions.type') === '类型' ? '充值' : 'Recharge'}</SelectItem>
                  <SelectItem value="consume">{t('pages.transactions.type') === '类型' ? '消费' : 'Consume'}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('pages.transactions.type') === '类型' ? '加载中...' : 'Loading...'}
            </div>
          ) : !filteredTransactions || filteredTransactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('pages.transactions.noTransactions')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('pages.transactions.type')}</TableHead>
                  <TableHead>{t('pages.transactions.amount')}</TableHead>
                  <TableHead>{t('pages.transactions.description')}</TableHead>
                  <TableHead>{t('pages.transactions.balanceAfter')}</TableHead>
                  <TableHead>{t('pages.transactions.time')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTransactions.map((transaction) => {
                  const amount = parseFloat(transaction.amount);
                  const isPositive = amount > 0;
                  
                  return (
                    <TableRow key={transaction.id}>
                      <TableCell>{getTransactionTypeBadge(transaction.type)}</TableCell>
                      <TableCell>
                        <span className={isPositive ? "text-green-500 font-semibold" : "text-red-500 font-semibold"}>
                          {isPositive ? "+" : ""}{amount.toFixed(2)} 🐟币
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md truncate">
                        {transaction.description || "-"}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        → {transaction.balanceAfter}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(transaction.createdAt).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
