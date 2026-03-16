/**
 * SSHSettings — SSH/VPS 配置页面
 *
 * 拆分自原 800 行单文件。子模块：
 *   types.ts         - 类型与常量
 *   useSSHSettings.ts - 状态管理 hook
 *   SSHConfigForm.tsx - 新建/编辑表单
 *   SSHConfigCard.tsx - 配置列表卡片
 *   SandboxPanel.tsx  - 沙箱控制面板
 */
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Loader2, Server } from "lucide-react";
import { useSSHSettings } from "./sshSettings/useSSHSettings";
import { SSHConfigForm } from "./sshSettings/SSHConfigForm";
import { SSHConfigCard } from "./sshSettings/SSHConfigCard";

export default function SSHSettings() {
  const [, navigate] = useLocation();
  const s = useSSHSettings();

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-4 md:p-6">
        {/* 头部 */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/system-settings")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">SSH / VPS 配置</h1>
            <p className="text-sm text-gray-500 mt-1">管理远程服务器连接，供 Agent 执行命令和编辑文件</p>
          </div>
        </div>

        {/* 添加按钮 */}
        {!s.showForm && (
          <Button onClick={() => s.setShowForm(true)} className="mb-4">
            <Plus className="h-4 w-4 mr-2" /> 添加 SSH 配置
          </Button>
        )}

        {/* 表单 */}
        {s.showForm && (
          <SSHConfigForm
            form={s.form}
            setForm={s.setForm}
            editingId={s.editingId}
            saving={s.saving}
            onSave={s.handleSave}
            onCancel={s.resetForm}
          />
        )}

        {/* 配置列表 */}
        {s.loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        ) : s.configs.length === 0 && !s.showForm ? (
          <Card>
            <CardContent className="py-12 text-center text-gray-400">
              <Server className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>暂无 SSH 配置</p>
              <p className="text-sm mt-1">点击上方按钮添加远程服务器连接</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {s.configs.map((config) => (
              <SSHConfigCard
                key={config.id}
                config={config}
                testingId={s.testingId}
                testResult={s.testResult}
                expandedSandbox={s.expandedSandbox}
                setExpandedSandbox={s.setExpandedSandbox}
                sandboxAction={s.sandboxAction}
                sandboxLogs={s.sandboxLogs}
                setSandboxLogs={s.setSandboxLogs}
                deployProgress={s.deployProgress}
                diagResult={s.diagResult}
                setDiagResult={s.setDiagResult}
                diagnosing={s.diagnosing}
                onTest={s.handleTest}
                onSetDefault={s.handleSetDefault}
                onEdit={s.handleEdit}
                onDelete={s.handleDelete}
                onSandboxToggle={s.handleSandboxToggle}
                onSandboxAction={s.handleSandboxAction}
                onCancelDeploy={s.handleCancelDeploy}
                onDiagnose={s.handleDiagnose}
                onViewLogs={s.handleViewLogs}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
