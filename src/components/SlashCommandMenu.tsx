/**
 * SlashCommandMenu — 斜杠命令选择面板
 *
 * 当用户在输入框输入 `/` 时弹出，显示快捷命令列表。
 * 支持键盘导航（↑/↓/Enter/Esc）和模糊搜索。
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  Search, Image, Video, FileSearch, Sparkles, Globe,
  Wand2, FileText, Bot, Calendar, Server, BookOpen,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export interface SlashCommand {
  id: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  /** 替换输入框的文本前缀 */
  prefix?: string;
  /** 或者直接执行动作 */
  action?: () => void;
  keywords?: string[];
  /** 模板元数据（仅模板命令携带） */
  _template?: SlashTemplate;
}

const DEFAULT_COMMANDS: SlashCommand[] = [
  {
    id: 'search',
    icon: <Globe className="w-4 h-4 text-blue-500" />,
    label: '联网搜索',
    description: '搜索互联网获取最新信息',
    prefix: '搜索一下：',
    keywords: ['search', 'web', '搜索', '查找', '联网'],
  },
  {
    id: 'image',
    icon: <Image className="w-4 h-4 text-pink-500" />,
    label: '生成图片',
    description: '用 AI 生成一张图片',
    prefix: '画一张',
    keywords: ['image', 'draw', 'paint', '画', '图片', '生成图'],
  },
  {
    id: 'video',
    icon: <Video className="w-4 h-4 text-purple-500" />,
    label: '生成视频',
    description: '用 AI 生成短视频',
    prefix: '生成一段视频：',
    keywords: ['video', '视频', '动画'],
  },
  {
    id: 'research',
    icon: <FileSearch className="w-4 h-4 text-emerald-500" />,
    label: '深度调研',
    description: '多轮搜索深度分析一个话题',
    prefix: '帮我深度调研：',
    keywords: ['research', 'deep', '调研', '研究', '分析'],
  },
  {
    id: 'artifact',
    icon: <Sparkles className="w-4 h-4 text-amber-500" />,
    label: '生成应用',
    description: '生成可预览的 HTML/React 应用',
    prefix: '帮我做一个网页应用：',
    keywords: ['artifact', 'app', 'html', '应用', '页面', '组件'],
  },
  {
    id: 'document',
    icon: <FileText className="w-4 h-4 text-orange-500" />,
    label: '生成文档',
    description: '生成 Word/PDF/Markdown 文档',
    prefix: '帮我写一份文档：',
    keywords: ['document', 'doc', 'word', 'pdf', '文档', '报告'],
  },
  {
    id: 'think',
    icon: <Wand2 className="w-4 h-4 text-violet-500" />,
    label: '深度思考',
    description: '启用推理模式，仔细思考后回答',
    prefix: '请仔细思考：',
    keywords: ['think', 'reason', '思考', '推理', '深度'],
  },
  {
    id: 'schedule',
    icon: <Calendar className="w-4 h-4 text-teal-500" />,
    label: '定时任务',
    description: '创建自动化定时任务',
    prefix: '帮我创建一个定时任务：',
    keywords: ['schedule', 'cron', 'timer', '定时', '任务'],
  },
  {
    id: 'server',
    icon: <Server className="w-4 h-4 text-slate-500" />,
    label: '服务器运维',
    description: '远程管理服务器',
    prefix: '帮我在服务器上',
    keywords: ['server', 'ssh', 'vps', '服务器', '运维', '部署'],
  },
];

// ★ 导入 Prompt 模板库
import { SLASH_TEMPLATES, TEMPLATE_CATEGORIES, type SlashTemplate } from '@/lib/slashTemplates';

interface SlashCommandMenuProps {
  /** 当前输入框文本（用于过滤） */
  query: string;
  /** 是否显示 */
  visible: boolean;
  /** 选中命令后回调 */
  onSelect: (command: SlashCommand) => void;
  /** 关闭菜单 */
  onClose: () => void;
  /** 额外命令（可扩展） */
  extraCommands?: SlashCommand[];
  /** 定位锚点（输入框位置） */
  anchorRef?: React.RefObject<HTMLElement | null>;
}

