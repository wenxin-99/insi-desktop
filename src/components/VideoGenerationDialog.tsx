import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Video } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface VideoGenerationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  conversationId?: number | null;
}

export function VideoGenerationDialog({ open, onOpenChange, conversationId }: VideoGenerationDialogProps) {
  const [prompt, setPrompt] = useState("");
  const [duration, setDuration] = useState("5");
  const [style, setStyle] = useState("");
  const [provider, setProvider] = useState("Pika");

  const { data: balance } = trpc.fishCoin.getBalance.useQuery();
  const { data: videoConfigs } = trpc.videoApi.getAll.useQuery();
  const generateMutation = trpc.videos.generate.useMutation({
    onSuccess: (data) => {
      toast.success(`视频生成任务已创建！任务ID: ${data.taskId}`);
      onOpenChange(false);
      setPrompt("");
      setStyle("");
    },
    onError: (error) => {
      toast.error(error.message || "视频生成失败");
    },
  });

  const handleGenerate = () => {
    if (!prompt.trim()) {
      toast.error("请输入视频描述");
      return;
    }

    // 检查是否有可用的配置
    const selectedConfig = videoConfigs?.find(c => c.provider === provider && c.isEnabled);
    if (!selectedConfig) {
      toast.error(`${provider} 配置未启用或不存在`);
      return;
    }

    const cost = duration === '5' ? parseFloat(selectedConfig.cost5s) : parseFloat(selectedConfig.cost10s);
    if (balance && parseFloat(balance.balance) < cost) {
      toast.error(`🐟币余额不足！需要 ${cost} 🐟币`);
      return;
    }

    generateMutation.mutate({
      prompt: prompt.trim(),
      duration: parseInt(duration) as 5 | 10,
      style: style || undefined,
      provider,
      conversationId: conversationId || undefined,
    });
  };

  // 获取已启用的视频服务商列表
  const enabledProviders = videoConfigs?.filter(c => c.isEnabled) || [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="h-5 w-5" />
            生成视频
          </DialogTitle>
          <DialogDescription>
            使用AI生成视频，消耗🐟币
            {balance && (
              <span className="ml-2 text-sm font-medium">
                当前余额: {parseFloat(balance.balance).toFixed(2)} 🐟币
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* 视频描述 */}
          <div className="space-y-2">
            <Label htmlFor="prompt">视频描述 *</Label>
            <Input
              id="prompt"
              placeholder="描述您想要生成的视频内容..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              maxLength={500}
            />
            <p className="text-xs text-muted-foreground">
              {prompt.length}/500 字符
            </p>
          </div>

          {/* 服务商选择 */}
          <div className="space-y-2">
            <Label htmlFor="provider">视频服务商 *</Label>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue placeholder="选择服务商" />
              </SelectTrigger>
              <SelectContent>
                {enabledProviders.length > 0 ? (
                  enabledProviders.map((config) => (
                    <SelectItem key={config.id} value={config.provider}>
                      {config.provider} - 5秒:{parseFloat(config.cost5s).toFixed(2)}🐟币 10秒:{parseFloat(config.cost10s).toFixed(2)}🐟币
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="none" disabled>
                    暂无可用服务商
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 视频时长 */}
          <div className="space-y-2">
            <Label htmlFor="duration">视频时长（秒）</Label>
            <Select value={duration} onValueChange={setDuration}>
              <SelectTrigger>
                <SelectValue placeholder="选择时长" />
              </SelectTrigger>
              <SelectContent>
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
              value={style}
              onChange={(e) => setStyle(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={generateMutation.isPending}
          >
            取消
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending || !prompt.trim() || enabledProviders.length === 0}
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                生成中...
              </>
            ) : (
              "生成视频"
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
