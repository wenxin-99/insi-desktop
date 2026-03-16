/**
 * PressToTalkButton — 长按语音输入（全面升级版）
 *
 * 拆分自原 593 行单文件。子模块：
 *   pressToTalk/WaveCanvas.tsx      - 波形可视化 canvas
 *   pressToTalk/RecordingOverlay.tsx - 录音中全屏覆盖 UI
 *
 * 自动降级链：Realtime WebSocket (PCM) → Binary HTTP → Base64 HTTP（最终兜底）
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { Mic, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useTranslation } from "react-i18next";
import { useRealtimeSTT, type STTMode } from "@/hooks/useRealtimeSTT";
import { RecordingOverlay } from "./pressToTalk/RecordingOverlay";

interface PressToTalkButtonProps {
  onTranscribed: (text: string) => void;
  onInterimResult?: (text: string) => void;
  disabled?: boolean;
  language?: string;
  packageId?: number;
}

type RecordState = "idle" | "recording" | "cancel-zone" | "processing";

const CANCEL_THRESHOLD = 80;
const VAD_SILENCE_MS = 1800;
const VAD_THRESHOLD = 0.015;

export function PressToTalkButton({
  onTranscribed, onInterimResult, disabled, language = "zh", packageId,
}: PressToTalkButtonProps) {
  const { t } = useTranslation();
  const [state, setState] = useState<RecordState>("idle");
  const [duration, setDuration] = useState(0);
  const [dragY, setDragY] = useState(0);
  const [audioStream, setAudioStream] = useState<MediaStream>();

  const stateRef = useRef<RecordState>("idle");
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const durationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startYRef = useRef(0);
  const isHoldingRef = useRef(false);
  const sttModeRef = useRef<STTMode>("connecting");
  const realtimeStartedRef = useRef(false);

  // ★ 用 ref 保存回调 prop，确保 recorder.onstop / handleHTTPFallback 等闭包始终调用最新版本
  const onTranscribedRef = useRef(onTranscribed);
  const onInterimResultRef = useRef(onInterimResult);
  onTranscribedRef.current = onTranscribed;
  onInterimResultRef.current = onInterimResult;

  // VAD refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const vadTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastSoundTimeRef = useRef(Date.now());

  // PCM 实时采集 refs
  const pcmContextRef = useRef<AudioContext | null>(null);
  const pcmProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmBufferRef = useRef<ArrayBuffer[]>([]);

  const transcribeMutation = trpc.ai.transcribeVoiceInput.useMutation();

  const realtimeSTT = useRealtimeSTT({
    language,
    onInterim: (text) => onInterimResultRef.current?.(text),
    onFinal: (text) => { if (text?.trim()) onTranscribedRef.current(text); setStateBoth("idle"); },
    onError: (message) => {
      console.warn("[PressToTalk] Realtime STT error:", message);
      if (stateRef.current === "recording" || stateRef.current === "processing") handleHTTPFallback();
    },
    onModeChange: (mode) => { sttModeRef.current = mode; },
  });

  const setStateBoth = (s: RecordState) => { stateRef.current = s; setState(s); };

  // ★ 安全关闭 AudioContext（防止 already-closed Promise 错误）
  const safeCloseAudioCtx = (ctx: AudioContext | null) => {
    if (!ctx) return;
    try { if (ctx.state !== "closed") ctx.close().catch(() => {}); } catch {}
  };

  // ═══ 释放资源 ═══
  const killStream = useCallback(() => {
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    setAudioStream(undefined);
    if (pcmProcessorRef.current) { try { pcmProcessorRef.current.disconnect(); } catch {} pcmProcessorRef.current = null; }
    // ★ 先取出引用再置空，防止 cleanup effect 也操作同一个对象
    const pcmCtx = pcmContextRef.current; pcmContextRef.current = null;
    safeCloseAudioCtx(pcmCtx);
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }
    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null; }
    const audioCtx = audioContextRef.current; audioContextRef.current = null;
    safeCloseAudioCtx(audioCtx);
    analyserRef.current = null;
  }, []);

  useEffect(() => () => {
    if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop());
    if (durationTimerRef.current) clearInterval(durationTimerRef.current);
    if (vadTimerRef.current) clearInterval(vadTimerRef.current);
    // ★ 取出后置空，避免 killStream 并发双重关闭
    const ac = audioContextRef.current; audioContextRef.current = null;
    safeCloseAudioCtx(ac);
    if (pcmProcessorRef.current) { try { pcmProcessorRef.current.disconnect(); } catch {} pcmProcessorRef.current = null; }
    const pc = pcmContextRef.current; pcmContextRef.current = null;
    safeCloseAudioCtx(pc);
  }, []);

  // ═══ VAD 静音检测 ═══
  const setupVAD = useCallback((stream: MediaStream) => {
    try {
      const ac = new AudioContext();
      audioContextRef.current = ac;
      const src = ac.createMediaStreamSource(stream);
      const analyser = ac.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      src.connect(analyser);
      analyserRef.current = analyser;
      const data = new Float32Array(analyser.fftSize);
      lastSoundTimeRef.current = Date.now();
      vadTimerRef.current = setInterval(() => {
        if (stateRef.current !== "recording") return;
        analyser.getFloatTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) sum += data[i] * data[i];
        const rms = Math.sqrt(sum / data.length);
        if (rms > VAD_THRESHOLD) lastSoundTimeRef.current = Date.now();
        else if (Date.now() - lastSoundTimeRef.current > VAD_SILENCE_MS) {
          console.log("[PressToTalk] VAD: silence detected, auto-stopping");
          stopRecording();
        }
      }, 150);
    } catch (e) { console.warn("[PressToTalk] VAD setup failed:", e); }
  }, []);

  // ═══ HTTP 二进制上传回退 ═══
  const handleHTTPFallback = useCallback(async () => {
    const chunks = [...audioChunksRef.current];
    const actualMime = mediaRecorderRef.current?.mimeType || "audio/webm";
    killStream();
    if (stateRef.current === "cancel-zone") { setStateBoth("idle"); setDragY(0); return; }
    setStateBoth("processing"); setDragY(0);
    const blob = new Blob(chunks, { type: actualMime });
    if (blob.size < 1000) { setStateBoth("idle"); return; }
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const result = await transcribeMutation.mutateAsync({ audioData: reader.result as string, language, packageId });
        if (result.text?.trim()) onTranscribedRef.current(result.text);
      } catch (err: any) { toast.error(err.message || t("chat.voiceInputDetails.failed")); }
      finally { setStateBoth("idle"); }
    };
    reader.onerror = () => setStateBoth("idle");
    reader.readAsDataURL(blob);
  }, [killStream, language, packageId, t, transcribeMutation]);

  // ═══ 开始录音 ═══
  const startRecording = useCallback(async (startY: number) => {
    if (disabled || stateRef.current !== "idle" || isHoldingRef.current) return;
    isHoldingRef.current = true;
    startYRef.current = startY;
    setDragY(0); setDuration(0);
    audioChunksRef.current = [];
    realtimeStartedRef.current = false;
    pcmBufferRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 },
      });
      streamRef.current = stream;
      if (!isHoldingRef.current) { stream.getTracks().forEach(t => t.stop()); streamRef.current = null; return; }
      setAudioStream(stream);

      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus") ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      const realtimeOk = realtimeSTT.startSession(mimeType, packageId);

      // PCM 采集
      if (realtimeOk) {
        try {
          const pcmCtx = new AudioContext({ sampleRate: 16000 });
          pcmContextRef.current = pcmCtx;
          const src = pcmCtx.createMediaStreamSource(stream);
          const processor = pcmCtx.createScriptProcessor(4096, 1, 1);
          pcmProcessorRef.current = processor;
          processor.onaudioprocess = (ev) => {
            if (stateRef.current !== "recording") return;
            const f32 = ev.inputBuffer.getChannelData(0);
            const i16 = new Int16Array(f32.length);
            for (let i = 0; i < f32.length; i++) i16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767)));
            if (realtimeStartedRef.current) realtimeSTT.sendChunk(i16.buffer);
            else pcmBufferRef.current.push(i16.buffer.slice(0));
          };
          src.connect(processor);
          processor.connect(pcmCtx.destination);
        } catch (e) { console.warn("[PressToTalk] PCM capture setup failed:", e); }
      }

      recorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };

      recorder.onstop = async () => {
        if (stateRef.current === "cancel-zone") { killStream(); setStateBoth("idle"); setDragY(0); if (realtimeOk) realtimeSTT.cancelSession(); return; }
        if (realtimeOk && realtimeStartedRef.current) {
          realtimeSTT.stopSession(); setStateBoth("processing"); setDragY(0); killStream();
          setTimeout(() => { if (stateRef.current === "processing") handleHTTPFallback(); }, 5000);
        } else { handleHTTPFallback(); }
      };

      if (realtimeOk) {
        const checkReady = setInterval(() => {
          if (realtimeSTT.isReadyRef.current) {
            realtimeStartedRef.current = true; clearInterval(checkReady);
            for (const buf of pcmBufferRef.current) realtimeSTT.sendChunk(buf);
            pcmBufferRef.current = [];
          }
          if (stateRef.current !== "recording") clearInterval(checkReady);
        }, 100);
        setTimeout(() => clearInterval(checkReady), 2000);
      }

      recorder.start(250);
      setStateBoth("recording");
      durationTimerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
      setupVAD(stream);
    } catch (err: any) {
      console.error("[PressToTalk] Failed to start:", err);
      toast.error(t("chat.voiceInputDetails.microphoneError"));
      isHoldingRef.current = false;
      setStateBoth("idle");
    }
  }, [disabled, killStream, language, packageId, t, realtimeSTT, handleHTTPFallback, setupVAD]);

  const stopRecording = useCallback(() => {
    if (!mediaRecorderRef.current || !["recording", "cancel-zone"].includes(stateRef.current)) return;
    isHoldingRef.current = false;
    if (durationTimerRef.current) { clearInterval(durationTimerRef.current); durationTimerRef.current = null; }
    if (vadTimerRef.current) { clearInterval(vadTimerRef.current); vadTimerRef.current = null; }
    mediaRecorderRef.current.stop();
  }, []);

  const cancelRecording = useCallback(() => { setStateBoth("cancel-zone"); stopRecording(); }, [stopRecording]);

  const handleMove = useCallback((clientY: number) => {
    if (!["recording", "cancel-zone"].includes(stateRef.current)) return;
    const dy = Math.max(0, startYRef.current - clientY);
    setDragY(dy);
    setStateBoth(dy >= CANCEL_THRESHOLD ? "cancel-zone" : "recording");
  }, []);

  // ═══ Event handlers ═══
  const onPtrDown = useCallback((e: React.PointerEvent) => { e.preventDefault(); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); startRecording(e.clientY); }, [startRecording]);
  const onPtrMove = useCallback((e: React.PointerEvent) => { handleMove(e.clientY); }, [handleMove]);
  const onPtrUp = useCallback((e: React.PointerEvent) => { e.preventDefault(); try { (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId); } catch {} stopRecording(); }, [stopRecording]);
  const onTouchStart = useCallback((e: React.TouchEvent) => { e.preventDefault(); startRecording(e.touches[0].clientY); }, [startRecording]);
  const onTouchMove = useCallback((e: React.TouchEvent) => { e.preventDefault(); handleMove(e.touches[0].clientY); }, [handleMove]);
  const onTouchEnd = useCallback((e: React.TouchEvent) => { e.preventDefault(); stopRecording(); }, [stopRecording]);
  const onKeyDown = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === " " || e.key === "Enter") && stateRef.current === "idle") { e.preventDefault(); startRecording(0); }
    if (e.key === "Escape" && stateRef.current !== "idle") cancelRecording();
  }, [startRecording, cancelRecording]);
  const onKeyUp = useCallback((e: React.KeyboardEvent) => {
    if ((e.key === " " || e.key === "Enter") && stateRef.current === "recording") { e.preventDefault(); stopRecording(); }
  }, [stopRecording]);

  const isRecording = state === "recording" || state === "cancel-zone";
  const isProcessing = state === "processing";
  const inactive = disabled || isProcessing;

  return (
    <div className="relative select-none" style={{ WebkitUserSelect: "none" } as React.CSSProperties}>
      <div
        role="button"
        tabIndex={inactive ? -1 : 0}
        aria-label={t("chat.voiceInputDetails.pressToTalk")}
        aria-pressed={isRecording}
        className={[
          "flex items-center justify-center w-9 h-9 rounded-full transition-all duration-100 outline-none",
          "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          inactive ? "opacity-40 cursor-not-allowed"
            : isRecording ? "scale-125 bg-red-500/15 ring-2 ring-red-500/50 cursor-pointer"
            : "hover:bg-accent cursor-pointer",
        ].join(" ")}
        style={{ touchAction: "none" }}
        onPointerDown={inactive ? undefined : onPtrDown}
        onPointerMove={inactive ? undefined : onPtrMove}
        onPointerUp={inactive ? undefined : onPtrUp}
        onPointerCancel={inactive ? undefined : onPtrUp}
        onTouchStart={inactive ? undefined : onTouchStart}
        onTouchMove={inactive ? undefined : onTouchMove}
        onTouchEnd={inactive ? undefined : onTouchEnd}
        onKeyDown={inactive ? undefined : onKeyDown}
        onKeyUp={inactive ? undefined : onKeyUp}
      >
        {isProcessing
          ? <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          : <Mic className={`h-5 w-5 transition-colors duration-100 ${isRecording ? "text-red-500" : "text-muted-foreground"}`} />}
      </div>

      {isRecording && (
        <RecordingOverlay
          state={state as "recording" | "cancel-zone"}
          duration={duration}
          dragY={dragY}
          audioStream={audioStream}
          isRealtimeActive={realtimeStartedRef.current}
        />
      )}
    </div>
  );
}
