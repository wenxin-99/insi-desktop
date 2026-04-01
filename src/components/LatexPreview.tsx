import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Eye, EyeOff } from 'lucide-react';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import { hasLatexCommands } from '@/lib/latexUtils';

interface LatexPreviewProps {
  text: string;
  className?: string;
}

/**
 * LaTeX实时预览组件
 * 
 * 特性：
 * - 自动检测文本中的LaTeX命令
 * - 实时渲染LaTeX公式预览
 * - 可折叠/展开预览窗口
 * - 只在包含LaTeX命令时显示
 */
export function LatexPreview({ text, className = '' }: LatexPreviewProps) {
  const [isVisible, setIsVisible] = useState(true);
  const [hasLatex, setHasLatex] = useState(false);
  
  useEffect(() => {
    // 检测文本中是否包含LaTeX命令
    const containsLatex = hasLatexCommands(text);
    setHasLatex(containsLatex);
  }, [text]);
  
  // 如果没有LaTeX命令，不显示预览
  if (!hasLatex || !text.trim()) {
    return null;
  }
  
  return (
    <Card className={`p-3 bg-muted/50 border-border ${className}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
            LaTeX预览
          </span>
          <span className="text-xs text-muted-foreground">
            实时渲染数学公式
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsVisible(!isVisible)}
          className="h-7 px-2"
        >
          {isVisible ? (
            <>
              <EyeOff className="h-4 w-4 mr-1" />
              <span className="text-xs">隐藏</span>
            </>
          ) : (
            <>
              <Eye className="h-4 w-4 mr-1" />
              <span className="text-xs">显示</span>
            </>
          )}
        </Button>
      </div>
      
      {isVisible && (
        <div className="mt-2 p-3 bg-background rounded-md border border-border max-h-48 overflow-y-auto">
          <SafeMarkdown className="text-sm">
            {text}
          </SafeMarkdown>
        </div>
      )}
    </Card>
  );
}
