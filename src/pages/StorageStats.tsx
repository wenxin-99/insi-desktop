import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { HardDrive, Image, FileText, File, TrendingUp } from "lucide-react";

export default function StorageStats() {
  const { data: totalStats, isLoading: loadingTotal } = trpc.storage.getTotal.useQuery();
  const { data: historyStats, isLoading: loadingHistory } = trpc.storage.getHistory.useQuery({ days: 30 });
  const { data: todayStats, isLoading: loadingToday } = trpc.storage.getToday.useQuery();

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  };

  const calculateCost = (bytes: number) => {
    // 假设S3存储成本：$0.023/GB/月
    const gbPerMonth = bytes / (1024 * 1024 * 1024);
    const costPerMonth = gbPerMonth * 0.023;
    return `$${costPerMonth.toFixed(4)}/月`;
  };

  if (loadingTotal || loadingHistory || loadingToday) {
    return (
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">S3存储统计</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  const total = totalStats || { totalFiles: 0, imageFiles: 0, documentFiles: 0, otherFiles: 0, totalSize: 0, imageSize: 0, documentSize: 0, otherSize: 0 };
  const today = todayStats || { newFiles: 0, newSize: 0 };

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-3xl font-bold mb-6">S3存储统计</h1>

      {/* 总览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总存储空间</CardTitle>
            <HardDrive className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatBytes(Number(total.totalSize))}</div>
            <p className="text-xs text-muted-foreground mt-1">
              预估成本: {calculateCost(Number(total.totalSize))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">图片文件</CardTitle>
            <Image className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.imageFiles}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(Number(total.imageSize))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">文档文件</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.documentFiles}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(Number(total.documentSize))}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">其他文件</CardTitle>
            <File className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{total.otherFiles}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatBytes(Number(total.otherSize))}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 今日新增 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            今日新增
          </CardTitle>
          <CardDescription>今天上传的文件统计</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">新增文件数</p>
              <p className="text-2xl font-bold">{today.newFiles}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">新增存储</p>
              <p className="text-2xl font-bold">{formatBytes(Number(today.newSize))}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 历史趋势 */}
      <Card>
        <CardHeader>
          <CardTitle>存储趋势（最近30天）</CardTitle>
          <CardDescription>每日存储空间变化</CardDescription>
        </CardHeader>
        <CardContent>
          {historyStats && historyStats.length > 0 ? (
            <div className="space-y-2">
              {historyStats.slice(0, 10).map((stat) => (
                <div key={stat.id} className="flex items-center justify-between border-b pb-2">
                  <span className="text-sm text-muted-foreground">
                    {new Date(stat.statDate).toLocaleDateString('zh-CN')}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-sm">
                      +{stat.newFiles} 文件
                    </span>
                    <span className="text-sm font-medium">
                      {formatBytes(Number(stat.totalSize))}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">暂无历史数据</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
