/**
 * UserContent — 用户消息内容区域
 *
 * 渲染用户的图片、文件附件、文本内容和编辑模式。
 * 从 MessageItem.tsx 拆分而来。
 */

import { Button } from '@/components/ui/button';
import { SafeMarkdownWithDownload } from '@/components/SafeMarkdownWithDownload';
import { ImageWithSkeleton } from '@/components/ImageWithSkeleton';
import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import type { ContentProps } from './types';
import type { PreviewFile } from '../../types';

export function UserContent({
  msg, index, displayContent, state,
  handleSendMessage, handleImageDownload, normalizeImageUrl,
}: ContentProps) {
  const { t } = useTranslation();
  const {
    messages, setMessages,
    setUploadedImages, setUploadedFiles,
    collapsedDescriptions, setCollapsedDescriptions,
    setLightboxImages, setLightboxIndex, setLightboxOpen,
    editingMessageIndex, setEditingMessageIndex,
    editText, setEditText,
    setPreviewFile,
  } = state;

  const handleFilePreview = async (file: any) => {
    const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
    const archiveExts = ['zip', 'rar', '7z', 'tar', 'gz', 'tgz', 'bz2', 'xz'];
    const binaryExts = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'exe', 'dmg', 'apk', 'iso'];
    const previewableExts = [
      'txt', 'md', 'json', 'xml', 'yaml', 'yml', 'toml', 'ini', 'cfg', 'conf', 'env', 'log',
      'html', 'css', 'js', 'ts', 'tsx', 'jsx', 'py', 'java', 'c', 'cpp', 'h', 'go', 'rs',
      'rb', 'php', 'sh', 'sql', 'csv', 'dart', 'kt', 'swift', 'lua', 'r', 'vue', 'svelte',
    ];

    if (archiveExts.includes(ext)) {
      toast.info('压缩包暂不支持在线预览', {
        description: '请点击右侧下载按钮后解压查看',
        action: file.url ? { label: '下载', onClick: () => window.open(file.url, '_blank') } : undefined,
      });
      return;
    }

    if (ext === 'pdf') {
      window.open(file.url, '_blank');
      return;
    }

    if (binaryExts.includes(ext)) {
      toast.info(`${ext.toUpperCase()} 文件暂不支持在线预览`, {
        description: '请下载后使用对应软件打开',
        action: file.url ? { label: '下载', onClick: () => window.open(file.url, '_blank') } : undefined,
      });
      return;
    }

    // 可预览的文本/代码文件：fetch 内容 → 打开预览面板
    if (previewableExts.includes(ext) || !ext) {
      try {
        toast.loading('正在加载文件内容...', { id: 'file-preview' });
        const token = localStorage.getItem('auth_token');
        const resp = await fetch(file.url, {
          credentials: 'include',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const content = await resp.text();
        toast.dismiss('file-preview');
        setPreviewFile({ name: file.name, content, isLive: false });
      } catch {
        toast.error('文件加载失败', { id: 'file-preview', description: '请尝试直接下载' });
      }
      return;
    }

    // 其他类型：新标签页打开
    window.open(file.url, '_blank');
  };

  // 对于有图片的长描述，默认截断显示（collapsedDescriptions 记录"已展开"的消息索引）
  const msgIndex = messages.indexOf(msg);
  const hasLongDescription = msg.images && msg.images.length > 0 && 
    displayContent && displayContent.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim().length > 50;
  const isCollapsed = hasLongDescription ? !collapsedDescriptions.has(msgIndex) : false;

  const toggleCollapse = () => {
    setCollapsedDescriptions((prev: Set<number>) => {
      const newSet = new Set(prev);
      const msgIndex = messages.indexOf(msg);
      if (newSet.has(msgIndex)) newSet.delete(msgIndex);
      else newSet.add(msgIndex);
      return newSet;
    });
  };

  const handleEditSubmit = () => {
    if (!editText.trim()) return;
    const resendImages = (msg as any).images?.length
      ? (msg as any).images.map((img: any) => (typeof img === 'string' ? { url: img, name: '图片' } : img))
      : undefined;
    const resendFiles = (msg as any).files?.length ? (msg as any).files : undefined;
    setMessages((prev: any[]) => prev.slice(0, index));
    setUploadedImages([]);
    setUploadedFiles([]);
    setEditingMessageIndex(null);
    setTimeout(() => handleSendMessage(editText.trim(), resendImages, resendFiles), 50);
  };

  return (
    <div
      className="space-y-2 text-[15px] leading-relaxed"
      style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word', maxWidth: '100%' }}
    >
      {/* 图片缩略图 */}
      {msg.images && msg.images.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {msg.images.map((img, imgIndex) => (
            <ImageWithSkeleton
              key={imgIndex}
              src={normalizeImageUrl(img.url)}
              alt={img.name}
              thumbnail={true}
              onClick={() => {
                setLightboxImages(msg.images!.map((i) => ({ ...i, url: normalizeImageUrl(i.url) })));
                setLightboxIndex(imgIndex);
                setLightboxOpen(true);
              }}
              onDownload={handleImageDownload}
            />
          ))}
        </div>
      )}

      {/* 文件附件卡片 */}
      {(msg as any).files && (msg as any).files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {(msg as any).files.map((file: any, fileIdx: number) => (
            <FileAttachmentCard key={fileIdx} file={file} onPreview={handleFilePreview} />
          ))}
        </div>
      )}

      {/* 文本内容 */}
      {editingMessageIndex === index ? (
        /* 编辑模式 */
        <div className="space-y-2">
          <textarea
            className="w-full min-h-[60px] max-h-[200px] p-2 rounded-md border border-primary bg-background text-foreground text-sm resize-y focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleEditSubmit();
              }
              if (e.key === 'Escape') setEditingMessageIndex(null);
            }}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setEditingMessageIndex(null)}>
              取消
            </Button>
            <Button size="sm" onClick={handleEditSubmit}>
              <Check className="h-3.5 w-3.5 mr-1" />
              发送
            </Button>
          </div>
        </div>
      ) : displayContent &&
        displayContent !== '[图片]' &&
        !(
          (msg as any).files &&
          (msg as any).files.length > 0 &&
          displayContent.replace(/\[文件: [^\]]+\]/g, '').trim() === ''
        ) && (
        <div className="space-y-2">
          {/* 图片描述：始终显示，超过50字自动截断 */}
          {msg.images && msg.images.length > 0 && (
            <div className="border-b border-border pb-2">
              <span className="text-sm font-medium text-muted-foreground">图片描述：</span>
            </div>
          )}
          {(() => {
            const cleanedContent = displayContent.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim();
            const isLong = cleanedContent.length > 50;
            const shouldTruncate = msg.images && msg.images.length > 0 && isLong && isCollapsed;
            const truncated = shouldTruncate ? cleanedContent.slice(0, 50) + '...' : cleanedContent;
            return (
              <div className="pt-1">
                {shouldTruncate ? (
                  <p
                    className="text-[15px] leading-relaxed cursor-pointer hover:text-primary transition-colors"
                    onClick={toggleCollapse}
                    title="点击查看全部"
                  >
                    {truncated}
                  </p>
                ) : (
                  <div>
                    <SafeMarkdownWithDownload
                      content={cleanedContent}
                      conversationId={state.selectedConversationId ?? undefined}
                      messageIndex={index}
                    />
                    {msg.images && msg.images.length > 0 && isLong && (
                      <button
                        onClick={toggleCollapse}
                        className="text-xs text-muted-foreground hover:text-foreground mt-1"
                      >
                        收起
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}

// ── 文件附件卡片（增强版） ──

const FILE_TYPE_CONFIG: Record<string, { gradient: string; icon: string; label: string }> = {
  pdf:  { gradient: 'from-red-500 to-rose-600',     icon: 'PDF',  label: 'PDF 文档' },
  doc:  { gradient: 'from-blue-500 to-indigo-600',   icon: 'DOC',  label: 'Word 文档' },
  docx: { gradient: 'from-blue-500 to-indigo-600',   icon: 'DOC',  label: 'Word 文档' },
  xls:  { gradient: 'from-emerald-500 to-green-600', icon: 'XLS',  label: 'Excel 表格' },
  xlsx: { gradient: 'from-emerald-500 to-green-600', icon: 'XLS',  label: 'Excel 表格' },
  csv:  { gradient: 'from-emerald-500 to-teal-600',  icon: 'CSV',  label: 'CSV 数据' },
  ppt:  { gradient: 'from-orange-500 to-amber-600',  icon: 'PPT',  label: '演示文稿' },
  pptx: { gradient: 'from-orange-500 to-amber-600',  icon: 'PPT',  label: '演示文稿' },
  zip:  { gradient: 'from-yellow-500 to-amber-600',  icon: 'ZIP',  label: '压缩包' },
  rar:  { gradient: 'from-yellow-500 to-amber-600',  icon: 'RAR',  label: '压缩包' },
  '7z': { gradient: 'from-yellow-500 to-amber-600',  icon: '7Z',   label: '压缩包' },
  gz:   { gradient: 'from-yellow-500 to-amber-600',  icon: 'GZ',   label: '压缩包' },
  tar:  { gradient: 'from-yellow-500 to-amber-600',  icon: 'TAR',  label: '压缩包' },
  html: { gradient: 'from-orange-500 to-red-500',    icon: 'HTML', label: '网页文件' },
  css:  { gradient: 'from-blue-400 to-blue-600',     icon: 'CSS',  label: '样式文件' },
  js:   { gradient: 'from-yellow-400 to-yellow-600', icon: 'JS',   label: 'JavaScript' },
  ts:   { gradient: 'from-blue-500 to-blue-700',     icon: 'TS',   label: 'TypeScript' },
  tsx:  { gradient: 'from-blue-400 to-cyan-600',     icon: 'TSX',  label: 'React TSX' },
  jsx:  { gradient: 'from-cyan-400 to-blue-500',     icon: 'JSX',  label: 'React JSX' },
  py:   { gradient: 'from-blue-500 to-yellow-500',   icon: 'PY',   label: 'Python' },
  java: { gradient: 'from-red-500 to-orange-500',    icon: 'JAV',  label: 'Java' },
  go:   { gradient: 'from-cyan-500 to-blue-500',     icon: 'GO',   label: 'Go' },
  rs:   { gradient: 'from-orange-600 to-red-700',    icon: 'RS',   label: 'Rust' },
  json: { gradient: 'from-gray-500 to-gray-700',     icon: '{ }',  label: 'JSON' },
  md:   { gradient: 'from-gray-500 to-gray-700',     icon: 'MD',   label: 'Markdown' },
  txt:  { gradient: 'from-gray-400 to-gray-600',     icon: 'TXT',  label: '文本文件' },
  sql:  { gradient: 'from-indigo-500 to-purple-600', icon: 'SQL',  label: 'SQL 脚本' },
  xml:  { gradient: 'from-teal-500 to-cyan-600',     icon: 'XML',  label: 'XML 文件' },
  yaml: { gradient: 'from-pink-500 to-rose-600',     icon: 'YML',  label: 'YAML' },
  yml:  { gradient: 'from-pink-500 to-rose-600',     icon: 'YML',  label: 'YAML' },
  sh:   { gradient: 'from-green-600 to-emerald-700', icon: 'SH',   label: 'Shell 脚本' },
  log:  { gradient: 'from-gray-500 to-gray-600',     icon: 'LOG',  label: '日志文件' },
  php:  { gradient: 'from-indigo-500 to-purple-500', icon: 'PHP',  label: 'PHP' },
  cpp:  { gradient: 'from-blue-600 to-indigo-700',   icon: 'C++',  label: 'C++' },
  c:    { gradient: 'from-blue-500 to-gray-600',     icon: 'C',    label: 'C 语言' },
  rb:   { gradient: 'from-red-500 to-red-700',       icon: 'RB',   label: 'Ruby' },
};

const DEFAULT_CONFIG = { gradient: 'from-gray-400 to-gray-600', icon: '📎', label: '文件' };

function FileAttachmentCard({ file, onPreview }: { file: any; onPreview?: (file: any) => void }) {
  const ext = (file.name || '').split('.').pop()?.toLowerCase() || '';
  const config = FILE_TYPE_CONFIG[ext] || DEFAULT_CONFIG;
  const sizeText = file.size
    ? file.size > 1024 * 1024
      ? (file.size / 1024 / 1024).toFixed(1) + ' MB'
      : (file.size / 1024).toFixed(0) + ' KB'
    : '';

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        if (onPreview) onPreview(file);
        else if (file.url) window.open(file.url, '_blank');
      }}
      className="group flex items-center gap-2.5 pl-1.5 pr-3 py-1.5 rounded-xl bg-white dark:bg-gray-800/80 border border-border/60 hover:border-border hover:shadow-md transition-all duration-200 cursor-pointer no-underline max-w-[240px]"
      title={`点击预览 ${file.name}`}
    >
      {/* 文件类型图标 */}
      <div
        className={`w-10 h-10 rounded-lg bg-gradient-to-br ${config.gradient} flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform duration-200 shrink-0`}
      >
        <span className="text-white text-[10px] font-bold leading-none tracking-tight">
          {config.icon}
        </span>
      </div>
      {/* 文件信息 */}
      <div className="flex flex-col min-w-0 gap-0.5">
        <span className="text-xs font-medium truncate text-foreground/90 group-hover:text-foreground transition-colors">
          {file.name}
        </span>
        <span className="text-[10px] text-muted-foreground leading-tight">
          {sizeText}{sizeText && ' · '}{config.label}
        </span>
      </div>
    </div>
  );
}
