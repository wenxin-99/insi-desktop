import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { ArrowLeft, Save, TestTube, Check, X, Loader, Cloud, HardDrive } from "lucide-react";
import { useLocation } from "wouter";

interface StorageSettings {
  id: number;
  type: "local" | "aliyun" | "tencent" | "aws";
  enabled: boolean;
  priority: number;
  config?: {
    accessKeyId?: string;
    accessKeySecret?: string;
    bucket?: string;
    region?: string;
    endpoint?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export default function StorageSettings() {
  const [, setLocation] = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSettings, setEditingSettings] = useState<StorageSettings | null>(null);
  const [testingId, setTestingId] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const { data: settings = [], refetch } = trpc.storageSettings.getAll.useQuery();
  const createMutation = trpc.storageSettings.create.useMutation();
  const updateMutation = trpc.storageSettings.update.useMutation();
  const deleteMutation = trpc.storageSettings.delete.useMutation();
  const testMutation = trpc.storageSettings.test.useMutation();

  const [formData, setFormData] = useState({
    type: "local" as "local" | "aliyun" | "tencent" | "aws",
    enabled: false,
    priority: 0,
    accessKeyId: "",
    accessKeySecret: "",
    bucket: "",
    region: "",
    endpoint: "",
  });

  const storageTypeLabels = {
    local: "本地存储",
    aliyun: "阿里云 OSS",
    tencent: "腾讯云 COS",
    aws: "AWS S3",
  };

  const handleOpenDialog = (setting?: StorageSettings) => {
    if (setting) {
      setEditingSettings(setting);
      setFormData({
        type: setting.type,
        enabled: setting.enabled,
        priority: setting.priority,
        accessKeyId: setting.config?.accessKeyId || "",
        accessKeySecret: setting.config?.accessKeySecret || "",
        bucket: setting.config?.bucket || "",
        region: setting.config?.region || "",
        endpoint: setting.config?.endpoint || "",
      });
    } else {
      setEditingSettings(null);
      setFormData({
        type: "local",
        enabled: false,
        priority: 0,
        accessKeyId: "",
        accessKeySecret: "",
        bucket: "",
        region: "",
        endpoint: "",
      });
    }
    setTestResult(null);
    setIsDialogOpen(true);
  };

  const handleSave = async () => {
    try {
      const data: any = {
        type: formData.type,
        enabled: formData.enabled,
        priority: formData.priority,
      };

      if (formData.type !== "local") {
        data.config = {
          accessKeyId: formData.accessKeyId,
          accessKeySecret: formData.accessKeySecret,
          bucket: formData.bucket,
          region: formData.region,
          endpoint: formData.endpoint || undefined,
        };
      }

      if (editingSettings) {
        await updateMutation.mutateAsync({ id: editingSettings.id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }

      await refetch();
      setIsDialogOpen(false);
    } catch (error: any) {
      alert(`保存失败: ${error.message}`);
    }
  };

  const handleTest = async (id: number) => {
    setTestingId(id);
    setTestResult(null);
    try {
      const result = await testMutation.mutateAsync({ id });
      setTestResult({ success: true, message: result.message || "连接测试成功！" });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "连接测试失败" });
    } finally {
      setTestingId(null);
    }
  };

  const handleTestCurrent = async () => {
    setTestingId(-1);
    setTestResult(null);
    try {
      const data: any = {
        type: formData.type,
      };

      if (formData.type !== "local") {
        data.config = {
          accessKeyId: formData.accessKeyId,
          accessKeySecret: formData.accessKeySecret,
          bucket: formData.bucket,
          region: formData.region,
          endpoint: formData.endpoint || undefined,
        };
      }

      const result = await testMutation.mutateAsync(data);
      setTestResult({ success: true, message: result.message || "连接测试成功！" });
    } catch (error: any) {
      setTestResult({ success: false, message: error.message || "连接测试失败" });
    } finally {
      setTestingId(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除此存储配置吗？")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      await refetch();
    } catch (error: any) {
      alert(`删除失败: ${error.message}`);
    }
  };

  const handleToggleEnabled = async (setting: StorageSettings) => {
    try {
      await updateMutation.mutateAsync({
        id: setting.id,
        enabled: !setting.enabled,
      });
      await refetch();
    } catch (error: any) {
      alert(`更新失败: ${error.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setLocation("/admin")}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">存储配置管理</h1>
              <p className="text-sm text-gray-500 mt-1">管理文件上传的存储方式（本地/云存储）</p>
            </div>
          </div>
          <button
            onClick={() => handleOpenDialog()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Cloud className="w-4 h-4" />
            添加存储配置
          </button>
        </div>

        <div className="bg-white rounded-lg shadow">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    存储类型
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    配置信息
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    优先级
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    状态
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {settings.map((setting) => (
                  <tr key={setting.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        {setting.type === "local" ? (
                          <HardDrive className="w-4 h-4 text-gray-500" />
                        ) : (
                          <Cloud className="w-4 h-4 text-blue-500" />
                        )}
                        <span className="font-medium">{storageTypeLabels[setting.type]}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      {setting.type === "local" ? (
                        <span className="text-sm text-gray-500">服务器本地存储</span>
                      ) : (
                        <div className="text-sm text-gray-600">
                          <div>Bucket: {setting.config?.bucket}</div>
                          <div>Region: {setting.config?.region}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-900">{setting.priority}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => handleToggleEnabled(setting)}
                        className={`px-3 py-1 rounded-full text-xs font-medium ${
                          setting.enabled
                            ? "bg-green-100 text-green-800"
                            : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {setting.enabled ? "已启用" : "已禁用"}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleTest(setting.id)}
                          disabled={testingId === setting.id}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50"
                          title="测试连接"
                        >
                          {testingId === setting.id ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <TestTube className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleOpenDialog(setting)}
                          className="p-2 text-gray-600 hover:bg-gray-50 rounded-lg transition-colors"
                          title="编辑"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        {setting.type !== "local" && (
                          <button
                            onClick={() => handleDelete(setting.id)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="删除"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {settings.length === 0 && (
          <div className="text-center py-12 bg-white rounded-lg shadow mt-4">
            <Cloud className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">暂无存储配置</p>
            <button
              onClick={() => handleOpenDialog()}
              className="mt-4 text-blue-600 hover:text-blue-700"
            >
              添加第一个配置
            </button>
          </div>
        )}
      </div>

      {/* 配置对话框 */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-4">
              {editingSettings ? "编辑存储配置" : "添加存储配置"}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  存储类型
                </label>
                <select
                  value={formData.type}
                  onChange={(e) =>
                    setFormData({ ...formData, type: e.target.value as any })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={!!editingSettings}
                >
                  <option value="local">本地存储</option>
                  <option value="aliyun">阿里云 OSS</option>
                  <option value="tencent">腾讯云 COS</option>
                  <option value="aws">AWS S3</option>
                </select>
              </div>

              {formData.type !== "local" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Access Key ID
                    </label>
                    <input
                      type="text"
                      value={formData.accessKeyId}
                      onChange={(e) =>
                        setFormData({ ...formData, accessKeyId: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="请输入 Access Key ID"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Access Key Secret
                    </label>
                    <input
                      type="password"
                      value={formData.accessKeySecret}
                      onChange={(e) =>
                        setFormData({ ...formData, accessKeySecret: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="请输入 Access Key Secret"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Bucket 名称
                    </label>
                    <input
                      type="text"
                      value={formData.bucket}
                      onChange={(e) =>
                        setFormData({ ...formData, bucket: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="请输入 Bucket 名称"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Region 区域
                    </label>
                    <input
                      type="text"
                      value={formData.region}
                      onChange={(e) =>
                        setFormData({ ...formData, region: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="例如: oss-cn-hangzhou, ap-guangzhou, us-east-1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Endpoint (可选)
                    </label>
                    <input
                      type="text"
                      value={formData.endpoint}
                      onChange={(e) =>
                        setFormData({ ...formData, endpoint: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="自定义 Endpoint，留空使用默认值"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  优先级
                </label>
                <input
                  type="number"
                  value={formData.priority}
                  onChange={(e) =>
                    setFormData({ ...formData, priority: parseInt(e.target.value) })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="数字越大优先级越高"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={formData.enabled}
                  onChange={(e) =>
                    setFormData({ ...formData, enabled: e.target.checked })
                  }
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="enabled" className="text-sm font-medium text-gray-700">
                  启用此存储配置
                </label>
              </div>

              {testResult && (
                <div
                  className={`p-4 rounded-lg ${
                    testResult.success
                      ? "bg-green-50 text-green-800"
                      : "bg-red-50 text-red-800"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {testResult.success ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <X className="w-5 h-5" />
                    )}
                    <span className="font-medium">{testResult.message}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setIsDialogOpen(false)}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              {formData.type !== "local" && (
                <button
                  onClick={handleTestCurrent}
                  disabled={testingId === -1}
                  className="px-4 py-2 text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {testingId === -1 ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <TestTube className="w-4 h-4" />
                  )}
                  测试连接
                </button>
              )}
              <button
                onClick={handleSave}
                disabled={createMutation.isPending || updateMutation.isPending}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader className="w-4 h-4 animate-spin" />
                )}
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
