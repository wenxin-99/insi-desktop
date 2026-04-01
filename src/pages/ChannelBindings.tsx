/**
 * 渠道绑定管理页面（绑定码模式）
 *
 * 流程：用户点"绑定" → 生成 6 位绑定码 → 去 Bot 发送码 → 自动完成绑定
 */
import { useState, useEffect, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { useLocation } from "wouter";
import {
  ArrowLeft, Trash2, Loader2, Check, Copy,
  MessageCircle, Send, Globe, Info, ChevronDown,
} from "lucide-react";

// ═══════════ 渠道定义 ═══════════

const CHANNELS = [
  {
    id: "telegram",
    label: "Telegram",
    icon: "✈️",
    color: "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-950/30 dark:text-blue-400 dark:border-blue-800",
    description: "通过 Telegram Bot 与 Insi 对话",
    botName: "Bot",
  },
  {
    id: "feishu",
    label: "飞书",
    icon: "💬",
    color: "bg-indigo-50 text-indigo-600 border-indigo-200 dark:bg-indigo-950/30 dark:text-indigo-400 dark:border-indigo-800",
    description: "在飞书中 @Insi助手 下达指令",
    botName: "Insi 机器人",
  },
  {
    id: "wechat_work",
    label: "企业微信",
    icon: "💚",
    color: "bg-green-50 text-green-600 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-800",
    description: "在企业微信中与 Insi 应用对话",
    botName: "Insi 应用",
  },
  {
    id: "webhook",
    label: "通用 Webhook",
    icon: "🔗",
    color: "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800",
    description: "桥接个人微信、Discord 或任意系统",
    botName: "Webhook",
    manualOnly: true,
  },
];

// ═══════════ API ═══════════

function getAuthToken(): string {
  return localStorage.getItem("auth_token") || "";
}

async function apiFetch(path: string, options: RequestInit = {}) {
  const token = getAuthToken();
  const res = await fetch(path, {
    ...options,
    headers: { "Authorization": `Bearer ${token}`, "Content-Type": "application/json", ...options.headers },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `请求失败 (${res.status})`);
  return data;
}

// ═══════════ 主页面 ═══════════

export default function ChannelBindings() {
  const [, setLocation] = useLocation();
  const [bindings, setBindings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // 绑定码状态
  const [bindingChannel, setBindingChannel] = useState<string | null>(null);
  const [bindCode, setBindCode] = useState<string | null>(null);
  const [codeLoading, setCodeLoading] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Webhook 手动绑定
  const [webhookUserId, setWebhookUserId] = useState("");
  const [webhookCallback, setWebhookCallback] = useState("");

  const loadBindings = async () => {
    try {
      setLoading(true);
      const data = await apiFetch("/api/channels/bindings");
      setBindings(data.bindings || []);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { loadBindings(); }, []);

  // 倒计时
  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => c <= 1 ? 0 : c - 1), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  // 轮询检查绑定是否完成
  useEffect(() => {
    if (!bindCode || !bindingChannel) return;
    const interval = setInterval(async () => {
      try {
        const data = await apiFetch("/api/channels/bindings");
        const newBindings = data.bindings || [];
        const justBound = newBindings.find((b: any) =>
          b.channel === bindingChannel && b.isActive && !bindings.some((ob: any) => ob.id === b.id && ob.isActive)
        );
        if (justBound) {
          setBindings(newBindings);
          setBindCode(null);
          setBindingChannel(null);
          setCountdown(0);
          setSuccess("绑定成功！现在可以在对应平台上与 Insi 对话了。");
          setTimeout(() => setSuccess(""), 4000);
          clearInterval(interval);
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [bindCode, bindingChannel]);

  // 生成绑定码
  const handleGenerateCode = async (channelId: string) => {
    setError("");
    setCodeLoading(true);
    try {
      const data = await apiFetch("/api/channels/bindings/code", {
        method: "POST",
        body: JSON.stringify({ channel: channelId }),
      });
      setBindCode(String(data.code));
      setBindingChannel(channelId);
      setCountdown(data.expiresInSeconds || 300);
    } catch (e: any) {
      setError(e.message);
    } finally { setCodeLoading(false); }
  };

  // 复制绑定码
  const handleCopy = () => {
    if (!bindCode) return;
    navigator.clipboard.writeText(bindCode).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  // Webhook 手动绑定
  const handleWebhookBind = async () => {
    if (!webhookUserId.trim()) { setError("请填写用户标识"); return; }
    setError("");
    try {
      await apiFetch("/api/channels/bindings", {
        method: "POST",
        body: JSON.stringify({
          channel: "webhook",
          channelUserId: webhookUserId.trim(),
          channelConfig: webhookCallback ? { callbackUrl: webhookCallback } : {},
        }),
      });
      setSuccess("绑定成功！");
      setWebhookUserId("");
      setWebhookCallback("");
      setBindingChannel(null);
      loadBindings();
      setTimeout(() => setSuccess(""), 3000);
    } catch (e: any) { setError(e.message); }
  };

  // 解绑
  const handleDelete = async (id: number, label: string) => {
    if (!confirm(`确定要解绑 ${label} 吗？`)) return;
    try {
      await apiFetch(`/api/channels/bindings/${id}`, { method: "DELETE" });
      loadBindings();
    } catch (e: any) { setError(e.message); }
  };

  const boundChannels = new Set(bindings.filter(b => b.isActive).map((b: any) => b.channel));
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => window.history.back()} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <MessageCircle className="w-6 h-6 text-blue-500" /> 渠道管理
            </h1>
            <p className="text-xs text-gray-400 mt-0.5">绑定通讯平台，在飞书/Telegram/企微直接与 AI 对话</p>
          </div>
        </div>

        {success && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-950/30 text-green-700 dark:text-green-400 rounded-xl text-sm flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />{success}
          </div>
        )}
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 rounded-xl text-sm">
            {error}<button onClick={() => setError("")} className="ml-2 underline">关闭</button>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载中...</div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-2xl border border-blue-100 dark:border-blue-900/50 text-sm text-blue-700 dark:text-blue-300">
              <Info className="w-4 h-4 shrink-0 mt-0.5" />
              <p>点击「绑定」会生成一个 6 位绑定码，复制后去对应平台发送给 Bot 即可完成绑定。</p>
            </div>

            {/* 已绑定 */}
            {bindings.filter(b => b.isActive).length > 0 && (
              <section>
                <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">已绑定</h2>
                <div className="space-y-2">
                  {bindings.filter(b => b.isActive).map((binding: any) => {
                    const channel = CHANNELS.find(c => c.id === binding.channel);
                    return (
                      <div key={String(binding.id)} className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-700">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${channel?.color || "bg-gray-100"}`}>
                          {channel?.icon || "📡"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-sm">{channel?.label || String(binding.channel)}</div>
                          <div className="text-xs text-gray-400 truncate">ID: {String(binding.channelUserId)}</div>
                        </div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600">已连接</span>
                        <button onClick={() => handleDelete(binding.id, channel?.label || String(binding.channel))}
                          className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/30 text-gray-300 hover:text-red-500 transition-colors"
                          title="解绑"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* 添加绑定 */}
            <section>
              <h2 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
                {boundChannels.size > 0 ? "添加更多渠道" : "选择渠道绑定"}
              </h2>
              <div className="space-y-2">
                {CHANNELS.map(channel => {
                  const isBound = boundChannels.has(channel.id);
                  const isActive = bindingChannel === channel.id;
                  const isCodeChannel = isActive && bindCode && channel.id !== "webhook";
                  const isWebhookForm = isActive && channel.id === "webhook";

                  return (
                    <div key={channel.id}
                      className={`bg-white dark:bg-gray-900 rounded-xl border overflow-hidden transition-all ${
                        isActive ? "border-blue-300 dark:border-blue-700 shadow-sm" : "border-gray-200 dark:border-gray-700"
                      }`}>
                      {/* 头部 */}
                      <button
                        onClick={() => {
                          if (isBound) return;
                          if (isActive) { setBindingChannel(null); setBindCode(null); setCountdown(0); return; }
                          setBindingChannel(channel.id);
                          setBindCode(null);
                          setError("");
                          if (!channel.manualOnly) handleGenerateCode(channel.id);
                        }}
                        disabled={isBound}
                        className={`w-full flex items-center gap-3 p-4 text-left transition-colors ${isBound ? "opacity-50 cursor-not-allowed" : "hover:bg-gray-50 dark:hover:bg-gray-800/50"}`}>
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${channel.color}`}>{channel.icon}</div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{channel.label}</div>
                          <div className="text-xs text-gray-400">{channel.description}</div>
                        </div>
                        {isBound ? <span className="text-xs text-green-500">已绑定</span>
                          : <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isActive ? "rotate-180" : ""}`} />}
                      </button>

                      {/* 绑定码显示（非 Webhook） */}
                      {isActive && !channel.manualOnly && (
                        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3">
                          {codeLoading ? (
                            <div className="flex items-center justify-center py-6 text-gray-400">
                              <Loader2 className="w-5 h-5 animate-spin mr-2" /> 生成绑定码...
                            </div>
                          ) : bindCode ? (
                            <div className="space-y-3">
                              {/* 绑定码 */}
                              <div className="text-center">
                                <p className="text-xs text-gray-500 mb-2">你的绑定码（{formatTime(countdown)} 后过期）</p>
                                <div className="flex items-center justify-center gap-2">
                                  <div className="text-3xl font-mono font-bold tracking-[0.3em] text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 px-6 py-3 rounded-xl select-all">
                                    {bindCode}
                                  </div>
                                  <button onClick={handleCopy}
                                    className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 hover:text-blue-500 transition-colors"
                                    title="复制">
                                    {codeCopied ? <Check className="w-5 h-5 text-green-500" /> : <Copy className="w-5 h-5" />}
                                  </button>
                                </div>
                              </div>

                              {/* 步骤说明 */}
                              <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-600 dark:text-gray-400 space-y-1.5">
                                <div className="flex gap-2"><span className="text-blue-500 font-semibold">1.</span><span>复制上方 6 位绑定码</span></div>
                                <div className="flex gap-2"><span className="text-blue-500 font-semibold">2.</span><span>打开 {channel.label}，找到{channel.botName}</span></div>
                                <div className="flex gap-2"><span className="text-blue-500 font-semibold">3.</span><span>发送绑定码给 {channel.botName}</span></div>
                                <div className="flex gap-2"><span className="text-blue-500 font-semibold">4.</span><span>收到「绑定成功」回复即完成，此页面会自动更新</span></div>
                              </div>

                              {/* 状态 */}
                              {countdown > 0 && (
                                <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                  <span>等待绑定中...</span>
                                </div>
                              )}

                              {countdown <= 0 && (
                                <button onClick={() => handleGenerateCode(channel.id)}
                                  className="w-full text-center text-xs text-blue-500 hover:text-blue-600 py-1">
                                  绑定码已过期，点击重新生成
                                </button>
                              )}
                            </div>
                          ) : null}
                        </div>
                      )}

                      {/* Webhook 手动表单 */}
                      {isWebhookForm && (
                        <div className="px-4 pb-4 border-t border-gray-100 dark:border-gray-800 pt-3 space-y-3">
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">用户标识 <span className="text-red-400">*</span></label>
                            <input type="text" value={webhookUserId} onChange={e => setWebhookUserId(e.target.value)}
                              placeholder="自定义 ID（如微信号、Discord ID）"
                              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1 block">回调地址（可选）</label>
                            <input type="text" value={webhookCallback} onChange={e => setWebhookCallback(e.target.value)}
                              placeholder="https://your-server/reply"
                              className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-lg px-3 py-2 text-sm" />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button onClick={() => setBindingChannel(null)}
                              className="px-3 py-1.5 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg">取消</button>
                            <button onClick={handleWebhookBind}
                              className="px-4 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">绑定</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
