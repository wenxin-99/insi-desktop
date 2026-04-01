import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { trpc } from "@/lib/trpc";
import { Edit, Search , ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function QuotaManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [editingUser, setEditingUser] = useState<any>(null);
  const [quotaValues, setQuotaValues] = useState({
    dailyChatQuota: 0,
    dailyImageQuota: 0,
    dailyDocumentQuota: 0,
  });

  const { data: users, isLoading, refetch } = trpc.user.getAll.useQuery();
  const updateQuotaMutation = trpc.user.updateQuota.useMutation({
    onSuccess: () => {
      toast.success("配额更新成功");
      setEditingUser(null);
      refetch();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const filteredUsers = users?.filter(
    (user) =>
      user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleEditClick = (user: any) => {
    setEditingUser(user);
    setQuotaValues({
      dailyChatQuota: user.dailyChatQuota,
      dailyImageQuota: user.dailyImageQuota,
      dailyDocumentQuota: user.dailyDocumentQuota,
    });
  };

  const handleSaveQuota = () => {
    if (!editingUser) return;

    updateQuotaMutation.mutate({
      userId: editingUser.id,
      ...quotaValues,
    });
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">配额管理</h1>
            <p className="text-muted-foreground mt-2">
              管理用户的每日AI功能使用配额
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>用户配额列表</CardTitle>
            <CardDescription>
              查看和编辑所有用户的配额限制
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="搜索用户名或邮箱..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                加载中...
              </div>
            ) : (
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户</TableHead>
                      <TableHead>邮箱</TableHead>
                      <TableHead>等级</TableHead>
                      <TableHead className="text-center">对话配额</TableHead>
                      <TableHead className="text-center">图片配额</TableHead>
                      <TableHead className="text-center">文档配额</TableHead>
                      <TableHead className="text-center">今日使用</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredUsers?.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">
                          {user.name || "未设置"}
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              user.userTier === "vip"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-gray-100 text-gray-800"
                            }`}
                          >
                            {user.userTier === "vip" ? "VIP" : "免费"}
                          </span>
                        </TableCell>
                        <TableCell className="text-center">
                          {user.dailyChatQuota}
                        </TableCell>
                        <TableCell className="text-center">
                          {user.dailyImageQuota}
                        </TableCell>
                        <TableCell className="text-center">
                          {user.dailyDocumentQuota}
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="text-sm">
                            <div>对话: {user.todayChatUsed}/{user.dailyChatQuota}</div>
                            <div>图片: {user.todayImageUsed}/{user.dailyImageQuota}</div>
                            <div>文档: {user.todayDocumentUsed}/{user.dailyDocumentQuota}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditClick(user)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 编辑配额对话框 */}
      <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑用户配额</DialogTitle>
            <DialogDescription>
              为 {editingUser?.name || editingUser?.email} 设置每日配额限制
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="chatQuota">每日对话配额</Label>
              <Input
                id="chatQuota"
                type="number"
                min="0"
                value={quotaValues.dailyChatQuota}
                onChange={(e) =>
                  setQuotaValues({
                    ...quotaValues,
                    dailyChatQuota: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="imageQuota">每日图片生成配额</Label>
              <Input
                id="imageQuota"
                type="number"
                min="0"
                value={quotaValues.dailyImageQuota}
                onChange={(e) =>
                  setQuotaValues({
                    ...quotaValues,
                    dailyImageQuota: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="documentQuota">每日文档处理配额</Label>
              <Input
                id="documentQuota"
                type="number"
                min="0"
                value={quotaValues.dailyDocumentQuota}
                onChange={(e) =>
                  setQuotaValues({
                    ...quotaValues,
                    dailyDocumentQuota: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              取消
            </Button>
            <Button
              onClick={handleSaveQuota}
              disabled={updateQuotaMutation.isPending}
            >
              {updateQuotaMutation.isPending ? "保存中..." : "保存"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
