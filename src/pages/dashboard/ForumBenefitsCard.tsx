/**
 * dashboard/ForumBenefitsCard — 论坛等级权益卡片
 */
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Sparkles, MessageSquare, Image, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ForumBenefitsCardProps {
  stats: any;
  balance: any;
}

export function ForumBenefitsCard({ stats, balance }: ForumBenefitsCardProps) {
  const { t } = useTranslation();
  const trustLevel = stats?.forumTrustLevel ?? 0;

  return (
    <Card className="elegant-gradient border-blue-500/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-blue-500" /> {t("pages.dashboard.forumBenefits.title")}
        </CardTitle>
        <CardDescription>{t("pages.dashboard.forumBenefits.description")}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* 当前等级 */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center">
                <Crown className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("pages.dashboard.forumBenefits.currentLevel")}</p>
                <p className="text-xl font-bold">等级 {trustLevel} · {balance?.balance || "0.00"} 🐟币</p>
              </div>
            </div>
            <a href="https://mpsboring.com" target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">{t("pages.dashboard.forumBenefits.visitForum")}</Button>
            </a>
          </div>

          {/* 折扣信息 */}
          {stats?.forumBenefitEnabled ? (
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: MessageSquare, color: "blue", label: t("pages.dashboard.discounts.aiChat"), value: stats.forumChatDiscount },
                { icon: Image, color: "purple", label: t("pages.dashboard.discounts.imageGeneration"), value: stats.forumImageDiscount },
                { icon: FileText, color: "green", label: t("pages.dashboard.discounts.documentProcessing"), value: stats.forumDocumentDiscount },
              ].map(({ icon: Icon, color, label, value }) => (
                <div key={label} className="p-3 rounded-lg bg-background border text-center">
                  <Icon className={`h-5 w-5 text-${color}-500 mx-auto mb-2`} />
                  <p className="text-xs text-muted-foreground mb-1">{label}</p>
                  <p className={`text-lg font-bold text-${color}-500`}>{value}%</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 rounded-lg bg-muted/50 border border-dashed text-center">
              {stats?.globalDiscountEnabled === false ? (
                <>
                  <p className="text-sm text-muted-foreground">{t("pages.dashboard.forumBenefits.noDiscounts")}</p>
                  <p className="text-xs text-muted-foreground mt-1">{t("pages.dashboard.forumBenefits.discountDisabled")}</p>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">当前论坛等级暂无折扣</p>
                  <p className="text-xs text-muted-foreground mt-1">提升论坛等级可解锁专属折扣</p>
                </>
              )}
            </div>
          )}

          {/* 特殊权益 */}
          {trustLevel >= 4 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-100 mb-2">🎉 {t("pages.dashboard.forumBenefits.specialBenefits")}</p>
              <ul className="text-xs text-amber-800 dark:text-amber-200 space-y-1">
                {trustLevel >= 4 && <li>• {t("pages.dashboard.forumBenefits.priorityQueue")}</li>}
                {trustLevel >= 6 && <li>• {t("pages.dashboard.forumBenefits.earlyAccess")}</li>}
                {trustLevel >= 8 && <li>• {t("pages.dashboard.forumBenefits.dedicatedSupport")}</li>}
              </ul>
            </div>
          )}

          {trustLevel < 9 && (
            <p className="text-xs text-muted-foreground text-center">{t("pages.dashboard.forumBenefits.levelUpTip")}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
