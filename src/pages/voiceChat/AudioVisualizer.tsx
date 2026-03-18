/**
 * AudioVisualizer — 圆形波形可视化组件
 * 从 VoiceChat.tsx 拆分
 */
import { useRef, useEffect } from "react";

interface AudioVisualizerProps {
  isActive: boolean;
  audioStream?: MediaStream;
  color?: string;
}

export function AudioVisualizer({ isActive, audioStream, color = "#3b82f6" }: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = canvas.offsetWidth * dpr;
    canvas.height = canvas.offsetHeight * dpr;
    ctx.scale(dpr, dpr);

    if (isActive && audioStream) {
      const audioContext = new AudioContext();
      const source = audioContext.createMediaStreamSource(audioStream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);

        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        ctx.clearRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.25;

        const bars = 64;
        for (let i = 0; i < bars; i++) {
          const dataIndex = Math.floor((i / bars) * bufferLength);
          const value = dataArray[dataIndex] / 255;
          const angle = (i / bars) * Math.PI * 2 - Math.PI / 2;
          const barHeight = value * baseRadius * 0.8 + 2;

          const x1 = centerX + Math.cos(angle) * baseRadius;
          const y1 = centerY + Math.sin(angle) * baseRadius;
          const x2 = centerX + Math.cos(angle) * (baseRadius + barHeight);
          const y2 = centerY + Math.sin(angle) * (baseRadius + barHeight);

          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.4 + value * 0.6;
          ctx.lineWidth = 2.5;
          ctx.lineCap = "round";
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.6, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 0.6);
        gradient.addColorStop(0, `${color}40`);
        gradient.addColorStop(1, `${color}10`);
        ctx.fillStyle = gradient;
        ctx.fill();
      };

      draw();
      return () => { cancelAnimationFrame(animationRef.current); audioContext.close(); };
    } else {
      let phase = 0;
      const drawIdle = () => {
        animationRef.current = requestAnimationFrame(drawIdle);
        phase += 0.02;

        const width = canvas.offsetWidth;
        const height = canvas.offsetHeight;
        ctx.clearRect(0, 0, width, height);

        const centerX = width / 2;
        const centerY = height / 2;
        const baseRadius = Math.min(width, height) * 0.25;

        for (let i = 0; i < 3; i++) {
          const pulseRadius = baseRadius * (0.5 + 0.1 * Math.sin(phase + i * 0.5));
          ctx.beginPath();
          ctx.arc(centerX, centerY, pulseRadius + i * 8, 0, Math.PI * 2);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.15 - i * 0.04;
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }

        ctx.beginPath();
        ctx.arc(centerX, centerY, baseRadius * 0.4, 0, Math.PI * 2);
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, baseRadius * 0.4);
        gradient.addColorStop(0, `${color}20`);
        gradient.addColorStop(1, `${color}08`);
        ctx.fillStyle = gradient;
        ctx.fill();
      };

      drawIdle();
      return () => { cancelAnimationFrame(animationRef.current); };
    }
  }, [isActive, audioStream, color]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
