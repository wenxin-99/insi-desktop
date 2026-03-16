import { useEffect, useRef } from 'react';

interface VoiceWaveformProps {
  isRecording: boolean;
  audioStream?: MediaStream;
}

export function VoiceWaveform({ isRecording, audioStream }: VoiceWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | undefined>(undefined);
  const audioCtxRef = useRef<AudioContext | undefined>(undefined);

  useEffect(() => {
    if (!isRecording || !audioStream || !canvasRef.current) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      return;
    }

    // 检查 stream 是否有活跃且启用的音轨
    const tracks = audioStream.getAudioTracks();
    if (tracks.length === 0 || tracks[0].readyState !== 'live') {
      console.warn('[VoiceWaveform] No live audio tracks available');
      return;
    }

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let cancelled = false;

    // 创建音频分析器
    const audioContext = new AudioContext();
    audioCtxRef.current = audioContext;

    // ★ Chrome 桌面端 AudioContext 默认 suspended，必须 resume 才能拿到数据
    const setupAnalyser = async () => {
      if (audioContext.state === 'suspended') {
        try {
          await audioContext.resume();
          console.log('[VoiceWaveform] AudioContext resumed from suspended');
        } catch (e) {
          console.warn('[VoiceWaveform] Failed to resume AudioContext:', e);
        }
      }

      if (cancelled) return;

      const source = audioContext.createMediaStreamSource(audioStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      // 设置canvas尺寸
      const dpr = window.devicePixelRatio || 1;
      canvas.width = canvas.offsetWidth * dpr;
      canvas.height = canvas.offsetHeight * dpr;
      ctx.scale(dpr, dpr);

      const draw = () => {
        if (cancelled) return;

        analyser.getByteFrequencyData(dataArray);

        // 清空画布
        ctx.clearRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);

        // 绘制波形
        const barWidth = canvas.offsetWidth / bufferLength;
        const centerY = canvas.offsetHeight / 2;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * (canvas.offsetHeight * 0.8);
          const x = i * barWidth;

          const gradient = ctx.createLinearGradient(0, centerY - barHeight / 2, 0, centerY + barHeight / 2);
          gradient.addColorStop(0, '#3b82f6');
          gradient.addColorStop(1, 'rgba(59, 130, 246, 0.5)');

          ctx.fillStyle = gradient;
          ctx.fillRect(x, centerY - barHeight / 2, barWidth - 1, barHeight);
        }

        animationRef.current = requestAnimationFrame(draw);
      };

      draw();
    };

    setupAnalyser();

    return () => {
      cancelled = true;
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      if (audioContext.state !== 'closed') {
        audioContext.close().catch(() => {});
      }
      audioCtxRef.current = undefined;
    };
  }, [isRecording, audioStream]);

  if (!isRecording) return null;

  return (
    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
      <canvas
        ref={canvasRef}
        className="w-full h-16 opacity-30"
        style={{ maxWidth: '300px' }}
      />
    </div>
  );
}
