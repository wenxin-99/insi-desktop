/**
 * useGeminiLive — Gemini Live API 实时语音对话 Hook（增强版）
 *
 * 新增能力：
 *   1. 情绪感知：旁路音频分析 → 情绪上下文注入 system prompt
 *   2. 打断恢复：追踪被打断的 AI 回复 → 下一轮自动恢复
 *   3. 多语言翻译：翻译/口语教练模式 → prompt 工程 + 推荐音色
 *
 * 状态机不变：idle → connecting → listening (全双工) → idle
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { startPCMCapture, PCMPlayer, type PCMCaptureHandle } from "./pcmAudio";
import { startEmotionDetector, type EmotionState, type EmotionDetectorHandle } from "./emotionDetector";
import { createInterruptionTracker, type InterruptionTrackerHandle } from "./interruptionTracker";
import { buildTranslationPrompt, type TranslationConfig } from "./translationMode";
import type { VoiceMessage } from "./types";

export type LiveStatus = "idle" | "connecting" | "listening";
export type LiveProvider = "qwen-omni" | "gemini";
type ConnectionMode = "direct" | "proxy";

interface UseGeminiLiveParams {
  voicePackageId?: string;
  voice?: string;
  systemPrompt?: string;
  liveProvider?: LiveProvider;
  messages: VoiceMessage[];
  setMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>;
  conversationId?: number;
  setConversationId?: (id: number | undefined) => void;
  onError?: (msg: string) => void;
  /** ★ 新增：翻译配置 */
  translationConfig?: TranslationConfig;
  /** ★ 新增：情绪变化回调 */
  onEmotionChange?: (emotion: EmotionState) => void;
}

interface UseGeminiLiveReturn {
  status: LiveStatus;
  aiSpeaking: boolean;
  interrupted: boolean;
  userTranscript: string;
  aiTranscript: string;
  micStream: MediaStream | undefined;
  elapsedSeconds: number;
  connectionMode: ConnectionMode | null;
  activeProvider: LiveProvider | null;
  availableProviders: LiveProvider[];
  /** ★ 新增：当前情绪状态 */
  emotionState: EmotionState | null;
  /** ★ 新增：是否有待恢复的打断 */
  hasPendingRecovery: boolean;
  start: () => void;
  stop: () => void;
}

