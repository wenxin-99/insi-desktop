/**
 * SafeMarkdownWithDownload.tsx (v2)
 *
 * 相对 v1 的增量改动:
 * - props 新增 conversationId / messageIndex (可选), 透传给 CodeDiffGroup
 * - ```file:xxx.html``` 类型文件旁边增加沙盒预览按钮
 * - 其余逻辑(file:下载 / .docx拦截)完全保留
 */

import { SafeMarkdown } from "./SafeMarkdown";
import { Button } from "./ui/button";
import { Download } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { CodeDiffBlock } from "./CodeDiffBlock";
import { parseCodeDiffs, inlineReplaceBlocks, hasReplaceBlocks } from "@/lib/diffParser";
import { CodeSandboxPreview, isPreviewableCode } from "./CodeSandboxPreview";

interface SafeMarkdownWithDownloadProps {
  content: string;
  className?: string;
  streaming?: boolean;
  /** v2: 版本历史追踪 */
  conversationId?: string | number;
  messageIndex?: number;
  /** v3: 文件包下载链接 */
  filePackageUrl?: string;
}

export function SafeMarkdownWithDownload({
  content, className, streaming, conversationId, messageIndex, filePackageUrl,
}: SafeMarkdownWithDownloadProps) {
  const generateDocumentMutation = trpc.ai.generateDocument.useMutation();
  const [generatingDocs, setGeneratingDocs] = useState<Set<string>>(new Set());

  // ★ 下载按钮渲染函数（所有 return 路径共享）
  const renderDownloadButton = () => {
    if (!filePackageUrl) return null;
    const fileName = filePackageUrl.split('/').pop() || 'code-patch.tar.gz';
    return (
      <div className="mt-4 pt-4 border-t border-border/50">
        <div className="flex items-center gap-3 p-3 md:p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800/50">
          <div className="flex-shrink-0 w-10 h-10 md:w-12 md:h-12 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
            <svg className="h-5 w-5 md:h-6 md:w-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm md:text-base font-semibold text-emerald-900 dark:text-emerald-100">修改文件已打包</p>
            <p className="text-xs md:text-sm text-emerald-600 dark:text-emerald-400 font-mono truncate mt-0.5">{fileName}</p>
          </div>
          <button
            onClick={async () => {
              try {
                const resp = await fetch(filePackageUrl);
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const blob = await resp.blob();
                const blobUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = blobUrl;
                a.download = fileName;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(blobUrl);
              } catch { window.location.href = filePackageUrl; }
            }}
            className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 md:px-5 md:py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm md:text-base font-medium transition-colors shadow-sm cursor-pointer"
          >
            <svg className="h-4 w-4 md:h-5 md:w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>下载</span>
          </button>
        </div>
        <p className="text-xs md:text-sm text-muted-foreground mt-2 ml-1">
          解压覆盖：<code className="font-mono bg-muted px-2 py-1 rounded text-[11px] md:text-xs">tar xzf {fileName} -C /www/wwwroot/ai_platform</code>
        </p>
      </div>
    );
  };

  let fc = content
    .replace(/<SSHConnectionCard[^>]*\/?>/gi, '')
    .replace(/<WaitMessage>[\s\S]*?<\/WaitMessage>/gi, '')
    .replace(/<ResearchTaskCard[^>]*\/?>/gi, '')
    .trim();

  // ── <replace> 块 ──
  const codeDiffs = useMemo(() => hasReplaceBlocks(fc) ? parseCodeDiffs(fc) : [], [fc]);
  const hasDiffs = codeDiffs.length > 0;
  // ★ 内联模式：将每个 <replace> 替换为 ___DIFF_N___ 占位符，而非全部删除
  if (hasDiffs) {
    fc = inlineReplaceBlocks(fc);
  } else if (hasReplaceBlocks(fc)) {
    // ★ 安全兜底：parseCodeDiffs 未能解析时，将 <replace> 块包裹成代码围栏
    // 防止 SafeMarkdown 将原始 XML 标签渲染成乱码纯文本
    fc = fc.replace(
      /<replace\s+file=["']([^"']+)["']\s*>([\s\S]*?)<\/replace>/gi,
      (_, fileName, body) => `\n\n**修改文件：\`${fileName}\`**\n\n\`\`\`diff\n${body.trim()}\n\`\`\`\n\n`
    );
  }

  // ── ```file:xxx``` 块 ──
  const fbRegex = /```file:([^\n`]+)\n([\s\S]*?)```/g;
  const fileBlocks: Array<{ fileName: string; displayPath: string; fileContent: string }> = [];
  let fm;
  while ((fm = fbRegex.exec(fc)) !== null) {
    const raw = fm[1].trim(), base = raw.split('/').pop() || raw;
    fileBlocks.push({ fileName: base, displayPath: raw !== base ? raw : '', fileContent: fm[2] });
  }
  fc = fc.replace(/```file:[^\n`]+\n[\s\S]*?```/g, '___FB___').replace(/^`?file:[^\n`]+`?$/gm, '').replace(/___FB___/g, '').replace(/\n{3,}/g, '\n\n').trim();

  // ── 有 diff / file 块 → 内联渲染 ──
  if (hasDiffs || fileBlocks.length > 0) {
    // ★ 按占位符分割 markdown，交替渲染文字段落和 diff 卡片
    const segments = fc.split(/(___DIFF_\d+___)/);

    return (
      <div>
        {segments.map((seg, i) => {
          const diffMatch = seg.match(/^___DIFF_(\d+)___$/);
          if (diffMatch) {
            const diffIdx = parseInt(diffMatch[1]);
            const diff = codeDiffs[diffIdx];
            if (diff) {
              return (
                <div key={`diff-${i}`} className="my-3">
                  <CodeDiffBlock
                    diff={diff}
                    defaultExpanded={false}
                    conversationId={conversationId}
                    messageIndex={messageIndex}
                  />
                </div>
              );
            }
            return null;
          }
          const trimmed = seg.trim();
          if (!trimmed) return null;
          return <SafeMarkdown key={`md-${i}`} className={className} streaming={streaming}>{trimmed}</SafeMarkdown>;
        })}
        {fileBlocks.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {fileBlocks.map((fb, idx) => {
              const small = /\.(ts|tsx|jsx|js)$/i.test(fb.fileName) && fb.fileContent.length < 500;
              const canPrev = isPreviewableCode(fb.fileName, undefined, fb.fileContent);
              return (
                <div key={idx} className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <button onClick={() => { const b = new Blob([fb.fileContent], { type: 'text/plain;charset=utf-8' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = fb.fileName; a.click(); URL.revokeObjectURL(u); }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/30 dark:hover:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded-lg text-sm font-medium transition-colors">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      下载 {fb.fileName}{fb.displayPath && <span className="text-xs opacity-60 ml-1">({fb.displayPath})</span>}
                    </button>
                    {canPrev && <CodeSandboxPreview code={fb.fileContent} fileName={fb.fileName} />}
                  </div>
                  {small && (
                    <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 ml-1">
                      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.168 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                      文件较小（{fb.fileContent.length}B），可能不完整
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {renderDownloadButton()}
      </div>
    );
  }

  // ── .docx 链接拦截 ──
  const mdLink = /\[([^\]]+)\]\(([^)]+\.docx)\)/g;
  const ptLink = /(点击下载：|下载：|Download:\s*)[《「]?([^》」\n.]+)[》」]?\.docx/gi;
  const hasMd = mdLink.test(fc), hasPt = ptLink.test(fc);
  if (!hasMd && !hasPt) return (
    <div>
      <SafeMarkdown className={className} streaming={streaming}>{fc}</SafeMarkdown>
      {renderDownloadButton()}
    </div>
  );

  const links: Array<{ text: string; url: string; title: string; plain: boolean }> = [];
  let mt;
  mdLink.lastIndex = 0;
  while ((mt = mdLink.exec(fc)) !== null) {
    links.push({ text: mt[1], url: mt[2], title: mt[1].replace(/^(点击下载：|下载：|Download:\s*)/i, '').replace(/\.docx$/i, ''), plain: false });
  }
  ptLink.lastIndex = 0;
  while ((mt = ptLink.exec(fc)) !== null) {
    links.push({ text: mt[0], url: '', title: mt[2], plain: true });
  }
  let pc = fc;
  links.forEach((l, i) => {
    pc = l.plain ? pc.replace(l.text, `__DX${i}__`) : pc.replace(`[${l.text}](${l.url})`, `__DX${i}__`);
  });

  const doDownload = async (title: string, idx: number) => {
    const id = `${title}-${idx}`;
    if (generatingDocs.has(id)) return;
    setGeneratingDocs(p => new Set(p).add(id));
    const tid = toast.loading("正在生成Word文档...");
    try {
      const r = await generateDocumentMutation.mutateAsync({ title: title || `文档`, content: pc.replace(/__DX\d+__/g, '') });
      toast.success("文档生成成功！", { id: tid });
      const a = document.createElement("a"); a.href = r.url; a.download = r.fileName; a.click();
    } catch (e: any) { toast.error(e.message || "失败", { id: tid }); }
    finally { setGeneratingDocs(p => { const s = new Set(p); s.delete(id); return s; }); }
  };

  return (
    <div className={className}>
      {pc.split(/(__DX\d+__)/).map((part, i) => {
        const ph = part.match(/__DX(\d+)__/);
        if (!ph) return <SafeMarkdown key={i} className={className} streaming={streaming}>{part}</SafeMarkdown>;
        const li = parseInt(ph[1]), lk = links[li], isGen = generatingDocs.has(`${lk.title}-${li}`);
        return (
          <div key={i} className="my-4 flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <Download className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-blue-900 dark:text-blue-100 truncate">{lk.title}</p>
              <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">点击生成并下载Word文档</p>
            </div>
            <Button size="sm" onClick={() => doDownload(lk.title, li)} disabled={isGen}>{isGen ? "生成中..." : "下载"}</Button>
          </div>
        );
      })}
      {renderDownloadButton()}
    </div>
  );
}
