import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus, Copy, Check , ArrowLeft } from "lucide-react";
import DashboardLayout from "@/components/DashboardLayout";

export default function AdminInvitations() {
  const { data: invitations, isLoading, refetch } = trpc.invitation.getAll.useQuery();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [expiresInHours, setExpiresInHours] = useState("24");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const generateMutation = trpc.invitation.generate.useMutation({
    onSuccess: (data) => {
      toast.success("邀请码生成成功");
      setDialogOpen(false);
      setExpiresInHours("24");
      refetch();
      // 自动复制到剪贴板
      navigator.clipboard.writeText(data.code);
      setCopiedCode(data.code);
      setTimeout(() => setCopiedCode(null), 2000);
    },
    onError: (error) => {
      toast.error(error.message || "邀请码生成失败");
    },
  });

  const handleGenerate = () => {
    const hours = parseInt(expiresInHours);
    if (isNaN(hours) || hours <= 0) {
      toast.error("请输入有效的有效期");
      return;
    }

    generateMutation.mutate({ expiresInHours: hours });
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    toast.success("邀请码已复制到剪贴板");
    setTimeout(() => setCopiedCode(null), 2000);
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">邀请码管理</h1>
            <p className="text-muted-foreground mt-2">生成和管理用户注册邀请码</p>
          </div>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              生成邀请码
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>生成新邀请码</DialogTitle>
              <DialogDescription>设置邀请码的有效期</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="expiresInHours">有效期 (小时) *</Label>
                <Input
                  id="expiresInHours"
                  type="number"
                  placeholder="24"
                  value={expiresInHours}
                  onChange={(e) => setExpiresInHours(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  建议设置较短的有效期，例如24小时
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                取消
              </Button>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                {generateMutation.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                生成
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>邀请码列表</CardTitle>
          <CardDescription>共 {invitations?.length || 0} 个邀请码</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>邀请码</TableHead>
                <TableHead>状态</TableHead>
                <TableHead>创建时间</TableHead>
                <TableHead>过期时间</TableHead>
                <TableHead>使用者</TableHead>
                <TableHead>使用时间</TableHead>
                <TableHead>操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations?.map((invitation) => {
                const isExpired = new Date() > new Date(invitation.expiresAt);
                return (
                  <TableRow key={invitation.id}>
                    <TableCell className="font-mono text-sm">{invitation.code}</TableCell>
                    <TableCell>
                      {invitation.used ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                          已使用
                        </span>
                      ) : isExpired ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
                          已过期
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          有效
                        </span>
                      )}
                    </TableCell>
                    <TableCell>{new Date(invitation.createdAt).toLocaleString("zh-CN")}</TableCell>
                    <TableCell>{new Date(invitation.expiresAt).toLocaleString("zh-CN")}</TableCell>
                    <TableCell>{invitation.usedBy || "-"}</TableCell>
                    <TableCell>
                      {invitation.usedAt ? new Date(invitation.usedAt).toLocaleString("zh-CN") : "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(invitation.code)}
                        disabled={invitation.used || isExpired}
                      >
                        {copiedCode === invitation.code ? (
                          <Check className="h-4 w-4 text-green-500" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      </div>
    </DashboardLayout>
  );
}
