/**
 * 操作日志localStorage持久化工具
 * 
 * 功能：
 * 1. 按conversationId分组存储操作日志
 * 2. 支持保存、读取、删除日志
 * 3. 自动清理过期或过多的日志
 */

interface OperationLog {
  id: string;
  action: string;
  target?: string;
  operationStatus: 'running' | 'completed';
  timestamp: number;
}

const STORAGE_KEY = 'ai_operation_logs';
const MAX_LOGS_PER_CONVERSATION = 50; // 每个对话最多保存50条日志
const MAX_CONVERSATIONS = 20; // 最多保存20个对话的日志

interface StorageData {
  [conversationId: string]: OperationLog[];
}

/**
 * 获取所有存储的日志数据
 */
function getAllLogs(): StorageData {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : {};
  } catch (error) {
    console.error('[OperationLogStorage] Failed to parse logs:', error);
    return {};
  }
}

/**
 * 保存所有日志数据
 */
function saveAllLogs(data: StorageData): void {
  try {
    // 清理过多的对话记录（保留最新的）
    const conversationIds = Object.keys(data);
    if (conversationIds.length > MAX_CONVERSATIONS) {
      // 按最后更新时间排序（使用最新日志的timestamp）
      const sortedIds = conversationIds.sort((a, b) => {
        const aLatest = Math.max(...(data[a]?.map(log => log.timestamp) || [0]));
        const bLatest = Math.max(...(data[b]?.map(log => log.timestamp) || [0]));
        return bLatest - aLatest;
      });
      
      // 只保留最新的MAX_CONVERSATIONS个对话
      const idsToKeep = sortedIds.slice(0, MAX_CONVERSATIONS);
      const cleanedData: StorageData = {};
      idsToKeep.forEach(id => {
        cleanedData[id] = data[id];
      });
      data = cleanedData;
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.error('[OperationLogStorage] Failed to save logs:', error);
  }
}

/**
 * 保存指定对话的操作日志
 * @param conversationId 对话ID
 * @param logs 操作日志数组
 */
export function saveOperationLogs(conversationId: string, logs: OperationLog[]): void {
  if (!conversationId) {
    console.warn('[OperationLogStorage] Cannot save logs without conversationId');
    return;
  }
  
  const allLogs = getAllLogs();
  
  // 限制每个对话的日志数量（保留最新的）
  const limitedLogs = logs.slice(-MAX_LOGS_PER_CONVERSATION);
  
  allLogs[conversationId] = limitedLogs;
  saveAllLogs(allLogs);
}

/**
 * 读取指定对话的操作日志
 * @param conversationId 对话ID
 * @returns 操作日志数组
 */
export function loadOperationLogs(conversationId: string): OperationLog[] {
  if (!conversationId) {
    return [];
  }
  
  const allLogs = getAllLogs();
  return allLogs[conversationId] || [];
}

/**
 * 删除指定对话的操作日志
 * @param conversationId 对话ID
 */
export function deleteOperationLogs(conversationId: string): void {
  if (!conversationId) {
    return;
  }
  
  const allLogs = getAllLogs();
  delete allLogs[conversationId];
  saveAllLogs(allLogs);
}

/**
 * 清空所有操作日志
 */
export function clearAllOperationLogs(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('[OperationLogStorage] Failed to clear logs:', error);
  }
}

/**
 * 获取存储的统计信息（用于调试）
 */
export function getStorageStats(): {
  totalConversations: number;
  totalLogs: number;
  storageSize: number;
} {
  const allLogs = getAllLogs();
  const conversationIds = Object.keys(allLogs);
  const totalLogs = conversationIds.reduce((sum, id) => sum + allLogs[id].length, 0);
  
  let storageSize = 0;
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    storageSize = data ? new Blob([data]).size : 0;
  } catch (error) {
    console.error('[OperationLogStorage] Failed to calculate storage size:', error);
  }
  
  return {
    totalConversations: conversationIds.length,
    totalLogs,
    storageSize,
  };
}
