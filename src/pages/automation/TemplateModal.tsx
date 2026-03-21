/**
 * 网站运营助手 - 模板选择弹窗
 * 模板数据和类型已提取到 templates.tsx / types.ts
 */
import { useState, useEffect } from "react";
import { ArrowLeft, Play, Plus, Sparkles, Zap } from "lucide-react";
import type { SiteAccount, Template } from "./types";
import { TEMPLATES, TEMPLATE_CATEGORIES } from "./templates";

export function TemplateModal({ open, onClose, onStart, accounts }: {
  open: boolean; onClose: () => void;
  onStart: (data: any) => void; accounts: SiteAccount[];
}) {
  const [category, setCategory] = useState("all");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedAccount, setSelectedAccount] = useState<number>(0);
  const [customInstruction, setCustomInstruction] = useState("");
  const [multiAccounts, setMultiAccounts] = useState<number[]>([]);
  const [showCustom, setShowCustom] = useState(false);
  const [customForm, setCustomForm] = useState({ name: "", instruction: "", taskType: "custom" });

  useEffect(() => {
    if (!open) {
      setSelectedTemplate(null); setSelectedAccount(0); setCustomInstruction("");
      setMultiAccounts([]); setShowCustom(false);
      setCustomForm({ name: "", instruction: "", taskType: "custom" });
    }
  }, [open]);

  useEffect(() => {
    if (selectedTemplate && selectedAccount > 0) {
      const acct = accounts.find(a => a.id === selectedAccount);
      if (acct) setCustomInstruction(selectedTemplate.buildInstruction(acct));
    }
  }, [selectedTemplate, selectedAccount, accounts]);

  if (!open) return null;

  const filtered = category === "all" ? TEMPLATES : TEMPLATES.filter(t => t.category === category);

  if (selectedTemplate) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
          <button onClick={() => setSelectedTemplate(null)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
            <ArrowLeft className="w-4 h-4" /> 返回模板选择
          </button>
          <div className={`flex items-center gap-3 p-3 rounded-xl border ${selectedTemplate.color}`}>
            {selectedTemplate.icon}
            <div>
              <div className="font-semibold text-sm">{selectedTemplate.title}</div>
              <div className="text-xs opacity-80">{selectedTemplate.desc}</div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">选择站点账号 *</label>
            {accounts.length === 0 ? (
              <p className="text-sm text-red-500">请先添加站点账号</p>
            ) : (
              <div className="space-y-2">
                {accounts.map(a => (
                  <label key={a.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${selectedAccount === a.id ? "border-blue-500 bg-blue-50" : "hover:border-gray-300"}`}>
                    <input type="radio" name="account" value={a.id} checked={selectedAccount === a.id}
                      onChange={() => setSelectedAccount(a.id)} className="text-blue-500" />
                    <div>
                      <div className="text-sm font-medium">{a.siteName}</div>
                      <div className="text-xs text-gray-500">{a.username} · {a.siteUrl}</div>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">任务指令（可修改）</label>
            <textarea className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[100px]"
              value={customInstruction} onChange={e => setCustomInstruction(e.target.value)} />
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">取消</button>
            <button
              disabled={selectedAccount === 0 || !customInstruction}
              onClick={() => onStart({
                siteAccountId: selectedAccount,
                taskType: selectedTemplate.taskType,
                name: selectedTemplate.title,
                instruction: customInstruction,
                targetUrls: [],
                searchKeywords: [],
                contentStyle: "professional",
              })}
              className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
            >
              <Play className="w-4 h-4" /> 立即执行
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl p-6 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" /> 选择任务模板
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">✕</button>
        </div>

        {/* 分类筛选 */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-4">
          {TEMPLATE_CATEGORIES.map(cat => (
            <button key={cat.id}
              onClick={() => setCategory(cat.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-all ${category === cat.id ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
              {cat.icon} {cat.label}
            </button>
          ))}
        </div>

        {/* 模板网格 */}
        <div className="grid grid-cols-2 gap-3 overflow-y-auto pr-1">
          {filtered.map(tpl => (
            <button key={tpl.id} onClick={() => setSelectedTemplate(tpl)}
              className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md hover:-translate-y-0.5 ${tpl.color}`}>
              <div className="flex items-center gap-2 mb-2">
                {tpl.icon}
                <span className="font-semibold text-sm">{tpl.title}</span>
              </div>
              <p className="text-xs opacity-75 mb-3 leading-relaxed">{tpl.desc}</p>
              <div className="flex items-center justify-between">
                <div className="flex gap-1 flex-wrap">
                  {tpl.tags.map(tag => (
                    <span key={tag} className="text-xs px-1.5 py-0.5 rounded-full bg-white/60 font-medium">#{tag}</span>
                  ))}
                </div>
                <div className="flex items-center gap-1 text-xs opacity-60">
                  <Zap className="w-3 h-3" /> ~{tpl.estimatedSteps}步
                </div>
              </div>
            </button>
          ))}
        </div>

        {/* 自定义入口 */}
        <div className="mt-4 pt-4 border-t">
          {!showCustom ? (
            <button onClick={() => setShowCustom(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 border-2 border-dashed border-gray-300 rounded-xl text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
              <Plus className="w-4 h-4" /> 自定义任务指令
            </button>
          ) : (
            <div className="space-y-3 p-4 bg-gray-50 rounded-xl border">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">自定义任务</span>
                <button onClick={() => setShowCustom(false)} className="text-xs text-gray-400 hover:text-gray-600">收起</button>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">选择账号 *</label>
                <select className="w-full border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={selectedAccount} onChange={e => setSelectedAccount(Number(e.target.value))}>
                  <option value={0}>请选择站点账号...</option>
                  {accounts.map(a => <option key={a.id} value={a.id}>{a.siteName} - {a.username}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">任务名称 *</label>
                <input className="w-full border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="如：V2EX 技术互动"
                  value={customForm.name} onChange={e => setCustomForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">任务指令 *</label>
                <textarea className="w-full border rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[80px]"
                  placeholder="详细描述要执行的操作，例如：登录 V2EX，浏览技术板块，找到最新帖子回复..."
                  value={customForm.instruction} onChange={e => setCustomForm(f => ({ ...f, instruction: e.target.value }))} />
              </div>
              <button
                disabled={selectedAccount === 0 || !customForm.name || !customForm.instruction}
                onClick={() => onStart({
                  siteAccountId: selectedAccount,
                  taskType: "custom",
                  name: customForm.name,
                  instruction: customForm.instruction,
                  targetUrls: [],
                  searchKeywords: [],
                  contentStyle: "professional",
                })}
                className="w-full py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
                <Play className="w-4 h-4" /> 执行自定义任务
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────── 步骤时间线 ───────────────────
