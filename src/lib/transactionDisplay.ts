/**
 * transactionDisplay.ts
 * 
 * 将后端交易记录的 raw description 解析为用户友好的展示格式。
 * 
 * 设计原则：
 * 1. 不暴露模型名称、内部 ID、技术细节
 * 2. 用统一的「分类 + 摘要」替代原始 description
 * 3. 纯前端，零后端改动，向后兼容
 */

export interface TransactionDisplay {
  /** 分类标识 (用于图标/颜色) */
  category: TransactionCategory;
  /** 用户可见的一行描述 */
  label: string;
  /** 可选的简短补充（如折扣信息） */
  detail?: string;
}

export type TransactionCategory =
  | 'chat'           // AI 对话
  | 'voice'          // 语音通话
  | 'image'          // 图片生成
  | 'video'          // 视频生成
  | 'research'       // 深度研究
  | 'schedule'       // 定时任务
  | 'automation'     // 自动化任务
  | 'vps'            // VPS 远程操作
  | 'skill'          // 技能执行
  | 'homework'       // 作业批改
  | 'playbook'       // Playbook
  | 'agent'          // 智能体
  | 'recharge'       // 充值
  | 'sync'           // 积分同步
  | 'reward'         // 奖励
  | 'refund'         // 退款
  | 'admin'          // 管理员调整
  | 'other';         // 兜底

/** 分类 → 展示配置 */
export const CATEGORY_CONFIG: Record<TransactionCategory, {
  icon: string;       // Lucide icon name
  label: string;      // 默认标签
  color: string;      // Tailwind text color class
  bgColor: string;    // Tailwind bg color class
}> = {
  chat:       { icon: 'MessageSquare',  label: 'AI 对话',     color: 'text-blue-500',    bgColor: 'bg-blue-500/10' },
  voice:      { icon: 'Mic',            label: '语音通话',    color: 'text-violet-500',  bgColor: 'bg-violet-500/10' },
  image:      { icon: 'Image',          label: '图片生成',    color: 'text-pink-500',    bgColor: 'bg-pink-500/10' },
  video:      { icon: 'Video',          label: '视频生成',    color: 'text-orange-500',  bgColor: 'bg-orange-500/10' },
  research:   { icon: 'Search',         label: '深度研究',    color: 'text-emerald-500', bgColor: 'bg-emerald-500/10' },
  schedule:   { icon: 'Clock',          label: '定时任务',    color: 'text-cyan-500',    bgColor: 'bg-cyan-500/10' },
  automation: { icon: 'Zap',            label: '自动化',      color: 'text-amber-500',   bgColor: 'bg-amber-500/10' },
  vps:        { icon: 'Server',         label: 'VPS 操作',   color: 'text-slate-500',   bgColor: 'bg-slate-500/10' },
  skill:      { icon: 'Sparkles',       label: '技能执行',    color: 'text-indigo-500',  bgColor: 'bg-indigo-500/10' },
  homework:   { icon: 'BookOpen',       label: '作业批改',    color: 'text-teal-500',    bgColor: 'bg-teal-500/10' },
  playbook:   { icon: 'Play',           label: 'Playbook',   color: 'text-fuchsia-500', bgColor: 'bg-fuchsia-500/10' },
  agent:      { icon: 'Bot',            label: '智能体任务',  color: 'text-purple-500',  bgColor: 'bg-purple-500/10' },
  recharge:   { icon: 'Plus',           label: '充值',        color: 'text-green-500',   bgColor: 'bg-green-500/10' },
  sync:       { icon: 'RefreshCw',      label: '积分同步',    color: 'text-green-500',   bgColor: 'bg-green-500/10' },
  reward:     { icon: 'Gift',           label: '奖励',        color: 'text-green-500',   bgColor: 'bg-green-500/10' },
  refund:     { icon: 'RotateCcw',      label: '退款',        color: 'text-green-500',   bgColor: 'bg-green-500/10' },
  admin:      { icon: 'Shield',         label: '管理员调整',  color: 'text-gray-500',    bgColor: 'bg-gray-500/10' },
  other:      { icon: 'Coins',          label: '其他',        color: 'text-gray-500',    bgColor: 'bg-gray-500/10' },
};

/**
 * 匹配规则表 — 按优先级排列，首个匹配生效
 */
