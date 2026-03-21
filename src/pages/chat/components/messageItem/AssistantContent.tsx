/**
 * AssistantContent — AI 助手消息内容区域
 * 
 * 渲染任务卡片（Research/Video/Automation）和常规内容（图片+Markdown）
 * 
 * 从 MessageItem.tsx 拆分，原始行号 667-894
 */
import { Button } from '@/components/ui/button';
import { ProgressiveImage } from '@/components/ProgressiveImage';
import { ImageActionBar } from '@/components/ImageActionBar';
import { HighlightedContent } from '@/components/HighlightedContent';
import { ImageWithSkeleton } from '@/components/ImageWithSkeleton';
import { VideoTaskCard } from '@/components/VideoTaskCard';
import { AutomationTaskCard } from '@/components/AutomationTaskCard';
import { ResearchFlowSteps } from '@/components/researchFlow';
import { ArtifactCard } from '@/components/ArtifactCard';
import { WebSearchSources } from '@/components/WebSearchIndicator';
import { VideoPlayer } from '@/components/VideoPlayer'; // ★ T12-3
import { HomeworkResultCard } from '@/components/HomeworkResultCard'; // ★ T14-2
import { RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';
import type { ContentProps } from './types';

export function AssistantTaskCards({ msg, state, handleSendMessage }: ContentProps) {
  const { setActiveResearchTaskId, setMessages, chatInputRef } = state;

  if ((msg as any).isResearchTask) {
    return (
      <ResearchFlowSteps
        taskId={(msg as any).researchTaskId}
        prompt={(msg as any).researchPrompt || msg.content}
        onOpenSandbox={(id) => setActiveResearchTaskId((msg as any).researchTaskId)}
      />
    );
  }

  if ((msg as any).isVideoTask) {
    return (
      <VideoTaskCard
        taskId={(msg as any).videoTaskId}
        prompt={(msg as any).videoPrompt}
      />
    );
  }

  if ((msg as any).isAutomationTask) {
    const allTasks = (msg as any).automationAllTasks;
    return (
      <div>
        <AutomationTaskCard
          taskId={(msg as any).automationTaskId}
          taskName={(msg as any).automationTaskName || "自动化任务"}
          siteName={(msg as any).automationSiteName || "目标网站"}
          allTasks={allTasks && allTasks.length > 1 ? allTasks : undefined}
        />
      </div>
    );
  }

  // ═══════ Artifact 预览卡片 ═══════
  if ((msg as any).artifact) {
    const artifact = (msg as any).artifact;
    return (
      <ArtifactCard
        artifact={artifact}
        onApprove={() => {
          setMessages((prev) => {
            const newMessages = [...prev];
            const idx = newMessages.indexOf(msg);
            if (idx >= 0 && (newMessages[idx] as any).artifact) {
              const updated = { ...newMessages[idx] };
              (updated as any).artifact = { ...(updated as any).artifact, status: 'approved' };
              newMessages[idx] = updated;
            }
            return newMessages;
          });
        }}
        onIterate={(feedback) => {
          // 将反馈填入输入框并聚焦
          if (chatInputRef?.current) {
            chatInputRef.current.setInput(`请调整上面的预览效果：${feedback}`);
            chatInputRef.current.focus();
          }
        }}
        onExport={(format) => {
          toast.success(`已导出为 ${format} 文件`);
        }}
      />
    );
  }

  // ★ T14-2: 作业批改结果卡片
  if ((msg as any).homeworkResult) {
    return <HomeworkResultCard data={(msg as any).homeworkResult} />;
  }

  return null;
}

export function AssistantRegularContent({
  msg, index, displayContent, state, isStreaming,
  handleSendMessage, handleImageDownload, normalizeImageUrl, extractImagesFromMarkdown,
}: ContentProps) {
  const { t } = useTranslation();
  const {
    messages, setMessages,
    setUploadedImages, setUploadedFiles,
    collapsedDescriptions, setCollapsedDescriptions,
    setLightboxImages, setLightboxIndex, setLightboxOpen,
  } = state;

  return (
    <div className="w-full ml-0 pl-0 space-y-3">
      {/* ★ T12-3: videoUrl 属性直接渲染播放器 */}
      {(msg as any).videoUrl && (
        <div className="w-full mb-3">
          <VideoPlayer
            src={(msg as any).videoUrl}
            autoPlay
            loop
            className="max-w-[500px]"
            onDownload={() => {
              const a = document.createElement('a');
              a.href = (msg as any).videoUrl;
              a.download = (msg as any).videoUrl.split('/').pop() || 'video.mp4';
              a.click();
            }}
          />
        </div>
      )}
      {/* 图片区域（全宽，位于顶部） */}
      {msg.images && msg.images.length > 0 && (
        <div className="w-full ml-0 pl-0 mb-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-[600px]">
            {msg.images.map((img, imgIndex) => {
              const isGenAnimating = !!(img as any).isGenerating;
              return (
              <div key={imgIndex} className="relative group w-full">
                <ProgressiveImage
                  src={isGenAnimating ? '' : normalizeImageUrl(img.url)}
                  placeholderSrc={img.placeholderUrl ? normalizeImageUrl(img.placeholderUrl) : undefined}
                  isGenerating={isGenAnimating}
                  generatingPrompt={isGenAnimating ? img.name : undefined}
                  alt={img.name}
                  className="w-full h-auto max-w-[400px] max-h-[400px] object-contain cursor-pointer rounded-xl border border-gray-100"
                  onClick={() => {
                    if (isGenAnimating) return;
                    setLightboxImages(msg.images!.map(i => ({...i, url: normalizeImageUrl(i.url)})));
                    setLightboxIndex(imgIndex);
                    setLightboxOpen(true);
                  }}
                />
                {/* ★ 图片快捷操作栏（收藏❤️ + 重试🔄 + 下载⬇️ + 画廊🖼️） */}
                {!isGenAnimating && (
                  <ImageActionBar
                    imageUrl={img.url}
                    imagePrompt={(img as any).imagePrompt}
                    isFavorite={(img as any).isFavorite}
                    onDownload={() => handleImageDownload(img.url, img.name)}
                    onOpenGallery={() => { window.open('/images', '_blank'); }}
                    onRetrySuccess={(newUrl, newPlaceholder) => {
                      // 追加新图片到当前消息
                      setMessages((prev: any[]) => {
                        const newMsgs = [...prev];
                        const msgIdx = newMsgs.findIndex(m => m === msg || m.id === msg.id);
                        if (msgIdx !== -1 && newMsgs[msgIdx].images) {
                          newMsgs[msgIdx] = {
                            ...newMsgs[msgIdx],
                            images: [...newMsgs[msgIdx].images!, {
                              url: newUrl, name: img.name,
                              placeholderUrl: newPlaceholder,
                              imagePrompt: (img as any).imagePrompt,
                            }],
                          };
                        }
                        return newMsgs;
                      });
                    }}
                    onUpscaleSuccess={(newUrl, info) => {
                      // 原地替换当前图片为放大版
                      setMessages((prev: any[]) => {
                        const newMsgs = [...prev];
                        const msgIdx = newMsgs.findIndex(m => m === msg || m.id === msg.id);
                        if (msgIdx !== -1 && newMsgs[msgIdx].images?.[imgIndex]) {
                          newMsgs[msgIdx] = { ...newMsgs[msgIdx] };
                          newMsgs[msgIdx].images = [...newMsgs[msgIdx].images!];
                          newMsgs[msgIdx].images![imgIndex] = {
                            ...newMsgs[msgIdx].images![imgIndex],
                            url: newUrl,
                            name: `${img.name} (${info.scale}x ${info.method === 'realesrgan' ? 'AI超分' : '高清'})`,
                          };
                        }
                        return newMsgs;
                      });
                    }}
                    onFavoriteChange={(fav) => {
                      // 更新本地收藏状态
                      setMessages((prev: any[]) => {
                        const newMsgs = [...prev];
                        const msgIdx = newMsgs.findIndex(m => m === msg || m.id === msg.id);
                        if (msgIdx !== -1 && newMsgs[msgIdx].images?.[imgIndex]) {
                          newMsgs[msgIdx] = { ...newMsgs[msgIdx] };
                          newMsgs[msgIdx].images = [...newMsgs[msgIdx].images!];
                          newMsgs[msgIdx].images![imgIndex] = { ...newMsgs[msgIdx].images![imgIndex], isFavorite: fav } as any;
                        }
                        return newMsgs;
                      });
                    }}
                  />
                )}
              </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 显示文本内容 */}
      {/* ★ T12-3: 检测视频 URL 并内联播放 */}
      {displayContent && (() => {
        const VIDEO_URL_RE = /https?:\/\/[^\s"'<>]+\.(?:mp4|webm|mov)(?:\?[^\s"'<>]*)?/gi;
        const videoUrls = displayContent.match(VIDEO_URL_RE);
        if (!videoUrls || videoUrls.length === 0) return null;
        // 去重
        const unique = [...new Set(videoUrls)];
        return (
          <div className="w-full space-y-2 mb-3">
            {unique.map((url, i) => (
              <VideoPlayer
                key={`video-${i}`}
                src={url}
                autoPlay
                loop
                className="max-w-[500px]"
                onDownload={() => {
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = url.split('/').pop() || 'video.mp4';
                  a.click();
                }}
              />
            ))}
          </div>
        );
      })()}
      {displayContent && displayContent !== '[图片]' && (() => {
        const isErrorMessage = (msg as any).isError;
        const hasImageDescription =
          displayContent.includes('![AI_IMG]') ||
          (displayContent.includes('图片描述') && msg.images && (msg as any).images?.length > 0);

        return (
          <div className={`w-full ml-0 pl-0 space-y-2 ${
            isErrorMessage
              ? 'bg-destructive/5 border border-destructive/20 rounded-lg p-4 md:p-5'
              : ''
          }`}>
            {hasImageDescription && (
              <ImageDescriptionToggle
                msg={msg}
                messages={messages}
                collapsedDescriptions={collapsedDescriptions}
                setCollapsedDescriptions={setCollapsedDescriptions}
                labelExpand={t("chat.expand")}
                labelCollapse={t("chat.collapse")}
                label={t("chat.imageDescription")}
              />
            )}
            {!collapsedDescriptions.has(messages.indexOf(msg)) && (
              <div className="pt-2">
                <HighlightedContent
                  hasImages={msg.images && msg.images.length > 0}
                  conversationId={state.selectedConversationId ?? undefined}
                  messageIndex={index}
                  content={cleanAssistantContent(displayContent)}
                  filePackageUrl={msg.filePackageUrl}
                  streaming={isStreaming}
                />
                {/* ★ 统一渲染：打字光标（流式期间显示，完成后淡出） */}
                <span className={cn(
                  "inline-block w-[2px] h-[1.1em] bg-current ml-[1px] align-text-bottom transition-opacity duration-300",
                  isStreaming ? "opacity-70 animate-pulse" : "opacity-0"
                )} />
              </div>
            )}
          </div>
        );
      })()}

      {/* 重试按钮 - 只在错误消息中显示 */}
      {(msg as any).isError && (msg as any).failedMessage && (
        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant="outline"
            size="default"
            onClick={async () => {
              const failedMsg = (msg as any).failedMessage;
              setMessages(prev => {
                const newMessages = [...prev];
                const errorIndex = newMessages.indexOf(msg);
                if (errorIndex > 0 && newMessages[errorIndex - 1].role === 'user') {
                  newMessages.splice(errorIndex - 1, 2);
                } else {
                  newMessages.splice(errorIndex, 1);
                }
                return newMessages;
              });
              if (failedMsg.images && Array.isArray(failedMsg.images)) {
                setUploadedImages(failedMsg.images);
              }
              if (failedMsg.files && Array.isArray(failedMsg.files)) {
                setUploadedFiles(failedMsg.files);
              }
              setTimeout(() => handleSendMessage(failedMsg.content || ''), 100);
              toast.info(t('chat.errors.retrying'));
            }}
            className="gap-2 hover:bg-primary hover:text-primary-foreground transition-colors md:px-6 md:py-2"
          >
            <RotateCcw className="h-4 w-4" />
            <span className="font-medium">{t('chat.errors.retryButton')}</span>
          </Button>
        </div>
      )}

      {/* 如果没有msg.images，则从 markdown 中提取图片（向后兼容） */}
      {!msg.images && (() => {
        const { images: extractedImages } = extractImagesFromMarkdown(displayContent);
        return (
          <>
            {extractedImages.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {extractedImages.map((img, imgIndex) => (
                  <ImageWithSkeleton
                    key={imgIndex}
                    src={normalizeImageUrl(img.url)}
                    alt={img.name}
                    thumbnail={true}
                    onClick={() => {
                      setLightboxImages(extractedImages.map(i => ({...i, url: normalizeImageUrl(i.url)})));
                      setLightboxIndex(imgIndex);
                      setLightboxOpen(true);
                    }}
                    onDownload={handleImageDownload}
                  />
                ))}
              </div>
            )}
          </>
        );
      })()}

      {/* 联网搜索来源引用 */}
      {(msg as any).webSearchSources && (msg as any).webSearchSources.length > 0 && (
        <WebSearchSources
          sources={(msg as any).webSearchSources}
          query={(msg as any).webSearchQuery}
        />
      )}
    </div>
  );
}

// ─── 图片描述折叠切换 ───
function ImageDescriptionToggle({
  msg, messages, collapsedDescriptions, setCollapsedDescriptions,
  label, labelExpand, labelCollapse,
}: {
  msg: any; messages: any[]; collapsedDescriptions: Set<number>;
  setCollapsedDescriptions: (fn: (prev: Set<number>) => Set<number>) => void;
  label: string; labelExpand: string; labelCollapse: string;
}) {
  const msgIndex = messages.indexOf(msg);
  const isCollapsed = collapsedDescriptions.has(msgIndex);
  return (
    <div className="flex items-center justify-between border-b border-border pb-2">
      <span className="text-sm font-medium">{label}</span>
      <button
        onClick={() => {
          setCollapsedDescriptions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(msgIndex)) newSet.delete(msgIndex);
            else newSet.add(msgIndex);
            return newSet;
          });
        }}
        className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-muted"
      >
        {isCollapsed ? (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
            <span>{labelExpand}</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            </svg>
            <span>{labelCollapse}</span>
          </>
        )}
      </button>
    </div>
  );
}

/** 文件包下载按钮 */
function FilePackageDownload({ url }: { url: string }) {
  const fileName = url.split('/').pop() || 'code-patch.tar.gz';

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      // ★ 使用 fetch + Blob 强制触发下载，避免浏览器打开新标签
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      // 回退：直接打开链接
      console.error('[FilePackageDownload] Fetch failed, falling back:', err);
      window.location.href = url;
    }
  };

  return (
    <div className="mt-3 pt-3 border-t border-border/40">
      <button
        onClick={handleDownload}
        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/8 hover:bg-primary/15 border border-primary/20 text-primary text-xs font-medium transition-colors group cursor-pointer"
      >
        <svg className="h-3.5 w-3.5 flex-shrink-0 group-hover:translate-y-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        <span>下载修改包</span>
        <span className="text-[10px] opacity-60 font-mono truncate max-w-[160px]">{fileName}</span>
      </button>
      <p className="text-[10px] text-muted-foreground mt-1 ml-0.5">
        解压覆盖：<code className="font-mono">tar xzf {fileName} -C /www/wwwroot/ai_platform</code>
      </p>
    </div>
  );
}

/** 清理助手内容：移除AI图片标签、加载提示等 */
export function cleanAssistantContent(content: string): string {
  let cleaned = content;
  cleaned = cleaned.replace(/!\[AI_IMG\]\([^)]*\)/g, '');
  cleaned = cleaned.replace(/!\[[^\]]*\]\([^)]*\)/g, '');
  cleaned = cleaned.replace(/!\[AI_IMG\].*/g, '');
  cleaned = cleaned.replace(/AI_IMG/g, '');
  cleaned = cleaned.replace(/🎨\s*正在为您生成图片，请稍候\.\.\.?/g, '');
  cleaned = cleaned.replace(/🔍\s*正在识别图片.*?…/g, '');
  cleaned = cleaned.replace(/\*\*图片描述：?\s*\*\*/g, '');
  cleaned = cleaned.replace(/图片描述：?\s*/g, '');
  cleaned = cleaned.trim();
  return cleaned;
}
