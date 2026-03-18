import React, { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Plus, Edit, Trash2, TestTube, Check, X, Loader, Link as LinkIcon } from "lucide-react";
import { useLocation } from "wouter";
import { parseProxyLink } from "../../utils/proxyLinkParser";

interface Proxy {
  id: number;
  name: string;
  type: "socks5" | "http" | "https" | "vless";
  host: string;
  port: number;
  username?: string;
  password?: string;
  vlessConfig?: any;
  enabled: boolean;
  priority: number;
  description?: string;
  lastTestTime?: string;
  lastTestStatus?: "success" | "failed" | "pending";
  createdAt: string;
  updatedAt: string;
}

export default function ProxyManagement() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [proxyLink, setProxyLink] = useState("");
  const [linkParseError, setLinkParseError] = useState("");

  const { data: proxies = [], refetch } = trpc.proxy.getAll.useQuery();
  const createMutation = trpc.proxy.create.useMutation();
  const updateMutation = trpc.proxy.update.useMutation();
  const deleteMutation = trpc.proxy.delete.useMutation();
  const testMutation = trpc.proxy.test.useMutation();

  const [formData, setFormData] = useState({
    name: "",
    type: "socks5" as "socks5" | "http" | "https" | "vless",
    host: "",
    port: 10808,
    username: "",
    password: "",
    vlessConfig: "",
    enabled: true,
    priority: 0,
    description: "",
  });

  const handleOpenDialog = (proxy?: Proxy) => {
    if (proxy) {
      setEditingProxy(proxy);
      setFormData({
        name: proxy.name,
        type: proxy.type,
        host: proxy.host,
        port: proxy.port,
        username: proxy.username || "",
        password: proxy.password || "",
        vlessConfig: proxy.vlessConfig ? JSON.stringify(proxy.vlessConfig, null, 2) : "",
        enabled: proxy.enabled,
        priority: proxy.priority,
        description: proxy.description || "",
      });
    } else {
      setEditingProxy(null);
      setFormData({
        name: "",
        type: "socks5",
        host: "",
        port: 10808,
        username: "",
        password: "",
        vlessConfig: "",
        enabled: true,
        priority: 0,
        description: "",
      });
    }
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data: any = {
        name: formData.name,
        type: formData.type,
        host: formData.host,
        port: formData.port,
        enabled: formData.enabled,
        priority: formData.priority,
        description: formData.description || undefined,
      };

      if (formData.username) data.username = formData.username;
      if (formData.password) data.password = formData.password;
      if (formData.vlessConfig) {
        try {
          data.vlessConfig = JSON.parse(formData.vlessConfig);
        } catch (e) {
          alert("VLESS配置JSON格式错误");
          return;
        }
      }

      if (editingProxy) {
        await updateMutation.mutateAsync({ id: editingProxy.id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }

      setIsDialogOpen(false);
      refetch();
    } catch (error: any) {
      alert(error.message || "保存失败");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个代理吗？")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      refetch();
    } catch (error: any) {
      alert(error.message || "删除失败");
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    try {
      const result = await testMutation.mutateAsync({ id });
      if (result.success) {
        alert(`测试成功！响应时间：${result.responseTime}ms`);
      } else {
        alert(`测试失败：${result.message}`);
      }
      refetch();
    } catch (error: any) {
      alert(error.message || "测试失败");
    } finally {
      setTestingId(null);
    }
  };

  const getStatusBadge = (status?: "success" | "failed" | "pending") => {
    if (!status || status === "pending") {
      return <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">未测试</span>;
    }
    if (status === "success") {
      return <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-600 flex items-center gap-1"><Check size={12} />连接正常</span>;
    }
    return <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-600 flex items-center gap-1"><X size={12} />连接失败</span>;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/admin")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft size={20} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">代理管理</h1>
              <p className="text-sm text-gray-500 mt-1">配置和管理系统代理，用于访问外部API</p>
            </div>
          </div>
          <button
            onClick={() => handleOpenDialog()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={18} />
            添加代理
          </button>
        </div>

        {/* Proxy List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">名称</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">类型</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">地址</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">优先级</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">测试状态</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {proxies.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                    暂无代理数据
                  </td>
                </tr>
              ) : (
                proxies.map((proxy) => (
                  <tr key={proxy.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{proxy.name}</div>
                      {proxy.description && (
                        <div className="text-xs text-gray-500 mt-1">{proxy.description}</div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-600 uppercase">
                        {proxy.type}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {proxy.host}:{proxy.port}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{proxy.priority}</td>
                    <td className="px-6 py-4">
                      {proxy.enabled ? (
                        <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-600">启用</span>
                      ) : (
                        <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-600">禁用</span>
                      )}
                    </td>
                    <td className="px-6 py-4">{getStatusBadge(proxy.lastTestStatus)}</td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTest(proxy.id)}
                          disabled={testingId === proxy.id}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50"
                          title="测试"
                        >
                          {testingId === proxy.id ? <Loader size={16} className="animate-spin" /> : <TestTube size={16} />}
                        </button>
                        <button
                          onClick={() => handleOpenDialog(proxy)}
                          className="p-1.5 text-gray-600 hover:bg-gray-100 rounded transition-colors"
                          title="编辑"
                        >
                          <Edit size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(proxy.id)}
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                          title="删除"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b sticky top-0 bg-white">
              <h2 className="text-xl font-bold">{editingProxy ? "编辑代理" : "添加代理"}</h2>
              <p className="text-sm text-gray-500 mt-1">配置代理服务器信息</p>
            </div>

            <div className="p-6 space-y-4">
              {/* 链接导入 */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <LinkIcon size={16} className="text-blue-600" />
                  <label className="text-sm font-medium text-blue-900">从链接导入配置</label>
                </div>
                <p className="text-xs text-blue-700 mb-2">支持 VLESS、VMess、Shadowsocks、Trojan 等协议链接</p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={proxyLink}
                    onChange={(e) => {
                      setProxyLink(e.target.value);
                      setLinkParseError("");
                    }}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="粘贴代理链接，例如：vless://..."
                  />
                  <button
                    onClick={() => {
                      const parsed = parseProxyLink(proxyLink);
                      if (parsed) {
                        setFormData({
                          name: parsed.name,
                          type: parsed.type,
                          host: parsed.host,
                          port: parsed.port,
                          username: parsed.username || "",
                          password: parsed.password || "",
                          vlessConfig: parsed.vlessConfig ? JSON.stringify(parsed.vlessConfig, null, 2) : "",
                          enabled: true,
                          priority: 0,
                          description: "",
                        });
                        setProxyLink("");
                        setLinkParseError("");
                      } else {
                        setLinkParseError("无法解析链接，请检查格式是否正确");
                      }
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors whitespace-nowrap"
                  >
                    解析并填充
                  </button>
                </div>
                {linkParseError && (
                  <p className="text-xs text-red-600 mt-2">{linkParseError}</p>
                )}
              </div>

              <div className="border-t pt-4" />
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">代理名称 *</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="例如：ISIF.JP VLESS代理"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">代理类型 *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="socks5">SOCKS5</option>
                  <option value="http">HTTP</option>
                  <option value="https">HTTPS</option>
                  <option value="vless">VLESS</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">服务器地址 *</label>
                  <input
                    type="text"
                    value={formData.host}
                    onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="例如：4.dfwenxin.com"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">端口 *</label>
                  <input
                    type="number"
                    value={formData.port}
                    onChange={(e) => setFormData({ ...formData, port: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="例如：30965"
                  />
                </div>
              </div>

              {(formData.type === "http" || formData.type === "https" || formData.type === "socks5") && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">用户名（可选）</label>
                    <input
                      type="text"
                      value={formData.username}
                      onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                      autoComplete="off"
                      name="proxy-username"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">密码（可选）</label>
                    <input
                      type="password"
                      value={formData.password}
                      onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                      autoComplete="new-password"
                      name="proxy-password"
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>
              )}

              {formData.type === "vless" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">VLESS配置（JSON格式）</label>
                  <textarea
                    value={formData.vlessConfig}
                    onChange={(e) => setFormData({ ...formData, vlessConfig: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                    rows={8}
                    placeholder={`{\n  "uuid": "...",\n  "tls": true,\n  "sni": "...",\n  "publicKey": "...",\n  "shortId": "...",\n  "path": "...",\n  "transport": "xhttp"\n}`}
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">优先级</label>
                  <input
                    type="number"
                    value={formData.priority}
                    onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="数字越大优先级越高"
                  />
                </div>
                <div className="flex items-center pt-7">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.enabled}
                      onChange={(e) => setFormData({ ...formData, enabled: e.target.checked })}
                      className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium text-gray-700">启用此代理</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">备注</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  rows={2}
                  placeholder="简要描述此代理的用途"
                />
              </div>
            </div>

            <div className="p-6 border-t flex justify-end gap-3 sticky bottom-0 bg-white">
              <button
                onClick={() => setIsDialogOpen(false)}
                className="px-4 py-2 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSave}
                disabled={!formData.name || !formData.host || !formData.port}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
