import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  Plus,
  FileText,
  Brain,
  ArrowRight,
  Coins,
  AlertCircle,
  Sparkles,
  TrendingUp,
  Globe,
  Cpu,
  Building2,
  GraduationCap,
  Briefcase,
  Heart,
  Scale,
  Leaf,
  Rocket,
  BarChart3,
  Microscope,
  BookOpen,
  Lightbulb,
  Users,
  ShieldCheck,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { toast } from "sonner";
import { useLocation } from "wouter";


// ==================== 研究模板定义 ====================
interface ResearchTemplate {
  icon: LucideIcon;
  title: string;
  prompt: string;
  color: string;
  bgColor: string;
}

interface ResearchCategory {
  id: string;
  label: string;
  emoji: string;
  templates: ResearchTemplate[];
}

const researchCategories: ResearchCategory[] = [
  {
    id: "trending",
    label: "热门趋势",
    emoji: "🔥",
    templates: [
      {
        icon: Cpu,
        title: "AI大模型发展趋势",
        prompt: "深度分析2025-2026年人工智能大语言模型的最新发展趋势，包括GPT、Claude、Gemini、DeepSeek等主要模型的技术突破、性能对比、商业应用场景和未来演进方向",
        color: "text-violet-600 dark:text-violet-400",
        bgColor: "bg-violet-50 dark:bg-violet-950/20",
      },
      {
        icon: Rocket,
        title: "AI Agent技术全景",
        prompt: "全面研究AI Agent（智能体）技术的最新进展，包括AutoGPT、CrewAI等框架对比、多智能体协作、工具使用能力、落地应用案例和未来发展路线图",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/20",
      },
      {
        icon: Globe,
        title: "中美科技竞争格局",
        prompt: "分析当前中美科技竞争的最新格局，涵盖芯片半导体、人工智能、量子计算、航天航空等关键领域的政策动态、技术差距、供应链变化和地缘政治影响",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/20",
      },
      {
        icon: Zap,
        title: "新能源汽车市场",
        prompt: "研究2026年全球新能源汽车市场的最新数据与趋势，包括各品牌销量排名、固态电池技术进展、智能驾驶政策法规、充电基础设施建设和市场竞争格局分析",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/20",
      },
    ],
  },
  {
    id: "industry",
    label: "行业研究",
    emoji: "🏢",
    templates: [
      {
        icon: Building2,
        title: "房地产市场分析",
        prompt: "研究当前中国房地产市场的最新政策、房价走势、库存数据、土地拍卖情况和调控政策变化，分析一线与二三线城市的市场分化趋势和投资建议",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/20",
      },
      {
        icon: Heart,
        title: "医疗健康产业前沿",
        prompt: "深度研究全球医疗健康产业的最新发展，包括AI辅助诊断、基因编辑疗法、mRNA技术应用、远程医疗创新和数字健康市场的投资热点和监管动态",
        color: "text-pink-600 dark:text-pink-400",
        bgColor: "bg-pink-50 dark:bg-pink-950/20",
      },
      {
        icon: BarChart3,
        title: "半导体芯片产业链",
        prompt: "全面分析全球半导体产业链的最新动态，包括台积电/三星/英特尔先进制程竞赛、中国芯片自主化进展、EDA工具国产替代、RISC-V生态发展和AI芯片市场格局",
        color: "text-cyan-600 dark:text-cyan-400",
        bgColor: "bg-cyan-50 dark:bg-cyan-950/20",
      },
      {
        icon: TrendingUp,
        title: "金融科技创新报告",
        prompt: "研究全球金融科技领域的最新创新趋势，包括数字货币/CBDC进展、DeFi与合规金融融合、AI量化交易、嵌入式金融、开放银行API生态和监管科技发展",
        color: "text-emerald-600 dark:text-emerald-400",
        bgColor: "bg-emerald-50 dark:bg-emerald-950/20",
      },
      {
        icon: Leaf,
        title: "碳中和与ESG研究",
        prompt: "研究全球碳中和政策和ESG投资的最新进展，包括各国碳交易市场数据、企业碳足迹披露规范、绿色金融产品创新、可再生能源技术突破和ESG评级体系对比",
        color: "text-teal-600 dark:text-teal-400",
        bgColor: "bg-teal-50 dark:bg-teal-950/20",
      },
    ],
  },
  {
    id: "academic",
    label: "学术研究",
    emoji: "🎓",
    templates: [
      {
        icon: Microscope,
        title: "量子计算研究进展",
        prompt: "系统梳理量子计算领域的最新研究进展，包括量子比特数突破、纠错码技术、量子优势实验、主要研究机构（Google/IBM/中科大）的成果对比和实际应用前景",
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
      },
      {
        icon: Brain,
        title: "脑机接口技术前沿",
        prompt: "深度研究脑机接口(BCI)技术的最新突破，包括Neuralink临床试验、非侵入式BCI进展、脑机接口在医疗康复中的应用、伦理争议和未来商业化路径",
        color: "text-purple-600 dark:text-purple-400",
        bgColor: "bg-purple-50 dark:bg-purple-950/20",
      },
      {
        icon: BookOpen,
        title: "教育数字化转型",
        prompt: "研究全球教育数字化转型的最新趋势，包括AI个性化学习、自适应教学平台、虚拟现实课堂、在线教育市场格局、教育公平与数字鸿沟问题分析",
        color: "text-blue-600 dark:text-blue-400",
        bgColor: "bg-blue-50 dark:bg-blue-950/20",
      },
      {
        icon: GraduationCap,
        title: "论文选题方向建议",
        prompt: "请帮我调研[请替换为你的学科方向]领域最近3年的热门研究选题方向，分析各方向的研究热度、发表难度、创新空间和代表性高引论文，给出5个具体的选题建议",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/20",
      },
    ],
  },
  {
    id: "business",
    label: "商业分析",
    emoji: "💼",
    templates: [
      {
        icon: Briefcase,
        title: "竞品深度对比分析",
        prompt: "请帮我对[产品A]和[产品B]进行全方位竞品分析，包括产品功能对比、定价策略、目标用户画像、市场占有率、融资情况、技术壁垒和SWOT分析",
        color: "text-slate-600 dark:text-slate-400",
        bgColor: "bg-slate-50 dark:bg-slate-950/20",
      },
      {
        icon: Users,
        title: "用户增长策略研究",
        prompt: "深度研究互联网产品用户增长的最新策略和案例，包括PLG（产品驱动增长）模式、社区运营、内容营销、裂变拉新和留存提升的最佳实践，给出可落地的增长方案",
        color: "text-sky-600 dark:text-sky-400",
        bgColor: "bg-sky-50 dark:bg-sky-950/20",
      },
      {
        icon: TrendingUp,
        title: "行业投资机会分析",
        prompt: "分析[请替换为目标行业]的投资机会，包括行业市场规模及增速、产业链上下游梳理、头部企业估值对比、政策红利窗口期、风险因素评估和投资建议",
        color: "text-green-600 dark:text-green-400",
        bgColor: "bg-green-50 dark:bg-green-950/20",
      },
      {
        icon: Globe,
        title: "出海市场调研",
        prompt: "研究中国企业出海[请替换为目标市场如东南亚/中东/拉美]的最新情况，包括市场容量、消费者偏好、竞争格局、本地化策略、支付与物流基础设施和合规注意事项",
        color: "text-orange-600 dark:text-orange-400",
        bgColor: "bg-orange-50 dark:bg-orange-950/20",
      },
    ],
  },
  {
    id: "society",
    label: "社会热点",
    emoji: "🌍",
    templates: [
      {
        icon: ShieldCheck,
        title: "数据隐私与AI监管",
        prompt: "研究全球AI监管和数据隐私保护的最新政策动态，包括欧盟AI Act、中国生成式AI管理办法、美国AI行政令的核心内容对比、企业合规要点和执法案例分析",
        color: "text-red-600 dark:text-red-400",
        bgColor: "bg-red-50 dark:bg-red-950/20",
      },
      {
        icon: Users,
        title: "人口结构与老龄化",
        prompt: "深度分析中国人口结构变化的最新数据和趋势，包括出生率/老龄化率走势、各地人口政策对比、银发经济市场规模、养老产业创新模式和社会保障体系改革方向",
        color: "text-amber-600 dark:text-amber-400",
        bgColor: "bg-amber-50 dark:bg-amber-950/20",
      },
      {
        icon: Lightbulb,
        title: "就业市场趋势分析",
        prompt: "研究当前就业市场的最新趋势和数据，包括热门/冷门行业薪资变化、AI对各行业岗位的影响、远程办公/灵活就业发展状况、应届生就业情况和职业技能需求变化",
        color: "text-yellow-600 dark:text-yellow-400",
        bgColor: "bg-yellow-50 dark:bg-yellow-950/20",
      },
      {
        icon: Scale,
        title: "国际地缘政治分析",
        prompt: "分析当前国际地缘政治的最新形势，包括主要地区冲突动态、大国外交关系变化、国际组织改革动向、经济制裁影响评估和全球供应链重组趋势",
        color: "text-indigo-600 dark:text-indigo-400",
        bgColor: "bg-indigo-50 dark:bg-indigo-950/20",
      },
    ],
  },
];

// 状态颜色映射
const statusConfig: Record<string, { color: string; icon: any; label: string }> = {
  pending: { color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: Clock, label: "等待中" },
  processing: { color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400", icon: Loader2, label: "研究中" },
  completed: { color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2, label: "已完成" },
  failed: { color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle, label: "失败" },
};
