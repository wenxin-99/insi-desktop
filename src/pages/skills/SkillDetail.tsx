/**
 * 技能详情 + 安装配置页面
 *
 * src/pages/skills/SkillDetail.tsx
 */
import { useState, useEffect } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Download, Star, Zap, Clock, CheckCircle2,
  Loader2, AlertCircle,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation, useParams } from "wouter";
import { useToast } from "@/hooks/use-toast";

// ═══════════ 参数输入组件 ═══════════

function ParamInput({ input, value, onChange }: {
  input: any;
  value: any;
  onChange: (v: any) => void;
}) {
  switch (input.type) {
    case "textarea":
      return (
        <Textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={input.placeholder}
          className="min-h-[80px]"
        />
      );
    case "select":
      return (
        <select
          value={value || input.default || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2 rounded-md border bg-background text-sm"
        >
          {(input.options || []).map((opt: string) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );
    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={value ?? input.default ?? false}
            onChange={(e) => onChange(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm">{input.description || "启用"}</span>
        </label>
      );
    case "number":
      return (
        <Input
          type="number"
          value={value ?? input.default ?? ""}
          onChange={(e) => onChange(Number(e.target.value))}
          placeholder={input.placeholder}
          min={input.validation?.min}
          max={input.validation?.max}
        />
      );
    case "cron":
      return (
        <div className="space-y-1">
          <Input
            value={value || input.default || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="如: 0 0 9 * * * (每天早上9点)"
            className="font-mono text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            {[
              { label: "每天9点", value: "0 0 9 * * *" },
              { label: "每天18点", value: "0 0 18 * * *" },
              { label: "每周一9点", value: "0 0 9 * * 1" },
              { label: "每小时", value: "0 0 * * * *" },
            ].map(p => (
              <button
                key={p.value}
                type="button"
                onClick={() => onChange(p.value)}
                className="text-[11px] px-2 py-0.5 rounded bg-muted hover:bg-accent transition-colors"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      );
    default:
      return (
        <Input
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={input.placeholder}
        />
      );
  }
}

// ═══════════ 主页面 ═══════════

export default function SkillDetail() {
  const [, navigate] = useLocation();
  const routeParams = useParams();
  const id = routeParams.id;
  const { toast } = useToast();

  const [skillParams, setSkillParams] = useState<Record<string, any>>({});
  const [installing, setInstalling] = useState(false);

  const skillQuery = trpc.skill.detail.useQuery({ id: Number(id) }, { enabled: !!id });
  const installedQuery = trpc.skill.installed.useQuery();
  const installMutation = trpc.skill.install.useMutation();

  const skill = skillQuery.data;
  const config = skill?.config || {};
  const inputs = config.inputs || [];
  const isInstalled = (installedQuery.data || []).some((us: any) => us.skillId === Number(id));

  // 初始化默认参数
  useEffect(() => {
    if (inputs.length > 0 && Object.keys(skillParams).length === 0) {
      const defaults: Record<string, any> = {};
      for (const inp of inputs) {
        if (inp.default !== undefined) defaults[inp.name] = inp.default;
      }
      // 如果有示例参数，用它们填充
      if (config.exampleParams) {
        Object.assign(defaults, config.exampleParams);
      }
      setSkillParams(defaults);
    }
  }, [inputs, config.exampleParams]);

  const handleInstall = async () => {
    if (!skill) return;
    setInstalling(true);
    try {
      const result = await installMutation.mutateAsync({
        skillId: skill.id,
        params: skillParams,
      });
      toast({ title: "安装成功", description: result.message });
      installedQuery.refetch();
      navigate("/playbooks/mine");
    } catch (error: any) {
      toast({
        title: "安装失败",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setInstalling(false);
    }
  };

  if (skillQuery.isLoading) {
    return (
      <PageLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" />
        </div>
      </PageLayout>
    );
  }

  if (!skill) {
    return (
      <PageLayout>
        <div className="text-center py-20 text-muted-foreground">
          <AlertCircle className="w-12 h-12 mx-auto mb-4" />
          <p>技能不存在</p>
        </div>
      </PageLayout>
    );
  }

  const tags = Array.isArray(skill.tags) ? skill.tags : [];

  return (
    <PageLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-6">
        {/* Back */}
        <Button variant="ghost" size="sm" onClick={() => navigate("/playbooks")} className="gap-1 -ml-2">
          <ArrowLeft className="w-4 h-4" /> 返回市场
        </Button>

        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center text-3xl shrink-0">
            {skill.icon || "🔧"}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold">{skill.name}</h1>
              {skill.isOfficial && (
                <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">官方</Badge>
              )}
              {isInstalled && (
                <Badge variant="secondary" className="gap-1">
                  <CheckCircle2 className="w-3 h-3" /> 已安装
                </Badge>
              )}
            </div>
            <p className="text-muted-foreground mt-1">{skill.description}</p>

            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1">
                <Download className="w-3.5 h-3.5" /> {skill.installCount} 次安装
              </span>
              {config.estimatedCost && (
                <span className="flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" /> 约 {config.estimatedCost} 🐟/次
                </span>
              )}
              {config.triggers?.cron && (
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" /> 支持定时
                </span>
              )}
            </div>

            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tags.map((tag: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs font-normal">{tag}</Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 参数配置 */}
        {!isInstalled && inputs.length > 0 && (
          <div className="border rounded-xl p-5 space-y-4">
            <h2 className="font-semibold text-lg">配置参数</h2>
            <p className="text-sm text-muted-foreground">
              根据你的需求填写以下参数，安装后也可随时修改
            </p>
            {inputs.map((inp: any) => (
              <div key={inp.name} className="space-y-1.5">
                <label className="text-sm font-medium flex items-center gap-1.5">
                  {inp.label}
                  {inp.required && <span className="text-destructive">*</span>}
                </label>
                {inp.description && (
                  <p className="text-[12px] text-muted-foreground">{inp.description}</p>
                )}
                <ParamInput
                  input={inp}
                  value={skillParams[inp.name]}
                  onChange={(v) => setSkillParams(prev => ({ ...prev, [inp.name]: v }))}
                />
              </div>
            ))}
          </div>
        )}

        {/* 技能详细信息 */}
        <div className="border rounded-xl p-5 space-y-3">
          <h2 className="font-semibold text-lg">技能信息</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <span className="text-muted-foreground">类型：</span>
              <span className="ml-1">
                {config.pipeline?.type === "scheduled_research" ? "深度研究" :
                 config.pipeline?.type === "automation" ? "浏览器自动化" :
                 config.pipeline?.type === "webhook" ? "Webhook" :
                 config.pipeline?.type === "chat" ? "AI 对话" : "组合"}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground">作者：</span>
              <span className="ml-1">{config.author || "未知"}</span>
            </div>
            <div>
              <span className="text-muted-foreground">版本：</span>
              <span className="ml-1">{config.version || "1.0.0"}</span>
            </div>
            {config.triggers?.command && (
              <div>
                <span className="text-muted-foreground">命令：</span>
                <code className="ml-1 px-1.5 py-0.5 bg-muted rounded text-xs">{config.triggers.command}</code>
              </div>
            )}
          </div>
        </div>

        {/* Action */}
        <div className="flex justify-end gap-3">
          {isInstalled ? (
            <Button variant="outline" onClick={() => navigate("/playbooks/mine")}>
              前往管理
            </Button>
          ) : (
            <Button onClick={handleInstall} disabled={installing} className="min-w-[120px]">
              {installing ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Download className="w-4 h-4 mr-1" />}
              {installing ? "安装中..." : "安装技能"}
            </Button>
          )}
        </div>
      </div>
    </PageLayout>
  );
}
