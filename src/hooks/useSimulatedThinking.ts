import { useState, useEffect, useCallback, useRef } from 'react';
import { SimulatedStep } from '@/components/ThinkingProcessCard';

type UseSimulatedThinkingOptions = {
  onComplete?: () => void;
};

export function useSimulatedThinking(options?: UseSimulatedThinkingOptions) {
  const [steps, setSteps] = useState<SimulatedStep[]>([]);
  const [isActive, setIsActive] = useState(false);
  const startTimeRef = useRef<number>(0);
  const timersRef = useRef<NodeJS.Timeout[]>([]);
  const streamStartedRef = useRef<boolean>(false);

  // 清理所有定时器
  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current = [];
  }, []);

  // 开始模拟思考过程
  const startThinking = useCallback(() => {
    // 清理之前的定时器
    clearAllTimers();
    
    // 重置状态
    startTimeRef.current = Date.now();
    streamStartedRef.current = false;
    setIsActive(true);

    // 初始化4个步骤
    const initialSteps: SimulatedStep[] = [
      { id: 'step-1', name: '分析用户意图', status: 'pending' },
      { id: 'step-2', name: '检索相关知识', status: 'pending' },
      { id: 'step-3', name: '构建回答逻辑', status: 'pending' },
      { id: 'step-4', name: '生成答案', status: 'pending' },
    ];
    setSteps(initialSteps);

    // 步骤1: 分析用户意图 (立即开始，0.5s后完成)
    setSteps(prev => prev.map((step, idx) => 
      idx === 0 ? { ...step, status: 'running' } : step
    ));

    const timer1 = setTimeout(() => {
      // 如果流已经开始，跳过后续模拟步骤
      if (streamStartedRef.current) return;
      
      setSteps(prev => prev.map((step, idx) => 
        idx === 0 ? { ...step, status: 'completed', duration: 500 } : step
      ));

      // 步骤2: 检索相关知识 (立即开始，0.7s后完成)
      setSteps(prev => prev.map((step, idx) => 
        idx === 1 ? { ...step, status: 'running' } : step
      ));

      const timer2 = setTimeout(() => {
        // 如果流已经开始，跳过后续模拟步骤
        if (streamStartedRef.current) return;
        
        setSteps(prev => prev.map((step, idx) => 
          idx === 1 ? { ...step, status: 'completed', duration: 700 } : step
        ));

        // 步骤3: 构建回答逻辑 (立即开始，等待onStreamStart信号)
        setSteps(prev => prev.map((step, idx) => 
          idx === 2 ? { ...step, status: 'running' } : step
        ));
      }, 700);

      timersRef.current.push(timer2);
    }, 500);

    timersRef.current.push(timer1);
  }, [clearAllTimers]);

  // 当流式传输开始时调用（步骤3完成，步骤4开始）
  const onStreamStart = useCallback(() => {
    // 标记流已开始，防止定时器覆盖状态
    streamStartedRef.current = true;
    // 清理所有待执行的定时器
    clearAllTimers();
    
    const now = Date.now();
    const elapsed = now - startTimeRef.current;
    
    // 按比例分配已用时间到前3个步骤
    const step1Duration = Math.min(elapsed * 0.3, 500);
    const step2Duration = Math.min(elapsed * 0.3, 700);
    const step3Duration = Math.max(0, elapsed - step1Duration - step2Duration);
    
    setSteps(prev => prev.map((step, idx) => {
      if (idx === 0) {
        // 步骤1：标记为完成
        if (step.status === 'completed' && step.duration) return step;
        return { ...step, status: 'completed', duration: Math.round(step1Duration) || 100 };
      } else if (idx === 1) {
        // 步骤2：标记为完成
        if (step.status === 'completed' && step.duration) return step;
        return { ...step, status: 'completed', duration: Math.round(step2Duration) || 100 };
      } else if (idx === 2) {
        // 步骤3完成
        return { ...step, status: 'completed', duration: Math.round(step3Duration) || 100 };
      } else if (idx === 3) {
        // 步骤4开始
        return { ...step, status: 'running' };
      }
      return step;
    }));
  }, [clearAllTimers]);

  // 当流式传输完成时调用（步骤4完成）
  const onStreamComplete = useCallback(() => {
    const totalDuration = Date.now() - startTimeRef.current;
    setSteps(prev => prev.map((step, idx) => 
      idx === 3 ? { ...step, status: 'completed', duration: Math.max(0, totalDuration - 1200) } : step
    ));
    setIsActive(false);
    options?.onComplete?.();
  }, [options]);

  // 重置状态
  const reset = useCallback(() => {
    clearAllTimers();
    setSteps([]);
    setIsActive(false);
    startTimeRef.current = 0;
    streamStartedRef.current = false;
  }, [clearAllTimers]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      clearAllTimers();
    };
  }, [clearAllTimers]);

  return {
    steps,
    isActive,
    startThinking,
    onStreamStart,
    onStreamComplete,
    reset,
  };
}
