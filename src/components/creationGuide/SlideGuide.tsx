/**
 * SlideGuide — 幻灯片创建引导面板
 *
 * 用户选择主题、页数、风格后，自动生成优化 prompt 并发送。
 */

import { useState, useRef } from 'react';
import { Presentation, Sparkles, X } from 'lucide-react';

interface SlideGuideProps {
  onSubmit: (prompt: string) => void;
  onClose: () => void;
}

const PAGE_OPTIONS = [
  { value: 5, label: '5 页', desc: '简短汇报' },
  { value: 10, label: '10 页', desc: '标准展示' },
  { value: 15, label: '15 页', desc: '详细报告' },
  { value: 20, label: '20 页', desc: '完整方案' },
];

const STYLE_OPTIONS = [
  { value: 'business', label: '商务', emoji: '💼', desc: '专业简洁，适合工作汇报' },
  { value: 'academic', label: '学术', emoji: '🎓', desc: '严谨规范，适合论文答辩' },
  { value: 'creative', label: '创意', emoji: '🎨', desc: '活泼多彩，适合策划展示' },
  { value: 'minimal', label: '极简', emoji: '✨', desc: '大量留白，聚焦核心内容' },
  { value: 'tech', label: '科技', emoji: '🚀', desc: '深色背景，数据可视化' },
];

export function SlideGuide({ onSubmit, onClose }: SlideGuideProps) {
  const [topic, setTopic] = useState('');
  const [pages, setPages] = useState(10);
  const [style, setStyle] = useState('business');
  const [extraNotes, setExtraNotes] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    if (!topic.trim()) {
      inputRef.current?.focus();
      return;
    }
    const styleName = STYLE_OPTIONS.find(s => s.value === style)?.label || '商务';
    const parts = [
      `请帮我制作一份关于「${topic.trim()}」的PPT幻灯片。`,
      `要求：${pages}页左右，${styleName}风格。`,
      '包含封面页、目录页、正文内容页和总结页。',
      '每页都需要有清晰的标题和要点说明。',
      extraNotes.trim() ? `补充要求：${extraNotes.trim()}` : '',
      '请先给出完整的大纲结构，然后生成PPT文件。',
    ].filter(Boolean);
    onSubmit(parts.join('\n'));
  };

  return (
    <div className="relative bg-gradient-to-br from-orange-50 to-amber-50/50 dark:from-orange-950/20 dark:to-amber-950/10 rounded-2xl border border-orange-200/50 dark:border-orange-800/30 p-5 md:p-6 space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300">
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-3 right-3 p-1.5 rounded-lg text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>

      {/* 头部 */}
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-orange-100 dark:bg-orange-900/30">
          <Presentation className="w-5 h-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <h3 className="font-semibold text-base text-foreground">制作幻灯片</h3>
          <p className="text-xs text-muted-foreground">AI 将为你生成专业的 PPT 文件</p>
        </div>
      </div>

      {/* 主题输入 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">演示主题 <span className="text-red-400">*</span></label>
        <input
          ref={inputRef}
          type="text"
          value={topic}
          onChange={e => setTopic(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSubmit()}
          placeholder="例：2025年Q1市场营销策略复盘"
          className="w-full px-3 py-2.5 rounded-xl border border-border/60 bg-background/80 text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300 transition-all"
          autoFocus
        />
      </div>

      {/* 页数选择 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">页数</label>
        <div className="grid grid-cols-4 gap-2">
          {PAGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setPages(opt.value)}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-sm transition-all ${
                pages === opt.value
                  ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 shadow-sm'
                  : 'border-border/40 hover:border-border hover:bg-muted/30 text-foreground'
              }`}
            >
              <span className="font-medium">{opt.label}</span>
              <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 风格选择 */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">演示风格</label>
        <div className="grid grid-cols-5 gap-1.5">
          {STYLE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setStyle(opt.value)}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-xl border text-xs transition-all ${
                style === opt.value
                  ? 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 shadow-sm'
                  : 'border-border/40 hover:border-border hover:bg-muted/30 text-foreground'
              }`}
            >
              <span className="text-lg">{opt.emoji}</span>
              <span className="font-medium">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* 补充说明（可选） */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-foreground">补充说明 <span className="text-muted-foreground/60 font-normal">（可选）</span></label>
        <textarea
          value={extraNotes}
          onChange={e => setExtraNotes(e.target.value)}
          placeholder="如：需要包含数据图表、中英双语、特定配色等"
          rows={2}
          className="w-full px-3 py-2 rounded-xl border border-border/60 bg-background/80 text-sm placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-300 transition-all"
        />
      </div>

      {/* 提交按钮 */}
      <button
        onClick={handleSubmit}
        disabled={!topic.trim()}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 disabled:opacity-40 disabled:cursor-not-allowed shadow-md hover:shadow-lg active:scale-[0.98] transition-all duration-150"
      >
        <Sparkles className="w-4 h-4" />
        开始生成
      </button>
    </div>
  );
}
