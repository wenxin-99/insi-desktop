import { useRef, useCallback, useEffect } from 'react';

/**
 * 流式 TTS 钩子 — 分句边生成边播放
 *
 * 工作流程：
 * 1. 文字流式生成时，每收到 chunk 调用 feedChunk(text)
 * 2. 内部按标点分句（句号/逗号/分号等），每攒够一句立刻发 TTS 请求
 * 3. 多段音频排队（AudioQueue），前一段播完自动续播下一段
 * 4. 如果缓冲超时（600ms无新标点），自动flush当前内容
 * 5. 调用 flush() 处理最后剩余文字（流结束时）
 * 6. 调用 stop() 立即停止并清空队列
 */
/** 清理 markdown / HTML 标签，只保留纯文本用于 TTS */
function stripMarkdownForTts(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, '')         // 移除代码块
    .replace(/`[^`]*`/g, '')                 // 移除行内代码
    .replace(/!\[[^\]]*\]\([^)]+\)/g, '')    // 移除图片
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // 链接保留文字
    .replace(/#{1,6}\s*/g, '')               // 移除标题符号
    .replace(/\*{1,3}([^*]+)\*{1,3}/g, '$1') // **加粗** → 加粗
    .replace(/_{1,2}([^_]+)_{1,2}/g, '$1')   // __下划线__ → 下划线
    .replace(/~~([^~]+)~~/g, '$1')           // ~~删除线~~ → 删除线
    .replace(/<br\s*\/?>/gi, '')              // 移除 <br>
    .replace(/<[^>]+>/g, '')                  // 移除 HTML 标签
    .replace(/^[\s]*[-*+]\s+/gm, '')         // 移除列表符号
    .replace(/^[\s]*>\s*/gm, '')             // 移除引用符号
    .replace(/^[\s]*\d+\.\s+/gm, '')        // 移除有序列表
    .replace(/[|]/g, '')                      // 移除表格分隔符
    .replace(/^[-=]{3,}$/gm, '')             // 移除分隔线
    .replace(/[*#`~_]/g, '');                // 兜底
}

