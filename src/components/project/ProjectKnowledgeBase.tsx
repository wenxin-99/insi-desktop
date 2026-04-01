/**
 * ProjectKnowledgeBase — 项目知识库面板
 *
 * ★ P1: 在 ProjectDetail 的 "知识库" tab 中展示
 * 支持：添加文本/粘贴内容、查看文件列表、删除文件、token 统计
 */

import { useState, useCallback } from 'react';
import {
  FileText, Plus, Trash2, Loader2, Upload, ClipboardPaste,
  BookOpen, BarChart3, AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/ConfirmDialog';

interface ProjectKnowledgeBaseProps {
  projectId: number;
  canEdit: boolean;
}

const FILE_TYPE_ICONS: Record<string, string> = {
  text: '📝',
  code: '💻',
  paste: '📋',
  pdf: '📄',
  markdown: '📑',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTokens(tokens: number): string {
  if (tokens < 1000) return `${tokens}`;
  if (tokens < 100_000) return `${(tokens / 1000).toFixed(1)}k`;
  return `${(tokens / 1000).toFixed(0)}k`;
}

export function ProjectKnowledgeBase({ projectId, canEdit }: ProjectKnowledgeBaseProps) {
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const { data, isLoading } = trpc.project.getFiles.useQuery({ projectId });
  const addFileMutation = trpc.project.addFile.useMutation({
    onSuccess: () => {
      utils.project.getFiles.invalidate({ projectId });
      toast.success('文件已添加到知识库');
      setShowAdd(false);
      setNewFileName('');
      setNewContent('');
    },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteFileMutation = trpc.project.deleteFile.useMutation({
    onSuccess: () => {
      utils.project.getFiles.invalidate({ projectId });
      toast.success('文件已删除');
    },
    onError: (e: any) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [newFileName, setNewFileName] = useState('');
  const [newContent, setNewContent] = useState('');
  const [newFileType, setNewFileType] = useState('text');

  const handleAdd = useCallback(() => {
    if (!newFileName.trim()) {
      toast.error('请输入文件名');
      return;
    }
    if (!newContent.trim()) {
      toast.error('请输入内容');
      return;
    }
    addFileMutation.mutate({
      projectId,
      fileName: newFileName.trim(),
      fileType: newFileType,
      textContent: newContent,
    });
  }, [projectId, newFileName, newContent, newFileType, addFileMutation]);

  const handleDelete = useCallback(async (fileId: number, fileName: string) => {
    const ok = await confirm({
      title: '删除知识库文件',
      description: `确定要从知识库中删除「${fileName}」吗？此操作不可撤销。`,
      confirmText: '删除',
      cancelText: '取消',
      variant: 'destructive',
    });
    if (ok) deleteFileMutation.mutate({ projectId, fileId });
  }, [projectId, confirm, deleteFileMutation]);

  const handlePaste = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setNewContent(text);
        if (!newFileName) setNewFileName('粘贴内容');
        setNewFileType('paste');
        toast.success(`已粘贴 ${text.length} 个字符`);
      }
    } catch {
      toast.error('无法读取剪贴板，请手动粘贴');
    }
  }, [newFileName]);

  // 读取本地文本文件
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 限制：仅支持文本类文件，最大 2MB
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error('文件过大，最大支持 2MB 的文本文件');
      return;
    }
    const textTypes = [
      'text/', 'application/json', 'application/xml', 'application/javascript',
      'application/typescript', 'application/x-yaml',
    ];
    const isText = textTypes.some(t => file.type.startsWith(t)) ||
      /\.(txt|md|json|xml|yaml|yml|csv|tsv|log|ini|conf|cfg|env|sh|bash|py|js|ts|tsx|jsx|vue|html|css|scss|less|sql|go|rs|java|kt|swift|c|cpp|h|hpp|rb|php|pl|r|lua|zig|toml|prisma)$/i.test(file.name);

    if (!isText) {
      toast.error('仅支持文本类文件（.txt, .md, .json, .csv, .py, .ts 等）');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const text = reader.result as string;
      setNewContent(text);
      setNewFileName(file.name);
      // 推断 fileType
      if (/\.(py|js|ts|tsx|jsx|vue|go|rs|java|kt|swift|c|cpp|h|hpp|rb|php|sql)$/i.test(file.name)) {
        setNewFileType('code');
      } else if (/\.md$/i.test(file.name)) {
        setNewFileType('markdown');
      } else {
        setNewFileType('text');
      }
      toast.success(`已读取 ${file.name}`);
    };
    reader.onerror = () => toast.error('文件读取失败');
    reader.readAsText(file);
    e.target.value = ''; // reset
  }, []);

  const files = data?.files || [];
  const stats = data?.stats || { fileCount: 0, totalTokens: 0 };
  const TOKEN_BUDGET = 80000;
  const usagePercent = Math.min(100, Math.round((stats.totalTokens / TOKEN_BUDGET) * 100));

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 统计卡片 */}
      <div className="flex items-center gap-4 px-1">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <BookOpen className="w-4 h-4" />
          <span>{stats.fileCount} 个文件</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground flex-1">
          <BarChart3 className="w-4 h-4" />
          <span>{formatTokens(stats.totalTokens)} / {formatTokens(TOKEN_BUDGET)} tokens</span>
          <div className="flex-1 h-1.5 bg-muted rounded-full max-w-[120px]">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                usagePercent > 80 ? 'bg-orange-500' : usagePercent > 95 ? 'bg-red-500' : 'bg-primary'
              )}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* 容量告警 */}
      {usagePercent > 80 && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-orange-50 dark:bg-orange-950/20 text-orange-700 dark:text-orange-300 text-xs">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          知识库容量已使用 {usagePercent}%，接近上下文窗口限制。过多内容可能影响 AI 回答质量。
        </div>
      )}

      {/* 添加按钮 */}
      {canEdit && (
        <div className="flex items-center gap-2">
          <Button
            size="sm" variant="outline" className="gap-1.5"
            onClick={() => setShowAdd(!showAdd)}
          >
            <Plus className="w-3.5 h-3.5" />
            {showAdd ? '收起' : '添加内容'}
          </Button>
        </div>
      )}

      {/* 添加面板 */}
      {showAdd && canEdit && (
        <Card className="border-primary/20">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newFileName}
                onChange={(e) => setNewFileName(e.target.value)}
                placeholder="文件名（如：API文档.md、项目规范.txt）"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
              />
              <select
                value={newFileType}
                onChange={(e) => setNewFileType(e.target.value)}
                className="h-9 px-2 text-xs bg-background border rounded-lg"
              >
                <option value="text">文本</option>
                <option value="code">代码</option>
                <option value="markdown">Markdown</option>
                <option value="paste">粘贴</option>
              </select>
            </div>

            <textarea
              value={newContent}
              onChange={(e) => setNewContent(e.target.value)}
              placeholder="在此粘贴或输入文件内容...&#10;&#10;支持：产品文档、API 规范、代码片段、风格指南、会议纪要等任何文本内容"
              rows={8}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
            />

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={handlePaste}>
                  <ClipboardPaste className="w-3.5 h-3.5" />
                  从剪贴板粘贴
                </Button>
                <label className="cursor-pointer">
                  <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.json,.csv,.xml,.yaml,.yml,.py,.js,.ts,.tsx,.jsx,.vue,.html,.css,.sql,.go,.rs,.java,.rb,.php,.log,.conf,.cfg,.env,.sh" />
                  <Button variant="ghost" size="sm" className="gap-1.5 text-xs pointer-events-none">
                    <Upload className="w-3.5 h-3.5" />
                    上传文本文件
                  </Button>
                </label>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {newContent.length > 0 && `${newContent.length} 字符 ≈ ${formatTokens(Math.ceil(newContent.length / 2))} tokens`}
                </span>
                <Button
                  size="sm" onClick={handleAdd}
                  disabled={addFileMutation.isPending || !newContent.trim()}
                  className="gap-1.5"
                >
                  {addFileMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                  添加
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* 文件列表 */}
      {files.length > 0 ? (
        <div className="space-y-1.5">
          {files.map((f: any) => (
            <div
              key={f.id}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg border bg-card hover:bg-muted/30 group transition-colors"
            >
              <span className="text-base shrink-0">{FILE_TYPE_ICONS[f.fileType] || '📄'}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{f.fileName}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatFileSize(f.fileSize)} · ~{formatTokens(f.tokenEstimate)} tokens ·{' '}
                  {new Date(f.createdAt).toLocaleDateString('zh-CN')}
                </p>
              </div>
              {canEdit && (
                <button
                  onClick={() => handleDelete(f.id, f.fileName)}
                  className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-red-50 dark:hover:bg-red-950/30 text-muted-foreground hover:text-red-500 transition-all"
                  title="删除"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-10 text-muted-foreground">
          <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">知识库还没有文件</p>
          <p className="text-xs mt-1">
            添加文档、代码、规范等内容，AI 会在项目对话中自动引用
          </p>
        </div>
      )}
    </div>
  );
}
