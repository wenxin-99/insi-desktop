import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Coins, ArrowLeft } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminUsers() {
  const { data: users, isLoading, refetch } = trpc.user.getAll.useQuery();
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [adjustAmount, setAdjustAmount] = useState("");
  const [description, setDescription] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);

  const adjustBalanceMutation = trpc.fishCoin.adjustBalance.useMutation({
    onSuccess: (data) => {
      toast.success(`余额调整成功！新余额: ${data.newBalance} 🐟币`);
      setDialogOpen(false);
      setAdjustAmount("");
      setDescription("");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "余额调整失败");
    },
  });

  const handleAdjustBalance = () => {
    if (!selectedUser || !adjustAmount || !description) {
      toast.error("请填写所有必填字段");
      return;
    }

    const amount = parseFloat(adjustAmount);
    if (isNaN(amount)) {
      toast.error("请输入有效的金额");
      return;
    }

    adjustBalanceMutation.mutate({
      userId: selectedUser.id,
      amount: adjustAmount,
      description,
    });
  };

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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground mt-2">管理所有用户的信息和🐟币余额</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>用户列表</CardTitle>
          <CardDescription>共 {users?.length || 0} 个用户</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>ID</TableHead>
                <TableHead>用户名</TableHead>
                <TableHead>邮箱</TableHead>
                <TableHead>角色</TableHead>
                <TableHead>🐟币余额</TableHead>
                <TableHead>注册时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>{user.id}</TableCell>
                  <TableCell className="font-medium">{user.name || "-"}</TableCell>
                  <TableCell>{user.email || "-"}</TableCell>
                  <TableCell>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        user.role === "admin"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                      }`}
                    >
                      {user.role}
                    </span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Coins className="h-4 w-4 text-amber-500" />
                      <span className="font-semibold">{user.fishCoinBalance}</span>
                    </div>
                  </TableCell>
                  <TableCell>{new Date(user.createdAt).toLocaleDateString("zh-CN")}</TableCell>
                  <TableCell>
                    <Dialog open={dialogOpen && selectedUser?.id === user.id} onOpenChange={(open) => {
                      setDialogOpen(open);
                      if (open) setSelectedUser(user);
                    }}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          调整余额
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>调整用户余额</DialogTitle>
                          <DialogDescription>
                            为用户 {user.name || user.email} 调整🐟币余额
                          </DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4 py-4">
                          <div className="space-y-2">
                            <Label>当前余额</Label>
                            <div className="flex items-center gap-2 text-lg font-semibold">
                              <Coins className="h-5 w-5 text-amber-500" />
                              {user.fishCoinBalance} 🐟币
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="amount">调整金额 *</Label>
                            <Input
                              id="amount"
                              type="number"
                              step="0.01"
                              placeholder="输入正数增加，负数减少"
                              value={adjustAmount}
                              onChange={(e) => setAdjustAmount(e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                              例如: 100 表示增加100🐟币，-50 表示减少50🐟币
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="description">说明 *</Label>
                            <Input
                              id="description"
                              placeholder="调整原因"
                              value={description}
                              onChange={(e) => setDescription(e.target.value)}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            variant="outline"
                            onClick={() => {
                              setDialogOpen(false);
                              setAdjustAmount("");
                              setDescription("");
                            }}
                          >
                            取消
                          </Button>
                          <Button
                            onClick={handleAdjustBalance}
                            disabled={adjustBalanceMutation.isPending}
                          >
                            {adjustBalanceMutation.isPending && (
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            )}
                            确认调整
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </TableCell>
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
