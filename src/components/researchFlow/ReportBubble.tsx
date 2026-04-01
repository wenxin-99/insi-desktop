/**
 * researchFlow/ReportBubble.tsx — 研究/修复报告完成气泡（v2）
 *
 * 改进点：
 * 1. 自动识别任务类型（VPS修复 vs 深度研究 vs 对比分析）→ 差异化标头和配色
 * 2. 智能摘要提取：从 Markdown 中提取 "摘要/问题根因/验证结果" 等关键段落做预览
 * 3. 收起态显示摘要预览（~3 行），而不是硬截断 160px + 渐变遮罩
 * 4. 关键结论高亮标签（✅ 已修复 / ⚠️ 待处理 / ❌ 未解决）
 * 5. 操作按钮升级：复制 Markdown / 在新窗口查看（取代 hacky popup print）
 */
import { useState, useMemo } from 'react';
import {
  CheckCircle2, ChevronDown, ChevronUp, Copy, Check,
  XCircle, Clock, Globe, Footprints, Wrench, Search, GitCompare,
  ExternalLink, AlertTriangle, ShieldCheck, CircleDot,
} from 'lucide-react';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import { toast } from 'sonner';

// ── 任务类型 ──

type ReportType = 'repair' | 'research' | 'comparison' | 'generic';

interface ReportBubbleProps {
  report: string;
  status: 'completed' | 'failed';
  stepCount: number;
  browseCount: number;
  duration: string;
  /** 任务原始 prompt，用于辅助判断类型 */
  prompt?: string;
}

// ── 报告类型检测 ──

function detectReportType(report: string, prompt?: string): ReportType {
  const r = report + (prompt || '');
  // VPS 修复类
  if (/修复报告|修复措施|问题根因|修复完成|已修复|ssh|pm2|nginx|systemctl|部署|服务器/.test(r)) {
    return 'repair';
  }
  // 对比分析类
  if (/对比|区别|优缺点|横向|评测|vs\b/i.test(r)) {
    return 'comparison';
  }
  // 研究类（默认）
  if (/研究|调研|分析报告|摘要|数据来源|参考文献/.test(r)) {
    return 'research';
  }
  return 'generic';
}

// ── 主题配置 ──

const THEME: Record<ReportType, {
  icon: typeof CheckCircle2;
  label: string;
  gradient: string;
  borderColor: string;
  headerBg: string;
  accentColor: string;
  accentText: string;
}> = {
  repair: {
    icon: Wrench,
    label: '修复完成',
    gradient: 'from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20',
    borderColor: 'border-cyan-200 dark:border-cyan-800/30',
    headerBg: 'bg-gradient-to-r from-cyan-50 to-sky-50 dark:from-cyan-950/20 dark:to-sky-950/20',
    accentColor: 'bg-cyan-500',
    accentText: 'text-cyan-800 dark:text-cyan-300',
  },
  research: {
    icon: Search,
    label: '研究完成',
    gradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800/30',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20',
    accentColor: 'bg-emerald-500',
    accentText: 'text-emerald-800 dark:text-emerald-300',
  },
  comparison: {
    icon: GitCompare,
    label: '分析完成',
    gradient: 'from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20',
    borderColor: 'border-violet-200 dark:border-violet-800/30',
    headerBg: 'bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-950/20 dark:to-purple-950/20',
    accentColor: 'bg-violet-500',
    accentText: 'text-violet-800 dark:text-violet-300',
  },
  generic: {
    icon: CheckCircle2,
    label: '任务完成',
    gradient: 'from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20',
    borderColor: 'border-emerald-200 dark:border-emerald-800/30',
    headerBg: 'bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/20 dark:to-teal-950/20',
    accentColor: 'bg-emerald-500',
    accentText: 'text-emerald-800 dark:text-emerald-300',
  },
};

// ── 智能摘要提取 ──

interface SmartSummary {
  /** 概要文字（2-3 行） */
  preview: string;
  /** 关键结论标签 */
  tags: Array<{ text: string; type: 'success' | 'warning' | 'error' }>;
  /** 章节目录（h2/h3） */
  sections: string[];
}

