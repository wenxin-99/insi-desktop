/**
 * Projects — 项目空间列表页
 *
 * 卡片式展示用户的所有项目，支持：
 * - 创建新项目
 * - 查看项目内对话数量
 * - 编辑项目名称/描述/指令/颜色
 * - 删除项目
 * - 点击进入项目详情
 */

import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Plus, Folder, FolderOpen, MessageSquare, Settings,
  Trash2, Loader2, Pencil, ChevronRight, Sparkles,
  FileText, Users,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';

const PROJECT_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316',
  '#10b981', '#06b6d4', '#f59e0b', '#6366f1',
  '#ef4444', '#14b8a6', '#a855f7', '#64748b',
];

export default function Projects() {
  const [, setLocation] = useLocation();
  const confirm = useConfirm();
  const utils = trpc.useUtils();

  const { data: projects, isLoading } = trpc.project.list.useQuery();
  const createMutation = trpc.project.create.useMutation({
    onSuccess: () => { utils.project.list.invalidate(); toast.success('项目已创建'); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => { utils.project.list.invalidate(); toast.success('项目已删除'); },
    onError: (e) => toast.error(e.message),
  });

  // 创建对话框
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newColor, setNewColor] = useState('#3b82f6');

  const handleCreate = useCallback(() => {
    if (!newName.trim()) { toast.error('请输入项目名称'); return; }
    createMutation.mutate({ name: newName.trim(), description: newDesc.trim() || undefined, color: newColor });
    setShowCreate(false);
    setNewName('');
    setNewDesc('');
    setNewColor('#3b82f6');
  }, [newName, newDesc, newColor, createMutation]);

  const handleDelete = useCallback(async (id: number, name: string) => {
    const ok = await confirm({
      title: '删除项目',
      description: `确定要删除项目「${name}」吗？项目内的对话不会被删除，只是解除归属关系。`,
      confirmText: '删除',
      cancelText: '取消',
      variant: 'destructive',
    });
    if (ok) deleteMutation.mutate({ id });
  }, [confirm, deleteMutation]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto py-6 px-4">
        {/* 头部 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">项目空间</h1>
            <p className="text-sm text-muted-foreground mt-1">
              将相关对话、文件和指令组织到一个项目中，AI 会自动继承项目上下文
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-1.5">
            <Plus className="w-4 h-4" />
            新建项目
          </Button>
        </div>

        {/* 创建面板 */}
        {showCreate && (
          <Card className="mb-6 border-primary/30">
            <CardContent className="p-4 space-y-3">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="项目名称"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setShowCreate(false); }}
              />
              <textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder="项目描述（可选）"
                rows={2}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">颜色</span>
                <div className="flex gap-1">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      onClick={() => setNewColor(c)}
                      className={cn('w-5 h-5 rounded-full transition-transform', newColor === c && 'ring-2 ring-offset-2 ring-primary scale-110')}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="ghost" size="sm" onClick={() => setShowCreate(false)}>取消</Button>
                <Button size="sm" onClick={handleCreate} disabled={createMutation.isPending}>
                  {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
                  创建
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* 加载状态 */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* 空状态 */}
        {!isLoading && (!projects || projects.length === 0) && !showCreate && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-primary/5 flex items-center justify-center mb-4">
              <Folder className="w-8 h-8 text-primary/40" />
            </div>
            <h3 className="text-lg font-semibold mb-1">还没有项目</h3>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              创建项目来组织相关的对话。项目内的对话会共享自定义指令，AI 会记住项目上下文。
            </p>
            <Button onClick={() => setShowCreate(true)} variant="outline" className="gap-1.5">
              <Plus className="w-4 h-4" />
              创建第一个项目
            </Button>
          </div>
        )}

        {/* 项目卡片网格 */}
        {projects && projects.length > 0 && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <Card
                key={project.id}
                className="group cursor-pointer hover:shadow-md hover:border-primary/20 transition-all duration-200"
                onClick={() => setLocation(`/projects/${project.id}`)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                        style={{ backgroundColor: project.color + '15', color: project.color }}
                      >
                        <FolderOpen className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm truncate group-hover:text-primary transition-colors">
                          {project.name}
                        </h3>
                        {project.description && (
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {project.description}
                          </p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary/50 transition-colors shrink-0 mt-1" />
                  </div>

                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {project.chatCount} 个对话
                    </span>
                    {(project as any).memberCount > 1 && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-blue-500/80 bg-blue-50 dark:bg-blue-950/30 px-1.5 py-0.5 rounded-full">
                      <Users className="w-3 h-3" />
                      {(project as any).memberCount} 人协作
                    </span>
                    )}
                    {project.instructions && (
                      <span className="flex items-center gap-1">
                        <Sparkles className="w-3 h-3" />
                        自定义指令
                      </span>
                    )}
                  </div>

                  {/* 操作按钮（悬停显示） */}
                  <div className="flex items-center gap-1 mt-3 pt-3 border-t border-border/50 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 text-xs gap-1 text-muted-foreground"
                      onClick={(e) => { e.stopPropagation(); setLocation(`/projects/${project.id}?tab=settings`); }}
                    >
                      <Settings className="w-3 h-3" />
                      设置
                    </Button>
                    <div className="flex-1" />
                    <Button
                      variant="ghost" size="sm"
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                      onClick={(e) => { e.stopPropagation(); handleDelete(project.id, project.name); }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
