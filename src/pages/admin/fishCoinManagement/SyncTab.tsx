/**
 * SyncTab — 论坛积分同步状态标签页
 * 从 FishCoinManagement.tsx 拆分
 */
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

interface SyncTabProps {
  syncStatus: any;
  syncStatusLoading: boolean;
  triggerSync: () => void;
  triggerSyncPending: boolean;
}

export function SyncTab({ syncStatus, syncStatusLoading, triggerSync, triggerSyncPending }: SyncTabProps) {
  return (
    <Card className="p-6 bg-white/80 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold">论坛积分同步状态</h3>
        <Button onClick={triggerSync} disabled={triggerSyncPending}>
          <RefreshCw className={`h-4 w-4 mr-2 ${triggerSyncPending ? "animate-spin" : ""}`} />手动同步
        </Button>
      </div>

      {syncStatusLoading ? (
        <div className="text-center py-8 text-gray-500">加载中...</div>
      ) : syncStatus ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="p-4 bg-blue-50">
              <div className="text-sm text-gray-600 mb-1">最后同步时间</div>
              <div className="text-lg font-semibold">
                {syncStatus.lastSyncTime ? new Date(syncStatus.lastSyncTime).toLocaleString("zh-CN") : "从未同步"}
              </div>
            </Card>
            <Card className="p-4 bg-green-50">
              <div className="text-sm text-gray-600 mb-1">成功同步</div>
              <div className="text-lg font-semibold text-green-600">{syncStatus.successCount} 笔</div>
            </Card>
            <Card className="p-4 bg-red-50">
              <div className="text-sm text-gray-600 mb-1">同步失败</div>
              <div className="text-lg font-semibold text-red-600">{syncStatus.failedCount} 笔</div>
            </Card>
          </div>
          {syncStatus.failedTransactions && syncStatus.failedTransactions.length > 0 && (
            <div className="mt-6">
              <h4 className="text-md font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />失败的同步记录
              </h4>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>用户ID</TableHead><TableHead>OpenID</TableHead>
                      <TableHead>金额</TableHead><TableHead>错误信息</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {syncStatus.failedTransactions.map((failed: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{failed.userId}</TableCell>
                        <TableCell className="font-mono text-sm">{failed.openId}</TableCell>
                        <TableCell className="font-semibold">{failed.amount} 🐟</TableCell>
                        <TableCell className="text-red-600">{failed.error}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
          {(!syncStatus.failedTransactions || syncStatus.failedTransactions.length === 0) && (
            <div className="text-center py-8 text-green-600 flex items-center justify-center gap-2">
              <CheckCircle2 className="h-5 w-5" />所有交易已成功同步
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500">暂无同步状态数据</div>
      )}
    </Card>
  );
}
