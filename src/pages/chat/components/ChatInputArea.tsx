/**
 * ChatInputArea — 底部输入区域
 * 
 * 包含：推荐追问、上传预览（图片+文件）、LaTeX预览、
 * 图片风格选择器、并发/消息上限提示、深度研究提示、
 * 输入框（ChatInput）、底部工具栏（附件/研究/语音/发送）
 * 
 * 原始位置: Chat.tsx L5217-5878 / MessageList L1592-2250
 */

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChatInput, SendMessagePayload } from '@/components/ChatInput';
import { ChatToolPanel } from '@/components/ChatToolPanel';
import { LatexPreview } from '@/components/LatexPreview';
import { ImageUploadPreview } from '@/components/ImageUploadPreview';
import { PressToTalkButton } from '@/components/PressToTalkButton';
import { useVoiceInputSettings } from '@/hooks/useVoiceInputSettings';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { formatFileSize } from '@/lib/formatFileSize';
import { streamManager } from '@/lib/backgroundStreamManager';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import {
  Loader2, ArrowUp, Sparkles, Paperclip, Image as ImageIcon,
  Mic, Bot, FileText, FileSpreadsheet, File, FileType,
  FileCode, Zap, Search, StopCircle, Square, Plus,
} from 'lucide-react';
import { useRef } from 'react';
import { useState as useStateKB } from 'react';
import type { SelectedKB } from '@/components/KnowledgeBasePicker';
import type { SelectedGitHubRepo } from '@/components/GitHubRepoPicker';
import { useTranslation } from 'react-i18next';
import type { ChatStateReturn } from '../types';

interface ChatInputAreaProps {
  state: ChatStateReturn;
  handleSendMessage: (text?: string, resendImages?: any[], resendFiles?: any[], isRegenerate?: boolean) => void;
  handleStopStreaming: () => void;
  handleFileUpload: (file: File) => Promise<void>;
  handleImageUpload: (file: File) => Promise<void>;
  retryUpload: (fileId: string) => Promise<void>;
}

import { UploadedFiles } from "./inputArea/UploadedFiles";
import { TaskStatusPanel } from "./inputArea/TaskStatusPanel";
import { InputToolbar } from "./inputArea/InputToolbar";
import { QuotedRefPreview } from "./inputArea/QuotedRefPreview";

