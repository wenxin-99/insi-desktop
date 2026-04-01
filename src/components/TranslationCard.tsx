/**
 * TranslationCard — 双语对照翻译卡片
 *
 * 支持逐句对照、整体切换原文/译文、复制译文。
 * 
 * 使用方式（AI 输出 / render_rich_component）：
 * ```translation
 * {
 *   "from": "en",
 *   "to": "zh",
 *   "title": "翻译结果",
 *   "segments": [
 *     { "src": "Hello, how are you?", "tgt": "你好，你怎么样？" },
 *     { "src": "I'm fine, thank you.", "tgt": "我很好，谢谢。" }
 *   ]
 * }
 * ```
 */

import { memo, useState, useCallback } from 'react';
import { Copy, Check, ArrowRightLeft, Eye, EyeOff, Languages } from 'lucide-react';
import { cn } from '@/lib/utils';
import { safeParseJson } from '@/utils/repairJson';

// ═══════ 语言名称映射 ═══════
const LANG_NAMES: Record<string, string> = {
  en: 'English', zh: '中文', ja: '日本語', ko: '한국어',
  fr: 'Français', de: 'Deutsch', es: 'Español', pt: 'Português',
  ru: 'Русский', ar: 'العربية', it: 'Italiano', nl: 'Nederlands',
  th: 'ไทย', vi: 'Tiếng Việt', id: 'Bahasa', ms: 'Melayu',
  tr: 'Türkçe', pl: 'Polski', uk: 'Українська', cs: 'Čeština',
  sv: 'Svenska', da: 'Dansk', fi: 'Suomi', nb: 'Norsk',
  hu: 'Magyar', ro: 'Română', el: 'Ελληνικά', he: 'עברית',
  hi: 'हिन्दी', bn: 'বাংলা', ta: 'தமிழ்', te: 'తెలుగు',
};

interface TranslationSegment {
  src: string;
  tgt: string;
  note?: string; // 可选的翻译注释
}

interface TranslationData {
  from: string;
  to: string;
  title?: string;
  segments: TranslationSegment[];
}

interface TranslationCardProps {
  jsonStr: string;
  streaming?: boolean;
}

function TranslationCardInner({ jsonStr, streaming }: TranslationCardProps) {
  const [copied, setCopied] = useState(false);
  const [showSource, setShowSource] = useState(true);
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  // 解析 JSON
  const { data, error } = safeParseJson<TranslationData>(jsonStr);

  // 流式骨架
  if (!data && streaming) {
    const partial = jsonStr.match(/"from"\s*:\s*"([^"]*)/)?.[1];
    const partialTo = jsonStr.match(/"to"\s*:\s*"([^"]*)/)?.[1];
    return (
      <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 border-b border-border/40">
          <Languages className="w-4 h-4 text-blue-500 animate-pulse" />
          <span className="text-sm font-medium text-foreground/80">
            {partial && partialTo ? `${LANG_NAMES[partial] || partial} → ${LANG_NAMES[partialTo] || partialTo}` : '翻译中...'}
          </span>
        </div>
        <div className="p-4 space-y-3">
          {[90, 75, 85, 60].map((w, i) => (
            <div key={i} className="flex gap-3">
              <div className="flex-1 h-4 rounded bg-muted animate-pulse" style={{ width: `${w}%`, animationDelay: `${i * 100}ms` }} />
              <div className="flex-1 h-4 rounded bg-blue-100 dark:bg-blue-950/30 animate-pulse" style={{ width: `${w - 10}%`, animationDelay: `${i * 100 + 50}ms` }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 解析失败降级
  if (!data || !data.segments?.length) {
    return (
      <div className="my-3 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20 overflow-hidden">
        <div className="flex items-center gap-2 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
          <span>翻译数据格式异常</span>
        </div>
        <pre className="px-3 pb-3 text-xs text-muted-foreground overflow-x-auto whitespace-pre-wrap break-words max-h-[200px] overflow-y-auto">{jsonStr}</pre>
      </div>
    );
  }

  const fromName = LANG_NAMES[data.from] || data.from;
  const toName = LANG_NAMES[data.to] || data.to;

  const handleCopyAll = async () => {
    const text = data.segments.map(s => s.tgt).join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="my-3 rounded-xl border border-border bg-card overflow-hidden shadow-sm">
      {/* 顶栏 */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/40 bg-muted/30">
        <div className="flex items-center gap-2">
          <Languages className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-foreground">
            {data.title || '翻译对照'}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
            {fromName} → {toName}
          </span>
        </div>
        <div className="flex items-center gap-1">
          {/* 显示/隐藏原文 */}
          <button
            onClick={() => setShowSource(!showSource)}
            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-accent/50 transition-colors"
            title={showSource ? '隐藏原文' : '显示原文'}
          >
            {showSource ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{showSource ? '隐藏原文' : '显示原文'}</span>
          </button>
          {/* 复制全部译文 */}
          <button
            onClick={handleCopyAll}
            className={cn(
              'inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs transition-colors',
              copied ? 'text-green-600 bg-green-50 dark:bg-green-950/30' : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'
            )}
            title="复制全部译文"
          >
            {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copied ? '已复制' : '复制译文'}</span>
          </button>
        </div>
      </div>

      {/* 双语列头 */}
      {showSource && (
        <div className="grid grid-cols-2 gap-0 text-[11px] font-medium text-muted-foreground uppercase tracking-wider border-b border-border/30">
          <div className="px-4 py-1.5 border-r border-border/20">{fromName}</div>
          <div className="px-4 py-1.5">{toName}</div>
        </div>
      )}

      {/* 逐句对照 */}
      <div className="divide-y divide-border/20">
        {data.segments.map((seg, i) => (
          <div
            key={i}
            className={cn(
              'transition-colors',
              hoveredIdx === i && 'bg-accent/30',
              showSource ? 'grid grid-cols-2 gap-0' : ''
            )}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {/* 原文 */}
            {showSource && (
              <div className="px-4 py-2.5 text-sm text-foreground/60 border-r border-border/20 leading-relaxed">
                {seg.src}
              </div>
            )}
            {/* 译文 */}
            <div className={cn(
              'px-4 py-2.5 text-sm text-foreground leading-relaxed',
              !showSource && 'w-full'
            )}>
              {seg.tgt}
              {seg.note && (
                <div className="mt-1 text-xs text-blue-600 dark:text-blue-400 italic">
                  💡 {seg.note}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 底部统计 */}
      <div className="px-4 py-2 border-t border-border/30 bg-muted/20 text-[11px] text-muted-foreground flex items-center justify-between">
        <span>共 {data.segments.length} 段</span>
        <span className="flex items-center gap-1">
          <ArrowRightLeft className="w-3 h-3" />
          {fromName} → {toName}
        </span>
      </div>
    </div>
  );
}

export const TranslationCard = memo(TranslationCardInner);
