import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";

export default function OAuthTest() {
  const [config, setConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 获取OAuth配置
    fetch("/api/oauth-config")
      .then((res) => res.json())
      .then((data) => {
        setConfig(data);
        setLoading(false);
      })
      .catch((err) => {
        console.error("Failed to load OAuth config:", err);
        setLoading(false);
      });
  }, []);

  const handleOAuthLogin = () => {
    if (!config) return;
    
    const state = Math.random().toString(36).substring(7);
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: config.redirectUri,
      response_type: "code",
      state: state,
    });

    const loginUrl = `${config.portalUrl}?${params.toString()}`;
    console.log("Redirecting to:", loginUrl);
    window.location.href = loginUrl;
  };

  if (loading) {
    return <div className="container py-8">Loading...</div>;
  }

  return (
    <div className="container py-8">
      <Card className="p-6 max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">OAuth登录测试</h1>

        <div className="space-y-4">
          <div>
            <h2 className="font-semibold mb-2">当前配置：</h2>
            <pre className="bg-muted p-4 rounded text-sm overflow-auto">
              {JSON.stringify(config, null, 2)}
            </pre>
          </div>

          <Button onClick={handleOAuthLogin} size="lg" className="w-full">
            测试论坛OAuth登录
          </Button>

          <div className="text-sm text-muted-foreground">
            <p className="font-semibold mb-2">测试步骤：</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>点击上面的按钮</li>
              <li>在论坛登录页面输入账号密码</li>
              <li>授权后会重定向回Insi平台</li>
              <li>检查是否能正确显示用户名</li>
            </ol>
          </div>
        </div>
      </Card>
    </div>
  );
}
