/**
 * WechatBind — 微信公众号账号绑定页
 *
 * 用户从微信点击链接进入：/wechat-bind?openid=xxx
 * - 已登录 → 自动绑定 → 显示成功
 * - 未登录 → 引导登录 → 登录后自动绑定
 */
import { useState, useEffect } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Link2, Loader2, LogIn, AlertCircle } from "lucide-react";

type BindState = "checking" | "binding" | "success" | "error" | "needLogin";

export default function WechatBind() {
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const [state, setState] = useState<BindState>("checking");
  const [errorMsg, setErrorMsg] = useState("");

  // 从 URL 获取 openid
  const params = new URLSearchParams(window.location.search);
  const openid = params.get("openid");

  useEffect(() => {
    if (authLoading) return; // 等 auth 加载完

    if (!openid) {
      setState("error");
      setErrorMsg("缺少绑定参数，请从微信公众号重新获取链接");
      return;
    }

    if (!isAuthenticated) {
      setState("needLogin");
      return;
    }

    // 已登录，自动绑定
    doBind();
  }, [authLoading, isAuthenticated, openid]);

  async function doBind() {
    if (!openid || !user?.id) return;

    setState("binding");
    try {
      const resp = await fetch(
        `/api/wechat/message/bind?openid=${encodeURIComponent(openid)}&userId=${user.id}`,
        { credentials: "include" }
      );

      if (resp.ok) {
        setState("success");
      } else {
        const text = await resp.text();
        setState("error");
        setErrorMsg(text || "绑定失败，请重试");
      }
    } catch (e) {
      setState("error");
      setErrorMsg("网络错误，请重试");
    }
  }

  function goLogin() {
    // 登录后回到当前页面（带 openid 参数）
    const returnUrl = encodeURIComponent(`/wechat-bind?openid=${openid}`);
    window.location.href = `/forum-login?redirect=${returnUrl}`;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/20 p-4">
      <Card className="w-[420px] max-w-full">
        <CardContent className="flex flex-col items-center gap-5 pt-10 pb-8 px-8">

          {/* ── 检查中 / 绑定中 ── */}
          {(state === "checking" || state === "binding") && (
            <>
              <div className="w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-blue-500 animate-spin" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">
                  {state === "checking" ? "验证登录状态..." : "正在绑定..."}
                </h2>
                <p className="text-muted-foreground text-sm">请稍候</p>
              </div>
            </>
          )}

          {/* ── 绑定成功 ── */}
          {state === "success" && (
            <>
              <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                <Check className="h-10 w-10 text-green-600" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">绑定成功！</h2>
                <p className="text-muted-foreground text-sm mb-1">
                  微信公众号已关联账号：{user?.name || user?.email || ""}
                </p>
                <p className="text-muted-foreground text-sm">
                  返回微信公众号发送消息即可开始 AI 对话
                </p>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300 text-sm">
                <Link2 className="h-4 w-4" />
                <span>对话将消耗🐟币</span>
              </div>
              <p className="text-xs text-muted-foreground mt-2">此页面可以关闭</p>
            </>
          )}

          {/* ── 需要登录 ── */}
          {state === "needLogin" && (
            <>
              <div className="w-20 h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <LogIn className="h-10 w-10 text-amber-600" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">绑定微信公众号</h2>
                <p className="text-muted-foreground text-sm">
                  登录 Insi AI 账号后，即可将微信与平台账号关联
                </p>
              </div>
              <div className="w-full space-y-3 mt-2">
                <div className="text-sm text-muted-foreground space-y-2">
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">1</span>
                    <span>登录或注册 Insi AI 账号</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">2</span>
                    <span>自动完成微信绑定</span>
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="text-blue-500 font-bold mt-0.5">3</span>
                    <span>回到微信公众号即可 AI 对话</span>
                  </div>
                </div>
                <Button size="lg" className="w-full" onClick={goLogin}>
                  <LogIn className="mr-2 h-5 w-5" />
                  登录 / 注册
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                没有账号？登录页面可直接注册
              </p>
            </>
          )}

          {/* ── 错误 ── */}
          {state === "error" && (
            <>
              <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="h-10 w-10 text-red-600" />
              </div>
              <div className="text-center">
                <h2 className="text-xl font-bold mb-2">绑定失败</h2>
                <p className="text-muted-foreground text-sm">{errorMsg}</p>
              </div>
              <div className="flex gap-3 mt-2">
                <Button variant="outline" onClick={() => window.close()}>关闭</Button>
                <Button onClick={() => { setState("checking"); doBind(); }}>重试</Button>
              </div>
            </>
          )}

        </CardContent>
      </Card>
    </div>
  );
}
