/**
 * SimpleTTSPlayer — TTS 播放器
 * 从 VoiceChat.tsx 拆分而来
 */

// 句子边界检测
export const SENTENCE_PUNCTUATIONS = /[.,!?;:。，！？；：、\n]/;
// 最小批次字符数
export const MIN_BATCH_LENGTH = 5;

export
class SimpleTTSPlayer {
  private isStopped = false;
  private onDone: () => void;
  private authHeaders: Record<string, string>;
  private audioContext: AudioContext;   // 外部传入的共享 AudioContext（已解锁）
  private currentSource: AudioBufferSourceNode | null = null;
  private abortController: AbortController | null = null;
  public voice: string = "";
  public ttsProvider: string = "";  // ★ 套餐指定的 TTS 服务商（覆盖全局）

  constructor(onDone: () => void, authHeaders: Record<string, string>, audioContext: AudioContext, voice?: string, ttsProvider?: string) {
    this.onDone = onDone;
    this.authHeaders = authHeaders;
    this.audioContext = audioContext;
    if (voice) this.voice = voice;
    if (ttsProvider) this.ttsProvider = ttsProvider;

    // ★ 移动端关键：监听 AudioContext 状态变化，自动恢复
    // iOS/Android 按音量键、锁屏、切 App 都会 suspend AudioContext
    this._handleStateChange = () => {
      if (this.isStopped) return;
      if (this.audioContext.state === 'interrupted' || this.audioContext.state === 'suspended') {
        console.log('[TTS] AudioContext suspended/interrupted, attempting resume...');
        this.audioContext.resume().then(() => {
          console.log('[TTS] AudioContext resumed successfully, state:', this.audioContext.state);
        }).catch(() => {});
      }
    };
    this.audioContext.addEventListener('statechange', this._handleStateChange);

    // ★ 页面可见性变化时恢复（移动端从后台切回前台）
    this._handleVisibility = () => {
      if (this.isStopped) return;
      if (document.visibilityState === 'visible' && this.audioContext.state !== 'running') {
        console.log('[TTS] Page visible, resuming AudioContext...');
        this.audioContext.resume().catch(() => {});
      }
    };
    document.addEventListener('visibilitychange', this._handleVisibility);
  }

  private _handleStateChange: (() => void) | null = null;
  private _handleVisibility: (() => void) | null = null;

  private nextStartTime = 0;
  private pendingCount = 0;
  private queueFinished = false;
  private speechQueue: string[] = [];   // 串行TTS队列
  private isSpeakingSerial = false;     // 是否正在串行朗读

  /** 串行消费 speechQueue，一句说完再说下一句，防止 SpeechSynthesis 并发 onend 丢失 */
  private drainSpeechQueue(): void {
    if (this.isSpeakingSerial || this.speechQueue.length === 0 || this.isStopped) return;
    this.isSpeakingSerial = true;
    const text = this.speechQueue.shift()!;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'zh-CN';
    utterance.rate = 1.05;
    utterance.pitch = 1.0;

    const voices = window.speechSynthesis.getVoices();
    const zhVoice = voices.find(v => (v.lang === 'zh-CN' || v.lang === 'zh_CN') && v.localService)
      || voices.find(v => v.lang.startsWith('zh'));
    if (zhVoice) utterance.voice = zhVoice;

    const onFinish = () => {
      this.isSpeakingSerial = false;
      if (!this.isStopped) {
        this.pendingCount--;
        this.checkAllDone();
        // 继续播下一句
        this.drainSpeechQueue();
      }
    };

    utterance.onend = onFinish;
    utterance.onerror = (e) => {
      console.warn('[TTS] SpeechSynthesis error:', e.error);
      onFinish();
    };

    // Watchdog：如果 30 秒后 onend 还没触发（Chrome bug），强制推进
    const watchdog = setTimeout(() => {
      console.warn('[TTS] SpeechSynthesis watchdog triggered');
      if (this.isSpeakingSerial) onFinish();
    }, 30000);
    utterance.onend = () => { clearTimeout(watchdog); onFinish(); };
    utterance.onerror = (e) => { clearTimeout(watchdog); console.warn('[TTS] error:', e.error); onFinish(); };

    window.speechSynthesis.speak(utterance);
  }

  /** 排队播放一个句子 - 优先用服务器TTS（音质更好），浏览器SpeechSynthesis仅降级 */
  // 并行 fetch + 顺序调度：
  // - fetch 立即并发发出（减少等待），每句话拿到自己的 fetchPromise
  // - scheduleChain 保证按原始顺序往 AudioContext 里排队播放
  private scheduleChain: Promise<void> = Promise.resolve();

