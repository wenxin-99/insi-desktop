/**
 * FilePreviewCard — 文件预览卡片组件
 *
 * 可通过两种方式使用：
 * 1. ```file-preview + JSON — AI 手动触发
 * 2. 在文件生成流程的 done handler 中直接渲染
 *
 * JSON Schema:
 * {
 *   "files": [
 *     {
 *       "name": "报告.docx",
 *       "url": "/api/files/xxx",
 *       "size": 12345,
 *       "type": "docx"
 *     }
 *   ]
 * }
 *
 * 或单个文件：
 * {
 *   "name": "报告.docx",
 *   "url": "/api/files/xxx",
 *   "size": 12345,
 *   "type": "docx"
 * }
 */

import { memo, useState, useEffect } from 'react';
import { FileText, FileSpreadsheet, Image, File, Download, ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 类型定义 ═══════

interface FileInfo {
  name: string;
  url: string;
  size?: number;       // bytes
  type?: string;       // docx | pdf | xlsx | png | ...
  thumbnail?: string;  // 缩略图 URL（可选）
}

interface FilePreviewCardProps {
  jsonStr?: string;
  streaming?: boolean;
  /** 直接传入文件数据（非代码块模式） */
  fileData?: FileInfo | FileInfo[];
  /** ★ 监听 tool_end 事件的工具 ID（文件生成 pipeline 集成） */
  toolId?: string;
}

// ═══════ 文件类型配置 ═══════

interface FileTypeConfig {
  icon: typeof FileText;
  color: string;
  bgColor: string;
  label: string;
}

const FILE_TYPES: Record<string, FileTypeConfig> = {
  pdf:  { icon: FileText, color: 'text-red-500', bgColor: 'bg-red-50 dark:bg-red-950/30', label: 'PDF' },
  docx: { icon: FileText, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30', label: 'Word' },
  doc:  { icon: FileText, color: 'text-blue-500', bgColor: 'bg-blue-50 dark:bg-blue-950/30', label: 'Word' },
  xlsx: { icon: FileSpreadsheet, color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-950/30', label: 'Excel' },
  xls:  { icon: FileSpreadsheet, color: 'text-green-500', bgColor: 'bg-green-50 dark:bg-green-950/30', label: 'Excel' },
  csv:  { icon: FileSpreadsheet, color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/30', label: 'CSV' },
  pptx: { icon: FileText, color: 'text-orange-500', bgColor: 'bg-orange-50 dark:bg-orange-950/30', label: 'PPT' },
  png:  { icon: Image, color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950/30', label: 'PNG' },
  jpg:  { icon: Image, color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950/30', label: 'JPG' },
  jpeg: { icon: Image, color: 'text-purple-500', bgColor: 'bg-purple-50 dark:bg-purple-950/30', label: 'JPG' },
  svg:  { icon: Image, color: 'text-teal-500', bgColor: 'bg-teal-50 dark:bg-teal-950/30', label: 'SVG' },
  md:   { icon: FileText, color: 'text-slate-500', bgColor: 'bg-slate-50 dark:bg-slate-950/30', label: 'MD' },
  txt:  { icon: FileText, color: 'text-slate-500', bgColor: 'bg-slate-50 dark:bg-slate-950/30', label: 'TXT' },
};

const DEFAULT_TYPE: FileTypeConfig = {
  icon: File, color: 'text-muted-foreground', bgColor: 'bg-muted/30', label: '文件'
};

function getFileType(file: FileInfo): FileTypeConfig {
  const ext = (file.type || file.name.split('.').pop() || '').toLowerCase();
  return FILE_TYPES[ext] || DEFAULT_TYPE;
}

/** 格式化文件大小 */
function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** 单个文件卡片 */
function FileCard({ file }: { file: FileInfo }) {
  const typeConfig = getFileType(file);
  const Icon = typeConfig.icon;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border hover:border-muted-foreground/30 hover:bg-muted/10 transition-all group">
      {/* 文件图标 */}
      <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0', typeConfig.bgColor)}>
        <Icon className={cn('w-5 h-5', typeConfig.color)} />
      </div>

      {/* 文件信息 */}
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium text-foreground truncate">{file.name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded', typeConfig.bgColor, typeConfig.color)}>
            {typeConfig.label}
          </span>
          {file.size && (
            <span className="text-[10px] text-muted-foreground">{formatSize(file.size)}</span>
          )}
        </div>
      </div>

      {/* 操作按钮 — 移动端始终可见 */}
      <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
        <a
          href={file.url}
          download={file.name}
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          title="下载"
        >
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
        </a>
        <a
          href={file.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-md hover:bg-muted transition-colors"
          title="在新标签页打开"
        >
          <ExternalLink className="w-3.5 h-3.5 text-muted-foreground" />
        </a>
      </div>
    </div>
  );
}

function FilePreviewCardInner({ jsonStr, streaming, fileData, toolId }: FilePreviewCardProps) {
  // ★ Pipeline 集成：监听 tool_end 事件，自动获取生成的文件信息
  const [pipelineFiles, setPipelineFiles] = useState<FileInfo[]>([]);

  useEffect(() => {
    if (!toolId) return;
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.toolId !== toolId) return;
      // tool_end 事件的 result 中包含文件信息
      const result = detail.result;
      if (result?.downloadUrl) {
        setPipelineFiles([{
          name: result.fileName || result.title || '生成的文件',
          url: result.downloadUrl,
          size: result.fileSize,
          type: result.format || result.downloadUrl.split('.').pop(),
        }]);
      } else if (result?.files) {
        setPipelineFiles(result.files);
      }
    };
    window.addEventListener('chat:toolEnd', handler);
    return () => window.removeEventListener('chat:toolEnd', handler);
  }, [toolId]);

  // ★ 也监听通用的 fileGenerated 事件（仅非代码块模式，避免多实例累积）
  useEffect(() => {
    if (jsonStr) return; // 代码块模式不监听通用事件
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.name && detail?.url) {
        setPipelineFiles(prev => [...prev, { name: detail.name, url: detail.url, size: detail.size, type: detail.type }]);
      }
    };
    window.addEventListener('chat:fileGenerated', handler);
    return () => window.removeEventListener('chat:fileGenerated', handler);
  }, []);

  let files: FileInfo[] = [...pipelineFiles];

  if (fileData) {
    // 直接传入模式
    const fd = Array.isArray(fileData) ? fileData : [fileData];
    files = [...files, ...fd];
  } else if (jsonStr) {
    // 代码块模式 — 与 pipeline 文件合并
    const r = safeParseJson<any>(jsonStr);
    if (r.data) {
      if (Array.isArray(r.data)) {
        files = [...files, ...r.data];
      } else if (r.data.files) {
        files = [...files, ...r.data.files];
      } else if (r.data.name && r.data.url) {
        files = [...files, r.data];
      }
    }
  }

  // ═══════ 流式骨架 ═══════
  if (files.length === 0 && streaming) {
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm p-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-muted animate-pulse" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3 w-32 rounded bg-muted animate-pulse" />
            <div className="h-2 w-20 rounded bg-muted animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  // ═══════ 无文件 ═══════
  if (files.length === 0) {
    if (!jsonStr) return null;
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>文件数据格式异常</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  return (
    <div className="my-2 space-y-1.5">
      {files.map((file, i) => (
        <FileCard key={i} file={file} />
      ))}
    </div>
  );
}

export const FilePreviewCard = memo(FilePreviewCardInner);
