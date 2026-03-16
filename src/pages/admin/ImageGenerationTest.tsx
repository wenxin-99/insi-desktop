import React, { useState } from 'react';
import { useLocation } from 'wouter';
import { ArrowLeft, Plus, Trash2, TestTube, Image as ImageIcon, Loader2 } from 'lucide-react';
import { trpc } from '@/lib/trpc';

interface ImageModel {
  id: number;
  name: string;
  displayName: string;
  apiEndpoint: string;
  apiKey: string;
  apiModel: string;
  enabled: boolean;
}

interface TestResult {
  success: boolean;
  imageUrl?: string;
  error?: string;
  details?: string;
}

export default function ImageGenerationTest() {
  const [, setLocation] = useLocation();
  const [testPrompt, setTestPrompt] = useState('A cute bird pooping, cartoon style, colorful');
  const [testResult, setTestResult] = useState<TestResult | null>(null);
  const [testing, setTesting] = useState(false);
  
  // 获取图片生成模型列表
  const { data: models, refetch } = trpc.imageModels.list.useQuery();
  
  // 添加模型
  const addModelMutation = trpc.imageModels.create.useMutation({
    onSuccess: () => refetch(),
  });
  
  // 删除模型
  const deleteModelMutation = trpc.imageModels.delete.useMutation({
    onSuccess: () => refetch(),
  });
  
  // 测试图片生成
  const testGenerationMutation = trpc.imageModels.testGeneration.useMutation();

  const handleAddModel = () => {
    const name = prompt('模型名称（例如：imagen-3）:');
    if (!name) return;
    
    const displayName = prompt('显示名称（例如：Imagen 3）:');
    if (!displayName) return;
    
    const apiEndpoint = prompt('API端点:');
    if (!apiEndpoint) return;
    
    const apiKey = prompt('API密钥:');
    if (!apiKey) return;
    
    const apiModel = prompt('模型ID（例如：imagen-3.0-generate-001）:');
    if (!apiModel) return;
    
    addModelMutation.mutate({
      name,
      displayName,
      apiEndpoint,
      apiKey,
      apiModel,
    });
  };

  const handleDeleteModel = (id: number, name: string) => {
    if (confirm(`确定要删除模型 "${name}" 吗？`)) {
      deleteModelMutation.mutate({ id });
    }
  };

  const handleTestGeneration = async () => {
    if (!testPrompt.trim()) {
      alert('请输入测试提示词');
      return;
    }
    
    setTesting(true);
    setTestResult(null);
    
    try {
      const result = await testGenerationMutation.mutateAsync({
        prompt: testPrompt,
      });
      setTestResult(result);
    } catch (error: any) {
      setTestResult({
        success: false,
        error: error.message || '测试失败',
        details: error.stack || JSON.stringify(error, null, 2),
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
        {/* 返回按钮 */}
        <button
          onClick={() => setLocation('/admin')}
          className="mb-6 flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
          <span>返回管理后台</span>
        </button>

        {/* 页面标题 */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            图片生成测试
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            管理图片生成模型并测试API连接
          </p>
        </div>

        {/* 图片生成测试区域 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <TestTube className="w-5 h-5" />
            测试图片生成
          </h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                提示词（Prompt）
              </label>
              <textarea
                value={testPrompt}
                onChange={(e) => setTestPrompt(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                rows={3}
                placeholder="输入图片描述，例如：A cute bird pooping, cartoon style, colorful"
              />
            </div>
            
            <button
              onClick={handleTestGeneration}
              disabled={testing}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {testing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <ImageIcon className="w-5 h-5" />
                  生成图片
                </>
              )}
            </button>
            
            {/* 测试结果 */}
            {testResult && (
              <div className={`mt-4 p-4 rounded-lg ${
                testResult.success 
                  ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                  : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800'
              }`}>
                {testResult.success ? (
                  <div>
                    <p className="text-green-800 dark:text-green-200 font-medium mb-2">
                      ✅ 图片生成成功！
                    </p>
                    {testResult.imageUrl && (
                      <div className="mt-4">
                        <img 
                          src={testResult.imageUrl} 
                          alt="Generated" 
                          className="max-w-full rounded-lg shadow-lg"
                        />
                        <a 
                          href={testResult.imageUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="mt-2 inline-block text-blue-600 dark:text-blue-400 hover:underline"
                        >
                          在新标签页打开
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <p className="text-red-800 dark:text-red-200 font-medium mb-2">
                      ❌ 图片生成失败
                    </p>
                    <p className="text-red-700 dark:text-red-300 text-sm mb-2">
                      {testResult.error}
                    </p>
                    {testResult.details && (
                      <details className="mt-2">
                        <summary className="cursor-pointer text-sm text-red-600 dark:text-red-400 hover:underline">
                          查看详细错误信息
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                          {testResult.details}
                        </pre>
                      </details>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 模型列表 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              图片生成模型
            </h2>
            <button
              onClick={handleAddModel}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              添加模型
            </button>
          </div>

          {models && models.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      名称
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      API端点
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      模型ID
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      状态
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-medium text-gray-700 dark:text-gray-300">
                      操作
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {models.map((model) => (
                    <tr
                      key={model.id}
                      className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="py-3 px-4">
                        <div>
                          <div className="font-medium text-gray-900 dark:text-white">
                            {model.displayName}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {model.name}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        <div className="max-w-xs truncate" title={model.apiEndpoint}>
                          {model.apiEndpoint}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-gray-600 dark:text-gray-400">
                        {model.apiModel}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            model.enabled
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}
                        >
                          {model.enabled ? '已启用' : '已禁用'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleDeleteModel(model.id, model.displayName)}
                          className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="删除模型"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <ImageIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>暂无图片生成模型</p>
              <p className="text-sm mt-2">点击"添加模型"按钮创建第一个模型</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