export function SlashCommandMenu({
  query, visible, onSelect, onClose, extraCommands = [],
}: SlashCommandMenuProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState('all');
  const menuRef = useRef<HTMLDivElement>(null);

  // ★ 将模板转换为 SlashCommand 格式
  const templateCommands: SlashCommand[] = useMemo(() =>
    SLASH_TEMPLATES.map(tpl => ({
      id: tpl.id,
      icon: tpl.icon,
      label: tpl.label,
      description: tpl.description,
      prefix: tpl.prompt,
      keywords: tpl.keywords,
      _template: tpl,
    })),
  []);

  const allCommands = useMemo(() => [...DEFAULT_COMMANDS, ...templateCommands, ...extraCommands], [templateCommands, extraCommands]);

  // 过滤：`/` 后面的文字作为搜索词
  const filterText = query.startsWith('/') ? query.slice(1).toLowerCase().trim() : '';
  const filtered = useMemo(() => {
    let items = allCommands;
    // 分类过滤
    if (activeCategory !== 'all') {
      items = items.filter(cmd => {
        if (cmd._template) return cmd._template.category === activeCategory;
        return false; // 内置命令只在 all 下显示
      });
    }
    // 搜索过滤
    if (filterText) {
      items = allCommands.filter(cmd =>
        cmd.label.toLowerCase().includes(filterText) ||
        cmd.id.includes(filterText) ||
        cmd.description.includes(filterText) ||
        cmd.keywords?.some(k => k.includes(filterText))
      );
    }
    return items;
  }, [filterText, allCommands, activeCategory]);

  // 重置选中索引
  useEffect(() => { setSelectedIndex(0); }, [filtered.length, activeCategory]);

  // 键盘导航
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (!visible) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => (i + 1) % filtered.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === 'Enter' && filtered.length > 0) {
      e.preventDefault();
      onSelect(filtered[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [visible, filtered, selectedIndex, onSelect, onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // 点击外部关闭
  useEffect(() => {
    if (!visible) return;
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [visible, onClose]);

  if (!visible || filtered.length === 0) return null;

  return (
    <div
      ref={menuRef}
      className={cn(
        "absolute bottom-full left-0 right-0 mb-2 z-50",
        "bg-popover border border-border rounded-xl shadow-lg",
        "max-h-[400px] overflow-hidden flex flex-col",
        "animate-in fade-in slide-in-from-bottom-2 duration-200",
      )}
    >
      {/* 分类标签栏 */}
      <div className="px-2 py-1.5 border-b border-border/50 flex items-center gap-1 overflow-x-auto no-scrollbar flex-shrink-0">
        {TEMPLATE_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            type="button"
            onClick={() => setActiveCategory(cat.id)}
            className={cn(
              "px-2 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-all",
              activeCategory === cat.id
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
            )}
          >
            <span className="mr-1">{cat.icon}</span>
            {cat.label}
          </button>
        ))}
      </div>

      {/* 命令/模板列表 */}
      <div className="py-1 overflow-y-auto flex-1 min-h-0">
        {filtered.map((cmd, idx) => (
          <button
            key={cmd.id}
            type="button"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors",
              idx === selectedIndex
                ? "bg-accent text-accent-foreground"
                : "hover:bg-accent/50"
            )}
            onMouseEnter={() => setSelectedIndex(idx)}
            onClick={() => onSelect(cmd)}
          >
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
              {cmd.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{cmd.label}</div>
              <div className="text-xs text-muted-foreground truncate">{cmd.description}</div>
            </div>
            <kbd className="hidden sm:inline-flex items-center px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground/50 bg-muted/30 rounded border border-border/30">
              /{cmd.id.replace('tpl-', '')}
            </kbd>
          </button>
        ))}
      </div>
      <div className="px-3 py-1.5 border-t border-border/50 flex items-center gap-3 text-[10px] text-muted-foreground/50 flex-shrink-0">
        <span>↑↓ 导航</span>
        <span>Enter 选择</span>
        <span>Esc 关闭</span>
      </div>
    </div>
  );
}
