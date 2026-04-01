import { useState, useCallback } from 'react';
import { toast } from 'sonner';

interface DownloadOptions {
  filename?: string;
  loadingMsg?: string;
  successMsg?: string;
  errorMsg?: string;
}

/**
 * 统一下载钩子 - 所有文件/图片/视频下载都走这里
 * 提供：loading toast → 进度条样式 → 成功/失败反馈
 */
export function useDownload() {
  const [downloading, setDownloading] = useState<Record<string, boolean>>({});

  const download = useCallback(async (
    url: string,
    options: DownloadOptions = {}
  ) => {
    const {
      filename = `download_${Date.now()}`,
      loadingMsg = '正在准备下载...',
      successMsg = '下载成功！',
      errorMsg = '下载失败，请重试',
    } = options;

    if (downloading[url]) return; // 防止重复点击
    setDownloading(prev => ({ ...prev, [url]: true }));

    const toastId = toast.loading(loadingMsg, {
      description: '请稍候，文件正在传输中...',
      duration: Infinity,
    });

    try {
      const response = await fetch(url, { credentials: 'include' });
      if (!response.ok) {
        let errMsg = errorMsg;
        try { errMsg = (await response.json()).message || errorMsg; } catch {}
        throw new Error(errMsg);
      }

      // 读取带进度的 blob
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];
      let received = 0;

      if (reader && total > 0) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          received += value.length;
          const pct = Math.round((received / total) * 100);
          toast.loading(`正在下载 ${pct}%`, {
            id: toastId,
            description: `${(received / 1024 / 1024).toFixed(1)} MB / ${(total / 1024 / 1024).toFixed(1)} MB`,
          });
        }
      } else {
        // 无 content-length，直接读完，显示转换中动画
        toast.loading('正在转换文件...', {
          id: toastId,
          description: '即将完成，请稍候',
        });
        if (reader) {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
          }
        }
      }

      const blob = new Blob(chunks);
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objectUrl);

      toast.success(successMsg, {
        id: toastId,
        description: filename,
        duration: 3000,
      });
    } catch (error: any) {
      console.error('[useDownload] Error:', error);
      toast.error(error.message || errorMsg, {
        id: toastId,
        duration: 5000,
      });
    } finally {
      setDownloading(prev => {
        const next = { ...prev };
        delete next[url];
        return next;
      });
    }
  }, [downloading]);

  const isDownloading = useCallback((url: string) => !!downloading[url], [downloading]);

  return { download, isDownloading };
}
