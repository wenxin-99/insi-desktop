/**
 * imageGallery/EditPromptDialog — 编辑描述重新生成对话框
 */
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";

interface EditPromptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt: string;
  onPromptChange: (value: string) => void;
  onRegenerate: (prompt: string) => void;
  isRegenerating: boolean;
}

export function EditPromptDialog({
  open, onOpenChange, prompt, onPromptChange, onRegenerate, isRegenerating,
}: EditPromptDialogProps) {
  const { t } = useTranslation();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("imageGallery.editDialog.title")}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">{t("imageGallery.prompt")}</label>
            <textarea
              value={prompt}
              onChange={(e) => onPromptChange(e.target.value)}
              className="w-full mt-2 p-2 border rounded-md min-h-[100px]"
              placeholder={t("imageGallery.editDialog.placeholder")}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
              {t("imageGallery.editDialog.cancel")}
            </Button>
            <Button onClick={() => onRegenerate(prompt)} disabled={isRegenerating || !prompt.trim()} className="flex-1">
              {isRegenerating ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" />{t("imageGallery.toast.downloadingZip")}</>
              ) : (
                t("imageGallery.editDialog.regenerate")
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
