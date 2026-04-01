import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, AlertCircle, CheckCircle2, Info, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import DashboardLayout from "@/components/DashboardLayout";
import VoiceSettings from "./VoiceSettings";

const DEFAULT_ALLOWED_TYPES = "txt,md,pdf,docx,xlsx,csv,json,xml,html,css,js,ts,py,java,cpp,c,go,rs,swift,kt,rb,php,sh,sql";

// 始终允许（不受配置影响）的图片类型
const ALWAYS_ALLOWED_IMAGES = ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp"];

// 推荐配置预设
const PRESETS = [
  {
    id: "standard",
    label: "标准模式",
    desc: "适合大多数场景，文档+代码，10MB 限制",
    maxSize: 10,
    maxCount: 5,
    allowedTypes: "txt,md,pdf,docx,xlsx,csv,json,xml",
  },
  {
    id: "developer",
    label: "开发者模式",
    desc: "包含全部代码文件类型，30MB，适合技术用户",
    maxSize: 30,
    maxCount: 10,
    allowedTypes: "txt,md,pdf,docx,xlsx,csv,json,xml,html,css,js,ts,py,java,cpp,c,go,rs,swift,kt,rb,php,sh,sql,yaml,toml,ini,env,lock,gradle,makefile,zip,tar,gz,tgz",
  },
  {
    id: "office",
    label: "办公模式",
    desc: "仅限 Office 文档，50MB，适合企业内部文档场景",
    maxSize: 50,
    maxCount: 5,
    allowedTypes: "pdf,doc,docx,xls,xlsx,ppt,pptx,txt,md,csv,zip",
  },
  {
    id: "strict",
    label: "严格模式",
    desc: "仅 PDF 和纯文本，5MB，最安全",
    maxSize: 5,
    maxCount: 3,
    allowedTypes: "pdf,txt,md",
  },
];

