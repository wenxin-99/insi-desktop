/**
 * useVoiceChatHandlers — 录音/识别/AI对话/TTS 所有处理器
 * 从 VoiceChat.tsx 拆分
 *
 * 变更：增加 onRoundComplete 回调，每轮对话成功后触发（用于记录用量+扣费）
 */
import { useState, useRef, useCallback, useEffect, type MutableRefObject } from "react";
import { acquireMicStream, releaseMicStream } from "@/hooks/useMicPermission";
import { toast } from "sonner";
import { SimpleTTSPlayer, stripMarkdownForTts } from './SimpleTTSPlayer';
import { startVAD, type VADHandle } from './vadDetector'; // ★ T8-1
import type { VoiceChatStatus, VoiceMessage } from './types';

interface UseVoiceChatHandlersParams {
  language: string;
  messages: VoiceMessage[];
  setMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>;
  selectedModelId: number | null;
  selectedPackageId: number | null;
  selectedVoicePackageId: string;
  selectedVoice: string;
  conversationId: number | undefined;
  setConversationId: (v: number | undefined) => void;
  isMutedRef: MutableRefObject<boolean>;
  voicePackages: any[] | undefined;
  transcribeAudioMutation: any;
  /** 每轮对话完成后的回调（用于记录用量、扣费） */
  onRoundComplete?: () => void;
}

