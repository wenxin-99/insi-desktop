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

export function StorageConfigDialog(props: any) {
  return (
    <>
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
    </>
  );
}