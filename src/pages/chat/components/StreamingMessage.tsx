/**
 * StreamingMessage — 流式响应渲染组件（升级版）
 *
 * 改进点：
 *   1. ThinkingAnimation → 三段式阶段进度条（理解→分析→生成）
 *   2. 深度推理面板 → 圆角卡片 + 自动滚动 + 字数统计 + 可折叠
 *   3. InlineThinkingBlock → 竖向时间线 + 入场动画 + 彩色节点
 *   4. 各部分之间平滑过渡，不再突然切换
 *
 * 原始位置: Chat.tsx L5065-5183 / MessageList L1444-1555
 */

import { useRef, useEffect, useState, useMemo } from 'react';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import { SafeMarkdownWithDownload } from '@/components/SafeMarkdownWithDownload';
import { InlineThinkingBlock } from '@/components/InlineThinkingBlock';
import { InlineStepList } from '@/components/InlineStepBlock';
import { ImageGenerationProgress, isImageGenerationFlow } from '@/components/ImageGenerationProgress';
import { ArtifactInlineTrigger } from '@/components/ArtifactInlineTrigger';
import { ThinkingAnimation } from '@/components/ThinkingAnimation';
import { SearchingIndicator } from '@/components/WebSearchIndicator';
import { AiLogo } from '@/components/AiLogo';
import { formatSmartTime } from '@/lib/timeUtils';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { ChatStateReturn } from '../types';

interface StreamingMessageProps {
  state: ChatStateReturn;
}

