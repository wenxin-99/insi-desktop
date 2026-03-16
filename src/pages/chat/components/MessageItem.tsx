/**
 * MessageItem — 单条消息渲染组件（入口编排文件）
 * 
 * 将渲染委托给子模块：
 * - IntentConfirmSection  → 意图/研究/视频确认卡片
 * - AssistantTaskCards     → 研究/视频/自动化任务卡片
 * - AssistantRegularContent → 助手常规内容（图片+Markdown）
 * - UserContent            → 用户消息（图片+文件+编辑+文本）
 * - MessageActions         → 消息操作按钮栏
 * 
 * 原始文件 1322 行 → 拆分为 6 个文件
 */

import { useState } from 'react';
import { InlineThinkingBlock } from '@/components/InlineThinkingBlock';
import { InlineStepList } from '@/components/InlineStepBlock';
import { ImageGenerationProgress, isImageGenerationFlow } from '@/components/ImageGenerationProgress';
import { ArtifactInlineTrigger } from '@/components/ArtifactInlineTrigger';
import { SolutionPickerCard, SolutionPickerResult } from '@/components/SolutionPickerCard';
import { SafeMarkdown } from '@/components/SafeMarkdown';
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
  state: ChatStateReturn;
  handleSendMessage: (text?: string, resendImages?: any[], resendFiles?: any[], isRegenerate?: boolean) => void;
  handleImageDownload: (url: string, name: string) => Promise<void>;
  normalizeImageUrl: (url: string) => string;
  extractImagesFromMarkdown: (content: string) => { cleanedContent: string; images: Array<{ url: string; name: string }> };
}

export function MessageItem(props: MessageItemProps) {
  const {
    msg, index, displayContent, isLastAssistant,
    state, handleSendMessage, handleImageDownload,
    normalizeImageUrl, extractImagesFromMarkdown,
  } = props;
  const { t } = useTranslation();
  const { messages, isSidebarOpen, setPreviewFile } = state;
  const [reasoningCollapsed, setReasoningCollapsed] = useState(true);

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
              {/* AI 头像 */}
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <AiLogo />
                  <span className="text-sm text-muted-foreground">{t("chat.aiAssistant")}</span>
                  {msg.timestamp && (
                    <span className="text-xs text-muted-foreground/70">{formatSmartTime(msg.timestamp)}</span>
                  )}
                </div>
              </div>

              {/* 内联思考步骤（逐步展示） */}
              {((msg as any).operationLogs?.length > 0 || (msg as any).thinkingSteps?.length > 0) && (
                isImageGenerationFlow((msg as any).operationLogs || []) ? (
                  <ImageGenerationProgress
                    operations={(msg as any).operationLogs}
                    isLive={false}
                  />
                ) : (
                  <InlineStepList
                    operations={(msg as any).operationLogs || []}
                    thinkingSteps={(msg as any).thinkingSteps}
                    isLive={false}
                    onFileClick={(fileName) => handleFileClick(fileName, msg, setPreviewFile)}
                  />
                )
              )}

              {/* 深度推理内容（折叠回看） */}
              {(msg as any).reasoningContent && (
                <div className={cn(
                  "mb-3 rounded-xl overflow-hidden border transition-colors duration-300",
                  "border-purple-200/30 dark:border-purple-800/20"
                )} style={{ background: 'var(--color-purple-50, rgba(139,92,246,0.04))' }}>
                  <button
                    onClick={() => setReasoningCollapsed(c => !c)}
                    className="flex items-center gap-2 w-full px-3 py-2 text-left select-none bg-purple-50/80 dark:bg-purple-900/20 hover:bg-purple-100/80 dark:hover:bg-purple-900/30 transition-colors"
                  >
                    <Brain className="h-4 w-4 text-purple-500 shrink-0" />
                    <span className="text-sm font-medium text-purple-700 dark:text-purple-300 flex-1">
                      深度推理过程
                    </span>
                    <span className="text-xs text-purple-500/50 mr-1 shrink-0">
                      {(msg as any).reasoningContent.length} 字
                    </span>
                    <div className="text-purple-400/40 shrink-0">
                      {!reasoningCollapsed ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    </div>
                  </button>
                  <div className={cn(
                    "transition-all duration-300 ease-in-out overflow-hidden",
                    !reasoningCollapsed ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"
                  )}>
                    <div className="px-3 py-2 max-h-[500px] overflow-y-auto text-sm leading-relaxed bg-purple-50/30 dark:bg-purple-900/10 prose prose-sm dark:prose-invert max-w-none prose-p:my-1 prose-headings:my-2 prose-pre:my-1 prose-ul:my-1 prose-ol:my-1">
                      <SafeMarkdown>{(msg as any).reasoningContent}</SafeMarkdown>
                    </div>
                  </div>
                </div>
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
                ) : (msg as any).artifact ? (
                  <>
                    {/* Artifact 场景：描述文字 + 紧凑触发卡片 */}
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
                        const { setActiveArtifact } = state as any;
                        if (setActiveArtifact) setActiveArtifact((msg as any).artifact);
                      }}
                    />
                  </>
                ) : (
                  <AssistantRegularContent {...props} />
                )}
              </div>
            </div>
          ) : (
            /* 用户消息 */
            <UserContent {...props} />
          )}

          {/* 操作按钮 */}
          <MessageActions {...props} />
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
