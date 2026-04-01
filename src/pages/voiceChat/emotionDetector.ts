/**
 * emotionDetector.ts — 音频级情绪检测器
 *
 * 通过分析麦克风音频的声学特征来推断用户情绪状态：
 *   - 基频 (pitch)：高亢 → 兴奋/焦虑，低沉 → 悲伤/疲倦
 *   - 能量 (energy)：响亮 → 激动，轻柔 → 低落/平静
 *   - 语速 (speech rate)：快 → 焦虑/兴奋，慢 → 悲伤/疲倦/犹豫
 *   - 能量变化率 (energy variance)：波动大 → 情绪激动
 *
 * 输出 EmotionState，前端可据此调整 UI 指示器，
 * 并将情绪上下文注入 system prompt 让 AI 做出共情回应。
 *
 * 架构说明：
 *   GPT-4o 的情绪感知是模型原生的，音频 token 直接携带语调信息。
 *   我们的架构是 API 代理，无法修改上游模型。因此采用"旁路分析"：
 *   前端独立分析音频特征 → 将结论作为隐式上下文注入 prompt。
 *   这不如原生方案精确，但能覆盖 80% 的场景。
 */

export type EmotionLabel =
  | "neutral"   // 平静
  | "happy"     // 开心/愉快
  | "sad"       // 低落/悲伤
  | "anxious"   // 焦虑/紧张
  | "excited"   // 兴奋/激动
  | "tired"     // 疲倦/无精打采
  | "angry";    // 生气/愤怒

export interface EmotionState {
  /** 主情绪标签 */
  label: EmotionLabel;
  /** 置信度 0-1 */
  confidence: number;
  /** 声学特征快照 */
  features: AudioFeatures;
  /** 时间戳 */
  timestamp: number;
}

export interface AudioFeatures {
  /** 估计基频 Hz（0 = 检测失败） */
  pitchHz: number;
  /** RMS 能量 0-255 */
  energy: number;
  /** 能量变化率（标准差） */
  energyVariance: number;
  /** 估算语速指标：VAD 活跃帧占比 0-1 */
  speechDensity: number;
  /** 基频是否在升高趋势 */
  pitchRising: boolean;
}

export interface EmotionDetectorHandle {
  stop: () => void;
  getState: () => EmotionState;
  /** 获取用于注入 prompt 的情绪描述文本 */
  getEmotionContext: () => string;
}

interface EmotionDetectorOptions {
  /** 分析间隔 ms，默认 500 */
  intervalMs?: number;
  /** 回调：情绪变化时触发 */
  onEmotionChange?: (state: EmotionState) => void;
}

// ═══════════ 基频检测（自相关法） ═══════════

function estimatePitch(timeDomainData: Float32Array, sampleRate: number): number {
  // 归一化自相关法（NSDF）估计基频
  const SIZE = timeDomainData.length;
  const MAX_SAMPLES = Math.floor(SIZE / 2);

  // 先计算信号能量，太弱则跳过（静音/噪声）
  let signalEnergy = 0;
  for (let i = 0; i < MAX_SAMPLES; i++) {
    signalEnergy += timeDomainData[i] * timeDomainData[i];
  }
  if (signalEnergy / MAX_SAMPLES < 0.001) return 0; // 信号太弱

  let bestOffset = -1;
  let bestCorrelation = 0;
  let foundGoodCorrelation = false;

  // 人声基频范围 85Hz - 500Hz
  const minPeriod = Math.floor(sampleRate / 500);
  const maxPeriod = Math.floor(sampleRate / 85);

  for (let offset = minPeriod; offset < Math.min(maxPeriod, MAX_SAMPLES); offset++) {
    // NSDF: 用归一化因子消除信号幅度影响
    let numerator = 0;
    let denominator = 0;
    for (let i = 0; i < MAX_SAMPLES - offset; i++) {
      numerator += timeDomainData[i] * timeDomainData[i + offset];
      denominator += timeDomainData[i] * timeDomainData[i] +
                     timeDomainData[i + offset] * timeDomainData[i + offset];
    }
    const correlation = denominator > 0 ? 2 * numerator / denominator : 0;

    if (correlation > 0.6 && correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestOffset = offset;
      foundGoodCorrelation = true;
    } else if (foundGoodCorrelation && correlation < bestCorrelation * 0.8) {
      break; // 找到第一个峰后下降，停止
    }
  }

  if (bestOffset === -1 || bestCorrelation < 0.4) return 0;
  return sampleRate / bestOffset;
}

