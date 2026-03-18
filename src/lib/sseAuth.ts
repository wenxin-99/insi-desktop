/**
 * Build SSE URL.
 * ★ 安全修复：不再将 token 暴露在 URL 中（会泄露到日志/浏览器历史）
 * 认证通过 httpOnly cookie 自动完成（EventSource 已设 withCredentials: true）
 */
export function getSseUrl(path: string): Promise<string> {
  return Promise.resolve(path);
}
