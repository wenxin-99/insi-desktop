import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertCircle, CheckCircle2, Github } from "lucide-react";
import { getApiBaseUrl, isTauri } from "@/const";
import axios from "axios";

export default function ForumLogin() {
  const [, setLocation] = useLocation();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setIsLoading(true);

    try {
      const response = await axios.post(`${getApiBaseUrl()}/api/forum/password-login`, {
        username,
        password,
      });

      if (response.data.success && response.data.token) {
        // ★ 清除上一个账号的聊天状态残留，防止新账号继承旧对话
        localStorage.removeItem('selectedConversationId');
        localStorage.removeItem('preferredPackageId');
        
        // 保存 token 到 localStorage
        localStorage.setItem('auth_token', response.data.token);
        
        // 保存用户信息（可选）
        if (response.data.user) {
          localStorage.setItem('user_info', JSON.stringify(response.data.user));
        }

        // Tauri 桌面客户端：通过 IPC 将 token 传递给 Rust 后端启动 WebSocket
        // 直接使用 window.__TAURI_INTERNALS__ 避免依赖 @tauri-apps/api npm 包
        if (isTauri()) {
          try {
            const tauri = (window as any).__TAURI_INTERNALS__;
            if (tauri?.invoke) {
              await tauri.invoke('login', { token: response.data.token });
              console.log('[Auth] Tauri IPC login invoked');
            }
          } catch (e) {
            console.warn('[Auth] Tauri IPC login failed:', e);
          }
        }
        
        setSuccess(true);
        
        // 登录成功，延迟跳转
        setTimeout(() => {
          // ★ 支持 redirect 参数（微信绑定等场景）
          const params = new URLSearchParams(window.location.search);
          const redirect = params.get("redirect");
          window.location.href = redirect || "/";
        }, 1500);
      } else {
        setError(response.data.message || "登录失败");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      const errorMessage = err.response?.data?.message || "登录失败，请稍后重试";
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6">
      <Card className="w-full max-w-md shadow-xl">
        <CardHeader className="space-y-2 pb-6">
          <CardTitle className="text-2xl sm:text-3xl font-bold text-center">论坛账号登录</CardTitle>
          <CardDescription className="text-center text-base">
            使用您的论坛账号密码登录Insi平台
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username" className="text-base">用户名或邮箱</Label>
              <Input
                id="username"
                type="text"
                placeholder="输入用户名或邮箱"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={isLoading || success}
                required
                className="h-12 text-base"
                autoComplete="username"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-base">密码</Label>
              <Input
                id="password"
                type="password"
                placeholder="输入密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isLoading || success}
                required
                className="h-12 text-base"
                autoComplete="current-password"
              />
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {success && (
              <Alert className="border-green-500 text-green-700 bg-green-50">
                <CheckCircle2 className="h-4 w-4" />
                <AlertDescription>登录成功！正在跳转...</AlertDescription>
              </Alert>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base font-semibold"
              disabled={isLoading || success}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  登录中...
                </>
              ) : success ? (
                "登录成功"
              ) : (
                "登录"
              )}
            </Button>
          </form>

          {/* 分割线 */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="bg-white px-3 text-muted-foreground">或使用其他方式登录</span>
            </div>
          </div>

          {/* GitHub 登录 */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base font-medium gap-2 border-gray-300 hover:bg-gray-50"
            onClick={() => {
              const baseUrl = getApiBaseUrl();
              const loginUrl = `${baseUrl}/api/github/login`;
              if (isTauri()) {
                // Tauri 环境下使用系统浏览器打开 OAuth
                // 通过 window.__TAURI_INTERNALS__ 调用 shell plugin，无需 npm 依赖
                try {
                  const tauri = (window as any).__TAURI_INTERNALS__;
                  if (tauri?.invoke) {
                    tauri.invoke('plugin:shell|open', { path: loginUrl });
                  } else {
                    window.open(loginUrl, '_blank');
                  }
                } catch {
                  window.open(loginUrl, '_blank');
                }
              } else {
                window.location.href = loginUrl;
              }
            }}
          >
            <Github className="h-5 w-5" />
            使用 GitHub 账号登录
          </Button>

          {/* 微信登录 */}
          <Button
            type="button"
            variant="outline"
            className="w-full h-12 text-base font-medium gap-2 border-green-300 hover:bg-green-50 text-green-700 mt-3"
            onClick={() => {
              // 自动判断：微信内走 H5 授权，PC 走扫码
              const redirect = new URLSearchParams(window.location.search).get("redirect") || "/";
              window.location.href = `/api/wechat/oauth/login?redirect=${encodeURIComponent(redirect)}`;
            }}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8.691 2.188C3.891 2.188 0 5.476 0 9.53c0 2.212 1.17 4.203 3.002 5.55a.59.59 0 01.213.665l-.39 1.48c-.019.07-.048.141-.048.213 0 .163.13.295.29.295a.326.326 0 00.167-.054l1.903-1.114a.864.864 0 01.717-.098 10.16 10.16 0 002.837.403c.276 0 .543-.027.811-.05a6.329 6.329 0 01-.253-1.82c0-3.54 3.196-6.421 7.134-6.421.26 0 .514.017.767.042C16.078 4.773 12.73 2.188 8.691 2.188zm-2.67 4.401c.56 0 1.015.46 1.015 1.028 0 .566-.455 1.027-1.015 1.027-.56 0-1.016-.46-1.016-1.027 0-.568.456-1.028 1.016-1.028zm5.339 0c.559 0 1.015.46 1.015 1.028 0 .566-.456 1.027-1.015 1.027-.56 0-1.016-.46-1.016-1.027 0-.568.456-1.028 1.016-1.028zM16.93 8.69c-3.37 0-6.107 2.507-6.107 5.587 0 3.082 2.738 5.588 6.107 5.588.68 0 1.334-.103 1.953-.283a.707.707 0 01.588.08l1.313.768a.27.27 0 00.138.045c.133 0 .24-.113.24-.24 0-.06-.024-.12-.04-.177l-.268-1.021a.49.49 0 01.175-.546c1.502-1.103 2.46-2.737 2.46-4.544.001-3.08-2.737-5.587-6.106-5.587h-.453zm-2.773 3.14c.46 0 .833.376.833.843 0 .466-.373.843-.833.843a.838.838 0 01-.833-.843c0-.467.373-.843.833-.843zm4.637 0c.46 0 .834.376.834.843 0 .466-.374.843-.834.843a.838.838 0 01-.833-.843c0-.467.373-.843.833-.843z"/>
            </svg>
            微信登录
          </Button>

          <div className="mt-6 text-center space-y-3">
            <div className="text-sm sm:text-base text-muted-foreground">
              还没有账号？
              <a
                href="https://mpsboring.com/register"
                target="_blank"
                rel="noopener noreferrer"
                className="ml-1 text-primary hover:underline font-medium"
              >
                前往论坛注册
              </a>
            </div>
            <div className="text-sm sm:text-base text-muted-foreground">
              或者
              <button
                onClick={() => setLocation("/")}
                className="ml-1 text-primary hover:underline font-medium"
                type="button"
              >
                返回首页
              </button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
