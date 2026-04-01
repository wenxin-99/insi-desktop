import DashboardLayout from "@/components/DashboardLayout";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { Package, Mic2, DollarSign, ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import PackageManagement from "./PackageManagement";
import VoicePackageManagement from "./VoicePackageManagement";
import HomeworkPricingConfig from "../HomeworkPricingConfig";

function Section({
  title,
  subtitle,
  icon: Icon,
  badge,
  badgeVariant = "secondary",
  defaultOpen = true,
  accentClass,
  children,
}: {
  title: string;
  subtitle?: string;
  icon: any;
  badge?: string;
  badgeVariant?: "default" | "secondary" | "outline";
  defaultOpen?: boolean;
  accentClass?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-xl border bg-card overflow-hidden ${accentClass ?? ""}`}>
      <Collapsible defaultOpen={defaultOpen}>
        <CollapsibleTrigger asChild>
          <button className="flex items-center w-full gap-3 px-5 py-4 text-left hover:bg-muted/30 transition-colors">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-semibold">{title}</span>
                  {badge && <Badge variant={badgeVariant} className="text-xs">{badge}</Badge>}
                </div>
                {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
              </div>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0 [[data-state=closed]_&]:rotate-[-90deg]" />
          </button>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t px-5 py-5">{children}</div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 my-2">
      <div className="h-px flex-1 bg-border" />
      <span className="text-xs font-semibold text-muted-foreground px-2 uppercase tracking-wider">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

export default function PackagePricingCenter() {
  return (
    <DashboardLayout>
      <div className="p-6 max-w-6xl">
        {/* 页头 */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold">套餐与定价</h1>
          <p className="text-sm text-muted-foreground mt-1">
            管理用户套餐方案和各功能费率配置
          </p>
        </div>

        {/* ── 用户套餐区 ── */}
        <SectionDivider label="用户套餐" />
        <div className="space-y-3 mb-8">

          {/* AI 模型套餐 */}
          <Section
            title="AI 模型套餐"
            subtitle="配置供用户订阅的 AI 对话套餐，绑定模型、配额和计费方式"
            icon={Package}
            badge="对话"
            badgeVariant="default"
            accentClass="border-l-4 border-l-blue-500"
            defaultOpen
          >
            <PackageManagement embedded />
          </Section>

          {/* 语音套餐 */}
          <Section
            title="语音套餐"
            subtitle="配置语音对话页面可选的套餐，指定 STT/TTS 服务商和专属音色（前台最多展示 3 个）"
            icon={Mic2}
            badge="语音"
            badgeVariant="secondary"
            accentClass="border-l-4 border-l-purple-500"
            defaultOpen
          >
            <VoicePackageManagement embedded />
          </Section>

        </div>

        {/* ── 功能费率区 ── */}
        <SectionDivider label="功能费率（独立于套餐）" />
        <div className="space-y-3">
          <Section
            title="功能费率"
            subtitle="图片生成、作业批改等独立计费功能的费率设置"
            icon={DollarSign}
            defaultOpen={false}
          >
            <div className="space-y-8">
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">📝 作业批改</h3>
                <HomeworkPricingConfig embedded />
              </div>
            </div>
          </Section>
        </div>

      </div>
    </DashboardLayout>
  );
}
