/**
 * KnowledgeBase — 用户知识库管理页面
 *
 * 复用已有 knowledgeBase.* tRPC API（9 个）
 * 功能：创建 KB → 上传文档 → 查看状态 → 检索测试
 */
import { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import {
  Database, Plus, Trash2, Upload, Search, FileText, Loader2,
  CheckCircle, AlertCircle, Clock, BookOpen, ArrowLeft, TestTube, X,
} from 'lucide-react';

// 文档状态映射
const DOC_STATUS: Record<string, { label: string; color: string; Icon: any }> = {
  pending:    { label: '等待中', color: 'text-amber-500',   Icon: Clock },
  processing: { label: '处理中', color: 'text-blue-500',   Icon: Loader2 },
  ready:      { label: '就绪',   color: 'text-emerald-500', Icon: CheckCircle },
  failed:     { label: '失败',   color: 'text-red-500',     Icon: AlertCircle },
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}

export default function KnowledgeBasePage() {
  const [selectedKbId, setSelectedKbId] = useState<number | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // 数据
  const { data: kbs, isLoading, refetch } = trpc.knowledgeBase.list.useQuery();
  const selectedKb = kbs?.find((kb: any) => kb.id === selectedKbId);

  // 列表视图
  if (!selectedKbId) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />知识库
              </h1>
              <p className="text-sm text-muted-foreground mt-1">上传文档，让 AI 基于你的资料回答问题</p>
            </div>
            <Button onClick={() => setCreateOpen(true)}>
              <Plus className="w-4 h-4 mr-1.5" />创建知识库
            </Button>
          </div>

          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
          ) : !kbs?.length ? (
            <Card className="border-dashed p-12 text-center">
              <BookOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground mb-4">还没有知识库</p>
              <Button onClick={() => setCreateOpen(true)} variant="outline">
                <Plus className="w-4 h-4 mr-1.5" />创建第一个
              </Button>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {kbs.map((kb: any) => (
                <Card key={kb.id} className="cursor-pointer hover:shadow-md hover:border-primary/30 transition-all"
                  onClick={() => setSelectedKbId(kb.id)}>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Database className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">{kb.name}</h3>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {kb.backend === 'gemini' ? 'Gemini File Search' : '本地 RAG'}
                          </p>
                        </div>
                      </div>
                    </div>
                    {kb.description && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{kb.description}</p>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-3">
                      {new Date(kb.createdAt).toLocaleDateString('zh-CN')}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>

        <CreateKBDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={() => { refetch(); setCreateOpen(false); }} />
      </DashboardLayout>
    );
  }

  // 详情视图
  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        <KBDetail
          kbId={selectedKbId}
          onBack={() => setSelectedKbId(null)}
          onDeleted={() => { setSelectedKbId(null); refetch(); }}
          onTestSearch={() => setSearchOpen(true)}
        />
      </div>
      <SearchTestDialog open={searchOpen} onOpenChange={setSearchOpen} kbId={selectedKbId} />
    </DashboardLayout>
  );
}

// ═══════ 创建知识库弹窗 ═══════

function CreateKBDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const createMut = trpc.knowledgeBase.create.useMutation({
    onSuccess: () => { toast.success('知识库已创建'); onCreated(); setName(''); setDescription(''); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Database className="w-4.5 h-4.5 text-primary" />创建知识库</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-sm font-medium mb-1 block">名称 *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="例：产品文档" maxLength={100} />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">描述</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="简要描述知识库内容" />
          </div>
          <Button onClick={() => createMut.mutate({ name, description })} className="w-full" disabled={!name.trim() || createMut.isPending}>
            {createMut.isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Plus className="w-4 h-4 mr-1.5" />}
            创建
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════ 知识库详情 ═══════

function KBDetail({ kbId, onBack, onDeleted, onTestSearch }: { kbId: number; onBack: () => void; onDeleted: () => void; onTestSearch: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: kb } = trpc.knowledgeBase.getById.useQuery({ id: kbId });
  const { data: docs, refetch: refetchDocs } = trpc.knowledgeBase.listDocuments.useQuery({ kbId: kbId });
  const deleteMut = trpc.knowledgeBase.delete.useMutation({
    onSuccess: () => { toast.success('知识库已删除'); onDeleted(); },
    onError: (e) => toast.error(e.message),
  });
  const uploadMut = trpc.knowledgeBase.uploadDocument.useMutation({
    onSuccess: () => { toast.success('文档已上传，正在处理...'); refetchDocs(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteDocMut = trpc.knowledgeBase.deleteDocument.useMutation({
    onSuccess: () => { toast.success('文档已删除'); refetchDocs(); },
    onError: (e) => toast.error(e.message),
  });

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 读取文件为 base64
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1];
      uploadMut.mutate({
        kbId: kbId,
        fileName: file.name,
        fileData: base64,
        fileType: file.type || 'application/octet-stream',
        fileSize: file.size,
      });
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset
  }, [kbId, uploadMut]);

  const readyCount = docs?.filter((d: any) => d.status === 'ready').length || 0;

  return (
    <div>
      {/* 头部 */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold truncate">{kb?.name || '...'}</h2>
          {kb?.description && <p className="text-xs text-muted-foreground truncate">{kb.description}</p>}
        </div>
        <Button variant="outline" size="sm" onClick={onTestSearch}>
          <TestTube className="w-3.5 h-3.5 mr-1.5" />检索测试
        </Button>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive"
          onClick={() => { if (confirm('确定删除此知识库？所有文档将被删除。')) deleteMut.mutate({ id: kbId }); }}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>

      {/* 统计 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: '文档数', value: docs?.length || 0, icon: FileText },
          { label: '就绪', value: readyCount, icon: CheckCircle },
          { label: '后端', value: kb?.backend === 'gemini' ? 'Gemini' : 'Local RAG', icon: Database },
        ].map(s => (
          <Card key={s.label} className="p-3">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <s.icon className="w-3.5 h-3.5" />
              <span className="text-xs">{s.label}</span>
            </div>
            <div className="text-lg font-semibold">{s.value}</div>
          </Card>
        ))}
      </div>

      {/* 上传区域 */}
      <div className="mb-4">
        <input ref={fileInputRef} type="file" className="hidden"
          accept=".pdf,.txt,.md,.doc,.docx,.csv,.json,.html,.xml"
          onChange={handleFileSelect} />
        <Button onClick={() => fileInputRef.current?.click()} disabled={uploadMut.isPending} variant="outline" className="w-full h-20 border-dashed">
          {uploadMut.isPending ? (
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
          ) : (
            <Upload className="w-5 h-5 mr-2 text-muted-foreground" />
          )}
          <div className="text-left">
            <div className="text-sm font-medium">{uploadMut.isPending ? '上传中...' : '点击上传文档'}</div>
            <div className="text-xs text-muted-foreground">支持 PDF、TXT、Markdown、Word、CSV</div>
          </div>
        </Button>
      </div>

      {/* 文档列表 */}
      <div className="space-y-2">
        {(docs || []).map((doc: any) => {
          const st = DOC_STATUS[doc.status] || DOC_STATUS.pending;
          return (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border bg-card hover:bg-accent/30 transition-colors">
              <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{doc.fileName || doc.name}</div>
                <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                  <span className={`flex items-center gap-1 ${st.color}`}>
                    <st.Icon className={`w-3 h-3 ${doc.status === 'processing' ? 'animate-spin' : ''}`} />
                    {st.label}
                  </span>
                  {doc.chunkCount > 0 && <span>{doc.chunkCount} 个片段</span>}
                  {doc.fileSize && <span>{formatSize(doc.fileSize)}</span>}
                </div>
                {doc.errorMessage && <div className="text-xs text-red-500 mt-1">{doc.errorMessage}</div>}
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => deleteDocMut.mutate({ docId: doc.id })}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
        {docs?.length === 0 && (
          <div className="py-8 text-center text-muted-foreground text-sm">
            暂无文档，点击上方上传
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════ 检索测试弹窗 ═══════

function SearchTestDialog({ open, onOpenChange, kbId }: { open: boolean; onOpenChange: (v: boolean) => void; kbId: number }) {
  const [query, setQuery] = useState('');
  const searchMut = trpc.knowledgeBase.testSearch.useMutation();

  const handleSearch = () => {
    if (!query.trim()) return;
    searchMut.mutate({ kbId: kbId, query: query.trim(), topK: 5 });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><TestTube className="w-4.5 h-4.5 text-primary" />检索测试</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 mt-2">
          <div className="flex gap-2">
            <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="输入测试查询..."
              onKeyDown={e => e.key === 'Enter' && handleSearch()} className="flex-1" />
            <Button onClick={handleSearch} disabled={searchMut.isPending || !query.trim()}>
              {searchMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </Button>
          </div>

          {searchMut.data && (
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">
                找到 {searchMut.data.results?.length || 0} 个结果
                {searchMut.data.timing && ` · ${searchMut.data.timing}ms`}
              </div>
              {(searchMut.data.results || []).map((r: any, i: number) => (
                <Card key={i} className="p-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium text-muted-foreground">#{i + 1}</span>
                    {r.score !== undefined && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-mono">
                        {(r.score * 100).toFixed(1)}%
                      </span>
                    )}
                  </div>
                  <div className="text-sm leading-relaxed">
                    <SafeMarkdown>{r.content || r.text || ''}</SafeMarkdown>
                  </div>
                  {r.metadata?.source && (
                    <div className="text-[11px] text-muted-foreground mt-1.5 truncate">📄 {r.metadata.source}</div>
                  )}
                </Card>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
