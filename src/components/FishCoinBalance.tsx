import { Coins, RefreshCw } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState } from "react";

interface FishCoinBalanceProps {
  balance?: string | number | null;
  loading?: boolean;
  size?: "sm" | "md" | "lg";
  showIcon?: boolean;
  showSyncButton?: boolean; // 新增:是否显示同步按钮
  className?: string;
  onBalanceUpdate?: (newBalance: string) => void; // 新增:余额更新回调
}

/**
 * 统一的🐟币余额显示组件
 * 
 * 功能：
 * - 自动处理decimal类型（string）和number类型的余额
 * - 显示加载状态（skeleton）
 * - 支持不同尺寸
 * - 可选显示图标
 * - 可选显示同步按钮（论坛用户）
 */
export function FishCoinBalance({
  balance,
  loading = false,
  size = "md",
  showIcon = true,
  showSyncButton = false,
  className = "",
  onBalanceUpdate,
}: FishCoinBalanceProps) {
  const [isSyncing, setIsSyncing] = useState(false);
  const syncMutation = trpc.fishCoin.syncFromForum.useMutation();

  // 格式化余额：处理decimal类型（string）和number类型
  const formatBalance = (value?: string | number | null): string => {
    if (value === null || value === undefined) return "0.00";
    
    if (typeof value === "string") {
      const num = parseFloat(value);
      return isNaN(num) ? "0.00" : num.toFixed(2);
    }
    
    return value.toFixed(2);
  };

  // 处理同步按钮点击
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      const result = await syncMutation.mutateAsync();
      toast.success(result.message);
      if (onBalanceUpdate && result.newBalance) {
        onBalanceUpdate(result.newBalance);
      }
    } catch (error: any) {
      toast.error(error.message || "同步失败");
    } finally {
      setIsSyncing(false);
    }
  };

  // 尺寸样式映射
  const sizeStyles = {
    sm: {
      container: "gap-1 px-3 py-1.5",
      icon: "h-3.5 w-3.5",
      text: "text-sm",
      button: "h-6 w-6",
    },
    md: {
      container: "gap-2 px-4 py-2",
      icon: "h-4 w-4",
      text: "text-base",
      button: "h-7 w-7",
    },
    lg: {
      container: "gap-2 px-6 py-3",
      icon: "h-5 w-5",
      text: "text-lg",
      button: "h-8 w-8",
    },
  };

  const styles = sizeStyles[size];

  // 加载状态
  if (loading) {
    return (
      <div className={`inline-flex items-center ${styles.container} rounded-full glass-effect ${className}`}>
        {showIcon && <Skeleton className={`${styles.icon} rounded-full`} />}
        <Skeleton className={`h-4 w-20`} />
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center ${styles.container} rounded-full glass-effect ${className}`} style={{paddingTop: '0px', paddingRight: '3px', paddingBottom: '1px', paddingLeft: '5px'}}>
      {showIcon && <Coins className={`${styles.icon} text-amber-500`} />}
      <span className={`${styles.text} font-semibold`}>
        余额: {formatBalance(balance)} 🐟币
      </span>
      {showSyncButton && (
        <Button
          variant="ghost"
          size="sm"
          className={`${styles.button} p-0 ml-1 hover:bg-transparent`}
          onClick={handleSync}
          disabled={isSyncing}
          title="从论坛同步余额"
        >
          <RefreshCw className={`${styles.icon} ${isSyncing ? 'animate-spin' : ''}`} />
        </Button>
      )}
    </div>
  );
}