const RULES: Array<{
  test: (desc: string) => boolean;
  parse: (desc: string) => TransactionDisplay;
}> = [
  // ─── 充值 / 奖励 ───
  {
    test: (d) => d.includes('论坛积分同步'),
    parse: () => ({ category: 'sync', label: '论坛积分同步' }),
  },
  {
    test: (d) => d.includes('邀请') && d.includes('奖励'),
    parse: () => ({ category: 'reward', label: '邀请好友奖励' }),
  },
  {
    test: (d) => d.includes('注册奖励') || d.includes('注册赠送') || d.includes('新用户'),
    parse: () => ({ category: 'reward', label: '注册奖励' }),
  },
  {
    test: (d) => d.startsWith('充值'),
    parse: (d) => {
      const m = d.match(/充值\s*([\d.]+)\s*🐟币/);
      const bonus = d.match(/赠送\s*([\d.]+)\s*🐟币/);
      let label = '账户充值';
      if (m) label = `充值 ${m[1]} 🐟币`;
      if (bonus) label += `（含赠送 ${bonus[1]}）`;
      return { category: 'recharge', label };
    },
  },
  {
    test: (d) => d.includes('首充') || d.includes('首次充值'),
    parse: () => ({ category: 'reward', label: '首充奖励' }),
  },

  // ─── 语音 ───
  {
    test: (d) => /^live-/.test(d) || /^live-direct-/.test(d),
    parse: () => ({ category: 'voice', label: '语音通话' }),
  },
  {
    test: (d) => d.includes('语音对话'),
    parse: () => ({ category: 'voice', label: '语音对话' }),
  },

  // ─── 定时任务 ───
  {
    test: (d) => /^schedule-/.test(d),
    parse: () => ({ category: 'schedule', label: '定时任务执行' }),
  },
  {
    test: (d) => d.includes('定时研究任务'),
    parse: (d) => {
      const prompt = extractPromptSnippet(d);
      return { category: 'schedule', label: '定时研究任务', detail: prompt };
    },
  },

  // ─── 图片 ───
  {
    test: (d) => d.includes('图片生成'),
    parse: () => ({ category: 'image', label: '图片生成' }),
  },
  {
    test: (d) => d.includes('图片放大') || d.includes('超分辨率'),
    parse: () => ({ category: 'image', label: '图片放大' }),
  },

  // ─── 视频 ───
  {
    test: (d) => d.startsWith('视频生成'),
    parse: (d) => {
      const prompt = extractPromptSnippet(d);
      return { category: 'video', label: '视频生成', detail: prompt };
    },
  },

  // ─── 深度研究 ───
  {
    test: (d) => d.includes('研究任务启动') || d.includes('深度研究') || d.includes('研究任务底价') || d.includes('对话中深度研究'),
    parse: (d) => {
      const prompt = extractPromptSnippet(d);
      return { category: 'research', label: '深度研究', detail: prompt };
    },
  },

  // ─── 自动化 ───
  {
    test: (d) => d.includes('自动化任务'),
    parse: (d) => {
      const m = d.match(/#(\d+)/);
      const action = d.includes('预扣') ? '执行中' : d.includes('补扣') ? '结算' : '执行';
      return { category: 'automation', label: `自动化任务${action}`, detail: m ? `#${m[1]}` : undefined };
    },
  },

  // ─── VPS ───
  {
    test: (d) => d.includes('VPS') || d.includes('远程操作'),
    parse: (d) => {
      const prompt = extractPromptSnippet(d);
      return { category: 'vps', label: 'VPS 远程操作', detail: prompt };
    },
  },

  // ─── 技能 ───
  {
    test: (d) => d.includes('技能执行'),
    parse: (d) => {
      const m = d.match(/「(.+?)」/);
      return { category: 'skill', label: '技能执行', detail: m?.[1] };
    },
  },

  // ─── 作业批改 ───
  {
    test: (d) => d.includes('作业批改'),
    parse: (d) => {
      const m = d.match(/(\d+)张/);
      return { category: 'homework', label: '作业批改', detail: m ? `${m[1]} 张图片` : undefined };
    },
  },

  // ─── Playbook ───
  {
    test: (d) => d.includes('Playbook') || d.includes('playbook'),
    parse: (d) => {
      const m = d.match(/Playbook[:：]\s*(.+)/i);
      return { category: 'playbook', label: 'Playbook 执行', detail: m?.[1]?.trim() };
    },
  },

  // ─── Agent ───
  {
    test: (d) => /^agent-/.test(d) || d.includes('智能体'),
    parse: () => ({ category: 'agent', label: '智能体任务' }),
  },

  // ─── AI 对话（最宽泛，放最后） ───
  {
    test: (d) => d.includes('进行对话'),
    parse: (d) => {
      const detail = extractDiscount(d);
      return { category: 'chat', label: 'AI 对话', detail };
    },
  },
];

/**
 * 主入口：解析 raw description → 用户友好展示
 */
export function parseTransactionDescription(description: string | null | undefined): TransactionDisplay {
  if (!description) return { category: 'other', label: '消费' };

  for (const rule of RULES) {
    if (rule.test(description)) {
      return rule.parse(description);
    }
  }

  // 兜底：截断过长内容，去掉技术细节
  const cleaned = description
    .replace(/[a-f0-9]{8,}/gi, '') // 去掉 hash
    .replace(/\d{10,}/g, '')       // 去掉时间戳
    .trim();
  return { category: 'other', label: cleaned.substring(0, 20) || '消费' };
}

// ─── 内部工具函数 ───

/** 从 "xxx: prompt内容..." 中提取用户可读的 prompt 片段 */
function extractPromptSnippet(desc: string): string | undefined {
  // 匹配 ": 内容..." 或 "：内容..."
  const m = desc.match(/[:：]\s*(.{2,40})/);
  if (!m) return undefined;
  let snippet = m[1].replace(/\.{3}$/, '').trim();
  if (snippet.length > 30) snippet = snippet.substring(0, 30) + '…';
  return snippet;
}

/** 提取折扣信息 */
function extractDiscount(desc: string): string | undefined {
  const m = desc.match(/等级折扣[:：]?\s*(\d+)%/);
  if (m) return `${m[1]}% 折扣`;
  return undefined;
}
