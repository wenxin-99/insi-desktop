/**
 * 管理员 — 渠道配置管理
 * src/pages/admin/ChannelSettings.tsx
 */
import { useState, useEffect } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import {
  ArrowLeft, Save, Loader2, Check, MessageCircle,
  Bot, Users, Settings, Info,
} from "lucide-react";

const CHANNEL_LABELS: Record<string, string> = {
  feishu: "💬 飞书", wechat_work: "💚 企微", telegram: "✈️ TG", webhook: "🔗 Webhook",
};

export default function ChannelSettings() {
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const configQuery = trpc.channelConfig.get.useQuery();
  const modelsQuery = trpc.channelConfig.models.useQuery();
  const packagesQuery = trpc.channelConfig.packages.useQuery();
  const updateMutation = trpc.channelConfig.update.useMutation({
    onSuccess: () => { setSaveStatus("saved"); configQuery.refetch(); setTimeout(() => setSaveStatus("idle"), 2000); },
  });

  const configs: Record<string, string> = configQuery.data?.configs || {};
  const bindingStats: any[] = configQuery.data?.bindingStats || [];
  const models: any[] = modelsQuery.data || [];
  const packages: any[] = packagesQuery.data || [];

  const [formData, setFormData] = useState<Record<string, string>>({});

  useEffect(() => {
    if (configQuery.data) {
      setFormData({
        channel_default_package_id: String(configs.channel_default_package_id || ""),
        channel_default_model_id: String(configs.channel_default_model_id || "5"),
        channel_max_history_messages: String(configs.channel_max_history_messages || "20"),
        channel_reply_timeout_ms: String(configs.channel_reply_timeout_ms || "120000"),
      });
    }
  }, [configQuery.data]);

  const handleSave = () => { setSaveStatus("saving"); updateMutation.mutate(formData); };
  const hasChanges = Object.entries(formData).some(([k, v]) => v !== String(configs[k] || ""));
  const totalBindings = bindingStats.reduce((s: number, r: any) => s + Number(r.count || 0), 0);
  const activeBindings = bindingStats.reduce((s: number, r: any) => s + Number(r.active || 0), 0);
  const hasPackage = !!formData.channel_default_package_id;

  return (
    <DashboardLayout>
      <div className="max-w-3xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => window.history.back()} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500"><ArrowLeft className="w-5 h-5" /></button>
          <div className="flex-1">
            <h1 className="text-xl font-bold flex items-center gap-2"><MessageCircle className="w-6 h-6 text-blue-500" /> 渠道配置</h1>
            <p className="text-xs text-gray-400 mt-0.5">管理通讯平台接入参数，设置默认套餐/模型</p>
          </div>
          <button onClick={handleSave} disabled={!hasChanges || saveStatus === "saving"}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium transition-all ${saveStatus === "saved" ? "bg-green-100 text-green-700" : hasChanges ? "bg-blue-600 text-white hover:bg-blue-700" : "bg-gray-100 text-gray-400 cursor-not-allowed"}`}>
            {saveStatus === "saving" ? <Loader2 className="w-4 h-4 animate-spin" /> : saveStatus === "saved" ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saveStatus === "saved" ? "已保存" : "保存"}
          </button>
        </div>

        {configQuery.isLoading ? (
          <div className="flex items-center justify-center py-20 text-gray-400"><Loader2 className="w-6 h-6 animate-spin mr-2" /> 加载中...</div>
        ) : (
          <div className="space-y-6">
            {/* 绑定统计 */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 p-5">
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Users className="w-4 h-4" /> 绑定统计</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="text-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-xl">
                  <div className="text-2xl font-bold text-blue-600">{totalBindings}</div>
                  <div className="text-xs text-gray-500 mt-1">总绑定</div>
                </div>
                <div className="text-center p-3 bg-green-50 dark:bg-green-950/30 rounded-xl">
                  <div className="text-2xl font-bold text-green-600">{activeBindings}</div>
                  <div className="text-xs text-gray-500 mt-1">活跃</div>
                </div>
                {bindingStats.map((stat: any, idx: number) => (
                  <div key={idx} className="text-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl">
                    <div className="text-lg font-semibold">{String(Number(stat.active || 0))}</div>
                    <div className="text-xs text-gray-500 mt-1">{CHANNEL_LABELS[String(stat.channel)] || String(stat.channel)}</div>
                  </div>
                ))}
              </div>
            </section>

            {/* 默认套餐 */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl border-2 border-blue-200 dark:border-blue-800 overflow-hidden">
              <div className="px-5 py-3 border-b border-blue-100 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 flex items-center gap-2">
                <Bot className="w-5 h-5 text-blue-600" />
                <div>
                  <h2 className="text-sm font-semibold text-blue-700 dark:text-blue-300">默认模型套餐（推荐）</h2>
                  <p className="text-xs text-blue-500">套餐含聊天/视觉/思考模型，渠道消息自动匹配</p>
                </div>
              </div>
              <div className="p-5">
                <select value={formData.channel_default_package_id || ""}
                  onChange={e => setFormData(prev => ({ ...prev, channel_default_package_id: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm">
                  <option value="">不使用套餐（回退到下方单模型）</option>
                  {packages.map((p: any) => (
                    <option key={String(p.id)} value={String(p.id)}>
                      {String(p.displayName || p.name || "")} (ID: {String(p.id)})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-3 flex items-start gap-1.5">
                  <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  <span>选套餐后，TG/飞书/企微消息自动用聊天模型，发图片用视觉模型，深度思考用思考模型。</span>
                </p>
              </div>
            </section>

            {/* 回退模型 */}
            <section className={`bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden ${hasPackage ? "opacity-50" : ""}`}>
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <Bot className="w-5 h-5 text-gray-500" />
                <h2 className="text-sm font-semibold">回退单模型 {hasPackage ? "(已选套餐，不生效)" : ""}</h2>
              </div>
              <div className="p-5">
                <select value={formData.channel_default_model_id || ""} disabled={hasPackage}
                  onChange={e => setFormData(prev => ({ ...prev, channel_default_model_id: e.target.value }))}
                  className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2.5 text-sm disabled:opacity-50">
                  <option value="">请选择模型</option>
                  {models.map((m: any) => (
                    <option key={String(m.id)} value={String(m.id)}>
                      {String(m.displayName || m.name || "")} (ID: {String(m.id)}, {String(m.costPerUse)} 🐟/次)
                    </option>
                  ))}
                </select>
              </div>
            </section>

            {/* 高级参数 */}
            <section className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800 flex items-center gap-2">
                <Settings className="w-5 h-5 text-gray-500" /><h2 className="text-sm font-semibold">高级参数</h2>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">对话历史最大条数</label>
                  <input type="number" value={formData.channel_max_history_messages || "20"} min={0} max={50}
                    onChange={e => setFormData(prev => ({ ...prev, channel_max_history_messages: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm" />
                  <p className="text-xs text-gray-400 mt-1">0 = 单轮对话</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">回复超时（毫秒）</label>
                  <input type="number" value={formData.channel_reply_timeout_ms || "120000"} step={10000} min={10000} max={300000}
                    onChange={e => setFormData(prev => ({ ...prev, channel_reply_timeout_ms: e.target.value }))}
                    className="w-full border border-gray-200 dark:border-gray-700 dark:bg-gray-800 rounded-xl px-3 py-2 text-sm" />
                  <p className="text-xs text-gray-400 mt-1">默认 120000（2 分钟）</p>
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
