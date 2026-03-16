import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, X, Loader2, Share2, ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface PdfPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pdfUrl: string | null;
  title: string;
  onDownload?: () => void;
}

/** 检测 iOS（包括 iPad） */
function isIOS(): boolean {
  return /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

/**
 * iOS 专用：通过原生分享面板保存 PDF
 * navigator.share({ files }) 在 iOS 15+ 可用，会弹出系统分享面板，
 * 用户可以选择"存储到文件"来保存 PDF。
 */
async function iosShareFile(url: string, filename: string): Promise<boolean> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error('fetch failed');
    const blob = await resp.blob();
    const file = new File([blob], filename, { type: 'application/pdf' });

    // 检查浏览器是否支持分享文件
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        title: filename,
        files: [file],
      });
      return true;
    }
  } catch (err: any) {
    // 用户取消分享 (AbortError) 不算失败
    if (err?.name === 'AbortError') return true;
    console.warn('[iOS PDF] share files failed:', err);
  }
  return false;
}

/**
 * 桌面端：fetch blob + object URL 下载
 */
async function desktopDownload(url: string, filename: string): Promise<void> {
  const resp = await fetch(url);
  if (!resp.ok) throw new Error('fetch failed');
  const blob = await resp.blob();
  const blobUrl = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();

  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  }, 1500);
}

export function PdfPreviewDialog({
  open,
  onOpenChange,
  pdfUrl,
  title,
  onDownload,
}: PdfPreviewDialogProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const ios = isIOS();

  const handleDownload = async () => {
    if (!pdfUrl) return;

    if (onDownload) {
      onDownload();
      return;
    }

    const filename = `${title}.pdf`;
    setIsDownloading(true);

    try {
      if (ios) {
        // iOS: 优先用原生分享面板（最可靠的保存方式）
        const shared = await iosShareFile(pdfUrl, filename);
        if (shared) {
          toast.success('请在分享面板中选择「存储到文件」');
        } else {
          // 分享不可用，直接打开 PDF 让用户手动保存
          window.open(pdfUrl, '_blank');
          toast.info("PDF已在新页面打开，请点击Safari底部的分享按钮保存", { duration: 6000 });
        }
      } else {
        // 桌面端：blob 下载
        await desktopDownload(pdfUrl, filename);
        toast.success("PDF下载已开始");
      }
    } catch {
      // 最终兜底：直接打开链接
      window.open(pdfUrl, '_blank');
      if (ios) {
        toast.info("PDF已在新页面打开，请点击Safari底部的分享按钮保存", { duration: 6000 });
      } else {
        toast.info("PDF已在新标签打开，请使用浏览器保存功能");
      }
    } finally {
      setIsDownloading(false);
    }
  };

  /** iOS 上直接在 Safari 中打开 PDF（Safari 原生 PDF 查看器有保存按钮） */
  const handleOpenInBrowser = () => {
    if (pdfUrl) {
      window.open(pdfUrl, '_blank');
      toast.info('在Safari中点击底部分享按钮 → 存储到「文件」', { duration: 6000 });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b">
          <DialogTitle className="text-xl font-bold">{title}</DialogTitle>
          <DialogDescription>
            {ios ? '点击下方按钮保存PDF到手机' : '预览PDF文件，确认无误后可下载保存'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 relative overflow-hidden px-6">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-10">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">正在加载PDF预览...</p>
              </div>
            </div>
          )}

          {pdfUrl ? (
            <iframe
              src={`${pdfUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full border-0 rounded-lg"
              title={title}
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                console.error('PDF加载失败');
              }}
            />
          ) : (
            <div className="flex items-center justify-center h-full">
              <p className="text-muted-foreground">暂无PDF预览</p>
            </div>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t flex-row justify-between sm:justify-between gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            关闭
          </Button>

          <div className="flex gap-2">
            {/* iOS 额外提供"在浏览器打开"按钮 */}
            {ios && (
              <Button
                variant="outline"
                onClick={handleOpenInBrowser}
                disabled={!pdfUrl}
                className="gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                <span className="hidden sm:inline">在Safari打开</span>
                <span className="sm:hidden">打开</span>
              </Button>
            )}

            <Button
              onClick={handleDownload}
              disabled={!pdfUrl || isDownloading}
              className="gap-2"
            >
              {isDownloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : ios ? (
                <Share2 className="h-4 w-4" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {ios ? '保存PDF' : '下载PDF'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
