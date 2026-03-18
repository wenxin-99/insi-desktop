/**
 * useExport — 对话导出功能
 * 
 * 支持导出为 Markdown、Word (docx)、PDF 格式。
 * 
 * 原始位置: Chat.tsx L215-372, L3041-3140
 */

import { toast } from 'sonner';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import { useDownload } from '@/hooks/useDownload';
import type { ChatStateReturn } from '../types';

export function useExport(state: ChatStateReturn) {
  const {
    t, messages, conversations, selectedConversationId, utils,
    exportPdfMutation, exportContentPdfMutation, generateDocumentMutation,
  } = state;

  const { download: _download } = useDownload();

  // ═══════════ 导出 Markdown ═══════════

  const exportToMarkdown = () => {
    if (messages.length === 0) {
      toast.error(t('chat.export.noContent'));
      return;
    }

    const conversation = conversations?.find((c: any) => c.id === selectedConversationId);
    const title = conversation?.title || '新对话';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

    let markdown = `# ${title}\n\n`;
    markdown += `> 导出时间：${new Date().toLocaleString('zh-CN')}\n\n`;
    markdown += `---\n\n`;

    messages.forEach((msg, index) => {
      const role = msg.role === 'user' ? '👤 用户' : '🤖 AI助手';
      markdown += `## ${role}\n\n`;
      if (msg.content) markdown += `${msg.content}\n\n`;
      if (msg.images && msg.images.length > 0) {
        markdown += `### 图片\n\n`;
        msg.images.forEach((img, imgIndex) => {
          markdown += `![${img.name || `图片${imgIndex + 1}`}](${img.url})\n\n`;
        });
      }
      if (index < messages.length - 1) markdown += `---\n\n`;
    });

    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${title}_${timestamp}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success(t('chat.export.markdownSuccess'));
  };

  // ═══════════ 导出 Word ═══════════

  const exportToWord = async () => {
    if (messages.length === 0) {
      toast.error(t('chat.export.noContent'));
      return;
    }

    const conversation = conversations?.find((c: any) => c.id === selectedConversationId);
    const title = conversation?.title || '新对话';
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');

    try {
      const sections: any[] = [];
      sections.push(
        new Paragraph({ text: title, heading: HeadingLevel.HEADING_1, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: `导出时间：${new Date().toLocaleString('zh-CN')}`, alignment: AlignmentType.CENTER }),
        new Paragraph({ text: '' }),
      );

      messages.forEach((msg, index) => {
        const role = msg.role === 'user' ? '👤 用户' : '🤖 AI助手';
        sections.push(new Paragraph({ text: role, heading: HeadingLevel.HEADING_2 }));
        if (msg.content) {
          msg.content.split('\n').forEach(line => {
            sections.push(new Paragraph({ text: line || ' ' }));
          });
        }
        if (msg.images && msg.images.length > 0) {
          sections.push(new Paragraph({ children: [new TextRun({ text: `[包含 ${msg.images.length} 张图片]`, italics: true })] }));
          msg.images.forEach((img, imgIndex) => {
            sections.push(new Paragraph({ text: `图片 ${imgIndex + 1}: ${img.url}` }));
          });
        }
        if (index < messages.length - 1) {
          sections.push(new Paragraph({ text: '' }), new Paragraph({ text: '---', alignment: AlignmentType.CENTER }), new Paragraph({ text: '' }));
        }
      });

      const doc = new Document({ sections: [{ properties: {}, children: sections }] });
      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title}_${timestamp}.docx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      toast.success(t('chat.export.wordSuccess'));
    } catch (error) {
      console.error('Export to Word error:', error);
      toast.error(t('chat.export.wordFailed'));
    }
  };

  // ═══════════ 导出 Markdown（单个对话） ═══════════

  const handleExportConversation = async (id: number) => {
    try {
      const result = await utils.conversation.exportMarkdown.fetch({ id });
      const blob = new Blob([result.markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('对话已导出为Markdown格式');
    } catch (error: any) {
      toast.error(error.message || '导出对话失败');
    }
  };

  // ═══════════ 导出 PDF ═══════════

  const handleExportPdf = (id: number) => {
    const toastId = toast.loading('正在生成 PDF，请稍候...', {
      description: '后台处理中，完成后自动下载',
      duration: Infinity,
    });

    exportPdfMutation.mutateAsync({ id })
      .then((result: any) => {
        toast.success('PDF 生成完成！', {
          id: toastId,
          description: '正在下载...',
          duration: 4000,
          action: {
            label: '重新下载',
            onClick: () => {
              const a2 = document.createElement('a');
              a2.href = result.url;
              a2.download = result.filename;
              a2.target = '_blank';
              document.body.appendChild(a2);
              a2.click();
              document.body.removeChild(a2);
            },
          },
        });
        const a = document.createElement('a');
        a.href = result.url;
        a.download = result.filename;
        a.target = '_blank';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      })
      .catch((error: any) => {
        toast.error('导出 PDF 失败', { id: toastId, description: error.message || '请稍后重试', duration: 5000 });
      });
  };

  // ═══════════ 图片下载 ═══════════

  const handleImageDownload = async (rawUrl: string, _imageName: string) => {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `image_${timestamp}.png`;

    let downloadUrl: string;
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      if (parsed.origin === window.location.origin) {
        downloadUrl = parsed.pathname + parsed.search;
      } else {
        downloadUrl = `/api/image-proxy?url=${encodeURIComponent(rawUrl)}`;
      }
    } catch {
      downloadUrl = rawUrl;
    }

    await _download(downloadUrl, {
      filename,
      loadingMsg: '正在下载图片...',
      successMsg: '图片下载成功！',
      errorMsg: '图片下载失败，请重试',
    });
  };

  // ═══════════ 分享对话（生成公开链接） ═══════════

  const handleShareConversation = async (id: number) => {
    const toastId = toast.loading('正在生成分享链接...', { duration: Infinity });
    try {
      const result = await utils.client.conversation.createShare.mutate({ conversationId: id });
      const fullUrl = `${window.location.origin}${result.shareUrl}`;
      
      // 移动端优先使用原生分享，桌面端复制到剪贴板
      const { shareOrCopy } = await import('@/utils/clipboard');
      const outcome = await shareOrCopy({
        url: fullUrl,
        title: '对话分享',
        text: '查看我的AI对话',
      });

      if (outcome === 'shared') {
        toast.success('已通过系统分享发送', {
          id: toastId,
          duration: 3000,
        });
      } else if (outcome === 'copied') {
        toast.success('分享链接已复制到剪贴板！', {
          id: toastId,
          description: '任何人都可以通过此链接查看对话（敏感信息已脱敏）',
          duration: 6000,
          action: {
            label: '打开预览',
            onClick: () => window.open(result.shareUrl, '_blank'),
          },
        });
      } else {
        // 都失败时直接显示链接供手动复制
        toast.success('分享链接已生成', {
          id: toastId,
          description: fullUrl,
          duration: 10000,
          action: {
            label: '打开',
            onClick: () => window.open(result.shareUrl, '_blank'),
          },
        });
      }
    } catch (error: any) {
      toast.error('生成分享链接失败', { id: toastId, description: error.message || '请稍后重试', duration: 5000 });
    }
  };

  return {
    exportToMarkdown,
    exportToWord,
    handleExportConversation,
    handleExportPdf,
    handleImageDownload,
    handleShareConversation,
  };
}
