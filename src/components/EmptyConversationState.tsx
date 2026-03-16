import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sparkles,
  Image,
  Video,
  FileText,
  Mic,
  GraduationCap,
  PenTool,
  Briefcase,
  FlaskConical,
  Code2,
  Languages,
  BarChart3,
  Heart,
  Lightbulb,
  BookOpen,
  Mail,
  FileCheck,
  Search,
  Brain,
  Palette,
  Globe,
  Calculator,
  MessageSquare,
  Newspaper,
  ClipboardList,
  Utensils,
  Plane,
  Dumbbell,
  Scale,
  Stethoscope,
  TrendingUp,
  Presentation,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Monitor,
  type LucideIcon,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { SlideGuide } from "./creationGuide/SlideGuide";
import { WebsiteGuide } from "./creationGuide/WebsiteGuide";
import { DesignGuide } from "./creationGuide/DesignGuide";
import { AppGuide } from "./creationGuide/AppGuide";

interface EmptyConversationStateProps {
  onSelectTemplate: (template: string) => void;
  /** 直接发送 prompt（跳过输入框） */
  onSendMessage?: (text: string) => void;
}

interface Template {
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
  promptKey: string;
  color: string;
  bgColor: string;
}

interface Category {
  id: string;
  labelKey: string;
  emoji: string;
  templates: Template[];
}

/**
 * 空对话状态组件
 * 为新用户提供引导和快速开始模板，支持分类浏览
 */
import { CATEGORIES, TEMPLATES_BY_CATEGORY } from "./emptyState/templateData";

export function EmptyConversationState({ onSelectTemplate, onSendMessage }: EmptyConversationStateProps) {
  const { t } = useTranslation();
  const [activeCategory, setActiveCategory] = useState<string>("hot");
  const [showAll, setShowAll] = useState(false);
  // ★ 创作引导面板状态
  const [activeGuide, setActiveGuide] = useState<'slide' | 'website' | 'app' | 'design' | null>(null);

  const activeTemplates = useMemo(
    () => CATEGORIES.find((c) => c.id === activeCategory)?.templates ?? [],
    [activeCategory]
  );
  const displayedTemplates = showAll ? activeTemplates : activeTemplates.slice(0, 4);

  /** 引导面板提交 → 直接发送（如果有 onSendMessage），否则填入输入框 */
  const handleGuideSubmit = (prompt: string) => {
    setActiveGuide(null);
    if (onSendMessage) {
      onSendMessage(prompt);
    } else {
      onSelectTemplate(prompt);
    }
  };

  // ★ 四个快捷创作入口的配置 — 全部配备引导面板
  const QUICK_ACTIONS = [
    { id: 'slide' as const, icon: Presentation, label: '制作幻灯片' },
    { id: 'website' as const, icon: Globe, label: '创建网站' },
    { id: 'app' as const, icon: Monitor, label: '开发应用' },
    { id: 'design' as const, icon: Palette, label: '设计' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 space-y-6 max-w-4xl mx-auto w-full">
      {/* 欢迎标题 */}
      <div className="text-center space-y-2">
        <div className="flex justify-center mb-3">
          <div className="relative">
            <Sparkles className="h-12 w-12 md:h-14 md:w-14 text-primary" />
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
          </div>
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-foreground">
          {t('chat.emptyState.title')}
        </h2>
        <p className="text-muted-foreground text-base md:text-lg">
          {t('chat.emptyState.subtitle')}
        </p>
      </div>

      {/* ★ 快捷创作入口 — 4 个横排按钮 */}
      <div className="flex items-center justify-center gap-2 md:gap-3 w-full flex-wrap">
        {QUICK_ACTIONS.map(action => {
          const Icon = action.icon;
          const isActive = activeGuide === action.id;
          return (
            <button
              key={action.id}
              onClick={() => {
                setActiveGuide(isActive ? null : action.id);
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-full border text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'border-primary bg-primary/5 text-primary shadow-sm scale-105'
                  : 'border-border/60 bg-background hover:border-border hover:bg-muted/40 hover:scale-105 text-foreground/80'
              }`}
            >
              <Icon className="w-4 h-4" />
              {action.label}
            </button>
          );
        })}
      </div>

      {/* ★ 创作引导面板 — 展开在按钮下方 */}
      {activeGuide === 'slide' && (
        <div className="w-full max-w-lg">
          <SlideGuide onSubmit={handleGuideSubmit} onClose={() => setActiveGuide(null)} />
        </div>
      )}
      {activeGuide === 'website' && (
        <div className="w-full max-w-lg">
          <WebsiteGuide onSubmit={handleGuideSubmit} onClose={() => setActiveGuide(null)} />
        </div>
      )}
      {activeGuide === 'app' && (
        <div className="w-full max-w-lg">
          <AppGuide onSubmit={handleGuideSubmit} onClose={() => setActiveGuide(null)} />
        </div>
      )}
      {activeGuide === 'design' && (
        <div className="w-full max-w-lg">
          <DesignGuide onSubmit={handleGuideSubmit} onClose={() => setActiveGuide(null)} />
        </div>
      )}

      {/* 分类标签栏 - 可横向滚动 */}
      <div className="w-full overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 pb-1 min-w-max px-1 justify-center flex-wrap">
          {CATEGORIES.map((cat) => (
            <Button
              key={cat.id}
              variant={activeCategory === cat.id ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActiveCategory(cat.id);
                setShowAll(false);
              }}
              className={`rounded-full text-xs md:text-sm whitespace-nowrap transition-all duration-200 ${
                activeCategory === cat.id
                  ? "shadow-md scale-105"
                  : "hover:scale-105"
              }`}
            >
              <span className="mr-1">{cat.emoji}</span>
              {t(cat.labelKey)}
            </Button>
          ))}
        </div>
      </div>

      {/* 模板卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full">
        {displayedTemplates.map((template, index) => {
          const Icon = template.icon;
          return (
            <Card
              key={`${activeCategory}-${index}`}
              className="p-3 md:p-4 hover:shadow-lg transition-all duration-200 cursor-pointer group border border-border/50 hover:border-primary/30"
              onClick={() => onSelectTemplate(t(template.promptKey))}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`${template.bgColor} p-2.5 rounded-xl group-hover:scale-110 transition-transform duration-200 shrink-0`}
                >
                  <Icon className={`h-5 w-5 ${template.color}`} />
                </div>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <h3 className="font-semibold text-sm text-foreground group-hover:text-primary transition-colors truncate">
                    {t(template.titleKey)}
                  </h3>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {t(template.descKey)}
                  </p>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground/0 group-hover:text-primary group-hover:translate-x-0.5 transition-all duration-200 shrink-0 mt-1 group-hover:text-muted-foreground" />
              </div>
            </Card>
          );
        })}
      </div>

      {/* 展开/收起按钮 */}
      {activeTemplates.length > 4 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="text-muted-foreground hover:text-foreground"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-4 w-4 mr-1" />
              {t('chat.emptyState.showLess')}
            </>
          ) : (
            <>
              <ChevronDown className="h-4 w-4 mr-1" />
              {t('chat.emptyState.showMore', { count: activeTemplates.length - 4 })}
            </>
          )}
        </Button>
      )}

      {/* 底部提示 */}
      <div className="text-center space-y-1.5 max-w-2xl">
        <p className="text-xs text-muted-foreground">
          {t('chat.emptyState.tip')}
        </p>
        <p className="text-xs text-muted-foreground/70">
          {t('chat.emptyState.supportInfo')}
        </p>
      </div>
    </div>
  );
}