function extractSmartSummary(report: string): SmartSummary {
  const tags: SmartSummary['tags'] = [];
  const sections: string[] = [];

  // 提取 h2/h3 标题作为章节目录
  const headingRe = /^#{2,3}\s+(.+)$/gm;
  let m;
  while ((m = headingRe.exec(report)) !== null) {
    sections.push(m[1].trim());
  }

  // 提取关键结论标签
  if (/已修复|已解决|修复成功|问题已解决|验证通过|✅/.test(report)) {
    tags.push({ text: '已修复', type: 'success' });
  }
  if (/待处理|待修复|未验证|需要关注|⚠️|后续建议/.test(report)) {
    tags.push({ text: '待跟进', type: 'warning' });
  }
  if (/未解决|修复失败|仍然存在|❌/.test(report)) {
    tags.push({ text: '未解决', type: 'error' });
  }
  if (/部署成功|上线|已生效/.test(report)) {
    tags.push({ text: '已部署', type: 'success' });
  }

  // 智能提取预览段落（优先级：摘要 > 问题根因 > 结论 > 验证结果 > 前 N 行）
  const previewPatterns = [
    /###?\s*摘要[^]*?\n([\s\S]*?)(?=\n###?\s|\n$|$)/,
    /###?\s*(?:问题根因|根因分析|问题分析)[^]*?\n([\s\S]*?)(?=\n###?\s|\n$|$)/,
    /###?\s*(?:结论|总结|结论与建议)[^]*?\n([\s\S]*?)(?=\n###?\s|\n$|$)/,
    /###?\s*(?:验证结果|测试结果)[^]*?\n([\s\S]*?)(?=\n###?\s|\n$|$)/,
    /###?\s*(?:修复措施|解决方案)[^]*?\n([\s\S]*?)(?=\n###?\s|\n$|$)/,
  ];

  let preview = '';
  for (const pattern of previewPatterns) {
    const match = report.match(pattern);
    if (match && match[1]) {
      const text = match[1].trim();
      if (text.length > 20) {
        preview = text;
        break;
      }
    }
  }

  // 回退：取第一个有意义的段落（跳过标题行）
  if (!preview) {
    const lines = report.split('\n').filter(l => {
      const t = l.trim();
      return t.length > 10 && !t.startsWith('#') && !t.startsWith('---') && !t.startsWith('```');
    });
    preview = lines.slice(0, 3).join('\n');
  }

  // 截断到合理长度
  if (preview.length > 200) {
    preview = preview.substring(0, 200).replace(/\s+\S*$/, '') + '…';
  }

  return { preview, tags, sections };
}

// ── 主组件 ──

