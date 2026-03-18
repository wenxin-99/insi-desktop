/**
 * AppGuide — 应用开发引导面板 (P2)
 *
 * 智能路由：
 *   - 简单应用（单文件 HTML）→ Artifact 实时预览
 *   - 复杂项目（多文件）→ Sandbox 远程执行
 *
 * 通过 prompt 中的指令词让 AI 自动判断走哪条路径。
 */

import { useState, useRef } from 'react';
import { Monitor, Sparkles, X, Zap, Box } from 'lucide-react';

interface AppGuideProps {
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

const APP_TYPES = [
  { value: 'tool', label: '在线工具', emoji: '🛠️', desc: '计算器/转换器/编辑器', complexity: 'simple' as const },
  { value: 'game', label: '小游戏', emoji: '🎮', desc: '休闲互动小游戏', complexity: 'simple' as const },
  { value: 'dashboard', label: '数据看板', emoji: '📊', desc: '图表/统计/监控', complexity: 'simple' as const },
  { value: 'form', label: '表单系统', emoji: '📋', desc: '问卷/注册/提交', complexity: 'simple' as const },
  { value: 'chat', label: '聊天界面', emoji: '💬', desc: '对话/客服/机器人', complexity: 'simple' as const },
  { value: 'landing', label: '产品页面', emoji: '🚀', desc: '带交互的展示页', complexity: 'simple' as const },
  { value: 'kanban', label: '看板/Todo', emoji: '📌', desc: '任务管理/拖拽', complexity: 'simple' as const },
  { value: 'music', label: '音乐/动画', emoji: '🎵', desc: '音效/可视化/动效', complexity: 'simple' as const },
];

const TECH_STACKS = [
  { value: 'html', label: 'HTML + CSS + JS', desc: '纯前端，无需构建', icon: '🌐' },
  { value: 'react', label: 'React', desc: '组件化开发', icon: '⚛️' },
  { value: 'vue', label: 'Vue', desc: '渐进式框架', icon: '💚' },
  { value: 'canvas', label: 'Canvas / WebGL', desc: '图形/游戏/动画', icon: '🎨' },
];

const FEATURE_PRESETS: Record<string, string[]> = {
  tool: ['输入验证', '结果复制', '深色模式', '历史记录', '键盘快捷键'],
  game: ['计分系统', '音效', '动画', '排行榜', '暂停/继续', '难度选择'],
  dashboard: ['实时数据', '多种图表', '筛选器', '响应式', '导出功能'],
  form: ['表单验证', '多步骤', '文件上传', '进度条', '成功提示'],
  chat: ['消息气泡', '发送动画', '打字指示器', '表情支持', '时间戳'],
  landing: ['英雄区域', '特性展示', '用户评价', '定价表', 'FAQ'],
  kanban: ['拖拽排序', '标签分类', '搜索筛选', '完成统计', '本地存储'],
  music: ['播放控制', '波形可视化', '进度条', '音量调节', '播放列表'],
};

export function AppGuide({ onSubmit, onClose }: AppGuideProps) {
  const [description, setDescription] = useState('');
  const [appType, setAppType] = useState('tool');
  const [techStack, setTechStack] = useState('html');
  const [selectedFeatures, setSelectedFeatures] = useState<Set<string>>(new Set());
  const [extraNotes, setExtraNotes] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const presetFeatures = FEATURE_PRESETS[appType] || [];

  const toggleFeature = (f: string) => {
    setSelectedFeatures(prev => {
      const next = new Set(prev);
      next.has(f) ? next.delete(f) : next.add(f);
      return next;
    });
  };

  // 切换应用类型时重置特性选择
  const handleTypeChange = (type: string) => {
    setAppType(type);
    setSelectedFeatures(new Set());
  };

  const handleSubmit = () => {
    if (!description.trim()) {
      inputRef.current?.focus();
      return;
    }

    const typeName = APP_TYPES.find(t => t.value === appType)?.label || '在线工具';
    const techName = TECH_STACKS.find(t => t.value === techStack)?.label || 'HTML';
    const features = [...selectedFeatures];

    const parts = [
      `请帮我开发一个${typeName}应用，具体功能：${description.trim()}`,
      '',
      `技术要求：`,
      `- 使用 ${techName} 开发`,
      '- 生成完整的单文件 HTML（包含所有内联 CSS 和 JS）',
      '- 界面设计要精美专业，不要使用默认样式',
      '- 必须响应式设计，同时适配手机和桌面',
      '- 所有交互都要有平滑的动画过渡',
      techStack === 'canvas' ? '- 使用 Canvas 或 WebGL 进行图形渲染，确保 60fps 流畅运行' : '',
      techStack === 'react' ? '- 使用 React CDN（包含 Babel standalone），不需要构建工具' : '',
      techStack === 'vue' ? '- 使用 Vue 3 CDN，不需要构建工具' : '',
      '',
      features.length > 0 ? `功能需求：\n${features.map(f => `- ${f}`).join('\n')}` : '',
      extraNotes.trim() ? `\n补充要求：${extraNotes.trim()}` : '',
      '',
      '请直接生成完整代码，不需要先讨论设计方案。',
    ].filter(Boolean);

    onSubmit(parts.join('\n'));
  };

  return (
    <div className="relative bg-gradient-to-br from-emerald-50 to-teal-50/50 dark:from-emerald-950/20 dark:to-teal-950/10 rounded-2xl border border-emerald-200/50 dark:border-emerald-800/30 p-5 md:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
          <Monitor className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
        </div>
        <div>
          <h3 className="font-semibold text-base text-foreground">开发应用</h3>
          <p className="text-xs text-muted-foreground">AI 为你生成可运行的完整应用</p>
        </div>
      </div>

      {/* 功能描述 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">应用描述 <span className="text-red-400">*</span></label>
        <textarea
          ref={inputRef}
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="描述你想要的应用功能，例如：&#10;一个番茄钟计时器，支持自定义工作/休息时长，有白噪音背景"
          rows={3}
          className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/80 text-sm placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-300 transition-all"
          autoFocus
        />
      </div>

      {/* 应用类型 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">应用类型</label>
        <div className="grid grid-cols-4 gap-1.5">
          {APP_TYPES.map(opt => (
            <button
              key={opt.value}
              onClick={() => handleTypeChange(opt.value)}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs transition-all ${
                appType === opt.value
                  ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 shadow-sm'
                  : 'border-border/40 hover:border-border hover:bg-muted/30 text-foreground'
              }`}
            >
              <span className="text-base">{opt.emoji}</span>
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 技术栈 + 功能特性 并排 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 技术栈 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">技术栈</label>
          <div className="space-y-1">
            {TECH_STACKS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setTechStack(opt.value)}
                className={`w-full flex items-center gap-2 py-1.5 px-2.5 rounded-lg border text-xs text-left transition-all ${
                  techStack === opt.value
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-border/40 hover:border-border text-foreground'
                }`}
              >
                <span>{opt.icon}</span>
                <div>
                  <div className="font-medium">{opt.label}</div>
                  <div className="text-[10px] text-muted-foreground">{opt.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* 功能特性（多选） */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">功能特性 <span className="text-muted-foreground/60 font-normal text-[10px]">可多选</span></label>
          <div className="space-y-1 max-h-[160px] overflow-y-auto">
            {presetFeatures.map(f => (
              <button
                key={f}
                onClick={() => toggleFeature(f)}
                className={`w-full flex items-center gap-2 py-1.5 px-2.5 rounded-lg border text-xs text-left transition-all ${
                  selectedFeatures.has(f)
                    ? 'border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300'
                    : 'border-border/40 hover:border-border text-foreground'
                }`}
              >
                <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                  selectedFeatures.has(f)
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-border'
                }`}>
                  {selectedFeatures.has(f) && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <span className="font-medium">{f}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 补充说明 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">补充说明 <span className="text-muted-foreground/60 font-normal">（可选）</span></label>
        <textarea
          value={extraNotes}
          onChange={e => setExtraNotes(e.target.value)}
          placeholder="如：参考某个应用的设计、特定颜色主题、需要本地存储数据等"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-border/60 bg-background/80 text-sm placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-300 transition-all"
        />
      </div>

      {/* 提交 */}
      <button
        onClick={handleSubmit}
        disabled={!description.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-150"
      >
        <Sparkles className="w-4 h-4" />
        开始开发
      </button>
    </div>
  );
}
