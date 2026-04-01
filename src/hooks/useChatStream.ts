import { useState, useCallback, useRef, useEffect } from "react";

interface Message {
  role: "user" | "assistant" | "system";
  content: string | Array<{ type: string; text?: string; image_url?: { url: string }; file_url?: { url: string; mime_type?: string } }>;
}

interface StreamResponse {
  type: "start" | "content" | "content_replace" | "done" | "error" | "image" | "image_placeholder" | "image_failed" | "image_stage" | "image_progress" | "video_task" | "fallback" | "thinking" | "intent_confirmation" | "operation" | "automation_task" | "tool_start" | "tool_chunk" | "tool_end" | "tool_error";
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
  index?: number; // ★ 多图并发时标识图片槽位
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
  // ★ 流式工具组件相关
  toolId?: string;
  toolType?: string;
  meta?: Record<string, any>;
  chunk?: string;
  field?: string;
  searchResult?: any;
  searchRound?: number;
  currentQuery?: string;
  result?: any;
}

interface UseChatStreamOptions {
  onStart?: (data: { cost: string; originalCost: string; discount: string; discountPercent: number }) => void;
  onContent?: (content: string) => void;
  onImagePlaceholder?: (data: { placeholderUrl: string; prompt: string }) => void; // 占位图事件
  onImage?: (data: { imageUrl: string; placeholderUrl?: string; prompt: string }) => void;
  onImageFailed?: (data: { index?: number }) => void; // ★ 单张图片生成失败
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
  onHomeworkResult?: (data: any) => void; // ★ T14-2
  // ═══ 统一流式工具组件 ═══
  onToolStart?: (data: { toolId: string; toolType: string; meta: Record<string, any> }) => void;
  onToolChunk?: (data: { toolId: string; chunk: string; field?: string; searchResult?: any; searchRound?: number; currentQuery?: string }) => void;
  onToolEnd?: (data: { toolId: string; result?: any }) => void;
  onToolError?: (data: { toolId: string; error: string }) => void;
  onAutomationTask?: (data: { taskId: number; taskName: string; siteName: string; status: string }) => void;
  onFilePreview?: (data: { fileName: string; action: 'create' | 'modify' | 'delete'; newContent?: string; oldContent?: string; timestamp: number }) => void;
  onDone?: (data: { newBalance: string; message: string; isDocumentGeneration?: boolean; requestedFormat?: string }) => void;
  onError?: (error: string) => void;
}

