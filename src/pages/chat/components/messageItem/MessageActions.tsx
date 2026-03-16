/**
 * MessageActions — 消息操作按钮栏
 *
 * 复制、编辑、重新发送、重新生成、TTS、下载、删除等操作。
 * 
 * 改进：
 * - 复制后显示 toast + 图标临时变为 ✓
 * - 删除使用 useConfirm 弹窗替代原生 confirm()
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Copy, Check, RotateCcw, Pencil, Volume2, Square, Download, Trash2, Quote } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { useConfirm } from '@/components/ConfirmDialog';
import { MessageFeedback } from '@/components/MessageFeedback';
import type { ContentProps } from './types';

export function MessageActions({
  msg, index, displayContent, state,
  handleSendMessage,
}: Omit<ContentProps, 'isLastAssistant' | 'handleImageDownload' | 'normalizeImageUrl' | 'extractImagesFromMarkdown'>) {
  const { t } = useTranslation();
  const confirm = useConfirm();
  const [copied, setCopied] = useState(false);
  const {
    messages, setMessages,
    selectedConversationId,
    setUploadedImages, setUploadedFiles,
    isStreamingMessage,
    setActiveResearchTaskId,
    editingMessageIndex, setEditingMessageIndex,
    editText, setEditText,
    playingTtsIndex, handleTtsPlay,
    exportContentPdfMutation,
    generateDocumentMutation,
    chatInputRef,
    setQuotedRef,
  } = state;

  // ── 复制（带反馈） ──
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(displayContent || msg.content);
      setCopied(true);
      toast.success('已复制到剪贴板', { duration: 1500 });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('复制失败');
    }
  };

  // ── 用户消息：重新发送 ──
  const handleResend = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const btn = e.currentTarget as HTMLButtonElement;
    if (btn.disabled) return;
    btn.disabled = true;
    setTimeout(() => { if (btn) btn.disabled = false; }, 2000);

    const resendText = typeof msg.content === 'string' ? msg.content : (msg as any).textContent || '';
    const rawImages = (msg as any).images;
    const resendImages = rawImages?.length
      ? rawImages.map((img: any) => (typeof img === 'string' ? { url: img, name: '图片' } : img))
      : undefined;
    const resendFiles = (msg as any).files?.length ? (msg as any).files : undefined;

    setMessages((prev: any[]) => {
      const idx = prev.findIndex((m: any) => m === msg);
      if (idx === -1) return prev;
      const kept = prev.slice(0, idx);
      for (let i = kept.length - 1; i >= 0; i--) {
        const m = kept[i] as any;
        if (m.isAutomationTask && m.automationTaskId) {
          setTimeout(() => setActiveResearchTaskId(m.automationTaskId), 50);
          break;
        }
        if (m.isResearchTask && m.researchTaskId) {
          setTimeout(() => setActiveResearchTaskId(m.researchTaskId), 50);
          break;
        }
      }
      return kept;
    });
    setUploadedImages([]);
    setUploadedFiles([]);
    if (resendFiles) {
      setTimeout(() => handleSendMessage(resendText, resendImages, resendFiles), 50);
    } else {
      setTimeout(() => handleSendMessage(resendText, resendImages), 50);
    }
  };

  // ── 助手消息：重新生成 ──
  const handleRegenerate = () => {
    if (isStreamingMessage) return;
    const msgIdx = messages.findIndex((m: any) => m === msg);
    if (msgIdx === -1) return;

    let userMsg: any = null;
    for (let i = msgIdx - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        userMsg = messages[i];
        break;
      }
    }
    if (!userMsg) {
      toast.error('找不到对应的用户消息');
      return;
    }

    const resendText = typeof userMsg.content === 'string' ? userMsg.content : (userMsg as any).textContent || '';
    const rawImages = (userMsg as any).images;
    const resendImages = rawImages?.length
      ? rawImages.map((img: any) => (typeof img === 'string' ? { url: img, name: '图片' } : img))
      : undefined;
    const resendFiles = (userMsg as any).files?.length ? (userMsg as any).files : undefined;

    setMessages((prev: any[]) => {
      const idx = prev.findIndex((m: any) => m === msg);
      if (idx === -1) return prev;
      return prev.slice(0, idx);
    });
    setUploadedImages([]);
    setUploadedFiles([]);
    if (resendFiles) {
      setTimeout(() => handleSendMessage(resendText, resendImages, resendFiles, true), 50);
    } else {
      setTimeout(() => handleSendMessage(resendText, resendImages, undefined, true), 50);
    }
  };

  // ── 删除（使用主题弹窗） ──
  const handleDelete = async () => {
    const ok = await confirm({
      title: '删除消息',
      description: '确定要删除这条消息吗？此操作无法撤销。',
      confirmText: '删除',
      cancelText: '取消',
      variant: 'destructive',
    });
    if (ok) {
      setMessages((prev: any[]) => prev.filter((_: any, i: number) => i !== index));
      toast.success('消息已删除', { duration: 1500 });
    }
  };

  // ── 下载为 Markdown ──
  const handleDownloadMarkdown = () => {
    const blob = new Blob([displayContent || msg.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `message-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── 下载为 Word ──
  const handleDownloadWord = () => {
    let progress = 0;
    const toastId = 'generate-doc';
    toast.loading(`正在生成Word文档... 0%`, { id: toastId });
    const progressInterval = setInterval(() => {
      progress += 10;
      if (progress <= 90) toast.loading(`正在生成Word文档... ${progress}%`, { id: toastId });
    }, 200);
    generateDocumentMutation.mutate(
      {
        title: `对话内容-${new Date().toLocaleDateString('zh-CN')}`,
        content: displayContent || msg.content,
      },
      {
        onSuccess: (result: any) => {
          clearInterval(progressInterval);
          toast.success('文档生成成功！正在下载...', { id: toastId });
          const a = document.createElement('a');
          a.href = result.url;
          a.download = result.fileName;
          a.click();
          setTimeout(() => toast.success('文档下载完成！', { id: toastId }), 500);
        },
        onError: (error: any) => {
          clearInterval(progressInterval);
          toast.error(error.message || '文档生成失败', { id: toastId });
        },
      },
    );
  };

  // ── 下载为 PDF ──
  const handleDownloadPdf = () => {
    const toastId = toast.loading('正在生成PDF...', { duration: Infinity });
    exportContentPdfMutation.mutate(
      {
        content: displayContent || msg.content,
        title: `AI整理文档-${new Date().toLocaleDateString('zh-CN')}`,
      },
      {
        onSuccess: (result: any) => {
          toast.success('PDF生成完成！', { id: toastId, duration: 3000 });
          const a = document.createElement('a');
          a.href = result.url;
          a.download = result.filename;
          a.click();
        },
        onError: () => {
          toast.error('PDF生成失败，请重试', { id: toastId, duration: 3000 });
        },
      },
    );
  };

  // ── 引用（图片/视频结果，继续生成） ──
  const hasImages = msg.images && msg.images.length > 0;
  const isVideoTask = !!(msg as any).isVideoTask;
  const hasQuotableMedia = hasImages || isVideoTask;

  const handleQuote = () => {
    if (!chatInputRef?.current) return;

    if (hasImages && msg.images) {
      // 图片引用：设置引用上下文 + 预填输入
      setQuotedRef({
        type: 'image',
        thumbnailUrl: msg.images[0]?.url,
        imageUrls: msg.images.map((img) => ({
          url: img.url,
          name: img.name || '引用图片',
        })),
        label: msg.images.length > 1
          ? `${msg.images.length} 张生成图片`
          : (msg.images[0]?.name || '生成图片'),
      });
      chatInputRef.current.setInput('');
      chatInputRef.current.focus();
      toast.success('已引用图片，请输入后续指令', { duration: 2000 });
    } else if (isVideoTask) {
      const videoPrompt = (msg as any).videoPrompt || '';
      const videoTaskId = (msg as any).videoTaskId;
      setQuotedRef({
        type: 'video',
        videoTaskId,
        prompt: videoPrompt,
        label: videoPrompt || `视频 #${videoTaskId}`,
      });
      chatInputRef.current.setInput('');
      chatInputRef.current.focus();
      toast.success('已引用视频，请输入后续指令', { duration: 2000 });
    }
  };

  return (
    <div className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} opacity-100 md:opacity-0 md:group-hover:opacity-100 md:transition-opacity gap-1 mt-1`}>
      {/* 复制（带 ✓ 反馈） */}
      <Button
        variant="ghost"
        size="sm"
        className={`h-7 w-7 p-0 transition-colors ${copied ? 'text-emerald-500' : ''}`}
        onClick={handleCopy}
        title={copied ? '已复制' : t('chat.copy')}
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>

      {/* 用户消息专属按钮 */}
      {msg.role === 'user' && !isStreamingMessage && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0"
            onClick={() => {
              const textContent = typeof msg.content === 'string' ? msg.content : (msg as any).textContent || '';
              setEditText(textContent);
              setEditingMessageIndex(index);
            }}
            title="编辑消息"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleResend} title="重新发送">
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
        </>
      )}

      {/* 助手消息专属按钮 */}
      {msg.role === 'assistant' && (
        <>
          <MessageFeedback
            messageId={msg.id}
            conversationId={selectedConversationId ?? undefined}
            messageIndex={index}
            messages={messages}
          />
          {/* 引用（图片/视频继续生成） */}
          {hasQuotableMedia && (
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleQuote} title="引用继续生成">
              <Quote className="h-3.5 w-3.5" />
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleRegenerate} title={t('chat.regenerate')}>
            <RotateCcw className="h-3.5 w-3.5" />
          </Button>
          {/* TTS */}
          <Button
            variant="ghost"
            size="sm"
            className={`h-7 w-7 p-0 ${playingTtsIndex === index ? 'text-primary animate-pulse' : ''}`}
            onClick={() => handleTtsPlay(msg.content, index)}
            title={playingTtsIndex === index ? '停止播放' : '语音播放'}
          >
            {playingTtsIndex === index ? <Square className="h-3 w-3 fill-current" /> : <Volume2 className="h-3.5 w-3.5" />}
          </Button>
          {/* 下载菜单 */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title={t('chat.downloadBtn')}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={handleDownloadMarkdown}>下载为Markdown</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadWord}>下载为Word</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownloadPdf}>下载为PDF</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </>
      )}

      {/* 删除（使用主题弹窗） */}
      <Button
        variant="ghost"
        size="sm"
        className="h-7 w-7 p-0 text-destructive hover:text-destructive"
        onClick={handleDelete}
        title={t('chat.delete')}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
