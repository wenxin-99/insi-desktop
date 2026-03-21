/**
 * Build SSE URL.
 * ★ 安全修复：不再将 token 暴露在 URL 中（会泄露到日志/浏览器历史）
 * 认证通过 httpOnly cookie 自动完成（EventSource 已设 withCredentials: true）
 *
 * ★ Tauri 修复：桌面客户端使用绝对地址
 */
import { getApiBaseUrl } from "@/const";

export function getSseUrl(path: string): Promise<string> {
  const base = getApiBaseUrl();
  // 如果 path 已经是绝对路径则不加前缀
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return Promise.resolve(path);
  }
  return Promise.resolve(`${base}${path}`);
}
