import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { trpc } from "@/lib/trpc";
import { Loader2, Sparkles, Clock, Coins, TrendingUp, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import DashboardLayout from "@/components/DashboardLayout";
import { useAuth } from "@/_core/hooks/useAuth";
import { useEffect } from "react";
import { useLocation } from "wouter";

export default function ModelComparison() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  // 管理员权限检查
  useEffect(() => {
    if (user && user.role !== "admin") {
      toast.error("此页面仅限管理员访问");
      setLocation("/");
    }
  }, [user, setLocation]);

  // 如果不是管理员，不渲染页面
  if (!user || user.role !== "admin") {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </DashboardLayout>
    );
  }
  const [prompt, setPrompt] = useState("");
  const [selectedModels, setSelectedModels] = useState<number[]>([]);
  const [comparisonResult, setComparisonResult] = useState<any>(null);

  const { data: models } = trpc.aiModel.getAll.useQuery();
  const { data: balance, refetch: refetchBalance } = trpc.fishCoin.getBalance.useQuery();
  const { data: history } = trpc.conversation.getComparisonHistory.useQuery({ limit: 10 });

  const chatModels = models?.filter((m) => m.type === "chat" && m.enabled) || [];

  const compareModelsMutation = trpc.conversation.compareModels.useMutation({
    onSuccess: (data: any) => {
      setComparisonResult(data);
      refetchBalance();
      toast.success(`对比完成！消耗 ${data.totalCost.toFixed(2)} 🐟币`);
    },
    onError: (error: any) => {
      toast.error(error.message || "对比失败");
    },
  });

  const handleToggleModel = (modelId: number) => {
    if (selectedModels.includes(modelId)) {
      setSelectedModels(selectedModels.filter((id) => id !== modelId));
    } else {
      if (selectedModels.length >= 4) {
        toast.error("最多选择4个模型进行对比");
        return;
      }
      setSelectedModels([...selectedModels, modelId]);
    }
  };

  const handleCompare = () => {
    if (!prompt.trim()) {
      toast.error("请输入问题");
      return;
    }

    if (selectedModels.length < 2) {
      toast.error("请至少选择2个模型进行对比");
      return;
    }

    compareModelsMutation.mutate({
      prompt: prompt.trim(),
      modelIds: selectedModels,
    });
  };

  const handleLoadHistory = (item: any) => {
    setPrompt(item.prompt);
    setComparisonResult(item);
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* 页面标题 */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            模型对比工具
          </h1>
          <p className="text-muted-foreground mt-2">
            同时测试多个AI模型，对比响应质量、速度和成本
          </p>
        </div>

        {/* 余额显示 */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Coins className="h-5 w-5 text-amber-500" />
                <span className="font-medium">当前余额</span>
              </div>
              <span className="text-2xl font-bold text-primary">
                {(balance as any)?.balance ? parseFloat((balance as any).balance).toFixed(2) : '0.00'} 🐟币
              </span>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* 左侧：输入和模型选择 */}
          <div className="space-y-6">
            {/* 输入问题 */}
            <Card>
              <CardHeader>
                <CardTitle>输入问题</CardTitle>
                <CardDescription>输入你想测试的问题或提示词</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="例如：请解释什么是量子计算..."
                  className="min-h-[120px]"
                />
                <Button
                  onClick={handleCompare}
                  disabled={compareModelsMutation.isPending || selectedModels.length < 2}
                  className="w-full"
                  size="lg"
                >
                  {compareModelsMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      对比中...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      开始对比 ({selectedModels.length} 个模型)
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* 模型选择 */}
            <Card>
              <CardHeader>
                <CardTitle>选择模型 (2-4个)</CardTitle>
                <CardDescription>选择你想对比的AI模型</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {chatModels.map((model) => (
                    <div
                      key={model.id}
                      className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                        selectedModels.includes(model.id)
                          ? "bg-primary/10 border-primary"
                          : "hover:bg-muted"
                      }`}
                      onClick={() => handleToggleModel(model.id)}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={selectedModels.includes(model.id)}
                          onCheckedChange={() => handleToggleModel(model.id)}
                        />
                        <div>
                          <p className="font-medium">{model.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {model.costPerUse} 🐟币/次
                          </p>
                        </div>
                      </div>
                      {selectedModels.includes(model.id) && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 历史记录 */}
            {history && history.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>对比历史</CardTitle>
                  <CardDescription>最近的对比记录</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {history.map((item: any, index: number) => (
                      <div
                        key={index}
                        className="p-3 rounded-lg border hover:bg-muted cursor-pointer transition-colors"
                        onClick={() => handleLoadHistory(item)}
                      >
                        <p className="text-sm font-medium line-clamp-2">
                          {item.prompt}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{item.modelCount} 个模型</span>
                          <span>·</span>
                          <span>{item.totalCost.toFixed(2)} 🐟币</span>
                          <span>·</span>
                          <span>{new Date(item.createdAt).toLocaleDateString()}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* 右侧：对比结果 */}
          <div className="space-y-6">
            {comparisonResult ? (
              <>
                {/* 总览卡片 */}
                <Card>
                  <CardHeader>
                    <CardTitle>对比结果总览</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="text-center p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground mb-1">总耗时</p>
                        <p className="text-2xl font-bold">
                          {(comparisonResult.totalTime / 1000).toFixed(2)}s
                        </p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted">
                        <p className="text-sm text-muted-foreground mb-1">总成本</p>
                        <p className="text-2xl font-bold text-amber-500">
                          {comparisonResult.totalCost.toFixed(2)} 🐟币
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* 各模型结果 */}
                {Object.entries(comparisonResult.results).map(([modelId, result]: [string, any]) => (
                  <Card key={modelId}>
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        <span>{result.modelName}</span>
                        <div className="flex items-center gap-4 text-sm font-normal">
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-4 w-4" />
                            {(result.responseTime / 1000).toFixed(2)}s
                          </span>
                          <span className="flex items-center gap-1 text-amber-500">
                            <Coins className="h-4 w-4" />
                            {result.cost.toFixed(2)} 🐟币
                          </span>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-sm max-w-none dark:prose-invert">
                        <SafeMarkdown>{result.response}</SafeMarkdown>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </>
            ) : (
              <Card>
                <CardContent className="pt-12 pb-12 text-center">
                  <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    选择模型并输入问题，开始对比测试
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
