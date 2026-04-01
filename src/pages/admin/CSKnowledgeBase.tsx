/**
 * 管理后台 — 智能客服知识库管理
 *
 * 功能:
 * - 文档 CRUD（支持 Markdown 编辑）
 * - 分类管理
 * - 处理状态监控
 * - 检索测试
 * - 知识库概览统计
 */

import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  BookOpen, Plus, Search, RefreshCw, Trash2, Edit, Eye, FileText,
  FolderPlus, TestTube, Loader2, CheckCircle, AlertCircle, Clock,
  Database, Layers, MessageSquare,
} from "lucide-react";

const STATUS_MAP: Record<string, { label: string; color: string; icon: any }> = {
  pending:     { label: "待处理", color: "text-amber-500", icon: Clock },
  processing:  { label: "处理中", color: "text-blue-500", icon: Loader2 },
  ready:       { label: "就绪", color: "text-emerald-500", icon: CheckCircle },
  error:       { label: "错误", color: "text-red-500", icon: AlertCircle },
};

export default function CSKnowledgeBase() {
  const [search, setSearch] = useState("");
  const [showCreateDoc, setShowCreateDoc] = useState(false);
  const [showEditDoc, setShowEditDoc] = useState<number | null>(null);
  const [showCreateCat, setShowCreateCat] = useState(false);
  const [showTestSearch, setShowTestSearch] = useState(false);
  const [testQuery, setTestQuery] = useState("");
  const [newDoc, setNewDoc] = useState({ title: "", content: "", categoryId: 0 });
  const [editDoc, setEditDoc] = useState({ title: "", content: "", categoryId: 0 });
  const [newCatName, setNewCatName] = useState("");

  // ── 数据查询 ──
  const { data: overview } = trpc.customerService.getKBOverview.useQuery();
  const { data: docs, refetch: refetchDocs } = trpc.customerService.listDocuments.useQuery({
    search: search || undefined, limit: 50,
  });
  const { data: categories, refetch: refetchCats } = trpc.customerService.listCategories.useQuery();
  const { data: docDetail } = trpc.customerService.getDocument.useQuery(
    { id: showEditDoc! }, { enabled: !!showEditDoc }
  );
  const { data: testResults, refetch: refetchTest, isFetching: testLoading } = trpc.customerService.testRetrieval.useQuery(
    { query: testQuery, topK: 5 }, { enabled: false }
  );

  // ── Mutations ──
  const createDocMut = trpc.customerService.createDocument.useMutation({
    onSuccess: () => { toast.success("文档已创建，正在处理中..."); setShowCreateDoc(false); setNewDoc({ title: "", content: "", categoryId: 0 }); refetchDocs(); },
    onError: (e) => toast.error(e.message),
  });
  const updateDocMut = trpc.customerService.updateDocument.useMutation({
    onSuccess: () => { toast.success("文档已更新"); setShowEditDoc(null); refetchDocs(); },
  });
  const deleteDocMut = trpc.customerService.deleteDocument.useMutation({
    onSuccess: () => { toast.success("文档已删除"); refetchDocs(); },
  });
  const reprocessMut = trpc.customerService.reprocessDocument.useMutation({
    onSuccess: () => { toast.success("重新处理中..."); refetchDocs(); },
  });
  const reprocessAllMut = trpc.customerService.reprocessAll.useMutation({
    onSuccess: (data) => toast.success(`全量处理完成: ${data.success} 成功, ${data.failed} 失败`),
  });
  const createCatMut = trpc.customerService.createCategory.useMutation({
    onSuccess: () => { toast.success("分类已创建"); setShowCreateCat(false); setNewCatName(""); refetchCats(); },
  });
  const deleteCatMut = trpc.customerService.deleteCategory.useMutation({
    onSuccess: () => { toast.success("分类已删除"); refetchCats(); },
  });

  // 编辑文档时加载内容
  useEffect(() => {
    if (showEditDoc && docDetail && editDoc.title === "") {
      setEditDoc({ title: docDetail.title, content: docDetail.content, categoryId: docDetail.category_id || 0 });
    }
  }, [showEditDoc, docDetail]);

  const docCount = overview?.documents;

  return (
    <DashboardLayout>
      <div className="container max-w-7xl py-6 space-y-6">
        {/* ═══ 页面标题 ═══ */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-500
              flex items-center justify-center text-white">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">客服知识库</h1>
              <p className="text-sm text-muted-foreground">管理 AI 客服的知识来源 · 文档上传 · 向量化 · 检索测试</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setShowTestSearch(true)}>
              <TestTube className="h-3.5 w-3.5 mr-1.5" />检索测试
            </Button>
            <Button size="sm" onClick={() => setShowCreateDoc(true)}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />添加文档
            </Button>
          </div>
        </div>

        {/* ═══ 统计卡片 ═══ */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={<FileText className="h-5 w-5 text-blue-500" />}
            label="文档总数" value={docCount?.total ?? 0} sub={`就绪 ${docCount?.ready ?? 0}`} />
          <StatCard icon={<Layers className="h-5 w-5 text-violet-500" />}
            label="知识切片" value={overview?.chunks ?? 0} sub="向量化片段" />
          <StatCard icon={<FolderPlus className="h-5 w-5 text-amber-500" />}
            label="分类数" value={overview?.categories ?? 0} sub="" />
          <StatCard icon={<MessageSquare className="h-5 w-5 text-emerald-500" />}
            label="处理中" value={docCount?.processing ?? 0}
            sub={`错误 ${docCount?.errors ?? 0}`}
            alert={(docCount?.errors ?? 0) > 0} />
        </div>

        {/* ═══ 分类管理 ═══ */}
        {categories && categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-muted-foreground">分类:</span>
            {categories.map((cat: any) => (
              <Badge key={cat.id} variant="secondary" className="text-xs gap-1">
                {cat.name}
                <button onClick={() => { if (confirm(`删除分类「${cat.name}」？`)) deleteCatMut.mutate({ id: cat.id }); }}
                  className="ml-1 hover:text-red-500">×</button>
              </Badge>
            ))}
            <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => setShowCreateCat(true)}>
              <Plus className="h-3 w-3 mr-1" />添加
            </Button>
          </div>
        )}

        {/* ═══ 搜索 + 操作 ═══ */}
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="搜索文档标题或内容..." value={search}
              onChange={e => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Button variant="outline" size="sm" onClick={() => refetchDocs()}>
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => reprocessAllMut.mutate()}
            disabled={reprocessAllMut.isPending}>
            {reprocessAllMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Database className="h-3.5 w-3.5 mr-1" />}
            全量刷新
          </Button>
        </div>

        {/* ═══ 文档列表 ═══ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">文档列表 ({docs?.total || 0})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {!docs?.items?.length ? (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">暂无文档</p>
                <p className="text-xs mt-1">点击"添加文档"上传知识库内容</p>
              </div>
            ) : (
              <div className="divide-y">
                {docs.items.map((doc: any) => {
                  const st = STATUS_MAP[doc.status] || STATUS_MAP.pending;
                  const StIcon = st.icon;
                  return (
                    <div key={doc.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-muted/30">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium truncate">{doc.title}</span>
                          <Badge variant="outline" className="text-xs">{doc.file_type}</Badge>
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>{doc.chunk_count} 切片</span>
                          <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                          <span>{new Date(doc.created_at).toLocaleDateString("zh-CN")}</span>
                          {doc.error_msg && <span className="text-red-500 truncate max-w-[200px]">{doc.error_msg}</span>}
                        </div>
                      </div>
                      <div className={`flex items-center gap-1 text-xs ${st.color}`}>
                        <StIcon className={`h-3.5 w-3.5 ${doc.status === "processing" ? "animate-spin" : ""}`} />
                        {st.label}
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => { setShowEditDoc(doc.id); setEditDoc({ title: "", content: "", categoryId: 0 }); }}>
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => reprocessMut.mutate({ id: doc.id })} disabled={reprocessMut.isPending}>
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-500 hover:text-red-600"
                          onClick={() => { if (confirm(`删除「${doc.title}」？`)) deleteDocMut.mutate({ id: doc.id }); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ═══ 创建文档弹窗 ═══ */}
        <Dialog open={showCreateDoc} onOpenChange={setShowCreateDoc}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>添加知识文档</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium">标题</label>
                <Input value={newDoc.title} onChange={e => setNewDoc(d => ({ ...d, title: e.target.value }))}
                  placeholder="如: 产品功能介绍、退款政策、常见问题..." />
              </div>
              {categories && categories.length > 0 && (
                <div>
                  <label className="text-sm font-medium">分类</label>
                  <Select value={String(newDoc.categoryId)} onValueChange={v => setNewDoc(d => ({ ...d, categoryId: Number(v) }))}>
                    <SelectTrigger><SelectValue placeholder="选择分类" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">未分类</SelectItem>
                      {categories.map((c: any) => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div>
                <label className="text-sm font-medium">内容（支持 Markdown）</label>
                <Textarea value={newDoc.content} onChange={e => setNewDoc(d => ({ ...d, content: e.target.value }))}
                  placeholder="在这里粘贴或编写知识文档内容...&#10;&#10;支持 Markdown 格式，系统会自动切片和向量化。"
                  rows={15} className="font-mono text-sm" />
                <p className="text-xs text-muted-foreground mt-1">{newDoc.content.length} 字符</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateDoc(false)}>取消</Button>
              <Button onClick={() => createDocMut.mutate({
                title: newDoc.title, content: newDoc.content,
                categoryId: newDoc.categoryId || undefined,
              })} disabled={!newDoc.title || !newDoc.content || createDocMut.isPending}>
                {createDocMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                创建并处理
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ 编辑文档弹窗 ═══ */}
        <Dialog open={!!showEditDoc} onOpenChange={() => setShowEditDoc(null)}>
          <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>编辑文档</DialogTitle>
            </DialogHeader>
            {editDoc.title && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium">标题</label>
                  <Input value={editDoc.title} onChange={e => setEditDoc(d => ({ ...d, title: e.target.value }))} />
                </div>
                <div>
                  <label className="text-sm font-medium">内容</label>
                  <Textarea value={editDoc.content} onChange={e => setEditDoc(d => ({ ...d, content: e.target.value }))}
                    rows={15} className="font-mono text-sm" />
                  <p className="text-xs text-muted-foreground mt-1">{editDoc.content.length} 字符 · 修改内容会自动重新切片和向量化</p>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEditDoc(null)}>取消</Button>
              <Button onClick={() => showEditDoc && updateDocMut.mutate({
                id: showEditDoc, title: editDoc.title, content: editDoc.content,
              })} disabled={updateDocMut.isPending}>
                保存
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ 创建分类弹窗 ═══ */}
        <Dialog open={showCreateCat} onOpenChange={setShowCreateCat}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>添加分类</DialogTitle></DialogHeader>
            <Input value={newCatName} onChange={e => setNewCatName(e.target.value)} placeholder="分类名称" />
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCreateCat(false)}>取消</Button>
              <Button onClick={() => createCatMut.mutate({ name: newCatName })} disabled={!newCatName}>创建</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ═══ 检索测试弹窗 ═══ */}
        <Dialog open={showTestSearch} onOpenChange={setShowTestSearch}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>检索测试</DialogTitle></DialogHeader>
            <div className="flex gap-2">
              <Input value={testQuery} onChange={e => setTestQuery(e.target.value)}
                placeholder="输入测试查询..." onKeyDown={e => e.key === "Enter" && refetchTest()} />
              <Button onClick={() => refetchTest()} disabled={!testQuery || testLoading}>
                {testLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {testResults && (
              <div className="space-y-3 mt-2">
                {testResults.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">未找到相关结果</p>
                ) : testResults.map((r: any, i: number) => (
                  <div key={i} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium">{r.metadata?.title || `文档 #${r.documentId}`}</span>
                      <div className="flex gap-2">
                        <Badge variant="outline" className="text-xs">{r.source}</Badge>
                        <Badge variant="secondary" className="text-xs">
                          {(r.score * 100).toFixed(1)}%
                        </Badge>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {r.content.substring(0, 300)}{r.content.length > 300 ? "..." : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

function StatCard({ icon, label, value, sub, alert }: {
  icon: React.ReactNode; label: string; value: any; sub: string; alert?: boolean;
}) {
  return (
    <Card className={alert ? "border-red-500/30 bg-red-500/5" : ""}>
      <CardContent className="pt-5 pb-4 px-5">
        <div className="flex items-center gap-2 mb-2">{icon}</div>
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        {sub && <div className="text-[11px] text-muted-foreground/60 mt-0.5">{sub}</div>}
      </CardContent>
    </Card>
  );
}
