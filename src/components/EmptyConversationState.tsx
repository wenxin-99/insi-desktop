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
  // ★ 创作引导面板状态
  const [activeGuide, setActiveGuide] = useState<'slide' | 'website' | 'app' | 'design' | null>(null);

  // ★ 精选 4 个核心建议卡片（从热门分类取前 4 个）
  const topTemplates = useMemo(
    () => (CATEGORIES.find((c) => c.id === "hot")?.templates ?? []).slice(0, 4),
    []
  );

  // ★ P3-⑮ 随机建议问题（每次刷新随机 3 个）
  const suggestedPrompts = useMemo(() => {
    const allPrompts = [
      '帮我写一封请假邮件，周五需要去看牙',
      '用 Python 写一个网站 SEO 分析脚本',
      '制定一个 30 天健身计划，我是初学者',
      '帮我分析一下这段代码有什么问题',
      '用通俗的语言解释量子计算是什么',
      '帮我写一个简历的自我评价，3年前端经验',
      '推荐 5 本关于产品设计的好书',
      '帮我翻译一段技术文档成英文',
      '解释 TCP 三次握手的过程',
      '帮我设计一个登录页面的UI方案',
      '写一个 React 待办清单应用',
      '帮我整理这周的会议纪要',
    ];
    const shuffled = [...allPrompts].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 3);
  }, []);

  /** 引导面板提交 → 直接发送（如果有 onSendMessage），否则填入输入框 */
  const handleGuideSubmit = (prompt: string) => {
    setActiveGuide(null);
    if (onSendMessage) {
      onSendMessage(prompt);
    } else {
      onSelectTemplate(prompt);
    }
  };

  // ★ 快捷创作入口 — 横向滚动 pill 按钮
  const QUICK_ACTIONS = [
    { id: 'slide' as const, icon: Presentation, label: '制作幻灯片' },
    { id: 'website' as const, icon: Globe, label: '创建网站' },
    { id: 'app' as const, icon: Monitor, label: '开发应用' },
    { id: 'design' as const, icon: Palette, label: '设计' },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-4 md:p-8 space-y-5 max-w-3xl mx-auto w-full">
      {/* ★ 精简欢迎标题 — 去掉模糊光晕效果 */}
      <div className="text-center space-y-1">
        <div className="flex justify-center mb-2">
          <Sparkles className="h-10 w-10 md:h-12 md:w-12 text-primary" />
        </div>
        <h2 className="text-xl md:text-2xl font-semibold text-foreground">
          {t('chat.emptyState.title')}
        </h2>
        <p className="text-muted-foreground text-sm">
          {t('chat.emptyState.subtitle')}
        </p>
      </div>

      {/* ★ 4 个核心建议卡片（2x2 网格） */}
      <div className="grid grid-cols-2 gap-2.5 md:gap-3 w-full max-w-xl">
        {topTemplates.map((template, index) => {
          const Icon = template.icon;
          return (
            <Card
              key={index}
              className="p-3 md:p-4 hover:shadow-md transition-all duration-200 cursor-pointer group border border-border/50 hover:border-primary/20"
              onClick={() => onSelectTemplate(t(template.promptKey))}
            >
              <div className={`${template.bgColor} w-8 h-8 rounded-lg flex items-center justify-center mb-2 group-hover:scale-110 transition-transform`}>
                <Icon className={`h-4 w-4 ${template.color}`} />
              </div>
              <h3 className="font-medium text-sm text-foreground group-hover:text-primary transition-colors">
                {t(template.titleKey)}
              </h3>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {t(template.descKey)}
              </p>
            </Card>
          );
        })}
      </div>

      {/* ★ P3-⑮ 随机建议问题（降低使用门槛） */}
      {!activeGuide && (
        <div className="w-full max-w-xl space-y-1.5">
          <p className="text-xs text-muted-foreground text-center">{t('chat.emptyState.tryAsking', '试试这样问')}</p>
          <div className="flex flex-col gap-1.5">
            {suggestedPrompts.map((prompt, i) => (
              <button
                key={i}
                onClick={() => onSendMessage ? onSendMessage(prompt) : onSelectTemplate(prompt)}
                className="text-left text-sm px-3.5 py-2 rounded-lg border border-border/40 hover:border-primary/30 hover:bg-muted/30 text-foreground/70 hover:text-foreground transition-all duration-150 group flex items-center gap-2"
              >
                <ArrowRight className="w-3 h-3 text-muted-foreground group-hover:text-primary transition-colors flex-shrink-0" />
                <span className="line-clamp-1">{prompt}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ★ 快捷创作 pill 按钮行（可横向滚动） */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {QUICK_ACTIONS.map(action => {
          const Icon = action.icon;
          const isActive = activeGuide === action.id;
          return (
            <button
              key={action.id}
              onClick={() => setActiveGuide(isActive ? null : action.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-full border text-xs md:text-sm font-medium transition-all duration-200 ${
                isActive
                  ? 'border-primary bg-primary/5 text-primary shadow-sm'
                  : 'border-border/60 bg-background hover:border-border hover:bg-muted/40 text-foreground/80'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {action.label}
            </button>
          );
        })}
      </div>

      {/* ★ 创作引导面板 — 展开在 pill 下方 */}
      {activeGuide === 'slide' && (
        <div className="w-full max-w-lg"><SlideGuide onSubmit={handleGuideSubmit} onClose={() => setActiveGuide(null)} /></div>
      )}
      {activeGuide === 'website' && (
        <div className="w-full max-w-lg"><WebsiteGuide onSubmit={handleGuideSubmit} onClose={() => setActiveGuide(null)} /></div>
      )}
      {activeGuide === 'app' && (
        <div className="w-full max-w-lg"><AppGuide onSubmit={handleGuideSubmit} onClose={() => setActiveGuide(null)} /></div>
      )}
      {activeGuide === 'design' && (
        <div className="w-full max-w-lg"><DesignGuide onSubmit={handleGuideSubmit} onClose={() => setActiveGuide(null)} /></div>
      )}

      {/* ★ 底部单行提示（精简） */}
      <p className="text-xs text-muted-foreground/60 text-center">
        {t('chat.emptyState.tip')}
      </p>
    </div>
  );
}