export function ReportBubble({ report, status, stepCount, browseCount, duration, prompt }: ReportBubbleProps) {
  const [showFull, setShowFull] = useState(false);
  const [copied, setCopied] = useState(false);

  // 失败态
  if (status === 'failed') {
    return (
      <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
        <div className="rounded-xl border border-red-200 dark:border-red-900/40 bg-red-50/50 dark:bg-red-950/10 px-4 py-3">
          <div className="flex items-center gap-2 mb-1.5">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-[12px] font-semibold text-red-700 dark:text-red-400">任务执行失败</span>
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

  // 检测类型 + 提取摘要
  const reportType = useMemo(() => detectReportType(normalizedReport, prompt), [normalizedReport, prompt]);
  const summary = useMemo(() => extractSmartSummary(normalizedReport), [normalizedReport]);
  const theme = THEME[reportType];
  const Icon = theme.icon;

  // 复制
  const handleCopy = () => {
    navigator.clipboard.writeText(normalizedReport).then(() => {
      setCopied(true);
      toast.success('报告已复制到剪贴板');
      setTimeout(() => setCopied(false), 2000);
    }).catch(() => toast.error('复制失败'));
  };

  // 在新标签查看
  const handleOpenInNewTab = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${theme.label} — Insi 报告</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.1/github-markdown-light.min.css">
  <style>
    body { max-width: 860px; margin: 40px auto; padding: 0 24px; font-family: system-ui, -apple-system, sans-serif; }
    .markdown-body { font-size: 15px; line-height: 1.8; }
    @media (prefers-color-scheme: dark) {
      body { background: #0d1117; color: #c9d1d9; }
    }
    @media print { body { margin: 20px; } }
  </style>
</head>
<body class="markdown-body">${normalizedReport.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</body>
<script src="https://cdnjs.cloudflare.com/ajax/libs/marked/12.0.1/marked.min.js"><\/script>
<script>document.body.innerHTML = marked.parse(document.body.textContent || '');<\/script>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html' });
    window.open(URL.createObjectURL(blob), '_blank');
  };

  const hasLongContent = normalizedReport.length > 300;

  return (
    <div className="animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className={`rounded-xl border ${theme.borderColor} bg-background shadow-sm overflow-hidden`}>

        {/* ═══════ 标头：类型图标 + 标签 + 统计 ═══════ */}
        <div className={`flex items-center gap-2 px-4 py-2.5 ${theme.headerBg} border-b ${theme.borderColor}`}>
          <div className={`w-5 h-5 rounded-full ${theme.accentColor} flex items-center justify-center`}>
            <Icon className="w-3 h-3 text-white" />
          </div>
          <span className={`text-[12px] font-semibold ${theme.accentText}`}>{theme.label}</span>

          {/* 关键结论标签 */}
          {summary.tags.length > 0 && (
            <div className="flex items-center gap-1 ml-1">
              {summary.tags.map((tag, i) => (
                <span
                  key={i}
                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    tag.type === 'success'
                      ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      : tag.type === 'warning'
                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                        : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}
                >
                  {tag.type === 'success' ? <ShieldCheck className="w-2.5 h-2.5" /> :
                   tag.type === 'warning' ? <AlertTriangle className="w-2.5 h-2.5" /> :
                   <XCircle className="w-2.5 h-2.5" />}
                  {tag.text}
                </span>
              ))}
            </div>
          )}

          {/* 统计信息 */}
          <div className="ml-auto flex items-center gap-3 text-[10px] text-muted-foreground/60">
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
                {browseCount}页
              </span>
            )}
          </div>
        </div>

        {/* ═══════ 报告内容 ═══════ */}
        {normalizedReport && (
          <div className="px-4 py-3">
            {!showFull ? (
              /* ── 折叠态：智能摘要预览 ── */
              <div>
                {/* 摘要文字 */}
                {summary.preview && (
                  <p className="text-[13px] leading-relaxed text-foreground/75 mb-2">
                    {summary.preview}
                  </p>
                )}

                {/* 章节目录（超过 2 个章节时显示） */}
                {summary.sections.length > 2 && (
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {summary.sections.slice(0, 6).map((sec, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 text-[10px] text-muted-foreground"
                      >
                        <CircleDot className="w-2.5 h-2.5" />
                        {sec.length > 15 ? sec.substring(0, 15) + '…' : sec}
                      </span>
                    ))}
                    {summary.sections.length > 6 && (
                      <span className="text-[10px] text-muted-foreground/50 self-center">
                        +{summary.sections.length - 6}
                      </span>
                    )}
                  </div>
                )}

                {/* 展开按钮 */}
                {hasLongContent && (
                  <button
                    onClick={() => setShowFull(true)}
                    className="flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                  >
                    <ChevronDown className="w-3 h-3" />
                    展开完整报告
                    <span className="text-[10px] text-muted-foreground/50 ml-1">
                      ({Math.round(normalizedReport.length / 100) * 100}字)
                    </span>
                  </button>
                )}

                {/* 短报告直接全部显示 */}
                {!hasLongContent && (
                  <div className="text-[13px] leading-[1.8] prose prose-sm dark:prose-invert max-w-none
                    prose-headings:text-foreground/90 prose-headings:font-bold
                    prose-h2:text-sm prose-h3:text-sm
                    prose-p:text-foreground/80 prose-p:my-1.5
                    prose-strong:text-foreground/90
                    prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                    prose-code:text-[12px] prose-pre:text-[11px]">
                    <SafeMarkdown>{normalizedReport}</SafeMarkdown>
                  </div>
                )}
              </div>
            ) : (
              /* ── 展开态：完整报告 ── */
              <div>
                <div className="text-[13px] leading-[1.8] prose prose-sm dark:prose-invert max-w-none
                  prose-headings:text-foreground/90 prose-headings:font-bold
                  prose-h1:text-base prose-h2:text-sm prose-h3:text-sm
                  prose-p:text-foreground/80 prose-p:my-1.5
                  prose-strong:text-foreground/90
                  prose-ul:my-1 prose-ol:my-1 prose-li:my-0.5
                  prose-code:text-[12px] prose-pre:text-[11px]
                  max-h-[60vh] overflow-y-auto">
                  <SafeMarkdown>{normalizedReport}</SafeMarkdown>
                </div>
                <button
                  onClick={() => setShowFull(false)}
                  className="mt-2 flex items-center gap-1 text-[11px] text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  <ChevronUp className="w-3 h-3" />
                  收起报告
                </button>
              </div>
            )}
          </div>
        )}

        {/* ═══════ 操作按钮 ═══════ */}
        <div className="px-4 py-2 bg-muted/20 border-t border-border/60 flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] text-foreground/70 hover:border-primary/30 hover:text-primary transition-all shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? '已复制' : '复制'}
          </button>
          <button
            onClick={handleOpenInNewTab}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-background border border-border text-[11px] text-foreground/70 hover:border-border transition-all shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            新窗口查看
          </button>
        </div>
      </div>
    </div>
  );
}
