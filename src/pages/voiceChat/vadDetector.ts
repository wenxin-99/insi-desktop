/**
 * vadDetector.ts — Voice Activity Detection (VAD) 检测器
 *
 * ★ T8-1: 在 AI TTS 播放期间检测用户是否开始说话（打断 AI）
 *
 * 使用 Web Audio API AnalyserNode 做实时音量检测：
 * - 当麦克风音量超过阈值且持续 N 帧 → 触发 onSpeechStart
 * - 当音量降回阈值以下且持续 M 帧 → 触发 onSpeechEnd
 *
 * 轻量级实现，无第三方依赖。
 */

export interface VADOptions {
  /** 音量阈值（0-255 RMS），默认 25 */
  threshold?: number;
  /** 连续超过阈值多少帧才算开始说话，默认 4（约 200ms） */
  speechStartFrames?: number;
  /** 连续低于阈值多少帧才算停止说话，默认 15（约 750ms） */
  speechEndFrames?: number;
  /** 检测间隔（ms），默认 50 */
  intervalMs?: number;
}

export interface VADHandle {
  /** 停止 VAD 检测并释放资源 */
  stop: () => void;
  /** 当前是否检测到语音 */
  isSpeaking: () => boolean;
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
  const threshold = options?.threshold ?? 25;
  const speechStartFrames = options?.speechStartFrames ?? 4;
  const speechEndFrames = options?.speechEndFrames ?? 15;
  const intervalMs = options?.intervalMs ?? 50;

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let speaking = false;
  let aboveCount = 0;
  let belowCount = 0;
  let stopped = false;

  try {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.3;

    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    intervalId = setInterval(() => {
      if (stopped || !analyser) return;

      analyser.getByteFrequencyData(dataArray);

      // 计算 RMS（均方根）作为音量指标
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i] * dataArray[i];
      }
      const rms = Math.sqrt(sum / dataArray.length);

      if (rms > threshold) {
        aboveCount++;
        belowCount = 0;

        if (!speaking && aboveCount >= speechStartFrames) {
          speaking = true;
          console.log(`[VAD] Speech started (RMS=${rms.toFixed(1)}, threshold=${threshold})`);
          onSpeechStart();
        }
      } else {
        belowCount++;
        aboveCount = 0;

        if (speaking && belowCount >= speechEndFrames) {
          speaking = false;
          console.log(`[VAD] Speech ended (silence ${belowCount} frames)`);
          onSpeechEnd();
        }
      }
    }, intervalMs);

    console.log(`[VAD] Started: threshold=${threshold}, interval=${intervalMs}ms`);
  } catch (err) {
    console.error('[VAD] Failed to start:', err);
  }

  const stop = () => {
    if (stopped) return;
    stopped = true;
    if (intervalId) clearInterval(intervalId);
    if (source) { try { source.disconnect(); } catch {} }
    // Fix #8: VAD 创建了自己的 AudioContext，stop 时必须关闭
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
  };
}
