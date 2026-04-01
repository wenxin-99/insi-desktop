/**
 * PCM AudioWorklet Processor
 * 
 * 将浏览器采集的 Float32 音频转换为 16-bit PCM (16kHz mono)
 * 用于 Gemini Live API 流式 STT
 * 
 * 使用方法：
 *   await audioContext.audioWorklet.addModule('/pcm-processor.js');
 *   const pcmNode = new AudioWorkletNode(audioContext, 'pcm-processor');
 *   source.connect(pcmNode);
 *   pcmNode.port.onmessage = (e) => { sendChunk(e.data); };
 */

class PCMProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._buffer = [];
    // 48kHz → 16kHz 需要每 3 个采样取 1 个
    this._downsampleRatio = Math.round(sampleRate / 16000);
  }

  process(inputs) {
    const input = inputs[0]?.[0]; // mono channel
    if (!input || input.length === 0) return true;

    // 降采样 + Float32 → Int16
    const outputLen = Math.floor(input.length / this._downsampleRatio);
    const pcm = new Int16Array(outputLen);
    
    for (let i = 0; i < outputLen; i++) {
      const sample = input[i * this._downsampleRatio];
      // 限幅并转换
      pcm[i] = Math.max(-32768, Math.min(32767, Math.round(sample * 32767)));
    }

    this.port.postMessage(pcm.buffer, [pcm.buffer]);
    return true;
  }
}

registerProcessor('pcm-processor', PCMProcessor);
