/**
 * MessageItem — 单条消息渲染组件（入口编排文件）
 * 
 * ★ 统一渲染架构：同一个 DOM 节点处理 streaming + completed 两种状态
 *   流式期间：使用 state.operationLogs / state.reasoningContent 等实时数据
 *   完成之后：使用 msg.operationLogs / msg.reasoningContent 等持久化数据
 *   → 零布局跳动，无 DOM 重建
 * 
 * 将渲染委托给子模块：
 * - IntentConfirmSection  → 意图/研究/视频确认卡片
 * - AssistantTaskCards     → 研究/视频/自动化任务卡片
 * - AssistantRegularContent → 助手常规内容（图片+Markdown）
 * - UserContent            → 用户消息（图片+文件+编辑+文本）
 * - MessageActions         → 消息操作按钮栏
 */

import { useState, useRef, useEffect, useMemo } from 'react';
import { InlineThinkingBlock } from '@/components/InlineThinkingBlock';
import { InlineStepList } from '@/components/InlineStepBlock';
import { ImageGenerationProgress, isImageGenerationFlow } from '@/components/ImageGenerationProgress';
import { ArtifactInlineTrigger } from '@/components/ArtifactInlineTrigger';
import { SolutionPickerCard, SolutionPickerResult } from '@/components/SolutionPickerCard';
import { SafeMarkdown } from '@/components/SafeMarkdown';
import { ThinkingAnimation } from '@/components/ThinkingAnimation';
import { SearchingIndicator } from '@/components/WebSearchIndicator';
import { Brain, ChevronDown, ChevronUp } from 'lucide-react';
import { AiLogo } from '@/components/AiLogo';
import { formatSmartTime } from '@/lib/timeUtils';
import { formatRelativeTime, formatDetailedTime } from '@/lib/formatTimestamp';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import type { ChatStateReturn, ChatMessage } from '../types';

import {
  IntentConfirmSection,
  AssistantTaskCards,
  AssistantRegularContent,
  UserContent,
  MessageActions,
} from './messageItem';

interface MessageItemProps {
  msg: ChatMessage;
  index: number;
  displayContent: string;
  isLastAssistant: boolean;
  isStreaming?: boolean;            // ★ 统一渲染：当前消息正在流式输出
  state: ChatStateReturn;
  handleSendMessage: (text?: string, resendImages?: any[], resendFiles?: any[], isRegenerate?: boolean) => void;
  handleImageDownload: (url: string, name: string) => Promise<void>;
  normalizeImageUrl: (url: string) => string;
  extractImagesFromMarkdown: (content: string) => { cleanedContent: string; images: Array<{ url: string; name: string }> };
}

