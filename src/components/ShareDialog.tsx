/**
 * ShareDialog — 对话分享弹窗
 *
 * 功能：
 * - 生成对话公开分享链接（带自动脱敏）
 * - 一键复制链接
 * - 可设置过期时间（永久 / 7天 / 30天）
 * - 已分享时显示状态 + 取消分享
 * - 查看次数统计
 */

import { useState, useCallback, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Copy, Check, Share2, Trash2, ExternalLink, Eye, Loader2, Link2, Globe, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId: number | null;
  conversationTitle?: string;
}

export function ShareDialog({ open, onOpenChange, conversationId, conversationTitle }: ShareDialogProps) {
  const [copied, setCopied] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState<number>(0);

  // 查询当前分享状态
  const { data: shareStatus, refetch: refetchStatus } = trpc.conversation.getShareStatus.useQuery(
    { conversationId: conversationId! },
    { enabled: open && !!conversationId }
  );

  // 创建分享
  const createShare = trpc.conversation.createShare.useMutation({
    onSuccess: (data) => {
      toast.success('分享链接已生成');
      refetchStatus();
    },
    onError: (err) => {
      toast.error(err.message || '生成分享链接失败');
    },
  });

  // 取消分享
  const deleteShare = trpc.conversation.deleteShare.useMutation({
    onSuccess: () => {
      toast.success('已取消分享');
      refetchStatus();
    },
    onError: (err) => {
      toast.error(err.message || '取消分享失败');
    },
  });

  // 重置状态
  useEffect(() => {
    if (open) setCopied(false);
  }, [open]);

  const shareUrl = shareStatus?.shared
    ? `${window.location.origin}${shareStatus.shareUrl}`
    : null;

  const handleCreate = useCallback(() => {
    if (!conversationId) return;
    createShare.mutate({ conversationId, expiresInDays });
  }, [conversationId, expiresInDays, createShare]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success('链接已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback
      const input = document.createElement('input');
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      toast.success('链接已复制');
      setTimeout(() => setCopied(false), 2000);
    }
  }, [shareUrl]);

  const handleDelete = useCallback(() => {
    if (!conversationId) return;
    deleteShare.mutate({ conversationId });
  }, [conversationId, deleteShare]);

  const handleOpen = useCallback(() => {
    if (shareUrl) window.open(shareUrl, '_blank');
  }, [shareUrl]);

  if (!conversationId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-4.5 h-4.5 text-primary" />
            分享对话
          </DialogTitle>
          <DialogDescription>
            生成公开链接，任何人无需登录即可查看此对话
          </DialogDescription>
        </DialogHeader>

        {shareStatus?.shared ? (
          /* ═══ 已分享状态 ═══ */
          <div className="space-y-4">
            {/* 链接展示 */}
            <div className="flex items-center gap-2 p-3 bg-muted/50 rounded-lg border">
              <Link2 className="w-4 h-4 text-muted-foreground shrink-0" />
              <span className="text-sm text-foreground truncate flex-1 font-mono">{shareUrl}</span>
            </div>

            {/* 操作按钮 */}
            <div className="flex gap-2">
              <Button onClick={handleCopy} className="flex-1" variant={copied ? 'default' : 'outline'}>
                {copied ? <Check className="w-4 h-4 mr-1.5" /> : <Copy className="w-4 h-4 mr-1.5" />}
                {copied ? '已复制' : '复制链接'}
              </Button>
              <Button onClick={handleOpen} variant="outline" size="icon" title="在新窗口打开">
                <ExternalLink className="w-4 h-4" />
              </Button>
            </div>

            {/* 统计信息 */}
            <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
              <span className="flex items-center gap-1">
                <Eye className="w-3 h-3" />
                {shareStatus.viewCount || 0} 次查看
              </span>
              <span>
                创建于 {new Date(shareStatus.createdAt!).toLocaleDateString('zh-CN')}
              </span>
            </div>

            {/* 取消分享 */}
            <Button
              onClick={handleDelete}
              variant="ghost"
              size="sm"
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              disabled={deleteShare.isPending}
            >
              {deleteShare.isPending ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5 mr-1.5" />}
              取消分享
            </Button>
          </div>
        ) : (
          /* ═══ 未分享状态 ═══ */
          <div className="space-y-4">
            {/* 对话标题预览 */}
            <div className="p-3 bg-muted/30 rounded-lg border border-border/50">
              <div className="text-sm font-medium truncate">{conversationTitle || '对话'}</div>
              <div className="text-xs text-muted-foreground mt-1">对话内容将自动脱敏（手机号、邮箱、密码等）</div>
            </div>

            {/* 过期时间 */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">链接有效期</span>
              <Select value={expiresInDays.toString()} onValueChange={(v) => setExpiresInDays(Number(v))}>
                <SelectTrigger className="w-32 h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">永久有效</SelectItem>
                  <SelectItem value="7">7 天</SelectItem>
                  <SelectItem value="30">30 天</SelectItem>
                  <SelectItem value="90">90 天</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 安全提示 */}
            <div className="flex items-start gap-2 p-2.5 bg-blue-50 dark:bg-blue-950/30 rounded-lg text-xs text-blue-700 dark:text-blue-300">
              <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <div className="font-medium">隐私保护</div>
                <div className="mt-0.5 text-blue-600/80 dark:text-blue-400/80">手机号、邮箱、身份证、密码等敏感信息会自动脱敏处理</div>
              </div>
            </div>

            {/* 生成按钮 */}
            <Button onClick={handleCreate} className="w-full" disabled={createShare.isPending}>
              {createShare.isPending ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Globe className="w-4 h-4 mr-1.5" />
              )}
              生成分享链接
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
