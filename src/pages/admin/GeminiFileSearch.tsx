/**
 * Gemini File Search 管理页面
 *
 * 功能: 创建/删除 FileSearchStore, 上传/删除文档, 同步状态
 */
import { useState, useRef } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import {
  Database, Plus, Trash2, Upload, Search, ArrowLeft, FileText, Loader2,
  CheckCircle, AlertCircle, Clock, Eye, RefreshCw, X, HardDrive, File,
  Key, FolderSearch,
} from "lucide-react";

// ═══════════ 状态映射 ═══════════

const DOC_STATUS: Record<string, { label: string; color: string; icon: any }> = {
  uploading:   { label: "上传中",   color: "text-amber-500",   icon: Loader2 },
  processing:  { label: "处理中",   color: "text-blue-500",    icon: Loader2 },
  ready:       { label: "就绪",     color: "text-emerald-500", icon: CheckCircle },
  failed:      { label: "失败",     color: "text-red-500",     icon: AlertCircle },
};

// ═══════════ 主组件 ═══════════

export default function GeminiFileSearchManagement() {
  const [createOpen, setCreateOpen] = useState(false);
  const [detailStoreId, setDetailStoreId] = useState<number | null>(null);

  const { data: stores, isLoading, refetch } = trpc.geminiFileSearch.listStores.useQuery();
  const createMut = trpc.geminiFileSearch.createStore.useMutation();
  const deleteMut = trpc.geminiFileSearch.deleteStore.useMutation();

  // 创建表单
  const [newName, setNewName] = useState("");
  const [newApiKey, setNewApiKey] = useState("");

  const handleCreate = async () => {
    if (!newName.trim()) { toast.error("请输入存储区名称"); return; }
    if (!newApiKey.trim()) { toast.error("请输入 Gemini API Key"); return; }
    try {
      await createMut.mutateAsync({ displayName: newName.trim(), apiKey: newApiKey.trim() });
      toast.success("文件搜索存储区创建成功");
      setCreateOpen(false);
      setNewName(""); setNewApiKey("");
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定删除存储区「${name}」及其所有文档？此操作不可恢复。`)) return;
    try {
      await deleteMut.mutateAsync({ id });
      toast.success("已删除");
      refetch();
    } catch (e: any) { toast.error(e.message); }
  };

  // 如果在查看详情
  if (detailStoreId) {
    return <StoreDetail storeId={detailStoreId} onBack={() => { setDetailStoreId(null); refetch(); }} />;
  }

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <FolderSearch className="h-6 w-6 text-blue-500" />
              Gemini 文件搜索 (RAG)
            </h1>
            <p className="text-muted-foreground mt-1">
              使用 Google Gemini File Search API 实现文档检索增强生成。上传文件后，AI 对话时可自动检索相关内容。
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4 mr-1" /> 创建存储区
          </Button>
        </div>

        {/* 存储区列表 */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !stores || stores.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FolderSearch className="h-12 w-12 text-muted-foreground/40 mb-4" />
              <p className="text-muted-foreground mb-2">还没有文件搜索存储区</p>
              <p className="text-sm text-muted-foreground/60 mb-4">创建存储区并上传文件，让 AI 能够检索你的文档内容</p>
              <Button variant="outline" onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4 mr-1" /> 创建第一个存储区
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {stores.map((store: any) => (
              <Card key={store.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => setDetailStoreId(store.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{store.displayName}</CardTitle>
                      <CardDescription className="text-xs mt-1 truncate">
                        {store.geminiStoreName}
                      </CardDescription>
                    </div>
                    <Button
                      variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-red-500"
                      onClick={(e) => { e.stopPropagation(); handleDelete(store.id, store.displayName); }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <FileText className="h-3.5 w-3.5" /> {store.docCount} 文档
                    </span>
                    <span className="flex items-center gap-1">
                      <Key className="h-3.5 w-3.5" /> {store.apiKey}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground/60 mt-2">
                    {new Date(store.createdAt).toLocaleDateString()}
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
              <DialogTitle>创建文件搜索存储区</DialogTitle>
              <DialogDescription>
                存储区用于存放你上传的文件。文件会被自动分块、嵌入并编入索引，供 AI 对话时检索。
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div>
                <Label>存储区名称</Label>
                <Input
                  value={newName} onChange={(e) => setNewName(e.target.value)}
                  placeholder="例如: 产品文档库、课程资料" className="mt-1"
                />
              </div>
              <div>
                <Label>Gemini API Key</Label>
                <Input
                  value={newApiKey} onChange={(e) => setNewApiKey(e.target.value)}
                  placeholder="AIza..." type="password" className="mt-1"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  从 <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener" className="text-blue-500 hover:underline">Google AI Studio</a> 获取 API Key
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)}>取消</Button>
              <Button onClick={handleCreate} disabled={createMut.isPending}>
                {createMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                创建
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}

// ═══════════ Store 详情 ═══════════

function StoreDetail({ storeId, onBack }: { storeId: number; onBack: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: store } = trpc.geminiFileSearch.getStore.useQuery({ id: storeId });
  const { data: docs, isLoading: docsLoading, refetch: refetchDocs } = trpc.geminiFileSearch.listDocuments.useQuery({ storeId });
  const uploadMut = trpc.geminiFileSearch.uploadDocument.useMutation();
  const deleteDocMut = trpc.geminiFileSearch.deleteDocument.useMutation();
  const syncMut = trpc.geminiFileSearch.syncDocuments.useMutation();

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    let successCount = 0;

    for (const file of Array.from(files)) {
      try {
        // 读取文件为 base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error("读取文件失败"));
          reader.readAsDataURL(file);
        });

        await uploadMut.mutateAsync({
          storeId,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          fileData: base64,
        });
        successCount++;
      } catch (err: any) {
        toast.error(`上传 ${file.name} 失败: ${err.message}`);
      }
    }

    if (successCount > 0) {
      toast.success(`已提交 ${successCount} 个文件，正在后台处理...`);
      refetchDocs();
    }
    setUploading(false);
    // 重置 file input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDeleteDoc = async (docId: number, fileName: string) => {
    if (!confirm(`确定删除文档「${fileName}」？`)) return;
    try {
      await deleteDocMut.mutateAsync({ docId });
      toast.success("已删除");
      refetchDocs();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleSync = async () => {
    try {
      const result = await syncMut.mutateAsync({ storeId });
      toast.success(`同步完成，远程共 ${result.remoteDocCount} 个文档`);
      refetchDocs();
    } catch (e: any) { toast.error(e.message); }
  };

  // 轮询处理中的文档
  trpc.geminiFileSearch.listDocuments.useQuery(
    { storeId },
    {
      refetchInterval: docs?.some((d: any) => d.status === "uploading" || d.status === "processing") ? 5000 : false,
    }
  );

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* 头部 */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{store?.displayName || "..."}</h1>
            <p className="text-sm text-muted-foreground">{store?.geminiStoreName}</p>
          </div>
          <Button variant="outline" size="sm" onClick={handleSync} disabled={syncMut.isPending}>
            <RefreshCw className={`h-4 w-4 mr-1 ${syncMut.isPending ? "animate-spin" : ""}`} />
            同步
          </Button>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="hidden"
              accept=".txt,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.json,.md,.html,.xml,.py,.js,.ts,.java,.c,.cpp,.go,.rs,.rb,.php,.sql,.yaml,.yml,.sh,.css,.scss"
              onChange={handleFileSelect}
            />
            <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              上传文件
            </Button>
          </div>
        </div>

        {/* 支持的文件类型提示 */}
        <Card>
          <CardContent className="py-3">
            <p className="text-xs text-muted-foreground">
              支持的文件类型: PDF、Word、Excel、PPT、TXT、Markdown、HTML、CSV、JSON、代码文件 (.py/.js/.ts/.java/.go 等)、ZIP 压缩包
            </p>
          </CardContent>
        </Card>

        {/* 文档列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" /> 文档列表
              <Badge variant="secondary" className="ml-auto">{docs?.length || 0} 个文档</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {docsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : !docs || docs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <File className="h-8 w-8 mx-auto mb-2 opacity-30" />
                <p>还没有上传文件</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>文件名</TableHead>
                    <TableHead>类型</TableHead>
                    <TableHead>大小</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>上传时间</TableHead>
                    <TableHead className="w-[60px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {docs.map((doc: any) => {
                    const st = DOC_STATUS[doc.status] || DOC_STATUS.uploading;
                    const Icon = st.icon;
                    return (
                      <TableRow key={doc.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">{doc.fileName}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{doc.mimeType || "-"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {doc.fileSize > 0 ? formatSize(doc.fileSize) : "-"}
                        </TableCell>
                        <TableCell>
                          <span className={`flex items-center gap-1 text-xs ${st.color}`}>
                            <Icon className={`h-3.5 w-3.5 ${doc.status === "uploading" || doc.status === "processing" ? "animate-spin" : ""}`} />
                            {st.label}
                          </span>
                          {doc.status === "failed" && doc.errorMessage && (
                            <p className="text-xs text-red-400 mt-0.5 max-w-[200px] truncate" title={doc.errorMessage}>
                              {doc.errorMessage}
                            </p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(doc.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500"
                            onClick={() => handleDeleteDoc(doc.id, doc.fileName)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
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

// ═══════════ 工具函数 ═══════════

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}
