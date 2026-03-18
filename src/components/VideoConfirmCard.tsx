import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, RotateCcw, Film, Clock, Sparkles, Coins, Image as ImageIcon, Clapperboard } from 'lucide-react';

interface VideoConfirmCardProps {
  params: {
    prompt: string;
    confidence: 'high' | 'medium' | 'low';
    extractedStyle?: string;
    extractedDuration?: number;
    cost5s?: number;
    cost10s?: number;
    imageUrl?: string;
  };
  onConfirm: (params: { prompt: string; duration: 5 | 10; style?: string; imageUrl?: string }) => void;
  onCancel: () => void;
  isGenerating?: boolean;
  balance?: number;
}

export function VideoConfirmCard({ params, onConfirm, onCancel, isGenerating = false, balance }: VideoConfirmCardProps) {
  const [duration, setDuration] = useState<5 | 10>(params.extractedDuration === 10 ? 10 : 5);
  const [style, setStyle] = useState<string>(params.extractedStyle || '');
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

  const cost = duration === 10 ? (params.cost10s ?? 50) : (params.cost5s ?? 30);
  const hasInsufficientBalance = balance !== undefined && balance < cost;

  return (
    <div className="relative max-w-lg w-full animate-in fade-in slide-in-from-bottom-2 duration-500">
      {/* 外层光晕边框 */}
      <div className="absolute -inset-[1px] rounded-2xl bg-gradient-to-br from-blue-500/30 via-violet-500/20 to-cyan-500/30 blur-[1px]" />

      <div className="relative rounded-2xl overflow-hidden bg-background border border-border/50 shadow-xl">
        {/* 顶部渐变条 — 胶片风格 */}
        <div className="relative h-11 bg-gradient-to-r from-blue-600 via-violet-600 to-cyan-600 flex items-center px-4 gap-2.5 overflow-hidden">
          {/* 胶片孔装饰 */}
          <div className="absolute top-0 left-0 right-0 flex justify-between px-2 opacity-15">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={`t${i}`} className="w-2 h-1 bg-white rounded-sm mt-0.5" />
            ))}
          </div>
          <div className="absolute bottom-0 left-0 right-0 flex justify-between px-2 opacity-15">
            {Array.from({ length: 16 }).map((_, i) => (
              <div key={`b${i}`} className="w-2 h-1 bg-white rounded-sm mb-0.5" />
            ))}
          </div>
          <Clapperboard className="w-4 h-4 text-white/90" />
          <span className="text-[13px] font-semibold text-white tracking-wide">视频生成确认</span>
          <div className="ml-auto flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] text-white/50 uppercase tracking-widest font-mono">Ready</span>
          </div>
        </div>

        <div className="p-4 space-y-3.5">
          {/* 参考图片 */}
          {params.imageUrl && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-gradient-to-r from-blue-500/[0.04] to-violet-500/[0.04] border border-blue-500/10">
              <div className="relative shrink-0">
                <img src={params.imageUrl} alt="参考图" className="w-14 h-14 object-cover rounded-lg ring-2 ring-blue-500/20" />
                <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center ring-2 ring-background">
                  <ImageIcon className="w-2.5 h-2.5 text-white" />
                </div>
              </div>
              <div>
                <p className="text-sm font-medium flex items-center gap-1.5">
                  参考图片
                  <span className="text-[10px] px-1.5 py-px rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400">图生视频</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">将参照此图生成动态视频</p>
              </div>
            </div>
          )}

          {/* 视频描述 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                视频描述
              </span>
              <button
                onClick={handleReset}
                disabled={!isModified || isGenerating}
                className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
              >
                <RotateCcw className="h-3 w-3" />
                重置
              </button>
            </div>
            <div className="relative">
              <Textarea
                value={editedPrompt}
                onChange={(e) => handlePromptChange(e.target.value)}
                placeholder="描述您想要生成的视频内容..."
                className="min-h-[72px] text-sm resize-none rounded-xl border-border/50 bg-muted/20 focus:bg-background focus:border-blue-500/40 transition-all pr-14"
                maxLength={500}
                disabled={isGenerating}
              />
              <span className="absolute bottom-2 right-3 text-[10px] text-muted-foreground/40 font-mono">
                {editedPrompt.length}/500
              </span>
            </div>
          </div>

          {/* 参数：时长 + 风格 */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" /> 时长
              </span>
              <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v) as 5 | 10)}>
                <SelectTrigger className="h-8 text-sm border-0 bg-background/60 shadow-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 秒</SelectItem>
                  <SelectItem value="10">10 秒</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="p-2.5 rounded-xl bg-muted/20 border border-border/30 space-y-1">
              <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                <Film className="w-3 h-3" /> 风格
              </span>
              <input
                type="text"
                className="w-full h-8 px-2.5 text-sm rounded-md border-0 bg-background/60 shadow-sm outline-none focus:ring-1 focus:ring-blue-500/30"
                placeholder="电影感..."
                value={style}
                onChange={(e) => setStyle(e.target.value)}
              />
            </div>
          </div>

          {/* 费用 */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-gradient-to-r from-amber-500/[0.04] to-orange-500/[0.04] border border-amber-500/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-lg shadow-amber-500/20">
                <Coins className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-lg font-bold leading-none">{cost}</div>
                <div className="text-[10px] text-muted-foreground mt-0.5">消耗鱼币</div>
              </div>
            </div>
            {balance !== undefined && (
              <div className={`text-right ${hasInsufficientBalance ? 'text-red-500' : 'text-muted-foreground'}`}>
                <div className="text-[11px]">余额</div>
                <div className="text-sm font-semibold">{balance.toFixed(0)} 🪙</div>
                {hasInsufficientBalance && <div className="text-[10px] text-red-500 font-medium">余额不足</div>}
              </div>
            )}
          </div>

          {/* 按钮 */}
          <div className="flex gap-2.5 pt-0.5">
            <Button
              variant="outline"
              className="flex-1 h-10 rounded-xl border-border/50"
              onClick={onCancel}
              disabled={isGenerating}
            >
              取消
            </Button>
            <Button
              className="flex-[2] h-10 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-700 hover:to-violet-700 text-white shadow-lg shadow-blue-600/20 font-medium transition-all active:scale-[0.98]"
              onClick={() => onConfirm({ prompt: editedPrompt, duration, style: style || undefined, imageUrl: params.imageUrl })}
              disabled={isGenerating || hasInsufficientBalance}
            >
              {isGenerating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />生成中...</>
              ) : hasInsufficientBalance ? '余额不足' : (
                <><Sparkles className="mr-1.5 h-4 w-4" />确认生成</>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
