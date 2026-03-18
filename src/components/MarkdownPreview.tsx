import { SafeMarkdown } from "@/components/SafeMarkdown";
import { Card } from "@/components/ui/card";

interface MarkdownPreviewProps {
  content: string;
}

/**
 * MarkdownPreview组件
 * 
 * 实时预览Markdown渲染效果
 * 
 * 特性：
 * - 实时渲染Markdown内容
 * - 支持LaTeX数学公式
 * - 支持代码语法高亮
 * - 支持代码高亮行
 * 
 * 使用方法：
 * <MarkdownPreview content={inputText} />
 */
export function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <Card className="p-4 h-full overflow-y-auto">
      {content ? (
        <SafeMarkdown>{content}</SafeMarkdown>
      ) : (
        <div className="text-muted-foreground text-center py-8">
          在输入框中输入Markdown内容，这里将实时显示渲染效果
        </div>
      )}
    </Card>
  );
}
