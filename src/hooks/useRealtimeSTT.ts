/**
 * useRealtimeSTT — 实时语音识别 Hook
 *
 * ★ 修复：
 *   1. startSession 接受 packageId 参数，传递给服务端
 *   2. 新增 isReadyRef，供 PressToTalkButton 的 setInterval 安全读取（避免闭包陷阱）
 *   3. sendChunk 用 ref 而非 state，确保闭包内读到最新值
 *   4. 每次 startSession 重置 mode，防止卡死在 http-fallback
 */

import { useRef, useCallback, useState, useEffect } from 'react';
import { io, Socket } from 'socket.io-client';

export type STTMode = 'realtime' | 'http-fallback' | 'connecting';

interface UseRealtimeSTTOptions {
  language?: string;
  onInterim?: (text: string) => void;
  onFinal?: (text: string) => void;
  onError?: (message: string) => void;
  onModeChange?: (mode: STTMode) => void;
}

export function useRealtimeSTT(options: UseRealtimeSTTOptions) {
  const { language = 'zh', onInterim, onFinal, onError, onModeChange } = options;
  const socketRef = useRef<Socket | null>(null);
  const [mode, setMode] = useState<STTMode>('connecting');
  const [isReady, setIsReady] = useState(false);
  const isReadyRef = useRef(false);  // ★ ref 版本，供 setInterval/闭包安全读取
  const modeRef = useRef<STTMode>('connecting');

  // ★ 用 ref 保存回调，避免 socket 事件监听器闭包捕获过期回调
  const onInterimRef = useRef(onInterim);
  const onFinalRef = useRef(onFinal);
  const onErrorRef = useRef(onError);
  const onModeChangeRef = useRef(onModeChange);
  onInterimRef.current = onInterim;
  onFinalRef.current = onFinal;
  onErrorRef.current = onError;
  onModeChangeRef.current = onModeChange;

  const updateMode = useCallback((m: STTMode) => {
    modeRef.current = m;
    setMode(m);
    onModeChangeRef.current?.(m);
  }, []);

  // ═══ 预连接 Socket.IO（Stage 3: 预热） ═══
  const ensureSocket = useCallback((): Socket => {
    if (socketRef.current?.connected) return socketRef.current;

    // 断开旧连接
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }

    const socket = io({
      path: '/socket.io',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 3,
      reconnectionDelay: 500,
      timeout: 5000,
    });

    socket.on('connect', () => {
      console.log('[RealtimeSTT] Socket connected:', socket.id);
    });

    socket.on('connect_error', (err) => {
      console.warn('[RealtimeSTT] Socket connect error:', err.message);
      updateMode('http-fallback');
    });

    // ★ STT 事件监听 — 通过 ref 间接调用，始终使用最新回调
    socket.on('stt:ready', () => {
      console.log('[RealtimeSTT] FunASR ready, can send audio');
      isReadyRef.current = true;
      setIsReady(true);
      updateMode('realtime');
    });

    socket.on('stt:interim', (data: { text: string; isFinal: boolean }) => {
      onInterimRef.current?.(data.text);
    });

    socket.on('stt:final', (data: { text: string }) => {
      console.log('[RealtimeSTT] Final result:', data.text?.substring(0, 50));
      onFinalRef.current?.(data.text);
      isReadyRef.current = false;
      setIsReady(false);
    });

    socket.on('stt:error', (data: { message: string; provider?: string }) => {
      console.warn('[RealtimeSTT] STT error:', data.message);
      if (data.message === 'FALLBACK_HTTP') {
        updateMode('http-fallback');
      } else {
        onErrorRef.current?.(data.message);
      }
      isReadyRef.current = false;
      setIsReady(false);
    });

    socketRef.current = socket;
    return socket;
  }, [updateMode]);

  // 页面加载时预连接
  useEffect(() => {
    // 延迟 2 秒预连接，不阻塞页面加载
    const timer = setTimeout(() => {
      ensureSocket();
    }, 2000);
    return () => {
      clearTimeout(timer);
      if (socketRef.current) {
        socketRef.current.removeAllListeners();
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  // ═══ 开始实时识别会话 ═══
  // ★ 新增 packageId 参数
  const startSession = useCallback((mimeType: string, packageId?: number) => {
    const socket = ensureSocket();
    if (!socket.connected) {
      updateMode('http-fallback');
      return false;
    }
    setIsReady(false);
    isReadyRef.current = false;
    // ★ 每次开始新会话时重置模式，允许重新尝试流式
    updateMode('connecting');
    socket.emit('stt:start', { language, mimeType, packageId });
    console.log(`[RealtimeSTT] stt:start emitted, mimeType=${mimeType}, packageId=${packageId}`);
    return true;
  }, [ensureSocket, language, updateMode]);

  // ═══ 发送音频块 ═══
  const sendChunk = useCallback((audioData: ArrayBuffer) => {
    if (!socketRef.current?.connected || !isReadyRef.current) return;
    socketRef.current.emit('stt:chunk', audioData);
  }, []);  // ★ 无依赖 — 用 ref 读取最新值，不受闭包影响

  // ═══ 结束录音 ═══
  const stopSession = useCallback(() => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('stt:stop');
    console.log('[RealtimeSTT] stt:stop emitted');
  }, []);

  // ═══ 取消 ═══
  const cancelSession = useCallback(() => {
    if (!socketRef.current?.connected) return;
    socketRef.current.emit('stt:cancel');
    isReadyRef.current = false;
    setIsReady(false);
  }, []);

  return {
    mode: modeRef.current,
    isReady,
    isReadyRef,  // ★ 暴露 ref，供 PressToTalkButton 的 setInterval 安全读取
    startSession,
    sendChunk,
    stopSession,
    cancelSession,
  };
}
