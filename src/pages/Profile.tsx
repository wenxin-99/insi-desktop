import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { Loader2, Upload, User, Mail, Calendar, Activity, Coins, ArrowLeft } from "lucide-react";
import { useState, useRef } from "react";
import { toast } from "sonner";

export default function Profile() {
  const { user } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const avatarInputRef = useRef<HTMLInputElement>(null);

  const { data: balance } = trpc.fishCoin.getBalance.useQuery();
  const { data: transactions } = trpc.fishCoin.getTransactions.useQuery({ limit: 10 });
  const { data: files } = trpc.file.getAll.useQuery();

  const updateProfileMutation = trpc.user.updateProfile.useMutation({
    onSuccess: () => {
      toast.success("个人信息更新成功");
      setIsEditing(false);
      // 刷新用户信息
      window.location.reload();
    },
    onError: (error: any) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const handleSave = () => {
    updateProfileMutation.mutate({
      name: name || undefined,
      email: email || undefined,
    });
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类型
    if (!file.type.startsWith('image/')) {
      toast.error("请选择图片文件");
      return;
    }

    // 检查文件大小 (2MB)
    const maxSize = 2 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("图片大小不能超过2MB");
      return;
    }

    setUploading(true);

    try {
      // 这里应该上传到S3并更新用户头像URL
      // 暂时使用占位逻辑
      toast.info("头像上传功能开发中...");
      
      // TODO: 实现真实的头像上传逻辑
      // 1. 上传文件到S3
      // 2. 调用updateProfile更新avatarUrl
      
    } catch (error) {
      console.error("Avatar upload error:", error);
      toast.error("头像上传失败");
    } finally {
      setUploading(false);
    }
  };

  const stats = {
    totalTransactions: transactions?.length || 0,
    totalFiles: files?.length || 0,
    memberSince: user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-",
    lastLogin: user?.lastSignedIn ? new Date(user.lastSignedIn).toLocaleDateString() : "-",
  };

  return (
    <div className="container mx-auto py-8 space-y-6">
      <div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.history.back()}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          返回
        </Button>
        <h1 className="text-3xl font-bold">个人资料</h1>
        <p className="text-muted-foreground mt-2">管理您的个人信息和账户设置</p>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* 左侧：个人信息卡片 */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>基本信息</CardTitle>
              <CardDescription>更新您的个人资料信息</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* 头像 */}
              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user?.email ? `https://api.dicebear.com/7.x/initials/svg?seed=${user.email}` : undefined} />
                  <AvatarFallback>
                    <User className="h-10 w-10" />
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <p className="text-sm font-medium">头像</p>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarUpload}
                    disabled={uploading}
                    className="hidden"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => avatarInputRef.current?.click()}
                    disabled={uploading}
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        上传中...
                      </>
                    ) : (
                      <>
                        <Upload className="mr-2 h-4 w-4" />
                        更换头像
                      </>
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground">支持JPG、PNG格式，最大2MB</p>
                </div>
              </div>

              <Separator />

              {/* 用户名 */}
              <div className="space-y-2">
                <Label htmlFor="name">用户名</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={!isEditing}
                  placeholder="请输入用户名"
                />
              </div>

              {/* 邮箱 */}
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={!isEditing}
                  placeholder="请输入邮箱"
                />
              </div>

              {/* 登录方式 */}
              <div className="space-y-2">
                <Label>登录方式</Label>
                <Input value={user?.loginMethod || "-"} disabled />
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-2">
                {isEditing ? (
                  <>
                    <Button onClick={handleSave} disabled={updateProfileMutation.isPending}>
                      {updateProfileMutation.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          保存中...
                        </>
                      ) : (
                        "保存更改"
                      )}
                    </Button>
                    <Button variant="outline" onClick={() => {
                      setIsEditing(false);
                      setName(user?.name || "");
                      setEmail(user?.email || "");
                    }}>
                      取消
                    </Button>
                  </>
                ) : (
                  <Button onClick={() => setIsEditing(true)}>
                    编辑资料
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 右侧：统计信息 */}
        <div className="space-y-6">
          {/* 🐟币余额 */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">🐟币余额</CardTitle>
              <Coins className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-yellow-500">
                {balance ? (typeof balance.balance === 'string' ? parseFloat(balance.balance).toFixed(2) : (balance.balance as number).toFixed(2)) : "0.00"}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                当前可用余额
              </p>
            </CardContent>
          </Card>

          {/* 使用统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">使用统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">交易次数</span>
                </div>
                <span className="text-sm font-semibold">{stats.totalTransactions}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">上传文件</span>
                </div>
                <span className="text-sm font-semibold">{stats.totalFiles}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">注册时间</span>
                </div>
                <span className="text-xs text-muted-foreground">{stats.memberSince}</span>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">最后登录</span>
                </div>
                <span className="text-xs text-muted-foreground">{stats.lastLogin}</span>
              </div>
            </CardContent>
          </Card>

          {/* 账户角色 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">账户角色</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm">当前角色</span>
                <span className={`text-sm font-semibold ${user?.role === 'admin' ? 'text-blue-500' : 'text-green-500'}`}>
                  {user?.role === 'admin' ? '管理员' : '普通用户'}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
