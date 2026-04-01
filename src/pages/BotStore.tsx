/**
 * BotStore — 自定义 Bot 管理 & 商店
 *
 * 两个标签页：
 * - 我的 Bot：创建、编辑、删除、发布/取消发布
 * - Bot 商店：浏览公开 Bot、搜索、使用
 *
 * 使用 Bot：点击后跳转到聊天页，注入 Bot 的 systemPrompt
 */
import { useState, useCallback } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import DashboardLayout from '@/components/DashboardLayout';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import {
  Plus, Search, Bot, Pencil, Trash2, Globe, Lock, MessageCircle,
  Heart, Loader2, Sparkles, ArrowRight, Users, Zap,
  Share2, History, BarChart3, Copy, Check, Star,
} from 'lucide-react';

// ═══════ Bot 卡片组件 ═══════

function BotCard({
  bot,
  isOwner,
  onEdit,
  onDelete,
  onUse,
  onShare,
  onVersions,
  onAnalytics,
}: {
  bot: any;
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onUse: () => void;
  onShare?: () => void;
  onVersions?: () => void;
  onAnalytics?: () => void;
}) {
  return (
    <Card className="group relative overflow-hidden hover:shadow-md transition-all duration-200 hover:border-primary/30">
      <div className="p-4">
        {/* 头部：头像 + 名称 */}
        <div className="flex items-start gap-3 mb-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-xl shrink-0 border border-primary/10">
            {bot.avatar || '🤖'}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-sm truncate">{bot.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2 leading-relaxed">
              {bot.description || '暂无描述'}
            </p>
          </div>
        </div>

        {/* 统计 */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mb-3">
          <span className="flex items-center gap-1">
            <MessageCircle className="w-3 h-3" />{bot.usageCount || 0} 次使用
          </span>
          <span className="flex items-center gap-1">
            <Heart className="w-3 h-3" />{bot.likeCount || 0}
          </span>
          {bot.isPublic ? (
            <span className="flex items-center gap-1 text-green-600"><Globe className="w-3 h-3" />公开</span>
          ) : (
            <span className="flex items-center gap-1"><Lock className="w-3 h-3" />私有</span>
          )}
          {bot.modelPackageId && (
            <span className="flex items-center gap-1 text-blue-600">⚡ 指定模型</span>
          )}
        </div>

        {/* 开场消息预览 */}
        {bot.starterMessages?.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-3">
            {bot.starterMessages.slice(0, 2).map((msg: string, i: number) => (
              <span key={i} className="text-[10px] px-2 py-0.5 bg-muted rounded-full truncate max-w-[140px]">
                {msg}
              </span>
            ))}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-8 text-xs" onClick={onUse}>
            <Zap className="w-3 h-3 mr-1" />使用
          </Button>
          {isOwner && (
            <>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onEdit} title="编辑">
                <Pencil className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onShare} title="分享">
                <Share2 className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onVersions} title="版本">
                <History className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={onAnalytics} title="统计">
                <BarChart3 className="w-3 h-3" />
              </Button>
              <Button size="sm" variant="outline" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={onDelete} title="删除">
                <Trash2 className="w-3 h-3" />
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

// ═══════ 创建/编辑弹窗 ═══════

function BotEditorDialog({
  open,
  onOpenChange,
  bot,
  onSave,
  isPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  bot: any | null; // null = 新建
  onSave: (data: any) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState(bot?.name || '');
  const [avatar, setAvatar] = useState(bot?.avatar || '🤖');
  const [description, setDescription] = useState(bot?.description || '');
  const [systemPrompt, setSystemPrompt] = useState(bot?.systemPrompt || '');
  const [starterMessages, setStarterMessages] = useState<string[]>(bot?.starterMessages || ['']);
  const [isPublic, setIsPublic] = useState(bot?.isPublic || false);
  const [category, setCategory] = useState(bot?.category || '');
  const [modelPackageId, setModelPackageId] = useState<number | null>(bot?.modelPackageId || null);
  const [webSearch, setWebSearch] = useState(bot?.toolConfig?.enableWebSearch ?? true);
  const [imageGen, setImageGen] = useState(bot?.toolConfig?.enableImageGen ?? false);
  const [codeRun, setCodeRun] = useState(bot?.toolConfig?.enableCodeRun ?? true);

  const EMOJI_OPTIONS = ['🤖', '🧠', '📚', '✍️', '🎨', '💻', '📊', '🔬', '🎯', '💡', '🌐', '🎓', '⚡', '🛠️', '🎭', '📝'];

  const handleSubmit = () => {
    if (!name.trim()) { toast.error('请输入 Bot 名称'); return; }
    if (!systemPrompt.trim()) { toast.error('请输入 System Prompt'); return; }
    onSave({
      ...(bot ? { id: bot.id } : {}),
      name: name.trim(),
      avatar,
      description: description.trim(),
      systemPrompt: systemPrompt.trim(),
      starterMessages: starterMessages.filter(m => m.trim()),
      isPublic,
      category: category.trim() || undefined,
      modelPackageId: modelPackageId || undefined,
      toolConfig: {
        enableWebSearch: webSearch,
        enableImageGen: imageGen,
        enableCodeRun: codeRun,
        enableFileUpload: true,
        enableRichComponents: true,
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-primary" />
            {bot ? '编辑 Bot' : '创建 Bot'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          {/* 头像选择 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">头像</label>
            <div className="flex flex-wrap gap-1.5">
              {EMOJI_OPTIONS.map(e => (
                <button key={e} onClick={() => setAvatar(e)}
                  className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${avatar === e ? 'bg-primary/15 ring-2 ring-primary scale-110' : 'bg-muted hover:bg-muted/80'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>

          {/* 名称 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">名称 *</label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="例：代码审查助手" maxLength={50} />
          </div>

          {/* 描述 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">描述</label>
            <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="一句话描述 Bot 的用途" maxLength={500} />
          </div>

          {/* System Prompt */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">System Prompt *</label>
            <Textarea value={systemPrompt} onChange={e => setSystemPrompt(e.target.value)}
              placeholder={"你是一个专业的代码审查助手。\\n\\n你的职责：\\n- 审查代码质量\\n- 发现潜在 bug\\n- 给出改进建议"}
              className="min-h-[120px] font-mono text-sm" maxLength={10000} />
            <div className="text-[11px] text-muted-foreground mt-1 text-right">{systemPrompt.length}/10000</div>
          </div>

          {/* 开场消息 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">开场引导（可选）</label>
            {starterMessages.map((msg, i) => (
              <div key={i} className="flex gap-2 mb-1.5">
                <Input value={msg} onChange={e => {
                  const next = [...starterMessages];
                  next[i] = e.target.value;
                  setStarterMessages(next);
                }} placeholder={`引导消息 ${i + 1}`} maxLength={200} className="text-sm" />
                {starterMessages.length > 1 && (
                  <Button size="sm" variant="ghost" className="h-9 w-9 p-0 text-muted-foreground"
                    onClick={() => setStarterMessages(starterMessages.filter((_, j) => j !== i))}>×</Button>
                )}
              </div>
            ))}
            {starterMessages.length < 4 && (
              <Button size="sm" variant="ghost" className="text-xs" onClick={() => setStarterMessages([...starterMessages, ''])}>
                <Plus className="w-3 h-3 mr-1" />添加引导
              </Button>
            )}
          </div>

          {/* 工具开关 */}
          <div>
            <label className="text-sm font-medium mb-2 block">可用工具</label>
            <div className="space-y-2">
              {[
                { label: '联网搜索', value: webSearch, set: setWebSearch },
                { label: '图片生成', value: imageGen, set: setImageGen },
                { label: '代码执行', value: codeRun, set: setCodeRun },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1">
                  <span className="text-sm">{item.label}</span>
                  <Switch checked={item.value} onCheckedChange={item.set} />
                </div>
              ))}
            </div>
          </div>

          {/* 模型套餐 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">指定模型（可选）</label>
            <select
              value={modelPackageId || ''}
              onChange={e => setModelPackageId(e.target.value ? Number(e.target.value) : null)}
              className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
            >
              <option value="">跟随用户当前套餐</option>
            </select>
            <p className="text-[11px] text-muted-foreground mt-1">不选则使用用户自己的模型套餐</p>
          </div>

          {/* 分类 */}
          <div>
            <label className="text-sm font-medium mb-1.5 block">分类标签（可选）</label>
            <Input value={category} onChange={e => setCategory(e.target.value)} placeholder="例：编程、写作、学习" maxLength={50} />
          </div>

          {/* 公开开关 */}
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg border">
            <div>
              <div className="text-sm font-medium flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5" />发布到 Bot 商店
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">其他用户可以发现并使用</div>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>

          {/* 提交 */}
          <Button onClick={handleSubmit} className="w-full" disabled={isPending}>
            {isPending ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
            {bot ? '保存修改' : '创建 Bot'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ═══════ 主页面 ═══════

export default function BotStore() {
  const [, navigate] = useLocation();
  const [tab, setTab] = useState<'my' | 'store'>('my');
  const [search, setSearch] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBot, setEditingBot] = useState<any | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [shareDialogBot, setShareDialogBot] = useState<any | null>(null);
  const [shareToken, setShareToken] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [versionBot, setVersionBot] = useState<any | null>(null);
  const [analyticsBot, setAnalyticsBot] = useState<any | null>(null);

  // 数据查询
  const { data: myBots, refetch: refetchMyBots } = trpc.customBot.myBots.useQuery(undefined, { enabled: tab === 'my' });
  // P2 查询
  const { data: featuredBots } = trpc.customBot.featured.useQuery(undefined, { enabled: tab === 'store' });
  const { data: categories } = trpc.customBot.categories.useQuery(undefined, { enabled: tab === 'store' });
  const { data: myLikes } = trpc.customBot.myLikes.useQuery();
  const likedSet = new Set(myLikes || []);

  // P3 查询（按需）
  const { data: botVersions } = trpc.customBot.versions.useQuery(
    { botId: versionBot?.id! }, { enabled: !!versionBot }
  );
  const { data: botAnalytics } = trpc.customBot.analyticsSummary.useQuery(
    { botId: analyticsBot?.id! }, { enabled: !!analyticsBot }
  );
  const { data: botDailyStats } = trpc.customBot.analyticsDaily.useQuery(
    { botId: analyticsBot?.id!, days: 30 }, { enabled: !!analyticsBot }
  );

    const { data: storeData, refetch: refetchStore } = trpc.customBot.store.useQuery(
    { search: search || undefined, sort: 'popular', pageSize: 30, category: selectedCategory || undefined },
    { enabled: tab === 'store' }
  );

  // 变更操作
  // P2 mutations
  const likeMut = trpc.customBot.toggleLikeV2.useMutation({
    onSuccess: () => { refetchStore(); },
  });
  const shareMut = trpc.customBot.shareBot.useMutation({
    onSuccess: (data) => {
      setShareToken(data.token);
    },
  });
  // P3 mutations
  const saveVersionMut = trpc.customBot.saveVersion.useMutation({
    onSuccess: () => { toast.success('版本已保存'); },
  });
  const rollbackMut = trpc.customBot.rollback.useMutation({
    onSuccess: (data) => {
      toast.success(`已回滚到版本 ${data.restoredVersion}`);
      refetchMyBots();
      setVersionBot(null);
    },
  });

    const createMut = trpc.customBot.create.useMutation({
    onSuccess: () => { toast.success('Bot 创建成功'); setEditorOpen(false); refetchMyBots(); },
    onError: (e) => toast.error(e.message),
  });
  const updateMut = trpc.customBot.update.useMutation({
    onSuccess: () => { toast.success('Bot 已更新'); setEditorOpen(false); refetchMyBots(); },
    onError: (e) => toast.error(e.message),
  });
  const deleteMut = trpc.customBot.delete.useMutation({
    onSuccess: () => { toast.success('Bot 已删除'); refetchMyBots(); },
    onError: (e) => toast.error(e.message),
  });
  const useMut = trpc.customBot.use.useMutation();

  const handleSave = useCallback((data: any) => {
    if (data.id) {
      updateMut.mutate(data);
    } else {
      createMut.mutate(data);
    }
  }, [createMut, updateMut]);

  const handleUse = useCallback(async (botId: number) => {
    try {
      const result = await useMut.mutateAsync({ botId });
      // 跳转到聊天页，通过 URL 参数传递 botId
      // 聊天页需要读取 botId 并注入 systemPrompt
      navigate(`/chat?botId=${botId}`);
      toast.success(`已切换到 ${result.name}`);
    } catch (e: any) {
      toast.error(e.message || '使用 Bot 失败');
    }
  }, [useMut, navigate]);

  const handleDelete = useCallback((botId: number, botName: string) => {
    if (confirm(`确定删除 "${botName}"？此操作不可撤销。`)) {
      deleteMut.mutate({ id: botId });
    }
  }, [deleteMut]);

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Bot className="w-5 h-5 text-primary" />Bot 工坊
            </h1>
            <p className="text-sm text-muted-foreground mt-1">创建和发现自定义 AI 助手</p>
          </div>
          <Button onClick={() => { setEditingBot(null); setEditorOpen(true); }}>
            <Plus className="w-4 h-4 mr-1.5" />创建 Bot
          </Button>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit mb-6">
          {[
            { key: 'my' as const, label: '我的 Bot', icon: Lock },
            { key: 'store' as const, label: 'Bot 商店', icon: Users },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tab === t.key ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <t.icon className="w-3.5 h-3.5" />{t.label}
            </button>
          ))}
        </div>

        {/* 商店搜索框 */}
        {tab === 'store' && (
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="搜索 Bot..."
                className="pl-9 h-9"
              />
            </div>
            {/* P2: 分类导航 */}
            {categories && categories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${!selectedCategory ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                >全部</button>
                {categories.map((cat: any) => (
                  <button
                    key={cat.category}
                    onClick={() => setSelectedCategory(cat.category)}
                    className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${selectedCategory === cat.category ? 'bg-primary text-primary-foreground' : 'bg-muted hover:bg-muted/80 text-muted-foreground'}`}
                  >{cat.category} ({cat.count})</button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* P2: 精选推荐 */}
        {tab === 'store' && featuredBots && featuredBots.length > 0 && !search && !selectedCategory && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Star className="w-4 h-4 text-amber-500" />精选推荐</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {featuredBots.map((bot: any) => (
                <BotCard key={bot.id} bot={bot} isOwner={false} onUse={() => handleUse(bot.id)} />
              ))}
            </div>
          </div>
        )}

        {/* Bot 网格 */}
        {tab === 'my' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 创建新 Bot 卡片 */}
            <Card
              className="border-dashed hover:border-primary/40 hover:bg-primary/5 transition-all cursor-pointer flex items-center justify-center min-h-[180px]"
              onClick={() => { setEditingBot(null); setEditorOpen(true); }}
            >
              <div className="text-center text-muted-foreground">
                <Plus className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <div className="text-sm">创建新 Bot</div>
              </div>
            </Card>

            {(myBots || []).map((bot: any) => (
              <BotCard
                key={bot.id}
                bot={bot}
                isOwner
                onEdit={() => { setEditingBot(bot); setEditorOpen(true); }}
                onDelete={() => handleDelete(bot.id, bot.name)}
                onUse={() => handleUse(bot.id)}
                onShare={() => { setShareDialogBot(bot); shareMut.mutate({ botId: bot.id }); }}
                onVersions={() => setVersionBot(bot)}
                onAnalytics={() => setAnalyticsBot(bot)}
              />
            ))}
          </div>
        )}

        {tab === 'store' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(storeData?.bots || []).map((bot: any) => (
              <BotCard key={bot.id} bot={bot} isOwner={false} onUse={() => handleUse(bot.id)} />
            ))}
            {storeData?.bots?.length === 0 && (
              <div className="col-span-full py-16 text-center text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">{search ? '没有找到匹配的 Bot' : '暂无公开 Bot'}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* P2: 分享弹窗 */}
      {shareDialogBot && (
        <Dialog open={!!shareDialogBot} onOpenChange={() => { setShareDialogBot(null); setShareCopied(false); }}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><Share2 className="w-4 h-4" />分享 Bot</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <p className="text-sm text-muted-foreground">分享链接给其他人，他们可以直接体验你的 Bot</p>
              {shareToken && (
                <div className="flex gap-2">
                  <Input value={`${window.location.origin}/bot/share/${shareToken}`} readOnly className="text-sm font-mono" />
                  <Button size="sm" variant="outline" onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/bot/share/${shareToken}`);
                    setShareCopied(true);
                    setTimeout(() => setShareCopied(false), 2000);
                  }}>
                    {shareCopied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* P3: 版本历史弹窗 */}
      {versionBot && (
        <Dialog open={!!versionBot} onOpenChange={() => setVersionBot(null)}>
          <DialogContent className="sm:max-w-lg max-h-[70vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><History className="w-4 h-4" />{versionBot.name} — 版本历史</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 mt-2">
              <Button size="sm" variant="outline" onClick={() => saveVersionMut.mutate({ botId: versionBot.id, changeNote: '手动保存' })} disabled={saveVersionMut.isPending}>
                <Plus className="w-3 h-3 mr-1" />保存当前版本
              </Button>
              {botVersions && botVersions.length > 0 ? (
                botVersions.map((v: any) => (
                  <div key={v.id} className="p-3 rounded-lg border text-sm flex items-center justify-between">
                    <div>
                      <span className="font-medium">v{v.version}</span>
                      <span className="text-muted-foreground ml-2">{v.changeNote || '无备注'}</span>
                      <div className="text-xs text-muted-foreground mt-0.5">{new Date(v.createdAt).toLocaleString()}</div>
                    </div>
                    <Button size="sm" variant="ghost" className="text-xs" onClick={() => {
                      if (confirm(`确定回滚到 v${v.version}？当前配置将被覆盖。`)) {
                        rollbackMut.mutate({ botId: versionBot.id, versionId: v.id });
                      }
                    }}>回滚</Button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">暂无历史版本</p>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* P3: 统计弹窗 */}
      {analyticsBot && (
        <Dialog open={!!analyticsBot} onOpenChange={() => setAnalyticsBot(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><BarChart3 className="w-4 h-4" />{analyticsBot.name} — 使用统计</DialogTitle>
            </DialogHeader>
            <div className="mt-2">
              {botAnalytics && (
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-2xl font-bold">{botAnalytics.totalMessages}</div>
                    <div className="text-xs text-muted-foreground">总消息数</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-2xl font-bold">{botAnalytics.last7Days}</div>
                    <div className="text-xs text-muted-foreground">近7天</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-2xl font-bold">{botAnalytics.last30Days}</div>
                    <div className="text-xs text-muted-foreground">近30天</div>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/50 text-center">
                    <div className="text-2xl font-bold">{analyticsBot.likeCount || 0}</div>
                    <div className="text-xs text-muted-foreground">点赞数</div>
                  </div>
                </div>
              )}
              {botDailyStats && botDailyStats.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2">每日趋势（近30天）</h4>
                  <div className="flex items-end gap-[2px] h-24">
                    {botDailyStats.map((day: any, i: number) => {
                      const max = Math.max(...botDailyStats.map((d: any) => d.messageCount || 1));
                      const height = Math.max(4, ((day.messageCount || 0) / max) * 100);
                      return (
                        <div key={i} className="flex-1 bg-primary/60 rounded-t-sm hover:bg-primary transition-colors"
                          style={{ height: `${height}%` }}
                          title={`${day.usageDate}: ${day.messageCount} 条消息`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                    <span>{botDailyStats[0]?.usageDate}</span>
                    <span>{botDailyStats[botDailyStats.length - 1]?.usageDate}</span>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* 编辑弹窗 */}
      <BotEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        bot={editingBot}
        onSave={handleSave}
        isPending={createMut.isPending || updateMut.isPending}
      />
    </DashboardLayout>
  );
}
