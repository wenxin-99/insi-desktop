/**
 * fileVersionStore.ts
 *
 * 文件版本历史管理器（客户端内存 + 可选持久化）
 * - 每次 <replace> 修改自动记录版本
 * - 按 conversationId × filePath 索引
 * - 支持回滚到任意历史版本
 * - React useSyncExternalStore 兼容
 */

export interface FileVersion {
  version: number;
  code: string;
  previousCode: string;
  reason: string;
  timestamp: number;
  messageIndex?: number;
}

export interface FileHistory {
  filePath: string;
  versions: FileVersion[];
}

type Listener = () => void;

class FileVersionStore {
  private data = new Map<string | number, Map<string, FileHistory>>();
  private listeners = new Set<Listener>();
  /** 防重复记录: "convId|filePath|hash" */
  private recorded = new Set<string>();

  getFileHistory(convId: string | number, filePath: string): FileHistory | null {
    return this.data.get(convId)?.get(filePath) ?? null;
  }

  getAllFiles(convId: string | number): FileHistory[] {
    const m = this.data.get(convId);
    return m ? Array.from(m.values()) : [];
  }

  getLatestCode(convId: string | number, filePath: string): string | null {
    const h = this.getFileHistory(convId, filePath);
    return h && h.versions.length > 0 ? h.versions[h.versions.length - 1].code : null;
  }

  getVersionCode(convId: string | number, filePath: string, version: number): string | null {
    const h = this.getFileHistory(convId, filePath);
    return h?.versions.find(v => v.version === version)?.code ?? null;
  }

  /** 记录新版本, 返回版本号; 如果完全重复则跳过返回 -1 */
  addVersion(
    convId: string | number, filePath: string,
    previousCode: string, newCode: string,
    reason: string, messageIndex?: number,
  ): number {
    // 去重
    const key = `${convId}|${filePath}|${_hash(newCode)}`;
    if (this.recorded.has(key)) return -1;
    this.recorded.add(key);

    if (!this.data.has(convId)) this.data.set(convId, new Map());
    const cm = this.data.get(convId)!;
    if (!cm.has(filePath)) cm.set(filePath, { filePath, versions: [] });
    const h = cm.get(filePath)!;

    const version = h.versions.length + 1;
    h.versions.push({ version, code: newCode, previousCode, reason, timestamp: Date.now(), messageIndex });
    this._notify();
    return version;
  }

  /** 回滚：创建新版本, 内容等于目标版本 */
  rollbackTo(convId: string | number, filePath: string, targetVersion: number): number | null {
    const h = this.getFileHistory(convId, filePath);
    if (!h) return null;
    const target = h.versions.find(v => v.version === targetVersion);
    if (!target) return null;
    const latest = h.versions[h.versions.length - 1];
    // 去重 key 用特殊前缀避免和正常记录冲突
    const key = `${convId}|${filePath}|rollback-${targetVersion}-${Date.now()}`;
    this.recorded.add(key);
    const version = h.versions.length + 1;
    h.versions.push({
      version, code: target.code, previousCode: latest.code,
      reason: `回滚到 v${targetVersion}`, timestamp: Date.now(),
    });
    this._notify();
    return version;
  }

  clearConversation(convId: string | number): void { this.data.delete(convId); this._notify(); }
  clearAll(): void { this.data.clear(); this.recorded.clear(); this._notify(); }

  // useSyncExternalStore 兼容
  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  getSnapshot = (): Map<string | number, Map<string, FileHistory>> => this.data;

  private _notify(): void {
    this.data = new Map(this.data); // 浅拷贝触发 React re-render
    for (const l of this.listeners) l();
  }
}

/** 简单哈希(用于去重, 不需要密码安全) */
function _hash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h + s.charCodeAt(i)) | 0; }
  return h.toString(36);
}

export const fileVersionStore = new FileVersionStore();
