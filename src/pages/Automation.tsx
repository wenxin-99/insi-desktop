/**
 * Automation — 网站运营助手页面
 *
 * 拆分自原 589 行单文件。子模块：
 *   automation/types.ts        - 类型 + apiFetch
 *   automation/templates.tsx   - 模板分类 + 12 个预设模板数据
 *   automation/useAutomation.ts - 状态管理 hook
 *   automation/AccountModal    - 账号弹窗（已有）
 *   automation/TemplateModal   - 模板弹窗（已有）
 *   automation/TaskCard        - 任务卡片（已有）
 *   automation/StepTimeline    - 步骤时间线（已有）
 *   automation/AutomationSandbox - 沙箱（已有）
 */
import { useState } from "react";
import {
  Bot, Plus, Settings, Clock, AlertCircle, CheckCircle, Loader2,
  RefreshCw, Key, Link, ExternalLink, Zap, ArrowLeft, Sparkles,
  ListTodo, Globe, Trash2, Pause, Square, ChevronRight,
} from "lucide-react";
import { TEMPLATES } from "./automation/templates";
import { useAutomation } from "./automation/useAutomation";
import { AccountModal } from "./automation/AccountModal";
import { TemplateModal } from "./automation/TemplateModal";
import { StepTimeline } from "./automation/StepTimeline";
import { AutomationSandbox } from "./automation/AutomationSandbox";
import { TaskCard } from "./automation/TaskCard";
import { apiFetch } from "./automation/types";
import TaskTemplates from "./automation/TaskTemplates";
import DashboardLayout from '@/components/DashboardLayout';

