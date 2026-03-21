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
        
        // 登录成功，延迟跳转以显示成功消息
        setTimeout(() => {
          window.location.href = "/";
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
