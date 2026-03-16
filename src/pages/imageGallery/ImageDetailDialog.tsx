/**
 * imageGallery/ImageDetailDialog — 图片详情灯箱对话框
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Heart, Download, Trash2, Edit, RefreshCw, Loader2 } from "lucide-react";

interface ImageDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  image: any;
  isRegenerating: boolean;
  onToggleFavorite: () => void;
  onDownload: () => void;
  onDelete: () => void;
  onRegenerate: () => void;
  onOpenEdit: () => void;
  favoritePending: boolean;
  deletePending: boolean;
}

export function ImageDetailDialog({
  open, onOpenChange, image, isRegenerating,
  onToggleFavorite, onDownload, onDelete, onRegenerate, onOpenEdit,
  favoritePending, deletePending,
}: ImageDetailDialogProps) {
  const { t } = useTranslation();
  if (!image) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t("imageGallery.prompt")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="relative w-full bg-muted rounded-lg overflow-hidden">
            <img src={image.imageUrl} alt={image.prompt} className="w-full h-auto" />
          </div>
          <div>
            <h4 className="text-sm font-semibold mb-1">{t("imageGallery.prompt")}</h4>
            <p className="text-sm text-muted-foreground">{image.prompt}</p>
          </div>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">{t("imageGallery.createdAt")}:</span>
              <span className="ml-2">{new Date(image.createdAt).toLocaleString()}</span>
            </div>
            <div>
              <span className="text-muted-foreground">消费：</span>
              <span className="ml-2">{Number(image.cost).toFixed(2)} 🐟币</span>
            </div>
          </div>
          <div className="flex flex-col gap-2 pt-4">
            <div className="flex gap-2">
              <Button variant="outline" onClick={onOpenEdit} className="flex-1">
                <Edit className="h-4 w-4 mr-2" /> {t("imageGallery.edit")}
              </Button>
              <Button variant="outline" onClick={onRegenerate} disabled={isRegenerating} className="flex-1">
                {isRegenerating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                {t("imageGallery.regenerate")}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onToggleFavorite} disabled={favoritePending} className="flex-1">
                <Heart className={`h-4 w-4 mr-2 ${image.isFavorite ? "fill-red-500 text-red-500" : ""}`} />
                {image.isFavorite ? t("imageGallery.unfavorite") : t("imageGallery.favorite")}
              </Button>
              <Button variant="outline" onClick={onDownload} className="flex-1">
                <Download className="h-4 w-4 mr-2" /> {t("imageGallery.download")}
              </Button>
              <Button variant="destructive" onClick={onDelete} disabled={deletePending} className="flex-1">
                <Trash2 className="h-4 w-4 mr-2" /> {t("imageGallery.delete")}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
