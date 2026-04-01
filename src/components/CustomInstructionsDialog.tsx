/**
 * CustomInstructionsDialog — 自定义指令设置弹窗
 *
 * 用户可以设置全局生效的个性化指令，类似 ChatGPT Custom Instructions。
 * 指令会注入到每次对话的 System Prompt 中。
 *
 * 入口：ChatHeader 工具栏 / 设置页
 */

import { useState, useEffect } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { trpc } from '@/lib/trpc';
import { toast } from 'sonner';
import { Wand2, Loader2 } from 'lucide-react';

interface CustomInstructionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PLACEHOLDER = `例如：
• 我是一名全栈开发者，使用 TypeScript + React
• 回答请用中文，代码注释也用中文
• 给出代码时请附带简短说明
• 不需要过多的免责声明和安全提示
• 回答尽量简洁，避免冗余`;

const MAX_LENGTH = 2000;

export function CustomInstructionsDialog({ open, onOpenChange }: CustomInstructionsDialogProps) {
  const [value, setValue] = useState('');
  const [savedValue, setSavedValue] = useState('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = trpc.auth.getCustomInstructions.useQuery(undefined, {
    enabled: open,
  });

  const mutation = trpc.auth.setCustomInstructions.useMutation();

  useEffect(() => {
    if (data?.instructions !== undefined) {
      setValue(data.instructions);
      setSavedValue(data.instructions);
    }
  }, [data?.instructions]);

  const hasChanges = value !== savedValue;

  const handleSave = async () => {
    setSaving(true);
    try {
      await mutation.mutateAsync({ instructions: value });
      setSavedValue(value);
      toast.success('自定义指令已保存，将在下次对话中生效');
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || '保存失败');
    } finally {
      setSaving(false);
    }
  };

  const handleClear = async () => {
    setValue('');
    setSaving(true);
    try {
      await mutation.mutateAsync({ instructions: '' });
      setSavedValue('');
      toast.success('自定义指令已清除');
    } catch (err: any) {
      toast.error(err.message || '操作失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-violet-500" />
            自定义指令
          </DialogTitle>
          <DialogDescription>
            设置全局生效的个性化指令。AI 会在每次回答时参考这些指令来调整风格和行为。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="relative">
            <Textarea
              value={value}
              onChange={(e) => setValue(e.target.value.slice(0, MAX_LENGTH))}
              placeholder={PLACEHOLDER}
              className="min-h-[200px] resize-none text-sm leading-relaxed"
              disabled={isLoading}
            />
            <span className={`absolute bottom-2 right-3 text-[10px] ${
              value.length > MAX_LENGTH * 0.9 ? 'text-destructive' : 'text-muted-foreground/40'
            }`}>
              {value.length}/{MAX_LENGTH}
            </span>
          </div>

          <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/30 border border-border/40">
            <Wand2 className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              指令适合写：你的身份/职业、偏好的回答风格、技术栈、语言偏好等。
              不适合写：具体的单次任务（直接在对话中说即可）。
            </p>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {savedValue && (
            <Button variant="ghost" size="sm" onClick={handleClear} disabled={saving} className="text-destructive hover:text-destructive">
              清除指令
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            取消
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            保存
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
