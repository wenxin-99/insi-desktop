import { useState, useCallback, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string }; file_url?: { url: string; mime_type?: string } }>;
}

interface StreamResponse {
  type: "start" | "content" | "done" | "error" | "image" | "image_placeholder" | "image_stage" | "image_progress" | "video_task" | "fallback" | "thinking" | "intent_confirmation" | "operation" | "automation_task";
  content?: string;
  cost?: string;
  originalCost?: string;
  discount?: string;
  discountPercent?: number;
  newBalance?: string;
  message?: string;
  error?: string;
  imageUrl?: string;
  placeholderUrl?: string; // 低分辨率占位图URL
  prompt?: string;
  taskId?: number;
  status?: string;
  usedFallback?: boolean;
  fallbackReason?: string;
  step?: string;
  details?: string;
  timestamp?: number;
  // 意图确认相关
  intent?: 'image_generation' | 'video_generation' | 'document_processing' | 'general_chat';
  confidence?: number;
  reasoning?: string;
  // 操作状态相关
  action?: string;
  target?: string;
  operationStatus?: 'running' | 'completed';
  // 自动化任务相关
  taskName?: string;
  siteName?: string;
  // 图片生成阶段相关
  stage?: string;
  attempt?: number;
  maxAttempts?: number;
  errorType?: string;
  // 文档整理相关
  isDocumentGeneration?: boolean;
  requestedFormat?: string;
}

