/**
 * modelManagement/VideoCostFields — 视频生成费用配置
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ModelFormData } from "./types";

interface VideoCostFieldsProps {
  formData: ModelFormData;
  setFormData: (updater: ModelFormData | ((prev: ModelFormData) => ModelFormData)) => void;
}

export function VideoCostFields({ formData, setFormData }: VideoCostFieldsProps) {
  return (
    <div className="border-t pt-4">
      <h3 className="font-semibold mb-3">🎬 视频生成费用配置</h3>
      <p className="text-sm text-muted-foreground mb-3">
        设置不同时长的视频生成🐟币费用（原「视频API配置」已合并至此）
      </p>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>5秒视频费用（🐟币）</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.videoCost5s}
            onChange={(e) =>
              setFormData((prev: ModelFormData) => ({ ...prev, videoCost5s: e.target.value }))
            }
            placeholder="30"
          />
        </div>
        <div>
          <Label>10秒视频费用（🐟币）</Label>
          <Input
            type="number"
            step="0.1"
            min="0"
            value={formData.videoCost10s}
            onChange={(e) =>
              setFormData((prev: ModelFormData) => ({ ...prev, videoCost10s: e.target.value }))
            }
            placeholder="50"
          />
        </div>
      </div>
    </div>
  );
}
