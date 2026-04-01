/**
 * slashTemplates — Slash 命令 Prompt 模板库
 *
 * 分类：写作 / 翻译 / 代码 / 分析 / 学习 / 创意
 * 每个模板支持可选变量占位符
 */

import {
  PenTool, Languages, Code2, BarChart3, GraduationCap,
  Lightbulb, FileText, Mail, ListChecks, Repeat,
  BookOpen, Sparkles, Bug, Layers, MessageCircle,
  Presentation, Brain, Target, Palette, Zap,
  ScrollText, Scale, FlaskConical, Newspaper,
} from 'lucide-react';
import type { ReactNode } from 'react';

export interface SlashTemplate {
  id: string;
  category: string;
  icon: ReactNode;
  label: string;
  description: string;
  prompt: string;
  /** 需要用户填写的变量 */
  variables?: { key: string; label: string; placeholder: string }[];
  keywords?: string[];
}

export const TEMPLATE_CATEGORIES = [
  { id: 'all', label: '全部', icon: '✨' },
  { id: 'writing', label: '写作', icon: '✍️' },
  { id: 'translate', label: '翻译', icon: '🌐' },
  { id: 'code', label: '代码', icon: '💻' },
  { id: 'analysis', label: '分析', icon: '📊' },
  { id: 'learning', label: '学习', icon: '📚' },
  { id: 'creative', label: '创意', icon: '🎨' },
];