  speakQueued(text: string): void {
    if (this.isStopped || !text.trim()) return;
    this.pendingCount++;

    this.abortController = this.abortController || new AbortController();

    // 立刻并发发起 fetch，不等前面的句子
    const fetchPromise: Promise<AudioBuffer | null> = (async () => {
      try {
        // 确保 AudioContext 处于运行状态
        if (this.audioContext.state === 'suspended') {
          await this.audioContext.resume();
          console.log('[TTS] AudioContext resumed in speakQueued, state:', this.audioContext.state);
        }
        if (this.audioContext.state !== 'running') {
          console.warn('[TTS] AudioContext state is', this.audioContext.state, '- audio may not play');
        }
        const response = await fetch('/api/tts/synthesize', {
          method: 'POST',
          headers: this.authHeaders,
          credentials: 'include',
          body: JSON.stringify({
            text: text.trim(),
            voice: this.voice || undefined,
            ttsProvider: this.ttsProvider || undefined,
          }),
          signal: this.abortController!.signal,
        });
        if (this.isStopped || !response.ok) {
          if (!response.ok) console.warn(`[TTS] HTTP ${response.status} for "${text.trim().substring(0, 20)}"`);
          return null;
        }
        const arrayBuffer = await response.arrayBuffer();
        if (this.isStopped || arrayBuffer.byteLength === 0) return null;
        console.log(`[TTS] Decoding audio: ${arrayBuffer.byteLength} bytes, ctx state: ${this.audioContext.state}`);
        return await this.audioContext.decodeAudioData(arrayBuffer.slice(0));
      } catch (err: any) {
        if (err.name !== 'AbortError') console.warn('[TTS] fetch/decode failed:', err.message);
        return null;
      }
    })();

    // scheduleChain 保证按调用顺序依次把音频排入 AudioContext
    this.scheduleChain = this.scheduleChain.then(async () => {
      try {
        const audioBuffer = await fetchPromise; // 等这句话自己的 fetch 完成
        if (this.isStopped) return;

        // ★ 服务端 TTS 失败 → 降级到浏览器内置 SpeechSynthesis
        if (!audioBuffer) {
          if (window.speechSynthesis) {
            console.log(`[TTS] Server failed, falling back to browser SpeechSynthesis for: "${text.substring(0, 30)}"`);
            await this._browserSpeak(text);
          }
          return;
        }

        // ★ 播放前确保 AudioContext 处于 running 状态（移动端可能被系统 suspend）
        if (this.audioContext.state !== 'running') {
          try {
            await this.audioContext.resume();
            // 等一小段时间让音频管道恢复
            await new Promise(r => setTimeout(r, 50));
          } catch {}
        }

        const source = this.audioContext!.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioContext!.destination);
        const startAt = Math.max(this.nextStartTime, this.audioContext!.currentTime);
        source.start(startAt);
        this.nextStartTime = startAt + audioBuffer.duration;
        this.currentSource = source;
      } finally {
        this.pendingCount--;
        this.checkAllDone();
      }
    });
  }

  /** 标记队列结束（流式读取完毕后调用） */
  finishQueue(): void {
    this.queueFinished = true;
    this.checkAllDone();
  }

  private checkAllDone(): void {
    if (!this.queueFinished || this.pendingCount > 0 || this.isStopped) return;
    if (this.nextStartTime === 0) {
      setTimeout(() => { if (!this.isStopped) this.onDone(); }, 300);
      return;
    }
    // 服务器TTS：等AudioContext排队时间用完
    const remaining = Math.max(0, this.nextStartTime - this.audioContext.currentTime) * 1000;
    setTimeout(() => { if (!this.isStopped) this.onDone(); }, remaining + 200);
  }

  /** ★ T8-1: 暂停状态 */
  private _isPaused = false;

  /** ★ T8-1: 暂停播放（用户打断时调用）— 挂起 AudioContext 时间线 */
  async pause(): Promise<void> {
    if (this.isStopped || this._isPaused) return;
    this._isPaused = true;
    try {
      if (this.audioContext.state === 'running') {
        await this.audioContext.suspend();
        console.log('[TTS] Paused (AudioContext suspended)');
      }
    } catch (e) {
      console.warn('[TTS] Pause failed:', e);
    }
  }

  /** ★ T8-1: 恢复播放（用户只是短暂噪音时调用） */
  async resume(): Promise<void> {
    if (this.isStopped || !this._isPaused) return;
    this._isPaused = false;
    try {
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
        console.log('[TTS] Resumed (AudioContext running)');
      }
    } catch (e) {
      console.warn('[TTS] Resume failed:', e);
    }
  }

  /** ★ T8-1: 当前是否暂停 */
  get paused(): boolean {
    return this._isPaused;
  }

  /** 合成并播放文本（原有单次调用方式，保留兼容） */
  async speak(text: string): Promise<void> {
    if (this.isStopped || !text.trim()) {
      this.onDone();
      return;
    }
    // 按句分割，逐句排队播放
    const sentences = text.split(/(?<=[。！？.!?\n])/).map(s => s.trim()).filter(s => s.length > 1);
    if (sentences.length === 0) { this.onDone(); return; }
    for (const s of sentences) this.speakQueued(s);
    this.finishQueue();
    return Promise.resolve();
  }

  /** 浏览器内置语音合成作为备选（Promise 版，用于 scheduleChain 串行等待） */
  private _browserSpeak(text: string): Promise<void> {
    return new Promise<void>((resolve) => {
      if (this.isStopped || !window.speechSynthesis) { resolve(); return; }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 1.05;
      utterance.pitch = 1.0;

      const voices = window.speechSynthesis.getVoices();
      const zhVoice = voices.find(v => (v.lang === 'zh-CN' || v.lang === 'zh_CN') && v.localService)
        || voices.find(v => v.lang.startsWith('zh'));
      if (zhVoice) utterance.voice = zhVoice;

      const watchdog = setTimeout(() => {
        console.warn('[TTS] Browser SpeechSynthesis watchdog triggered');
        resolve();
      }, 30000);

      utterance.onend = () => { clearTimeout(watchdog); resolve(); };
      utterance.onerror = (e) => { clearTimeout(watchdog); console.warn('[TTS] Browser fallback error:', e.error); resolve(); };

      window.speechSynthesis.speak(utterance);
    });
  }

  /** 浏览器内置语音合成作为备选 */
  private fallbackSpeak(text: string) {
    if (this.isStopped) {
      this.onDone();
      return;
    }

    if (!window.speechSynthesis) {
      console.warn("[TTS] No browser SpeechSynthesis available");
      this.onDone();
      return;
    }

    console.log("[TTS] Using browser SpeechSynthesis fallback");
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "zh-CN";
    utterance.rate = 1.1;

    utterance.onend = () => {
      if (!this.isStopped) {
        this.onDone();
      }
    };

    utterance.onerror = () => {
      console.error("[TTS] Browser SpeechSynthesis also failed");
      this.onDone();
    };

    window.speechSynthesis.speak(utterance);
  }

  /** 停止播放 */
  stop() {
    console.log("[TTS] Stopping...");
    this.isStopped = true;
    this._isPaused = false;

    // 中止fetch
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }

    // 停止Web Audio
    if (this.currentSource) {
      try { this.currentSource.stop(); } catch {}
      this.currentSource = null;
    }

    // 清空串行队列，重置链
    this.speechQueue = [];
    this.isSpeakingSerial = false;
    this.scheduleChain = Promise.resolve();
    this.nextStartTime = 0;
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    // ★ 清理事件监听器
    if (this._handleStateChange) {
      this.audioContext.removeEventListener('statechange', this._handleStateChange);
      this._handleStateChange = null;
    }
    if (this._handleVisibility) {
      document.removeEventListener('visibilitychange', this._handleVisibility);
      this._handleVisibility = null;
    }

    // 注意：audioContext 是共享的，不在这里关闭
  }

  get stopped() {
    return this.isStopped;
  }
}



