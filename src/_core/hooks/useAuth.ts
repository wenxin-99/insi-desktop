import { getLoginUrl } from "@/const";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type UseAuthOptions = {
  redirectOnUnauthenticated?: boolean;
  redirectPath?: string;
};

export function useAuth(options?: UseAuthOptions) {
  const { redirectOnUnauthenticated = false, redirectPath } =
    options ?? {};
  const utils = trpc.useUtils();
  const [sessionChecked, setSessionChecked] = useState(false);

  const meQuery = trpc.auth.me.useQuery(undefined, {
    retry: false,
    refetchOnWindowFocus: false,
  });

  // 登录态探测：检查cookie是否有效
  useEffect(() => {
    if (!sessionChecked && meQuery.isSuccess) {
      setSessionChecked(true);
      
      // 如果有token但返回null，说明cookie可能失效
      const hasToken = document.cookie.includes('ai_session');
      if (hasToken && !meQuery.data) {
        console.warn('[Auth] Session cookie exists but auth.me returned null');
        toast.error("登录状态异常：您的登录会话可能已失效，请重新登录");
      }
    }
  }, [sessionChecked, meQuery.isSuccess, meQuery.data]);

  const logoutMutation = trpc.auth.logout.useMutation({
    onSuccess: () => {
      utils.auth.me.setData(undefined, null);
    },
  });

  const logout = useCallback(async () => {
    try {
      await logoutMutation.mutateAsync();
    } catch (error: unknown) {
      if (
        error instanceof TRPCClientError &&
        error.data?.code === "UNAUTHORIZED"
      ) {
        return;
      }
      throw error;
    } finally {
      // 清除所有认证相关的localStorage数据
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      localStorage.removeItem('manus-runtime-user-info');
      // ★ 清除聊天状态，避免下一个用户登录时使用上个用户的对话 ID
      localStorage.removeItem('selectedConversationId');
      localStorage.removeItem('preferredPackageId');
      
      utils.auth.me.setData(undefined, null);
      await utils.auth.me.invalidate();
      // 退出后跳转到应用自己的登录页（账号密码登录），而不是Manus OAuth登录页
      window.location.href = "/forum-login";
    }
  }, [logoutMutation, utils]);

  const state = useMemo(() => {
    localStorage.setItem(
      "manus-runtime-user-info",
      JSON.stringify(meQuery.data)
    );
    return {
      user: meQuery.data ?? null,
      loading: meQuery.isLoading || logoutMutation.isPending,
      error: meQuery.error ?? logoutMutation.error ?? null,
      isAuthenticated: Boolean(meQuery.data),
    };
  }, [
    meQuery.data,
    meQuery.error,
    meQuery.isLoading,
    logoutMutation.error,
    logoutMutation.isPending,
  ]);

  useEffect(() => {
    if (!redirectOnUnauthenticated) return;
    if (meQuery.isLoading || logoutMutation.isPending) return;
    if (state.user) return;
    if (typeof window === "undefined") return;
    if (window.location.pathname === redirectPath) return;
    // Prevent redirect loop: skip if already on login page
    if (window.location.pathname === "/forum-login") return;

    const target = redirectPath ?? getLoginUrl();
    // Extra safety: never redirect to empty string or current page
    if (!target || target === window.location.pathname) {
      window.location.href = "/forum-login";
      return;
    }
    window.location.href = target;
  }, [
    redirectOnUnauthenticated,
    redirectPath,
    logoutMutation.isPending,
    meQuery.isLoading,
    state.user,
  ]);

  return {
    ...state,
    refresh: () => meQuery.refetch(),
    logout,
    sessionChecked,
  };
}
