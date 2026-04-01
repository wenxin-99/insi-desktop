/**
 * homeworkHistory/ShareDialog — 分享链接对话框
 */
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Share2 } from "lucide-react";
import { useRef } from "react";
import { isMobileDevice } from "@/utils/clipboard";

interface ShareDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  shareToken: string;
  onCopyLink: () => void;
}

export function ShareDialog({ open, onOpenChange, shareToken, onCopyLink }: ShareDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const shareUrl = `${window.location.origin}/share/${shareToken}`;
  const isMobile = isMobileDevice();

  const handleSelectAll = () => {
    inputRef.current?.select();
    inputRef.current?.setSelectionRange(0, shareUrl.length);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>分享批改报告</DialogTitle>
          <DialogDescription>
            {isMobile ? '点击下方按钮分享或复制链接' : '复制下方链接分享给家长或老师'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            ref={inputRef}
            value={shareUrl}
            readOnly
            onClick={handleSelectAll}
            className="text-sm font-mono"
            style={{ fontSize: '16px' }} // 防止 iOS Safari 自动缩放
          />
          <Button onClick={onCopyLink} className="w-full gap-2">
            {isMobile && navigator.share ? (
              <>
                <Share2 className="h-4 w-4" />
                分享链接
              </>
            ) : (
              <>
                <Copy className="h-4 w-4" />
                复制链接
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
