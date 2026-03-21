/**
 * pcmAudio — PCM 音频采集和播放工具
 *
 * Gemini Live API 规格：
 *   输入：PCM 16-bit 16kHz LE (mono)
 *   输出：PCM 16-bit 24kHz LE (mono)
 */

// ═══════════ PCM 采集（麦克风 → 16kHz PCM） ═══════════

export interface PCMCaptureHandle {
  stop: () => void;
  stream: MediaStream;
}

/**
 * 启动麦克风 PCM 采集
 * @param onChunk 每 ~100ms 回调一次 PCM 16-bit 16kHz ArrayBuffer
 * @returns 控制句柄
 */
export async function startPCMCapture(
  onChunk: (pcmData: ArrayBuffer) => void,
): Promise<PCMCaptureHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      channelCount: 1,
      sampleRate: 16000,
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  });

  const audioCtx = new AudioContext({ sampleRate: 16000 });
  const source = audioCtx.createMediaStreamSource(stream);

  // 使用 ScriptProcessorNode（广泛兼容）
  // bufferSize=4096 ≈ 256ms @16kHz — 平衡延迟与效率
  const processor = audioCtx.createScriptProcessor(4096, 1, 1);

  processor.onaudioprocess = (e) => {
    const float32 = e.inputBuffer.getChannelData(0);
    // Float32 → Int16 PCM
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }
    onChunk(int16.buffer);
  };

  source.connect(processor);
  processor.connect(audioCtx.destination); // 必须连接到 destination 才能触发 onaudioprocess

  const stop = () => {
    try { processor.disconnect(); } catch {}
    try { source.disconnect(); } catch {}
    try { audioCtx.close(); } catch {}
    stream.getTracks().forEach(t => t.stop());
  };

  return { stop, stream };
}

// ═══════════ PCM 播放（24kHz PCM → 扬声器） ═══════════

export class PCMPlayer {
  private audioCtx: AudioContext;
  private nextStartTime = 0;
  private isPlaying = false;
  private gainNode: GainNode;
  private scheduledSources: AudioBufferSourceNode[] = [];

  constructor() {
    this.audioCtx = new AudioContext({ sampleRate: 24000 });
    this.gainNode = this.audioCtx.createGain();
    this.gainNode.connect(this.audioCtx.destination);
  }

  /**
   * 排队播放 PCM 16-bit 24kHz LE 音频块
   * Gemini 会连续发多个小 chunk，自动拼接无缝播放
   */
  enqueue(pcmData: ArrayBuffer): void {
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }

    const int16 = new Int16Array(pcmData);
    if (int16.length === 0) return;

    // Int16 → Float32
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      float32[i] = int16[i] / 32768;
    }

    const audioBuffer = this.audioCtx.createBuffer(1, float32.length, 24000);
    audioBuffer.getChannelData(0).set(float32);

    const source = this.audioCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(this.gainNode);

    const startAt = Math.max(this.nextStartTime, this.audioCtx.currentTime + 0.01);
    source.start(startAt);
    this.nextStartTime = startAt + audioBuffer.duration;
    this.isPlaying = true;
    this.scheduledSources.push(source);

    // 清理已播放完的 source
    source.onended = () => {
      const idx = this.scheduledSources.indexOf(source);
      if (idx >= 0) this.scheduledSources.splice(idx, 1);
      if (this.scheduledSources.length === 0) {
        this.isPlaying = false;
      }
    };
  }

  /** 立即停止所有播放 */
  stop(): void {
    for (const source of this.scheduledSources) {
      try { source.stop(); } catch {}
    }
    this.scheduledSources = [];
    this.nextStartTime = 0;
    this.isPlaying = false;
  }

  /** 设置音量 (0-1) */
  setVolume(vol: number): void {
    this.gainNode.gain.value = Math.max(0, Math.min(1, vol));
  }

  /** 是否正在播放 */
  get playing(): boolean {
    return this.isPlaying;
  }

  /** 销毁 */
  destroy(): void {
    this.stop();
    this.audioCtx.close().catch(() => {});
  }
}
