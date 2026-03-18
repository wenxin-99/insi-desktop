import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Loader2, Settings } from "lucide-react";
import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface PdfExportSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PdfExportSettingsDialog({
  open,
  onOpenChange,
}: PdfExportSettingsDialogProps) {
  const [watermarkText, setWatermarkText] = useState<string>("");
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [showStudentName, setShowStudentName] = useState(true);
  const [headerContent, setHeaderContent] = useState<string>("");
  const [footerContent, setFooterContent] = useState<string>("");
  const [showPageNumber, setShowPageNumber] = useState(true);

  // 获取用户PDF设置
  const { data: settings, isLoading, refetch } = trpc.userPdfSettings.getSettings.useQuery();

  // 更新用户PDF设置
  const updateSettings = trpc.userPdfSettings.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("PDF导出设置已保存");
      refetch();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error(`保存失败: ${error.message}`);
    },
  });

  // 加载用户设置
  useEffect(() => {
    if (settings) {
      setWatermarkText(settings.watermarkText || "");
      setWatermarkEnabled(settings.watermarkEnabled);
      setShowStudentName(settings.showStudentName);
      setHeaderContent(settings.headerContent || "");
      setFooterContent(settings.footerContent || "");
      setShowPageNumber(settings.showPageNumber);
    }
  }, [settings]);

  const handleSave = () => {
    updateSettings.mutate({
      watermarkText: watermarkText.trim() || null,
      watermarkEnabled,
      showStudentName,
      headerContent: headerContent.trim() || null,
      footerContent: footerContent.trim() || null,
      showPageNumber,
    });
  };

  const handleReset = () => {
    setWatermarkText("");
    setWatermarkEnabled(true);
    setShowStudentName(true);
    setHeaderContent("");
    setFooterContent("");
    setShowPageNumber(true);
    // 同时保存到服务端
    updateSettings.mutate({
      watermarkText: null,
      watermarkEnabled: true,
      showStudentName: true,
      headerContent: null,
      footerContent: null,
      showPageNumber: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            PDF导出设置
          </DialogTitle>
          <DialogDescription>
            自定义PDF导出的水印、页眉页脚等内容
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* 水印设置 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="watermark-enabled" className="text-base font-semibold">
                    启用水印
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    在PDF中显示水印文字
                  </p>
                </div>
                <Switch
                  id="watermark-enabled"
                  checked={watermarkEnabled}
                  onCheckedChange={setWatermarkEnabled}
                />
              </div>

              {watermarkEnabled && (
                <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                  <Label htmlFor="watermark-text">水印文字</Label>
                  <Input
                    id="watermark-text"
                    placeholder="留空使用默认水印（仅供学习使用）"
                    value={watermarkText}
                    onChange={(e) => setWatermarkText(e.target.value)}
                    maxLength={50}
                  />
                  <p className="text-xs text-muted-foreground">
                    自定义水印文字，留空则使用默认水印
                  </p>
                </div>
              )}
            </div>

            {/* 学生姓名显示 */}
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="show-student-name" className="text-base font-semibold">
                  显示学生姓名
                </Label>
                <p className="text-sm text-muted-foreground">
                  在PDF封面和页眉中显示学生姓名
                </p>
              </div>
              <Switch
                id="show-student-name"
                checked={showStudentName}
                onCheckedChange={setShowStudentName}
              />
            </div>

            {/* 页眉设置 */}
            <div className="space-y-2">
              <Label htmlFor="header-content">自定义页眉</Label>
              <Textarea
                id="header-content"
                placeholder="留空使用默认页眉（学生姓名 | 科目 | 日期）"
                value={headerContent}
                onChange={(e) => setHeaderContent(e.target.value)}
                rows={2}
                maxLength={200}
              />
              <p className="text-xs text-muted-foreground">
                自定义页眉内容，留空则使用默认格式
              </p>
            </div>

            {/* 页脚设置 */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="show-page-number" className="text-base font-semibold">
                    显示页码
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    在页脚显示页码（第 X 页 / 共 Y 页）
                  </p>
                </div>
                <Switch
                  id="show-page-number"
                  checked={showPageNumber}
                  onCheckedChange={setShowPageNumber}
                />
              </div>

              <div className="space-y-2 pl-4 border-l-2 border-primary/20">
                <Label htmlFor="footer-content">自定义页脚</Label>
                <Textarea
                  id="footer-content"
                  placeholder="留空使用默认页脚（页码）"
                  value={footerContent}
                  onChange={(e) => setFooterContent(e.target.value)}
                  rows={2}
                  maxLength={200}
                />
                <p className="text-xs text-muted-foreground">
                  自定义页脚内容，留空则使用默认格式
                </p>
              </div>
            </div>

            {/* 提示信息 */}
            <div className="bg-muted/50 p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground">
                💡 <strong>提示：</strong>所有设置都会应用到您导出的所有PDF文件中。留空的字段将使用系统默认值。
              </p>
            </div>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleReset}
            disabled={updateSettings.isPending}
          >
            重置为默认
          </Button>
          <Button
            onClick={handleSave}
            disabled={updateSettings.isPending}
          >
            {updateSettings.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            保存设置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
