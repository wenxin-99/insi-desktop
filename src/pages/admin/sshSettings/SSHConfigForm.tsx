/**
 * sshSettings/SSHConfigForm — 新建/编辑 SSH 配置表单
 */
import { Card, CardContent, CardTitle, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Save, X, Lock, Key } from "lucide-react";
import type { SSHFormData } from "./types";

interface SSHConfigFormProps {
  form: SSHFormData;
  setForm: (f: SSHFormData) => void;
  editingId: number | null;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}

export function SSHConfigForm({ form, setForm, editingId, saving, onSave, onCancel }: SSHConfigFormProps) {
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="text-lg">{editingId ? "编辑 SSH 配置" : "新增 SSH 配置"}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>配置名称 *</Label>
            <Input placeholder="如：生产服务器" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div>
            <Label>主机地址 *</Label>
            <Input placeholder="如：192.168.1.100" value={form.host} onChange={(e) => setForm({ ...form, host: e.target.value })} />
          </div>
          <div>
            <Label>端口</Label>
            <Input type="number" value={form.port} onChange={(e) => setForm({ ...form, port: parseInt(e.target.value) || 22 })} />
          </div>
          <div>
            <Label>用户名 *</Label>
            <Input value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} />
          </div>
          <div>
            <Label>连接超时（秒）</Label>
            <Input type="number" value={form.connectTimeout} onChange={(e) => setForm({ ...form, connectTimeout: parseInt(e.target.value) || 10 })} />
          </div>
        </div>

        {/* 认证方式 */}
        <div>
          <Label className="mb-2 block">认证方式</Label>
          <div className="flex gap-4">
            <Button variant={form.authType === "password" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, authType: "password" })}>
              <Lock className="h-4 w-4 mr-1" /> 密码
            </Button>
            <Button variant={form.authType === "privateKey" ? "default" : "outline"} size="sm" onClick={() => setForm({ ...form, authType: "privateKey" })}>
              <Key className="h-4 w-4 mr-1" /> 密钥
            </Button>
          </div>
        </div>

        {form.authType === "password" ? (
          <div>
            <Label>登录密码</Label>
            <Input type="password" placeholder="输入 SSH 密码" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            {editingId && <p className="text-xs text-gray-400 mt-1">留空表示不修改密码</p>}
          </div>
        ) : (
          <>
            <div>
              <Label>私钥内容</Label>
              <Textarea
                placeholder="粘贴 SSH 私钥内容（-----BEGIN OPENSSH PRIVATE KEY-----...）"
                rows={5} value={form.privateKey}
                onChange={(e) => setForm({ ...form, privateKey: e.target.value })}
                className="font-mono text-xs"
              />
            </div>
            <div>
              <Label>私钥密码短语（可选）</Label>
              <Input type="password" placeholder="如果私钥有密码保护，请输入" value={form.passphrase} onChange={(e) => setForm({ ...form, passphrase: e.target.value })} />
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <Button onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {editingId ? "更新" : "保存"}
          </Button>
          <Button variant="outline" onClick={onCancel}>
            <X className="h-4 w-4 mr-2" /> 取消
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
