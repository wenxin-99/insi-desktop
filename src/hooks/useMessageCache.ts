import { useRef, useCallback } from 'react';

/**
 * 消息缓存 Hook
 * 
 * 在对话切换时缓存消息列表、折叠状态、操作日志等，
 * 避免每次切换都从服务器重新加载。
 * 
 * 从 Chat.tsx 提取，减少主组件复杂度。
 */

export interface CachedConversation {
  messages: any[];
  collapsedDescriptions: Set<number>;
  operationLogs: any[];
  activeResearchTaskId?: number | null;
  timestamp: number;
}

const MAX_CACHE_SIZE = 20;

export function useMessageCache() {
  const cacheRef = useRef<Map<number, CachedConversation>>(new Map());

  /** 保存对话到缓存 */
  const saveToCache = useCallback((
    conversationId: number,
    messages: any[],
    collapsedDescriptions: Set<number>,
    operationLogs: any[],
    activeResearchTaskId?: number | null
  ) => {
    cacheRef.current.set(conversationId, {
      messages,
      collapsedDescriptions,
      operationLogs,
      activeResearchTaskId,
      timestamp: Date.now(),
    });
    // 限制缓存数量
    if (cacheRef.current.size > MAX_CACHE_SIZE) {
      const oldestKey = cacheRef.current.keys().next().value;
      if (oldestKey !== undefined) cacheRef.current.delete(oldestKey);
    }
  }, []);

  /** 从缓存获取对话 */
  const getFromCache = useCallback((conversationId: number): CachedConversation | undefined => {
    return cacheRef.current.get(conversationId);
  }, []);

  /** 删除对话缓存 */
  const deleteFromCache = useCallback((conversationId: number) => {
    cacheRef.current.delete(conversationId);
  }, []);

  /** 检查缓存是否存在 */
  const hasCache = useCallback((conversationId: number): boolean => {
    return cacheRef.current.has(conversationId);
  }, []);

  return {
    saveToCache,
    getFromCache,
    deleteFromCache,
    hasCache,
    /** 直接访问 ref（兼容现有代码的过渡期使用） */
    cacheRef,
  };
}
