/**
 * DesignGuide — 设计创作引导面板 (P1)
 *
 * 支持两条输出路径：
 *   1. 图片类（Logo/海报/插画）→ 触发图片生成模型
 *   2. 界面类（UI/图标/SVG）  → 触发 Artifact HTML/SVG 预览
 */

import { useState, useRef } from 'react';
import { Palette, Sparkles, X } from 'lucide-react';

interface DesignGuideProps {
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'logo', label: 'Logo', emoji: '🔤', desc: '品牌标识设计', mode: 'image' as const },
  { value: 'poster', label: '海报', emoji: '🖼️', desc: '宣传海报设计', mode: 'image' as const },
  { value: 'banner', label: 'Banner', emoji: '📢', desc: '横幅广告图', mode: 'image' as const },
  { value: 'illustration', label: '插画', emoji: '🎨', desc: '手绘风插图', mode: 'image' as const },
  { value: 'icon-set', label: '图标', emoji: '⭐', desc: '一组 SVG 图标', mode: 'code' as const },
  { value: 'ui', label: 'UI 界面', emoji: '📱', desc: '应用界面设计', mode: 'code' as const },
  { value: 'card', label: '卡片', emoji: '🃏', desc: '名片/邀请函', mode: 'image' as const },
  { value: 'infographic', label: '信息图', emoji: '📊', desc: '数据信息可视化', mode: 'code' as const },
];

const STYLE_OPTIONS = [
  { value: 'flat', label: '扁平', emoji: '▪️' },
  { value: '3d', label: '3D', emoji: '🧊' },
  { value: 'handdrawn', label: '手绘', emoji: '✏️' },
  { value: 'minimal', label: '极简', emoji: '⬜' },
  { value: 'cyberpunk', label: '赛博朋克', emoji: '🌆' },
  { value: 'watercolor', label: '水彩', emoji: '💧' },
  { value: 'retro', label: '复古', emoji: '📻' },
  { value: 'gradient', label: '渐变', emoji: '🌈' },
];

const SIZE_OPTIONS = [
  { value: '1:1', label: '正方形', desc: '1:1', icon: '⬜' },
  { value: '16:9', label: '横版', desc: '16:9', icon: '🖥️' },
  { value: '9:16', label: '竖版', desc: '9:16', icon: '📱' },
  { value: '4:3', label: '标准', desc: '4:3', icon: '📺' },
];

const COLOR_MOODS = [
  { value: 'warm', label: '暖色调', colors: ['#ef4444', '#f97316', '#eab308'] },
  { value: 'cool', label: '冷色调', colors: ['#3b82f6', '#06b6d4', '#8b5cf6'] },
  { value: 'mono', label: '黑白', colors: ['#000000', '#6b7280', '#ffffff'] },
  { value: 'pastel', label: '马卡龙', colors: ['#fda4af', '#a5f3fc', '#d9f99d'] },
  { value: 'neon', label: '霓虹', colors: ['#f0abfc', '#22d3ee', '#a3e635'] },
  { value: 'earth', label: '大地色', colors: ['#92400e', '#78716c', '#365314'] },
];

