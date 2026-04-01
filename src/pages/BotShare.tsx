/**
 * BotShare — Bot 公开分享页
 * 路由: /bot/share/:token
 * 未登录可查看 Bot 信息，登录后可直接使用
 */
import { useRoute, useLocation } from 'wouter';
import { trpc } from '@/lib/trpc';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Bot, MessageCircle, Heart, Zap, ArrowLeft, Loader2, Globe } from 'lucide-react';


function safeParseArray(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (!val) return [];
  try { const p = JSON.parse(val); return Array.isArray(p) ? p : []; } catch { return []; }
}

export default function BotShare() {
  const [, params] = useRoute('/bot/share/:token');
  const [, navigate] = useLocation();
  const token = params?.token || '';

  const { data: bot, isLoading, error } = trpc.customBot.getByShareToken.useQuery(
    { token },
    { enabled: !!token }
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !bot) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center max-w-md">
          <Bot className="w-12 h-12 mx-auto mb-4 text-muted-foreground opacity-40" />
          <h2 className="text-lg font-semibold mb-2">Bot 不存在</h2>
          <p className="text-sm text-muted-foreground mb-4">该分享链接无效或已过期</p>
          <Button variant="outline" onClick={() => navigate('/')}>
            <ArrowLeft className="w-4 h-4 mr-1.5" />返回首页
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Bot 信息卡片 */}
        <Card className="p-8">
          <div className="flex items-start gap-4 mb-6">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-3xl border border-primary/10">
              {bot.avatar || '🤖'}
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold flex items-center gap-2">
                {bot.name}
                <Globe className="w-4 h-4 text-green-600" />
              </h1>
              {bot.description && (
                <p className="text-muted-foreground mt-1">{bot.description}</p>
              )}
              {bot.creatorName && (
                <p className="text-xs text-muted-foreground mt-2">
                  创建者: {bot.creatorName}
                </p>
              )}
            </div>
          </div>

          {/* 统计 */}
          <div className="flex gap-4 mb-6 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4" />{bot.usageCount || 0} 次使用
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-4 h-4" />{bot.likeCount || 0} 点赞
            </span>
            {bot.category && (
              <span className="px-2 py-0.5 bg-muted rounded-full text-xs">{bot.category}</span>
            )}
          </div>

          {/* 开场引导预览 */}
          {bot.starterMessages && safeParseArray(bot.starterMessages).length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2 text-muted-foreground">开场引导</h3>
              <div className="flex flex-wrap gap-2">
                {safeParseArray(bot.starterMessages).map((msg: string, i: number) => (
                  <span key={i} className="px-3 py-1.5 bg-muted/50 rounded-lg text-sm border">
                    {msg}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 使用按钮 */}
          <Button
            size="lg"
            className="w-full"
            onClick={() => navigate(`/chat?botId=${bot.id}`)}
          >
            <Zap className="w-5 h-5 mr-2" />
            开始使用 {bot.name}
          </Button>
        </Card>

        <div className="text-center mt-6">
          <Button variant="link" className="text-muted-foreground" onClick={() => navigate('/bot-store')}>
            浏览更多 Bot →
          </Button>
        </div>
      </div>
    </div>
  );
}
