/**
 * ConnectorHub.tsx — 外部应用连接管理面板
 *
 * 显示所有可用连接器，管理 OAuth 连接/断开。
 * 集成在设置页面或独立页面中。
 */

import { useState, useEffect, useCallback } from "react";
import { Plug, PlugZap, Unplug, ExternalLink, Loader2, CheckCircle, AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// ═══════════ 类型（与服务端同步） ═══════════

interface ConnectorInfo {
  id: string;
  name: string;
  nameZh: string;
  icon: string;
  description: string;
  descriptionZh: string;
  category: string;
  connected: boolean;
  accountLabel?: string;
  status?: string;
  expiresAt?: string;
}

// ═══════════ API helpers ═══════════

async function fetchConnectors(): Promise<ConnectorInfo[]> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch("/api/connectors/list", { credentials: "include", headers });
  if (!resp.ok) throw new Error("加载失败");
  return await resp.json();
}

async function startConnect(connectorId: string): Promise<string> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(`/api/connectors/${connectorId}/authorize`, { credentials: "include", headers });
  if (!resp.ok) {
    const data = await resp.json().catch(() => ({}));
    throw new Error(data.error || "授权启动失败");
  }
  const data = await resp.json();
  return data.authorizeUrl;
}

async function doDisconnect(connectorId: string): Promise<void> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const resp = await fetch(`/api/connectors/${connectorId}/disconnect`, {
    method: "POST", credentials: "include", headers,
  });
  if (!resp.ok) throw new Error("断开失败");
}

// ═══════════ 分类标签 ═══════════

const CATEGORY_LABELS: Record<string, { label: string; icon: string }> = {
  productivity: { label: "效率工具", icon: "📁" },
  communication: { label: "沟通协作", icon: "💬" },
  dev: { label: "开发工具", icon: "🔧" },
  project: { label: "项目管理", icon: "📋" },
};

// ═══════════ 主组件 ═══════════

interface ConnectorHubProps {
  /** 精简模式（嵌入设置页面时用） */
  compact?: boolean;
}

export function ConnectorHub({ compact = false }: ConnectorHubProps) {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadConnectors = useCallback(async () => {
    try {
      const data = await fetchConnectors();
      setConnectors(data);
    } catch {
      toast.error("加载连接器列表失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadConnectors(); }, [loadConnectors]);

  // 检查 URL 参数中的连接结果
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const connected = params.get("connector_connected");
    const account = params.get("account");
    const error = params.get("connector_error");

    if (connected) {
      toast.success(`${connected} 已连接${account ? ` (${decodeURIComponent(account)})` : ""}`);
      loadConnectors();
      // 清理 URL 参数
      const url = new URL(window.location.href);
      url.searchParams.delete("connector_connected");
      url.searchParams.delete("account");
      window.history.replaceState({}, "", url.toString());
    }
    if (error) {
      toast.error(`连接失败: ${decodeURIComponent(error)}`);
      const url = new URL(window.location.href);
      url.searchParams.delete("connector_error");
      window.history.replaceState({}, "", url.toString());
    }
  }, [loadConnectors]);

  const handleConnect = useCallback(async (connectorId: string) => {
    setActionLoading(connectorId);
    try {
      const authorizeUrl = await startConnect(connectorId);
      // 跳转到第三方授权页
      window.location.href = authorizeUrl;
    } catch (err: any) {
      toast.error(err.message);
      setActionLoading(null);
    }
  }, []);

  const handleDisconnect = useCallback(async (connectorId: string) => {
    setActionLoading(connectorId);
    try {
      await doDisconnect(connectorId);
      toast.success("已断开连接");
      await loadConnectors();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setActionLoading(null);
    }
  }, [loadConnectors]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const connected = connectors.filter(c => c.connected);
  const available = connectors.filter(c => !c.connected);

  // 按分类分组
  const grouped = new Map<string, ConnectorInfo[]>();
  for (const c of available) {
    const cat = c.category || "other";
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(c);
  }

  return (
    <div className="space-y-6">
      {/* 标题 */}
      {!compact && (
        <div className="flex items-center gap-3">
          <PlugZap className="w-5 h-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">外部应用连接</h2>
            <p className="text-sm text-muted-foreground">连接第三方服务，让 AI 直接访问你的文件、邮件和消息</p>
          </div>
        </div>
      )}

      {/* 已连接 */}
      {connected.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground px-1">已连接 ({connected.length})</h3>
          <div className="grid gap-2">
            {connected.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-3 rounded-xl border bg-background hover:bg-muted/30 transition-colors">
                <span className="text-xl flex-shrink-0">{c.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{c.nameZh}</span>
                    <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{c.accountLabel}</p>
                </div>
                {c.status === "expired" && (
                  <Button
                    size="sm" variant="outline"
                    className="h-7 text-xs gap-1 text-amber-600 border-amber-200"
                    onClick={() => handleConnect(c.id)}
                    disabled={actionLoading === c.id}
                  >
                    <RefreshCw className="w-3 h-3" />
                    重新授权
                  </Button>
                )}
                <Button
                  size="sm" variant="ghost"
                  className="h-7 text-xs text-muted-foreground hover:text-red-500"
                  onClick={() => handleDisconnect(c.id)}
                  disabled={actionLoading === c.id}
                >
                  {actionLoading === c.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Unplug className="w-3 h-3" />}
                  断开
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 可用连接器（按分类） */}
      {available.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-muted-foreground px-1">可用连接 ({available.length})</h3>
          {Array.from(grouped.entries()).map(([cat, items]) => {
            const catInfo = CATEGORY_LABELS[cat] || { label: cat, icon: "🔗" };
            return (
              <div key={cat} className="space-y-2">
                <p className="text-xs text-muted-foreground/70 px-1">{catInfo.icon} {catInfo.label}</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {items.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleConnect(c.id)}
                      disabled={actionLoading === c.id}
                      className="flex items-center gap-3 px-4 py-3 rounded-xl border border-dashed border-border/60 hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
                    >
                      <span className="text-xl flex-shrink-0">{c.icon}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium group-hover:text-primary transition-colors">{c.nameZh}</span>
                        <p className="text-[11px] text-muted-foreground truncate">{c.descriptionZh}</p>
                      </div>
                      {actionLoading === c.id ? (
                        <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                      ) : (
                        <Plug className="w-4 h-4 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {connectors.length === 0 && (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>暂无可用的外部连接器</p>
          <p className="text-xs mt-1">管理员需在环境变量中配置 OAuth Client ID/Secret</p>
        </div>
      )}
    </div>
  );
}
