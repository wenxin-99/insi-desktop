/**
 * useMicPermission — 全局麦克风权限管理
 *
 * 核心设计：
 *  - 页面加载时只用 Permissions API 静默查询状态，绝不调 getUserMedia（避免弹窗）
 *  - acquireMicStream：用户主动点击录音时才请求权限
 *  - releaseMicStream：停止所有 tracks，彻底释放麦克风
 *  - 授权状态缓存在 localStorage，避免重复查询
 */

import { useEffect, useRef } from 'react';

const STORAGE_KEY = 'mic_permission_state';

// 追踪最后获取的 stream
let _lastStream: MediaStream | null = null;

/** 录音结束后调用：停止 tracks，彻底释放麦克风 */
export function releaseMicStream(stream?: MediaStream): void {
  const target = stream || _lastStream;
  if (target) {
    target.getTracks().forEach(t => t.stop());
    if (target === _lastStream) _lastStream = null;
  }
}

/** 向后兼容 */
export function destroyMicStream(): void {}

function getCachedState(): string {
  try { return localStorage.getItem(STORAGE_KEY) || 'unknown'; } catch { return 'unknown'; }
}

function setCachedState(state: string): void {
  try { localStorage.setItem(STORAGE_KEY, state); } catch {}
}

export function useMicPermission() {
  const didCheck = useRef(false);

  useEffect(() => {
    if (didCheck.current) return;
    if (typeof navigator === 'undefined') return;
    if (!navigator.mediaDevices?.getUserMedia) return;
    didCheck.current = true;

    const cached = getCachedState();

    // 已知已授权 → 不做任何事
    if (cached === 'granted') {
      console.log('[MicPermission] Permission previously granted (cached)');
      return;
    }

    // 用 Permissions API 静默查询（不会弹窗）
    // ★ 不再调 getUserMedia / prewarmMic
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'microphone' as PermissionName })
        .then((status) => {
          if (status.state === 'granted') {
            setCachedState('granted');
            console.log('[MicPermission] Permission granted (Permissions API)');
          } else if (status.state === 'denied') {
            setCachedState('denied');
            console.log('[MicPermission] Permission denied (Permissions API)');
          } else {
            // prompt 状态 — 等用户主动点击录音按钮时再请求
            console.log('[MicPermission] Permission is prompt — will ask on first use');
          }

          // 监听权限变化
          status.onchange = () => {
            setCachedState(status.state === 'granted' ? 'granted' : status.state === 'denied' ? 'denied' : 'unknown');
            console.log(`[MicPermission] Permission changed to: ${status.state}`);
          };
        })
        .catch(() => {
          // iOS Safari 不支持 Permissions API for microphone
          console.log('[MicPermission] Permissions API not available — will ask on first use');
        });
    }
  }, []);
}

/**
 * 供各录音组件调用：
 * ★ 每次都请求全新的 getUserMedia stream
 */
export async function acquireMicStream(constraints: MediaStreamConstraints = { audio: true }): Promise<MediaStream> {
  if (navigator.permissions?.query) {
    try {
      const status = await navigator.permissions.query({ name: 'microphone' as PermissionName });
      if (status.state === 'denied') {
        throw new Error('麦克风权限已被拒绝，请在浏览器设置中手动开启后刷新页面');
      }
    } catch (e: any) {
      if (e.message?.includes('麦克风')) throw e;
    }
  }

  // 先停掉上一个 stream
  if (_lastStream) {
    _lastStream.getTracks().forEach(t => t.stop());
    _lastStream = null;
  }

  const stream = await navigator.mediaDevices.getUserMedia(constraints);
  _lastStream = stream;
  setCachedState('granted');
  
  const track = stream.getAudioTracks()[0];
  console.log(`[MicPermission] Fresh stream acquired: enabled=${track?.enabled}, readyState=${track?.readyState}`);
  return stream;
}