interface UseChatStreamOptions {
  onStart?: (data: { cost: string; originalCost: string; discount: string; discountPercent: number }) => void;
  onContent?: (content: string) => void;
  onImagePlaceholder?: (data: { placeholderUrl: string; prompt: string }) => void; // 占位图事件
  onImage?: (data: { imageUrl: string; placeholderUrl?: string; prompt: string }) => void;
  onImageStage?: (data: { stage: string; prompt?: string; error?: string; errorType?: string; timestamp: number }) => void;
  onImageProgress?: (data: { attempt: number; maxAttempts: number; status: string; timestamp: number }) => void;
  onVideoTask?: (data: { taskId: number; prompt: string; status: string }) => void;
  onFallback?: (data: { usedFallback: boolean; fallbackReason: string }) => void;
  onThinking?: (data: { step: string; details?: string; timestamp: number }) => void;
  onIntentConfirm?: (data: { intent: string; confidence: number; reasoning: string; imageUrl: string }) => void;
  onOperation?: (data: { action: string; target?: string; operationStatus: 'running' | 'completed'; timestamp: number; diff?: any; detail?: any; stepType?: string; description?: string }) => void;
  onThinkingSummary?: (data: { summary: string; timestamp: number }) => void;
  // Artifact 实时预览
  onArtifactStart?: (data: { artifact: { id: string; title: string; language: string; description?: string; version?: number } }) => void;
  onArtifactChunk?: (data: { artifactId: string; chunk: string }) => void;
  onArtifactEnd?: (data: { artifactId: string; metadata?: any }) => void;
  onSolutionPicker?: (data: { id: string; question: string; options: Array<{ title: string; description?: string }>; allowCustom: boolean; allowSkip: boolean }) => void;
  onAutomationTask?: (data: { taskId: number; taskName: string; siteName: string; status: string }) => void;
  onFilePreview?: (data: { fileName: string; action: 'create' | 'modify' | 'delete'; newContent?: string; oldContent?: string; timestamp: number }) => void;
  onDone?: (data: { newBalance: string; message: string; isDocumentGeneration?: boolean; requestedFormat?: string }) => void;
  onError?: (error: string) => void;
}

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [streamedContent, setStreamedContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  
  // 平滑流式输出缓冲区
  const rawBufferRef = useRef("");           // 从API收到的完整原始内容
  const displayedLenRef = useRef(0);         // 已显示的字符数
  const rafIdRef = useRef<number | null>(null);  // requestAnimationFrame ID
  const isFlushingRef = useRef(false);       // 是否在最终flush阶段
  const lastCommitTimeRef = useRef(0);       // 上次提交 React state 的时间戳

  // ★ React 状态提交节流间隔（ms）
  // rAF 仍以 60fps 运行来积累字符，但 setStreamedContent 只在此间隔触发
  // 这样避免每帧都触发整棵 React 树 diff，同时保持视觉流畅
  const STATE_COMMIT_INTERVAL = 50; // ~20fps React 更新

  // 平滑输出动画帧 - 每帧积累字符，节流提交 React 状态
  const animateStream = useCallback(() => {
    const rawLen = rawBufferRef.current.length;
    const displayedLen = displayedLenRef.current;
    
    if (displayedLen < rawLen) {
      // 计算本帧应输出的字符数
      const remaining = rawLen - displayedLen;
      // 动态速率：缓冲区积压多时加速，少时减速，营造自然节奏
      let charsThisFrame: number;
      if (isFlushingRef.current) {
        charsThisFrame = Math.min(remaining, 80);
      } else if (remaining > 200) {
        charsThisFrame = Math.min(remaining, Math.max(15, Math.floor(remaining * 0.15)));
      } else if (remaining > 50) {
        charsThisFrame = Math.min(remaining, 8);
      } else {
        charsThisFrame = Math.min(remaining, 4);
      }
      
      displayedLenRef.current = displayedLen + charsThisFrame;
    }

    // ★ 节流提交：仅在间隔到达或 flush 时才更新 React 状态
    const now = performance.now();
    const shouldCommit =
      isFlushingRef.current ||
      now - lastCommitTimeRef.current >= STATE_COMMIT_INTERVAL;

    if (shouldCommit && displayedLenRef.current > 0) {
      lastCommitTimeRef.current = now;
      setStreamedContent(rawBufferRef.current.substring(0, displayedLenRef.current));
    }
    
    // 继续动画直到所有内容显示完毕
    if (displayedLenRef.current < rawBufferRef.current.length || !isFlushingRef.current) {
      rafIdRef.current = requestAnimationFrame(animateStream);
    } else {
      // 最终确保提交完整内容
      if (displayedLenRef.current > 0) {
        setStreamedContent(rawBufferRef.current.substring(0, displayedLenRef.current));
      }
      rafIdRef.current = null;
    }
  }, []);

  // 启动动画循环
  const startAnimation = useCallback(() => {
    if (rafIdRef.current === null) {
      rafIdRef.current = requestAnimationFrame(animateStream);
    }
  }, [animateStream]);
  
  // 停止动画循环
  const stopAnimation = useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
  }, []);
  
  // ★ C-06: flushBuffer 已移除（未使用的死代码）
  // done 事件中通过 stopAnimation + setStreamedContent 直接完成 flush

  // 清理动画
  useEffect(() => {
    return () => stopAnimation();
  }, [stopAnimation]);

  const sendMessage = useCallback(
    async (
      modelId: number,
      messages: Message[],
      conversationId: number | undefined,
      options: UseChatStreamOptions = {},
      packageId?: number,
      hasVisionContent?: boolean
    ) => {
      setIsStreaming(true);
      setStreamedContent("");
      setError(null);
      
      // 重置平滑缓冲区
      rawBufferRef.current = "";
      displayedLenRef.current = 0;
      isFlushingRef.current = false;
      lastCommitTimeRef.current = 0;
      stopAnimation();

      // Abort any in-flight request before starting a new stream.
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        // 获取token（支持cookie和token两种模式）
        const token = localStorage.getItem("auth_token");
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }

        const response = await fetch("/api/chat/stream", {
          method: "POST",
          headers,
          credentials: "include", // 支持cookie模式
          signal: controller.signal,
          body: JSON.stringify({
            modelId,
            messages,
            conversationId,
            packageId,
            hasVisionContent,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "请求失败");
        }

        if (!response.body) {
          throw new Error("Response body is null");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let shouldExit = false;

        while (true) {
          const { done, value } = await reader.read();
          if (done || shouldExit) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            try {
              const jsonStr = trimmed.slice(6);
              
              // 处理 [DONE] 字符串（VPS任务流程结束标记），必须在 JSON.parse 之前判断
              if (jsonStr === "[DONE]") {
                options.onDone?.({ newBalance: "", message: "" });
                shouldExit = true;
                break;
              }
              
              const data: StreamResponse = JSON.parse(jsonStr);

              // 处理 OpenAI 流式格式 (choices[0].delta.content)
              // VPS任务流程使用此格式发送 ResearchTaskCard 内容
              if ((data as any).choices?.[0]?.delta?.content !== undefined) {
                const chunkContent = (data as any).choices[0].delta.content;
                if (chunkContent) {
                  // 写入缓冲区，动画循环会平滑输出
                  rawBufferRef.current += chunkContent;
                  startAnimation();
                  options.onContent?.(chunkContent);
                }
                continue;
              }

              if (data.type === "start") {
                options.onStart?.({
                  cost: data.cost!,
                  originalCost: data.originalCost!,
                  discount: data.discount!,
                  discountPercent: data.discountPercent!,
                });
              } else if (data.type === "content") {
                // 写入缓冲区，动画循环会平滑输出
                const content = data.content!;
                rawBufferRef.current += content;
                startAnimation();
                options.onContent?.(content);
              } else if (data.type === "image_placeholder") {
                // 处理占位图事件
                options.onImagePlaceholder?.({
                  placeholderUrl: data.placeholderUrl!,
                  prompt: data.prompt!,
                });
              } else if (data.type === "image") {
                // 处理图片生成事件
                options.onImage?.({
                  imageUrl: data.imageUrl!,
                  placeholderUrl: data.placeholderUrl,
                  prompt: data.prompt!,
                });
              } else if (data.type === "image_stage") {
                // 处理图片生成阶段事件
                options.onImageStage?.({
                  stage: data.stage!,
                  prompt: data.prompt,
                  error: data.error,
                  errorType: data.errorType,
                  timestamp: data.timestamp!,
                });
              } else if (data.type === "image_progress") {
                // 处理图片生成进度事件（Alibaba 轮询）
                options.onImageProgress?.({
                  attempt: data.attempt!,
                  maxAttempts: data.maxAttempts!,
                  status: data.status!,
                  timestamp: data.timestamp!,
                });
              } else if (data.type === "video_task") {
                // 处理视频生成任务事件
                options.onVideoTask?.({
                  taskId: data.taskId!,
                  prompt: data.prompt!,
                  status: data.status!,
                });
              } else if (data.type === "fallback") {
                // 处理备用模型事件
                options.onFallback?.({
                  usedFallback: data.usedFallback!,
                  fallbackReason: data.fallbackReason!,
                });
              } else if (data.type === "thinking") {
                // 处理思考步骤事件
                options.onThinking?.({
                  step: data.step!,
                  details: data.details,
                  timestamp: data.timestamp!,
                });
              } else if (data.type === "operation") {
                // 处理操作状态事件（服务端发送 status，映射为 operationStatus）
                options.onOperation?.({
                  action: data.action!,
                  target: data.target,
                  operationStatus: (data.operationStatus || data.status) as 'running' | 'completed',
                  timestamp: data.timestamp!,
                  ...(data.diff ? { diff: data.diff } : {}),
                  ...(data.detail ? { detail: data.detail } : {}),
                  ...(data.stepType ? { stepType: data.stepType } : {}),
                  ...(data.description ? { description: data.description } : {}),
                });
              } else if (data.type === "thinking_summary") {
                // 处理思考摘要事件（Claude 风格折叠态一行描述）
                options.onThinkingSummary?.({
                  summary: data.summary!,
                  timestamp: data.timestamp!,
                });
              } else if (data.type === "artifact_start") {
                // Artifact 开始生成
                options.onArtifactStart?.({
                  artifact: data.artifact!,
                });
              } else if (data.type === "artifact_chunk") {
                // Artifact 代码块增量
                options.onArtifactChunk?.({
                  artifactId: data.artifactId!,
                  chunk: data.chunk!,
                });
              } else if (data.type === "artifact_end") {
                // Artifact 生成完成
                options.onArtifactEnd?.({
                  artifactId: data.artifactId!,
                  metadata: data.metadata,
                });
              } else if (data.type === "solution_picker") {
                // 方案选择卡片
                options.onSolutionPicker?.({
                  id: data.id!,
                  question: data.question!,
                  options: data.options!,
                  allowCustom: data.allowCustom ?? true,
                  allowSkip: data.allowSkip ?? true,
                });
              } else if (data.type === "automation_task") {
                // 处理自动化任务事件
                options.onAutomationTask?.({
                  taskId: data.taskId!,
                  taskName: data.taskName || '自动化任务',
                  siteName: data.siteName || '目标网站',
                  status: data.status || 'running',
                });
              } else if (data.type === "file_preview") {
                // 处理文件预览事件（结构化的文件内容，取代前端正则解析）
                options.onFilePreview?.({
                  fileName: data.fileName!,
                  action: data.action || 'create',
                  newContent: data.newContent,
                  oldContent: data.oldContent,
                  timestamp: data.timestamp || Date.now(),
                });
              } else if (data.type === "intent_confirmation") {
                // 处理意图确认事件
                options.onIntentConfirm?.({
                  intent: data.intent!,
                  confidence: data.confidence!,
                  reasoning: data.reasoning!,
                  imageUrl: data.imageUrl!,
                });
              } else if (data.type === "done") {
                // 立即显示所有剩余缓冲内容，确保 onDone 时内容完整
                stopAnimation();
                if (rawBufferRef.current.length > displayedLenRef.current) {
                  displayedLenRef.current = rawBufferRef.current.length;
                  setStreamedContent(rawBufferRef.current);
                }
                options.onDone?.({
                  newBalance: data.newBalance!,
                  message: data.message!,
                  isDocumentGeneration: data.isDocumentGeneration,
                  requestedFormat: data.requestedFormat,
                });
                shouldExit = true; // 收到done事件后退出循环
              } else if (data.type === "error") {
                // 处理错误事件,调用onError回调
                const errorMsg = data.error || "AI调用失败";
                setError(errorMsg);
                options.onError?.(errorMsg);
                shouldExit = true; // 收到error事件后退出循环
              }
            } catch (e) {
              console.error("Failed to parse SSE line:", trimmed, e);
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // User aborted the stream, not an error
          console.log('[ChatStream] Stream aborted by user');
        } else {
          const errorMessage = err instanceof Error ? err.message : "未知错误";
          setError(errorMessage);
          options.onError?.(errorMessage);
        }
      } finally {
        // Clear controller reference if it is the one we created for this request.
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        stopAnimation();
        setIsStreaming(false);
      }
    },
    [startAnimation, stopAnimation]
  );

  const abort = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    stopAnimation();
    setIsStreaming(false);
  }, [stopAnimation]);
  const reset = useCallback(() => {
    setStreamedContent("");
    setError(null);
    setIsStreaming(false);
    rawBufferRef.current = "";
    displayedLenRef.current = 0;
    isFlushingRef.current = false;
    lastCommitTimeRef.current = 0;
    stopAnimation();
  }, [stopAnimation]);

  return {
    sendMessage,
    isStreaming,
    streamedContent,
    error,
    reset,
    abort,
  };
}