export default function Automation() {
  const a = useAutomation();
  const [showTemplates, setShowTemplates] = useState(false);

  // ── 快速执行模板页面 ──
  if (showTemplates) {
    return (
      <DashboardLayout>
        <TaskTemplates onBack={() => setShowTemplates(false)} />
      </DashboardLayout>
    );
  }

  // ── 沙箱实时视图 ──
  if (a.viewingTaskId) {
    return (
      <DashboardLayout>
      <div className="h-screen flex flex-col bg-gray-50">
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b shadow-sm">
          <div className="flex items-center gap-3">
            <button onClick={() => { a.setViewingTaskId(null); a.setTaskDetail(null); }} className="p-2 rounded-xl hover:bg-gray-100">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h2 className="font-bold text-sm">{a.taskDetail?.task.name || `任务 #${a.viewingTaskId}`}</h2>
              <p className="text-xs text-gray-500">{a.taskDetail?.account?.siteName} · {a.taskDetail?.task.status === "running" ? "实时执行中" : a.taskDetail?.task.status}</p>
            </div>
          </div>
          {a.taskDetail?.task.status === "running" && (
            <div className="flex items-center gap-2">
              <button onClick={() => a.handlePauseTask(a.viewingTaskId!)} className="px-3 py-1.5 text-xs bg-yellow-100 text-yellow-700 rounded-xl hover:bg-yellow-200">
                <Pause className="w-3.5 h-3.5 inline mr-1" /> 暂停
              </button>
              <button onClick={() => a.handleCancelTask(a.viewingTaskId!)} className="px-3 py-1.5 text-xs bg-red-100 text-red-700 rounded-xl hover:bg-red-200">
                <Square className="w-3.5 h-3.5 inline mr-1" /> 取消
              </button>
            </div>
          )}
        </div>
        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 p-4"><AutomationSandbox taskId={a.viewingTaskId} /></div>
          <div className="w-[380px] border-l bg-white overflow-y-auto">
            <div className="p-4">
              <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" /> 执行步骤
                {a.taskDetail?.steps && <span className="text-xs text-gray-400 font-normal">共 {a.taskDetail.steps.length} 步</span>}
              </h3>
              {a.taskDetail?.steps?.length ? (
                <StepTimeline steps={a.taskDetail.steps} taskId={a.viewingTaskId} />
              ) : (
                <div className="text-center text-gray-400 text-sm mt-10">
                  <Clock className="w-10 h-10 mx-auto opacity-20 mb-2" /><p>等待任务执行...</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </DashboardLayout>
    );
  }

  // ── 主列表 ──
  const openTemplates = () => {
    if (a.accounts.length === 0) { alert("请先在「站点账号」中添加账号"); a.setActiveTab("accounts"); return; }
    a.setShowTemplateModal(true);
  };

  return (
    <DashboardLayout>
    <div className="min-h-screen bg-gray-50">
      {/* 页头 */}
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button onClick={() => window.history.back()} className="p-2 rounded-xl hover:bg-gray-100">
                <ArrowLeft className="w-5 h-5 text-gray-500" />
              </button>
              <div>
                <h1 className="text-xl font-bold flex items-center gap-2"><Bot className="w-6 h-6 text-blue-600" /> 网站运营助手</h1>
                <p className="text-xs text-gray-400 mt-0.5">Insi 帮你自动化运营，赚积分兑鱼币</p>
              </div>
            </div>
            <button onClick={a.loadData} className="p-2 rounded-xl hover:bg-gray-100 text-gray-400">
              <RefreshCw className={`w-5 h-5 ${a.loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {a.tasks.length > 0 && (
            <div className="flex gap-3 mt-4">
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-green-500" /> {a.completedCount} 已完成
              </div>
              {a.runningCount > 0 && (
                <div className="flex items-center gap-1.5 text-xs text-blue-600 bg-blue-50 rounded-xl px-3 py-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> {a.runningCount} 执行中
                </div>
              )}
              <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 rounded-xl px-3 py-1.5">
                <ListTodo className="w-3.5 h-3.5" /> {a.tasks.length} 总任务
              </div>
            </div>
          )}

          <div className="flex items-center gap-1 mt-4">
            {[
              { id: "tasks", label: "自动化任务", icon: <Zap className="w-4 h-4" /> },
              { id: "accounts", label: "站点账号", icon: <Key className="w-4 h-4" /> },
            ].map(tab => (
              <button key={tab.id}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl transition-colors ${a.activeTab === tab.id ? "bg-blue-100 text-blue-700" : "text-gray-500 hover:bg-gray-100"}`}
                onClick={() => a.setActiveTab(tab.id as any)}>
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-6">
        {a.error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /> {a.error}
          </div>
        )}

        {/* 任务列表 */}
        {a.activeTab === "tasks" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">任务列表</h2>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowTemplates(true)} className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white rounded-xl text-sm hover:bg-amber-600 shadow-sm">
                  <Zap className="w-4 h-4" /> 快速执行
                </button>
                <button onClick={openTemplates} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 shadow-sm">
                  <Sparkles className="w-4 h-4" /> 从模板创建
                </button>
              </div>
            </div>

            {a.loading && a.tasks.length === 0 ? (
              <div className="text-center py-20 text-gray-400"><Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" /><p>加载中...</p></div>
            ) : a.tasks.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto mb-4"><Bot className="w-10 h-10 text-blue-300" /></div>
                <p className="text-lg font-semibold text-gray-700 mb-1">开始你的第一个自动化任务</p>
                <p className="text-sm text-gray-400 mb-6">选择模板，Insi 帮你自动完成论坛签到、发帖、回复等操作</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-2xl mx-auto mb-6">
                  {TEMPLATES.slice(0, 4).map(tpl => (
                    <button key={tpl.id} onClick={openTemplates} className={`p-3 rounded-2xl border-2 text-left transition-all hover:shadow-md ${tpl.color}`}>
                      <div className="mb-1.5">{tpl.icon}</div>
                      <div className="text-xs font-semibold">{tpl.title}</div>
                      <div className="text-xs opacity-60 mt-0.5">{tpl.desc.slice(0, 20)}...</div>
                    </button>
                  ))}
                </div>
                <button onClick={openTemplates} className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700 shadow">
                  <Sparkles className="w-4 h-4" /> 浏览全部模板 <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {a.tasks.map(task => (
                  <TaskCard key={task.id} task={task}
                    onStart={() => a.handleStartTask(task.id)}
                    onPause={() => a.handlePauseTask(task.id)}
                    onCancel={() => a.handleCancelTask(task.id)}
                    onDelete={() => a.handleDeleteTask(task.id)}
                    onView={() => a.handleStartTask(task.id)}
                    onRetry={() => a.handleRetryTask(task)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* 站点账号 */}
        {a.activeTab === "accounts" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-base">站点账号</h2>
              <button onClick={() => { a.setEditAccount(null); a.setShowAccountModal(true); }} className="flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700">
                <Plus className="w-4 h-4" /> 添加账号
              </button>
            </div>
            {a.accounts.length === 0 ? (
              <div className="text-center py-20 text-gray-400">
                <Key className="w-16 h-16 mx-auto opacity-20 mb-3" />
                <p className="font-medium">还没有站点账号</p>
                <p className="text-sm mt-1">添加要自动操作的网站账号（如论坛、社交媒体）</p>
                <button onClick={() => { a.setEditAccount(null); a.setShowAccountModal(true); }} className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-xl text-sm hover:bg-blue-700">
                  <Plus className="w-4 h-4 inline mr-1" /> 添加第一个账号
                </button>
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {a.accounts.map(account => (
                  <div key={account.id} className="bg-white rounded-2xl border p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-100 to-indigo-100 flex items-center justify-center">
                          <Globe className="w-5 h-5 text-blue-600" />
                        </div>
                        <div><h4 className="font-semibold text-sm">{account.siteName}</h4><p className="text-xs text-gray-500">{account.username}</p></div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => { a.setEditAccount(account); a.setShowAccountModal(true); }} className="p-1.5 rounded-xl hover:bg-gray-100"><Settings className="w-4 h-4 text-gray-400" /></button>
                        <button onClick={() => a.handleDeleteAccount(account.id)} className="p-1.5 rounded-xl hover:bg-red-50"><Trash2 className="w-4 h-4 text-red-400" /></button>
                      </div>
                    </div>
                    <div className="mt-3 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <Link className="w-3 h-3" />
                        <a href={account.siteUrl} target="_blank" rel="noopener" className="hover:text-blue-600 truncate">{account.siteUrl}</a>
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </div>
                      {account.lastLoginAt && (
                        <div className="flex items-center gap-1.5 text-xs text-gray-400">
                          <Clock className="w-3 h-3" /><span>上次登录：{new Date(account.lastLoginAt).toLocaleString()}</span>
                          {account.lastLoginSuccess ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <AlertCircle className="w-3.5 h-3.5 text-red-500" />}
                        </div>
                      )}
                      {account.loginFailCount > 0 && <p className="text-xs text-red-500">连续失败 {account.loginFailCount} 次，请检查密码</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <AccountModal open={a.showAccountModal} onClose={() => { a.setShowAccountModal(false); a.setEditAccount(null); }}
        onSave={a.handleSaveAccount} editAccount={a.editAccount} />
      <TemplateModal open={a.showTemplateModal} onClose={() => a.setShowTemplateModal(false)}
        onStart={a.handleSaveTask} accounts={a.accounts} />
    </div>
    </DashboardLayout>
  );
}
