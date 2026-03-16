/**
 * 知识库管理 — 列表页
 *
 * 功能: 创建/删除/查看知识库, 上传文档, 检索测试
 */
import { useState, useEffect, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Database, Plus, Trash2, Upload, Search, ArrowLeft, FileText, Loader2,
  CheckCircle, AlertCircle, Clock, Eye, TestTube, X, BookOpen, File,
} from "lucide-react";

// ═══════════ 状态映射 ═══════════

const DOC_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  pending:    { label: "等待中",  color: "text-amber-500",   icon: Clock },
  processing: { label: "处理中", color: "text-blue-500",    icon: Loader2 },
  ready:      { label: "就绪",   color: "text-emerald-500", icon: CheckCircle },
  failed:     { label: "失败",   color: "text-red-500",     icon: AlertCircle },
};

// ═══════════ 主组件 ═══════════

export default function KnowledgeBaseManagement() {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailKbId, setDetailKbId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchKbId, setSearchKbId] = useState<number | null>(null);

  const { data: kbs, isLoading, refetch } = trpc.knowledgeBase.list.useQuery();
  const createMut = trpc.knowledgeBase.create.useMutation();
  const deleteMut = trpc.knowledgeBase.delete.useMutation();

  // 创建表单
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("请输入知识库名称"); return; }
    try {
      await createMut.mutateAsync({ name: newName.trim(), description: newDesc.trim() || undefined });
      toast.success("知识库创建成功");
      setCreateOpen(false);
      setNewName(""); setNewDesc("");
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除知识库「${name}」及其所有文档和片段？此操作不可恢复。`)) return;
    try {
      await deleteMut.mutateAsync({ id });
      toast.success("已删除");
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  // 如果在查看详情
  if (detailKbId) {
    return <KBDetail kbId={detailKbId} onBack={() => { setDetailKbId(null); refetch(); }} />;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">知识库管理</h1>
              <p className="text-muted-foreground mt-1">上传文档、构建知识库，AI 对话时自动检索相关内容</p>
            </div>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-2" /> 创建知识库
          </Button>
        </div>

        {/* 列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !kbs || kbs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center py-16 text-muted-foreground">
              <Database className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">还没有知识库</p>
              <p className="text-sm mt-1">创建一个知识库，上传文档后即可在对话中检索</p>
              <Button className="mt-4" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> 创建第一个知识库
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {kbs.map((kb: any) => (
              <Card key={kb.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailKbId(kb.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <BookOpen className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{kb.name}</CardTitle>
                      {kb.backend === 'gemini' ? (
                        <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300">Gemini</Badge>
                      ) : (
                        <Badge variant="secondary" className="text-xs">本地</Badge>
                      )}
                    </div>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setSearchKbId(kb.id); setSearchOpen(true); }}>
                        <TestTube className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(kb.id, kb.name)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {kb.description && (
                    <CardDescription className="line-clamp-2">{kb.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1"><FileText className="h-3.5 w-3.5" /> {kb.docCount} 文档</span>
                    <span className="flex items-center gap-1"><Database className="h-3.5 w-3.5" /> {kb.chunkCount} 片段</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    AI 对话时自动检索 · 也可输入 <code className="bg-muted px-1 rounded">@{kb.name}</code> 精确指定
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 创建对话框 */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>创建知识库</DialogTitle>
              <DialogDescription>创建后上传文档即可使用。如果你的模型配置中包含 Gemini API Key，将自动使用 Gemini File Search（更高质量）；否则使用本地 RAG。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>名称</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="如: 产品文档" />
              </div>
              <div>
                <Label>描述（可选）</Label>
                <Textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} placeholder="简要说明知识库用途" rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* 检索测试对话框 */}
        {searchKbId && (
          <SearchTestDialog kbId={searchKbId} open={searchOpen} onClose={() => { setSearchOpen(false); setSearchKbId(null); }} />
        )}
      </div>
    </DashboardLayout>
  );
}

// ═══════════ 知识库详情（文档管理） ═══════════

function KBDetail({ kbId, onBack }: { kbId: number; onBack: () => void }) {
  const { data: kb } = trpc.knowledgeBase.getById.useQuery({ id: kbId });
  const { data: docs, refetch: refetchDocs } = trpc.knowledgeBase.listDocuments.useQuery({ kbId });
  const uploadMut = trpc.knowledgeBase.uploadDocument.useMutation();
  const deleteMut = trpc.knowledgeBase.deleteDocument.useMutation();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);

  // 自动刷新（有 processing 文档时）
  const hasProcessing = docs?.some((d: any) => d.status === "processing" || d.status === "pending");
  useEffect(() => {
    if (!hasProcessing) return;
    const timer = setInterval(() => refetchDocs(), 3000);
    return () => clearInterval(timer);
  }, [hasProcessing]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (kb?.backend === 'gemini') {
          // ★ Gemini 后端：读取文件为 base64 直接传给后端
          const base64 = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => reject(new Error("读取文件失败"));
            reader.readAsDataURL(file);
          });

          await uploadMut.mutateAsync({
            kbId,
            fileName: file.name,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size,
            fileData: base64,
          });
        } else {
          // 本地后端：先上传文件到平台存储
          const formData = new FormData();
          formData.append("file", file);

          const uploadRes = await fetch("/api/upload", {
            method: "POST",
            body: formData,
            headers: { Authorization: `Bearer ${localStorage.getItem("auth_token") || ""}` },
          });

          if (!uploadRes.ok) throw new Error("文件上传失败");
          const { url } = await uploadRes.json();

          await uploadMut.mutateAsync({
            kbId,
            fileName: file.name,
            fileUrl: url,
            fileType: file.type || "application/octet-stream",
            fileSize: file.size,
          });
        }

        toast.success(`${file.name} 已提交处理`);
      }
      refetchDocs();
    } catch (err: any) {
      toast.error("上传失败: " + err.message);
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteDoc = async (docId: number, name: string, isGemini?: boolean) => {
    if (!confirm(`删除文档「${name}」？`)) return;
    try {
      await deleteMut.mutateAsync({ docId, isGemini: isGemini || false });
      toast.success("已删除");
      refetchDocs();
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={onBack}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">{kb?.name || "知识库"}</h1>
              {kb?.description && <p className="text-muted-foreground mt-1">{kb.description}</p>}
              {kb?.backend === 'gemini' && (
                <Badge variant="secondary" className="text-xs bg-blue-50 text-blue-600 dark:bg-blue-950 dark:text-blue-300 mt-1">Gemini File Search · 自动检索</Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              multiple
              accept=".pdf,.docx,.doc,.txt,.md,.csv,.xlsx,.xls,.pptx,.ppt,.json,.html,.xml,.py,.js,.ts,.java,.c,.cpp,.go,.rs,.rb,.php,.sql,.yaml,.yml,.sh,.css"
              className="hidden"
              id="kb-file-upload"
              onChange={handleUpload}
            />
            <Button asChild disabled={uploading}>
              <label htmlFor="kb-file-upload" className="cursor-pointer">
                {uploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                上传文档
              </label>
            </Button>
          </div>
        </div>

        {/* 统计 */}
        {kb && (
          <div className="flex gap-4">
            <Badge variant="outline" className="text-sm px-3 py-1">
              <FileText className="h-3.5 w-3.5 mr-1" /> {kb.docCount} 文档
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">
              <Database className="h-3.5 w-3.5 mr-1" /> {kb.chunkCount} 片段
            </Badge>
            <Badge variant="outline" className="text-sm px-3 py-1">
              切片大小: {kb.chunkSize} tokens
            </Badge>
          </div>
        )}

        {/* 文档列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">文档列表</CardTitle>
            <CardDescription>支持 PDF、Word、TXT、Markdown、CSV、Excel</CardDescription>
          </CardHeader>
          <CardContent>
            {!docs || docs.length === 0 ? (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <File className="h-10 w-10 mb-3 opacity-40" />
                <p>还没有文档，点击上方「上传文档」开始</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文件名</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>片段数</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>上传时间</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc: any) => {
                    const st = DOC_STATUS[doc.status] || DOC_STATUS.pending;
                    const Icon = st.icon;
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{doc.fileName}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{doc.fileType?.split("/").pop() || "-"}</TableCell>
                        <TableCell className="text-sm">{doc.fileSize ? (doc.fileSize / 1024).toFixed(0) + " KB" : "-"}</TableCell>
                        <TableCell>{doc.chunkCount || "-"}</TableCell>
                        <TableCell>
                          <span className={`flex items-center gap-1 text-sm ${st.color}`}>
                            <Icon className={`h-3.5 w-3.5 ${doc.status === "processing" ? "animate-spin" : ""}`} />
                            {st.label}
                          </span>
                          {doc.status === "failed" && doc.errorMessage && (
                            <p className="text-xs text-red-400 mt-1 max-w-[200px] truncate" title={doc.errorMessage}>{doc.errorMessage}</p>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteDoc(doc.id, doc.fileName, doc._isGemini)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

// ═══════════ 检索测试对话框 ═══════════

function SearchTestDialog({ kbId, open, onClose }: { kbId: number; open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState("");
  const searchMut = trpc.knowledgeBase.testSearch.useMutation();
  const [results, setResults] = useState<any[]>([]);

  const handleSearch = async () => {
    if (!query.trim()) return;
    try {
      const res = await searchMut.mutateAsync({ kbId, query: query.trim(), topK: 5 });
      setResults(res);
      if (res.length === 0) toast.info("未找到相关内容");
    } catch (e: any) { toast.error(e.message); }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>检索测试</DialogTitle>
          <DialogDescription>输入问题测试知识库的检索效果</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="输入测试问题..."
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch} disabled={searchMut.isPending}>
              {searchMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-3">
              {results.map((r: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline">#{i + 1}</Badge>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span>相似度: {(r.score * 100).toFixed(1)}%</span>
                        <span>{r.tokenCount} tokens</span>
                      </div>
                    </div>
                    <p className="text-sm whitespace-pre-wrap">{r.content}</p>
                    {r.metadata?.fileName && (
                      <p className="text-xs text-muted-foreground mt-2">来源: {r.metadata.fileName}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
