import React from "react";
import { FileText, FilePlus, CheckCircle2, Loader2, Brain, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface FileDiff {
  fileName: string;
  before: string;
  after: string;
}

interface OperationLog {
  id: string;
  action: string;
  target?: string;
  operationStatus: 'running' | 'completed';
  timestamp: number;
  diff?: FileDiff;  // 文件编辑时携带的差异数据
}

interface OperationLogPanelProps {
  logs: OperationLog[];
  onClear?: () => void;
}

export function OperationLogPanel({ logs, onClear }: OperationLogPanelProps) {
  const [expandedDiffs, setExpandedDiffs] = React.useState<Set<string>>(new Set());
  
  const toggleDiff = (id: string) => {
    setExpandedDiffs(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // 过滤掉内部操作（用户不需要看到的技术细节）
  const hiddenPatterns = [
    '正在调用AI模型', 'AI模型调用完成',  // 模型调用
    '正在更新配额', '配额更新完成',       // 配额更新
    '正在处理文档', '文档处理完成',       // 文档配额
    '对话配额', '图片配额',              // 配额target
  ];
  
  const visibleLogs = logs.filter(log => {
    return !hiddenPatterns.some(p => log.action.includes(p) || (log.target && log.target.includes(p)));
  });

  // 合并 running -> completed 对，只保留 completed 版本
  const mergedLogs = visibleLogs.reduce((acc: OperationLog[], log) => {
    if (log.operationStatus === 'completed') {
      // 如果有对应的 running 版本，替换它
      const runningIdx = acc.findIndex(l => 
        l.operationStatus === 'running' && l.target === log.target
      );
      if (runningIdx >= 0) {
        acc[runningIdx] = log;
        return acc;
      }
    }
    acc.push(log);
    return acc;
  }, []);

  // 限制最多显示10条，保留最新的
  const displayLogs = mergedLogs.slice(-10);
  if (visibleLogs.length === 0) {
    return null;
  }

  const getIcon = (log: OperationLog) => {
    if (log.operationStatus === 'running') {
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    }
    return <CheckCircle2 className="h-4 w-4 text-green-500" />;
  };

  // 美化操作名称，对用户更友好
  const getFriendlyAction = (action: string, target?: string) => {
    if (action.includes('读取文件')) return '读取文件';
    if (action.includes('解压')) return '解压文件';
    if (action.includes('解析文件')) return '解析文件';
    if (action.includes('提取关键代码')) return '分析代码结构';
    if (action.includes('代码提取完成')) return '代码分析完成';
    if (action.includes('文件读取完成')) return '文件读取完成';
    if (action.includes('分析文件内容')) return '分析文件内容';
    if (action.includes('文件分析就绪')) return '文件加载完成';
    if (action.includes('分析图片')) return '识别图片内容';
    if (action.includes('图片内容分析完成')) return '图片识别完成';
    if (action.includes('生成文件')) return '生成文件';
    if (action.includes('生成图片')) return '生成图片';
    if (action.includes('图片生成完成')) return '图片生成完成';
    return action;
  };

  const getActionIcon = (action: string) => {
    if (action.includes('生成文件') || action.includes('生成')) {
      return <FilePlus className="h-4 w-4 text-green-500" />;
    }
    if (action.includes('文件') || action.includes('读取') || action.includes('解析') || action.includes('解压') || action.includes('编辑') || action.includes('修改') || action.includes('写入') || action.includes('代码')) {
      return <FileText className="h-4 w-4 text-blue-400" />;
    }
    if (action.includes('图片') || action.includes('识别')) {
      return <Brain className="h-4 w-4 text-purple-400" />;
    }
    return <FileText className="h-4 w-4 text-gray-400" />;
  };
  
  // 渲染 diff 高亮对比
  const renderDiff = (diff: FileDiff) => {
    const beforeLines = diff.before.split('\n');
    const afterLines = diff.after.split('\n');
    
    // 简单行级 diff：标记删除/新增行
    const allLines: Array<{text: string; type: 'removed' | 'added' | 'unchanged'}> = [];
    const maxLen = Math.max(beforeLines.length, afterLines.length);
    for (let i = 0; i < maxLen; i++) {
      const b = beforeLines[i];
      const a = afterLines[i];
      if (b === a) {
        allLines.push({ text: b ?? '', type: 'unchanged' });
      } else {
        if (b !== undefined) allLines.push({ text: b, type: 'removed' });
        if (a !== undefined) allLines.push({ text: a, type: 'added' });
      }
    }
    
    return (
      <div className="mt-2 rounded-md border border-border overflow-hidden text-[11px] font-mono">
        <div className="flex border-b border-border">
          <div className="flex-1 px-2 py-1 text-center text-xs text-muted-foreground bg-red-50 dark:bg-red-950/20 border-r border-border">修改前</div>
          <div className="flex-1 px-2 py-1 text-center text-xs text-muted-foreground bg-green-50 dark:bg-green-950/20">修改后</div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {allLines.map((line, i) => (
            <div
              key={i}
              className={`px-2 py-0.5 flex items-start gap-1 ${
                line.type === 'removed' ? 'bg-red-50 dark:bg-red-950/20 text-red-700 dark:text-red-300' :
                line.type === 'added' ? 'bg-green-50 dark:bg-green-950/20 text-green-700 dark:text-green-300' :
                'text-muted-foreground'
              }`}
            >
              <span className="flex-shrink-0 select-none opacity-50">
                {line.type === 'removed' ? '-' : line.type === 'added' ? '+' : ' '}
              </span>
              <span className="whitespace-pre-wrap break-all">{line.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Brain className="h-4 w-4" />
            处理进度
            {visibleLogs.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                ({displayLogs.length})
              </span>
            )}
          </CardTitle>
          {visibleLogs.length > 0 && onClear && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onClear}
              className="h-7 px-2 text-xs"
            >
              <Trash2 className="h-3 w-3 mr-1" />
              清空
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {displayLogs.map((log) => (
          <div key={log.id}>
            <div
              className={`flex items-start gap-2 text-sm p-2 rounded-lg bg-muted/50 transition-colors ${log.diff ? 'cursor-pointer hover:bg-muted' : ''}`}
              onClick={() => log.diff && toggleDiff(log.id)}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getIcon(log)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  {getActionIcon(log.action)}
                  <span className="font-medium text-foreground">
                    {getFriendlyAction(log.action, log.target)}
                  </span>
                  {log.diff && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
                      查看diff
                    </span>
                  )}
                </div>
                {log.target && (
                  <div className="text-xs text-muted-foreground mt-0.5 truncate">
                    {log.target}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                {log.diff && (
                  expandedDiffs.has(log.id)
                    ? <ChevronUp className="h-3 w-3 text-muted-foreground" />
                    : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                )}
              </div>
            </div>
            {/* diff 展开区域 */}
            {log.diff && expandedDiffs.has(log.id) && (
              <div className="px-2 pb-2">
                <div className="text-xs font-medium text-muted-foreground mb-1">{log.diff.fileName}</div>
                {renderDiff(log.diff)}
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
