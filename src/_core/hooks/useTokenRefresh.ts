import { useEffect, useRef } from "react";
import { trpc } from "@/lib/trpc";

/**
 * Token自动刷新Hook
 * 系统使用 HttpOnly Cookie 存储 JWT，无法从 JS 读取 token 内容。
 * 策略：登录后每30分钟静默调用一次 refreshToken，服务端会自动续期 Cookie。
 * 如果用户未登录（auth.me 返回 null），则跳过刷新。
 */
export function useTokenRefresh() {
  const refreshMutation = trpc.auth.refreshToken.useMutation();
  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const tryRefresh = async () => {
      // 只有已登录用户才需要续期
      if (!meQuery.data) {
        console.log('[Token Refresh] Not logged in, skipping refresh');
        return;
      }
      try {
        const result = await refreshMutation.mutateAsync();
        if (result.success) {
          console.log('[Token Refresh] Cookie session refreshed successfully');
        }
      } catch (error) {
        console.error('[Token Refresh] Failed to refresh session:', error);
      }
    };

    // 每30分钟续期一次（Cookie 有效期1年，这里只是为了保持活跃状态）
    intervalRef.current = setInterval(tryRefresh, 30 * 60 * 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [meQuery.data, refreshMutation]);
}
