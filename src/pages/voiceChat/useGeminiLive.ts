/**
 * useGeminiLive — Gemini Live API 实时语音对话 Hook
 *
 * P3: 双模式自动降级
 *   优先：前端 ← WebSocket 直连 → Gemini（ephemeral token，最低延迟）
 *   降级：前端 ← Socket.IO → 后端 → Gemini（P0 代理模式）
 *
 * 状态机：
 *   idle → connecting → listening (全双工) → idle
 */

import { useState, useRef, useCallback, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { startPCMCapture, PCMPlayer, type PCMCaptureHandle } from "./pcmAudio";
import type { VoiceMessage } from "./types";

export type LiveStatus = "idle" | "connecting" | "listening";
export type LiveProvider = "qwen-omni" | "gemini";
type ConnectionMode = "direct" | "proxy";

interface UseGeminiLiveParams {
  voicePackageId?: string;
  voice?: string;
  systemPrompt?: string;
  /** 指定 provider，不传则后端自动选择 */
  liveProvider?: LiveProvider;
  messages: VoiceMessage[];
  setMessages: React.Dispatch<React.SetStateAction<VoiceMessage[]>>;
  conversationId?: number;
  setConversationId?: (id: number | undefined) => void;
  onError?: (msg: string) => void;
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
  /** 当前实际使用的 provider */
  activeProvider: LiveProvider | null;
  /** 后端可用的 provider 列表 */
  availableProviders: LiveProvider[];
  start: () => void;
  stop: () => void;
}

export function useGeminiLive(params: UseGeminiLiveParams): UseGeminiLiveReturn {
  const {
    voicePackageId, voice, systemPrompt, liveProvider,
    messages, setMessages,
    conversationId, setConversationId,
    onError,
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

  useEffect(() => { statusRef.current = status; }, [status]);
  useEffect(() => { conversationIdRef.current = conversationId; }, [conversationId]);

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

  // ── 保存对话（REST API） ──
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
        console.log("[GeminiLive] Conversation saved via REST:", data.conversationId);
      }
    } catch (err) {
      console.error("[GeminiLive] Save failed:", err);
    }
  }, [setConversationId]);

  // ── 处理 turn complete（两种模式通用） ──
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
  }, [setMessages, addSessionMessage]);

  // ── 清理 ──
  const cleanup = useCallback(() => {
    if (captureRef.current) { captureRef.current.stop(); captureRef.current = null; }
    if (playerRef.current) playerRef.current.stop();
    if (directWsRef.current) {
      try { directWsRef.current.close(); } catch {}
      directWsRef.current = null;
    }
    stopTimer();
    setMicStream(undefined);
    setAiSpeaking(false);
    setInterrupted(false);
  }, [stopTimer]);

  // ═══════════ Direct WebSocket 模式 ═══════════

  const startDirect = useCallback(async (wsUrl: string) => {
    console.log("[GeminiLive] Starting direct WebSocket mode");
    setConnectionMode("direct");

    const ws = new WebSocket(wsUrl);
    directWsRef.current = ws;

    ws.onopen = () => {
      console.log("[GeminiLive] Direct WS connected, config locked by ephemeral token");
      // Ephemeral token 已锁定 config，不需要发 setup message
      // 等待 setupComplete
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);

        if (msg.setupComplete) {
          console.log("[GeminiLive] Direct session ready");
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
          }
          if (sc.outputTranscription?.text) {
            aiTextAccRef.current += sc.outputTranscription.text;
            setAiTranscript(aiTextAccRef.current);
          }
          if (sc.interrupted) {
            if (playerRef.current) playerRef.current.stop();
            setAiSpeaking(false);
            setInterrupted(true);
            setTimeout(() => setInterrupted(false), 1500);
          }
          if (sc.turnComplete) handleTurnComplete();
        }
      } catch (err) {
        console.error("[GeminiLive] Direct WS parse error:", err);
      }
    };

    ws.onerror = () => {
      console.error("[GeminiLive] Direct WS error");
      onError?.("实时连接出错");
      setStatus("idle"); cleanup();
    };

    ws.onclose = (e) => {
      if (statusRef.current !== "idle") {
        console.log(`[GeminiLive] Direct WS closed: code=${e.code}`);
        setStatus("idle"); cleanup();
      }
    };
  }, [startTimer, handleTurnComplete, cleanup, onError]);

  // ═══════════ Socket.IO Proxy 模式（P0/P1 降级） ═══════════

  const startProxy = useCallback(async (prompt: string) => {
    console.log("[GeminiLive] Falling back to Socket.IO proxy mode");
    setConnectionMode("proxy");

    if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.disconnect(); }

    const socket = io({ path: "/socket.io", transports: ["websocket", "polling"], reconnection: false, timeout: 10000 });
    socketRef.current = socket;

    socket.on("connect_error", (err) => { onError?.("连接失败"); setStatus("idle"); cleanup(); });
    socket.on("live:ready", () => { setStatus("listening"); startTimer(); });
    socket.on("live:audio", (data: ArrayBuffer) => {
      if (!playerRef.current) playerRef.current = new PCMPlayer();
      playerRef.current.enqueue(data);
      setAiSpeaking(true); setInterrupted(false);
    });
    socket.on("live:transcript", (data: { type: "input" | "output"; text: string }) => {
      if (data.type === "input") { userTextAccRef.current += data.text; setUserTranscript(userTextAccRef.current); }
      else { aiTextAccRef.current += data.text; setAiTranscript(aiTextAccRef.current); }
    });
    socket.on("live:interrupted", () => {
      if (playerRef.current) playerRef.current.stop();
      setAiSpeaking(false); setInterrupted(true);
      setTimeout(() => setInterrupted(false), 1500);
    });
    socket.on("live:turn_complete", handleTurnComplete);
    socket.on("live:error", (data: { message: string }) => { onError?.(data.message); setStatus("idle"); cleanup(); });
    socket.on("live:ended", () => { setStatus("idle"); cleanup(); });

    // ★ 后端通知当前 provider 和可用列表
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

    socket.emit("live:start", {
      voicePackageId,
      voice,
      systemPrompt: prompt || undefined,
      provider: liveProvider, // ★ 传给后端
    });
  }, [voicePackageId, voice, liveProvider, startTimer, handleTurnComplete, cleanup, onError]);

  // ═══════════ 开始（自动选择模式） ═══════════

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
        // Direct mode
        if (directWsRef.current?.readyState === WebSocket.OPEN) {
          const base64 = btoa(String.fromCharCode(...new Uint8Array(pcmData)));
          directWsRef.current.send(JSON.stringify({
            realtimeInput: { audio: { data: base64, mimeType: "audio/pcm;rate=16000" } },
          }));
          return;
        }
        // Proxy mode
        if (socketRef.current?.connected) {
          socketRef.current.emit("live:audio", pcmData);
        }
      });
      captureRef.current = capture;
      setMicStream(capture.stream);
      if (!playerRef.current) playerRef.current = new PCMPlayer();

      // 2. 构建 prompt
      let prompt = systemPrompt || "";
      if (messages.length > 0) {
        const ctx = messages.slice(-6).map(m => `${m.role === "user" ? "用户" : "助手"}: ${m.text}`).join("\n");
        prompt = (prompt ? prompt + "\n\n" : "") + `之前的对话上下文：\n${ctx}`;
      }

      // 3. 尝试获取 ephemeral token
      const token = localStorage.getItem("auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let useDirect = false;
      try {
        const resp = await fetch("/api/voice-live/token", {
          method: "POST", headers, credentials: "include",
          body: JSON.stringify({ voicePackageId, systemPrompt: prompt }),
        });

        // ★ 402/401 是计费/认证错误，不应降级到 proxy（proxy 也会失败）
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
        // 计费/认证错误直接抛出，不降级
        if (e.message?.includes("余额") || e.message?.includes("登录")) {
          throw e;
        }
        console.warn("[GeminiLive] Ephemeral token request failed, using proxy:", e);
      }

      // 4. 降级到 Socket.IO 代理（仅连接问题时）
      if (!useDirect) {
        await startProxy(prompt);
      }

    } catch (err: any) {
      console.error("[GeminiLive] Start failed:", err);
      onError?.(err.message || "启动失败");
      setStatus("idle"); cleanup();
    }
  }, [voicePackageId, voice, systemPrompt, messages, startDirect, startProxy, cleanup, onError]);

  // ═══════════ 结束 ═══════════

  const stop = useCallback(() => {
    // 保存未完成的转录
    const ai = aiTextAccRef.current.trim();
    if (ai) { setMessages(p => [...p, { role: "assistant", text: ai, timestamp: Date.now() }]); addSessionMessage("assistant", ai); }
    const u = userTextAccRef.current.trim();
    if (u) {
      setMessages(p => { if (p.slice(-3).some(m => m.role === "user" && m.text === u)) return p; return [...p, { role: "user", text: u, timestamp: Date.now() }]; });
      addSessionMessage("user", u);
    }

    // 保存到 DB（REST API，不依赖 Socket.IO）
    saveConversation();

    // 关闭连接
    if (directWsRef.current) { try { directWsRef.current.close(); } catch {} directWsRef.current = null; }
    if (socketRef.current?.connected) { socketRef.current.emit("live:stop"); }

    setStatus("idle"); cleanup();
    aiTextAccRef.current = ""; userTextAccRef.current = "";
    setUserTranscript(""); setAiTranscript("");
    setConnectionMode(null);
    setActiveProvider(null);
  }, [cleanup, setMessages, addSessionMessage, saveConversation]);

  // ── 卸载 ──
  useEffect(() => {
    return () => {
      cleanup();
      if (playerRef.current) { playerRef.current.destroy(); playerRef.current = null; }
      if (directWsRef.current) { try { directWsRef.current.close(); } catch {} }
      if (socketRef.current) { socketRef.current.removeAllListeners(); socketRef.current.disconnect(); socketRef.current = null; }
    };
  }, []);

  return { status, aiSpeaking, interrupted, userTranscript, aiTranscript, micStream, elapsedSeconds, connectionMode, activeProvider, availableProviders, start, stop };
}
