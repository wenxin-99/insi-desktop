import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, BookOpen, TrendingUp, Trash2, Download, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SUBJECTS = [
  { value: "all", label: "全部科目" },
  { value: "math", label: "数学" },
  { value: "chinese", label: "语文" },
  { value: "english", label: "英语" },
  { value: "physics", label: "物理" },
  { value: "chemistry", label: "化学" },
  { value: "other", label: "其他" },
];

const SUBJECT_LABELS: Record<string, string> = {
  math: "数学",
  chinese: "语文",
  english: "英语",
  physics: "物理",
  chemistry: "化学",
  other: "其他",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "待复习",
  done: "已复习",
  mastered: "已掌握",
};

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
  done: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  mastered: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
};

export default function WrongQuestionBook() {
  const { toast } = useToast();
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<"pending" | "done" | "mastered" | undefined>(undefined);
  
  const { data: questions, refetch } = trpc.wrongQuestion.getList.useQuery({
    subject: selectedSubject === "all" ? undefined : selectedSubject as any,
    status: selectedStatus,
    limit: 100,
  });
  
  const { data: stats } = trpc.wrongQuestion.getStats.useQuery();
  const updateStatusMutation = trpc.wrongQuestion.updateStatus.useMutation();
  const deleteMutation = trpc.wrongQuestion.delete.useMutation();
  const exportPDFMutation = trpc.wrongQuestion.exportPDF.useMutation();

  const handleUpdateStatus = async (id: number, status: "pending" | "done" | "mastered", incrementRetry: boolean = false) => {
    try {
      await updateStatusMutation.mutateAsync({ id, status, incrementRetry });
      toast({
        title: "状态已更新",
        description: `错题状态已更新为：${STATUS_LABELS[status]}`,
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "更新失败",
        description: error.message || "更新状态时出现错误",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这道错题吗？")) return;
    
    try {
      await deleteMutation.mutateAsync({ id });
      toast({
        title: "删除成功",
        description: "错题已从错题本中删除",
      });
      refetch();
    } catch (error: any) {
      toast({
        title: "删除失败",
        description: error.message || "删除错题时出现错误",
        variant: "destructive",
      });
    }
  };

  const handleExportPDF = async () => {
    try {
      toast({
        title: "正在生成PDF...",
        description: "请稍候，正在汇总错题并生成PDF文件",
      });
      
      const result = await exportPDFMutation.mutateAsync({
        subject: selectedSubject === "all" ? undefined : selectedSubject as any,
        status: selectedStatus,
      });
      
      // 下载PDF
      window.open(result.url, "_blank");
      
      toast({
        title: "PDF生成成功",
        description: "错题本PDF已生成，正在打开...",
      });
    } catch (error: any) {
      toast({
        title: "生成失败",
        description: error.message || "生成PDF时出现错误",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container max-w-6xl py-8">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => window.history.back()}
        className="mb-4"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        返回
      </Button>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-3xl font-bold">错题本</h1>
          <Button variant="outline" onClick={handleExportPDF}>
            <Download className="mr-2 h-4 w-4" />
            导出PDF
          </Button>
        </div>
        <p className="text-muted-foreground">
          记录和管理错题，针对性复习提升学习效果
        </p>
      </div>

      {/* 统计卡片 */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold">{stats.total}</div>
                <div className="text-sm text-muted-foreground">总错题数</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{stats.pending}</div>
                <div className="text-sm text-muted-foreground">待复习</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{stats.done}</div>
                <div className="text-sm text-muted-foreground">已复习</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{stats.mastered}</div>
                <div className="text-sm text-muted-foreground">已掌握</div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 按科目统计 */}
      {stats && Object.keys(stats.bySubject).length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              科目分布
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              {Object.entries(stats.bySubject).map(([subject, count]) => (
                <div key={subject} className="flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
                  <span className="text-sm font-medium">{SUBJECT_LABELS[subject] || subject}</span>
                  <Badge variant="secondary">{count}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 筛选器 */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger>
                  <SelectValue placeholder="选择科目" />
                </SelectTrigger>
                <SelectContent>
                  {SUBJECTS.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Tabs value={selectedStatus || "all"} onValueChange={(v) => setSelectedStatus(v === "all" ? undefined : v as any)}>
                <TabsList className="grid w-full grid-cols-4">
                  <TabsTrigger value="all">全部</TabsTrigger>
                  <TabsTrigger value="pending">待复习</TabsTrigger>
                  <TabsTrigger value="done">已复习</TabsTrigger>
                  <TabsTrigger value="mastered">已掌握</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 错题列表 */}
      <div className="space-y-4">
        {questions && questions.length > 0 ? (
          questions.map((question) => (
            <Card key={question.id}>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-4">
                  {/* 错题图片 */}
                  {question.questionImageUrl && (
                    <div className="md:w-48 flex-shrink-0">
                      <img
                        src={question.questionImageUrl}
                        alt="题目图片"
                        className="w-full h-auto rounded-lg border"
                      />
                    </div>
                  )}
                  
                  {/* 错题内容 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{SUBJECT_LABELS[question.subject]}</Badge>
                        <Badge className={STATUS_COLORS[question.status]}>
                          {STATUS_LABELS[question.status]}
                        </Badge>
                        {question.knowledgePoint && (
                          <Badge variant="secondary">{question.knowledgePoint}</Badge>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(question.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    <div className="space-y-2 mb-4">
                      <div>
                        <span className="text-sm font-medium">题目：</span>
                        <span className="text-sm">{question.questionContent}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">学生答案：</span>
                        <span className="text-sm text-red-600">{question.studentAnswer}</span>
                      </div>
                      <div>
                        <span className="text-sm font-medium">正确答案：</span>
                        <span className="text-sm text-green-600">{question.correctAnswer}</span>
                      </div>
                      {question.errorAnalysis && (
                        <div className="p-3 bg-muted rounded-lg">
                          <span className="text-sm font-medium">错误分析：</span>
                          <p className="text-sm text-muted-foreground mt-1">
                            {question.errorAnalysis}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {/* 操作按钮 */}
                    <div className="flex flex-wrap gap-2">
                      {question.status !== "done" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(question.id, "done", true)}
                        >
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          标记已复习
                        </Button>
                      )}
                      {question.status !== "mastered" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(question.id, "mastered")}
                        >
                          <BookOpen className="h-4 w-4 mr-1" />
                          标记已掌握
                        </Button>
                      )}
                      {question.status !== "pending" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleUpdateStatus(question.id, "pending")}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          重新复习
                        </Button>
                      )}
                      {question.retryCount > 0 && (
                        <div className="text-xs text-muted-foreground self-center">
                          已复习 {question.retryCount} 次
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <BookOpen className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">暂无错题记录</p>
              <p className="text-sm text-muted-foreground mt-1">
                完成作业批改后，错题会自动收集到这里
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