export function useGeminiLive(params: UseGeminiLiveParams): UseGeminiLiveReturn {
  const {
    voicePackageId, voice, systemPrompt, liveProvider,
    messages, setMessages,
    conversationId, setConversationId,
    onError, translationConfig, onEmotionChange,
  } = params;

  const [status, setStatus] = useState<LiveStatus>("idle");
  const [aiSpeaking, setAiSpeaking] = useState(false);
  const [interrupted, setInterrupted] = useState(false);
  const [userTranscript, setUserTranscript] = useState("");
  const [aiTranscript, setAiTranscript] = useState("");
  const [micStream, setMicStream] = useState<MediaStream | undefined>(undefined);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [connectionMode, setConnectionMode] = useState<ConnectionMode | null>(null);
  const [activeProvider, setActiveProvider] = useState<LiveProvider | null>(null);
  const [availableProviders, setAvailableProviders] = useState<LiveProvider[]>([]);
  // ★ 新增状态
  const [emotionState, setEmotionState] = useState<EmotionState | null>(null);
  const [hasPendingRecovery, setHasPendingRecovery] = useState(false);

  const statusRef = useRef<LiveStatus>("idle");
  const captureRef = useRef<PCMCaptureHandle | null>(null);
  const playerRef = useRef<PCMPlayer | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // Direct mode refs
  const directWsRef = useRef<WebSocket | null>(null);
  // Proxy mode refs
  const socketRef = useRef<Socket | null>(null);

  // 转录累积
  const userTextAccRef = useRef("");
  const aiTextAccRef = useRef("");
  const sessionMessagesRef = useRef<VoiceMessage[]>([]);
  const conversationIdRef = useRef<number | undefined>(conversationId);

  // ★ 新增 refs
  const emotionDetectorRef = useRef<EmotionDetectorHandle | null>(null);
  const interruptionTrackerRef = useRef<InterruptionTrackerHandle>(createInterruptionTracker());
  const translationConfigRef = useRef<TranslationConfig | undefined>(translationConfig);

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);
  useEffect(() => { translationConfigRef.current = translationConfig; }, [translationConfig]);

  // ── 计时器 ──
  const startTimer = useCallback(() => {
    startTimeRef.current = Date.now();
    setElapsedSeconds(0);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);
  }, []);
  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  // ── 添加消息 ──
  const addSessionMessage = useCallback((role: "user" | "assistant", text: string) => {
    if (!text.trim()) return;
    sessionMessagesRef.current.push({ role, text: text.trim(), timestamp: Date.now() });
  }, []);

  // ── 保存对话 ──
  const saveConversation = useCallback(async () => {
    const msgs = sessionMessagesRef.current;
    if (msgs.length === 0) return;

    try {
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const resp = await fetch("/api/voice-live/save", {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          messages: msgs.map(m => ({ role: m.role, content: m.text, timestamp: m.timestamp })),
          conversationId: conversationIdRef.current,
          durationMs: Date.now() - startTimeRef.current,
        }),
      });

      if (resp.ok) {
        const data = await resp.json();
        if (data.conversationId && setConversationId) {
          setConversationId(data.conversationId);
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.set("conversationId", String(data.conversationId));
          window.history.replaceState({}, "", newUrl.toString());
        }
      }
    } catch (err) {
      console.error("[GeminiLive] Save failed:", err);
    }
  }, [setConversationId]);

  // ── 处理 turn complete ──
  const handleTurnComplete = useCallback(() => {
    setTimeout(() => {
      if (playerRef.current && !playerRef.current.playing) setAiSpeaking(false);
    }, 500);

    const userText = userTextAccRef.current.trim();
    if (userText) {
      setMessages(prev => {
        if (prev.slice(-3).some(m => m.role === "user" && m.text === userText)) return prev;
        return [...prev, { role: "user", text: userText, timestamp: Date.now() }];
      });
      addSessionMessage("user", userText);
      setUserTranscript(""); userTextAccRef.current = "";
    }

    const aiText = aiTextAccRef.current.trim();
    if (aiText) {
      setMessages(prev => [...prev, { role: "assistant", text: aiText, timestamp: Date.now() }]);
      addSessionMessage("assistant", aiText);
      setAiTranscript(""); aiTextAccRef.current = "";
    }

    // ★ 重置打断追踪器的 turn 缓冲
    interruptionTrackerRef.current.resetTurn();
    setHasPendingRecovery(interruptionTrackerRef.current.hasPendingRecovery());
  }, [setMessages, addSessionMessage]);

  // ── 处理打断 ──
  const handleInterrupted = useCallback(() => {
    if (playerRef.current) playerRef.current.stop();
    setAiSpeaking(false);
    setInterrupted(true);
    setTimeout(() => setInterrupted(false), 1500);

    // ★ 记录打断点
    interruptionTrackerRef.current.markInterrupted();
    setHasPendingRecovery(true);
    console.log("[GeminiLive] Interrupted — recovery context saved");
  }, []);

  // ── 清理 ──
  const cleanup = useCallback(() => {
    if (captureRef.current) { captureRef.current.stop(); captureRef.current = null; }
    if (playerRef.current) playerRef.current.stop();
    if (directWsRef.current) {
      try { directWsRef.current.close(); } catch {}
      directWsRef.current = null;
    }
    // ★ 停止情绪检测
    if (emotionDetectorRef.current) {
      emotionDetectorRef.current.stop();
      emotionDetectorRef.current = null;
    }
    stopTimer();
    setMicStream(undefined);
    setAiSpeaking(false);
    setInterrupted(false);
    setEmotionState(null);
  }, [stopTimer]);

  // ═══════════ Direct WebSocket 模式 ═══════════

  const startDirect = useCallback(async (wsUrl: string) => {
    console.log("[GeminiLive] Starting direct WebSocket mode");
    setConnectionMode("direct");

    const ws = new WebSocket(wsUrl);
    directWsRef.current = ws;

    ws.onopen = () => {
      console.log("[GeminiLive] Direct WS connected");
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.setupComplete) {
          setStatus("listening");
          startTimer();
          return;
        }

        if (msg.serverContent) {
          const sc = msg.serverContent;
          if (sc.modelTurn?.parts) {
            for (const part of sc.modelTurn.parts) {
              if (part.inlineData?.data) {
                if (!playerRef.current) playerRef.current = new PCMPlayer();
                playerRef.current.enqueue(
                  Uint8Array.from(atob(part.inlineData.data), c => c.charCodeAt(0)).buffer
                );
                setAiSpeaking(true);
                setInterrupted(false);
              }
            }
          }
          if (sc.inputTranscription?.text) {
            userTextAccRef.current += sc.inputTranscription.text;
            setUserTranscript(userTextAccRef.current);
            // ★ 喂给打断追踪器
            interruptionTrackerRef.current.feedUserTranscript(userTextAccRef.current);
          }
          if (sc.outputTranscription?.text) {
            aiTextAccRef.current += sc.outputTranscription.text;
            setAiTranscript(aiTextAccRef.current);
            // ★ 喂给打断追踪器
            interruptionTrackerRef.current.feedAiTranscript(sc.outputTranscription.text);
          }
          if (sc.interrupted) handleInterrupted();
          if (sc.turnComplete) handleTurnComplete();
        }
      } catch (err) {
        console.error("[GeminiLive] Direct WS parse error:", err);
      }
    };

    ws.onerror = () => {
      onError?.("实时连接出错");
      setStatus("idle"); cleanup();
    };

    ws.onclose = (e) => {
      if (statusRef.current !== "idle") {
        setStatus("idle"); cleanup();
      }
    };
  }, [startTimer, handleTurnComplete, handleInterrupted, cleanup, onError]);

  // ═══════════ Socket.IO Proxy 模式 ═══════════

  const startProxy = useCallback(async (prompt: string) => {
    console.log("[GeminiLive] Falling back to Socket.IO proxy mode");
    setConnectionMode("proxy");

    if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.disconnect(); }

    const socket = io({ path: "/socket.io", transports: ["websocket", "polling"], reconnection: false, timeout: 10000 });
    socketRef.current = socket;

    socket.on("connect_error", () => { onError?.("连接失败"); setStatus("idle"); cleanup(); });
    socket.on("live:ready", () => { setStatus("listening"); startTimer(); });
    socket.on("live:audio", (data: ArrayBuffer) => {
      if (!playerRef.current) playerRef.current = new PCMPlayer();
      playerRef.current.enqueue(data);
      setAiSpeaking(true); setInterrupted(false);
    });
    socket.on("live:transcript", (data: { type: "input" | "output"; text: string }) => {
      if (data.type === "input") {
        userTextAccRef.current += data.text;
        setUserTranscript(userTextAccRef.current);
        interruptionTrackerRef.current.feedUserTranscript(userTextAccRef.current);
      } else {
        aiTextAccRef.current += data.text;
        setAiTranscript(aiTextAccRef.current);
        interruptionTrackerRef.current.feedAiTranscript(data.text);
      }
    });
    socket.on("live:interrupted", handleInterrupted);
    socket.on("live:turn_complete", handleTurnComplete);
    socket.on("live:error", (data: { message: string }) => { onError?.(data.message); setStatus("idle"); cleanup(); });
    socket.on("live:ended", () => { setStatus("idle"); cleanup(); });
    socket.on("live:provider", (data: { provider: string; available: string[] }) => {
      setActiveProvider(data.provider as LiveProvider);
      setAvailableProviders((data.available || []) as LiveProvider[]);
    });

    // 等待连接
    if (!socket.connected) {
      await new Promise<void>((resolve, reject) => {
        const t = setTimeout(() => reject(new Error("连接超时")), 10000);
        socket.once("connect", () => { clearTimeout(t); resolve(); });
        socket.once("connect_error", (e) => { clearTimeout(t); reject(e); });
      });
    }

    // P6: prompt 已在 start() 中完整构建（含翻译/恢复），这里直接传递
    socket.emit("live:start", {
      voicePackageId,
      voice,
      systemPrompt: prompt || undefined,
      provider: liveProvider,
      translationConfig: translationConfigRef.current,
    });
  }, [voicePackageId, voice, liveProvider, startTimer, handleTurnComplete, handleInterrupted, cleanup, onError]);

  // ═══════════ 开始 ═══════════

  const start = useCallback(async () => {
    if (statusRef.current !== "idle") return;
    setStatus("connecting");
    setUserTranscript(""); setAiTranscript(""); setElapsedSeconds(0);
    userTextAccRef.current = ""; aiTextAccRef.current = "";
    sessionMessagesRef.current = [];

    try {
      // 1. 启动麦克风
      const capture = await startPCMCapture((pcmData) => {
        if (statusRef.current !== "listening") return;
        if (directWsRef.current?.readyState === WebSocket.OPEN) {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData)));
          directWsRef.current.send(JSON.stringify({
            realtimeInput: { audio: { data: base64, mimeType: "audio/pcm;rate=16000" } },
          }));
          return;
        }
        if (socketRef.current?.connected) {
          socketRef.current.emit("live:audio", pcmData);
        }
      });
      captureRef.current = capture;
      setMicStream(capture.stream);
      if (!playerRef.current) playerRef.current = new PCMPlayer();

      // ★ 2. 启动情绪检测器 + 定时推送情绪更新到服务端
      try {
        const emotionDetector = startEmotionDetector(capture.stream, {
          intervalMs: 500,
          onEmotionChange: (state) => {
            setEmotionState(state);
            onEmotionChange?.(state);
            // P2: 情绪变化时推送到服务端（Qwen 可通过文本注入）
            if (socketRef.current?.connected) {
              const ctx = emotionDetector.getEmotionContext();
              if (ctx) socketRef.current.emit("live:update_emotion", { emotionContext: ctx });
            }
          },
        });
        emotionDetectorRef.current = emotionDetector;
      } catch (err) {
        console.warn("[GeminiLive] Emotion detector init failed (non-fatal):", err);
      }

      // 3. 构建完整 prompt（P5: 两种模式一致的增强 prompt）
      const now = new Date();
      const dateStr = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' });

      let prompt = systemPrompt || [
        `你是一个友好的语音助手。今天是${dateStr}。`,
        `- 耐心等用户把话说完再回复`,
        `- 用简短口语化回答，每次1-3句话`,
        `- 语气自然亲切，像朋友聊天`,
        `- 打招呼简短回应即可`,
      ].join('\n');

      // 情绪感知通用指令（P2: 不注入具体检测结果，那是运行时的事）
      prompt += [
        "\n\n情绪感知：",
        "- 关注用户语气中的情绪变化。如果用户听起来低落、疲惫或焦虑，语气自然变柔和，先表达理解再回答问题",
        "- 温和而非激昂，\"听起来你不太容易\"比\"加油你可以的\"更好",
        "- 如果用户开心或兴奋，配合他们的情绪，表达共同的喜悦",
      ].join("\n");

      // 打断恢复通用指令
      prompt += [
        "\n\n打断恢复：",
        "- 如果你正在回答时被用户打断，优先响应用户新发言",
        "- 如果之前回答有重要内容没说完，回答完新问题后简短提及\"刚才说到…要继续吗？\"",
        "- 不要每次都恢复，只在确实重要时恢复",
      ].join("\n");

      // 注入翻译模式 prompt
      const translationPrompt = translationConfigRef.current
        ? buildTranslationPrompt(translationConfigRef.current)
        : "";
      if (translationPrompt) {
        prompt += "\n" + translationPrompt;
      }

      // 注入打断恢复上下文（跨会话恢复）
      const recoveryCtx = interruptionTrackerRef.current.getRecoveryContext();
      if (recoveryCtx) {
        prompt += "\n" + recoveryCtx;
      }

      // 历史上下文
      if (messages.length > 0) {
        const ctx = messages.slice(-6).map(m => `${m.role === "user" ? "用户" : "助手"}: ${m.text}`).join("\n");
        prompt += `\n\n之前的对话上下文：\n${ctx}`;
      }

      // 4. 尝试获取 ephemeral token
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let useDirect = false;
      try {
        const resp = await fetch("/api/voice-live/token", {
          method: "POST", headers, credentials: "include",
          body: JSON.stringify({
            voicePackageId,
            systemPrompt: prompt,
            // ★ 传递翻译配置给后端（用于选择合适的 voice）
            translationConfig: translationConfigRef.current,
          }),
        });

        if (resp.status === 402 || resp.status === 401) {
          const errData = await resp.json().catch(() => ({ error: "请求失败" }));
          throw new Error(errData.error || (resp.status === 402 ? "鱼币余额不足" : "未登录"));
        }

        if (resp.ok) {
          const data = await resp.json();
          if (!data.fallback && data.wsUrl && data.token) {
            useDirect = true;
            await startDirect(data.wsUrl);
          }
        }
      } catch (e: any) {
        if (e.message?.includes("余额") || e.message?.includes("登录")) throw e;
        console.warn("[GeminiLive] Ephemeral token failed, using proxy:", e);
      }

      if (!useDirect) {
        await startProxy(prompt);
      }

    } catch (err: any) {
      console.error("[GeminiLive] Start failed:", err);
      onError?.(err.message || "启动失败");
      setStatus("idle"); cleanup();
    }
  }, [voicePackageId, voice, systemPrompt, messages, startDirect, startProxy, cleanup, onError, onEmotionChange]);

  // ═══════════ 结束 ═══════════

  const stop = useCallback(() => {
    const ai = aiTextAccRef.current.trim();
    if (ai) { setMessages(p => [...p, { role: "assistant", text: ai, timestamp: Date.now() }]); addSessionMessage("assistant", ai); }
    const u = userTextAccRef.current.trim();
    if (u) {
      setMessages(p => { if (p.slice(-3).some(m => m.role === "user" && m.text === u)) return p; return [...p, { role: "user", text: u, timestamp: Date.now() }]; });
      addSessionMessage("user", u);
    }

    saveConversation();
   // ★ 伴侣模式：记录语音交互（日记+记忆+关系状态）
    if (ai || u) {
      import("@/lib/trpc").then(({ trpc }) => {
        trpc.companion.recordVoiceInteraction.mutate({
          userMessage: (u || "").substring(0, 2000),
          aiResponse: (ai || "").substring(0, 5000),
        }).catch(() => {});
      }).catch(() => {});
    }

    if (directWsRef.current) { try { directWsRef.current.close(); } catch {} directWsRef.current = null; }
    if (socketRef.current?.connected) { socketRef.current.emit("live:stop"); }

    setStatus("idle"); cleanup();
    aiTextAccRef.current = ""; userTextAccRef.current = "";
    setUserTranscript(""); setAiTranscript("");
    setConnectionMode(null);
    setActiveProvider(null);
    // P3: 不清空 interruptionTracker — 保留恢复数据供下次 start() 使用
    setHasPendingRecovery(interruptionTrackerRef.current.hasPendingRecovery());
  }, [cleanup, setMessages, addSessionMessage, saveConversation]);

  // ── 卸载 ──
  useEffect(() => {
    return () => {
      cleanup();
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
      if (directWsRef.current) { try { directWsRef.current.close(); } catch {} }
      if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.disconnect(); socketRef.current = null; }
      interruptionTrackerRef.current.clear();
    };
  }, []);

  return {
    status, aiSpeaking, interrupted, userTranscript, aiTranscript,
    micStream, elapsedSeconds, connectionMode, activeProvider, availableProviders,
    emotionState, hasPendingRecovery,
    start, stop,
  };
}
