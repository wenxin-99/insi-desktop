/**
 * VoiceUpgradePrompt — 当免费额度用尽时的柔性升级引导
 *
 * 底部滑入浮层，不阻断操作，一键切换到付费套餐。
 */
import { useState } from "react";
import { X, ArrowRight, Sparkles } from "lucide-react";
import { TIER_COLORS } from "./types";

interface VoiceUpgradePromptProps {
  /** 当前用了多少轮 */
  usedToday: number;
  /** 每日限额 */
  dailyLimit: number;
  /** 当前套餐名 */
  currentPackageName: string;
  /** 推荐升级的套餐列表 */
  upgradeOptions: Array<{
    id: string;
    displayName: string;
    fishCoinCost: number;
    tier: string;
    highlights: string[];
  }>;
  /** 用户选择升级到某套餐 */
  onUpgrade: (packageId: string) => void;
  /** 关闭浮层 */
  onDismiss: () => void;
  /** 余额不足的情况 */
  reason?: string;
}

export function VoiceUpgradePrompt({
  usedToday,
  dailyLimit,
  currentPackageName,
  upgradeOptions,
  onUpgrade,
  onDismiss,
  reason,
}: VoiceUpgradePromptProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const isBalanceIssue = reason === "insufficient_balance";

  return (
    <div className="absolute bottom-0 left-0 right-0 z-30 animate-in slide-in-from-bottom-4 duration-300">
      <div className="mx-3 mb-3 rounded-2xl border bg-background/95 backdrop-blur-md shadow-xl overflow-hidden">
        {/* 关闭按钮 */}
        <button
          onClick={() => { setDismissed(true); onDismiss(); }}
          className="absolute top-2.5 right-2.5 p-1 rounded-full hover:bg-muted transition-colors z-10"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        {/* 标题区 */}
        <div className="px-4 pt-4 pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold">
              {isBalanceIssue ? "余额不足" : "今日免费额度已用完"}
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {isBalanceIssue
              ? "当前鱼币余额不足以使用此套餐，请切换到免费套餐或充值后继续。"
              : `「${currentPackageName}」今日 ${dailyLimit} 轮免费额度已使用 ${usedToday} 轮。升级套餐即可继续畅聊。`
            }
          </p>
        </div>

        {/* 升级选项 */}
        {!isBalanceIssue && upgradeOptions.length > 0 && (
          <div className="px-4 pb-4 space-y-2">
            {upgradeOptions.slice(0, 2).map((opt) => {
              const colors = TIER_COLORS[opt.tier] || TIER_COLORS.standard;
              return (
                <button
                  key={opt.id}
                  onClick={() => onUpgrade(opt.id)}
                  className={[
                    "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border-2 transition-all",
                    "hover:scale-[1.01] active:scale-[0.99]",
                    colors.border,
                    "bg-background hover:bg-muted/30",
                  ].join(" ")}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${colors.badge}`}>
                      {TIER_COLORS[opt.tier]?.badgeText || "标准"}
                    </div>
                    <div className="text-left">
                      <div className="text-sm font-medium">{opt.displayName}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {opt.fishCoinCost} 🐟/轮 · 不限次数
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground" />
                </button>
              );
            })}
          </div>
        )}

        {/* 余额不足时显示充值提示 */}
        {isBalanceIssue && (
          <div className="px-4 pb-4">
            <p className="text-xs text-muted-foreground">
              前往个人中心充值鱼币，或切换到免费套餐继续使用。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
