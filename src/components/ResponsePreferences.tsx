/**
 * ResponsePreferences — 回答偏好设置
 *
 * 让用户配置 AI 回答的语气、详细程度、语言偏好。
 * 嵌入到 PersonaSettings 页面或独立使用。
 */
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { trpc } from '@/lib/trpc';
import { MessageSquare, Volume2, Languages } from 'lucide-react';

interface Option {
  value: string;
  label: string;
  desc: string;
}

const VERBOSITY_OPTIONS: Option[] = [
  { value: 'default', label: '默认', desc: '由 AI 自行判断' },
  { value: 'concise', label: '简洁', desc: '精炼回答，避免冗长' },
  { value: 'detailed', label: '详细', desc: '全面解释，包含背景' },
];

const TONE_OPTIONS: Option[] = [
  { value: 'default', label: '默认', desc: '由 AI 自行判断' },
  { value: 'formal', label: '正式', desc: '专业、严谨的语气' },
  { value: 'casual', label: '随意', desc: '轻松、友好的语气' },
];

const LANGUAGE_OPTIONS: Option[] = [
  { value: 'default', label: '自动', desc: '跟随用户输入语言' },
  { value: 'zh', label: '中文优先', desc: '优先使用中文回答' },
  { value: 'en', label: '英文优先', desc: '优先使用英文回答' },
];

function OptionGroup({
  icon: Icon,
  title,
  options,
  value,
  onChange,
}: {
  icon: any;
  title: string;
  options: Option[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="w-4 h-4 text-muted-foreground" />
        {title}
      </div>
      <div className="flex gap-2 flex-wrap">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              value === opt.value
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card border-border hover:bg-muted'
            }`}
            title={opt.desc}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {options.find((o) => o.value === value)?.desc}
      </p>
    </div>
  );
}

export function ResponsePreferences() {
  const [verbosity, setVerbosity] = useState('default');
  const [tone, setTone] = useState('default');
  const [language, setLanguage] = useState('default');

  const { data: prefs, isLoading } = trpc.user.getResponsePreferences.useQuery();
  const updateMutation = trpc.user.updateResponsePreferences.useMutation({
    onSuccess: () => toast.success('偏好已保存'),
    onError: (err) => toast.error(err.message || '保存失败'),
  });

  useEffect(() => {
    if (prefs) {
      setVerbosity(prefs.verbosity || 'default');
      setTone(prefs.tone || 'default');
      setLanguage(prefs.language || 'default');
    }
  }, [prefs]);

  const handleChange = (field: string, value: string) => {
    if (field === 'verbosity') setVerbosity(value);
    if (field === 'tone') setTone(value);
    if (field === 'language') setLanguage(value);
    updateMutation.mutate({ [field]: value });
  };

  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 p-4">
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-8 bg-muted rounded w-full" />
        <div className="h-4 bg-muted rounded w-1/3" />
        <div className="h-8 bg-muted rounded w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold mb-1">回答偏好</h3>
        <p className="text-sm text-muted-foreground">
          自定义 AI 回答的风格，所有对话全局生效。
        </p>
      </div>

      <OptionGroup
        icon={MessageSquare}
        title="回答详细程度"
        options={VERBOSITY_OPTIONS}
        value={verbosity}
        onChange={(v) => handleChange('verbosity', v)}
      />

      <OptionGroup
        icon={Volume2}
        title="语气风格"
        options={TONE_OPTIONS}
        value={tone}
        onChange={(v) => handleChange('tone', v)}
      />

      <OptionGroup
        icon={Languages}
        title="语言偏好"
        options={LANGUAGE_OPTIONS}
        value={language}
        onChange={(v) => handleChange('language', v)}
      />
    </div>
  );
}
