/**
 * WebsiteGuide — 网站创建引导面板
 *
 * 用户选择类型、风格、配色后，自动生成优化 prompt 并发送。
 * AI 回复会走 Artifact 模式，在右侧实时预览。
 */

import { useState, useRef } from 'react';
import { Globe, Sparkles, X } from 'lucide-react';

interface WebsiteGuideProps {
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

const TYPE_OPTIONS = [
  { value: 'landing', label: '产品着陆页', emoji: '🚀', desc: '推广产品或服务' },
  { value: 'portfolio', label: '个人作品集', emoji: '🎨', desc: '展示个人作品' },
  { value: 'blog', label: '博客文章', emoji: '📝', desc: '内容发布展示' },
  { value: 'dashboard', label: '数据看板', emoji: '📊', desc: '数据可视化' },
  { value: 'business', label: '企业官网', emoji: '🏢', desc: '公司品牌形象' },
  { value: 'store', label: '电商展示', emoji: '🛍️', desc: '商品陈列页面' },
];

const STYLE_OPTIONS = [
  { value: 'minimal', label: '极简', color: 'bg-gray-100 dark:bg-gray-800', accent: '#111' },
  { value: 'gradient', label: '渐变', color: 'bg-gradient-to-r from-blue-100 to-purple-100 dark:from-blue-900/30 dark:to-purple-900/30', accent: '#7c3aed' },
  { value: 'dark', label: '暗黑', color: 'bg-gray-900', accent: '#fff' },
  { value: 'glassmorphism', label: '玻璃拟态', color: 'bg-white/60 dark:bg-white/10 backdrop-blur', accent: '#06b6d4' },
  { value: 'retro', label: '复古', color: 'bg-amber-50 dark:bg-amber-950/20', accent: '#92400e' },
  { value: 'neon', label: '霓虹', color: 'bg-gray-950', accent: '#22d3ee' },
];

const COLOR_PRESETS = [
  { value: 'blue', label: '蔚蓝', colors: ['#3b82f6', '#1d4ed8', '#dbeafe'] },
  { value: 'emerald', label: '翠绿', colors: ['#10b981', '#047857', '#d1fae5'] },
  { value: 'violet', label: '紫罗兰', colors: ['#8b5cf6', '#6d28d9', '#ede9fe'] },
  { value: 'rose', label: '玫瑰', colors: ['#f43f5e', '#be123c', '#ffe4e6'] },
  { value: 'amber', label: '琥珀', colors: ['#f59e0b', '#b45309', '#fef3c7'] },
  { value: 'slate', label: '石墨', colors: ['#475569', '#1e293b', '#f1f5f9'] },
];

export function WebsiteGuide({ onSubmit, onClose }: WebsiteGuideProps) {
  const [description, setDescription] = useState('');
  const [siteType, setSiteType] = useState('landing');
  const [style, setStyle] = useState('minimal');
  const [colorPreset, setColorPreset] = useState('blue');
  const [extraNotes, setExtraNotes] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!description.trim()) {
      inputRef.current?.focus();
      return;
    }
    const typeName = TYPE_OPTIONS.find(t => t.value === siteType)?.label || '着陆页';
    const styleName = STYLE_OPTIONS.find(s => s.value === style)?.label || '极简';
    const colorName = COLOR_PRESETS.find(c => c.value === colorPreset)?.label || '蔚蓝';
    const colorHex = COLOR_PRESETS.find(c => c.value === colorPreset)?.colors[0] || '#3b82f6';

    const parts = [
      `请创建一个${typeName}网站，主题是：「${description.trim()}」。`,
      `设计风格：${styleName}风格，主色调为${colorName}色（${colorHex}）。`,
      '技术要求：',
      '- 生成完整的单文件 HTML（包含内联 CSS 和 JS）',
      '- 必须是响应式设计，适配手机和桌面',
      '- 包含平滑的滚动动画和交互效果',
      '- 使用 Google Fonts 中的优质字体',
      '- 内容要丰富，不要用 Lorem ipsum 占位符',
      extraNotes.trim() ? `补充要求：${extraNotes.trim()}` : '',
    ].filter(Boolean);
    onSubmit(parts.join('\n'));
  };

  return (
    <div className="relative bg-gradient-to-br from-sky-50 to-indigo-50/50 dark:from-sky-950/20 dark:to-indigo-950/10 rounded-2xl border border-sky-200/50 dark:border-sky-800/30 p-5 md:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-sky-100 dark:bg-sky-900/30">
          <Globe className="w-5 h-5 text-sky-600 dark:text-sky-400" />
        </div>
        <div>
          <h3 className="font-semibold text-base text-foreground">创建网站</h3>
          <p className="text-xs text-muted-foreground">AI 将生成完整网页，可实时预览</p>
        </div>
      </div>

      {/* 网站描述 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">网站描述 <span className="text-red-400">*</span></label>
        <input
          ref={inputRef}
          type="text"
          value={description}
          onChange={e => setDescription(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="例：一个极简风的AI写作工具产品介绍页"
          className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/80 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-300 transition-all"
          autoFocus
        />
      </div>

      {/* 网站类型 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">网站类型</label>
        <div className="grid grid-cols-3 gap-1.5">
          {TYPE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setSiteType(opt.value)}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs transition-all ${
                siteType === opt.value
                  ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300 shadow-sm'
                  : 'border-border/40 hover:border-border hover:bg-muted/30 text-foreground'
              }`}
            >
              <span className="text-base">{opt.emoji}</span>
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 设计风格 + 配色 并排 */}
      <div className="grid grid-cols-2 gap-4">
        {/* 风格 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">设计风格</label>
          <div className="grid grid-cols-2 gap-1.5">
            {STYLE_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setStyle(opt.value)}
                className={`py-1.5 px-2 rounded-lg border text-xs font-medium transition-all ${
                  style === opt.value
                    ? 'border-sky-400 bg-sky-50 dark:bg-sky-900/20 text-sky-700 dark:text-sky-300'
                    : 'border-border/40 hover:border-border text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* 配色 */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-foreground">主色调</label>
          <div className="grid grid-cols-3 gap-1.5">
            {COLOR_PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => setColorPreset(preset.value)}
                className={`flex items-center gap-1.5 py-1.5 px-2 rounded-lg border text-xs transition-all ${
                  colorPreset === preset.value
                    ? 'border-sky-400 shadow-sm'
                    : 'border-border/40 hover:border-border'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ background: preset.colors[0] }}
                />
                <span className="text-foreground font-medium truncate">{preset.label}</span>
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
          placeholder="如：需要暗色模式、特定 Logo 文字、联系表单等"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-border/60 bg-background/80 text-sm placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-sky-400/40 focus:border-sky-300 transition-all"
        />
      </div>

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={!description.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-sky-500 to-indigo-500 hover:from-sky-600 hover:to-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-150"
      >
        <Sparkles className="w-4 h-4" />
        开始创建
      </button>
    </div>
  );
}
