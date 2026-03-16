import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Download, FileSpreadsheet, FileText, Users, Receipt, MessageSquare , ArrowLeft } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import { Input } from "@/components/ui/input";

export default function AdminExport() {
  const [userFormat, setUserFormat] = useState<"excel" | "csv">("excel");
  const [transactionFormat, setTransactionFormat] = useState<"excel" | "csv">("excel");
  const [feedbackFormat, setFeedbackFormat] = useState<"excel" | "csv">("excel");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [feedbackStatus, setFeedbackStatus] = useState<"pending" | "in_progress" | "resolved" | "closed" | undefined>(
    undefined
  );

  const exportUsers = trpc.export.users.useMutation({
    onSuccess: (data) => {
      downloadFile(data.data, data.filename);
      toast.success("用户列表导出成功！");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const exportTransactions = trpc.export.transactions.useMutation({
    onSuccess: (data) => {
      downloadFile(data.data, data.filename);
      toast.success("交易记录导出成功！");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const exportFeedbacks = trpc.export.feedbacks.useMutation({
    onSuccess: (data) => {
      downloadFile(data.data, data.filename);
      toast.success("反馈数据导出成功！");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const downloadFile = (base64Data: string, filename: string) => {
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], {
      type: filename.endsWith(".xlsx")
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "text/csv",
    });

    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-8 space-y-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">数据导出</h1>
            <p className="text-muted-foreground mt-2">导出系统数据用于分析和备份</p>
          </div>
        </div>

        {/* 导出用户列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              导出用户列表
            </CardTitle>
            <CardDescription>导出所有用户的基本信息和🐟币余额</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="user-format">导出格式</Label>
                <Select value={userFormat} onValueChange={(v: any) => setUserFormat(v)}>
                  <SelectTrigger id="user-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel (.xlsx)
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        CSV (.csv)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() => exportUsers.mutate({ format: userFormat })}
                disabled={exportUsers.isPending}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {exportUsers.isPending ? "导出中..." : "导出"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 导出交易记录 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              导出交易记录
            </CardTitle>
            <CardDescription>导出🐟币交易记录，可按日期范围筛选</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start-date">开始日期</Label>
                <Input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end-date">结束日期</Label>
                <Input id="end-date" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="transaction-format">导出格式</Label>
                <Select value={transactionFormat} onValueChange={(v: any) => setTransactionFormat(v)}>
                  <SelectTrigger id="transaction-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel (.xlsx)
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        CSV (.csv)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() =>
                  exportTransactions.mutate({
                    format: transactionFormat,
                    startDate: startDate || undefined,
                    endDate: endDate || undefined,
                  })
                }
                disabled={exportTransactions.isPending}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {exportTransactions.isPending ? "导出中..." : "导出"}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* 导出反馈数据 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5" />
              导出反馈数据
            </CardTitle>
            <CardDescription>导出用户反馈记录，可按状态筛选</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-end gap-4">
              <div className="flex-1 space-y-2">
                <Label htmlFor="feedback-status">反馈状态</Label>
                <Select
                  value={feedbackStatus || "all"}
                  onValueChange={(v) => setFeedbackStatus(v === "all" ? undefined : (v as any))}
                >
                  <SelectTrigger id="feedback-status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">全部状态</SelectItem>
                    <SelectItem value="pending">待处理</SelectItem>
                    <SelectItem value="in_progress">处理中</SelectItem>
                    <SelectItem value="resolved">已解决</SelectItem>
                    <SelectItem value="closed">已关闭</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label htmlFor="feedback-format">导出格式</Label>
                <Select value={feedbackFormat} onValueChange={(v: any) => setFeedbackFormat(v)}>
                  <SelectTrigger id="feedback-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet className="h-4 w-4" />
                        Excel (.xlsx)
                      </div>
                    </SelectItem>
                    <SelectItem value="csv">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        CSV (.csv)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={() =>
                  exportFeedbacks.mutate({
                    format: feedbackFormat,
                    status: feedbackStatus,
                  })
                }
                disabled={exportFeedbacks.isPending}
                className="gap-2"
              >
                <Download className="h-4 w-4" />
                {exportFeedbacks.isPending ? "导出中..." : "导出"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-base">导出说明</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>• Excel格式适合在Microsoft Excel或WPS表格中打开和编辑</p>
            <p>• CSV格式是纯文本格式，可以在任何文本编辑器中打开，也可以导入到数据库</p>
            <p>• 导出的文件包含完整的数据记录，请妥善保管避免泄露用户隐私</p>
            <p>• 建议定期导出数据进行备份，以防数据丢失</p>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
