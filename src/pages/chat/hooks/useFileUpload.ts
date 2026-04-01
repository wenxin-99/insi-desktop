/**
 * useFileUpload — 文件/图片上传逻辑
 * 
 * 处理拖拽上传、图片压缩/验证、文件上传（XHR进度）、重试。
 * 
 * 原始位置: Chat.tsx L753-1178
 */

import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ChatStateReturn } from '../types';

/** 为 XHR 附加 Bearer token（和 tRPC/chat 保持一致） */
function setXhrAuth(xhr: XMLHttpRequest) {
  const token = localStorage.getItem('auth_token');
  if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
}

export function useFileUpload(state: ChatStateReturn) {
  const {
    t, setIsDragging, setUploadedImages, setUploadedFiles,
    uploadedFiles,
  } = state;

  // ═══════════ 拖拽事件处理 ═══════════

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, [setIsDragging]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false);
    }
  }, [setIsDragging]);

  // ═══════════ 图片压缩 ═══════════

  const compressImage = async (file: File): Promise<File> => {
    const maxSize = 500 * 1024;
    if (file.size <= maxSize && ['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      return file;
    }

    const objectUrl = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        const timeout = setTimeout(() => {
          console.warn('[IMAGE UPLOAD] Image load timeout after 15s, skipping compression');
          reject(new Error('Image load timeout'));
        }, 15000);
        image.onload = () => { clearTimeout(timeout); resolve(image); };
        image.onerror = () => { clearTimeout(timeout); reject(new Error('Image load failed')); };
        image.src = objectUrl;
      });

      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const maxDimension = 1920;
      if (width > height && width > maxDimension) {
        height = (height * maxDimension) / width;
        width = maxDimension;
      } else if (height > maxDimension) {
        width = (width * maxDimension) / height;
        height = maxDimension;
      }
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context failed');
      ctx.drawImage(img, 0, 0, width, height);

      const outputType = (file.type === 'image/png' || file.type === 'image/gif') ? file.type : 'image/jpeg';
      const outputExt = outputType === 'image/png' ? '.png' : outputType === 'image/gif' ? '.gif' : '.jpg';
      const outputName = file.name.replace(/\.[^.]+$/, outputExt);

      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, outputType, 0.85);
      });
      if (!blob) throw new Error('Compression failed - no blob');

      const compressedFile = new File([blob], outputName, { type: outputType, lastModified: Date.now() });
      return compressedFile;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  // ═══════════ 图片验证 ═══════════

  const validateImage = (file: File): { valid: boolean; error?: string } => {
    const validFormats = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/heic', 'image/heif', 'image/bmp', 'image/tiff'];
    const maxSize = 20 * 1024 * 1024;

    const isImage = validFormats.includes(file.type) || file.type.startsWith('image/') ||
      /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff)$/i.test(file.name);
    if (!isImage) return { valid: false, error: t('chat.upload.unsupportedFormat') };
    if (file.size > maxSize) return { valid: false, error: t('chat.upload.sizeLimit') };
    return { valid: true };
  };

  // ═══════════ 文件上传（XHR + 进度 + 自动重试） ═══════════

  const handleFileUpload = async (file: File) => {
    const maxSize = 50 * 1024 * 1024;

    // 检测空文件
    if (!file.size || file.size === 0) {
      toast.error(`${file.name} 是空文件（0 字节），请检查文件是否完整`);
      return;
    }

    if (file.size > maxSize) {
      toast.error(`文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大支持50MB`);
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    setUploadedFiles((prev) => [
      ...prev,
      { url: '', name: file.name, size: file.size, progress: 0, id: tempId, file } as any,
    ]);

    const MAX_RETRIES = 2;
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      // 重试时等一小段时间
      if (attempt > 0) {
        const delay = attempt * 1500; // 1.5s, 3s
        setUploadedFiles((prev) =>
          prev.map((f: any) => f.id === tempId
            ? { ...f, error: undefined, progress: 0, statusText: `重试中 (${attempt}/${MAX_RETRIES})...` }
            : f)
        );
        await new Promise(r => setTimeout(r, delay));
      }

      let activeXhr: XMLHttpRequest | null = null;

      try {
        const formData = new FormData();
        formData.append('file', file);
        const xhr = new XMLHttpRequest();
        activeXhr = xhr;

        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const percentComplete = Math.round((e.loaded / e.total) * 90);
            setUploadedFiles((prev) =>
              prev.map((f: any) => f.id === tempId ? { ...f, progress: percentComplete, statusText: undefined } : f)
            );
          }
        });

        xhr.upload.addEventListener('load', () => {
          setUploadedFiles((prev) =>
            prev.map((f: any) => f.id === tempId ? { ...f, progress: 92, statusText: '服务器处理中...' } : f)
          );
        });

        const uploadPromise = new Promise<any>((resolve, reject) => {
          xhr.onload = () => {
            activeXhr = null;
            if (xhr.status === 200) {
              resolve(JSON.parse(xhr.responseText));
            } else if (xhr.status === 401) {
              reject(new Error('登录已过期，请刷新页面'));
            } else if (xhr.status === 413) {
              reject(new Error('文件过大，超过服务器限制'));
            } else if (xhr.status === 400) {
              let errMsg = '文件类型不支持';
              try { errMsg = JSON.parse(xhr.responseText)?.error || errMsg; } catch {}
              reject(new Error(errMsg));
            } else {
              let errMsg = `服务器错误 (${xhr.status})`;
              try { errMsg = JSON.parse(xhr.responseText)?.error || errMsg; } catch {}
              reject(new Error(errMsg));
            }
          };
          xhr.onerror = () => { activeXhr = null; reject(new Error('网络连接失败，请检查网络')); };
          xhr.ontimeout = () => { activeXhr = null; reject(new Error('上传超时，文件可能过大或网络较慢')); };
        });

        xhr.open('POST', '/api/upload');
        xhr.timeout = 120000;
        setXhrAuth(xhr);
        xhr.send(formData);

        const result = await uploadPromise;
        // 上传成功
        setUploadedFiles((prev) =>
          prev.map((f: any) => f.id === tempId ? { url: result.url, name: file.name, size: file.size } : f)
        );
        return; // 成功，退出重试循环
      } catch (error: any) {
        if (activeXhr) { activeXhr.abort(); activeXhr = null; }
        lastError = error;

        // 非网络错误（如 401、400）不重试
        const isNetworkError = error.message?.includes('网络') || error.message?.includes('超时');
        if (!isNetworkError) break;

        // 最后一次重试也失败了
        if (attempt === MAX_RETRIES) break;

        console.warn(`[Upload] Attempt ${attempt + 1} failed for ${file.name}, retrying...`, error.message);
      }
    }

    // 所有尝试都失败了
    const errorMsg = lastError?.message || '上传失败';
    setUploadedFiles((prev) =>
      prev.map((f: any) => f.id === tempId ? { ...f, error: errorMsg, progress: undefined, statusText: undefined } : f)
    );
    toast.error(`${file.name} ${t('chat.upload.failed')}: ${errorMsg}`);
  };

  // ═══════════ 文件重试 ═══════════

  const retryUpload = async (fileId: string) => {
    const fileItem = uploadedFiles.find((f: any) => f.id === fileId);
    if (!fileItem || !fileItem.file) {
      toast.error('无法重试：原始文件引用已丢失，请重新选择文件');
      // 移除失败的条目
      setUploadedFiles((prev) => prev.filter((f: any) => f.id !== fileId));
      return;
    }

    // 检测空文件
    if (!fileItem.file.size || fileItem.file.size === 0) {
      toast.error(`${fileItem.file.name} 是空文件（0 字节），请检查文件是否完整`);
      setUploadedFiles((prev) => prev.filter((f: any) => f.id !== fileId));
      return;
    }

    setUploadedFiles((prev) =>
      prev.map((f: any) => f.id === fileId ? { ...f, error: undefined, progress: 0, statusText: undefined } : f)
    );

    try {
      const formData = new FormData();
      formData.append('file', fileItem.file);
      const xhr = new XMLHttpRequest();

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = Math.round((e.loaded / e.total) * 90);
          setUploadedFiles((prev) =>
            prev.map((f: any) => f.id === fileId ? { ...f, progress: percentComplete } : f)
          );
        }
      });

      xhr.upload.addEventListener('load', () => {
        setUploadedFiles((prev) =>
          prev.map((f: any) => f.id === fileId ? { ...f, progress: 92, statusText: '服务器处理中...' } : f)
        );
      });

      const uploadPromise = new Promise<any>((resolve, reject) => {
        xhr.onload = () => {
          if (xhr.status === 200) resolve(JSON.parse(xhr.responseText));
          else {
            let errMsg = `上传失败 (${xhr.status})`;
            try { errMsg = JSON.parse(xhr.responseText)?.error || errMsg; } catch {}
            reject(new Error(errMsg));
          }
        };
        xhr.onerror = () => reject(new Error('网络连接失败，请检查网络'));
        xhr.ontimeout = () => reject(new Error('上传超时'));
      });

      xhr.open('POST', '/api/upload');
      xhr.timeout = 120000;
      setXhrAuth(xhr);
      xhr.send(formData);

      const result = await uploadPromise;
      setUploadedFiles((prev) =>
        prev.map((f: any) => f.id === fileId ? { url: result.url, name: fileItem.file!.name, size: fileItem.file!.size } : f)
      );
    } catch (error: any) {
      setUploadedFiles((prev) =>
        prev.map((f: any) => f.id === fileId ? { ...f, error: error.message || '上传失败', progress: undefined, statusText: undefined } : f)
      );
      toast.error(`${fileItem.file.name} ${t('chat.upload.failed')}: ${error.message || t('chat.upload.unknownError')}`);
    }
  };

  // ═══════════ 图片上传 ═══════════

  const handleImageUpload = async (file: File) => {
    const validation = validateImage(file);
    if (!validation.valid) {
      toast.error(validation.error!);
      return;
    }

    const tempId = `temp-${Date.now()}-${Math.random()}`;
    const previewUrl = URL.createObjectURL(file);
    setUploadedImages((prev) => [...prev, { url: previewUrl, name: file.name, progress: 0, id: tempId } as any]);

    try {
      let processedFile = file;
      const needsCompression = file.size > 500 * 1024 || !['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type);
      if (needsCompression) {
        try {
          processedFile = await Promise.race([
            compressImage(file),
            new Promise<File>((_, reject) => setTimeout(() => reject(new Error('Compression timeout')), 20000)),
          ]);
        } catch (error: any) {
          console.warn('[IMAGE UPLOAD] Compression failed/timeout, uploading original file:', error.message);
          processedFile = file;
        }
      }

      try {
        const formData = new FormData();
        formData.append('file', processedFile);

        // 网络错误自动重试（最多 2 次）
        const MAX_RETRIES = 2;
        let lastUploadError: Error | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (attempt > 0) {
            await new Promise(r => setTimeout(r, attempt * 1500));
            setUploadedImages((prev) =>
              prev.map((img: any) => img.id === tempId ? { ...img, progress: 0 } : img)
            );
            // 重新创建 FormData（XHR send 后不可复用）
            const retryFormData = new FormData();
            retryFormData.append('file', processedFile);
          }

          try {
            const uploadFormData = new FormData();
            uploadFormData.append('file', processedFile);

            const xhr = new XMLHttpRequest();
            let lastProgressUpdate = 0;

            xhr.upload.addEventListener('progress', (e) => {
              if (e.lengthComputable) {
                const percentComplete = Math.round((e.loaded / e.total) * 100);
                if (percentComplete !== lastProgressUpdate) {
                  lastProgressUpdate = percentComplete;
                  setUploadedImages((prev) =>
                    prev.map((img: any) => img.id === tempId ? { ...img, progress: percentComplete } : img)
                  );
                }
              }
            });

            const uploadPromise = new Promise<any>((resolve, reject) => {
              xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                  try { resolve(JSON.parse(xhr.responseText)); }
                  catch { reject(new Error('解析响应失败')); }
                } else {
                  try { const error = JSON.parse(xhr.responseText); reject(new Error(error.message || error.error || '上传失败')); }
                  catch { reject(new Error(`上传失败 (${xhr.status})`)); }
                }
              };
              xhr.onerror = () => reject(new Error('网络连接失败'));
              xhr.ontimeout = () => reject(new Error('上传超时'));
              xhr.timeout = 120000;
              xhr.open('POST', '/api/upload');
              setXhrAuth(xhr);
              xhr.send(uploadFormData);
            });

            const result = await uploadPromise;
            setUploadedImages((prev) =>
              prev.map((img: any) => img.id === tempId ? { url: result.url, name: file.name } : img)
            );
            URL.revokeObjectURL(previewUrl);
            return; // 成功，退出
          } catch (uploadErr: any) {
            lastUploadError = uploadErr;
            const isNetworkError = uploadErr.message?.includes('网络') || uploadErr.message?.includes('超时');
            if (!isNetworkError || attempt === MAX_RETRIES) break;
            console.warn(`[IMAGE UPLOAD] Attempt ${attempt + 1} failed, retrying...`, uploadErr.message);
          }
        }

        // 所有尝试失败
        throw lastUploadError || new Error('上传失败');
      } catch (error: any) {
        console.error('[IMAGE UPLOAD] Upload failed:', error);
        toast.error(`${t('chat.upload.failed')}: ${error.message || t('chat.upload.unknownError')}`);
        setUploadedImages((prev) => prev.filter((img: any) => img.id !== tempId));
        URL.revokeObjectURL(previewUrl);
      }
    } catch (error: any) {
      toast.error(`${t('chat.upload.failed')}: ${error.message || t('chat.upload.unknownError')}`);
      setUploadedImages((prev) => prev.filter((img: any) => img.id !== tempId));
      URL.revokeObjectURL(previewUrl);
    }
  };

  // ═══════════ 拖拽放下处理 ═══════════

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    for (const file of files) {
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff)$/i.test(file.name);
      if (isImage) {
        await handleImageUpload(file);
      } else {
        await handleFileUpload(file);
      }
    }
  };

  return {
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleFileUpload,
    handleImageUpload,
    retryUpload,
    compressImage,
    validateImage,
  };
}
