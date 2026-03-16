/**
 * researchFlow/ReportBubble.tsx — 研究报告完成气泡
 *
 * 任务完成后展示的富文本报告卡片：
 * - 完成标头（对勾 + 统计摘要）
 * - 报告正文（默认截断，可展开）
 * - 操作按钮（导出/查看来源）
 */
import { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, FileText, ExternalLink, XCircle, Clock, Globe, Footprints } from 'lucide-react';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import { toast } from 'sonner';

interface ReportBubbleProps {
  report: string;
  status: 'completed' | 'failed';
  stepCount: number;
  browseCount: number;
  duration: string;   // e.g. "3m24s"
}

export function ReportBubble({ report, status, stepCount, browseCount, duration }: ReportBubbleProps) {
  const [showFull, setShowFull] = useState(false);

  if (status === 'failed') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-[12px] font-semibold text-red-700 dark:text-red-400">研究任务失败</span>
            <span className="text-[10px] text-red-500/60 ml-auto">{duration}</span>
          </div>
          <p className="text-[12px] text-red-600/70 dark:text-red-400/60">
            执行过程中遇到错误，已自动退还额度。你可以尝试重新提问。
          </p>
        </div>
      </div>
    );
  }

  // 规范化报告内容
  const normalizedReport = report
    .replace(/\\\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t');

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="rounded-xl border border-border bg-background shadow-sm overflow-hidden">
        {/* 完成标头 */}
        <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20 border-b border-emerald-100 dark:border-emerald-900/30">
          <div className="w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
            <CheckCircle2 className="w-3 h-3 text-white" />
          </div>
          <span className="text-[12px] font-semibold text-emerald-800 dark:text-emerald-300">研究完成</span>
          <div className="ml-auto flex items-center gap-3 text-[10px] text-emerald-600/60 dark:text-emerald-400/40">
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {duration}
            </span>
            <span className="flex items-center gap-1">
              <Footprints className="w-3 h-3" />
              {stepCount}步
            </span>
            {browseCount > 0 && (
              <span className="flex items-center gap-1">
                <Globe className="w-3 h-3" />
                {browseCount}个网页
              </span>
            )}
          </div>
        </div>

        {/* 报告正文 */}
        {normalizedReport && (
          <div className="px-4 py-3">
            <div
              className={`text-[13px] leading-[1.8] prose prose-sm dark:prose-invert max-w-none
                prose-headings:text-foreground/90 prose-headings:font-bold
                prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
                prose-p:text-foreground/80 prose-p:my-1.5
                prose-strong:text-foreground/90
                prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                prose-code:text-[12px] prose-pre:text-[11px]
                ${showFull ? '' : 'max-h-[160px] overflow-hidden relative'}`}
            >
              <SafeMarkdown>{normalizedReport}</SafeMarkdown>
              {!showFull && (
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-background to-transparent" />
              )}
            </div>
            <button
              onClick={() => setShowFull(!showFull)}
              className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
            >
              {showFull ? (
                <>
                  <ChevronUp className="w-3 h-3" />
                  收起报告
                </>
              ) : (
                <>
                  <ChevronDown className="w-3 h-3" />
                  展开完整报告
                </>
              )}
            </button>
          </div>
        )}

        {/* 操作按钮 */}
        <div className="px-4 py-2.5 bg-muted/30 border-t border-border flex gap-2">
          <button onClick={() => { const w = window.open("", "_blank"); if (w) { w.document.write("<html><head><title>研究报告</title><style>body{font-family:system-ui;max-width:800px;margin:40px auto;padding:0 20px;line-height:1.8;}</style></head><body>" + document.querySelector(".prose")?.innerHTML + "</body></html>"); w.document.close(); w.print(); } else { toast.error("弹窗被拦截，请允许弹窗"); } }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-[11px] text-foreground/70 hover:border-primary/30 hover:text-primary transition-all shadow-sm">
            <FileText className="w-3.5 h-3.5" />
            导出 PDF
          </button>
          <button onClick={() => { navigator.clipboard.writeText(normalizedReport).then(() => toast.success("报告内容已复制到剪贴板")).catch(() => toast.error("复制失败")); }} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-background border border-border text-[11px] text-foreground/70 hover:border-border transition-all shadow-sm">
            <ExternalLink className="w-3.5 h-3.5" />
            复制报告内容
          </button>
        </div>
      </div>
    </div>
  );
}
