import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, AlertCircle, ShieldAlert } from "lucide-react";

export function OAuthDiagnostics() {
  // ★ 安全修复 #13：仅管理员可访问
  const { user, loading: authLoading } = useAuth();
  const { data: config, isLoading, error } = trpc.oauth.getConfig.useQuery(undefined, {
    enabled: user?.role === 'admin', // 非管理员不发请求
  });

  if (authLoading) {
    return (
      <div className="container py-8">
        <div className="text-center">验证身份中...</div>
      </div>
    );
  }

  if (!user || user.role !== 'admin') {
    return (
      <div className="container py-8 max-w-lg mx-auto">
        <Alert variant="destructive">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription>此页面仅限管理员访问。</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-8">
        <div className="text-center">加载中...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-8">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>加载失败: {error.message}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!config) {
    return null;
  }

  const allConfigured = 
    config.env.FORUM_OAUTH_SERVER_URL !== "not set" &&
    config.env.FORUM_OAUTH_CLIENT_ID !== "not set" &&
    config.env.FORUM_OAUTH_CLIENT_SECRET === "set" &&
    config.env.FORUM_OAUTH_REDIRECT_URI !== "not set";

  return (
    <div className="container py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">OAuth配置诊断</h1>

      {/* 总体状态 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {allConfigured ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                配置完整
              </>
            ) : (
              <>
                <XCircle className="h-5 w-5 text-red-500" />
                配置不完整
              </>
            )}
          </CardTitle>
          <CardDescription>
            {allConfigured
              ? "所有必需的环境变量都已设置"
              : "部分环境变量未设置，OAuth登录可能无法正常工作"}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 当前配置 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>当前配置</CardTitle>
          <CardDescription>从代码中读取的OAuth配置</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ConfigItem label="服务器URL" value={config.serverUrl} />
          <ConfigItem label="客户端ID" value={config.clientId} />
          <ConfigItem label="回调URL" value={config.redirectUri} />
          <ConfigItem label="授权页面URL" value={config.portalUrl} />
          <ConfigItem
            label="客户端密钥"
            value={config.hasClientSecret ? "已设置" : "未设置"}
            status={config.hasClientSecret ? "success" : "error"}
          />
        </CardContent>
      </Card>

      {/* 环境变量 */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>环境变量</CardTitle>
          <CardDescription>生产环境的环境变量设置状态</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ConfigItem
            label="FORUM_OAUTH_SERVER_URL"
            value={config.env.FORUM_OAUTH_SERVER_URL}
            status={config.env.FORUM_OAUTH_SERVER_URL !== "not set" ? "success" : "error"}
          />
          <ConfigItem
            label="FORUM_OAUTH_CLIENT_ID"
            value={config.env.FORUM_OAUTH_CLIENT_ID}
            status={config.env.FORUM_OAUTH_CLIENT_ID !== "not set" ? "success" : "error"}
          />
          <ConfigItem
            label="FORUM_OAUTH_CLIENT_SECRET"
            value={config.env.FORUM_OAUTH_CLIENT_SECRET}
            status={config.env.FORUM_OAUTH_CLIENT_SECRET === "set" ? "success" : "error"}
          />
          <ConfigItem
            label="FORUM_OAUTH_REDIRECT_URI"
            value={config.env.FORUM_OAUTH_REDIRECT_URI}
            status={config.env.FORUM_OAUTH_REDIRECT_URI !== "not set" ? "success" : "error"}
          />
          <ConfigItem
            label="FORUM_OAUTH_PORTAL_URL"
            value={config.env.FORUM_OAUTH_PORTAL_URL}
            status={config.env.FORUM_OAUTH_PORTAL_URL !== "not set" ? "success" : "error"}
          />
        </CardContent>
      </Card>

      {/* 测试链接 */}
      <Card>
        <CardHeader>
          <CardTitle>测试OAuth登录</CardTitle>
          <CardDescription>点击下面的链接测试OAuth授权流程</CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href={`${config.portalUrl}?client_id=${config.clientId}&redirect_uri=${encodeURIComponent(config.redirectUri)}&response_type=code&state=test`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2"
          >
            测试OAuth授权
          </a>
          <p className="text-sm text-muted-foreground mt-3">
            点击后将跳转到论坛授权页面，授权成功后会回调到：<br />
            <code className="text-xs bg-muted px-2 py-1 rounded">{config.redirectUri}</code>
          </p>
        </CardContent>
      </Card>

      {/* 故障排查建议 */}
      {!allConfigured && (
        <Alert className="mt-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>故障排查建议：</strong>
            <ul className="list-disc list-inside mt-2 space-y-1">
              {config.env.FORUM_OAUTH_SERVER_URL === "not set" && (
                <li>请设置环境变量 FORUM_OAUTH_SERVER_URL</li>
              )}
              {config.env.FORUM_OAUTH_CLIENT_ID === "not set" && (
                <li>请设置环境变量 FORUM_OAUTH_CLIENT_ID</li>
              )}
              {config.env.FORUM_OAUTH_CLIENT_SECRET !== "set" && (
                <li>请设置环境变量 FORUM_OAUTH_CLIENT_SECRET</li>
              )}
              {config.env.FORUM_OAUTH_REDIRECT_URI === "not set" && (
                <li>请设置环境变量 FORUM_OAUTH_REDIRECT_URI</li>
              )}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function ConfigItem({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: "success" | "error" | "warning";
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b">
      <span className="font-medium text-sm">{label}</span>
      <div className="flex items-center gap-2">
        <code className="text-xs bg-muted px-2 py-1 rounded max-w-md truncate">
          {value}
        </code>
        {status === "success" && <CheckCircle2 className="h-4 w-4 text-green-500 flex-shrink-0" />}
        {status === "error" && <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />}
        {status === "warning" && <AlertCircle className="h-4 w-4 text-yellow-500 flex-shrink-0" />}
      </div>
    </div>
  );
}
