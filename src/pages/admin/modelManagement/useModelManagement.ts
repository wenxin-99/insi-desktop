/**
 * modelManagement/useModelManagement — 状态管理与业务逻辑
 *
 * ★ 改动：capabilities 字段支持（handleEdit / handleCreate / handleUpdate / handleTemplateSelect）
 */
import { useState } from "react";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { getTemplateById } from "@shared/modelTemplates";
import {
  type ModelFormData,
  DEFAULT_FORM_DATA,
  autoDetectImageProvider,
  buildConfigJson,
} from "./types";

export function useModelManagement() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<any>(null);
  const [testingModelId, setTestingModelId] = useState<number | null>(null);
  const [testResults, setTestResults] = useState<Record<number, { success: boolean; message: string; responseTime?: number }>>({});
  const [selectedTemplate, setSelectedTemplate] = useState<string>("");
  const [formData, setFormData] = useState<ModelFormData>(DEFAULT_FORM_DATA);

  const { data: models, isLoading, refetch } = trpc.aiModel.adminGetAll.useQuery();
  const createMutation = trpc.aiModel.create.useMutation();
  const updateMutation = trpc.aiModel.update.useMutation();
  const deleteMutation = trpc.aiModel.delete.useMutation();
  const testMutation = trpc.aiModel.test.useMutation();

  const resetForm = () => {
    setFormData(DEFAULT_FORM_DATA);
    setSelectedModel(null);
    setSelectedTemplate("");
  };

  // ════════ 验证 ════════

  function validateCustomModel(): boolean {
    if (formData.source === "custom") {
      if (!formData.apiEndpoint || !formData.apiKey || !formData.apiModel) {
        toast.error("请填写完整的API配置：API端点、API密钥和模型标识符");
        return false;
      }
    }
    return true;
  }

  function validateImageProvider(): boolean {
    if (formData.type === "image" && !formData.imageProvider) {
      const detected = autoDetectImageProvider(formData.apiEndpoint);
      if (detected) {
        setFormData((prev) => ({ ...prev, imageProvider: detected as any }));
        return true;
      }
      toast.error("请选择图片生成 API 协议，或填写可识别的端点URL");
      return false;
    }
    return true;
  }

  // ════════ capabilities 解析工具 ════════

  /** 安全地从 model 对象中解析 capabilities 数组 */
  function parseCapabilities(raw: any): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  }

  // ════════ CRUD ════════

  const handleCreate = async () => {
    if (!validateCustomModel() || !validateImageProvider()) return;
    try {
      await createMutation.mutateAsync({
        ...formData,
        config: buildConfigJson(formData),
        capabilities: formData.capabilities,  // ★ 传递 capabilities
      });
      toast.success("模型创建成功");
      setIsCreateDialogOpen(false);
      refetch();
      resetForm();
    } catch (error: any) {
      toast.error("创建失败: " + (error.message || "未知错误"));
    }
  };

  const handleEdit = (model: any) => {
    setSelectedModel(model);
    let parsedConfig: any = {};
    try { parsedConfig = model.config ? JSON.parse(model.config) : {}; } catch {}

    // ★ 解析 capabilities
    const caps = parseCapabilities(model.capabilities);

    setFormData({
      name: model.name || "",
      modelIdentifier: model.modelIdentifier || "",
      displayName: model.displayName || "",
      description: model.description || "",
      type: model.type || "chat",
      costPerUse: model.costPerUse || "0.10",
      enabled: model.enabled ?? true,
      source: model.source || "custom",
      apiEndpoint: model.apiEndpoint || "",
      apiKey: model.apiKey || "",
      apiModel: model.apiModel || "",
      tier: model.tier || "pro",
      visibleToUser: model.visibleToUser ?? false,
      supportsVision: model.supportsVision ?? false,
      capabilities: caps,                         // ★ 新增
      imageProvider: parsedConfig.imageProvider || "",
      imageAspectRatio: parsedConfig.aspectRatio || "1:1",
      videoCost5s: parsedConfig.videoCost?.cost5s?.toString() || "30",
      videoCost10s: parsedConfig.videoCost?.cost10s?.toString() || "50",
    });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    if (!selectedModel) return;
    if (!validateCustomModel() || !validateImageProvider()) return;
    try {
      await updateMutation.mutateAsync({
        id: selectedModel.id,
        ...formData,
        config: buildConfigJson(formData),
        capabilities: formData.capabilities,  // ★ 传递 capabilities
      });
      toast.success("模型更新成功");
      setIsEditDialogOpen(false);
      refetch();
      resetForm();
    } catch (error: any) {
      toast.error("更新失败: " + (error.message || "未知错误"));
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`确定要删除模型 "${name}" 吗？`)) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("模型删除成功");
      refetch();
    } catch (error: any) {
      toast.error("删除失败: " + (error.message || "未知错误"));
    }
  };

  // ════════ 测试 ════════

  const handleTest = async (id: number, name: string) => {
    setTestingModelId(id);
    setTestResults((prev) => ({ ...prev, [id]: { success: false, message: "测试中..." } }));
    try {
      const result = await testMutation.mutateAsync({ id });
      setTestResults((prev) => ({
        ...prev,
        [id]: { success: result.success, message: result.message, responseTime: result.responseTime },
      }));
      if (result.success) {
        toast.success(`${name} 测试成功！响应时间: ${result.responseTime}ms`);
        refetch();
      } else {
        toast.error(`${name} 测试失败: ${result.message}`);
      }
    } catch (error: any) {
      const errorMessage = error.message || "未知错误";
      setTestResults((prev) => ({ ...prev, [id]: { success: false, message: errorMessage } }));
      toast.error("测试失败: " + errorMessage);
    } finally {
      setTestingModelId(null);
    }
  };

  // ════════ 模板 ════════

  const handleTemplateSelect = (templateId: string) => {
    setSelectedTemplate(templateId);
    if (!templateId || templateId === "none") return;
    const template = getTemplateById(templateId);
    if (!template) return;

    // ★ 从模板推断 capabilities
    const inferredCaps: string[] = [];
    if (template.supportsVision) inferredCaps.push("vision");

    setFormData((prev) => ({
      ...prev,
      name: template.apiModel,
      displayName: template.name,
      description: template.description,
      apiEndpoint: template.apiEndpoint,
      apiModel: template.apiModel,
      supportsVision: template.supportsVision,
      capabilities: inferredCaps,              // ★ 新增
      costPerUse: template.costPerUse,
      tier: template.tier,
    }));
    toast.success(`已应用模板: ${template.name}`);
  };

  return {
    // state
    models,
    isLoading,
    formData,
    setFormData,
    isCreateDialogOpen,
    setIsCreateDialogOpen,
    isEditDialogOpen,
    setIsEditDialogOpen,
    selectedModel,
    testingModelId,
    testResults,
    selectedTemplate,
    // mutations pending
    createPending: createMutation.isPending,
    updatePending: updateMutation.isPending,
    testPending: testMutation.isPending,
    // handlers
    handleCreate,
    handleEdit,
    handleUpdate,
    handleDelete,
    handleTest,
    handleTemplateSelect,
    resetForm,
  };
}
