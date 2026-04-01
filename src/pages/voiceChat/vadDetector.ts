/**
 * vadDetector.ts — Voice Activity Detection (VAD) 检测器
 *
 * ★ T8-1: 在 AI TTS 播放期间检测用户是否开始说话（打断 AI）
 *
 * ★ 优化版（降低误触发率）：
 *   1. 语音频段滤波 — 只分析 300Hz-3000Hz（人声核心频段），忽略空调/风扇低频噪音和键盘/碰撞高频
 *   2. 自适应噪声基底 — 持续追踪环境噪音水平，阈值 = max(固定阈值, 噪声基底 × 倍率)
 *   3. 更保守的触发条件 — 默认需要 6 帧（300ms）持续语音才触发打断
 *   4. aboveCount 衰减而非清零 — 说话中的短暂气息停顿不会重置计数
 */

export interface VADOptions {
  /** 固定音量阈值（0-255 RMS），默认 40 */
  threshold?: number;
  /** 连续超过阈值多少帧才算开始说话，默认 6（约 300ms） */
  speechStartFrames?: number;
  /** 连续低于阈值多少帧才算停止说话，默认 15（约 750ms） */
  speechEndFrames?: number;
  /** 检测间隔（ms），默认 50 */
  intervalMs?: number;
  /** 噪声基底乘数：实际阈值 = max(threshold, noiseFloor × multiplier)，默认 2.5 */
  noiseMultiplier?: number;
  /** 语音频段下限（Hz），默认 300 */
  speechFreqLow?: number;
  /** 语音频段上限（Hz），默认 3000 */
  speechFreqHigh?: number;
}

export interface VADHandle {
  /** 停止 VAD 检测并释放资源 */
  stop: () => void;
  /** 当前是否检测到语音 */
  isSpeaking: () => boolean;
  /** 当前噪声基底（调试用） */
  getNoiseFloor: () => number;
}

/**
 * 启动 VAD 检测
 * @param stream 麦克风 MediaStream（可复用现有的）
 * @param onSpeechStart 检测到用户开始说话
 * @param onSpeechEnd 检测到用户停止说话
 */
export function startVAD(
  stream: MediaStream,
  onSpeechStart: () => void,
  onSpeechEnd: () => void,
  options?: VADOptions,
): VADHandle {
  const threshold = options?.threshold ?? 40;
  const speechStartFrames = options?.speechStartFrames ?? 6;
  const speechEndFrames = options?.speechEndFrames ?? 15;
  const intervalMs = options?.intervalMs ?? 50;
  const noiseMultiplier = options?.noiseMultiplier ?? 2.5;
  const speechFreqLow = options?.speechFreqLow ?? 300;
  const speechFreqHigh = options?.speechFreqHigh ?? 3000;

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let speaking = false;
  let aboveCount = 0;
  let belowCount = 0;
  let stopped = false;

  // ── 自适应噪声基底 ──
  // 滑动窗口追踪最近 N 帧的 RMS，取低位百分位作为噪声基底
  const NOISE_WINDOW = 60; // 60 帧 × 50ms = 3 秒滑动窗口
  const noiseHistory: number[] = [];
  let noiseFloor = 0;

  /** 更新噪声基底：取窗口内 30th percentile 作为 floor（排除语音帧的高能量值） */
  function updateNoiseFloor(rms: number) {
    noiseHistory.push(rms);
    if (noiseHistory.length > NOISE_WINDOW) noiseHistory.shift();

    const sorted = [...noiseHistory].sort((a, b) => a - b);
    const idx = Math.floor(sorted.length * 0.3);
    noiseFloor = sorted[idx] || 0;
  }

  try {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 1024; // 提高频率分辨率（原 512）
    analyser.smoothingTimeConstant = 0.4;

    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    const sampleRate = audioContext.sampleRate;

    // ── 计算语音频段对应的 FFT bin 范围 ──
    const binWidth = sampleRate / analyser.fftSize;
    const binLow = Math.max(1, Math.floor(speechFreqLow / binWidth));
    const binHigh = Math.min(analyser.frequencyBinCount - 1, Math.ceil(speechFreqHigh / binWidth));
    const speechBinCount = binHigh - binLow + 1;

    console.log(
      `[VAD] Speech band: ${speechFreqLow}-${speechFreqHigh}Hz → bins ${binLow}-${binHigh} ` +
      `(${speechBinCount} bins, binWidth=${binWidth.toFixed(1)}Hz, sampleRate=${sampleRate})`
    );

    intervalId = setInterval(() => {
      if (stopped || !analyser) return;

      analyser.getByteFrequencyData(dataArray);

      // ── 只计算语音频段（300-3000Hz）的 RMS ──
      let sum = 0;
      for (let i = binLow; i <= binHigh; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / speechBinCount);

      // 更新噪声基底
      updateNoiseFloor(rms);

      // ── 自适应阈值 = max(固定阈值, 噪声基底 × 倍率) ──
      const adaptiveThreshold = Math.max(threshold, noiseFloor * noiseMultiplier);

      if (rms > adaptiveThreshold) {
        aboveCount++;
        belowCount = 0;

        if (!speaking && aboveCount >= speechStartFrames) {
          speaking = true;
          console.log(
            `[VAD] Speech started (RMS=${rms.toFixed(1)}, adaptive=${adaptiveThreshold.toFixed(1)}, floor=${noiseFloor.toFixed(1)})`
          );
          onSpeechStart();
        }
      } else {
        belowCount++;
        // ★ 衰减而非清零：说话中的短暂气息/停顿不会完全重置 aboveCount
        // 连续 3 帧低于阈值才清零（容忍 150ms 的语音间隙）
        if (belowCount >= 3) aboveCount = 0;

        if (speaking && belowCount >= speechEndFrames) {
          speaking = false;
          console.log(`[VAD] Speech ended (silence ${belowCount} frames, floor=${noiseFloor.toFixed(1)})`);
          onSpeechEnd();
        }
      }
    }, intervalMs);

    console.log(
      `[VAD] Started: threshold=${threshold}, startFrames=${speechStartFrames}, ` +
      `interval=${intervalMs}ms, noiseMultiplier=${noiseMultiplier}`
    );
  } catch (err) {
    console.error('[VAD] Failed to start:', err);
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (intervalId) clearInterval(intervalId);
    if (source) { try { source.disconnect(); } catch {} }
    // VAD 创建了自己的 AudioContext，stop 时必须关闭
    if (audioContext) {
      audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
    source = null;
    console.log('[VAD] Stopped');
  };

  return {
    stop,
    isSpeaking: () => speaking,
    getNoiseFloor: () => noiseFloor,
  };
}
