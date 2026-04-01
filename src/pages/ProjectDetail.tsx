/**
 * ProjectDetail — 项目详情页
 *
 * 展示项目内的对话列表 + 自定义指令编辑 + 项目设置
 * 通过 tabs 切换：对话 | 指令 | 设置
 */

import { useState, useCallback, useEffect } from 'react';
import { useRoute, useLocation } from 'wouter';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  ArrowLeft, MessageSquare, Sparkles, Settings, Plus,
  Trash2, Loader2, Save, Check, FolderOpen, Clock,
  ExternalLink, X, Users, BookOpen,
} from 'lucide-react';
import { toast } from 'sonner';
import { useConfirm } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/lib/formatTimestamp';
import { ProjectMembers } from '@/components/project/ProjectMembers';
import { ProjectKnowledgeBase } from '@/components/project/ProjectKnowledgeBase';

const PROJECT_COLORS = [
  '#3b82f6', '#8b5cf6', '#ec4899', '#f97316',
  '#10b981', '#06b6d4', '#f59e0b', '#6366f1',
  '#ef4444', '#14b8a6', '#a855f7', '#64748b',
];

type TabId = 'chats' | 'knowledge' | 'instructions' | 'members' | 'settings';

export default function ProjectDetail() {
  const [, params] = useRoute('/projects/:id');
  const [location, setLocation] = useLocation();
  const confirm = useConfirm();
  const projectId = params?.id ? parseInt(params.id, 10) : null;
  const utils = trpc.useUtils();

  // 从 URL query 读取初始 tab
  const urlTab = new URLSearchParams(location.split('?')[1] || '').get('tab');
  const [activeTab, setActiveTab] = useState<TabId>((urlTab as TabId) || 'chats');

  const { data: project, isLoading } = trpc.project.get.useQuery(
    { id: projectId! },
    { enabled: !!projectId }
  );
  const { data: allConversations } = trpc.conversation.getAll.useQuery();

  const updateMutation = trpc.project.update.useMutation({
    onSuccess: () => { utils.project.get.invalidate({ id: projectId! }); utils.project.list.invalidate(); toast.success('已保存'); },
    onError: (e: any) => toast.error(e.message),
  });
  const addChatMutation = trpc.project.addChat.useMutation({
    onSuccess: () => { utils.project.get.invalidate({ id: projectId! }); utils.project.list.invalidate(); utils.conversation.getAll.invalidate(); toast.success('对话已添加到项目'); },
    onError: (e: any) => toast.error(e.message),
  });
  const removeChatMutation = trpc.project.removeChat.useMutation({
    onSuccess: () => { utils.project.get.invalidate({ id: projectId! }); utils.project.list.invalidate(); utils.conversation.getAll.invalidate(); toast.success('对话已移出项目'); },
    onError: (e: any) => toast.error(e.message),
  });
  const deleteMutation = trpc.project.delete.useMutation({
    onSuccess: () => { utils.project.list.invalidate(); setLocation('/projects'); toast.success('项目已删除'); },
    onError: (e: any) => toast.error(e.message),
  });

  // 编辑状态
  const [instructions, setInstructions] = useState('');
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editColor, setEditColor] = useState('#3b82f6');
  const [showAddChat, setShowAddChat] = useState(false);

  useEffect(() => {
    if (project) {
      setInstructions(project.instructions || '');
      setEditName(project.name);
      setEditDesc(project.description || '');
      setEditColor(project.color);
    }
  }, [project]);

  const saveInstructions = useCallback(() => {
    if (!projectId) return;
    updateMutation.mutate({ id: projectId, instructions: instructions.trim() || undefined });
  }, [projectId, instructions, updateMutation]);

  const saveSettings = useCallback(() => {
    if (!projectId || !editName.trim()) { toast.error('项目名称不能为空'); return; }
    updateMutation.mutate({
      id: projectId,
      name: editName.trim(),
      description: editDesc.trim() || undefined,
      color: editColor,
    });
  }, [projectId, editName, editDesc, editColor, updateMutation]);

  const handleDelete = useCallback(async () => {
    if (!projectId) return;
    const ok = await confirm({
      title: '删除项目',
      description: '确定要删除这个项目吗？项目内的对话不会被删除。',
      confirmText: '删除',
      cancelText: '取消',
      variant: 'destructive',
    });
    if (ok) deleteMutation.mutate({ id: projectId });
  }, [projectId, confirm, deleteMutation]);

  // 可添加的对话（不在此项目内的）
  const availableConversations = allConversations?.filter(
    (c: any) => !c.projectId || c.projectId !== projectId
  ) || [];

  if (!projectId) return null;

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  if (!project) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-muted-foreground mb-4">项目不存在</p>
          <Button variant="outline" onClick={() => setLocation('/projects')}>返回项目列表</Button>
        </div>
      </DashboardLayout>
    );
  }

  const TABS: Array<{ id: TabId; label: string; icon: any }> = [
    { id: 'chats', label: '对话', icon: MessageSquare },
    { id: 'knowledge', label: '知识库', icon: BookOpen },
    { id: 'instructions', label: '自定义指令', icon: Sparkles },
    { id: 'members', label: '成员', icon: Users },
    { id: 'settings', label: '设置', icon: Settings },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-4xl mx-auto py-6 px-4">
        {/* 头部 */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => setLocation('/projects')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ backgroundColor: project.color + '15', color: project.color }}
          >
            <FolderOpen className="w-5 h-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold truncate">{project.name}</h1>
            {project.description && (
              <p className="text-sm text-muted-foreground truncate">{project.description}</p>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-border">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                activeTab === tab.id
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'chats' && project.conversations && (
                <span className="ml-1 text-xs px-1.5 py-0.5 rounded-full bg-muted">
                  {project.conversations.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ═══ 对话 Tab ═══ */}
        {activeTab === 'chats' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                项目内的对话会自动继承项目的自定义指令
              </p>
              <div className="flex items-center gap-2">
                {/* ★ P0: 在此项目中新建对话 */}
                <Button size="sm" className="gap-1.5"
                  onClick={() => setLocation(`/chat?project=${projectId}`)}
                >
                  <Plus className="w-3.5 h-3.5" />
                  新建对话
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setShowAddChat(!showAddChat)}>
                  {showAddChat ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
                  {showAddChat ? '完成' : '添加已有对话'}
                </Button>
              </div>
            </div>

            {/* 添加对话面板 */}
            {showAddChat && (
              <Card className="border-primary/20">
                <CardContent className="p-3 max-h-[300px] overflow-y-auto space-y-1">
                  {availableConversations.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">没有可添加的对话</p>
                  ) : (
                    availableConversations.slice(0, 30).map((conv: any) => (
                      <div
                        key={conv.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-accent cursor-pointer transition-colors"
                        onClick={() => addChatMutation.mutate({ projectId: projectId!, conversationId: conv.id })}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm truncate">{conv.title || '未命名对话'}</p>
                          <p className="text-xs text-muted-foreground">
                            {conv.updatedAt ? formatRelativeTime(new Date(conv.updatedAt).getTime()) : ''}
                          </p>
                        </div>
                        <Plus className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            )}

            {/* 项目内对话列表 */}
            {project.conversations && project.conversations.length > 0 ? (
              <div className="space-y-1">
                {project.conversations.map((conv: any) => (
                  <div
                    key={conv.id}
                    className="flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-accent group cursor-pointer transition-colors"
                    onClick={() => setLocation(`/chat?conversation=${conv.id}`)}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{conv.title || '未命名对话'}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {conv.updatedAt ? formatRelativeTime(new Date(conv.updatedAt).getTime()) : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0"
                        onClick={(e) => { e.stopPropagation(); setLocation(`/chat?conversation=${conv.id}`); }}
                        title="打开对话"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </Button>
                      <Button
                        variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                        onClick={(e) => { e.stopPropagation(); removeChatMutation.mutate({ conversationId: conv.id }); }}
                        title="移出项目"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : !showAddChat && (
              <div className="text-center py-12 text-muted-foreground">
                <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">项目内还没有对话</p>
                <p className="text-xs mt-1">点击「新建对话」直接开始，或「添加已有对话」将现有对话归入此项目</p>
              </div>
            )}
          </div>
        )}

        {/* ═══ 知识库 Tab ═══ */}
        {activeTab === 'knowledge' && project && (
          <ProjectKnowledgeBase
            projectId={projectId!}
            canEdit={['owner', 'editor'].includes((project as any).myRole || '')}
          />
        )}

        {/* ═══ 自定义指令 Tab ═══ */}
        {activeTab === 'instructions' && (
          <div className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground mb-3">
                在此编写项目专属指令，项目内所有对话的 AI 都会遵循这些指令。
                例如："使用 TypeScript，回答用中文，代码风格使用 Prettier 格式"。
              </p>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                placeholder="例如：你是一个 React 前端开发助手。请用 TypeScript 编写代码，使用函数式组件和 Hooks。回答用中文。"
                rows={10}
                className="w-full px-4 py-3 rounded-xl border border-border bg-background text-sm leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-primary/50 font-mono"
              />
              <div className="flex items-center justify-between mt-3">
                <span className="text-xs text-muted-foreground">
                  {instructions.length} / 5000 字符
                </span>
                <Button
                  size="sm"
                  onClick={saveInstructions}
                  disabled={updateMutation.isPending}
                  className="gap-1.5"
                >
                  {updateMutation.isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  保存指令
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ═══ 成员 Tab ═══ */}
        {activeTab === 'members' && project && (
          <ProjectMembers
            projectId={projectId!}
            myRole={(project as any).myRole || (project.userId === undefined ? 'viewer' : 'owner')}
          />
        )}

        {/* ═══ 设置 Tab ═══ */}
        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="space-y-3">
              <label className="text-sm font-medium">项目名称</label>
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium">描述</label>
              <textarea
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                rows={3}
                placeholder="简短描述项目内容"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              />
            </div>
            <div className="space-y-3">
              <label className="text-sm font-medium">颜色</label>
              <div className="flex gap-2">
                {PROJECT_COLORS.map((c) => (
                  <button
                    key={c}
                    onClick={() => setEditColor(c)}
                    className={cn('w-7 h-7 rounded-full transition-transform', editColor === c && 'ring-2 ring-offset-2 ring-primary scale-110')}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3 pt-3 border-t border-border">
              <Button onClick={saveSettings} disabled={updateMutation.isPending} className="gap-1.5">
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                保存设置
              </Button>
              <div className="flex-1" />
              <Button variant="destructive" size="sm" onClick={handleDelete} className="gap-1.5">
                <Trash2 className="w-3.5 h-3.5" />
                删除项目
              </Button>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
