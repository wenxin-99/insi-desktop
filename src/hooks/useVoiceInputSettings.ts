import { useState, useCallback, useEffect } from 'react';

const STORAGE_KEY = 'voice_input_settings';

export type VoiceInputMode = 'auto-send' | 'fill-input';

export interface VoiceInputSettings {
  /** 语音识别完成后的行为模式 */
  mode: VoiceInputMode;
  /** 识别语言（预留扩展） */
  language: 'zh' | 'en' | 'ja';
}

const DEFAULTS: VoiceInputSettings = {
  mode: 'auto-send',
  language: 'zh',
};

/** 从 localStorage 读取最新设置 */
function readSettings(): VoiceInputSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? { ...DEFAULTS, ...JSON.parse(saved) } : DEFAULTS;
  } catch {
    return DEFAULTS;
  }
}

// ═══════ 跨组件同步机制 ═══════
// window 'storage' 事件只在跨 tab 时触发，
// 同页面内多个 Hook 实例需要自定义事件广播
const SYNC_EVENT = 'voice-input-settings-changed';

function broadcastChange() {
  window.dispatchEvent(new Event(SYNC_EVENT));
}

/**
 * 语音输入设置 Hook
 *
 * 支持跨组件实时同步：SettingsMenu 修改后 ChatInputArea 立即生效。
 */
export function useVoiceInputSettings() {
  const [settings, setSettingsState] = useState<VoiceInputSettings>(readSettings);

  // 监听同页面内其他组件的修改 + 跨 tab 的 storage 事件
  useEffect(() => {
    const handleSync = () => {
      setSettingsState(readSettings());
    };

    window.addEventListener(SYNC_EVENT, handleSync);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) handleSync();
    };
    window.addEventListener('storage', handleStorage);

    return () => {
      window.removeEventListener(SYNC_EVENT, handleSync);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  const updateSettings = useCallback((patch: Partial<VoiceInputSettings>) => {
    setSettingsState(prev => {
      const next = { ...prev, ...patch };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {}
      // 广播给同页面内的其他 Hook 实例
      broadcastChange();
      return next;
    });
  }, []);

  return { voiceSettings: settings, updateVoiceSettings: updateSettings };
}