// ═══════════ 情绪推理规则引擎 ═══════════

function inferEmotion(features: AudioFeatures, history: AudioFeatures[]): { label: EmotionLabel; confidence: number } {
  const { pitchHz, energy, energyVariance, speechDensity, pitchRising } = features;

  // 没有有效语音信号
  if (energy < 8 || speechDensity < 0.1) {
    return { label: "neutral", confidence: 0.3 };
  }

  // 计算基线（取历史的中位数）
  const baseEnergy = history.length > 3
    ? median(history.map(h => h.energy))
    : 40;
  const basePitch = history.length > 3
    ? median(history.filter(h => h.pitchHz > 0).map(h => h.pitchHz))
    : 180;

  const energyRatio = baseEnergy > 0 ? energy / baseEnergy : 1;
  const pitchRatio = basePitch > 0 && pitchHz > 0 ? pitchHz / basePitch : 1;

  // 规则评分
  const scores: Record<EmotionLabel, number> = {
    neutral: 0.3,
    happy: 0,
    sad: 0,
    anxious: 0,
    excited: 0,
    tired: 0,
    angry: 0,
  };

  // 高能量 + 高音调 + 快语速 → 兴奋
  if (energyRatio > 1.4 && pitchRatio > 1.2 && speechDensity > 0.6) {
    scores.excited += 0.7;
  }
  // 高能量 + 音调适中偏高 + 语速快 → 开心
  if (energyRatio > 1.1 && pitchRatio > 1.05 && pitchRatio < 1.3 && speechDensity > 0.5) {
    scores.happy += 0.5;
  }
  // 低能量 + 低音调 + 慢语速 → 悲伤
  if (energyRatio < 0.7 && pitchRatio < 0.9 && speechDensity < 0.4) {
    scores.sad += 0.6;
  }
  // 低能量 + 极慢语速 → 疲倦
  if (energyRatio < 0.6 && speechDensity < 0.3) {
    scores.tired += 0.5;
  }
  // 高能量波动 + 音调快速变化 + 快语速 → 焦虑
  if (energyVariance > 30 && speechDensity > 0.5 && pitchRising) {
    scores.anxious += 0.6;
  }
  // 高能量 + 语速偏快 + 能量波动大 → 生气
  if (energyRatio > 1.5 && energyVariance > 35 && speechDensity > 0.5) {
    scores.angry += 0.5;
  }

  // 取最高分
  let bestLabel: EmotionLabel = "neutral";
  let bestScore = scores.neutral;
  for (const [label, score] of Object.entries(scores) as [EmotionLabel, number][]) {
    if (score > bestScore) {
      bestLabel = label;
      bestScore = score;
    }
  }

  return { label: bestLabel, confidence: Math.min(1, bestScore) };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

// ═══════════ 情绪 → prompt 上下文映射 ═══════════

const EMOTION_CONTEXT_MAP: Record<EmotionLabel, string> = {
  neutral: "",
  happy: "[用户当前情绪：愉快/开心。语调轻快，可以配合积极的语气回应]",
  sad: "[用户当前情绪：低落/悲伤。语调低沉缓慢，请用温和关怀的语气回应，先表达理解再回答问题，不要说'加油'之类的话]",
  anxious: "[用户当前情绪：焦虑/紧张。语速较快且不稳定，请用平静沉稳的语气回应，帮助缓解焦虑]",
  excited: "[用户当前情绪：兴奋/激动。语调高亢有力，可以配合热情的语气回应]",
  tired: "[用户当前情绪：疲倦/无精打采。语调低沉且慢，请简洁回答，不要太啰嗦，表达体谅]",
  angry: "[用户当前情绪：生气/不满。语调强烈，请保持冷静和耐心，先认可情绪再回应内容]",
};

// ═══════════ 主入口 ═══════════

export function startEmotionDetector(
  stream: MediaStream,
  options?: EmotionDetectorOptions,
): EmotionDetectorHandle {
  const intervalMs = options?.intervalMs ?? 500;

  let audioContext: AudioContext | null = null;
  let analyser: AnalyserNode | null = null;
  let source: MediaStreamAudioSourceNode | null = null;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  let stopped = false;

  // 滑动窗口：最近 20 帧特征（约 10 秒）
  const featureHistory: AudioFeatures[] = [];
  const MAX_HISTORY = 20;
  let prevPitches: number[] = [];

  let currentState: EmotionState = {
    label: "neutral",
    confidence: 0.3,
    features: { pitchHz: 0, energy: 0, energyVariance: 0, speechDensity: 0, pitchRising: false },
    timestamp: Date.now(),
  };

  // 能量环形缓冲（用于计算方差）
  const energyBuffer: number[] = [];
  const ENERGY_BUF_SIZE = 10;

  // VAD 帧计数（用于语速估算）— 使用 EMA 避免跳变
  let speechDensityEma = 0;
  const VAD_THRESHOLD = 15;
  const SPEECH_EMA_ALPHA = 0.05; // ~20帧=10秒衰减常数

  // ★ P10: 情绪变化防抖
  let lastEmotionChangeTime = 0;
  const EMOTION_DEBOUNCE_MS = 2000;

  try {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.5;

    source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);

    const freqData = new Uint8Array(analyser.frequencyBinCount);
    const timeData = new Float32Array(analyser.fftSize);

    intervalId = setInterval(() => {
      if (stopped || !analyser) return;

      // 频域数据 → 能量
      analyser.getByteFrequencyData(freqData);
      let sum = 0;
      for (let i = 0; i < freqData.length; i++) {
        sum += freqData[i] * freqData[i];
      }
      const energy = Math.sqrt(sum / freqData.length);

      // 时域数据 → 基频
      analyser.getFloatTimeDomainData(timeData);
      const pitchHz = estimatePitch(timeData, audioContext!.sampleRate);

      // 更新缓冲
      energyBuffer.push(energy);
      if (energyBuffer.length > ENERGY_BUF_SIZE) energyBuffer.shift();

      // 能量方差
      const avgEnergy = energyBuffer.reduce((a, b) => a + b, 0) / energyBuffer.length;
      const energyVariance = Math.sqrt(
        energyBuffer.reduce((a, b) => a + (b - avgEnergy) ** 2, 0) / energyBuffer.length
      );

      // VAD 活跃度（EMA 平滑，无跳变）
      const isActive = energy > VAD_THRESHOLD ? 1 : 0;
      speechDensityEma = SPEECH_EMA_ALPHA * isActive + (1 - SPEECH_EMA_ALPHA) * speechDensityEma;
      const speechDensity = speechDensityEma;

      // 基频趋势
      if (pitchHz > 0) prevPitches.push(pitchHz);
      if (prevPitches.length > 6) prevPitches.shift();
      const pitchRising = prevPitches.length >= 3 &&
        prevPitches[prevPitches.length - 1] > prevPitches[0] * 1.1;

      const features: AudioFeatures = {
        pitchHz, energy, energyVariance, speechDensity, pitchRising,
      };

      // 推理情绪
      const { label, confidence } = inferEmotion(features, featureHistory);

      // 更新历史
      featureHistory.push(features);
      if (featureHistory.length > MAX_HISTORY) featureHistory.shift();

      // 平滑：只在置信度足够高且情绪确实变化时才更新（含防抖）
      const prevLabel = currentState.label;
      const now = Date.now();
      if (label !== prevLabel && confidence > 0.45 && (now - lastEmotionChangeTime) > EMOTION_DEBOUNCE_MS) {
        lastEmotionChangeTime = now;
        currentState = { label, confidence, features, timestamp: now };
        options?.onEmotionChange?.(currentState);
        console.log(`[Emotion] ${prevLabel} → ${label} (confidence: ${confidence.toFixed(2)}, pitch: ${pitchHz.toFixed(0)}Hz, energy: ${energy.toFixed(0)}, density: ${speechDensity.toFixed(2)})`);
      } else {
        // 更新特征但不触发回调
        currentState = { ...currentState, features, timestamp: now };
      }
    }, intervalMs);

    console.log(`[Emotion] Detector started, interval=${intervalMs}ms`);
  } catch (err) {
    console.error("[Emotion] Failed to start:", err);
  }

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      if (intervalId) clearInterval(intervalId);
      if (source) try { source.disconnect(); } catch {}
      if (audioContext) audioContext.close().catch(() => {});
      console.log("[Emotion] Detector stopped");
    },
    getState: () => currentState,
    getEmotionContext: () => {
      if (currentState.confidence < 0.4) return "";
      return EMOTION_CONTEXT_MAP[currentState.label] || "";
    },
  };
}
