/**
 * useTTS — 语音合成 Hook
 * 
 * 从 Chat.tsx 提取的 TTS 逻辑，包含：
 * - 单条消息语音播放（分句并发合成 + 按序播放）
 * - 播放状态管理
 * - 资源清理
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { useStreamingTts } from './useStreamingTts';

export function useTTS(packageId: number | null) {
  const [playingTtsIndex, setPlayingTtsIndex] = useState<number | null>(null);
  const [isTtsAutoMode, setIsTtsAutoMode] = useState(false);
  
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const ttsAudioCtxRef = useRef<AudioContext | null>(null);
  
  const streamingTts = useStreamingTts();

  /** 停止所有 TTS 播放 */
  const stopAll = useCallback(() => {
    if (ttsAbortRef.current) {
      ttsAbortRef.current.abort();
      ttsAbortRef.current = null;
    }
    if (ttsAudioRef.current) {
      ttsAudioRef.current.pause();
      ttsAudioRef.current.currentTime = 0;
      ttsAudioRef.current = null;
    }
    if (ttsAudioCtxRef.current) {
      try { ttsAudioCtxRef.current.close(); } catch {}
      ttsAudioCtxRef.current = null;
    }
    streamingTts.stop();
  }, [streamingTts]);

  /** 播放指定消息的 TTS */
  const handleTtsPlay = useCallback(async (msgContent: string, msgIndex: number) => {
    // 切换：点击正在播放的消息 → 停止
    if (playingTtsIndex === msgIndex) {
      stopAll();
      setPlayingTtsIndex(null);
      return;
    }
    
    // 停止之前的播放
    stopAll();
    setPlayingTtsIndex(msgIndex);
    
    const abortController = new AbortController();
    ttsAbortRef.current = abortController;
    
    try {
      // 清理 markdown，只保留纯文本
      const cleanText = msgContent
        .replace(/!\[[^\]]*\]\([^)]+\)/g, '')
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
        .replace(/[#*`~_>|]/g, '')
        .replace(/\n{2,}/g, '\n')
        .trim();
      
      if (!cleanText) {
        toast.error('没有可播放的文本内容');
        setPlayingTtsIndex(null);
        return;
      }
      
      const truncated = cleanText.substring(0, 2000);
      
      // 按强标点分句，然后合并短句以减少请求数
      const rawSentences = truncated
        .split(/(?<=[。！？.!?\n])/)
        .map(s => s.trim())
        .filter(s => s.length > 2);

      // 合并短句：把相邻的短句合并到一起，目标每段 30~120 字符
      const sentences: string[] = [];
      let mergeBuffer = '';
      for (const s of rawSentences) {
        if (mergeBuffer.length + s.length < 120) {
          mergeBuffer += s;
        } else {
          if (mergeBuffer) sentences.push(mergeBuffer);
          mergeBuffer = s;
        }
      }
      if (mergeBuffer) sentences.push(mergeBuffer);

      if (sentences.length === 0) {
        toast.error('没有可播放的文本内容');
        setPlayingTtsIndex(null);
        return;
      }

      // AudioContext 排队播放
      if (ttsAudioCtxRef.current) {
        try { ttsAudioCtxRef.current.close(); } catch {}
        ttsAudioCtxRef.current = null;
      }
      const audioCtx = new AudioContext();
      ttsAudioCtxRef.current = audioCtx;

      // ★ 边合成边播放：每句合成完立即排入播放队列，不等后续句子
      const MAX_CONCURRENCY = 2;
      const audioBuffers: (AudioBuffer | null)[] = new Array(sentences.length).fill(null);
      let scheduleTime = audioCtx.currentTime;
      let playedUpTo = 0; // 严格顺序游标：只有 playedUpTo 位置就绪才会播放，保证顺序
      let lastSource: AudioBufferSourceNode | null = null;
      let flushing = false; // 防重入锁（JS 单线程下是保险措施）

      // 将已就绪的 **连续** 句子排入播放（不会跳过未就绪的句子）
      // 例: [done, null, done] → 只播第 0 句，等第 1 句就绪后才继续
      const flushReady = () => {
        if (flushing) return;
        flushing = true;
        try {
          while (playedUpTo < audioBuffers.length && audioBuffers[playedUpTo] !== null) {
            const buf = audioBuffers[playedUpTo]!;
            const source = audioCtx.createBufferSource();
            source.buffer = buf;
            source.connect(audioCtx.destination);
            // 确保排入时间不早于当前时间（网络慢导致间隔时自动接续）
            if (scheduleTime < audioCtx.currentTime) scheduleTime = audioCtx.currentTime;
            source.start(scheduleTime);
            scheduleTime += buf.duration;
            lastSource = source;
            playedUpTo++;
          }
        } finally {
          flushing = false;
        }
      };
      
      const fetchSentence = async (text: string, index: number) => {
        try {
          const resp = await fetch('/api/tts/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ text, packageId: packageId ?? undefined }),
            signal: abortController.signal,
          });
          if (!resp.ok) {
            if (resp.status === 402) {
              const data = await resp.json().catch(() => ({}));
              throw new Error(data.error || '余额不足，无法播放语音');
            }
            throw new Error(`TTS ${resp.status}`);
          }
          const arrayBuf = await resp.arrayBuffer();
          audioBuffers[index] = await audioCtx.decodeAudioData(arrayBuf);
        } catch (e: any) {
          if (e?.name === 'AbortError') throw e;
          // ★ 余额不足：中止所有后续合成
          if (e?.message?.includes('余额不足')) {
            abortController.abort();
            throw e;
          }
          console.warn(`[TTS] sentence ${index} failed:`, e?.message);
          // 失败的句子用空占位，跳过不阻塞后续
          audioBuffers[index] = audioCtx.createBuffer(1, 1, audioCtx.sampleRate);
        }
        // 每完成一句就尝试 flush
        flushReady();
      };

      // 并发控制
      let cursor = 0;
      const runNext = async (): Promise<void> => {
        while (cursor < sentences.length) {
          const idx = cursor++;
          if (abortController.signal.aborted) return;
          await fetchSentence(sentences[idx], idx);
        }
      };
      const workers = Array.from(
        { length: Math.min(MAX_CONCURRENCY, sentences.length) },
        () => runNext()
      );
      await Promise.all(workers);

      // 最终 flush（确保尾部句子排入）
      flushReady();

      if (lastSource) {
        lastSource.onended = () => {
          setPlayingTtsIndex(null);
          ttsAudioRef.current = null;
          try { audioCtx.close(); } catch {}
        };
      } else {
        throw new Error('所有句子合成失败');
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      console.error('[TTS] Error:', err);
      toast.error(err.message || '语音合成失败');
      setPlayingTtsIndex(null);
    }
  }, [playingTtsIndex, stopAll, packageId]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      if (ttsAbortRef.current) ttsAbortRef.current.abort();
      if (ttsAudioRef.current) {
        ttsAudioRef.current.pause();
        ttsAudioRef.current = null;
      }
      if (ttsAudioCtxRef.current) {
        try { ttsAudioCtxRef.current.close(); } catch {}
        ttsAudioCtxRef.current = null;
      }
    };
  }, []);

  return {
    playingTtsIndex,
    setPlayingTtsIndex,
    isTtsAutoMode,
    setIsTtsAutoMode,
    streamingTts,
    handleTtsPlay,
    stopAll,
  };
}
