import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Pencil, Trash2, Plus, TestTube } from "lucide-react";
import { toast } from "sonner";

interface ProxyRule {
  id: number;
  name: string;
  pattern: string;
  enabled: boolean;
  priority: number;
  description: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export default function ProxyRulesManagement() {
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isTestDialogOpen, setIsTestDialogOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<ProxyRule | null>(null);
  const [testUrl, setTestUrl] = useState("");
  const [testResult, setTestResult] = useState<any>(null);

  const { data: rules, refetch } = trpc.proxyRules.getAll.useQuery();
  const createMutation = trpc.proxyRules.create.useMutation();
  const updateMutation = trpc.proxyRules.update.useMutation();
  const deleteMutation = trpc.proxyRules.delete.useMutation();
  const testMutation = trpc.proxyRules.testMatch.useMutation();

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    
    try {
      await createMutation.mutateAsync({
        name: formData.get("name") as string,
        pattern: formData.get("pattern") as string,
        enabled: formData.get("enabled") === "on",
        priority: parseInt(formData.get("priority") as string) || 0,
        description: formData.get("description") as string,
      });
      
      toast.success("代理规则创建成功");
      setIsAddDialogOpen(false);
      refetch();
    } catch (error: any) {
      toast.error("创建失败: " + error.message);
    }
  };

  const handleUpdate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingRule) return;
    
    const formData = new FormData(e.currentTarget);
    
    try {
      await updateMutation.mutateAsync({
        id: editingRule.id,
        name: formData.get("name") as string,
        pattern: formData.get("pattern") as string,
        enabled: formData.get("enabled") === "on",
        priority: parseInt(formData.get("priority") as string) || 0,
        description: formData.get("description") as string,
      });
      
      toast.success("代理规则更新成功");
      setIsEditDialogOpen(false);
      setEditingRule(null);
      refetch();
    } catch (error: any) {
      toast.error("更新失败: " + error.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("确定要删除这个代理规则吗？")) return;
    
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("代理规则删除成功");
      refetch();
    } catch (error: any) {
      toast.error("删除失败: " + error.message);
    }
  };

  const handleTest = async () => {
    if (!testUrl) {
      toast.error("请输入测试URL");
      return;
    }
    
    try {
      const result = await testMutation.mutateAsync({ url: testUrl });
      setTestResult(result);
      
      if (result.matched) {
        toast.success(`匹配成功: ${result.rule.name}`);
      } else {
        toast.info("未匹配到任何规则");
      }
    } catch (error: any) {
      toast.error("测试失败: " + error.message);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold">代理规则管理</h1>
          <p className="text-gray-600 mt-1">配置哪些API端点需要通过代理访问</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={isTestDialogOpen} onOpenChange={setIsTestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <TestTube className="w-4 h-4 mr-2" />
                测试匹配
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>测试URL匹配</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>测试URL</Label>
                  <Input
                    value={testUrl}
                    onChange={(e) => setTestUrl(e.target.value)}
                    placeholder="https://generativelanguage.googleapis.com/..."
                  />
                </div>
                <Button onClick={handleTest} className="w-full">
                  测试
                </Button>
                {testResult && (
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <div className="font-medium mb-2">
                      {testResult.matched ? "✅ 匹配成功" : "❌ 未匹配"}
                    </div>
                    {testResult.rule && (
                      <div className="text-sm space-y-1">
                        <div>规则名称: {testResult.rule.name}</div>
                        <div>匹配模式: {testResult.rule.pattern}</div>
                        <div>优先级: {testResult.rule.priority}</div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </DialogContent>
          </Dialog>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                添加规则
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>添加代理规则</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <Label>规则名称</Label>
                  <Input name="name" required placeholder="例如: Google APIs" />
                </div>
                <div>
                  <Label>匹配模式</Label>
                  <Input name="pattern" required placeholder="例如: googleapis.com" />
                  <p className="text-sm text-gray-500 mt-1">
                    URL中包含此模式时将使用代理
                  </p>
                </div>
                <div>
                  <Label>优先级</Label>
                  <Input name="priority" type="number" defaultValue="0" />
                  <p className="text-sm text-gray-500 mt-1">
                    数字越大优先级越高
                  </p>
                </div>
                <div>
                  <Label>描述</Label>
                  <Textarea name="description" placeholder="规则描述..." />
                </div>
                <div className="flex items-center space-x-2">
                  <Switch name="enabled" defaultChecked />
                  <Label>启用</Label>
                </div>
                <Button type="submit" className="w-full">
                  创建
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <table className="w-full">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                规则名称
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                匹配模式
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
            {rules?.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                  暂无代理规则
                </td>
              </tr>
            )}
            {rules?.map((rule) => (
              <tr key={rule.id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="font-medium">{rule.name}</div>
                  {rule.description && (
                    <div className="text-sm text-gray-500">{rule.description}</div>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                    {rule.pattern}
                  </code>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm font-medium">{rule.priority}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {rule.enabled ? (
                    <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-800 rounded-full">
                      启用
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-800 rounded-full">
                      禁用
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingRule(rule);
                        setIsEditDialogOpen(true);
                      }}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(rule.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>编辑代理规则</DialogTitle>
          </DialogHeader>
          {editingRule && (
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <Label>规则名称</Label>
                <Input name="name" required defaultValue={editingRule.name} />
              </div>
              <div>
                <Label>匹配模式</Label>
                <Input name="pattern" required defaultValue={editingRule.pattern} />
              </div>
              <div>
                <Label>优先级</Label>
                <Input name="priority" type="number" defaultValue={editingRule.priority} />
              </div>
              <div>
                <Label>描述</Label>
                <Textarea name="description" defaultValue={editingRule.description || ""} />
              </div>
              <div className="flex items-center space-x-2">
                <Switch name="enabled" defaultChecked={editingRule.enabled} />
                <Label>启用</Label>
              </div>
              <Button type="submit" className="w-full">
                更新
              </Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