export function DesignGuide({ onSubmit, onClose }: DesignGuideProps) {
  const [description, setDescription] = useState('');
  const [designType, setDesignType] = useState('poster');
  const [style, setStyle] = useState('flat');
  const [size, setSize] = useState('1:1');
  const [colorMood, setColorMood] = useState('warm');
  const [extraNotes, setExtraNotes] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedType = TYPE_OPTIONS.find(t => t.value === designType);
  const isCodeMode = selectedType?.mode === 'code';

  const handleSubmit = () => {
    if (!description.trim()) {
      inputRef.current?.focus();
      return;
    }

    const typeName = selectedType?.label || '海报';
    const styleName = STYLE_OPTIONS.find(s => s.value === style)?.label || '扁平';
    const colorName = COLOR_MOODS.find(c => c.value === colorMood)?.label || '暖色调';

    if (isCodeMode) {
      // UI / 图标 / 信息图 → 生成 HTML/SVG 代码，走 Artifact 预览
      const parts = [
        `请帮我设计一个${typeName}，主题是：「${description.trim()}」。`,
        `设计风格：${styleName}，配色：${colorName}。`,
        designType === 'icon-set' ? '请使用 SVG 格式，生成一组风格统一的图标，每个图标可单独使用。' : '',
        designType === 'ui' ? `比例：${size}。请生成完整的 HTML + CSS 界面设计稿，包含精细的布局、色彩和排版。使用 Google Fonts。` : '',
        designType === 'infographic' ? '请生成完整的 HTML 信息图，包含数据可视化图表、图标和排版布局。' : '',
        '生成完整的单文件 HTML（含内联 CSS），确保视觉效果精美、专业。',
        extraNotes.trim() ? `补充要求：${extraNotes.trim()}` : '',
      ].filter(Boolean);
      onSubmit(parts.join('\n'));
    } else {
      // Logo / 海报 / 插画 → 触发图片生成
      const parts = [
        `请生成一张${typeName}图片，`,
        `主题内容：${description.trim()}`,
        `设计风格：${styleName}风格，${colorName}`,
        `图片比例：${size}`,
        extraNotes.trim() ? `补充要求：${extraNotes.trim()}` : '',
      ].filter(Boolean);
      onSubmit(parts.join('，') + '。');
    }
  };

  return (
    <div className="relative bg-gradient-to-br from-fuchsia-50 to-pink-50/50 dark:from-fuchsia-950/20 dark:to-pink-950/10 rounded-2xl border border-fuchsia-200/50 dark:border-fuchsia-800/30 p-5 md:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-fuchsia-100 dark:bg-fuchsia-900/30">
          <Palette className="w-5 h-5 text-fuchsia-600 dark:text-fuchsia-400" />
        </div>
        <div>
          <h3 className="font-semibold text-base text-foreground">设计创作</h3>
          <p className="text-xs text-muted-foreground">AI 为你生成{isCodeMode ? '可预览的设计稿' : '精美图片'}</p>
        </div>
      </div>

      {/* 设计描述 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">设计内容 <span className="text-red-400">*</span></label>
        <input
          ref={inputRef}
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="例：一家咖啡品牌的极简 Logo"
          className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/80 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-fuchsia-300 transition-all"
          autoFocus
        />
      </div>

      {/* 设计类型 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">设计类型</label>
        <div className="grid grid-cols-4 gap-1.5">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setDesignType(opt.value)}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs transition-all ${
                designType === opt.value
                  ? 'border-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-300 shadow-sm'
                  : 'border-border/40 hover:border-border hover:bg-muted/30 text-foreground'
              }`}
            >
              <span className="text-base">{opt.emoji}</span>
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 风格 + 配色 并排 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 风格 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">风格</label>
          <div className="grid grid-cols-2 gap-1">
            {STYLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStyle(opt.value)}
                className={`flex items-center gap-1 py-1.5 px-2 rounded-lg border text-xs transition-all ${
                  style === opt.value
                    ? 'border-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-300'
                    : 'border-border/40 hover:border-border text-foreground'
                }`}
              >
                <span>{opt.emoji}</span>
                <span className="font-medium">{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 配色 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">配色</label>
          <div className="grid grid-cols-2 gap-1">
            {COLOR_MOODS.map(mood => (
              <button
                key={mood.value}
                onClick={() => setColorMood(mood.value)}
                className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs transition-all ${
                  colorMood === mood.value
                    ? 'border-fuchsia-400 shadow-sm'
                    : 'border-border/40 hover:border-border'
                }`}
              >
                <div className="flex -space-x-0.5 shrink-0">
                  {mood.colors.map((c, i) => (
                    <span key={i} className="w-2.5 h-2.5 rounded-full border border-white dark:border-gray-800" style={{ background: c }} />
                  ))}
                </div>
                <span className="font-medium text-foreground truncate">{mood.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 尺寸（仅图片模式或 UI 模式显示） */}
      {(!isCodeMode || designType === 'ui') && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">尺寸比例</label>
          <div className="grid grid-cols-4 gap-1.5">
            {SIZE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setSize(opt.value)}
                className={`flex flex-col items-center gap-0.5 py-1.5 px-1 rounded-lg border text-xs transition-all ${
                  size === opt.value
                    ? 'border-fuchsia-400 bg-fuchsia-50 dark:bg-fuchsia-900/20 text-fuchsia-700 dark:text-fuchsia-300'
                    : 'border-border/40 hover:border-border text-foreground'
                }`}
              >
                <span>{opt.icon}</span>
                <span className="font-medium">{opt.label}</span>
                <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 补充说明 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">补充说明 <span className="text-muted-foreground/60 font-normal">（可选）</span></label>
        <textarea
          value={extraNotes}
          onChange={e => setExtraNotes(e.target.value)}
          placeholder="如：需要透明背景、包含特定文字、参考某种品牌风格等"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-border/60 bg-background/80 text-sm placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-fuchsia-400/40 focus:border-fuchsia-300 transition-all"
        />
      </div>

      {/* 输出模式提示 */}
      <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-fuchsia-50/50 dark:bg-fuchsia-900/10 border border-fuchsia-100 dark:border-fuchsia-800/20">
        <span className="text-xs text-fuchsia-600 dark:text-fuchsia-400">
          {isCodeMode ? '💻 将生成可预览的 HTML/SVG 设计稿' : '🎨 将调用 AI 绘图模型生成图片'}
        </span>
      </div>

      {/* 提交 */}
      <button
        onClick={handleSubmit}
        disabled={!description.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-fuchsia-500 to-pink-500 hover:from-fuchsia-600 hover:to-pink-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-150"
      >
        <Sparkles className="w-4 h-4" />
        开始设计
      </button>
    </div>
  );
}
