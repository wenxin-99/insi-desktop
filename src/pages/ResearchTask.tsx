/**
 * ResearchTask - 研究任务详情页（双栏布局）
 * 
 * 左栏：任务信息 + 研究步骤时间线
 * 右栏：沙箱预览面板（浏览器、代码、终端）
 * 
 * 使用 react-resizable-panels 实现可拖动分屏。
 * 使用 Socket.io 实现实时事件推送。
 */
import { useState, useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import {
  ArrowLeft,
  Brain,
  Search,
  Eye,
  FileText,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Coins,
  Download,
  Copy,
  ExternalLink,
  Lightbulb,
  Wrench,
  BookOpen,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Timer,
  GripVertical,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { toast } from "sonner";
import { SafeMarkdown } from "@/components/SafeMarkdown";
import { useLocation, useRoute } from "wouter";
import { useSandboxSocket } from "@/hooks/useSandboxSocket";
import SandboxPanel from "@/components/SandboxPanel";

// 步骤类型配置
const stepTypeConfig: Record<string, { icon: any; color: string; label: string }> = {
  thought: { icon: Lightbulb, color: "text-yellow-500", label: "思考" },
  action: { icon: Wrench, color: "text-blue-500", label: "行动" },
  observation: { icon: Eye, color: "text-green-500", label: "观察" },
  summary: { icon: BookOpen, color: "text-purple-500", label: "总结" },
};

// 状态配置
const statusConfig: Record<string, { color: string; bgColor: string; icon: any; label: string }> = {
  pending: { color: "text-yellow-600", bgColor: "bg-yellow-50 dark:bg-yellow-900/20", icon: Clock, label: "等待中" },
  processing: { color: "text-blue-600", bgColor: "bg-blue-50 dark:bg-blue-900/20", icon: Loader2, label: "研究中" },
  completed: { color: "text-green-600", bgColor: "bg-green-50 dark:bg-green-900/20", icon: CheckCircle2, label: "已完成" },
  failed: { color: "text-red-600", bgColor: "bg-red-50 dark:bg-red-900/20", icon: XCircle, label: "失败" },
};

export default function ResearchTask() {
  const [, navigate] = useLocation();
  const [, params] = useRoute("/research/:taskId");
  const taskId = params?.taskId ? parseInt(params.taskId) : null;
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());
  const [showReport, setShowReport] = useState(false);
  const [showSandbox, setShowSandbox] = useState(true);
  const stepsEndRef = useRef<HTMLDivElement>(null);

  // Socket.io 实时连接
  const sandbox = useSandboxSocket(taskId);

  // 获取任务详情
  const { data: task, isLoading, refetch } = trpc.research.getTaskDetails.useQuery(
    { taskId: taskId! },
    {
      enabled: !!taskId,
      refetchInterval: (data) => {
        if (data?.state?.data?.status === "pending" || data?.state?.data?.status === "processing") {
          return 3000;
        }
        return false;
      },
    }
  );

  // 取消任务 mutation
  const cancelMutation = trpc.research.cancelTask.useMutation({
    onSuccess: () => {
      toast.success("任务已取消，🐟币已退还");
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || "取消失败");
    },
  });

  // 自动滚动到最新步骤
  useEffect(() => {
    if (task?.status === "processing" && stepsEndRef.current) {
      stepsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [task?.steps?.length]);

  // 计算预估剩余时间
  const getEstimatedTime = () => {
    if (!task || task.progress <= 0 || task.progress >= 100) return null;
    const elapsed = (Date.now() - new Date(task.createdAt).getTime()) / 1000;
    const estimated = (elapsed / task.progress) * (100 - task.progress);
    if (estimated < 60) return `预计还需 ${Math.ceil(estimated)} 秒`;
    if (estimated < 3600) return `预计还需 ${Math.ceil(estimated / 60)} 分钟`;
    return `预计还需 ${Math.ceil(estimated / 3600)} 小时`;
  };

  const toggleStep = (stepId: number) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
      }
      return next;
    });
  };

  const copyReport = () => {
    if (task?.reportContent) {
      navigator.clipboard.writeText(task.reportContent);
    }
  };

  if (!taskId) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">无效的任务 ID</p>
          <Button onClick={() => navigate("/research")} className="mt-4">
            返回任务列表
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <p className="text-muted-foreground">任务不存在</p>
          <Button onClick={() => navigate("/research")} className="mt-4">
            返回任务列表
          </Button>
        </div>
      </div>
    );
  }

  const config = statusConfig[task.status] || statusConfig.pending;
  const StatusIcon = config.icon;

  // ============ 左栏内容 ============
  const LeftPanel = () => (
    <div className="h-full overflow-y-auto">
      <div className="p-4 md:p-5 space-y-5">
        {/* 顶部导航 */}
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/research")}
          >
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold truncate">研究任务 #{task.id}</h1>
            <p className="text-xs text-muted-foreground">
              {new Date(task.createdAt).toLocaleString("zh-CN")}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* 沙箱面板切换按钮 */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSandbox(!showSandbox)}
              title={showSandbox ? "隐藏沙箱面板" : "显示沙箱面板"}
            >
              {showSandbox ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </Button>
            {(task.status === "pending" || task.status === "processing") && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => cancelMutation.mutate({ taskId: task.id })}
                disabled={cancelMutation.isPending}
                className="text-red-500 hover:text-red-600"
              >
                {cancelMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  "取消"
                )}
              </Button>
            )}
          </div>
        </div>

        {/* 状态卡片 */}
        <Card className={`p-4 ${config.bgColor}`}>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <StatusIcon
                  className={`w-5 h-5 ${config.color} ${
                    task.status === "processing" ? "animate-spin" : ""
                  }`}
                />
                <span className={`font-medium ${config.color}`}>
                  {config.label}
                </span>
              </div>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                {task.cost && parseFloat(task.cost) > 0 && (
                  <span className="flex items-center gap-1">
                    <Coins className="w-3.5 h-3.5" />
                    {task.cost} 🐟币
                  </span>
                )}
                {getEstimatedTime() && (
                  <span className="flex items-center gap-1">
                    <Timer className="w-3.5 h-3.5" />
                    {getEstimatedTime()}
                  </span>
                )}
              </div>
            </div>

            {(task.status === "processing" || task.status === "pending") && (
              <div className="space-y-1.5">
                <Progress value={task.progress} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{task.currentStep || "等待处理..."}</span>
                  <span>{task.progress}%</span>
                </div>
              </div>
            )}

            {task.status === "completed" && (
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <Brain className="w-4 h-4 text-purple-500" />
                  {task.totalSteps} 个步骤
                </span>
                <span className="flex items-center gap-1.5">
                  <Search className="w-4 h-4 text-blue-500" />
                  {task.totalSearches} 次搜索
                </span>
              </div>
            )}

            {task.status === "failed" && task.errorMessage && (
              <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{task.errorMessage}</span>
              </div>
            )}
          </div>
        </Card>

        {/* 研究指令 */}
        <Card className="p-4">
          <h3 className="text-sm font-medium text-muted-foreground mb-2">研究指令</h3>
          <p className="text-sm leading-relaxed">{task.prompt}</p>
        </Card>

        {/* 研究报告 */}
        {task.status === "completed" && task.reportContent && (
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                研究报告
              </h3>
              <div className="flex items-center gap-1.5">
                <Button variant="outline" size="sm" onClick={copyReport} className="gap-1 h-7 text-xs">
                  <Copy className="w-3 h-3" />
                  复制
                </Button>
                {task.reportUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(task.reportUrl!, "_blank")}
                    className="gap-1 h-7 text-xs"
                  >
                    <ExternalLink className="w-3 h-3" />
                    打开
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReport(!showReport)}
                  className="gap-1 h-7 text-xs"
                >
                  {showReport ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  {showReport ? "收起" : "展开"}
                </Button>
              </div>
            </div>
            {showReport ? (
              <div className="prose prose-sm dark:prose-invert max-w-none border-t pt-3">
                <SafeMarkdown>{(task.reportContent || '').replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\t/g, '\t')}</SafeMarkdown>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground line-clamp-3 border-t pt-3">
                {(task.reportContent || '').replace(/\\\\n/g, '\n').replace(/\\n/g, '\n').substring(0, 300)}...
              </p>
            )}
          </Card>
        )}

        {/* 研究步骤时间线 */}
        {task.steps && task.steps.length > 0 && (
          <Card className="p-4">
            <h3 className="text-base font-semibold flex items-center gap-2 mb-4">
              <Brain className="w-4 h-4 text-purple-500" />
              研究过程 ({task.steps.length} 步)
            </h3>
            <div className="space-y-0">
              {task.steps.map((step, index) => {
                const typeConfig = stepTypeConfig[step.type] || stepTypeConfig.thought;
                const StepIcon = typeConfig.icon;
                const isExpanded = expandedSteps.has(step.id);
                const isLast = index === task.steps!.length - 1;

                return (
                  <div key={step.id} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div
                        className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${
                          step.type === "thought"
                            ? "bg-yellow-100 dark:bg-yellow-900/30"
                            : step.type === "action"
                            ? "bg-blue-100 dark:bg-blue-900/30"
                            : step.type === "observation"
                            ? "bg-green-100 dark:bg-green-900/30"
                            : "bg-purple-100 dark:bg-purple-900/30"
                        }`}
                      >
                        <StepIcon className={`w-3.5 h-3.5 ${typeConfig.color}`} />
                      </div>
                      {!isLast && (
                        <div className="w-0.5 flex-1 bg-border min-h-[12px]" />
                      )}
                    </div>

                    <div
                      className="flex-1 pb-3 cursor-pointer"
                      onClick={() => toggleStep(step.id)}
                    >
                      <div className="flex items-center gap-2 hover:opacity-80">
                        <Badge variant="outline" className="text-xs h-5">
                          {typeConfig.label}
                        </Badge>
                        {step.toolName && (
                          <Badge variant="secondary" className="text-xs h-5">
                            {step.toolName}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground ml-auto">
                          #{step.stepNumber}
                        </span>
                      </div>
                      <div className="text-sm mt-1.5 text-foreground/80">
                        {isExpanded ? (
                          <div className={
                            (step.type === "observation" || step.type === "summary")
                              ? "prose prose-sm dark:prose-invert max-w-none"
                              : ""
                          }>
                            {(step.type === "observation" || step.type === "summary") ? (
                              <SafeMarkdown>{step.content}</SafeMarkdown>
                            ) : (
                              <p className="whitespace-pre-wrap">{step.content}</p>
                            )}
                          </div>
                        ) : (
                          <p className="line-clamp-2 text-sm">{step.content}</p>
                        )}
                      </div>
                      {step.content.length > 100 && (
                        <button className="text-xs text-primary mt-1 hover:underline">
                          {isExpanded ? "收起" : "展开全部"}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
              <div ref={stepsEndRef} />
            </div>

            {task.status === "processing" && (
              <div className="flex items-center gap-3 mt-2 pl-10">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
                <span className="text-sm text-muted-foreground">正在思考中...</span>
              </div>
            )}
          </Card>
        )}
      </div>
    </div>
  );

  // ============ 渲染 ============

  // 如果不显示沙箱面板，使用单栏布局
  if (!showSandbox) {
    return (
      <div className="h-[calc(100vh-64px)]">
        <LeftPanel />
      </div>
    );
  }

  // 双栏布局
  return (
    <div className="h-[calc(100vh-64px)]">
      <PanelGroup direction="horizontal" autoSaveId="research-sandbox-layout">
        {/* 左栏：任务信息和步骤 */}
        <Panel defaultSize={45} minSize={30} maxSize={70}>
          <LeftPanel />
        </Panel>

        {/* 拖动手柄 */}
        <PanelResizeHandle className="w-1.5 bg-border hover:bg-primary/20 transition-colors relative group">
          <div className="absolute inset-y-0 -left-1 -right-1 group-hover:bg-primary/10" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <GripVertical className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </PanelResizeHandle>

        {/* 右栏：沙箱预览面板 */}
        <Panel defaultSize={55} minSize={30}>
          <SandboxPanel
            browser={sandbox.browser}
            code={sandbox.code}
            terminal={sandbox.terminal}
            activeTab={sandbox.activeTab}
            onTabChange={sandbox.setActiveTab}
            isConnected={sandbox.isConnected}
            taskId={taskId}
            socket={sandbox.socket}
          />
        </Panel>
      </PanelGroup>
    </div>
  );
}
