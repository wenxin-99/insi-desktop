/**
 * ModelManagement — 模型管理页面
 *
 * 拆分自原 994 行单文件。各子模块：
 *   types.ts              - 类型定义与工具函数
 *   useModelManagement.ts - 状态管理 hook
 *   ModelTable.tsx         - 列表表格
 *   CreateModelDialog.tsx  - 新建对话框
 *   EditModelDialog.tsx    - 编辑对话框
 *   ImageProviderSelect.tsx - 图片协议选择（共享）
 *   VideoCostFields.tsx     - 视频费用字段（共享）
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useModelManagement } from "./modelManagement/useModelManagement";
import { ModelTable } from "./modelManagement/ModelTable";
import { CreateModelDialog } from "./modelManagement/CreateModelDialog";
import { EditModelDialog } from "./modelManagement/EditModelDialog";

export default function ModelManagement() {
  const mgmt = useModelManagement();

  return (
    <DashboardLayout>
      <div className="p-6 space-y-6">
        {/* 页头 */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">模型管理</h1>
              <p className="text-muted-foreground mt-1">管理AI模型配置和API连接</p>
            </div>
          </div>

          <CreateModelDialog
            open={mgmt.isCreateDialogOpen}
            onOpenChange={mgmt.setIsCreateDialogOpen}
            formData={mgmt.formData}
            setFormData={mgmt.setFormData}
            selectedTemplate={mgmt.selectedTemplate}
            onTemplateSelect={mgmt.handleTemplateSelect}
            onCreate={mgmt.handleCreate}
            isPending={mgmt.createPending}
          />
        </div>

        {/* 列表 */}
        <ModelTable
          models={mgmt.models}
          isLoading={mgmt.isLoading}
          testingModelId={mgmt.testingModelId}
          testResults={mgmt.testResults}
          testPending={mgmt.testPending}
          onEdit={mgmt.handleEdit}
          onDelete={mgmt.handleDelete}
          onTest={mgmt.handleTest}
        />

        {/* 编辑对话框 */}
        <EditModelDialog
          open={mgmt.isEditDialogOpen}
          onOpenChange={mgmt.setIsEditDialogOpen}
          formData={mgmt.formData}
          setFormData={mgmt.setFormData}
          onUpdate={mgmt.handleUpdate}
          isPending={mgmt.updatePending}
        />
      </div>
    </DashboardLayout>
  );
}
