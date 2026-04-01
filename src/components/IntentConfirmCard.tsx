import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ImageIcon, Video, FileText, HelpCircle } from "lucide-react";
import { useTranslation } from 'react-i18next';

interface IntentConfirmCardProps {
  intent: 'image_generation' | 'video_generation' | 'document_processing' | 'general_chat';
  confidence: number;
  reasoning: string;
  imageUrl: string;
  onConfirm: (intent: string) => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

export function IntentConfirmCard({
  intent,
  confidence,
  reasoning,
  imageUrl,
  onConfirm,
  onCancel,
  isProcessing = false
}: IntentConfirmCardProps) {
  const { t } = useTranslation();

  const getIntentInfo = () => {
    switch (intent) {
      case 'image_generation':
        return {
          icon: <ImageIcon className="h-5 w-5" />,
          title: t('chat.intentConfirm.imageGeneration', '生成图片'),
          description: t('chat.intentConfirm.imageGenerationDesc', '根据这张图片生成类似风格或主题的新图片'),
          confirmText: t('chat.intentConfirm.generateImage', '生成图片'),
          color: 'text-blue-500'
        };
      case 'video_generation':
        return {
          icon: <Video className="h-5 w-5" />,
          title: t('chat.intentConfirm.videoGeneration', '生成视频'),
          description: t('chat.intentConfirm.videoGenerationDesc', '基于这张图片生成动态视频'),
          confirmText: t('chat.intentConfirm.generateVideo', '生成视频'),
          color: 'text-purple-500'
        };
      case 'document_processing':
        return {
          icon: <FileText className="h-5 w-5" />,
          title: t('chat.intentConfirm.documentProcessing', '处理文档'),
          description: t('chat.intentConfirm.documentProcessingDesc', '识别文字、批改作业或解析文档内容'),
          confirmText: t('chat.intentConfirm.processDocument', '处理文档'),
          color: 'text-green-500'
        };
      default:
        return {
          icon: <HelpCircle className="h-5 w-5" />,
          title: t('chat.intentConfirm.generalChat', '普通对话'),
          description: t('chat.intentConfirm.generalChatDesc', '讨论或分析这张图片'),
          confirmText: t('chat.intentConfirm.continueChat', '继续对话'),
          color: 'text-gray-500'
        };
    }
  };

  const intentInfo = getIntentInfo();

  return (
    <Card className="border-2 border-primary/20 bg-primary/5">
      <CardContent className="p-4 space-y-3">
        {/* 标题 */}
        <div className="flex items-center gap-2">
          <div className={intentInfo.color}>
            {intentInfo.icon}
          </div>
          <h3 className="font-semibold text-base">
            {t('chat.intentConfirm.title', '检测到您的意图')}
          </h3>
        </div>

        {/* 图片预览 */}
        <div className="flex gap-3">
          <img 
            src={imageUrl} 
            alt="Uploaded" 
            className="w-20 h-20 object-cover rounded-lg border border-border"
          />
          <div className="flex-1 space-y-1">
            <p className="text-sm font-medium">{intentInfo.title}</p>
            <p className="text-xs text-muted-foreground">{intentInfo.description}</p>
            <p className="text-xs text-muted-foreground">
              {t('chat.intentConfirm.confidence', '置信度')}: {(confidence * 100).toFixed(0)}%
            </p>
          </div>
        </div>

        {/* 分析原因 */}
        {reasoning && (
          <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
            <span className="font-medium">{t('chat.intentConfirm.reasoning', '分析原因')}：</span>
            {reasoning}
          </div>
        )}

        {/* 操作按钮 */}
        <div className="flex gap-2 pt-1">
          <Button
            onClick={() => onConfirm(intent)}
            disabled={isProcessing}
            className="flex-1"
            size="sm"
          >
            {isProcessing ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                {t('chat.intentConfirm.processing', '处理中...')}
              </>
            ) : (
              intentInfo.confirmText
            )}
          </Button>
          <Button
            onClick={onCancel}
            disabled={isProcessing}
            variant="outline"
            size="sm"
            className="flex-1"
          >
            {t('chat.intentConfirm.cancel', '取消')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
