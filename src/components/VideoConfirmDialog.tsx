import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Video, AlertCircle } from "lucide-react";
import { useState } from "react";

interface VideoConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoParams: {
    prompt: string;
    duration: number;
    style?: string;
    provider: string;
    confidence: string;
    method: string;
  };
  balance: number;
  cost: number;
  onConfirm: (params: { prompt: string; duration: number; style?: string; provider: string }) => void;
  isGenerating: boolean;
}

export function VideoConfirmDialog({
  open,
  onOpenChange,
  videoParams,
  balance,
  cost,
  onConfirm,
  isGenerating
}: VideoConfirmDialogProps) {
  const [editedPrompt, setEditedPrompt] = useState(videoParams.prompt);
  const [editedDuration, setEditedDuration] = useState(videoParams.duration.toString());
  const [editedStyle, setEditedStyle] = useState(videoParams.style || "");
  const [editedProvider, setEditedProvider] = useState(videoParams.provider);

  const handleConfirm = () => {
    onConfirm({
      prompt: editedPrompt,
      duration: parseInt(editedDuration),
      style: editedStyle || undefined,
      provider: editedProvider
    });
  };

  const isBalanceSufficient = balance >= cost;
  const confidenceColor = {
    high: "text-green-600",
    medium: "text-yellow-600",
    low: "text-red-600"
  }[videoParams.confidence] || "text-gray-600";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            确认生成视频
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span>识别方式：</span>
                <span className="font-medium">
                  {videoParams.method === 'keyword' ? '关键词匹配' : 'AI智能识别'}
                </span>
                <span className={`text-sm ${confidenceColor}`}>
                  ({videoParams.confidence === 'high' ? '高' : videoParams.confidence === 'medium' ? '中' : '低'}置信度)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span>当前余额：</span>
                <span className="font-medium">{balance.toFixed(2)} 🐟币</span>
                <span>|</span>
                <span>生成费用：</span>
                <span className={`font-medium ${isBalanceSufficient ? 'text-green-600' : 'text-red-600'}`}>
                  {cost.toFixed(2)} 🐟币
                </span>
              </div>
            </div>
          </DialogDescription>
        </DialogHeader>

        {!isBalanceSufficient && (
          <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
            <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />
            <span className="text-sm text-red-600">
              余额不足！请先充值或调整视频参数。
            </span>
          </div>
        )}

        <div className="space-y-4 py-4">
          {/* 视频描述 */}
          <div className="space-y-2">
            <Label htmlFor="prompt">视频描述 *</Label>
            <Input
              id="prompt"
              placeholder="描述您想要生成的视频内容..."
              value={editedPrompt}
              onChange={(e) => setEditedPrompt(e.target.value)}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {editedPrompt.length}/500 字符
            </p>
          </div>

          {/* 服务商选择 */}
          <div className="space-y-2">
            <Label htmlFor="provider">视频服务商 *</Label>
            <Select value={editedProvider} onValueChange={setEditedProvider}>
              <SelectTrigger>
                <SelectValue placeholder="选择服务商" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Pika">Pika - {cost.toFixed(2)} 🐟币/次</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 视频时长 */}
          <div className="space-y-2">
            <Label htmlFor="duration">视频时长（秒）</Label>
            <Select value={editedDuration} onValueChange={setEditedDuration}>
              <SelectTrigger>
                <SelectValue placeholder="选择时长" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3秒</SelectItem>
                <SelectItem value="5">5秒</SelectItem>
                <SelectItem value="10">10秒</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* 视频风格 */}
          <div className="space-y-2">
            <Label htmlFor="style">视频风格（可选）</Label>
            <Input
              id="style"
              placeholder="例如：电影感、卡通、写实..."
              value={editedStyle}
              onChange={(e) => setEditedStyle(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isGenerating}
          >
            取消
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={isGenerating || !editedPrompt.trim() || !isBalanceSufficient}
          >
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              `确认生成（${cost.toFixed(2)} 🐟币）`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