export function MessageItem(props: MessageItemProps) {
  const {
    msg, index, displayContent, isLastAssistant, isStreaming,
    state, handleSendMessage, handleImageDownload,
    normalizeImageUrl, extractImagesFromMarkdown,
  } = props;
  const { t } = useTranslation();
  const { messages, isSidebarOpen, setPreviewFile } = state;
  const [reasoningCollapsed, setReasoningCollapsed] = useState(true);

  // ═══════ 统一渲染：流式 vs 持久化数据源 ═══════
  const effectiveOperationLogs = isStreaming
    ? state.operationLogs
    : ((msg as any).operationLogs || []);
  const effectiveThinkingSteps = isStreaming
    ? state.currentThinkingSteps
    : ((msg as any).thinkingSteps || []);
  const effectiveReasoningContent = isStreaming
    ? state.reasoningContent
    : ((msg as any).reasoningContent || '');
  const thinkingStage = isStreaming ? state.thinkingStage : undefined;
  const isReasoning = thinkingStage === 'reasoning';
  const isGenerating = thinkingStage === 'generating';
  const hasReasoningPanel = isReasoning || isGenerating || (effectiveReasoningContent && effectiveReasoningContent.length > 0);

  // ═══════ 推理面板自动滚动（流式期间） ═══════
  const reasoningRef = useRef<HTMLDivElement>(null);
  const reasoningUserScrolledUpRef = useRef(false);
  const [showReasoningScrollBtn, setShowReasoningScrollBtn] = useState(false);

  const panelTexts = useMemo(() => {
    const reasoningTexts = ['正在深度推理分析...', '深度思考中...', '仔细推敲问题中...', '展开逻辑推理...'];
    const transitionTexts = ['推理完成，正在生成回答...', '分析完毕，组织回答中...', '推理就绪，输出结果...'];
    const waitingTexts = ['正在生成回答...', '组织语言中...', '整理思路中...', '输出回答中...'];
    const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];
    return { reasoning: pick(reasoningTexts), transition: pick(transitionTexts), done: '深度推理过程', waiting: pick(waitingTexts) };
  }, []);

  useEffect(() => {
    if (reasoningRef.current && isReasoning && !reasoningUserScrolledUpRef.current) {
      reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
    }
  }, [effectiveReasoningContent, isReasoning]);
  useEffect(() => { if (!isReasoning) { reasoningUserScrolledUpRef.current = false; setShowReasoningScrollBtn(false); } }, [isReasoning]);
  useEffect(() => {
    if (isReasoning) setReasoningCollapsed(false);
    else if (isGenerating && displayContent) setReasoningCollapsed(true);
    else if (!isStreaming && effectiveReasoningContent) setReasoningCollapsed(true);
  }, [isReasoning, isGenerating, isStreaming, displayContent, effectiveReasoningContent]);

  return (
    <div
      key={msg.id || `msg-${index}`}
      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group ${index === messages.length - 1 ? "animate-fade-in" : ""} px-0.5 md:px-2`}
    >
      <div className={cn(
        "flex flex-col gap-0.5 relative",
        msg.role === "user"
          ? cn("max-w-[90%] md:max-w-[85%]", isSidebarOpen ? "md:max-w-[70%]" : "md:max-w-[80%]")
          : "w-full max-w-full"
      )} style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
        <div className="py-1.5 md:py-3">
          {/* 时间戳 */}
          {msg.timestamp && (
            <div
              className={`text-[10px] text-muted-foreground/60 mb-1 ${msg.role === "user" ? "text-right" : "text-left"}`}
              title={formatDetailedTime(msg.timestamp)}
            >
              {formatRelativeTime(msg.timestamp)}
            </div>
          )}

          {msg.role === "assistant" ? (
            <div className="flex flex-col w-full max-w-[850px] mx-auto">
              {/* AI 头像 — 流式期间带动画 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AiLogo animated={isStreaming} />
                  <span className="text-sm text-muted-foreground">{t("chat.aiAssistant")}</span>
                  {msg.timestamp && (
                    <span className="text-xs text-muted-foreground/70">{formatSmartTime(msg.timestamp)}</span>
                  )}
                </div>
              </div>

              {/* ═══════ 🧠 深度推理面板（统一版） ═══════ */}
              {hasReasoningPanel && (
                <div
                  className={cn(
                    "mb-3 rounded-xl overflow-hidden border transition-colors duration-300",
                    isReasoning
                      ? "border-purple-300/40 dark:border-purple-700/40"
                      : "border-purple-200/30 dark:border-purple-800/20"
                  )}
                  style={{ background: 'var(--color-purple-50, rgba(139,92,246,0.04))' }}
                >
                  <button
                    onClick={() => setReasoningCollapsed(c => !c)}
                    className="flex items-center gap-2 w-full px-3 py-2.5 text-left select-none bg-purple-50/80 dark:bg-purple-900/20 hover:bg-purple-100/80 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    {isReasoning ? (
                      <div className="w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full animate-spin shrink-0" />
                    ) : (
                      <Brain className="h-4 w-4 text-purple-500 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300 flex-1">
                      {isReasoning ? panelTexts.reasoning : isGenerating ? panelTexts.transition : panelTexts.done}
                    </span>
                    {effectiveReasoningContent && effectiveReasoningContent.length > 0 && (
                      <span className="text-xs text-purple-500/50 mr-1 shrink-0">{effectiveReasoningContent.length} 字</span>
                    )}
                    <div className="text-purple-400/40 shrink-0">
                      {!reasoningCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                  <div className={cn("transition-all duration-300 ease-in-out overflow-hidden relative", !reasoningCollapsed ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0")}>
                    <div
                      ref={reasoningRef}
                      className="px-3 py-2 max-h-[500px] overflow-y-auto text-sm leading-relaxed bg-purple-50/30 dark:bg-purple-900/10 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-1 prose-ul:my-1 prose-ol:my-1"
                      onScroll={(e) => {
                        const target = e.target as HTMLDivElement;
                        const isNearBottom = target.scrollHeight - target.scrollTop - target.clientHeight < 60;
                        reasoningUserScrolledUpRef.current = !isNearBottom;
                        setShowReasoningScrollBtn(!isNearBottom && !!isReasoning);
                      }}
                    >
                      <SafeMarkdown>{effectiveReasoningContent || '正在思考...'}</SafeMarkdown>
                      {isReasoning && <span className="inline-block w-[2px] h-[1em] bg-purple-500/60 ml-0.5 animate-pulse align-text-bottom" />}
                    </div>
                    {showReasoningScrollBtn && isReasoning && (
                      <button
                        onClick={() => { reasoningUserScrolledUpRef.current = false; setShowReasoningScrollBtn(false); if (reasoningRef.current) reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight; }}
                        className="absolute bottom-2 right-3 z-10 flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-500/90 hover:bg-purple-600 text-white shadow-md backdrop-blur-sm transition-all duration-200"
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
                        回到最新
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* ═══════ 操作步骤 + 思考文字（统一版） ═══════ */}
              {(effectiveOperationLogs.length > 0 || effectiveThinkingSteps.length > 0) && (
                isImageGenerationFlow(effectiveOperationLogs) ? (
                  <ImageGenerationProgress operations={effectiveOperationLogs} isLive={!!isStreaming} />
                ) : (
                  <InlineStepList
                    operations={effectiveOperationLogs}
                    thinkingSteps={effectiveThinkingSteps}
                    isLive={!!isStreaming}
                    onFileClick={(fileName) => {
                      if (isStreaming) {
                        const content = state.streamedContent || '';
                        const codeBlocks = content.match(/```[\w]*\n([\s\S]*?)```/g) || [];
                        const lastBlock = codeBlocks.length > 0 ? codeBlocks[codeBlocks.length - 1].replace(/```\w*\n?/g, '').trim() : '';
                        setPreviewFile({ name: fileName, content: lastBlock, isLive: true });
                      } else {
                        handleFileClick(fileName, msg, setPreviewFile);
                      }
                    }}
                  />
                )
              )}

              {/* ═══════ Artifact 内联触发卡片（流式期间） ═══════ */}
              {isStreaming && (msg as any).artifact && (
                <ArtifactInlineTrigger artifact={(msg as any).artifact} onOpen={() => { const { setActiveArtifact, openMobileArtifact } = state as any; if (setActiveArtifact) setActiveArtifact((msg as any).artifact); if (openMobileArtifact) openMobileArtifact(); }} />
              )}

              {/* ═══════ 联网搜索状态指示器（仅流式期间） ═══════ */}
              {isStreaming && (state as any).webSearchQuery && (
                <div className="mb-2"><SearchingIndicator query={(state as any).webSearchQuery} /></div>
              )}

              {/* 内容区域 */}
              <div className="flex-1 min-w-0 space-y-2 overflow-visible text-[15px] leading-relaxed text-foreground/90 min-h-[24px] md:pl-0" style={{ wordWrap: 'break-word', overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                {/* 意图确认卡片 */}
                {((msg as any).isIntentConfirm || (msg as any).isResearchConfirm || (msg as any).isVideoConfirm) ? (
                  <IntentConfirmSection {...props} />
                ) : ((msg as any).isResearchTask || (msg as any).isVideoTask || (msg as any).isAutomationTask) ? (
                  <AssistantTaskCards {...props} />
                ) : (msg as any).solutionPicker ? (
                  /* 方案选择卡片 */
                  (msg as any).solutionPicker.status === 'pending' ? (
                    <SolutionPickerCard
                      data={(msg as any).solutionPicker}
                      onSelect={(idx, option) => {
                        state.setMessages((prev: any[]) => {
                          const newMsgs = [...prev];
                          const mi = newMsgs.indexOf(msg);
                          if (mi >= 0) {
                            (newMsgs[mi] as any).solutionPicker = {
                              ...(newMsgs[mi] as any).solutionPicker,
                              status: 'selected',
                              selectedIndex: idx,
                            };
                          }
                          return newMsgs;
                        });
                        handleSendMessage(`我选择方案${idx + 1}：${option.title}${option.description ? '\n' + option.description : ''}`);
                      }}
                      onCustom={(text) => {
                        state.setMessages((prev: any[]) => {
                          const newMsgs = [...prev];
                          const mi = newMsgs.indexOf(msg);
                          if (mi >= 0) {
                            (newMsgs[mi] as any).solutionPicker = {
                              ...(newMsgs[mi] as any).solutionPicker,
                              status: 'selected',
                              customText: text,
                            };
                          }
                          return newMsgs;
                        });
                        handleSendMessage(text);
                      }}
                      onSkip={() => {
                        state.setMessages((prev: any[]) => {
                          const newMsgs = [...prev];
                          const mi = newMsgs.indexOf(msg);
                          if (mi >= 0) {
                            (newMsgs[mi] as any).solutionPicker = {
                              ...(newMsgs[mi] as any).solutionPicker,
                              status: 'skipped',
                            };
                          }
                          return newMsgs;
                        });
                        handleSendMessage('请直接给出你认为最佳的方案，详细说明实现步骤');
                      }}
                    />
                  ) : (
                    <SolutionPickerResult data={(msg as any).solutionPicker} />
                  )
                ) : (msg as any).artifact && !isStreaming ? (
                  <>
                    {/* Artifact 场景：描述文字 + 紧凑触发卡片（完成态） */}
                    {(() => {
                      const cleanedContent = displayContent
                        .replace(/```(?:html|jsx|tsx|vue|css|react|artifact:[^\n]*)\n[\s\S]*?```/g, '')
                        .replace(/```\n[\s\S]*?```/g, '')
                        .trim();
                      if (cleanedContent) {
                        return <AssistantRegularContent {...props} displayContent={cleanedContent} />;
                      }
                      return null;
                    })()}
                    <ArtifactInlineTrigger
                      artifact={(msg as any).artifact}
                      onOpen={() => {
                        const { setActiveArtifact, openMobileArtifact } = state as any;
                        if (setActiveArtifact) setActiveArtifact((msg as any).artifact);
                        if (openMobileArtifact) openMobileArtifact();
                      }}
                    />
                  </>
                ) : (
                  /* ═══════ 常规内容（统一流式+完成态渲染） ═══════ */
                  <>
                    {displayContent ? (
                      <AssistantRegularContent {...props} />
                    ) : isStreaming ? (
                      /* 等待指示器（流式期间无内容时） */
                      isImageGenerationFlow(effectiveOperationLogs) ? null : (
                        effectiveOperationLogs.length > 0 ? (
                          <div className="flex items-center gap-2 py-2 text-muted-foreground">
                            <div className="animate-spin w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full" />
                            <span className="text-sm">{panelTexts.waiting}</span>
                            {state.elapsedThinkingTime > 0 && (
                              <span className="text-xs text-muted-foreground/60">{state.elapsedThinkingTime.toFixed(1)}s</span>
                            )}
                          </div>
                        ) : (
                          <ThinkingAnimation
                            elapsedTime={state.elapsedThinkingTime}
                            thinkingStage={state.thinkingStage}
                            hasOperations={effectiveOperationLogs.length > 0}
                          />
                        )
                      )
                    ) : null}
                  </>
                )}
              </div>
            </div>
          ) : (
            /* 用户消息 */
            <UserContent {...props} />
          )}

          {/* 操作按钮 — 流式期间隐藏，完成后渐入（保留占位避免跳动） */}
          <div className={cn(
            "transition-opacity duration-200 ease-out",
            isStreaming ? "opacity-0 pointer-events-none" : "opacity-100"
          )}>
            <MessageActions {...props} />
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * 文件点击处理：从消息内容中提取对应文件的代码块并预览
 */