export const SLASH_TEMPLATES: SlashTemplate[] = [
  // ═══════ 写作 ═══════
  {
    id: 'tpl-email',
    category: 'writing',
    icon: <Mail className="w-4 h-4 text-blue-500" />,
    label: '写邮件',
    description: '生成专业的邮件内容',
    prompt: '请帮我写一封{type}邮件，收件人是{recipient}，主题是：{topic}',
    variables: [
      { key: 'type', label: '邮件类型', placeholder: '工作/感谢/邀请/道歉' },
      { key: 'recipient', label: '收件人', placeholder: '客户/同事/领导' },
      { key: 'topic', label: '主题', placeholder: '项目进展汇报' },
    ],
    keywords: ['email', '邮件', '信'],
  },
  {
    id: 'tpl-article',
    category: 'writing',
    icon: <FileText className="w-4 h-4 text-emerald-500" />,
    label: '写文章',
    description: '生成结构化的文章或博客',
    prompt: '请写一篇关于"{topic}"的文章，风格为{style}，字数约{length}字',
    variables: [
      { key: 'topic', label: '主题', placeholder: 'AI 的未来发展' },
      { key: 'style', label: '风格', placeholder: '科普/专业/通俗' },
      { key: 'length', label: '字数', placeholder: '1500' },
    ],
    keywords: ['article', 'blog', '文章', '博客'],
  },
  {
    id: 'tpl-copywriting',
    category: 'writing',
    icon: <PenTool className="w-4 h-4 text-pink-500" />,
    label: '文案撰写',
    description: '营销文案、标题、广告语',
    prompt: '请为{product}写一段{type}文案，目标用户是{audience}，突出{highlight}',
    variables: [
      { key: 'product', label: '产品/品牌', placeholder: '智能手表' },
      { key: 'type', label: '文案类型', placeholder: '朋友圈/小红书/广告' },
      { key: 'audience', label: '目标用户', placeholder: '年轻白领' },
      { key: 'highlight', label: '卖点', placeholder: '续航长、外观时尚' },
    ],
    keywords: ['copy', '文案', '营销', '广告'],
  },
  {
    id: 'tpl-summary',
    category: 'writing',
    icon: <ListChecks className="w-4 h-4 text-amber-500" />,
    label: '总结摘要',
    description: '将长文本提炼为核心要点',
    prompt: '请将以下内容总结为要点摘要，提取关键信息：\n\n',
    keywords: ['summary', '总结', '摘要', '提炼'],
  },
  {
    id: 'tpl-rewrite',
    category: 'writing',
    icon: <Repeat className="w-4 h-4 text-violet-500" />,
    label: '改写润色',
    description: '优化文字表达和结构',
    prompt: '请改写润色以下文字，使其更加{style}：\n\n',
    variables: [
      { key: 'style', label: '目标风格', placeholder: '专业/生动/简洁' },
    ],
    keywords: ['rewrite', 'polish', '改写', '润色', '优化'],
  },
  {
    id: 'tpl-weekly',
    category: 'writing',
    icon: <ScrollText className="w-4 h-4 text-cyan-500" />,
    label: '周报/日报',
    description: '生成工作周报或日报',
    prompt: '请根据以下工作内容，生成一份{type}：\n\n本周完成：\n- \n\n下周计划：\n- \n\n遇到的问题：\n- ',
    variables: [
      { key: 'type', label: '报告类型', placeholder: '周报/日报/月报' },
    ],
    keywords: ['weekly', 'report', '周报', '日报', '工作汇报'],
  },

  // ═══════ 翻译 ═══════
  {
    id: 'tpl-translate',
    category: 'translate',
    icon: <Languages className="w-4 h-4 text-blue-500" />,
    label: '翻译',
    description: '准确翻译文本到目标语言',
    prompt: '请将以下内容翻译为{language}，保持原文的语气和风格：\n\n',
    variables: [
      { key: 'language', label: '目标语言', placeholder: '英语/日语/韩语' },
    ],
    keywords: ['translate', '翻译'],
  },
  {
    id: 'tpl-proofread',
    category: 'translate',
    icon: <BookOpen className="w-4 h-4 text-green-500" />,
    label: '语法纠错',
    description: '检查并修正语法错误',
    prompt: '请检查以下{language}文本的语法和拼写错误，列出修正建议：\n\n',
    variables: [
      { key: 'language', label: '语言', placeholder: '英语/中文' },
    ],
    keywords: ['proofread', 'grammar', '纠错', '语法'],
  },

  // ═══════ 代码 ═══════
  {
    id: 'tpl-code-review',
    category: 'code',
    icon: <Bug className="w-4 h-4 text-red-500" />,
    label: '代码审查',
    description: '审查代码质量、安全性和性能',
    prompt: '请审查以下代码，从代码质量、安全性、性能三个维度给出改进建议：\n\n```\n\n```',
    keywords: ['review', 'code review', '审查', '代码审查'],
  },
  {
    id: 'tpl-code-explain',
    category: 'code',
    icon: <MessageCircle className="w-4 h-4 text-blue-500" />,
    label: '代码解释',
    description: '逐行解释代码逻辑',
    prompt: '请逐步解释以下代码的功能和实现逻辑：\n\n```\n\n```',
    keywords: ['explain', '解释', '代码解释'],
  },
  {
    id: 'tpl-code-convert',
    category: 'code',
    icon: <Repeat className="w-4 h-4 text-purple-500" />,
    label: '代码转换',
    description: '在不同编程语言间转换代码',
    prompt: '请将以下{from}代码转换为{to}，保持功能一致：\n\n```{from}\n\n```',
    variables: [
      { key: 'from', label: '源语言', placeholder: 'Python' },
      { key: 'to', label: '目标语言', placeholder: 'TypeScript' },
    ],
    keywords: ['convert', '转换', '语言转换'],
  },
  {
    id: 'tpl-regex',
    category: 'code',
    icon: <Code2 className="w-4 h-4 text-orange-500" />,
    label: '正则表达式',
    description: '生成或解释正则表达式',
    prompt: '请帮我写一个正则表达式，用于匹配：{pattern}，并给出测试用例',
    variables: [
      { key: 'pattern', label: '匹配规则', placeholder: '中国手机号/邮箱/URL' },
    ],
    keywords: ['regex', '正则'],
  },

  // ═══════ 分析 ═══════
  {
    id: 'tpl-swot',
    category: 'analysis',
    icon: <Layers className="w-4 h-4 text-indigo-500" />,
    label: 'SWOT 分析',
    description: '优势/劣势/机会/威胁分析',
    prompt: '请对"{topic}"进行 SWOT 分析，用 insight-card 格式输出',
    variables: [
      { key: 'topic', label: '分析对象', placeholder: '公司/产品/项目' },
    ],
    keywords: ['swot', '分析', '战略'],
  },
  {
    id: 'tpl-compare',
    category: 'analysis',
    icon: <Scale className="w-4 h-4 text-teal-500" />,
    label: '对比分析',
    description: '多个选项的详细对比',
    prompt: '请对比分析{optionA}和{optionB}，从{dimensions}等维度进行比较',
    variables: [
      { key: 'optionA', label: '选项 A', placeholder: 'React' },
      { key: 'optionB', label: '选项 B', placeholder: 'Vue' },
      { key: 'dimensions', label: '对比维度', placeholder: '性能/生态/学习曲线/社区' },
    ],
    keywords: ['compare', '对比', '比较'],
  },
  {
    id: 'tpl-data-analyze',
    category: 'analysis',
    icon: <BarChart3 className="w-4 h-4 text-blue-500" />,
    label: '数据分析',
    description: '分析数据并生成可视化',
    prompt: '请分析以下数据，找出关键趋势和异常，并用 chart 格式生成可视化图表：\n\n',
    keywords: ['data', '数据分析', '可视化'],
  },

  // ═══════ 学习 ═══════
  {
    id: 'tpl-explain-concept',
    category: 'learning',
    icon: <GraduationCap className="w-4 h-4 text-blue-500" />,
    label: '概念解释',
    description: '用简单易懂的方式解释概念',
    prompt: '请用通俗易懂的语言解释"{concept}"，包含类比和实际例子，适合{level}理解',
    variables: [
      { key: 'concept', label: '概念', placeholder: '量子计算/区块链' },
      { key: 'level', label: '水平', placeholder: '初学者/有基础/专业人士' },
    ],
    keywords: ['explain', '解释', '概念'],
  },
  {
    id: 'tpl-mindmap',
    category: 'learning',
    icon: <Brain className="w-4 h-4 text-purple-500" />,
    label: '知识脑图',
    description: '生成知识结构思维导图',
    prompt: '请用 mindmap 格式整理"{topic}"的知识结构，包含主要分支和关键概念',
    variables: [
      { key: 'topic', label: '主题', placeholder: '机器学习/Web 开发' },
    ],
    keywords: ['mindmap', '脑图', '知识结构', '思维导图'],
  },
  {
    id: 'tpl-quiz',
    category: 'learning',
    icon: <FlaskConical className="w-4 h-4 text-emerald-500" />,
    label: '出题测验',
    description: '生成练习题检验学习效果',
    prompt: '请针对"{topic}"出{count}道{type}题目，从简单到困难排列，并附上答案解析',
    variables: [
      { key: 'topic', label: '主题', placeholder: 'JavaScript 异步编程' },
      { key: 'count', label: '数量', placeholder: '5' },
      { key: 'type', label: '题型', placeholder: '选择/填空/简答' },
    ],
    keywords: ['quiz', 'test', '出题', '测验'],
  },

  // ═══════ 创意 ═══════
  {
    id: 'tpl-brainstorm',
    category: 'creative',
    icon: <Lightbulb className="w-4 h-4 text-amber-500" />,
    label: '头脑风暴',
    description: '围绕主题发散思维',
    prompt: '请围绕"{topic}"进行头脑风暴，从不同角度提出至少 10 个创意想法',
    variables: [
      { key: 'topic', label: '主题', placeholder: '提高用户留存率' },
    ],
    keywords: ['brainstorm', '头脑风暴', '创意'],
  },
  {
    id: 'tpl-ppt-outline',
    category: 'creative',
    icon: <Presentation className="w-4 h-4 text-orange-500" />,
    label: 'PPT 大纲',
    description: '生成演示文稿的大纲结构',
    prompt: '请为"{topic}"的演讲设计一份 PPT 大纲，包含{slides}页幻灯片，每页的标题和要点',
    variables: [
      { key: 'topic', label: '演讲主题', placeholder: '年度产品发布' },
      { key: 'slides', label: '页数', placeholder: '10' },
    ],
    keywords: ['ppt', 'presentation', '演示', '大纲'],
  },
  {
    id: 'tpl-naming',
    category: 'creative',
    icon: <Sparkles className="w-4 h-4 text-pink-500" />,
    label: '起名取名',
    description: '产品/项目/品牌命名',
    prompt: '请为{type}起{count}个名字，要求{requirements}',
    variables: [
      { key: 'type', label: '命名对象', placeholder: '一款 AI 写作工具' },
      { key: 'count', label: '数量', placeholder: '10' },
      { key: 'requirements', label: '要求', placeholder: '简洁好记、有科技感' },
    ],
    keywords: ['name', 'naming', '起名', '命名'],
  },
  {
    id: 'tpl-ui-design',
    category: 'creative',
    icon: <Palette className="w-4 h-4 text-violet-500" />,
    label: 'UI 设计',
    description: '生成可交互的网页界面',
    prompt: '请帮我设计一个{type}的网页界面，风格为{style}，包含{features}',
    variables: [
      { key: 'type', label: '页面类型', placeholder: '登录页/仪表盘/落地页' },
      { key: 'style', label: '设计风格', placeholder: '极简/毛玻璃/赛博朋克' },
      { key: 'features', label: '功能模块', placeholder: '导航栏、数据卡片、图表' },
    ],
    keywords: ['ui', 'design', 'page', '界面', '页面设计'],
  },
];
