/**
 * 外部OAuth配置 - 前端
 */

/**
 * 生成外部OAuth登录URL
 * 根据API文档：
 * - 必须包含state参数防止CSRF攻击
 * - 不需要scope参数
 */
export function getExternalLoginUrl(redirectPath: string = "/"): string {
  const portalUrl = import.meta.env.VITE_FORUM_OAUTH_PORTAL_URL || "https://mpsboring.com/oauth/authorize";
  const clientId = import.meta.env.VITE_FORUM_OAUTH_CLIENT_ID || "3";
  
  // 使用当前域名动态生成回调URI，使用 /api/forum/callback 路径（论坛OAuth专用回调）
  const redirectUri = `${window.location.origin}/api/forum/callback`;
  
  // 生成随机state参数用于CSRF防护
  const state = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
  
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    state: state, // 必须包含state参数
  });
  
  // 根据API文档，论坛不需要scope参数
  // 如果需要，可以添加：params.append('scope', 'user:email');
  
  return `${portalUrl}?${params.toString()}`;
}
