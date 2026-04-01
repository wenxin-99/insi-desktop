/**
 * UploadedFiles — 已上传文件/图片预览区域
 * 
 * ★ P2-7 增强：
 * - ImageUploadPreview 支持错误状态 + 重试
 * - 点击图片打开内联预览 lightbox
 * - 多图时显示图片计数徽章
 */

import { useState, useCallback } from 'react';
import { ImageUploadPreview } from '@/components/ImageUploadPreview';
import { ImageLightbox } from '@/components/ImageLightbox';
import { formatFileSize } from '@/lib/formatFileSize';
import {
  X, FileText, FileSpreadsheet, File, FileType,
  FileCode, Archive, ImageIcon,
} from 'lucide-react';

interface UploadedFilesProps {
  uploadedImages: any[];
  uploadedFiles: any[];
  onRemoveImage: (url: string) => void;
  onRemoveFile: (url: string) => void;
  onRetryUpload?: (fileId: string) => Promise<void>;
  onRetryImage?: (imageId: string) => Promise<void>;  // ★ P2-7: 图片重试
}
export function UploadedFiles({ uploadedImages, uploadedFiles, onRemoveImage, onRemoveFile, onRetryUpload, onRetryImage }: UploadedFilesProps) {
  // ★ P2-7: 内联 lightbox 状态
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);

  // 只对已完成上传的图片开启预览
  const completedImages = uploadedImages.filter((img: any) => !img.progress && !img.error && img.url);
  
  const openPreview = useCallback((url: string) => {
    const idx = completedImages.findIndex((img: any) => img.url === url);
    if (idx >= 0) {
      setPreviewIndex(idx);
      setPreviewOpen(true);
    }
  }, [completedImages]);

  return (
    <>
            {/* 已上传的图片预览 */}
            {uploadedImages.length > 0 && (
              <div className="flex gap-1.5 md:gap-2 flex-wrap items-end">
                {uploadedImages.map((img: any, idx) => (
                  <ImageUploadPreview
                    key={img.id || img.url || idx}
                    url={img.url}
                    name={img.name}
                    progress={img.progress}
                    error={img.error}
                    onRemove={() => onRemoveImage(img.url || img.id)}
                    onRetry={img.error && img.id && onRetryImage
                      ? () => onRetryImage!(img.id)
                      : undefined}
                    onPreview={openPreview}
                  />
                ))}
                {/* ★ 多图计数徽章 */}
                {uploadedImages.length > 1 && (
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground self-end pb-1">
                    <ImageIcon className="h-3 w-3" />
                    <span>{uploadedImages.length} 张</span>
                  </div>
                )}
              </div>
            )}
            
            {/* 已上传的文件列表 */}
            {uploadedFiles.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {uploadedFiles.map((file, idx) => {
                  const { Icon, colorClass, bgClass } = (() => {
                    const extension = file.name.split('.').pop()?.toLowerCase() || '';
                    switch (extension) {
                      case 'pdf':
                        return { Icon: FileText, colorClass: 'text-red-600', bgClass: 'bg-red-50' };
                      case 'doc':
                      case 'docx':
                        return { Icon: FileText, colorClass: 'text-blue-600', bgClass: 'bg-blue-50' };
                      case 'xls':
                      case 'xlsx':
                        return { Icon: FileSpreadsheet, colorClass: 'text-green-600', bgClass: 'bg-green-50' };
                      case 'ppt':
                      case 'pptx':
                        return { Icon: FileType, colorClass: 'text-orange-600', bgClass: 'bg-orange-50' };
                      case 'txt':
                      case 'md':
                        return { Icon: FileText, colorClass: 'text-gray-600', bgClass: 'bg-gray-50' };
                      case 'zip':
                      case 'rar':
                      case '7z':
                      case 'tar':
                      case 'gz':
                        return { Icon: Archive, colorClass: 'text-yellow-600', bgClass: 'bg-yellow-50' };
                      case 'ts':
                      case 'tsx':
                      case 'js':
                      case 'jsx':
                      case 'py':
                      case 'java':
                      case 'c':
                      case 'cpp':
                      case 'h':
                      case 'go':
                      case 'rs':
                      case 'rb':
                      case 'php':
                      case 'sh':
                      case 'json':
                      case 'csv':
                      case 'sql':
                        return { Icon: FileCode, colorClass: 'text-purple-600', bgClass: 'bg-purple-50' };
                      default:
                        return { Icon: File, colorClass: 'text-gray-500', bgClass: 'bg-gray-50' };
                    }
                  })();
                  
                  return (
                    <div key={idx} className={`flex flex-col gap-1 px-3 py-2 ${file.error ? 'bg-red-50 border-red-300' : bgClass} rounded-lg group border ${file.error ? 'border-red-300' : 'border-border/50'} min-w-[200px]`}>
                      <div className="flex items-center gap-2">
                        <Icon className={`h-4 w-4 ${file.error ? 'text-red-600' : colorClass} flex-shrink-0`} />
                        <span className="text-xs font-medium truncate flex-1">{file.name}</span>
                        <button
                          onClick={() => onRemoveFile(file.url || file.name)}
                          className="text-destructive opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                      
                      {/* 文件大小和进度条 */}
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{formatFileSize(file.size)}</span>
                        {file.progress !== undefined && file.progress < 100 && !file.error && (
                          <>
                            <span className="text-[10px] font-medium text-blue-600">
                              {(file as any).statusText || `${file.progress}%`}
                            </span>
                          </>
                        )}
                        {!file.progress && !file.error && file.url && (
                          <span className="text-[10px] text-green-600 font-medium">✓ 已上传</span>
                        )}
                      </div>
                      {/* 独立进度条行 — 更宽更明显 */}
                      {file.progress !== undefined && file.progress < 100 && !file.error && (
                        <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-blue-500 rounded-full transition-all duration-500 ease-out"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                      )}
                      
                      {/* 错误提示和重试按钮 */}
                      {file.error && (
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[10px] text-red-600 flex-1">{file.error}</span>
                          {onRetryUpload && file.id && (
                            <button
                              onClick={() => onRetryUpload(file.id!)}
                              className="text-[10px] text-blue-600 hover:text-blue-700 font-medium underline"
                            >
                              重试
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ★ P2-7: 输入区图片 lightbox 预览 */}
            {previewOpen && completedImages.length > 0 && (
              <ImageLightbox
                images={completedImages.map((img: any) => ({ url: img.url, name: img.name || '图片' }))}
                currentIndex={previewIndex}
                onClose={() => setPreviewOpen(false)}
                onPrevious={() => setPreviewIndex(i => (i - 1 + completedImages.length) % completedImages.length)}
                onNext={() => setPreviewIndex(i => (i + 1) % completedImages.length)}
              />
            )}
    </>
  );
}
