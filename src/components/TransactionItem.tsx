/**
 * TransactionItem.tsx
 * 
 * 统一的交易记录展示组件，用于 Dashboard 最近活动和 Transactions 页面。
 * 解析 raw description → 分类图标 + 用户友好文案，隐藏模型名和内部 ID。
 */
import { 
  MessageSquare, Mic, Image, Video, Search, Clock, Zap, Server,
  Sparkles, BookOpen, Play, Bot, Plus, RefreshCw, Gift, RotateCcw,
  Shield, Coins
} from 'lucide-react';
import { parseTransactionDescription, CATEGORY_CONFIG, type TransactionCategory } from '@/lib/transactionDisplay';

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  MessageSquare, Mic, Image, Video, Search, Clock, Zap, Server,
  Sparkles, BookOpen, Play, Bot, Plus, RefreshCw, Gift, RotateCcw,
  Shield, Coins,
};

interface TransactionItemProps {
  description: string | null | undefined;
  amount: string;
  balanceAfter: string;
  createdAt: string | Date;
  /** compact 模式用于 Dashboard 卡片 */
  compact?: boolean;
  balanceLabel?: string;
}

export function TransactionItem({ 
  description, amount, balanceAfter, createdAt, compact = false, balanceLabel = '余额'
}: TransactionItemProps) {
  const parsed = parseTransactionDescription(description);
  const config = CATEGORY_CONFIG[parsed.category];
  const IconComponent = ICON_MAP[config.icon] || Coins;
  const numAmount = parseFloat(amount);
  const isPositive = numAmount > 0;

  return (
    <div className="flex items-center gap-3">
      {/* 分类图标 */}
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${config.bgColor}`}>
        <IconComponent className={`h-4 w-4 ${config.color}`} />
      </div>

      {/* 描述 + 时间 */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium truncate">{parsed.label}</p>
          {parsed.detail && !compact && (
            <span className="text-xs text-muted-foreground truncate max-w-[200px]">
              · {parsed.detail}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {new Date(createdAt).toLocaleString('zh-CN')}
        </p>
      </div>

      {/* 金额 + 余额 */}
      <div className="text-right flex-shrink-0">
        <p className={`text-sm font-semibold tabular-nums ${isPositive ? 'text-green-600' : 'text-red-500'}`}>
          {isPositive ? '+' : ''}{numAmount.toFixed(2)} 🐟币
        </p>
        <p className="text-xs text-muted-foreground tabular-nums">
          {balanceLabel}: {balanceAfter}
        </p>
      </div>
    </div>
  );
}

/**
 * 表格行版本，用于 Transactions 页面的 Table
 */
interface TransactionRowProps {
  description: string | null | undefined;
  amount: string;
  balanceAfter: string;
  createdAt: string | Date;
  type: string;
}

export function TransactionBadge({ category }: { category: TransactionCategory }) {
  const config = CATEGORY_CONFIG[category];
  const IconComponent = ICON_MAP[config.icon] || Coins;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium ${config.bgColor} ${config.color}`}>
      <IconComponent className="h-3 w-3" />
      {config.label}
    </span>
  );
}
