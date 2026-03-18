import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, XCircle, Loader2, Info, Cookie, Key } from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";

export default function AuthModeTest() {
  const [testResults, setTestResults] = useState<{
    mode: string;
    tests: { name: string; status: 'success' | 'error' | 'pending'; message: string }[];
  } | null>(null);
  const [isTestingCookie, setIsTestingCookie] = useState(false);
  const [isTestingToken, setIsTestingToken] = useState(false);

  const authMeQuery = trpc.auth.me.useQuery();
  const refreshMutation = trpc.auth.refreshToken.useMutation();
  const logoutMutation = trpc.auth.logout.useMutation();

  const testCookieMode = async () => {
    setIsTestingCookie(true);
    const results = {
      mode: 'Cookie模式',
      tests: [] as { name: string; status: 'success' | 'error' | 'pending'; message: string }[],
    };

    try {
      // 测试1：检查当前登录状态
      results.tests.push({ name: '检查登录状态', status: 'pending', message: '正在检查...' });
      const user = await authMeQuery.refetch();
      if (user.data) {
        results.tests[0] = { name: '检查登录状态', status: 'success', message: `已登录：${user.data.name}` };
      } else {
        results.tests[0] = { name: '检查登录状态', status: 'error', message: '未登录或cookie失效' };
      }

      // 测试2：检查cookie是否存在
      results.tests.push({ name: '检查Cookie', status: 'pending', message: '正在检查...' });
      const cookies = document.cookie.split(';').map(c => c.trim());
      const sessionCookie = cookies.find(c => c.startsWith('ai_session='));
      if (sessionCookie) {
        results.tests[1] = { name: '检查Cookie', status: 'success', message: 'Cookie存在且有效' };
      } else {
        results.tests[1] = { name: '检查Cookie', status: 'error', message: 'Cookie不存在' };
      }

      // 测试3：测试token刷新
      results.tests.push({ name: '测试Token刷新', status: 'pending', message: '正在刷新...' });
      try {
        const refreshResult = await refreshMutation.mutateAsync();
        if (refreshResult.success) {
          results.tests[2] = { name: '测试Token刷新', status: 'success', message: 'Token刷新成功' };
        } else {
          results.tests[2] = { name: '测试Token刷新', status: 'error', message: 'Token刷新失败' };
        }
      } catch (error: any) {
        results.tests[2] = { name: '测试Token刷新', status: 'error', message: error.message || 'Token刷新失败' };
      }

    } catch (error: any) {
      console.error('[Cookie Mode Test] Error:', error);
    }

    setTestResults(results);
    setIsTestingCookie(false);
  };

  const testTokenMode = async () => {
    setIsTestingToken(true);
    const results = {
      mode: 'Token模式',
      tests: [] as { name: string; status: 'success' | 'error' | 'pending'; message: string }[],
    };

    try {
      // 测试1：检查localStorage中的token
      results.tests.push({ name: '检查LocalStorage Token', status: 'pending', message: '正在检查...' });
      const token = localStorage.getItem('auth_token');
      if (token) {
        results.tests[0] = { name: '检查LocalStorage Token', status: 'success', message: 'Token存在' };
      } else {
        results.tests[0] = { name: '检查LocalStorage Token', status: 'error', message: 'Token不存在' };
      }

      // 测试2：检查当前登录状态
      results.tests.push({ name: '检查登录状态', status: 'pending', message: '正在检查...' });
      const user = await authMeQuery.refetch();
      if (user.data) {
        results.tests[1] = { name: '检查登录状态', status: 'success', message: `已登录：${user.data.name}` };
      } else {
        results.tests[1] = { name: '检查登录状态', status: 'error', message: '未登录或token失效' };
      }

      // 测试3：测试token刷新
      results.tests.push({ name: '测试Token刷新', status: 'pending', message: '正在刷新...' });
      try {
        const refreshResult = await refreshMutation.mutateAsync();
        if (refreshResult.success && refreshResult.token) {
          localStorage.setItem('auth_token', refreshResult.token);
          results.tests[2] = { name: '测试Token刷新', status: 'success', message: 'Token刷新成功并更新到LocalStorage' };
        } else {
          results.tests[2] = { name: '测试Token刷新', status: 'error', message: 'Token刷新失败' };
        }
      } catch (error: any) {
        results.tests[2] = { name: '测试Token刷新', status: 'error', message: error.message || 'Token刷新失败' };
      }

    } catch (error: any) {
      console.error('[Token Mode Test] Error:', error);
    }

    setTestResults(results);
    setIsTestingToken(false);
  };

  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user_info');
      window.location.href = '/';
    } catch (error: any) {
      console.error('[Logout] Error:', error);
    }
  };

  return (
    <DashboardLayout>
      <div className="container mx-auto py-8">
        <h1 className="text-3xl font-bold mb-6">认证模式测试</h1>

        {/* 当前状态 */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>当前认证状态</CardTitle>
            <CardDescription>查看当前的登录状态和认证信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">登录状态</span>
              {authMeQuery.data ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  已登录
                </Badge>
              ) : (
                <Badge variant="destructive" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  未登录
                </Badge>
              )}
            </div>
            {authMeQuery.data && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">用户名</span>
                  <span className="text-sm">{authMeQuery.data.name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">用户ID</span>
                  <span className="text-sm font-mono">{authMeQuery.data.id}</span>
                </div>
              </>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Cookie (ai_session)</span>
              {document.cookie.includes('ai_session=') ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  存在
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  不存在
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">LocalStorage Token</span>
              {localStorage.getItem('auth_token') ? (
                <Badge variant="default" className="gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  存在
                </Badge>
              ) : (
                <Badge variant="secondary" className="gap-1">
                  <XCircle className="h-3 w-3" />
                  不存在
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 测试按钮 */}
        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Cookie className="h-5 w-5" />
                Cookie模式测试
              </CardTitle>
              <CardDescription>测试基于Cookie的认证流程</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={testCookieMode} 
                disabled={isTestingCookie}
                className="w-full"
              >
                {isTestingCookie && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                开始测试Cookie模式
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Key className="h-5 w-5" />
                Token模式测试
              </CardTitle>
              <CardDescription>测试基于Token的认证流程</CardDescription>
            </CardHeader>
            <CardContent>
              <Button 
                onClick={testTokenMode} 
                disabled={isTestingToken}
                className="w-full"
              >
                {isTestingToken && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                开始测试Token模式
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* 测试结果 */}
        {testResults && (
          <Card>
            <CardHeader>
              <CardTitle>{testResults.mode} - 测试结果</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {testResults.tests.map((test, index) => (
                <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-muted">
                  {test.status === 'success' && <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />}
                  {test.status === 'error' && <XCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />}
                  {test.status === 'pending' && <Loader2 className="h-5 w-5 text-blue-500 animate-spin flex-shrink-0 mt-0.5" />}
                  <div className="flex-1">
                    <div className="font-medium">{test.name}</div>
                    <div className="text-sm text-muted-foreground">{test.message}</div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* 说明 */}
        <Alert className="mt-6">
          <Info className="h-4 w-4" />
          <AlertDescription>
            <strong>使用说明：</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>Cookie模式：依赖浏览器Cookie进行认证，适合传统Web应用</li>
              <li>Token模式：使用LocalStorage存储Token，适合SPA应用和移动端</li>
              <li>当前系统默认使用Cookie模式，可以通过环境变量AUTH_MODE切换</li>
              <li>测试会检查登录状态、认证信息和token刷新功能</li>
            </ul>
          </AlertDescription>
        </Alert>

        {/* 登出按钮 */}
        <div className="mt-6">
          <Button 
            onClick={handleLogout} 
            variant="destructive"
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            登出并清除所有认证信息
          </Button>
        </div>
      </div>
    </DashboardLayout>
  );
}
