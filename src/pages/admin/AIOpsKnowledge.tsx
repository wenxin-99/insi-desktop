/**
 * Admin AI-Ops Knowledge Base
 *
 * 修复知识库浏览器：
 * - 全文搜索历史修复方案
 * - 按模块/类别筛选
 * - 查看修复详情（问题→根因→方案→效果）
 * - 知识库统计概览
 */

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, BookOpen, Search, TrendingUp, CheckCircle, Recycle,
  FileCode, Tag, ChevronRight, RefreshCw, Brain,
} from "lucide-react";
import { useLocation } from "wouter";

export default function AdminAIOpsKnowledge() {
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [selectedId, setSelectedId] = useState<number | null>(null);

  const { data: stats } = trpc.aiOps.getKBStats.useQuery();
  const { data: knowledge, isLoading } = trpc.aiOps.listKnowledge.useQuery({
    search: search || undefined,
    module: moduleFilter === "all" ? undefined : moduleFilter,
    limit: 30,
  });
  const { data: detail } = trpc.aiOps.getKnowledgeDetail.useQuery(
    { id: selectedId! }, { enabled: !!selectedId });

  return (
    <DashboardLayout>
      <div className="container max-w-6xl py-6 space-y-6">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/admin/ai-ops")} className="h-8 px-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <Brain className="h-5 w-5 text-amber-500" />
            <div>
              <h1 className="text-xl font-bold">修复知识库</h1>
              <p className="text-xs text-muted-foreground">
                成功修复方案的沉淀 · 加速未来相似问题处理
              </p>
            </div>
          </div>
        </div>

        {/* 统计卡片 */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard icon={<BookOpen className="h-5 w-5 text-blue-500" />}
              label="知识条目" value={stats.totalEntries} />
            <StatCard icon={<TrendingUp className="h-5 w-5 text-emerald-500" />}
              label="平均修复率" value={`${Math.round(stats.avgEffectiveness * 100)}%`} />
            <StatCard icon={<Recycle className="h-5 w-5 text-violet-500" />}
              label="总复用次数" value={stats.totalReuses} />
            <StatCard icon={<CheckCircle className="h-5 w-5 text-amber-500" />}
              label="覆盖模块" value={stats.topModules?.length || 0} />
          </div>
        )}

        {/* 搜索 + 筛选 */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索问题、根因、解决方案..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={moduleFilter} onValueChange={setModuleFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="全部模块" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部模块</SelectItem>
              {stats?.topModules?.map((m: any) => (
                <SelectItem key={m.module} value={m.module}>
                  {m.module} ({m.count})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* 知识列表 */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">
              知识条目 ({knowledge?.total || 0})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12 text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />加载中
              </div>
            ) : !knowledge?.items?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无知识条目</p>
                <p className="text-xs mt-1">成功修复并经用户验证后会自动沉淀到这里</p>
              </div>
            ) : (
              <div className="divide-y">
                {knowledge.items.map((entry: any) => (
                  <div key={entry.id}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30 cursor-pointer"
                    onClick={() => setSelectedId(entry.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{entry.problem}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">{entry.category}</Badge>
                        <span className="text-xs text-muted-foreground font-mono">{entry.affectedModule}</span>
                        <span className="text-xs text-muted-foreground">·</span>
                        <span className="text-xs text-emerald-500">
                          {Math.round(entry.effectiveness * 100)}% 有效
                        </span>
                        {entry.reuseCount > 0 && (
                          <>
                            <span className="text-xs text-muted-foreground">·</span>
                            <span className="text-xs text-violet-500">
                              复用 {entry.reuseCount} 次
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 详情弹窗 */}
        <Dialog open={!!selectedId} onOpenChange={() => setSelectedId(null)}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            {detail && (
              <>
                <DialogHeader>
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="outline">{detail.category}</Badge>
                    <Badge variant="secondary">{detail.affectedModule}</Badge>
                    <Badge
                      variant="outline"
                      className={detail.effectiveness >= 0.7 ? "text-emerald-500 border-emerald-500/30" : "text-amber-500 border-amber-500/30"}
                    >
                      {Math.round(detail.effectiveness * 100)}% 有效
                    </Badge>
                  </div>
                  <DialogTitle className="text-lg">{detail.problem}</DialogTitle>
                </DialogHeader>

                <div className="space-y-5 mt-3">
                  {/* 根因 */}
                  {detail.rootCause && (
                    <Section icon={<Search className="h-4 w-4 text-amber-500" />} title="根因分析">
                      <p className="text-sm text-muted-foreground leading-relaxed">{detail.rootCause}</p>
                    </Section>
                  )}

                  {/* 解决方案 */}
                  <Section icon={<CheckCircle className="h-4 w-4 text-emerald-500" />} title="解决方案">
                    <p className="text-sm text-muted-foreground leading-relaxed">{detail.solution}</p>
                  </Section>

                  {/* 修改文件 */}
                  {detail.affectedFiles?.length > 0 && (
                    <Section icon={<FileCode className="h-4 w-4 text-blue-500" />} title="修改文件">
                      <div className="space-y-1">
                        {detail.affectedFiles.map((f: string, i: number) => (
                          <div key={i} className="text-xs font-mono text-muted-foreground bg-muted/50 px-2 py-1 rounded">
                            {f}
                          </div>
                        ))}
                      </div>
                    </Section>
                  )}

                  {/* 补丁摘要 */}
                  {detail.patchSummary && (
                    <Section icon={<FileCode className="h-4 w-4 text-violet-500" />} title="补丁摘要">
                      <pre className="text-xs text-muted-foreground bg-muted/30 p-3 rounded-lg whitespace-pre-wrap font-mono">
                        {detail.patchSummary}
                      </pre>
                    </Section>
                  )}

                  {/* 标签 */}
                  {detail.tags?.length > 0 && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <Tag className="h-3.5 w-3.5 text-muted-foreground" />
                      {detail.tags.map((tag: string, i: number) => (
                        <Badge key={i} variant="outline" className="text-xs">{tag}</Badge>
                      ))}
                    </div>
                  )}

                  {/* 统计 */}
                  <div className="grid grid-cols-3 gap-3 pt-2 border-t">
                    <div className="text-center p-2 bg-muted/30 rounded-lg">
                      <div className="text-lg font-bold text-emerald-500">
                        {Math.round(detail.effectiveness * 100)}%
                      </div>
                      <div className="text-xs text-muted-foreground">修复有效率</div>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded-lg">
                      <div className="text-lg font-bold text-violet-500">{detail.reuseCount}</div>
                      <div className="text-xs text-muted-foreground">被复用次数</div>
                    </div>
                    <div className="text-center p-2 bg-muted/30 rounded-lg">
                      <div className="text-lg font-bold">{detail.affectedFiles?.length || 0}</div>
                      <div className="text-xs text-muted-foreground">涉及文件</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: any }) {
  return (
    <Card>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center gap-2 mb-2">{icon}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold flex items-center gap-1.5 mb-2">{icon}{title}</h4>
      {children}
    </div>
  );
}
