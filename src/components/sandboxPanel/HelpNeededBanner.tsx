/**
 * HelpNeededBanner.tsx — AI 求助通知横幅
 *
 * 当 AI 遇到验证码、登录失败等无法自动处理的情况时，
 * 在浏览器预览顶部显示醒目的通知横幅，引导用户接管操作。
 */
import { ShieldAlert, LogIn, HelpCircle, X, Hand } from "lucide-react";

const CATEGORY_CONFIG: Record<string, { icon: any; label: string; color: string; bgColor: string }> = {
  captcha: { icon: ShieldAlert, label: "验证码", color: "text-amber-700 dark:text-amber-300", bgColor: "bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800" },
  login: { icon: LogIn, label: "登录失败", color: "text-red-700 dark:text-red-300", bgColor: "bg-red-50 dark:bg-red-950/50 border-red-200 dark:border-red-800" },
  stuck: { icon: HelpCircle, label: "操作受阻", color: "text-blue-700 dark:text-blue-300", bgColor: "bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800" },
  other: { icon: HelpCircle, label: "需要帮助", color: "text-gray-700 dark:text-gray-300", bgColor: "bg-gray-50 dark:bg-gray-900/50 border-gray-200 dark:border-gray-700" },
};

interface Props {
  reason: string;
  category: string;
  onDismiss: () => void;
  onTakeover?: () => void;
}

export function HelpNeededBanner({ reason, category, onDismiss, onTakeover }: Props) {
  const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.other;
  const Icon = config.icon;

  return (
    <div className={`absolute top-0 inset-x-0 z-20 flex items-center gap-2 px-3 py-2 border-b ${config.bgColor} animate-in slide-in-from-top duration-300`}>
      <Icon className={`w-4 h-4 ${config.color} shrink-0`} />
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-medium ${config.color}`}>{config.label}：</span>
        <span className="text-xs text-foreground/80 ml-1">{reason}</span>
      </div>
      {onTakeover && (
        <button
          onClick={onTakeover}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-primary text-primary-foreground hover:opacity-90 transition-colors shrink-0"
        >
          <Hand className="w-3 h-3" />
          接管
        </button>
      )}
      <button onClick={onDismiss} className="p-0.5 rounded hover:bg-black/5 dark:hover:bg-white/5 shrink-0">
        <X className="w-3 h-3 text-muted-foreground" />
      </button>
    </div>
  );
}
