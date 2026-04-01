/**
 * useThinkingMode — 深度思考模式状态管理 Hook
 * 
 * 从 Chat.tsx 提取思考模式相关的状态和计时逻辑。
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import type { ThinkingStep } from '@/types/thinking';
import type { OperationLog, ThinkingStage } from '@/types/chat';

export function useThinkingMode() {
  const [thinkingMode, setThinkingModeRaw] = useState(() => {
    try { return localStorage.getItem('thinkingMode') === 'true'; } catch { return false; }
  });
  const setThinkingMode = useCallback((val: boolean | ((prev: boolean) => boolean)) => {
    setThinkingModeRaw(prev => {
      const next = typeof val === 'function' ? val(prev) : val;
      try { localStorage.setItem('thinkingMode', String(next)); } catch {}
      return next;
    });
  }, []);
  const [thinkingStage, setThinkingStage] = useState<ThinkingStage>('idle');
  const [thinkingModelName, setThinkingModelName] = useState('');
  const [thinkingStartTime, setThinkingStartTime] = useState<number | null>(null);
  const [elapsedThinkingTime, setElapsedThinkingTime] = useState(0);
  const [reasoningContent, setReasoningContent] = useState('');
  const [currentThinkingSteps, setCurrentThinkingSteps] = useState<
    Array<{ id: string; content: string; timestamp: number }>
  >([]);
  const [realtimeThinkingSteps, setRealtimeThinkingSteps] = useState<ThinkingStep[]>([]);
  const [operationLogs, setOperationLogs] = useState<OperationLog[]>([]);
  const [showThinkingPanel, setShowThinkingPanel] = useState(false);
  
  // 图片生成专用阶段状态
  const [imageGenStage, setImageGenStage] = useState<{
    stage: string; prompt?: string; error?: string; errorType?: string; timestamp: number;
  } | null>(null);
  const [imageGenProgress, setImageGenProgress] = useState<{
    attempt: number; maxAttempts: number; status: string; timestamp: number;
  } | null>(null);
  
  // Ref 镜像避免闭包问题
  const operationLogsRef = useRef(operationLogs);
  operationLogsRef.current = operationLogs;

  // 计时器
  useEffect(() => {
    if (thinkingStartTime) {
      const interval = setInterval(() => {
        setElapsedThinkingTime((Date.now() - thinkingStartTime) / 1000);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [thinkingStartTime]);

  /** 开始思考 */
  const startThinking = useCallback((modelName?: string) => {
    setThinkingStage('reasoning');
    setThinkingStartTime(Date.now());
    setElapsedThinkingTime(0);
    setReasoningContent('');
    if (modelName) setThinkingModelName(modelName);
  }, []);

  /** 结束思考 */
  const endThinking = useCallback(() => {
    setThinkingStage('idle');
    setThinkingStartTime(null);
  }, []);

  /** 重置所有思考状态 */
  const resetThinking = useCallback(() => {
    setThinkingStage('idle');
    setThinkingStartTime(null);
    setElapsedThinkingTime(0);
    setReasoningContent('');
    setCurrentThinkingSteps([]);
    setRealtimeThinkingSteps([]);
    setOperationLogs([]);
    setImageGenStage(null);
    setImageGenProgress(null);
  }, []);

  /** 添加操作日志 */
  const addOperationLog = useCallback((log: OperationLog) => {
    setOperationLogs(prev => {
      const existing = prev.findIndex(l => l.id === log.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = log;
        return updated;
      }
      return [...prev, log];
    });
  }, []);

  /** 处理 SSE 思考阶段事件 */
  const handleThinkingStageEvent = useCallback((data: { stage: string; model?: string; error?: string }) => {
    switch (data.stage) {
      case 'start':
        startThinking(data.model);
        break;
      case 'end':
        setThinkingStage('generating');
        break;
      case 'error':
        setThinkingStage('error');
        console.error('[ThinkingMode] Error:', data.error);
        break;
    }
  }, [startThinking]);

  /** 处理 SSE 推理内容事件 */
  const handleReasoningContent = useCallback((data: { content: string }) => {
    setReasoningContent(prev => prev + data.content);
  }, []);

  return {
    // 状态
    thinkingMode,
    thinkingStage,
    thinkingModelName,
    thinkingStartTime,
    elapsedThinkingTime,
    reasoningContent,
    currentThinkingSteps,
    realtimeThinkingSteps,
    operationLogs,
    showThinkingPanel,
    operationLogsRef,
    imageGenStage,
    imageGenProgress,
    
    // Setters
    setThinkingMode,
    setThinkingStage,
    setShowThinkingPanel,
    setCurrentThinkingSteps,
    setRealtimeThinkingSteps,
    setOperationLogs,
    setReasoningContent,
    setThinkingStartTime,
    setElapsedThinkingTime,
    setThinkingModelName,
    setImageGenStage,
    setImageGenProgress,
    
    // Actions
    startThinking,
    endThinking,
    resetThinking,
    addOperationLog,
    handleThinkingStageEvent,
    handleReasoningContent,
  };
}