function handleFileClick(
  fileName: string,
  msg: ChatMessage,
  setPreviewFile: (file: any) => void,
) {
  const content = typeof msg.content === 'string' ? msg.content : '';

  // 多文件感知：定位到该文件对应的代码区域
  let contentToExtract = content;
  const escapedName = fileName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const filePatterns = [
    new RegExp(`修改文件[：:]\\s*\\*{0,2}\\s*${escapedName}`, 'i'),
    new RegExp(`文件[：:]\\s*\\*{0,2}\\s*\`?${escapedName}\`?`, 'i'),
    new RegExp(`编写修复方案.*${escapedName}`, 'i'),
  ];

  let fileStartPos = -1;
  for (const pat of filePatterns) {
    const fm = content.match(pat);
    if (fm && fm.index !== undefined) {
      fileStartPos = fm.index;
      break;
    }
  }

  if (fileStartPos >= 0) {
    const afterFile = content.substring(fileStartPos + fileName.length);
    const nextFileMatch = afterFile.match(/修改文件[：:]\s*\*{0,2}\s*[\w\/\-\.]+\.\w+/);
    if (nextFileMatch && nextFileMatch.index !== undefined) {
      contentToExtract = content.substring(fileStartPos, fileStartPos + fileName.length + nextFileMatch.index);
    } else {
      contentToExtract = content.substring(fileStartPos);
    }
  }

  const rawBlocks: string[] = [];
  const regex = /```\w*\n([\s\S]*?)```/g;
  let m;
  while ((m = regex.exec(contentToExtract)) !== null) {
    rawBlocks.push(m[1].trimEnd());
  }
  // 截取后没有代码块则回退全文
  if (rawBlocks.length === 0 && fileStartPos >= 0) {
    while ((m = regex.exec(content)) !== null) {
      rawBlocks.push(m[1].trimEnd());
    }
  }

  // 清理标记注释并去重
  const clean = (s: string) =>
    s.replace(/\/\/\s*[─—\-]{2,}.*[─—\-]{2,}.*$/gm, '')
     .replace(/\/\/\s*[─—\-]*\s*(旧代码|替换为|新代码|原代码|修改后).*$/gm, '')
     .trim();

  const unique: string[] = [];
  for (let i = 0; i < rawBlocks.length; i++) {
    const c = clean(rawBlocks[i]);
    if (i === 0 || c !== clean(rawBlocks[i - 1]) || c.length < 5) unique.push(c);
  }

  let previewContent: string;
  if (unique.length === 0) previewContent = '// 该消息中没有代码块';
  else if (unique.length === 1) previewContent = unique[0];
  else if (unique.length === 2) previewContent = `// ──── 旧代码 ────\n${unique[0]}\n\n// ──── 新代码 ────\n${unique[1]}`;
  else previewContent = `// ──── 旧代码 ────\n${unique[unique.length - 2]}\n\n// ──── 新代码 ────\n${unique[unique.length - 1]}`;

  setPreviewFile({ name: fileName, content: previewContent, isLive: false });
}