export function useVoiceChatHandlers(params: UseVoiceChatHandlersParams) {
  const {
    language, messages, setMessages,
    selectedModelId, selectedPackageId, selectedVoicePackageId, selectedVoice,
    conversationId, setConversationId,
    isMutedRef, voicePackages, transcribeAudioMutation,
    onRoundComplete,
  } = params;

  const [state, setState] = useState<VoiceChatStatus>("idle");
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [aiResponse, setAiResponse] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioStreamRef = useRef<MediaStream | undefined>(undefined);
  const ttsPlayerRef = useRef<SimpleTTSPlayer | null>(null);
  const sharedAudioCtxRef = useRef<AudioContext | null>(null);
  const audioUnlockRef = useRef<boolean>(false);
  const safetyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // ★ T8-1: VAD 打断
  const vadHandleRef = useRef<VADHandle | null>(null);
  const vadMicStreamRef = useRef<MediaStream | null>(null);

  // 清理资源
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && state === "listening") mediaRecorderRef.current.stop();
      releaseMicStream();
      if (ttsPlayerRef.current) ttsPlayerRef.current.stop();
      if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
      // ★ T8-1: 清理 VAD
      if (vadHandleRef.current) { vadHandleRef.current.stop(); vadHandleRef.current = null; }
      if (vadMicStreamRef.current) {
        vadMicStreamRef.current.getTracks().forEach(t => t.stop());
        vadMicStreamRef.current = null;
      }
      if (sharedAudioCtxRef.current) {
        sharedAudioCtxRef.current.close().catch(() => {});
        sharedAudioCtxRef.current = null;
      }
    };
  }, []);

  // 安全超时
  const setSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
    safetyTimeoutRef.current = setTimeout(() => {
      console.warn("[VoiceChat] Safety timeout triggered - forcing state to idle");
      setState(prev => (prev !== "idle" && prev !== "listening") ? "idle" : prev);
      if (ttsPlayerRef.current) { ttsPlayerRef.current.stop(); ttsPlayerRef.current = null; }
    }, 30000);
  }, []);

  const clearSafetyTimeout = useCallback(() => {
    if (safetyTimeoutRef.current) { clearTimeout(safetyTimeoutRef.current); safetyTimeoutRef.current = null; }
  }, []);

  // 解锁 AudioContext
  const unlockAudio = useCallback(() => {
    if (audioUnlockRef.current && sharedAudioCtxRef.current) return;
    try {
      const ctx = sharedAudioCtxRef.current ?? new AudioContext();
      sharedAudioCtxRef.current = ctx;
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      ctx.onstatechange = () => {
        if (ctx.state === 'suspended') setTimeout(() => ctx.resume().catch(() => {}), 500);
      };
      audioUnlockRef.current = true;
      console.log("[VoiceChat] AudioContext created & unlocked, state:", ctx.state);
    } catch (e) {
      console.error("[VoiceChat] Failed to unlock audio:", e);
    }
  }, []);

  // Auth headers
  const getAuthHeaders = useCallback(() => {
    const token = localStorage.getItem("auth_token");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    return headers;
  }, []);

  // ── 开始录音 ──
  const startListening = useCallback(async () => {
    unlockAudio();
    try {
      const stream = await acquireMicStream({ audio: true });
      audioStreamRef.current = stream;

      const recMimeType =
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus' :
        MediaRecorder.isTypeSupported('audio/ogg;codecs=opus') ? 'audio/ogg;codecs=opus' :
        'audio/webm';
      const mediaRecorder = new MediaRecorder(stream, { mimeType: recMimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const actualMime = mediaRecorderRef.current?.mimeType || 'audio/webm';
        const audioBlob = new Blob(audioChunksRef.current, { type: actualMime });
        if (audioBlob.size < 1000) { setState("idle"); return; }

        setState("processing");
        setCurrentTranscript("正在识别...");
        setSafetyTimeout();

        try {
          const reader = new FileReader();
          const base64Audio = await new Promise<string>((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(audioBlob);
          });

          const result = await transcribeAudioMutation.mutateAsync({
            audioData: base64Audio,
            language,
            packageId: selectedPackageId || undefined,
          });

          const userText = result.text?.trim();
          if (!userText) {
            setCurrentTranscript("");
            setState("idle");
            clearSafetyTimeout();
            toast.info("未检测到语音内容");
            return;
          }

          setCurrentTranscript(userText);
          const userMessage: VoiceMessage = { role: "user", text: userText, timestamp: Date.now() };
          setMessages(prev => [...prev, userMessage]);

          // 发送给 AI
          setState("thinking");
          setAiResponse("");
          const headers = getAuthHeaders();

          const chatMessages = [
            {
              role: "system" as const,
              content: `你是一个友好的语音助手。请用简洁、口语化的方式回答问题。回答尽量简短精炼，适合语音播放。不要使用 Markdown 格式、代码块或特殊符号（禁止使用星号、井号、下划线、反引号等 Markdown 符号，这些会被语音直接读出来）。

今天是 ${new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}，现在是 ${new Date().getFullYear()} 年。

情绪关怀：
- 关注用户语气中的情绪变化。如果用户听起来低落、疲惫或焦虑，语气自然变柔和，先表达理解再回答问题
- 温和而非激昂，"听起来你不太容易"比"加油你可以的"更好
- 如果用户表达出很痛苦或想伤害自己，温和地说"如果你现在很难受，可以拨打心理援助热线400-161-9995，随时都有人听你说"

关于时效性的处理原则：
- 对于 2024 年底之前发生的事，你有完整知识，可以直接准确回答
- 对于 2025 年至今的事情，你的信息不完整，回答时要明确说"根据我到 2025 年初的信息"或"这个问题你可以搜索最新资料"，不要凭空猜测
- 如果用户问的是技术选型、历史知识、通用建议等不依赖最新信息的问题，直接正常回答即可，不需要反复强调信息截止时间
- 不要在每个回答里都加"我的训练数据截止"这样的废话，只在真正涉及时效性信息时才提醒`,
            },
            ...messages.filter(m => m.role !== 'system').slice(-10).map(m => ({
              role: m.role as "user" | "assistant",
              content: m.text,
            })),
            { role: "user" as const, content: userText },
          ];

          const response = await fetch("/api/chat/stream", {
            method: "POST",
            headers,
            credentials: "include",
            body: JSON.stringify({
              modelId: selectedModelId || 1,
              messages: chatMessages,
              conversationId,
              packageId: selectedPackageId,
            }),
          });

          if (!response.ok) throw new Error("AI 请求失败");

          // 流式读取 + 分句流式 TTS
          const streamReader = response.body?.getReader();
          const decoder = new TextDecoder();
          let fullResponse = "";
          let ttsBuffer = "";
          let buffer = "";

          if (ttsPlayerRef.current) ttsPlayerRef.current.stop();
          const currentlyMuted = isMutedRef.current;

          if (!sharedAudioCtxRef.current) sharedAudioCtxRef.current = new AudioContext();
          const audioCtx = sharedAudioCtxRef.current;
          if (audioCtx.state === 'suspended') {
            try {
              await audioCtx.resume();
              console.log('[VoiceChat] AudioContext resumed, state:', audioCtx.state);
            } catch (e) {
              console.warn('[VoiceChat] AudioContext resume failed:', e);
            }
          }

          const activePkg = selectedVoicePackageId
            ? voicePackages?.find((p: any) => p.id === selectedVoicePackageId)
            : null;
          const activeVoice = activePkg?.ttsVoice || selectedVoice || undefined;
          const activeTtsProvider = activePkg?.ttsProvider || undefined;

          const player = new SimpleTTSPlayer(
            () => { setState("idle"); clearSafetyTimeout(); },
            headers,
            audioCtx,
            activeVoice,
            activeTtsProvider
          );
          ttsPlayerRef.current = player;

          const trySpeakSentence = () => {
            // ★ 优化 TTS 延迟：多级分句策略
            // 1. 优先按句号/问号/感叹号切分（完整句子）
            let match = ttsBuffer.match(/^([\s\S]*?[。！？.!?\n])/);
            // 2. 如果没有完整句子但缓冲区超过 20 字，按逗号/分号切分（短语级）
            if (!match && ttsBuffer.length > 20) {
              match = ttsBuffer.match(/^([\s\S]*?[，,；;：:、])/);
            }
            // 3. 如果连逗号都没有但已积累 40+ 字，强制截断发送（防止长句卡死）
            if (!match && ttsBuffer.length > 40) {
              match = [ttsBuffer, ttsBuffer] as unknown as RegExpMatchArray;
            }
            if (match) {
              const rawSentence = match[1];
              const sentence = stripMarkdownForTts(rawSentence).trim();
              ttsBuffer = ttsBuffer.slice(match[1].length);
              if (sentence.length > 2 && !currentlyMuted) {
                if (fullResponse.length <= rawSentence.length + 5) setState("speaking");
                player.speakQueued(sentence);
              }
              trySpeakSentence();
            }
          };

          if (streamReader) {
            while (true) {
              const { done, value } = await streamReader.read();
              if (done) break;
              buffer += decoder.decode(value, { stream: true });
              const lines = buffer.split("\n");
              buffer = lines.pop() || "";
              for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || !trimmed.startsWith("data: ")) continue;
                try {
                  const data = JSON.parse(trimmed.slice(6));
                  if (data.type === "content" && data.content) {
                    fullResponse += data.content;
                    ttsBuffer += data.content;
                    setAiResponse(fullResponse);
                    trySpeakSentence();
                  } else if (data.type === "done") {
                    if (data.conversationId) {
                      setConversationId(data.conversationId);
                      const newUrl = new URL(window.location.href);
                      newUrl.searchParams.set('conversationId', String(data.conversationId));
                      window.history.replaceState({}, '', newUrl.toString());
                    }
                  }
                } catch {}
              }
            }
          }

          const remainingText = stripMarkdownForTts(ttsBuffer).trim();
          if (remainingText.length > 2 && !currentlyMuted) {
            setState("speaking");
            player.speakQueued(remainingText);
          }
          const estimatedTtsDuration = Math.max(30000, fullResponse.length * 350 + 5000);
          if (safetyTimeoutRef.current) clearTimeout(safetyTimeoutRef.current);
          safetyTimeoutRef.current = setTimeout(() => {
            console.warn('[VoiceChat] Safety timeout (dynamic) triggered - forcing idle');
            setState(prev => (prev !== 'idle' && prev !== 'listening') ? 'idle' : prev);
            if (ttsPlayerRef.current) { ttsPlayerRef.current.stop(); ttsPlayerRef.current = null; }
          }, estimatedTtsDuration);
          player.finishQueue();

          if (!fullResponse) { setState("idle"); clearSafetyTimeout(); return; }

          const aiMessage: VoiceMessage = { role: "assistant", text: fullResponse, timestamp: Date.now() };
          setMessages(prev => [...prev, aiMessage]);

          // ★ 对话轮次完成，触发用量记录
          onRoundComplete?.();

          if (currentlyMuted || fullResponse.trim().length < 2) {
            setState("idle");
            clearSafetyTimeout();
          }

        } catch (error: any) {
          console.error("[VoiceChat] Error:", error);
          toast.error(error.message || "处理失败");
          setState("idle");
          setCurrentTranscript("");
          clearSafetyTimeout();
          if (ttsPlayerRef.current) { ttsPlayerRef.current.stop(); ttsPlayerRef.current = null; }
        }
      };

      mediaRecorder.start();
      setState("listening");
    } catch (error: any) {
      console.error("[VoiceChat] Mic error:", error);
      toast.error("无法访问麦克风，请检查权限设置");
    }
  }, [language, messages, selectedModelId, selectedPackageId, conversationId, selectedVoicePackageId, selectedVoice, voicePackages, transcribeAudioMutation, getAuthHeaders, unlockAudio, setSafetyTimeout, clearSafetyTimeout, isMutedRef, setMessages, setConversationId, onRoundComplete]);

  // 取消录音
  const cancelListening = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      audioChunksRef.current = [];
      mediaRecorderRef.current.stop();
    }
    releaseMicStream();
    audioStreamRef.current = null;
    setState('idle');
  }, []);

  // 停止录音
  const stopListening = useCallback(() => {
    if (mediaRecorderRef.current && state === "listening") {
      if (audioStreamRef.current) {
        releaseMicStream();
        audioStreamRef.current = undefined;
      }
      mediaRecorderRef.current.stop();
    }
  }, [state]);

  // 停止播放
  const stopSpeaking = useCallback(() => {
    // ★ T8-1: 先停 VAD
    if (vadHandleRef.current) { vadHandleRef.current.stop(); vadHandleRef.current = null; }
    if (vadMicStreamRef.current) { vadMicStreamRef.current.getTracks().forEach(t => t.stop()); vadMicStreamRef.current = null; }
    if (ttsPlayerRef.current) { ttsPlayerRef.current.stop(); ttsPlayerRef.current = null; }
    // ★ 安全网：直接取消浏览器 SpeechSynthesis（防止 player.stop() 未能覆盖 fallback 场景）
    if (window.speechSynthesis) { window.speechSynthesis.cancel(); }
    clearSafetyTimeout();
    setState("idle");
  }, [clearSafetyTimeout]);

  // ★ T8-1: VAD 打断 — 在 speaking 状态时启动麦克风 VAD 监听
  useEffect(() => {
    if (state !== 'speaking') {
      // 非 speaking 状态，停止 VAD
      if (vadHandleRef.current) { vadHandleRef.current.stop(); vadHandleRef.current = null; }
      if (vadMicStreamRef.current) { vadMicStreamRef.current.getTracks().forEach(t => t.stop()); vadMicStreamRef.current = null; }
      return;
    }

    let cancelled = false;
    let resumeTimer: ReturnType<typeof setTimeout> | null = null;

    (async () => {
      try {
        // 获取独立的麦克风流用于 VAD（不复用录音流，避免冲突）
        const vadStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { vadStream.getTracks().forEach(t => t.stop()); return; }
        vadMicStreamRef.current = vadStream;

        const vadHandle = startVAD(
          vadStream,
          // onSpeechStart: 用户开始说话 → 暂停 TTS
          () => {
            if (resumeTimer) { clearTimeout(resumeTimer); resumeTimer = null; }
            if (ttsPlayerRef.current && !ttsPlayerRef.current.paused) {
              console.log('[VoiceChat] T8-1: User interrupt detected, pausing TTS');
              ttsPlayerRef.current.pause();
            }
          },
          // onSpeechEnd: 用户停止说话 → 等 1.5s，如果没有再说话则恢复 TTS
          () => {
            resumeTimer = setTimeout(() => {
              if (ttsPlayerRef.current && ttsPlayerRef.current.paused && !ttsPlayerRef.current.stopped) {
                console.log('[VoiceChat] T8-1: Brief noise ended, resuming TTS');
                ttsPlayerRef.current.resume();
              }
            }, 1500);
          },
          { threshold: 30, speechStartFrames: 3, speechEndFrames: 10, intervalMs: 50 },
        );

        if (cancelled) { vadHandle.stop(); vadStream.getTracks().forEach(t => t.stop()); return; }
        vadHandleRef.current = vadHandle;
      } catch (err) {
        console.warn('[VoiceChat] T8-1: Failed to start VAD (non-fatal):', err);
      }
    })();

    return () => {
      cancelled = true;
      if (resumeTimer) clearTimeout(resumeTimer);
    };
  }, [state]);

  // 主按钮
  const handleMainAction = useCallback(() => {
    switch (state) {
      case "idle": startListening(); break;
      case "listening": stopListening(); break;
      case "speaking": stopSpeaking(); break;
    }
  }, [state, startListening, stopListening, stopSpeaking]);

  // 空格键 push-to-talk
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat) return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      e.preventDefault();
      if (state === "idle") startListening();
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (state === "listening") stopListening();
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
  }, [state, startListening, stopListening]);

  return {
    state,
    currentTranscript,
    aiResponse,
    audioStreamRef,
    startListening,
    stopListening,
    cancelListening,
    stopSpeaking,
    handleMainAction,
  };
}
