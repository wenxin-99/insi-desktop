/**
 * automationCard/TaskCompletionSummary — 任务完成/失败总结卡片
 */
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Link2, FileText as FileTextIcon, FileText } from "lucide-react";
import { formatRelativeTime } from "./stepUtils";
import type { TaskSummary, ContentInfo } from "./types";

export function TaskCompletionSummary({ summary, contentInfo, taskStatus }: { 
  summary: TaskSummary | null; 
  contentInfo: ContentInfo | null;
  taskStatus: string;
}) {
  const isCompleted = taskStatus === "completed";
  const isFailed = taskStatus === "failed";

  // 从 contentInfo 或 summary.contentInfo 获取信息
  const publishedUrl = contentInfo?.publishedUrl || summary?.contentInfo?.publishedUrl || summary?.finalUrl;
  const publishStatus = contentInfo?.publishStatus || summary?.contentInfo?.publishStatus;
  const title = contentInfo?.title || summary?.contentInfo?.title || summary?.finalTitle;
  const contentLength = contentInfo?.content?.length || summary?.contentInfo?.contentLength || 0;
  const contentPreview = contentInfo?.content?.substring(0, 150) || summary?.contentInfo?.contentPreview || "";
  const publishedAt = contentInfo?.publishedAt || summary?.contentInfo?.publishedAt || summary?.completedAt;
  const totalSteps = summary?.totalSteps || 0;

  if (isFailed) {
    return (
      <div className="px-4 py-3 bg-red-50/50 dark:bg-red-950/20 border-t border-red-200/50">
        <div className="flex items-center gap-2 mb-2">
          <XCircle className="h-4 w-4 text-red-500" />
          <span className="text-sm font-medium text-red-700 dark:text-red-400">任务执行失败</span>
        </div>
        <p className="text-xs text-red-600/80 dark:text-red-400/80">
          任务未能完成，可能是由于网络问题或页面结构变化。请检查详情后重试。
        </p>
      </div>
    );
  }

  if (!isCompleted) return null;

  return (
    <div className="px-4 py-3 bg-green-50/50 dark:bg-green-950/20 border-t border-green-200/50">
      {/* 成功标题 */}
      <div className="flex items-center gap-2 mb-3">
        <CheckCircle2 className="h-4 w-4 text-green-500" />
        <span className="text-sm font-medium text-green-700 dark:text-green-400">
          {publishStatus === "published" ? "发布成功" : "任务完成"}
        </span>
        {publishedAt && (
          <span className="text-xs text-muted-foreground ml-auto">
            {formatRelativeTime(publishedAt)}
          </span>
        )}
      </div>

      {/* 运营信息卡片 */}
      <div className="space-y-2.5">
        {/* 帖子标题 */}
        {title && (
          <div className="flex items-start gap-2">
            <FileTextIcon className="h-3.5 w-3.5 text-green-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">帖子标题</div>
              <div className="text-sm font-medium truncate">{title}</div>
            </div>
          </div>
        )}

        {/* 发布链接 */}
        {publishedUrl && (
          <div className="flex items-start gap-2">
            <Link2 className="h-3.5 w-3.5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">发布地址</div>
              <a 
                href={publishedUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline truncate block"
              >
                {publishedUrl}
              </a>
            </div>
          </div>
        )}

        {/* 内容摘要 */}
        {contentPreview && (
          <div className="flex items-start gap-2">
            <FileText className="h-3.5 w-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">
                内容摘要 {contentLength > 0 && `(${contentLength}字)`}
              </div>
              <div className="text-xs text-foreground/70 line-clamp-2 mt-0.5">
                {contentPreview.replace(/[#*>`\-]/g, '').trim()}
                {contentPreview.length >= 150 ? '...' : ''}
              </div>
            </div>
          </div>
        )}

        {/* 统计信息 */}
        <div className="flex items-center gap-4 pt-1 border-t border-green-200/30 dark:border-green-800/30">
          <div className="text-xs text-muted-foreground">
            共 <span className="font-medium text-foreground">{totalSteps}</span> 步操作
          </div>
          {publishStatus === "published" && (
            <Badge variant="outline" className="text-xs h-5 bg-green-100/50 text-green-700 border-green-300/50">
              已发布
            </Badge>
          )}
        </div>
      </div>
    </div>
  );
}
