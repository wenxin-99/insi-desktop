/**
 * 网站运营助手 - 账号管理弹窗
 * 模板数据和类型已提取到 templates.tsx / types.ts
 */
import { useState, useEffect } from "react";
import type { SiteAccount, AutomationTask } from "./types";
import { apiFetch } from "./types";

// ─────────────────── 账号弹窗 ───────────────────

export function AccountModal({ open, onClose, onSave, editAccount }: {
  open: boolean; onClose: () => void;
  onSave: (data: any) => void; editAccount?: SiteAccount | null;
}) {
  const [form, setForm] = useState({ siteName: "", siteUrl: "", loginUrl: "", username: "", password: "", notes: "", cookies: "" });
  const [showCookieInput, setShowCookieInput] = useState(false);

  useEffect(() => {
    if (editAccount) {
      setForm({ siteName: editAccount.siteName, siteUrl: editAccount.siteUrl, loginUrl: editAccount.loginUrl, username: editAccount.username, password: "", notes: editAccount.notes || "", cookies: "" });
      setShowCookieInput(false);
    } else {
      setForm({ siteName: "", siteUrl: "", loginUrl: "", username: "", password: "", notes: "", cookies: "" });
      setShowCookieInput(false);
    }
  }, [editAccount, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <h3 className="text-lg font-bold">{editAccount ? "编辑站点账号" : "添加站点账号"}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">站点名称 *</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="如：V2EX、知乎、mpsboring"
              value={form.siteName} onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">站点首页 URL *</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://www.example.com"
              value={form.siteUrl} onChange={e => setForm(f => ({ ...f, siteUrl: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">登录页 URL *</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://www.example.com/signin"
              value={form.loginUrl} onChange={e => setForm(f => ({ ...f, loginUrl: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">用户名 *</label>
              <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密码 *</label>
              <input type="password" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">备注</label>
            <textarea className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>

          {/* ★ Cookie 导入 */}
          <div className="border-t pt-3">
            <button type="button" onClick={() => setShowCookieInput(!showCookieInput)}
              className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              {showCookieInput ? "收起 Cookie 导入 ↑" : "导入 Cookie（跳过登录）→"}
            </button>
            {showCookieInput && (
              <div className="mt-2 space-y-1">
                <p className="text-[11px] text-gray-500">
                  从浏览器扩展（如 EditThisCookie）导出 JSON 格式的 Cookie，粘贴到下方。导入后 Insi 可直接使用你的登录态，无需重新输入密码。
                </p>
                <textarea
                  className="w-full border rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  rows={4}
                  placeholder='[{"name":"session","value":"abc123","domain":".example.com","path":"/"}]'
                  value={form.cookies}
                  onChange={e => setForm(f => ({ ...f, cookies: e.target.value }))}
                />
              </div>
            )}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">取消</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            {editAccount ? "保存修改" : "添加账号"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── 模板选择弹窗 ───────────────────
