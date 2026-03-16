import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Users, Copy, Check, Gift, QrCode, Share2, Clock, CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { format } from "date-fns";
import DashboardLayout from '@/components/DashboardLayout';

export default function Invite() {
  const { t } = useTranslation();
  const [copiedCode, setCopiedCode] = useState(false);
  const [currentCode, setCurrentCode] = useState<string | null>(null);

  const { data: invitations, refetch } = trpc.invitation.getMyInvitations.useQuery();
  const createInvitationMutation = trpc.invitation.createUserInvitation.useMutation({
    onSuccess: (data) => {
      setCurrentCode(data.code);
      toast.success(t('invite.toast.generateSuccess'));
      refetch();
    },
    onError: (error) => {
      toast.error(error.message || t('invite.toast.generateError'));
    },
  });

  const handleGenerateCode = () => {
    createInvitationMutation.mutate();
  };

  const handleCopyCode = () => {
    if (!currentCode) return;
    navigator.clipboard.writeText(currentCode);
    setCopiedCode(true);
    toast.success(t('invite.toast.copied'));
    setTimeout(() => setCopiedCode(false), 2000);
  };



  const totalInvited = invitations?.filter((inv) => inv.used).length || 0;
  const totalRewards = totalInvited * 50;

  return (
    <DashboardLayout>
    <div className="container max-w-6xl py-8">
      {/* 返回按钮 */}
      <Button
        variant="ghost"
        size="default"
        onClick={() => window.history.back()}
        className="mb-4 min-h-[44px] px-4"
      >
        <ArrowLeft className="h-5 w-5 mr-2" />
        <span className="text-base">{t('invite.back')}</span>
      </Button>
      
      {/* 页面标题 */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect mb-4">
          <Users className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">{t('invite.badge')}</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">{t('invite.title')}</h1>
        <p className="text-xl text-muted-foreground">
          {t('invite.description')}
        </p>
        <div className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-amber-100 to-orange-100 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-300 dark:border-amber-700">
          <Gift className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          <span className="text-sm font-semibold text-amber-900 dark:text-amber-100">
            {t('invite.bonus')}
          </span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid md:grid-cols-3 gap-6 mb-8">
        <Card className="elegant-gradient">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('invite.stats.invited')}</p>
                <p className="text-3xl font-bold">{totalInvited}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="h-6 w-6 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="elegant-gradient">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('invite.stats.totalRewards')}</p>
                <p className="text-3xl font-bold">{totalRewards} 🐟币</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
                <Gift className="h-6 w-6 text-amber-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="elegant-gradient">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t('invite.stats.totalCodes')}</p>
                <p className="text-3xl font-bold">{invitations?.length || 0}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
                <Share2 className="h-6 w-6 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 生成邀请码 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>{t('invite.generate.title')}</CardTitle>
          <CardDescription>
            {t('invite.generate.description')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button
            onClick={handleGenerateCode}
            disabled={createInvitationMutation.isPending}
            className="btn-elegant"
          >
            {createInvitationMutation.isPending ? t('invite.generate.generating') : t('invite.generate.button')}
          </Button>

          {currentCode && (
            <div className="space-y-4 p-6 rounded-lg bg-muted/50">
              <div>
                <label className="text-sm font-medium mb-2 block">{t('invite.generate.codeLabel')}</label>
                <div className="flex gap-2">
                  <Input value={currentCode} readOnly className="font-mono" />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCode}
                  >
                    {copiedCode ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{t('invite.generate.validity')}</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 邀请记录 */}
      <Card>
        <CardHeader>
          <CardTitle>{t('invite.history.title')}</CardTitle>
          <CardDescription>{t('invite.history.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {invitations && invitations.length > 0 ? (
            <div className="space-y-4">
              {invitations.map((invitation) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 rounded-lg border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-mono font-semibold">{invitation.code}</span>
                      {invitation.used ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/10 text-green-600 text-xs">
                          <CheckCircle2 className="h-3 w-3" />
                          {t('invite.history.status.used')}
                        </span>
                      ) : new Date() > invitation.expiresAt ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/10 text-red-600 text-xs">
                          <XCircle className="h-3 w-3" />
                          {t('invite.history.status.expired')}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 text-blue-600 text-xs">
                          <Clock className="h-3 w-3" />
                          {t('invite.history.status.unused')}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {invitation.used && invitation.invitedUser ? (
                        <span>
                          被邀请人: {invitation.invitedUser.name || invitation.invitedUser.email}
                          {invitation.usedAt && ` · 使用时间: ${format(new Date(invitation.usedAt), "yyyy-MM-dd HH:mm")}`}
                        </span>
                      ) : (
                        <span>
                          创建时间: {format(new Date(invitation.createdAt), "yyyy-MM-dd HH:mm")}
                          {" · "}
                          过期时间: {format(new Date(invitation.expiresAt), "yyyy-MM-dd HH:mm")}
                        </span>
                      )}
                    </div>
                  </div>
                  {invitation.used && (
                    <div className="text-right">
                      <div className="text-sm font-semibold text-green-600">
                        +{Number(invitation.rewardAmount).toFixed(0)} 🐟币
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">还没有邀请记录</p>
              <p className="text-sm text-muted-foreground mt-1">
                点击上方按钮生成邀请码，开始邀请好友吧！
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 邀请说明 */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="h-5 w-5" />
            邀请规则
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-2">如何邀请</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• 点击"生成新邀请码"按钮创建专属邀请码</li>
                <li>• 复制邀请码或邀请链接分享给好友</li>
                <li>• 好友使用邀请码注册成功后即可获得奖励</li>
                <li>• 每个邀请码有效期为7天，可以多次生成</li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-2">奖励规则</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• <strong>注册奖励</strong>：好友注册成功后，你和好友各获得50🐟币</li>
                <li>• <strong className="text-amber-600 dark:text-amber-400">首充奖励</strong>：好友首次充值时，你额外获得100🐟币（总计150🐟币）</li>
                <li>• 奖励会立即到账，可在🐟币记录中查看</li>
                <li>• 邀请人数没有上限，多邀多得</li>
                <li>• 🐟币可用于平台所有Insi功能</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
