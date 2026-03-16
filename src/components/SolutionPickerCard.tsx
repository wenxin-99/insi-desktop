/**
 * SolutionPickerCard — 方案选择卡片
 *
 * AI 检测到多方案场景时弹出，让用户先选择方向再给详细回答。
 * 支持：键盘导航（↑↓ Enter Esc）、移动端触控、自定义输入、Skip。
 */
import { useState, useEffect, useRef, useCallback, memo } from 'react';
import {
  X, CornerDownLeft, Pencil, SkipForward,
  ChevronUp, ChevronDown, Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface SolutionOption {
  title: string;
  description?: string;
}

export interface SolutionPickerData {
  id: string;
  question: string;
  options: SolutionOption[];
  allowCustom: boolean;
  allowSkip: boolean;
  selectedIndex?: number;
  customText?: string;
  status: 'pending' | 'selected' | 'skipped';
}

interface SolutionPickerCardProps {
  data: SolutionPickerData;
  onSelect: (index: number, option: SolutionOption) => void;
  onCustom: (text: string) => void;
  onSkip: () => void;
  onDismiss?: () => void;
}

/** 已选择/已跳过后的紧凑结果展示 */
export function SolutionPickerResult({ data }: { data: SolutionPickerData }) {
  if (data.status === 'pending') return null;

  const selectedOption = data.selectedIndex != null ? data.options[data.selectedIndex] : null;

  return (
    <div className="my-2 flex items-center gap-2 text-sm text-muted-foreground">
      <Sparkles className="w-3.5 h-3.5 text-primary/50 shrink-0" />
      {data.status === 'skipped' ? (
        <span>已跳过方案选择</span>
      ) : selectedOption ? (
        <span>
          已选择：<span className="text-foreground font-medium">{selectedOption.title}</span>
        </span>
      ) : data.customText ? (
        <span>
          自定义：<span className="text-foreground font-medium">{data.customText.substring(0, 50)}{data.customText.length > 50 ? '...' : ''}</span>
        </span>
      ) : null}
    </div>
  );
}

/** 主卡片组件 */
export const SolutionPickerCard = memo(function SolutionPickerCard({
  data, onSelect, onCustom, onSkip, onDismiss,
}: SolutionPickerCardProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  const cardRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const totalItems = data.options.length; // 选项数量（不含 custom/skip）

  // 自动聚焦卡片以接收键盘事件
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  // 自定义输入框聚焦
  useEffect(() => {
    if (showCustomInput) inputRef.current?.focus();
  }, [showCustomInput]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (showCustomInput) {
      if (e.key === 'Escape') {
        setShowCustomInput(false);
        cardRef.current?.focus();
      } else if (e.key === 'Enter' && customText.trim()) {
        onCustom(customText.trim());
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex(i => (i - 1 + totalItems) % totalItems);
        break;
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex(i => (i + 1) % totalItems);
        break;
      case 'Enter':
        e.preventDefault();
        onSelect(activeIndex, data.options[activeIndex]);
        break;
      case 'Escape':
        e.preventDefault();
        onSkip();
        break;
    }
  }, [activeIndex, totalItems, data.options, onSelect, onSkip, onCustom, showCustomInput, customText]);

  return (
    <div
      ref={cardRef}
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="my-3 border border-border rounded-xl bg-card shadow-sm overflow-hidden focus:outline-none focus:ring-2 focus:ring-primary/20 animate-in fade-in slide-in-from-bottom-2 duration-300"
    >
      {/* 头部：问题 + 关闭按钮 */}
      <div className="flex items-start gap-3 px-4 py-3 bg-muted/30 border-b border-border/50">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground leading-snug">
            {data.question}
          </p>
        </div>
        {onDismiss && (
          <button
            onClick={onDismiss}
            className="shrink-0 p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* 选项列表 */}
      <div className="p-2 space-y-1.5">
        {data.options.map((option, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(idx, option)}
            onMouseEnter={() => setActiveIndex(idx)}
            className={cn(
              "w-full flex items-start gap-3 px-3 py-2.5 rounded-lg text-left transition-all duration-150",
              "border border-transparent",
              activeIndex === idx
                ? "bg-primary/5 border-primary/20 shadow-sm"
                : "hover:bg-muted/50"
            )}
          >
            {/* 序号 */}
            <span className={cn(
              "shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold mt-0.5 transition-colors",
              activeIndex === idx
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground"
            )}>
              {idx + 1}
            </span>

            {/* 内容 */}
            <div className="flex-1 min-w-0">
              <span className={cn(
                "text-sm leading-relaxed",
                activeIndex === idx ? "text-foreground font-medium" : "text-foreground/80"
              )}>
                {option.title}
                {option.description && (
                  <span className="text-muted-foreground font-normal">：{option.description}</span>
                )}
              </span>
            </div>

            {/* Enter 图标 */}
            {activeIndex === idx && (
              <CornerDownLeft className="w-4 h-4 text-muted-foreground/40 shrink-0 mt-1" />
            )}
          </button>
        ))}
      </div>

      {/* 底部：自定义输入 + Skip */}
      <div className="flex items-center gap-2 px-4 py-2.5 border-t border-border/50 bg-muted/20">
        {data.allowCustom && (
          showCustomInput ? (
            <div className="flex-1 flex items-center gap-2">
              <input
                ref={inputRef}
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && customText.trim()) {
                    e.stopPropagation();
                    onCustom(customText.trim());
                  } else if (e.key === 'Escape') {
                    e.stopPropagation();
                    setShowCustomInput(false);
                    cardRef.current?.focus();
                  }
                }}
                placeholder="输入你的想法..."
                className="flex-1 text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground/50"
              />
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs shrink-0"
                disabled={!customText.trim()}
                onClick={() => customText.trim() && onCustom(customText.trim())}
              >
                发送
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setShowCustomInput(true)}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Pencil className="w-3.5 h-3.5" />
              <span>其他想法</span>
            </button>
          )
        )}

        <div className="flex-1" />

        {data.allowSkip && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onSkip}
          >
            跳过
          </Button>
        )}
      </div>

      {/* 键盘提示 */}
      <div className="px-4 py-1.5 bg-muted/10 border-t border-border/30 hidden sm:flex items-center gap-3 text-[10px] text-muted-foreground/40">
        <span className="flex items-center gap-1">
          <ChevronUp className="w-2.5 h-2.5" /><ChevronDown className="w-2.5 h-2.5" /> 导航
        </span>
        <span>Enter 选择</span>
        <span>Esc 跳过</span>
      </div>
    </div>
  );
});
