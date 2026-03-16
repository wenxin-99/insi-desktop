/**
 * pressToTalk/WaveCanvas — 录音波形可视化
 * 从 PressToTalkButton.tsx 第 509-593 行提取
 */
import { useRef, useEffect } from "react";

interface WaveCanvasProps {
  stream?: MediaStream;
  active: boolean;
}

const W = 180, H = 44, BARS = 30, GAP = 2;

export function WaveCanvas({ stream, active }: WaveCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // 有音频流时：实时频谱
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !stream || !active) return;
    const tracks = stream.getAudioTracks();
    if (!tracks.length || tracks[0].readyState !== "live") return;

    let cancelled = false;
    let raf: number;
    const ac = new AudioContext();

    const setup = async () => {
      if (ac.state === "suspended") await ac.resume();
      if (cancelled) return;
      const src = ac.createMediaStreamSource(stream);
      const an = ac.createAnalyser();
      an.fftSize = 128;
      an.smoothingTimeConstant = 0.8;
      src.connect(an);

      const dpr = window.devicePixelRatio || 1;
      canvas.width = W * dpr;
      canvas.height = H * dpr;
      const ctx = canvas.getContext("2d")!;
      ctx.scale(dpr, dpr);

      const data = new Uint8Array(an.frequencyBinCount);
      const bw = (W - GAP * (BARS - 1)) / BARS;
      const cy = H / 2;

      const draw = () => {
        if (cancelled) return;
        an.getByteFrequencyData(data);
        ctx.clearRect(0, 0, W, H);
        for (let i = 0; i < BARS; i++) {
          const v = data[Math.floor((i / BARS) * data.length)] / 255;
          const bh = Math.max(3, v * H * 0.85);
          const x = i * (bw + GAP);
          ctx.fillStyle = `rgba(239,68,68,${0.4 + v * 0.6})`;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(x, cy - bh / 2, bw, bh, bw / 2);
          else ctx.rect(x, cy - bh / 2, bw, bh);
          ctx.fill();
        }
        raf = requestAnimationFrame(draw);
      };
      draw();
    };
    setup().catch(() => {});
    return () => { cancelled = true; cancelAnimationFrame(raf); if (ac.state !== "closed") ac.close(); };
  }, [stream, active]);

  // 无音频流时：idle 动画
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || stream || !active) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(dpr, dpr);
    const bw = (W - GAP * (BARS - 1)) / BARS;
    const cy = H / 2;
    let t = 0;
    let raf: number;
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      for (let i = 0; i < BARS; i++) {
        const v = 0.15 + 0.1 * Math.sin(t * 2 + i * 0.5);
        const bh = v * H;
        const x = i * (bw + GAP);
        ctx.fillStyle = `rgba(239,68,68,0.35)`;
        ctx.beginPath();
        if (ctx.roundRect) ctx.roundRect(x, cy - bh / 2, bw, bh, bw / 2);
        else ctx.rect(x, cy - bh / 2, bw, bh);
        ctx.fill();
      }
      t += 0.05;
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [stream, active]);

  return <canvas ref={canvasRef} style={{ width: W, height: H, display: "block" }} />;
}