export default function SystemSettings() {
  const [, setLocation] = useLocation();

  const [maxSize, setMaxSize] = useState<number>(10);
  const [maxCount, setMaxCount] = useState<number>(5);
  const [allowedTypes, setAllowedTypes] = useState<string>("");
  const [sizeError, setSizeError] = useState<string>("");
  const [countError, setCountError] = useState<string>("");
  const [typesError, setTypesError] = useState<string>("");

  const { data: settings, isLoading } = trpc.system.getSettings.useQuery();

  const updateSettings = trpc.system.updateSettings.useMutation({
    onSuccess: () => {
      toast.success("系统设置已保存，上传限制立即生效（无需重启服务）");
    },
    onError: (error: any) => {
      toast.error(`保存失败: ${error.message}`);
    },
  });

  useEffect(() => {
    if (settings) {
      setMaxSize(settings.maxSize);
      setMaxCount(settings.maxCount);
      setAllowedTypes(settings.allowedTypes);
    }
  }, [settings]);

  // 解析并验证文件类型列表
  const parsedTypes = allowedTypes
    .split(",")
    .map((t) => t.trim().toLowerCase().replace(/^\./, ""))
    .filter(Boolean);

  const validateAndSave = () => {
    let hasError = false;

    const sizeVal = Number(maxSize);
    if (isNaN(sizeVal) || sizeVal < 1 || sizeVal > 500) {
      setSizeError("请输入 1–500 之间的整数");
      hasError = true;
    } else {
      setSizeError("");
    }

    const countVal = Number(maxCount);
    if (isNaN(countVal) || countVal < 1 || countVal > 20) {
      setCountError("请输入 1–20 之间的整数");
      hasError = true;
    } else {
      setCountError("");
    }

    if (!allowedTypes.trim()) {
      setTypesError("至少填写一种文件类型");
      hasError = true;
    } else {
      // 检查是否有危险扩展名
      const dangerous = parsedTypes.filter((t) =>
        ["exe", "bat", "cmd", "com", "vbs", "ps1", "msi", "dmg", "app"].includes(t)
      );
      if (dangerous.length > 0) {
        setTypesError(`包含危险文件类型: ${dangerous.join(", ")}，请移除`);
        hasError = true;
      } else {
        setTypesError("");
      }
    }

    if (hasError) return;

    const validMaxSize = Math.min(Math.max(Math.round(sizeVal), 1), 500);
    const validMaxCount = Math.min(Math.max(Math.round(countVal), 1), 20);
    const cleanedTypes = parsedTypes.join(",");

    updateSettings.mutate({
      maxSize: validMaxSize,
      maxCount: validMaxCount,
      allowedTypes: cleanedTypes,
    });
  };

  // 支持 hash 跳转到指定 tab（如 /admin/system-settings#voice）
  const defaultTab = typeof window !== 'undefined' && window.location.hash === '#voice' ? 'voice' : 'upload';

  return (
    <DashboardLayout>
      <div className="container mx-auto p-6 max-w-4xl">
        <div className="mb-6">
          <Button variant="ghost" onClick={() => setLocation("/admin")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            返回管理员后台
          </Button>
        </div>

        <div className="mb-6">
          <h1 className="text-3xl font-bold">系统设置</h1>
          <p className="text-muted-foreground mt-2">配置系统参数和功能选项</p>
        </div>

        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="upload">文件上传</TabsTrigger>
            <TabsTrigger value="voice">语音服务</TabsTrigger>
          </TabsList>

          <TabsContent value="upload">
        <Card>
          <CardHeader>
            <CardTitle>文件上传设置</CardTitle>
            <CardDescription>
              配置用户上传文件的限制参数。修改后立即生效，无需重启服务。
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">

            {/* 推荐预设 */}
            <div className="space-y-2">
              <Label className="flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5 text-yellow-500" />
                快速预设
              </Label>
              <div className="grid grid-cols-2 gap-2">
                {PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setMaxSize(preset.maxSize);
                      setMaxCount(preset.maxCount);
                      setAllowedTypes(preset.allowedTypes);
                      setSizeError(""); setCountError(""); setTypesError("");
                    }}
                    className="text-left p-3 rounded-lg border border-border hover:border-primary hover:bg-primary/5 transition-all group"
                  >
                    <div className="font-medium text-sm group-hover:text-primary">{preset.label}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{preset.desc}</div>
                    <div className="flex gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">{preset.maxSize}MB</Badge>
                      <Badge variant="secondary" className="text-[10px] h-4 px-1">最多{preset.maxCount}个</Badge>
                    </div>
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">点击预设后仍可手动调整，不会自动保存</p>
            </div>

            <div className="border-t border-border" />

            {/* 图片说明 */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <div className="text-sm text-blue-700 dark:text-blue-300">
                <span className="font-medium">图片始终允许上传，</span>无需在文件类型中填写：
                <div className="flex flex-wrap gap-1 mt-1">
                  {ALWAYS_ALLOWED_IMAGES.map((t) => (
                    <Badge key={t} variant="secondary" className="text-xs bg-blue-100 dark:bg-blue-900">
                      {t}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* 最大文件大小 */}
            <div className="space-y-2">
              <Label htmlFor="maxSize">单文件最大大小（MB）</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="maxSize"
                  type="number"
                  min={1}
                  max={500}
                  value={maxSize}
                  onChange={(e) => {
                    setMaxSize(Number(e.target.value));
                    setSizeError("");
                  }}
                  disabled={isLoading}
                  className={`max-w-[160px] ${sizeError ? "border-destructive" : ""}`}
                />
                <span className="text-sm text-muted-foreground">MB（当前：{maxSize} MB = {(maxSize * 1024).toLocaleString()} KB）</span>
              </div>
              {sizeError ? (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />{sizeError}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">允许范围：1–500 MB</p>
              )}
            </div>

            {/* 最大上传数量 */}
            <div className="space-y-2">
              <Label htmlFor="maxCount">单次最多上传文件数</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="maxCount"
                  type="number"
                  min={1}
                  max={20}
                  value={maxCount}
                  onChange={(e) => {
                    setMaxCount(Number(e.target.value));
                    setCountError("");
                  }}
                  disabled={isLoading}
                  className={`max-w-[160px] ${countError ? "border-destructive" : ""}`}
                />
                <span className="text-sm text-muted-foreground">个文件</span>
              </div>
              {countError ? (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />{countError}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">允许范围：1–20 个</p>
              )}
            </div>

            {/* 允许的文件类型 */}
            <div className="space-y-2">
              <Label htmlFor="allowedTypes">允许的文件类型扩展名</Label>
              <Textarea
                id="allowedTypes"
                value={allowedTypes}
                onChange={(e) => {
                  setAllowedTypes(e.target.value);
                  setTypesError("");
                }}
                disabled={isLoading}
                rows={3}
                placeholder={DEFAULT_ALLOWED_TYPES}
                className={typesError ? "border-destructive" : ""}
              />
              {typesError ? (
                <p className="text-sm text-destructive flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" />{typesError}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  用逗号分隔，不含点号，例如：<code className="bg-muted px-1 rounded">txt,pdf,docx</code>
                </p>
              )}

              {/* 已解析的类型预览 */}
              {parsedTypes.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    已识别 {parsedTypes.length} 种文件类型：
                  </p>
                  <div className="flex flex-wrap gap-1 max-h-28 overflow-y-auto p-2 bg-muted/40 rounded">
                    {parsedTypes.map((t) => (
                      <Badge key={t} variant="outline" className="text-xs font-mono">
                        .{t}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* 生效说明 */}
            <div className="flex items-start gap-2 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-green-700 dark:text-green-300">
                设置保存后<strong>立即生效</strong>，新的上传请求将遵循此配置，已在传输中的文件不受影响。
              </p>
            </div>

            {/* 保存按钮 */}
            <div className="flex justify-end">
              <Button
                onClick={validateAndSave}
                disabled={isLoading || updateSettings.isPending}
                className="gap-2"
              >
                <Save className="h-4 w-4" />
                {updateSettings.isPending ? "保存中..." : "保存设置"}
              </Button>
            </div>
          </CardContent>
        </Card>
          </TabsContent>

          <TabsContent value="voice">
            <VoiceSettings embedded />
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
