/**
 * CanvasToolbar — Canvas 快捷操作工具栏
 *
 * 类似 ChatGPT Canvas 的快捷操作面板：
 * - 代码模式：修复 Bug、添加注释、简化、切换语言、代码审查
 * - 通用：复制、导出、撤销编辑
 *
 * 工具栏显示为一条竖排图标条，悬停展开标签。
 */

import { useState } from 'react';
import {
  Bug, MessageSquareCode, Minimize2, Languages, FileSearch,
  Wand2, BookOpen, Braces, Terminal, Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CanvasAction {
  id: string;
  icon: LucideIcon;
  label: string;
  description: string;
  prompt: string; // 发送给 AI 的指令
}

const CODE_ACTIONS: CanvasAction[] = [
  {
    id: 'fix-bugs',
    icon: Bug,
    label: '修复 Bug',
    description: '检测并修复代码问题',
    prompt: '请检查上面的代码，找出并修复所有 Bug、错误和潜在问题。保留原有功能不变。',
  },
  {
    id: 'add-comments',
    icon: MessageSquareCode,
    label: '添加注释',
    description: '为代码添加清晰注释',
    prompt: '请为上面的代码添加清晰的中文注释，解释每个主要部分的功能和逻辑。不要改变代码本身。',
  },
  {
    id: 'simplify',
    icon: Minimize2,
    label: '简化代码',
    description: '移除冗余，简化逻辑',
    prompt: '请简化上面的代码，移除冗余部分，合并重复逻辑，使代码更简洁易读。保持功能完全一致。',
  },
  {
    id: 'code-review',
    icon: FileSearch,
    label: '代码审查',
    description: '提供改进建议',
    prompt: '请对上面的代码进行审查，指出潜在的性能问题、安全隐患、代码风格问题，并给出具体的改进建议。',
  },
  {
    id: 'add-types',
    icon: Braces,
    label: '添加类型',
    description: '添加 TypeScript 类型注解',
    prompt: '请为上面的代码添加完整的 TypeScript 类型注解，包括函数参数、返回值、变量类型。',
  },
  {
    id: 'optimize',
    icon: Sparkles,
    label: '优化增强',
    description: 'UI 美化 + 交互增强',
    prompt: '请优化上面的代码：改善 UI 视觉效果（更好的配色、间距、动画），增强交互体验（加载状态、错误处理、响应式设计）。',
  },
  {
    id: 'add-logging',
    icon: Terminal,
    label: '添加日志',
    description: '插入调试日志语句',
    prompt: '请在上面的代码关键位置添加 console.log 日志语句，方便调试和追踪执行流程。标注每个日志的用途。',
  },
  {
    id: 'explain',
    icon: BookOpen,
    label: '解释代码',
    description: '逐段解释代码逻辑',
    prompt: '请逐段解释上面的代码逻辑，用通俗易懂的中文说明每个部分的作用、数据流向和设计意图。',
  },
];

const PORT_LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'typescript', label: 'TypeScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'go', label: 'Go' },
  { id: 'rust', label: 'Rust' },
  { id: 'php', label: 'PHP' },
  { id: 'c++', label: 'C++' },
];

interface CanvasToolbarProps {
  onAction: (prompt: string) => void;
  language?: string;
  className?: string;
}

export function CanvasToolbar({ onAction, language, className }: CanvasToolbarProps) {
  const [showLanguages, setShowLanguages] = useState(false);
  const [hoveredAction, setHoveredAction] = useState<string | null>(null);

  return (
    <div className={cn(
      'flex flex-col items-center gap-0.5 py-2 px-1',
      'bg-[#252536] dark:bg-[#161b22] border-l border-white/10',
      className,
    )}>
      {CODE_ACTIONS.map((action) => (
        <button
          key={action.id}
          onClick={() => onAction(action.prompt)}
          onMouseEnter={() => setHoveredAction(action.id)}
          onMouseLeave={() => setHoveredAction(null)}
          className="relative flex items-center justify-center w-8 h-8 rounded-lg text-[#9ca3af] hover:text-white hover:bg-white/10 transition-colors group"
          title={action.label}
        >
          <action.icon className="w-4 h-4" />
          {/* 悬停标签 */}
          {hoveredAction === action.id && (
            <div className="absolute right-full mr-2 px-2.5 py-1.5 rounded-lg bg-popover border border-border shadow-lg whitespace-nowrap z-50 animate-in fade-in-0 slide-in-from-right-1 duration-150">
              <div className="text-xs font-medium text-foreground">{action.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{action.description}</div>
            </div>
          )}
        </button>
      ))}

      {/* 分隔线 */}
      <div className="w-5 border-t border-white/15 my-1" />

      {/* 切换语言 */}
      <div className="relative">
        <button
          onClick={() => setShowLanguages(!showLanguages)}
          onMouseEnter={() => setHoveredAction('port')}
          onMouseLeave={() => { if (!showLanguages) setHoveredAction(null); }}
          className="flex items-center justify-center w-8 h-8 rounded-lg text-[#9ca3af] hover:text-white hover:bg-white/10 transition-colors"
          title="切换语言"
        >
          <Languages className="w-4 h-4" />
        </button>

        {/* 语言选择弹出 */}
        {showLanguages && (
          <div className="absolute right-full mr-2 bottom-0 px-1 py-1 rounded-lg bg-popover border border-border shadow-lg z-50 animate-in fade-in-0 slide-in-from-right-1 duration-150 min-w-[140px]">
            <div className="px-2 py-1 text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              转换为
            </div>
            {PORT_LANGUAGES.filter(l => l.id !== language).map((lang) => (
              <button
                key={lang.id}
                onClick={() => {
                  onAction(`请将上面的代码转换为 ${lang.label}，保持功能完全一致，使用 ${lang.label} 的最佳实践和惯用写法。`);
                  setShowLanguages(false);
                }}
                className="flex items-center w-full px-2 py-1.5 text-xs text-foreground/80 hover:text-foreground hover:bg-accent rounded-md transition-colors"
              >
                {lang.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
