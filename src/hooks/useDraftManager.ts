import { useState, useEffect, useCallback } from 'react';

export interface UploadedFile {
  id?: string;
  name: string;
  url: string;
  size: number;
  progress?: number;
  error?: string;
  file?: File;
}

export interface ConversationDraft {
  input: string;
  files: UploadedFile[];
}

const DRAFT_STORAGE_KEY = 'conversation_drafts';

/**
 * 对话草稿管理Hook
 * 用于保存和恢复对话中的输入内容和上传文件
 */
export function useDraftManager(conversationId: number | null) {
  const [draft, setDraft] = useState<ConversationDraft>({ input: '', files: [] });

  // 从localStorage加载所有草稿
  const loadDrafts = useCallback((): Record<string, ConversationDraft> => {
    try {
      const stored = localStorage.getItem(DRAFT_STORAGE_KEY);
      return stored ? JSON.parse(stored) : {};
    } catch (error) {
      console.error('[DraftManager] Failed to load drafts:', error);
      return {};
    }
  }, []);

  // 保存所有草稿到localStorage
  const saveDrafts = useCallback((drafts: Record<string, ConversationDraft>) => {
    try {
      localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(drafts));
    } catch (error) {
      console.error('[DraftManager] Failed to save drafts:', error);
    }
  }, []);

  // 保存当前对话的草稿
  const saveDraft = useCallback((input: string, files: UploadedFile[]) => {
    if (conversationId === null) return;

    const drafts = loadDrafts();
    const key = conversationId.toString();

    // 如果输入为空且没有文件，删除草稿
    if (!input.trim() && files.length === 0) {
      delete drafts[key];
    } else {
      drafts[key] = { input, files };
    }

    saveDrafts(drafts);
    setDraft({ input, files });
  }, [conversationId, loadDrafts, saveDrafts]);

  // 加载当前对话的草稿
  const loadDraft = useCallback((): ConversationDraft => {
    if (conversationId === null) {
      return { input: '', files: [] };
    }

    const drafts = loadDrafts();
    const key = conversationId.toString();
    return drafts[key] || { input: '', files: [] };
  }, [conversationId, loadDrafts]);

  // 清除当前对话的草稿
  const clearDraft = useCallback(() => {
    if (conversationId === null) return;

    const drafts = loadDrafts();
    const key = conversationId.toString();
    delete drafts[key];
    saveDrafts(drafts);
    setDraft({ input: '', files: [] });
  }, [conversationId, loadDrafts, saveDrafts]);

  // 当conversationId变化时，加载对应的草稿
  useEffect(() => {
    const loadedDraft = loadDraft();
    setDraft(loadedDraft);
  }, [conversationId, loadDraft]);

  return {
    draft,
    saveDraft,
    clearDraft,
  };
}
