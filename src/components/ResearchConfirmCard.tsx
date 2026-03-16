/**
 * ResearchConfirmCard - 任务代理确认卡片
 * 
 * 当系统检测到用户的消息可能需要任务代理究时，
 * 在对话中显示此确认卡片，让用户确认是否启动研究任务。
 * 设计模式参考 VideoConfirmCard。
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Brain, Loader2, RotateCcw, Search, BookOpen, Zap } from "lucide-react";
import { useTranslation } from "react-i18next";

interface ResearchConfirmCardProps {
  params: {
    prompt: string;
    confidence: 'high' | 'medium' | 'low';
    method: 'keyword' | 'llm';
    originalMessage: string;
  };
  cost: number;
  onConfirm: (prompt: string) => void;
  onCancel: () => void;
  isStarting?: boolean;
}

export function ResearchConfirmCard({
  params,
  cost,
  onConfirm,
  onCancel,
  isStarting = false,
}: ResearchConfirmCardProps) {
  const { t } = useTranslation();
  const [editedPrompt, setEditedPrompt] = useState<string>(params.prompt);
  const [isModified, setIsModified] = useState(false);

  const handlePromptChange = (value: string) => {
    setEditedPrompt(value);
    setIsModified(value !== params.prompt);
  };

  const handleReset = () => {
    setEditedPrompt(params.prompt);
    setIsModified(false);
  };

  return (
    <Card className="border-2 border-blue-200 dark:border-blue-800/40 bg-gradient-to-br from-blue-50/80 to-purple-50/40 dark:from-blue-950/30 dark:to-purple-950/20">
      <CardContent className="p-4 space-y-4">
        {/* 标题区域 */}
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40">
            <Brain className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
              {t('chat.research.confirm.title')}
            </p>
            <p className="text-xs text-blue-600/70 dark:text-blue-400/70">
              {t('chat.research.confirm.subtitle')}
            </p>
          </div>
        </div>

        {/* 功能说明 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/60 dark:bg-white/5 rounded-md px-2 py-1.5">
            <Search className="h-3 w-3 text-blue-500 flex-shrink-0" />
            <span>{t('chat.research.confirm.webSearch')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/60 dark:bg-white/5 rounded-md px-2 py-1.5">
            <BookOpen className="h-3 w-3 text-green-500 flex-shrink-0" />
            <span>{t('chat.research.confirm.deepAnalysis')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-white/60 dark:bg-white/5 rounded-md px-2 py-1.5">
            <Zap className="h-3 w-3 text-yellow-500 flex-shrink-0" />
            <span>{t('chat.research.confirm.generateReport')}</span>
          </div>
        </div>

        {/* 研究指令编辑 */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">{t('chat.research.confirm.promptLabel')}</span>
            <div className="flex items-center gap-2">
              {isModified && (
                <span className="text-xs text-blue-600 dark:text-blue-400">{t("chat.research.confirm.modified")}</span>
              )}
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs"
                onClick={handleReset}
                disabled={!isModified || isStarting}
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                {t('chat.research.confirm.reset')}
              </Button>
            </div>
          </div>
          <Textarea
            value={editedPrompt}
            onChange={(e) => handlePromptChange(e.target.value)}
            placeholder={t('chat.research.confirm.placeholder')}
            className="min-h-[60px] text-sm resize-none bg-white/80 dark:bg-gray-900/50"
            maxLength={2000}
            disabled={isStarting}
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('chat.research.confirm.editHint')}</span>
            <span>{editedPrompt.length}/2000</span>
          </div>
        </div>

        {/* 费用信息 */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-yellow-50/80 dark:bg-yellow-950/20 border border-yellow-200/50 dark:border-yellow-800/30">
          <span className="text-sm text-muted-foreground">{t('chat.research.confirm.costLabel')}</span>
          <span className="text-sm font-semibold text-yellow-700 dark:text-yellow-400">{cost} 🐟币</span>
        </div>

        {/* 操作按钮 */}
        <div className="flex gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={onCancel}
            disabled={isStarting}
          >
            {t('chat.research.confirm.cancelChat')}
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm(editedPrompt)}
            disabled={isStarting || editedPrompt.trim().length < 2}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isStarting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isStarting ? t('chat.research.confirm.starting') : t('chat.research.confirm.startResearch')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
