import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  FileText,
  Brain,
  ArrowRight,
  Coins,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Globe,
  Cpu,
  Building2,
  GraduationCap,
  Briefcase,
  Heart,
  Scale,
  Leaf,
  Rocket,
  BarChart3,
  Microscope,
  BookOpen,
  Lightbulb,
  Users,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";

import { RESEARCH_TEMPLATES, ResearchTemplate } from "./research/templates";

export default function Research() {
  const [, navigate] = useLocation();
  const [prompt, setPrompt] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [activeResearchCat, setActiveResearchCat] = useState("trending");

  // 获取任务列表
  const { data: taskData, isLoading, refetch } = trpc.research.listTasks.useQuery(
    { page: 1, pageSize: 20 },
    { refetchInterval: 5000 } // 每5秒自动刷新
  );

  // 获取费用信息
  const { data: costInfo } = trpc.research.getTaskCost.useQuery();

  // 创建任务 mutation
  const createTaskMutation = trpc.research.createTask.useMutation({
    onSuccess: (data) => {
      toast.success(`研究任务已创建！消耗 ${data.cost} 🐟币`);
      setPrompt("");
      setShowCreateForm(false);
      setIsSubmitting(false);
      refetch();
      // 导航到任务详情页
      navigate(`/research/${data.taskId}`);
    },
    onError: (error) => {
      toast.error(error.message || "创建任务失败");
      setIsSubmitting(false);
    },
  });

  // 自动停止刷新（当没有活跃任务时）
  const hasActiveTasks = taskData?.tasks?.some(
    (t) => t.status === "pending" || t.status === "processing"
  );

  const handleSubmit = () => {
    if (!prompt.trim()) {
      toast.error("请输入研究指令");
      return;
    }
    if (prompt.trim().length < 5) {
      toast.error("研究指令至少需要5个字符");
      return;
    }
    setIsSubmitting(true);
    createTaskMutation.mutate({ prompt: prompt.trim() });
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return "刚刚";
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 7) return `${days}天前`;
    return date.toLocaleDateString("zh-CN");
  };

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white">
            <Brain className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">自主研究代理</h1>
            <p className="text-sm text-muted-foreground">
              Insi 自动搜索、分析、整合信息，生成综合研究报告
            </p>
          </div>
        </div>
        <Button
          onClick={() => setShowCreateForm(!showCreateForm)}
          className="gap-2"
          variant={showCreateForm ? "outline" : "default"}
        >
          {showCreateForm ? (
            "取消"
          ) : (
            <>
              <Plus className="w-4 h-4" />
              新建研究
            </>
          )}
        </Button>
      </div>

      {/* 创建任务表单 */}
      {showCreateForm && (
        <Card className="p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              <span>输入您想研究的课题，Insi 将自动进行多步在线搜索并生成报告</span>
            </div>
            <Textarea
              placeholder="例如：分析2025年人工智能行业的最新发展趋势，包括大语言模型、AI Agent、多模态等方向的技术突破和商业应用..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="min-h-[120px] resize-none text-base"
              maxLength={2000}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Coins className="w-4 h-4" />
                <span>
                  每次研究消耗 <strong className="text-primary">{costInfo?.cost || 10} 🐟币</strong>
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {prompt.length}/2000
                </span>
                <Button
                  onClick={handleSubmit}
                  disabled={isSubmitting || !prompt.trim()}
                  className="gap-2 min-w-[120px]"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      提交中...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      开始研究
                    </>
                  )}
                </Button>
              </div>
            </div>

            {/* 研究模板推荐 */}
            <div className="space-y-3 pt-2 border-t border-border/50">
              <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                <Lightbulb className="w-4 h-4 text-amber-500" />
                <span>快速选择研究课题</span>
              </div>

              {/* 分类标签 */}
              <div className="flex gap-2 flex-wrap">
                {researchCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={activeResearchCat === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveResearchCat(cat.id)}
                    className={`rounded-full text-xs whitespace-nowrap transition-all duration-200 ${
                      activeResearchCat === cat.id ? "shadow-md scale-105" : "hover:scale-105"
                    }`}
                  >
                    <span className="mr-1">{cat.emoji}</span>
                    {cat.label}
                  </Button>
                ))}
              </div>

              {/* 模板卡片 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {researchCategories
                  .find((c) => c.id === activeResearchCat)
                  ?.templates.map((tpl, idx) => {
                    const Icon = tpl.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg border border-border/50 hover:border-primary/30 hover:shadow-sm cursor-pointer group transition-all duration-200"
                        onClick={() => setPrompt(tpl.prompt)}
                      >
                        <div className={`${tpl.bgColor} p-2 rounded-lg shrink-0 group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-4 h-4 ${tpl.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground group-hover:text-primary transition-colors truncate">
                            {tpl.title}
                          </p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {tpl.prompt.slice(0, 60)}...
                          </p>
                        </div>
                        <ArrowRight className="w-3.5 h-3.5 text-muted-foreground/0 group-hover:text-primary transition-all shrink-0 mt-1" />
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* 任务列表 */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
        </div>
      ) : taskData?.tasks && taskData.tasks.length > 0 ? (
        <div className="space-y-3">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <FileText className="w-5 h-5" />
            研究任务 ({taskData.total})
          </h2>
          {taskData.tasks.map((task) => {
            const config = statusConfig[task.status] || statusConfig.pending;
            const StatusIcon = config.icon;
            return (
              <Card
                key={task.id}
                className="p-4 hover:shadow-md transition-all cursor-pointer group"
                onClick={() => navigate(`/research/${task.id}`)}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0 space-y-2">
                    {/* 标题和状态 */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className={`${config.color} gap-1 text-xs`}>
                        <StatusIcon
                          className={`w-3 h-3 ${
                            task.status === "processing" ? "animate-spin" : ""
                          }`}
                        />
                        {config.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatTime(task.createdAt)}
                      </span>
                      {task.cost && parseFloat(task.cost) > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Coins className="w-3 h-3" />
                          {task.cost} 🐟币
                        </span>
                      )}
                    </div>

                    {/* 研究指令 */}
                    <p className="text-sm line-clamp-2 text-foreground/80">
                      {task.prompt}
                    </p>

                    {/* 进度条（处理中时显示） */}
                    {task.status === "processing" && (
                      <div className="space-y-1">
                        <Progress value={task.progress} className="h-1.5" />
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{task.currentStep || "处理中..."}</span>
                          <span>{task.progress}%</span>
                        </div>
                      </div>
                    )}

                    {/* 统计信息（完成时显示） */}
                    {task.status === "completed" && (
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Brain className="w-3 h-3" />
                          {task.totalSteps} 步
                        </span>
                        <span className="flex items-center gap-1">
                          <Search className="w-3 h-3" />
                          {task.totalSearches} 次搜索
                        </span>
                      </div>
                    )}

                    {/* 错误信息（失败时显示） */}
                    {task.status === "failed" && task.errorMessage && (
                      <p className="text-xs text-red-500 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 flex-shrink-0" />
                        <span className="line-clamp-1">{task.errorMessage}</span>
                      </p>
                    )}
                  </div>

                  {/* 右箭头 */}
                  <ArrowRight className="w-5 h-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1" />
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        /* 空状态 */
        <Card className="p-8 md:p-12 text-center">
          <div className="space-y-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
              <Brain className="w-8 h-8 text-muted-foreground" />
            </div>
            <div>
              <h3 className="text-lg font-medium">还没有研究任务</h3>
              <p className="text-sm text-muted-foreground mt-1">
                选择一个感兴趣的课题，或自定义你的研究指令
              </p>
            </div>

            {/* 空状态下的推荐模板 */}
            <div className="max-w-2xl mx-auto space-y-3 text-left">
              <div className="flex gap-2 flex-wrap justify-center">
                {researchCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={activeResearchCat === cat.id ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActiveResearchCat(cat.id)}
                    className="rounded-full text-xs"
                  >
                    <span className="mr-1">{cat.emoji}</span>
                    {cat.label}
                  </Button>
                ))}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {researchCategories
                  .find((c) => c.id === activeResearchCat)
                  ?.templates.slice(0, 4).map((tpl, idx) => {
                    const Icon = tpl.icon;
                    return (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 p-3 rounded-lg border border-border/50 hover:border-primary/30 hover:shadow-sm cursor-pointer group transition-all"
                        onClick={() => {
                          setPrompt(tpl.prompt);
                          setShowCreateForm(true);
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                      >
                        <div className={`${tpl.bgColor} p-2 rounded-lg shrink-0 group-hover:scale-110 transition-transform`}>
                          <Icon className={`w-4 h-4 ${tpl.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium group-hover:text-primary transition-colors">{tpl.title}</p>
                          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{tpl.prompt.slice(0, 50)}...</p>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            <Button
              onClick={() => setShowCreateForm(true)}
              className="gap-2"
            >
              <Plus className="w-4 h-4" />
              自定义研究课题
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