export function useStreamingTts() {
  const bufferRef = useRef('');
  const queueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const activeSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const enabledRef = useRef(false);
  const pendingRequestsRef = useRef(0);
  const autoFlushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const packageIdRef = useRef<number | null>(null);

  // 获取或创建 AudioContext，并确保处于 running 状态
  const getAudioCtx = useCallback(async () => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new AudioContext();
    }
    // 关键修复：AudioContext 在首次播放后可能进入 suspended 状态
    // 浏览器策略要求在用户手势后 resume，否则后续播放静音
    if (audioCtxRef.current.state === 'suspended') {
      try {
        await audioCtxRef.current.resume();
      } catch (e) {
        console.warn('[StreamingTTS] AudioContext resume failed:', e);
      }
    }
    return audioCtxRef.current;
  }, []);

  // 播放队列中的下一段
  const playNext = useCallback(async () => {
    if (queueRef.current.length === 0) {
      if (pendingRequestsRef.current === 0) {
        isPlayingRef.current = false;
      }
      return;
    }
    isPlayingRef.current = true;
    const buffer = queueRef.current.shift()!;
    const ctx = await getAudioCtx(); // 确保 resumed
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    activeSourceRef.current = source;
    source.onended = () => {
      activeSourceRef.current = null;
      playNext();
    };
    source.start();
  }, [getAudioCtx]);

  // 合成一个文字片段并加入队列（带并发控制）
  const MAX_CONCURRENT_TTS = 2;
  const synthesize = useCallback(async (text: string) => {
    // 清理 markdown 符号，避免 TTS 朗读出 **、##、``` 等
    const cleanText = stripMarkdownForTts(text).trim();
    if (!cleanText || !enabledRef.current) return;
    if (!abortRef.current || abortRef.current.signal.aborted) return;

    // 等待并发槽位
    while (pendingRequestsRef.current >= MAX_CONCURRENT_TTS) {
      await new Promise(r => setTimeout(r, 200));
      if (!enabledRef.current || !abortRef.current || abortRef.current.signal.aborted) return;
    }

    pendingRequestsRef.current += 1;
    try {
      const resp = await fetch('/api/tts/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ text: cleanText, packageId: packageIdRef.current ?? undefined }),
        signal: abortRef.current.signal,
      });
      if (!resp.ok) throw new Error(`TTS ${resp.status}`);

      const arrayBuf = await resp.arrayBuffer();
      const ctx = await getAudioCtx(); // 确保 resumed
      const audioBuf = await ctx.decodeAudioData(arrayBuf);
      queueRef.current.push(audioBuf);

      if (!isPlayingRef.current) {
        playNext();
      }
    } catch (e: any) {
      if (e?.name === 'AbortError') return;
      console.warn('[StreamingTTS] synthesize error:', e?.message);
    } finally {
      pendingRequestsRef.current -= 1;
      if (queueRef.current.length === 0 && pendingRequestsRef.current === 0 && !isPlayingRef.current) {
        isPlayingRef.current = false;
      }
    }
  }, [getAudioCtx, playNext]);

  // 清除自动flush定时器
  const clearAutoFlush = useCallback(() => {
    if (autoFlushTimerRef.current) {
      clearTimeout(autoFlushTimerRef.current);
      autoFlushTimerRef.current = null;
    }
  }, []);

  // 设置自动flush定时器（缓冲区有内容但长时间无标点时自动发送）
  const scheduleAutoFlush = useCallback(() => {
    clearAutoFlush();
    autoFlushTimerRef.current = setTimeout(() => {
      if (!enabledRef.current) return;
      const text = bufferRef.current.trim();
      if (text.length > 5) {
        bufferRef.current = '';
        synthesize(text);
      }
    }, 600); // 600ms 无新标点则自动发送
  }, [clearAutoFlush, synthesize]);

  // 喂入文字 chunk（流式生成时调用）
  const feedChunk = useCallback((chunk: string) => {
    if (!enabledRef.current) return;
    bufferRef.current += chunk;

    // 按标点分割 — 包含中文逗号/分号，更快获得第一段音频
    const strongBreak = /[。！？.!?\n]/;
    const weakBreak = /[，、；：,;:]/;
    
    const sentences: string[] = [];
    let lastIndex = 0;
    
    for (let i = 0; i < bufferRef.current.length; i++) {
      const ch = bufferRef.current[i];
      const isStrong = strongBreak.test(ch);
      const isWeak = weakBreak.test(ch);
      
      if (isStrong || isWeak) {
        const segment = bufferRef.current.slice(lastIndex, i + 1).trim();
        if (isStrong && segment.length > 2) {
          // 强分割：句号/问号/感叹号，任何 > 2 字符的片段立即发送
          sentences.push(segment);
          lastIndex = i + 1;
        } else if (isWeak && segment.length > 20) {
          // 弱分割：逗号/分号处分割，要求 > 20 字符避免太碎
          sentences.push(segment);
          lastIndex = i + 1;
        }
      }
    }

    bufferRef.current = bufferRef.current.slice(lastIndex);

    for (const sentence of sentences) {
      synthesize(sentence);
    }

    // 如果有发送，重置定时器；如果缓冲区有内容，设置自动flush
    if (sentences.length > 0) {
      clearAutoFlush();
    }
    if (bufferRef.current.trim().length > 0) {
      scheduleAutoFlush();
    }
  }, [synthesize, clearAutoFlush, scheduleAutoFlush]);

  // 流结束时处理剩余文字
  const flush = useCallback(() => {
    if (!enabledRef.current) return;
    clearAutoFlush();
    const remaining = bufferRef.current.trim();
    if (remaining.length > 2) {
      synthesize(remaining);
    }
    bufferRef.current = '';
  }, [synthesize, clearAutoFlush]);

  // 停止并清空一切
  const stop = useCallback(() => {
    clearAutoFlush();
    if (abortRef.current) {
      abortRef.current.abort();
    }
    abortRef.current = new AbortController();
    if (activeSourceRef.current) {
      try { activeSourceRef.current.stop(); } catch {}
      activeSourceRef.current = null;
    }
    queueRef.current = [];
    bufferRef.current = '';
    isPlayingRef.current = false;
    pendingRequestsRef.current = 0;
    enabledRef.current = false;
  }, [clearAutoFlush]);

  // 启动一次新的流式 TTS 会话
  const start = useCallback((options?: { packageId?: number }) => {
    stop();
    packageIdRef.current = options?.packageId ?? null;
    abortRef.current = new AbortController();
    enabledRef.current = true;
    // 预热 AudioContext 并确保 resumed
    getAudioCtx();
  }, [stop, getAudioCtx]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      stop();
      if (audioCtxRef.current) {
        audioCtxRef.current.close();
      }
    };
  }, [stop]);

  return { start, feedChunk, flush, stop, isPlaying: () => isPlayingRef.current };
}