export function StreamingMessage({ state }: StreamingMessageProps) {
  const { t } = useTranslation();
  const {
    messages,
    isStreamingMessage,
    streamedContent,
    thinkingStage,
    reasoningContent,
    operationLogs,
    currentThinkingSteps,
    thinkingSummary,
    elapsedThinkingTime,
    setPreviewFile,
    messagesEndRef,
  } = state;

  // 推理面板的展开/折叠状态
  const [reasoningExpanded, setReasoningExpanded] = useState(true);
  const reasoningRef = useRef<HTMLDivElement>(null);
  // 用户是否在推理面板内手动向上滚动
  const reasoningUserScrolledUpRef = useRef(false);
  const [showReasoningScrollBtn, setShowReasoningScrollBtn] = useState(false);

  // ═══════ 多样化面板文案（每次流式回复固定一组，避免闪烁） ═══════
  const panelTexts = useMemo(() => {
    const reasoningTexts = ['正在深度推理分析...', '深度思考中...', '仔细推敲问题中...', '展开逻辑推理...'];
    const transitionTexts = ['推理完成，正在生成回答...', '分析完毕，组织回答中...', '推理就绪，输出结果...'];
    const waitingTexts = ['正在生成回答...', '组织语言中...', '整理思路中...', '输出回答中...'];
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    return {
      reasoning: pick(reasoningTexts),
      transition: pick(transitionTexts),
      done: '深度推理过程',
      waiting: pick(waitingTexts),
    };
  }, []); // 空依赖：每次StreamingMessage挂载时随机一组

  // 推理面板自动滚动到底部（仅在用户没有手动上滚时）
  useEffect(() => {
    if (reasoningRef.current && thinkingStage === 'reasoning' && !reasoningUserScrolledUpRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [reasoningContent, thinkingStage]);

  // 推理结束后重置滚动状态
  useEffect(() => {
    if (thinkingStage !== 'reasoning') {
      reasoningUserScrolledUpRef.current = false;
      setShowReasoningScrollBtn(false);
    }
  }, [thinkingStage]);

  // 推理阶段自动展开，生成阶段自动折叠
  useEffect(() => {
    if (thinkingStage === 'reasoning') setReasoningExpanded(true);
    else if (thinkingStage === 'generating' && streamedContent) setReasoningExpanded(false);
  }, [thinkingStage, streamedContent]);

  if (!isStreamingMessage) return <div ref={messagesEndRef} />;

  // 仅当有占位图（图片生成中）时不渲染 streaming block
  const lastMsg = messages[messages.length - 1];
  const hasPlaceholderImages =
    lastMsg && lastMsg.role === 'assistant' && lastMsg.images && lastMsg.images.length > 0;

  if (hasPlaceholderImages) return <div ref={messagesEndRef} />;

  const isReasoning = thinkingStage === 'reasoning';
  const isGenerating = thinkingStage === 'generating';
  const hasReasoning = isReasoning || isGenerating || (reasoningContent && reasoningContent.length > 0);

  return (
    <>
      <div className="flex justify-start px-1 md:px-2">
        <div className="w-full max-w-full">
          {/* ═══════ AI头像 + 名字 + 时间戳 ═══════ */}
          <div className="flex flex-col w-full max-w-[850px] mx-auto">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <AiLogo animated />
                <span className="text-sm text-muted-foreground">{t('chat.aiAssistant')}</span>
                <span className="text-xs text-muted-foreground/70">{formatSmartTime(Date.now())}</span>
              </div>
            </div>
          </div>

          {/* ═══════ 🧠 深度推理面板（升级版） ═══════ */}
          {hasReasoning && (
            <div
              className={cn(
                "mb-3 rounded-xl overflow-hidden border transition-colors duration-300",
                isReasoning
                  ? "border-purple-300/40 dark:border-purple-700/40"
                  : "border-purple-200/30 dark:border-purple-800/20"
              )}
              style={{ background: 'var(--color-purple-50, rgba(139,92,246,0.04))' }}
            >
              {/* 折叠头 */}
              <button
                onClick={() => setReasoningExpanded(e => !e)}
                className="flex items-center gap-2 w-full px-3 py-2.5 text-left select-none bg-purple-50/80 dark:bg-purple-900/20 hover:bg-purple-100/80 dark:hover:bg-purple-900/30 transition-colors"
              >
                {isReasoning ? (
                  <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
                ) : (
                  <Brain className="h-4 w-4 text-purple-500 shrink-0" />
                )}
                <span className="text-sm font-medium text-purple-700 dark:text-purple-300 flex-1">
                  {isReasoning
                    ? panelTexts.reasoning
                    : isGenerating
                      ? panelTexts.transition
                      : panelTexts.done}
                </span>
                {/* 字数统计 */}
                {reasoningContent && reasoningContent.length > 0 && (
                  <span className="text-xs text-purple-500/50 mr-1 shrink-0">
                    {reasoningContent.length} 字
                  </span>
                )}
                <div className="text-purple-400/40 shrink-0">
                  {reasoningExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </div>
              </button>

              {/* 推理内容 */}
              <div
                className={cn(
                  "transition-all duration-300 ease-in-out overflow-hidden relative",
                  reasoningExpanded ? "max-h-[400px] opacity-100" : "max-h-0 opacity-0"
                )}
              >
                <div
                  ref={reasoningRef}
                  className="px-3 py-2 max-h-[400px] overflow-y-auto text-sm leading-relaxed bg-purple-50/30 dark:bg-purple-900/10 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-1 prose-ul:my-1 prose-ol:my-1"
                  onScroll={(e) => {
                    const target = e.target as HTMLDivElement;
                    const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 60;
                    reasoningUserScrolledUpRef.current = !isNearBottom;
                    setShowReasoningScrollBtn(!isNearBottom && isReasoning);
                  }}
                >
                  <SafeMarkdown>{reasoningContent || '正在思考...'}</SafeMarkdown>
                  {/* 打字光标 */}
                  {isReasoning && (
                    <span className="inline-block w-[2px] h-[1em] bg-purple-500/60 ml-0.5 animate-pulse align-text-bottom" />
                  )}
                </div>
                {/* 推理面板内"回到最新"按钮 */}
                {showReasoningScrollBtn && isReasoning && (
                  <button
                    onClick={() => {
                      reasoningUserScrolledUpRef.current = false;
                      setShowReasoningScrollBtn(false);
                      if (reasoningRef.current) {
                        reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
                      }
                    }}
                    className="absolute bottom-2 right-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/90 hover:bg-purple-600 text-white shadow-md backdrop-blur-sm transition-all duration-200"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                    </svg>
                    回到最新
                  </button>
                )}
              </div>
            </div>
          )}

          {/* ═══════ 操作步骤 + 思考文字（逐步展示） ═══════ */}
          {(operationLogs.length > 0 || currentThinkingSteps.length > 0) && (
            isImageGenerationFlow(operationLogs) ? (
              <ImageGenerationProgress
                operations={operationLogs}
                isLive={true}
              />
            ) : (
              <InlineStepList
                operations={operationLogs}
                thinkingSteps={currentThinkingSteps}
                isLive={true}
                onFileClick={(fileName: string) => {
                  const content = streamedContent || '';
                  const codeBlocks = content.match(/```[\w]*\n([\s\S]*?)```/g) || [];
                  const lastBlock =
                    codeBlocks.length > 0
                      ? codeBlocks[codeBlocks.length - 1].replace(/```\w*\n?/g, '').trim()
                      : '';
                  setPreviewFile({ name: fileName, content: lastBlock, isLive: true });
                }}
              />
            )
          )}

          {/* ═══════ Artifact 内联触发卡片 ═══════ */}
          {(() => {
            const lastAstMsg = messages[messages.length - 1];
            const artifact = lastAstMsg?.role === 'assistant' ? (lastAstMsg as any).artifact : null;
            if (!artifact) return null;
            return (
              <ArtifactInlineTrigger
                artifact={artifact}
                onOpen={() => {
                  const { setActiveArtifact, openMobileArtifact } = state as any;
                  if (setActiveArtifact) setActiveArtifact(artifact);
                  if (openMobileArtifact) openMobileArtifact();
                }}
              />
            );
          })()}

          {/* ═══════ 联网搜索状态指示器 ═══════ */}
          {(state as any).webSearchQuery && (
            <div className="mb-2">
              <SearchingIndicator query={(state as any).webSearchQuery} />
            </div>
          )}

          {/* ═══════ 流式渲染的 AI 回复内容 ═══════ */}
          {streamedContent &&
            (() => {
              // 如果有 artifact，streamedContent 中只有描述文字（代码已被拦截），直接渲染
              // 如果没有 artifact，走常规渲染
              const lastAstMsg = messages[messages.length - 1];
              const hasArtifact = lastAstMsg?.role === 'assistant' && !!(lastAstMsg as any).artifact;

              const hasResearchCard = streamedContent.includes('<ResearchTaskCard');
              if (hasResearchCard) {
                return (
                  <div className="bg-muted rounded-lg p-4 md:p-4 sm:p-3">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="animate-spin w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                      <span>正在启动远程操作任务，请查看右侧沙箱面板...</span>
                    </div>
                  </div>
                );
              }

              // 有 artifact 时，streamedContent 是描述文字（代码已被拦截）
              // 清理可能残留的代码块标记
              let displayContent = streamedContent;
              if (hasArtifact) {
                displayContent = displayContent
                  .replace(/```(?:html|jsx|tsx|vue|css|react|artifact:[^\n]*)\s*$/s, '')
                  .replace(/```\s*$/s, '')
                  .trim();
                if (!displayContent) return null; // 纯代码无描述，不渲染空气泡
              }

              return (
                <div className={cn(
                  "rounded-lg p-4 md:p-4 sm:p-3 animate-in fade-in duration-300",
                  hasArtifact ? "" : "bg-muted"
                )}>
                  <div className="flex-1 min-w-0">
                    <SafeMarkdownWithDownload
                      content={displayContent.replace(/!\[[^\]]*\]\([^)]+\)/g, '')}
                      streaming={true}
                      conversationId={state.selectedConversationId ?? undefined}
                    />
                    {!hasArtifact && (
                      <span className="inline-block w-[2px] h-[1.1em] bg-current opacity-70 ml-[1px] align-text-bottom animate-pulse" />
                    )}
                  </div>
                </div>
              );
            })()}

          {/* ═══════ 等待指示器（无内容时） ═══════ */}
          {!streamedContent && !((messages[messages.length - 1] as any)?.artifact) &&
            (() => {
              // 图片生成流程由 ImageGenerationProgress 组件处理，不显示通用等待指示
              if (isImageGenerationFlow(operationLogs)) return null;
              
              // 有操作日志 → 显示"正在生成"文字
              if (operationLogs.length > 0) {
                return (
                  <div className="flex items-center gap-2 py-2 text-muted-foreground">
                    <div className="animate-spin w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full" />
                    <span className="text-sm">{panelTexts.waiting}</span>
                    {elapsedThinkingTime > 0 && (
                      <span className="text-xs text-muted-foreground/60">
                        {elapsedThinkingTime.toFixed(1)}s
                      </span>
                    )}
                  </div>
                );
              }
              // 无操作日志 → 显示三段式阶段进度
              return (
                <ThinkingAnimation
                  elapsedTime={elapsedThinkingTime}
                  thinkingStage={thinkingStage}
                  hasOperations={operationLogs.length > 0}
                />
              );
            })()}
        </div>
      </div>
      <div ref={messagesEndRef} />
    </>
  );
}
