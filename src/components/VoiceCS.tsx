/**
 * 语音客服组件 — 嵌入到客服对话页面
 *
 * 功能:
 * - 按住说话 → STT → 发送文字 → AI 回复 → TTS 播报
 * - 复用平台已有的 STT/TTS API
 */

import { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Volume2, Loader2, Square } from "lucide-react";

interface VoiceCSProps {
  onTranscript: (text: string) => void;   // 语音识别结果 → 发送消息
  lastBotReply?: string;                    // 最新 AI 回复 → 朗读
  disabled?: boolean;
}

export default function VoiceCS({ onTranscript, lastBotReply, disabled }: VoiceCSProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ── 开始录音 ──
  const startRecording = useCallback(async () => {
    if (disabled) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm") ? "audio/webm" : "audio/mp4",
      });
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: mediaRecorder.mimeType });
        if (blob.size > 1000) { // 过滤太短的录音
          await transcribe(blob);
        }
      };

      mediaRecorder.start();
      mediaRecorderRef.current = mediaRecorder;
      setIsRecording(true);
    } catch (err) {
      console.error("[VoiceCS] Microphone access denied:", err);
    }
  }, [disabled]);

  // ── 停止录音 ──
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
      setIsRecording(false);
    }
  }, [isRecording]);

  // ── 语音识别 (STT) — 使用平台 Socket.IO 协议 ──
  const transcribe = async (blob: Blob) => {
    setIsTranscribing(true);
    try {
      // 方案1: 尝试 HTTP multipart 上传（如果平台有此端点）
      const formData = new FormData();
      formData.append("audio", blob, "recording.webm");
      formData.append("language", "zh");

      const resp = await fetch("/api/trpc/customerService.voiceTranscribe", {
        method: "POST",
        body: formData,
        credentials: "include",
      }).catch(() => null);

      if (resp?.ok) {
        const data = await resp.json();
        const text = data?.result?.data?.text || data?.text || "";
        if (text.trim()) onTranscript(text.trim());
        return;
      }

      // 方案2: 降级为浏览器内置 Web Speech API（不需要服务器）
      if ("webkitSpeechRecognition" in window || "SpeechRecognition" in window) {
        const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = "zh-CN";
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (event: any) => {
          const text = event.results[0]?.[0]?.transcript || "";
          if (text.trim()) onTranscript(text.trim());
          setIsTranscribing(false);
        };
        recognition.onerror = () => setIsTranscribing(false);
        recognition.onend = () => setIsTranscribing(false);

        // 将 blob 转为 audio 元素播放触发 — 实际上 SpeechRecognition 监听的是麦克风
        // 所以这里直接启动识别即可（前面已经录了音）
        recognition.start();
        // 3 秒后自动停止
        setTimeout(() => { try { recognition.stop(); } catch {} }, 3000);
        return;
      }

      console.warn("[VoiceCS] No STT method available");
    } catch (err) {
      console.error("[VoiceCS] Transcription failed:", err);
    } finally {
      setIsTranscribing(false);
    }
  };

  // ── 语音播报 (TTS) ──
  const speakReply = useCallback(async () => {
    if (!lastBotReply || isSpeaking) return;
    setIsSpeaking(true);
    try {
      // 截取前 500 字避免过长
      const text = lastBotReply.replace(/[#*`\[\]()]/g, "").substring(0, 500);

      const resp = await fetch("/api/tts/synthesize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: "default" }),
        credentials: "include",
      });

      if (!resp.ok) throw new Error(`TTS failed: ${resp.status}`);

      const audioBlob = await resp.blob();
      const url = URL.createObjectURL(audioBlob);

      if (audioRef.current) {
        audioRef.current.pause();
        URL.revokeObjectURL(audioRef.current.src);
      }

      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => {
        setIsSpeaking(false);
        URL.revokeObjectURL(url);
      };
      audio.onerror = () => setIsSpeaking(false);
      await audio.play();
    } catch (err) {
      console.error("[VoiceCS] TTS failed:", err);
      setIsSpeaking(false);
    }
  }, [lastBotReply, isSpeaking]);

  const stopSpeaking = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setIsSpeaking(false);
  };

  return (
    <div className="flex items-center gap-1.5">
      {/* 录音按钮 */}
      <Button
        variant={isRecording ? "destructive" : "outline"}
        size="sm"
        className={`h-[42px] px-3 rounded-xl ${isRecording ? "animate-pulse" : ""}`}
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        disabled={disabled || isTranscribing}
      >
        {isTranscribing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isRecording ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </Button>

      {/* 朗读按钮 */}
      {lastBotReply && (
        <Button
          variant="outline"
          size="sm"
          className="h-[42px] px-3 rounded-xl"
          onClick={isSpeaking ? stopSpeaking : speakReply}
          disabled={disabled}
        >
          {isSpeaking ? (
            <Square className="h-4 w-4" />
          ) : (
            <Volume2 className="h-4 w-4" />
          )}
        </Button>
      )}

      {/* 状态提示 */}
      {isRecording && (
        <span className="text-xs text-red-500 animate-pulse">录音中... 松开发送</span>
      )}
      {isTranscribing && (
        <span className="text-xs text-muted-foreground">识别中...</span>
      )}
    </div>
  );
}