/** 移除 Markdown 标记，仅保留纯文本用于 TTS */
export function stripMarkdownForTts(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')         // 移除代码块
    .replace(/`[^`]*`/g, '')                 // 移除行内代码
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')    // 移除图片
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接保留文字
    .replace(/^#{1,6}\s*/gm, '')             // 移除标题符号
    .replace(/\*{2,3}([^*]+)\*{2,3}/g, '$1') // **粗体**、***粗斜*** → 纯文本
    .replace(/\*([^*\n]+)\*/g, '$1')         // *斜体* → 纯文本
    .replace(/_{2,3}([^_]+)_{2,3}/g, '$1')   // __下划线__
    .replace(/_([^_\n]+)_/g, '$1')           // _斜体_
    .replace(/~~([^~]+)~~/g, '$1')           // ~~删除线~~
    .replace(/<br\s*\/?>/gi, '')              // 移除 <br>
    .replace(/<[^>]+>/g, '')                  // 移除 HTML 标签
    .replace(/^[\s]*[-*+]\s+/gm, '')         // 移除 ASCII 列表符号 -, *, +
    .replace(/[•◦▪▸►▹▻●○◆◇→⇒➤➜✓✔✗✘☐☑]/g, '') // 移除 Unicode 项目符号
    .replace(/^[\s]*>\s*/gm, '')             // 移除引用符号
    .replace(/^[\s]*\d+\.\s+/gm, '')        // 移除有序列表
    .replace(/^[-*_]{3,}\s*$/gm, '')         // 移除分隔线 ---, ***, ___
    .replace(/[|]/g, '')                      // 移除表格分隔符
    .replace(/\s+/g, ' ')                     // 合并多余空格
    .trim();
}
