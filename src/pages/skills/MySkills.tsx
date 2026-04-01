/**
 * 我的已安装技能管理页面
 *
 * src/pages/skills/MySkills.tsx
 */
import { useState } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles, Plus, Play, Pause, Trash2, Settings, Loader2,
  Clock, ChevronRight, ArrowLeft, History, Zap, RotateCcw,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";

export default function MySkills() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [runningId, setRunningId] = useState<number | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);

  const installedQuery = trpc.skill.installed.useQuery();
  const logsQuery = trpc.skill.logs.useQuery({ limit: 20 });
  const toggleMutation = trpc.skill.toggle.useMutation();
  const uninstallMutation = trpc.skill.uninstall.useMutation();
  const runMutation = trpc.skill.run.useMutation();

  const installed = installedQuery.data || [];
  const logs = logsQuery.data || [];

  const handleToggle = async (userSkillId: number, isActive: boolean) => {
    try {
      await toggleMutation.mutateAsync({ userSkillId, isActive: !isActive });
      installedQuery.refetch();
      toast({ title: isActive ? "已暂停" : "已启用" });
    } catch (e: any) {
      toast({ title: "操作失败", description: e.message, variant: "destructive" });
    }
  };

  const handleUninstall = async (skillId: number, skillName: string) => {
    if (!confirm(`确定要卸载「${skillName}」技能吗？关联的定时任务也会被删除。`)) return;
    try {
      await uninstallMutation.mutateAsync({ skillId });
      installedQuery.refetch();
      toast({ title: "已卸载" });
    } catch (e: any) {
      toast({ title: "卸载失败", description: e.message, variant: "destructive" });
    }
  };

  const handleRun = async (userSkillId: number) => {
    setRunningId(userSkillId);
    try {
      const result = await runMutation.mutateAsync({ userSkillId });
      logsQuery.refetch();
      installedQuery.refetch();
      if (result.success) {
        toast({ title: "执行成功", description: result.output?.substring(0, 100) });
      } else {
        toast({ title: "执行失败", description: result.error, variant: "destructive" });
      }
    } catch (e: any) {
      toast({ title: "执行失败", description: e.message, variant: "destructive" });
    } finally {
      setRunningId(null);
    }
  };

  return (
    <PageLayout>
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Settings className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">我的技能</h1>
              <p className="text-sm text-muted-foreground">管理已安装的技能，查看执行记录</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/skills")}>
              <Plus className="w-4 h-4 mr-1" /> 安装更多
            </Button>
          </div>
        </div>

        {/* Installed Skills */}
        {installedQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : installed.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Sparkles className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">还没有安装技能</p>
            <p className="text-sm mt-1">前往技能市场挑选适合你的技能</p>
            <Button className="mt-4" onClick={() => navigate("/skills")}>
              浏览技能市场
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {installed.map((item: any) => {
              const skill = item.skill;
              const config = skill.config || {};
              const isRunning = runningId === item.id;

              return (
                <div key={item.id} className="border rounded-xl bg-card overflow-hidden">
                  <div className="p-4 flex items-center gap-4">
                    {/* Icon */}
                    <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 text-xl
                      ${item.isActive ? "bg-primary/10" : "bg-muted"}`}>
                      {skill.icon || "🔧"}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold truncate">{skill.name}</h3>
                        {!item.isActive && (
                          <Badge variant="secondary" className="text-[10px]">已暂停</Badge>
                        )}
                        {item.scheduledTaskId && (
                          <Badge variant="outline" className="text-[10px] gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> 定时
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span>已执行 {item.runCount} 次</span>
                        {item.lastRunAt && (
                          <span>上次: {new Date(item.lastRunAt).toLocaleString("zh-CN")}</span>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleRun(item.id)}
                        disabled={isRunning || !item.isActive}
                        title="立即执行"
                      >
                        {isRunning
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Play className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleToggle(item.id, item.isActive)}
                        title={item.isActive ? "暂停" : "启用"}
                      >
                        {item.isActive
                          ? <Pause className="w-3.5 h-3.5" />
                          : <RotateCcw className="w-3.5 h-3.5" />}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleUninstall(skill.id, skill.name)}
                        title="卸载"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>

                  {/* 参数预览 */}
                  {item.params && Object.keys(item.params).length > 0 && (
                    <div className="px-4 pb-3 flex flex-wrap gap-2">
                      {Object.entries(item.params).slice(0, 4).map(([k, v]) => (
                        <span key={k} className="text-[11px] px-2 py-0.5 bg-muted rounded-full text-muted-foreground">
                          {k}: {String(v).substring(0, 30)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Recent Logs */}
        {logs.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <History className="w-5 h-5" /> 最近执行记录
            </h2>
            <div className="border rounded-xl overflow-hidden">
              <div className="divide-y">
                {logs.slice(0, 10).map((log: any) => (
                  <div key={log.id} className="px-4 py-3 flex items-center gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full shrink-0 ${
                      log.status === "success" ? "bg-green-500" :
                      log.status === "failed" ? "bg-destructive" :
                      log.status === "running" ? "bg-blue-500 animate-pulse" : "bg-muted"
                    }`} />
                    <span className="flex-1 truncate text-muted-foreground">
                      技能 #{log.skillId}
                      <span className="mx-1.5">·</span>
                      {log.triggerType === "cron" ? "定时触发" :
                       log.triggerType === "command" ? "命令触发" :
                       log.triggerType === "chat" ? "对话触发" : "手动执行"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(log.startedAt).toLocaleString("zh-CN")}
                    </span>
                    {log.cost && parseFloat(log.cost) > 0 && (
                      <span className="text-xs flex items-center gap-0.5">
                        <Zap className="w-3 h-3" /> {parseFloat(log.cost).toFixed(1)}
                      </span>
                    )}
                    <Badge
                      variant={log.status === "success" ? "default" : log.status === "failed" ? "destructive" : "secondary"}
                      className="text-[10px]"
                    >
                      {log.status === "success" ? "成功" : log.status === "failed" ? "失败" : log.status === "running" ? "运行中" : "超时"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </PageLayout>
  );
}