export function useChatStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [showCursor, setShowCursor] = useState(false); // ★ P3-⑭ 打字机光标
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
  // ★ 优化①: 从 50ms 降到 33ms（~30fps），因为 SafeMarkdown 侧不再二次节流
  const STATE_COMMIT_INTERVAL = 33;

  // ═══ Markdown 安全截断：避免在语法标记中间切断 ═══
  // 字符级截断会破坏 **bold** `code` $math$ 等结构，
  // 导致 ReactMarkdown 先当纯文本渲染、下一帧突然变格式 → "闪烁跳变"
  const findSafeCutPoint = useCallback((text: string, targetPos: number, floorPos: number): number => {
    if (targetPos >= text.length) return text.length;
    if (targetPos <= 0) return 0;

    let pos = targetPos;

    // Rule 1: 不在 \ 后面切（LaTeX 转义）
    if (pos > 0 && text[pos - 1] === '\\') pos--;

    // Rule 2: 不在 HTML 实体中间切（&amp; &lt; 等）
    // 向前找最近的 &，如果 & 到 pos 之间没有 ;，说明在实体中间
    const ampIdx = text.lastIndexOf('&', pos);
    if (ampIdx >= 0 && ampIdx >= pos - 8) {
      const semicolonIdx = text.indexOf(';', ampIdx);
      if (semicolonIdx >= pos) {
        pos = ampIdx; // 回退到 & 之前
      }
    }

    // Rule 3: 不在未闭合的行内标记中间切
    // 检查从 pos 向前到最近的换行，统计 ** ` $ 的开闭
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const lineSlice = text.substring(lineStart, pos);

    // 未闭合的 ** → 回退到 ** 之前
    const boldCount = (lineSlice.match(/\*\*/g) || []).length;
    if (boldCount % 2 !== 0) {
      const lastBold = lineSlice.lastIndexOf('**');
      if (lastBold >= 0) pos = lineStart + lastBold;
    }

    // 未闭合的 ` → 回退到 ` 之前（排除 ``` 代码围栏）
    const btCount = (lineSlice.match(/(?<!`)`(?!`)/g) || []).length;
    if (btCount % 2 !== 0) {
      const lastBt = lineSlice.lastIndexOf('`');
      if (lastBt >= 0) pos = lineStart + lastBt;
    }

    // 未闭合的 $ → 回退到 $ 之前（排除 $$）
    const dollarCount = (lineSlice.match(/(?<!\$)\$(?!\$)/g) || []).length;
    if (dollarCount % 2 !== 0) {
      const lastDollar = lineSlice.lastIndexOf('$');
      if (lastDollar >= 0) pos = lineStart + lastDollar;
    }

    // Rule 4: 不在 [ 和 ]( 之间切（Markdown 链接文本）
    const lastBracket = lineSlice.lastIndexOf('[');
    if (lastBracket >= 0) {
      const closeBracket = text.indexOf('](', lineStart + lastBracket);
      if (closeBracket >= pos && closeBracket < pos + 100) {
        pos = lineStart + lastBracket;
      }
    }

    // ★ 下限保护：不能回退到比上一帧已显示的位置更前（floorPos）
    // 否则会产生内容"回缩"闪烁
    return Math.max(pos, floorPos);
  }, []);

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
      
      // ★ 优化②：词边界感知 — 将切点延伸到最近的自然断点
      // 避免在中文词语中间、英文单词中间切断，让每帧输出一个完整"语义片段"
      if (!isFlushingRef.current && charsThisFrame < remaining) {
        let targetPos = displayedLen + charsThisFrame;
        const buf = rawBufferRef.current;
        // 向前探测最多 12 个字符，找到自然断点
        const scanLimit = Math.min(targetPos + 12, rawLen);
        for (let i = targetPos; i < scanLimit; i++) {
          const ch = buf[i];
          // 自然断点：标点、空格、换行、CJK 字符边界后
          if (ch === ' ' || ch === '\n' || ch === '，' || ch === '。' || ch === '、' ||
              ch === '；' || ch === '：' || ch === '！' || ch === '？' || ch === '"' ||
              ch === ')' || ch === '）' || ch === '】' || ch === '》' ||
              ch === '.' || ch === ',' || ch === ';' || ch === ':' || ch === '!' || ch === '?') {
            charsThisFrame = i - displayedLen + 1;
            break;
          }
        }
      }

      // ★ 先保存旧位置作为 snap 下限，再计算新位置
      const oldDisplayedLen = displayedLen;
      displayedLenRef.current = displayedLen + charsThisFrame;

      // ★ Markdown 安全截断：将切点 snap 到安全边界
      // floorPos = 旧位置（不能回退到已显示内容之前，否则内容"回缩"闪烁）
      if (!isFlushingRef.current) {
        displayedLenRef.current = findSafeCutPoint(rawBufferRef.current, displayedLenRef.current, oldDisplayedLen);
      }
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
      hasVisionContent?: boolean,
      thinkingMode?: boolean,
      userCity?: string | null,
      aspectRatio?: string | null,
      autoMode?: boolean,
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
      setShowCursor(true); // ★ P3-⑭ 开启打字机光标

      // Abort any in-flight request before starting a new stream.
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      // ★ P0-① 断线自动重试配置
      const MAX_STREAM_RETRIES = 2;
      const RETRY_BASE_DELAY = 1500;
      let _streamSucceeded = false;

      try {
      for (let _retryAttempt = 0; _retryAttempt <= MAX_STREAM_RETRIES; _retryAttempt++) {
        if (controller.signal.aborted) break;
        if (_retryAttempt > 0) {
          // ★ Bug 2 fix: 重试前重置缓冲区，避免旧+新拼接乱码
          rawBufferRef.current = "";
          displayedLenRef.current = 0;
          isFlushingRef.current = false;
          setStreamedContent("");
          const delay = RETRY_BASE_DELAY * Math.pow(2, _retryAttempt - 1);
          console.log(`[ChatStream] Retry attempt ${_retryAttempt}/${MAX_STREAM_RETRIES} after ${delay}ms`);
          await new Promise(r => setTimeout(r, delay));
          if (controller.signal.aborted) break;
        }

        // ★ 跟踪是否已收到内容（收到内容后不再重试，避免重复）
        let _hasReceivedContent = false;

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
            // ★ fix: 这 4 个参数之前因函数签名只有 6 个参数被静默丢弃，后端始终收到 undefined
            thinkingMode: thinkingMode || false,
            autoMode: autoMode || false,
            userCity: userCity || null,
            aspectRatio: aspectRatio || null,
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
                _hasReceivedContent = true; // ★ Bug 2 fix: 标记已收到内容
                startAnimation();
                options.onContent?.(content);
              } else if (data.type === "content_replace") {
                // ★ 图片/视频生成成功后，清除之前 LLM 流出的多余文字
                rawBufferRef.current = data.content || '';
                displayedLenRef.current = rawBufferRef.current.length;
                setStreamedContent(data.content || '');
              } else if (data.type === "image_placeholder") {
                // 处理占位图事件
                options.onImagePlaceholder?.({
                  placeholderUrl: data.placeholderUrl!,
                  prompt: data.prompt!,
                  index: data.index,
                });
              } else if (data.type === "image") {
                // 处理图片生成事件
                options.onImage?.({
                  imageUrl: data.imageUrl!,
                  placeholderUrl: data.placeholderUrl,
                  prompt: data.prompt!,
                  index: data.index,
                });
              } else if (data.type === "image_failed") {
                // ★ 单张图片生成失败，移除对应槽位
                options.onImageFailed?.({
                  index: data.index,
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
              } else if (data.type === "homework_result") {
                // ★ T14-2: 作业批改结果
                options.onHomeworkResult?.(data);
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
              } else if (data.type === "tool_start") {
                // ═══ 统一流式工具组件：创建容器 ═══
                options.onToolStart?.({
                  toolId: data.toolId!,
                  toolType: data.toolType!,
                  meta: data.meta || {},
                });
              } else if (data.type === "tool_chunk") {
                // ═══ 统一流式工具组件：内容增量 ═══
                options.onToolChunk?.({
                  toolId: data.toolId!,
                  chunk: data.chunk || '',
                  field: data.field,
                  searchResult: data.searchResult,
                  searchRound: data.searchRound,
                  currentQuery: data.currentQuery,
                });
              } else if (data.type === "tool_end") {
                // ═══ 统一流式工具组件：完成 ═══
                options.onToolEnd?.({
                  toolId: data.toolId!,
                  result: data.result,
                });
              } else if (data.type === "tool_error") {
                // ═══ 统一流式工具组件：错误 ═══
                options.onToolError?.({
                  toolId: data.toolId!,
                  error: data.error || '工具执行失败',
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
                // ★ 优化④: done 后立即全量渲染，不做逐帧 flush
                // API 已完成，用户不需要再看"打字"效果，直接显示完整内容
                stopAnimation();
                
                // 一次性提交全部内容
                displayedLenRef.current = rawBufferRef.current.length;
                setStreamedContent(rawBufferRef.current);
                setShowCursor(false);
                
                options.onDone?.({
                  newBalance: data.newBalance!,
                  message: data.message!,
                  isDocumentGeneration: data.isDocumentGeneration,
                  requestedFormat: data.requestedFormat,
                });
                
                _streamSucceeded = true;
                shouldExit = true;
              } else if (data.type === "error") {
                // 处理错误事件,调用onError回调
                const errorMsg = data.error || "AI调用失败";
                setError(errorMsg);
                setShowCursor(false); // ★ P3-⑭
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
          console.log('[ChatStream] Stream aborted by user');
          break; // exit retry loop
        } else {
          // ★ Bug 2 fix: 已收到内容后不重试（避免重复内容）
          const isRetryable = !_hasReceivedContent && err instanceof Error && (
            err.message.includes('fetch') || err.message.includes('network') ||
            err.message.includes('timeout') || err.message.includes('ECONNRESET') ||
            err.message.includes('Failed to fetch')
          );
          if (isRetryable && _retryAttempt < MAX_STREAM_RETRIES) {
            console.warn(`[ChatStream] Retryable error (no content yet): ${err instanceof Error ? err.message : err}`);
            continue; // retry
          }
          const errorMessage = err instanceof Error ? err.message : "未知错误";
          setError(errorMessage);
          setShowCursor(false);
          options.onError?.(errorMessage);
          break; // exit retry loop
        }
      }
      break; // success - exit retry loop
      } // end retry for loop
      } finally {
        // ★ Bug 4 fix: 恢复真正的 finally 块，确保无论如何都执行清理
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        // ★ 只在非成功时停止动画（成功时已在 done handler 中处理）
        if (!_streamSucceeded) {
          stopAnimation();
          setShowCursor(false);
        }
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
    setShowCursor(false); // ★ P3-⑭
  }, [stopAnimation]);
  const reset = useCallback(() => {
    setStreamedContent("");
    setError(null);
    setIsStreaming(false);
    setShowCursor(false); // ★ P3-⑭
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
    showCursor, // ★ P3-⑭ 打字机光标状态
  };
}