export function ChatInputArea({
  state, handleSendMessage, handleStopStreaming,
  handleFileUpload, handleImageUpload, retryUpload,
}: ChatInputAreaProps) {
  const { t } = useTranslation();
  const {
    selectedConversationId, setSelectedConversationId,
    messages, setMessages,
    uploadedImages, setUploadedImages,
    uploadedFiles, setUploadedFiles,
    isStreamingMessage,
    isResearchMode, setIsResearchMode,
    isDragging, setIsDragging,
    suggestedQuestions, setSuggestedQuestions,
    showStyleSelector, setShowStyleSelector,
    showTaskLimitBanner, setShowTaskLimitBanner,
    hasInputContent, setHasInputContent,
    selectedStyle, setSelectedStyle,
    selectedAspectRatio, setSelectedAspectRatio,
    isTtsAutoMode, setIsTtsAutoMode,
    chatInputRef, fileInputRef, imageInputRef,
    selectedPackageId, modelPackages,
    conversationLimitInfo,
    abortStream,
    voiceDialogOpen, setVoiceDialogOpen,
    isUploading,
    conversations,
    streamingTts,
    quotedRef, setQuotedRef,
  } = state;

  // ★ 知识库选择状态
  const [selectedKB, setSelectedKB] = useStateKB<SelectedKB | null>(null);
  // ★ GitHub 仓库绑定状态
  const [selectedGitHubRepo, setSelectedGitHubRepo] = useStateKB<SelectedGitHubRepo | null>(null);
  // ★ 附件菜单状态
  const [attachMenuOpen, setAttachMenuOpen] = useStateKB(false);

  const { voiceSettings } = useVoiceInputSettings();

  // ───────────────────────────────────────────────
  // 辅助函数
  // ───────────────────────────────────────────────

  function removeImage(url: string) {
    setUploadedImages(prev => prev.filter(img => img.url !== url));
  }

  function removeFile(urlOrName: string) {
    setUploadedFiles(prev => prev.filter(f => {
      // 先按 url 匹配，如果 url 为空则按 name 匹配
      if (f.url && f.url === urlOrName) return false;
      if (!f.url && f.name === urlOrName) return false;
      return true;
    }));
    // 重置文件input，确保下次选相同文件能触发onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  // 拍照专用 input ref
  const cameraInputRef = useRef<HTMLInputElement>(null);

  function handleAttachment() {
    fileInputRef.current?.click();
  }

  function handleImageAttachment() {
    imageInputRef.current?.click();
  }

  function handleCamera() {
    cameraInputRef.current?.click();
  }

  function toggleResearch() {
    setIsResearchMode(!isResearchMode);
  }

  function handleVoice() {
    setVoiceDialogOpen(true);
  }

  function handleSend() {
    const text = chatInputRef.current?.getValue()?.trim();
    if (!text && uploadedImages.length === 0 && uploadedFiles.length === 0 && !quotedRef) return;
    chatInputRef.current?.clear();
    setHasInputContent(false);

    // ★ 如果绑定了 GitHub 仓库，在消息前附加上下文标记
    const ghPrefix = selectedGitHubRepo
      ? `[GitHub仓库: ${selectedGitHubRepo.fullName}${selectedGitHubRepo.branch ? `@${selectedGitHubRepo.branch}` : ''}${selectedGitHubRepo.taskId ? ` #taskId=${selectedGitHubRepo.taskId}` : ''}] `
      : '';

    // ★ 处理引用上下文
    if (quotedRef) {
      if (quotedRef.type === 'image' && quotedRef.imageUrls?.length) {
        setUploadedImages(prev => {
          const existing = new Set(prev.map(i => i.url));
          const newImages = quotedRef.imageUrls!.filter(i => !existing.has(i.url));
          return [...prev, ...newImages];
        });
        setQuotedRef(null);
        setTimeout(() => handleSendMessage(ghPrefix + (text || '')), 50);
        return;
      }
      if (quotedRef.type === 'video' && quotedRef.videoTaskId) {
        const videoContext = `[引用视频 #${quotedRef.videoTaskId}${quotedRef.prompt ? `：${quotedRef.prompt}` : ''}] `;
        setQuotedRef(null);
        handleSendMessage(ghPrefix + videoContext + (text || ''));
        return;
      }
      setQuotedRef(null);
    }

    handleSendMessage(ghPrefix + (text || ''));
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  // 运行中的自动化任务（从 messages 中提取）
  const runningAutomationTasks = messages.filter(
    (m: any) => m.isAutomationTask && m.taskStatus === 'running'
  );
  const messageCount = messages.filter((m: any) => m.role === 'user').length;
  const maxMessages = conversationLimitInfo?.maxMessages ?? Infinity;

  // ───────────────────────────────────────────────
  // 以下为原始输入区域 JSX (Chat.tsx L5217-5878)
  // ───────────────────────────────────────────────

  return (
        <div className={cn(
          "shrink-0 px-1.5 md:px-2 pb-safe border-t border-border/20 md:border-t-0 pt-1 md:mx-auto md:w-full md:pb-0 md:mb-0 transition-all duration-300 ease-in-out md:max-w-[900px]"
        )}>
          {/* 隐藏的文件上传 input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.heic,.heif,.pdf,.doc,.docx,.txt,.md,.xlsx,.xls,.csv,.ppt,.pptx,.zip,.tar,.gz,.tgz,.rar,.7z,.bz2,.xz,.tar.gz,.json,.xml,.html,.css,.js,.ts,.py,.java,.cpp,.c,.go,.rs,.sh,.sql,.yaml,.yml,.toml,.log,.ini,.cfg,.conf,.env,.mp4,.mov,.avi,.webm,.mkv,.flv,.wmv,video/*"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              for (const file of files) {
                const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff)$/i.test(file.name);
                if (isImage) {
                  await handleImageUpload(file);
                } else {
                  await handleFileUpload(file);
                }
              }
              e.target.value = '';
            }}
          />
          <input
            ref={imageInputRef}
            type="file"
            accept="image/*,.heic,.heif"
            multiple
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              for (const file of files) {
                await handleImageUpload(file);
              }
              e.target.value = '';
            }}
          />
          {/* 拍照专用 input（移动端 capture） */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const files = Array.from(e.target.files || []);
              for (const file of files) {
                await handleImageUpload(file);
              }
              e.target.value = '';
            }}
          />

          {/* 推荐追问已移至消息流中AI回复下方显示 */}
          
          {/* 当前使用的模型信息提示 - 已隐藏 */}
          {false && selectedPackageId && (() => {
            const currentPackage = modelPackages?.find((p: any) => p.id === selectedPackageId);
            if (!currentPackage) return null;
            
            return (
              <div className="flex items-center justify-center gap-2 px-3 py-1.5 text-xs text-muted-foreground bg-muted/50 rounded-lg">
                <Bot className="h-3.5 w-3.5" />
                <span>
                  当前使用：<span className="font-medium text-foreground">{currentPackage?.displayName}</span>
                </span>
              </div>
            );
          })()}
          
          {/* 输入框容器 - 拖拽区域（不带边框） */}
          <div 
            className={`relative flex flex-col gap-1 ${
              isDragging 
                ? 'rounded-2xl border-2 border-primary bg-primary/5' 
                : ''
            }`}
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              // 只有当离开容器本身时才设置为false
              if (e.currentTarget === e.target) {
                setIsDragging(false);
              }
            }}
            onDrop={async (e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsDragging(false);
              
              const files = Array.from(e.dataTransfer.files);
              if (files.length === 0) return;
              
              // 处理每个文件
              for (const file of files) {
                const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|heic|heif|bmp|tiff)$/i.test(file.name);
                if (isImage) {
                  await handleImageUpload(file);
                } else {
                  await handleFileUpload(file);
                }
              }
            }}
          >
            

          {/* 引用预览 */}
          {quotedRef && (
            <QuotedRefPreview quotedRef={quotedRef} onRemove={() => setQuotedRef(null)} />
          )}

          {/* 已上传文件 */}
          <UploadedFiles uploadedImages={uploadedImages} uploadedFiles={uploadedFiles}
            onRemoveImage={removeImage} onRemoveFile={removeFile} onRetryUpload={retryUpload} />

            {/* LaTeX实时预览 - 使用 chatInputRef 获取当前输入值 */}
            {chatInputRef.current?.getValue()?.trim() && (
              <LatexPreview text={chatInputRef.current.getValue()} className="mb-2" />
            )}
            
            {/* ★★★ 方案 A：单一边框输入容器 ★★★
                 ┌─ rounded-2xl border ──────────────────────┐
                 │  ✦ 选择图片风格                            │
                 │  [+]  输入你的问题...          [🎤] [➤]   │
                 └──────────────────────────────────────────┘
            */}
            <div className={cn(
              "border border-border/60 rounded-2xl bg-card transition-all duration-200",
              "focus-within:border-primary/30 focus-within:shadow-[0_0_0_3px_rgba(37,99,235,0.06)]",
            )}>
              {/* 风格选择（边框内顶部） */}
              <div className="px-3 pt-2">
                <Button
                  variant="ghost" size="sm"
                  onClick={() => setShowStyleSelector(!showStyleSelector)}
                  className="text-xs h-7 px-2 text-muted-foreground hover:text-foreground"
                  type="button"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1.5"><path d="M12 2v20M2 12h20"/><path d="m19 19-2-2m0 0-2-2m2 2-2 2m2-2 2-2"/><path d="M5 5l2 2m0 0 2 2M7 7 5 9m2-2 2-2"/></svg>
                  {selectedStyle ? t('chat.styleSelector.currentStyle', { style: selectedStyle }) : t('chat.styleSelector.title')}
                </Button>
                {/* 风格展开面板 */}
                {showStyleSelector && (
                  <div className="flex flex-wrap gap-1.5 pt-2 pb-1">
                    <TooltipProvider>
                    {[
                      { id: 'realistic', prompt: 'photorealistic, high quality, detailed', preview: '/style-previews/realistic.png' },
                      { id: 'cartoon', prompt: 'cartoon style, vibrant colors, playful', preview: '/style-previews/cartoon.png' },
                      { id: 'watercolor', prompt: 'watercolor painting, soft colors, artistic', preview: '/style-previews/watercolor.png' },
                      { id: 'oil', prompt: 'oil painting, rich textures, classic art style', preview: '/style-previews/oil-painting.png' },
                      { id: 'sketch', prompt: 'pencil sketch, black and white, hand-drawn', preview: '/style-previews/sketch.png' },
                      { id: 'cyberpunk', prompt: 'cyberpunk style, neon lights, futuristic', preview: '/style-previews/cyberpunk.png' },
                      { id: 'anime', prompt: 'anime style, manga art, Japanese animation', preview: '/style-previews/anime.png' },
                      { id: '3d', prompt: '3D render, CGI, high quality rendering', preview: '/style-previews/3d-render.png' },
                    ].map((style) => (
                      <Tooltip key={style.id} delayDuration={300}>
                        <TooltipTrigger asChild>
                          <Button
                            variant={selectedStyle === t(`chat.styleSelector.styles.${style.id}`) ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => {
                              const label = t(`chat.styleSelector.styles.${style.id}`);
                              setSelectedStyle(label);
                              const cur = chatInputRef.current?.getValue()?.trim() || '';
                              if (cur && !cur.includes(style.prompt)) chatInputRef.current?.setInput(`${cur}, ${style.prompt}`);
                              else if (!cur) chatInputRef.current?.setInput(style.prompt);
                            }}
                            className="text-xs h-7 px-2"
                            type="button"
                          >
                            {t(`chat.styleSelector.styles.${style.id}`)}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="p-0 border-0 bg-transparent shadow-2xl">
                          <img src={style.preview} alt={t(`chat.styleSelector.styles.${style.id}`)} className="w-48 h-48 object-cover rounded-lg shadow-xl" />
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    </TooltipProvider>
                    <Button variant="ghost" size="sm"
                      onClick={() => { setSelectedStyle(null); setShowStyleSelector(false); }}
                      className="text-xs h-7 px-2 text-muted-foreground" type="button"
                    >
                      {t('chat.styleSelector.clear')}
                    </Button>
                  </div>
                )}
              </div>

              {/* ★ 核心一行：[+] [textarea] [🎤] [➤] */}
              <div className="flex items-end px-1.5 pb-1.5 gap-1">
                {/* + 按钮 */}
                <button
                  className={cn(
                    "flex-shrink-0 w-9 h-9 rounded-xl flex items-center justify-center transition-all",
                    "text-muted-foreground hover:bg-accent/50",
                    attachMenuOpen && "bg-accent text-accent-foreground rotate-45",
                  )}
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAttachMenuOpen(!attachMenuOpen); }}
                  disabled={isStreamingMessage}
                  type="button" title="附件/工具"
                >
                  <Plus className="h-5 w-5 transition-transform duration-200" />
                </button>

                {/* textarea */}
                <div className="flex-1 min-w-0">
                  <ChatInput
                    ref={chatInputRef}
                    placeholder={conversationLimitInfo.isAtLimit ? "对话已达消息上限，请开启新对话" : undefined}
                    disabled={conversationLimitInfo.isAtLimit}
                    onChange={(v) => setHasInputContent(v.trim().length > 0)}
                    onFileUpload={(files) => {
                      for (const f of files) {
                        if (!f.url && f.file) handleFileUpload(f.file);
                        else setUploadedFiles(prev => [...prev, { url: f.url, name: f.name, size: f.size, file: f.file }]);
                      }
                      setHasInputContent(false);
                    }}
                    onSend={(payload: SendMessagePayload) => {
                      if (isStreamingMessage) handleStopStreaming();
                      if (payload.attachments) {
                        if (payload.attachments.images.length > 0) setUploadedImages(payload.attachments.images);
                        if (payload.attachments.files.length > 0) setUploadedFiles(payload.attachments.files);
                      }
                      handleSendMessage(payload.text);
                    }}
                    onPaste={async (e) => {
                      const items = e.clipboardData?.items;
                      if (!items) return;
                      let hasImg = false;
                      for (let i = 0; i < items.length; i++) {
                        if (items[i].type.startsWith('image/')) {
                          e.preventDefault(); hasImg = true;
                          const f = items[i].getAsFile(); if (f) await handleImageUpload(f);
                          break;
                        }
                      }
                      if (!hasImg) {
                        const txt = e.clipboardData?.getData('text');
                        if (txt && txt.length > 5000) {
                          e.preventDefault();
                          const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
                          const file = new (File as any)([blob], `pasted-text-${Date.now()}.txt`, { type: 'text/plain' });
                          await handleFileUpload(file); chatInputRef.current?.clear();
                        }
                      }
                    }}
                    uploadedImages={uploadedImages}
                    uploadedFiles={uploadedFiles}
                  />
                </div>

                {/* 语音按钮 — 和发送按钮同行 */}
                <PressToTalkButton
                  onTranscribed={(text) => {
                    if (voiceSettings.mode === 'auto-send') {
                      setIsTtsAutoMode(true);
                      chatInputRef.current?.clear(); setHasInputContent(false);
                      setTimeout(() => handleSendMessage(text), 50);
                    } else {
                      chatInputRef.current?.setInput(text); chatInputRef.current?.focus();
                    }
                  }}
                  onInterimResult={(text) => chatInputRef.current?.setInput(text)}
                  disabled={false} language="zh" packageId={selectedPackageId ?? undefined}
                />

                {/* 发送/停止按钮 */}
                <Button
                  onClick={() => { if (isStreamingMessage) handleStopStreaming(); else handleSend(); }}
                  disabled={isUploading || (!isStreamingMessage && !hasInputContent && uploadedImages.length === 0 && uploadedFiles.length === 0 && !quotedRef)}
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-full flex-shrink-0 shadow-sm transition-all",
                    isStreamingMessage ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90",
                  )}
                  type="button"
                >
                  {isStreamingMessage ? <StopCircle className="h-4 w-4" /> : isUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowUp className="h-4 w-4" />}
                </Button>
              </div>

              {/* AttachMenu 弹出层 + badges — 隐藏 + 按钮，只渲染菜单和 badge */}
              <InputToolbar
                hidePlusButton={true}
                menuOpen={attachMenuOpen}
                onMenuToggle={setAttachMenuOpen}
                selectedKB={selectedKB} onKBSelect={setSelectedKB}
                selectedGitHubRepo={selectedGitHubRepo} onGitHubRepoSelect={setSelectedGitHubRepo}
                onAttachment={handleAttachment} onImageAttachment={handleImageAttachment} onCamera={handleCamera}
                onSend={handleSend} onStop={handleStopStreaming}
                isStreaming={isStreamingMessage} t={t} isUploading={isUploading}
                hasContent={hasInputContent || uploadedImages.length > 0 || uploadedFiles.length > 0 || !!quotedRef}
                selectedPackageId={selectedPackageId}
              />
            </div>
          </div>
        </div>
  );
}