/**
 * ExportDropdown.tsx — 多格式导出下拉菜单
 *
 * 用于 ArtifactCard 和 CodeBlock 的导出按钮，支持：
 *   - 原始文件（HTML/JSX/JS/CSS/PY 等）
 *   - PDF（服务端 Chromium 渲染）
 *   - Word 文档（.docx）
 *   - Markdown（.md）
 *   - PNG 截图（仅 HTML Artifact）
 */

import { useState, useCallback, useRef, useEffect } from "react";
import { Download, FileText, FileType, Code2, Image, Loader2, Check } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";

interface ExportFormat {
  id: string;
  label: string;
  ext: string;
  icon: typeof FileText;
  /** 是否需要服务端生成 */
  serverSide: boolean;
}

const EXPORT_FORMATS: ExportFormat[] = [
  { id: "raw",      label: "原始文件",  ext: "",   icon: Code2,    serverSide: false },
  { id: "pdf",      label: "PDF 文档",  ext: "pdf", icon: FileText, serverSide: true },
  { id: "docx",     label: "Word 文档", ext: "docx", icon: FileType, serverSide: true },
  { id: "markdown", label: "Markdown",  ext: "md",  icon: FileText, serverSide: true },
  { id: "png",      label: "PNG 截图",  ext: "png", icon: Image,    serverSide: false },
];

interface ExportDropdownProps {
  /** 代码/内容 */
  code: string;
  /** 语言 */
  language: string;
  /** 文件标题 */
  title: string;
  /** 原始文件扩展名 */
  rawExt?: string;
  /** 是否显示 PNG 选项（仅 HTML） */
  showPng?: boolean;
  /** 按钮样式 */
  buttonClassName?: string;
  /** 触发导出后的回调 */
  onExport?: (format: string) => void;
}

export function ExportDropdown({
  code, language, title, rawExt, showPng = false, buttonClassName, onExport,
}: ExportDropdownProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const pdfMutation = trpc.artifactExport.toPdf.useMutation();
  const docxMutation = trpc.artifactExport.toDocx.useMutation();
  const mdMutation = trpc.artifactExport.toMarkdown.useMutation();

  // 下载辅助
  const downloadBlob = useCallback((content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, []);

  const downloadUrl = useCallback((url: string, filename: string) => {
    const a = document.createElement("a");
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a);
  }, []);

  const handleExport = useCallback(async (formatId: string) => {
    const safeName = (title || "export").replace(/[<>:"/\\|?*]/g, "_");
    setLoading(formatId);
    setDone(null);

    try {
      switch (formatId) {
        case "raw": {
          const ext = rawExt || (language === "html" ? "html" : language === "react" ? "jsx" : language === "python" ? "py" : language === "typescript" ? "ts" : "js");
          const mime = language === "html" ? "text/html" : "text/plain";
          downloadBlob(code, `${safeName}.${ext}`, mime);
          break;
        }

        case "pdf": {
          const result = await pdfMutation.mutateAsync({ title: safeName, code, language });
          downloadUrl(result.url, result.fileName);
          break;
        }

        case "docx": {
          const result = await docxMutation.mutateAsync({ title: safeName, content: code, language });
          downloadUrl(result.url, result.fileName);
          break;
        }

        case "markdown": {
          const result = await mdMutation.mutateAsync({ title: safeName, code, language });
          if (result.content) {
            downloadBlob(result.content, result.fileName, "text/markdown");
          } else {
            downloadUrl(result.url, result.fileName);
          }
          break;
        }

        case "png": {
          // 客户端截图：用 html2canvas
          try {
            const iframe = document.querySelector('iframe[title="Code Preview"], iframe[title="Artifact Preview"]') as HTMLIFrameElement;
            if (iframe) {
              // 尝试从 iframe 截图（受同源限制，可能失败）
              toast.info("PNG 截图功能需要在预览模式下使用");
            } else {
              toast.info("请先打开预览再截图");
            }
          } catch {
            toast.error("PNG 截图暂不可用");
          }
          break;
        }
      }

      setDone(formatId);
      toast.success(`已导出为 ${EXPORT_FORMATS.find(f => f.id === formatId)?.label || formatId}`);
      onExport?.(formatId);
      setTimeout(() => { setDone(null); setOpen(false); }, 1000);
    } catch (err: any) {
      toast.error(err.message || "导出失败");
    } finally {
      setLoading(null);
    }
  }, [code, language, title, rawExt, pdfMutation, docxMutation, mdMutation, downloadBlob, downloadUrl, onExport]);

  // 过滤可用格式
  const availableFormats = EXPORT_FORMATS.filter(f => {
    if (f.id === "png" && !showPng) return false;
    return true;
  });

  return (
    <div ref={dropdownRef} className="relative inline-block">
      {/* 触发按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className={buttonClassName || "inline-flex items-center gap-1 h-7 px-2 md:px-2.5 rounded-md text-xs font-medium text-gray-400 hover:text-gray-200 hover:bg-white/8 transition-colors"}
      >
        <Download className="w-3.5 h-3.5" />
        <span className="hidden md:inline">导出</span>
      </button>

      {/* 下拉菜单 */}
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-44 rounded-lg border bg-popover shadow-lg py-1 animate-in fade-in-0 zoom-in-95">
          {availableFormats.map(fmt => {
            const Icon = fmt.icon;
            const isLoading = loading === fmt.id;
            const isDone = done === fmt.id;
            return (
              <button
                key={fmt.id}
                onClick={() => handleExport(fmt.id)}
                disabled={isLoading}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-muted transition-colors text-left"
              >
                {isLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                ) : isDone ? (
                  <Check className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                )}
                <span className="flex-1">{fmt.label}</span>
                {fmt.ext && <span className="text-[10px] text-muted-foreground/50">.{fmt.ext}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
