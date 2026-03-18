/**
 * 网站运营助手 - 重设计版
 * - 模板中心：预设常见场景，一键发起
 * - 隐藏系统注入的 [注意：...] 前缀
 * - 任务失败显示原因 + 重试按钮
 * - 任务完成后可触发论坛余额同步
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useSandboxSocket } from "@/hooks/useSandboxSocket";
import { trpc } from "@/lib/trpc";
import {
  Bot, Globe, Play, Pause, Square, Trash2, Plus, Settings, Eye,
  MonitorPlay, Terminal, Clock, Search, MessageSquare, FileText,
  AlertCircle, CheckCircle, Loader2, RefreshCw, Key, Link,
  ExternalLink, Zap, ArrowLeft, Hand, Gamepad2, Sparkles,
  LayoutGrid, ListTodo, TrendingUp, ShoppingBag, BookOpen,
  Users, Star, ChevronRight, RotateCcw, Coins,
} from "lucide-react";

// ─────────────────── 类型 ───────────────────

interface SiteAccount {
  id: number; siteName: string; siteUrl: string; loginUrl: string;
  username: string; status: string; lastLoginAt: string | null;
  lastLoginSuccess: boolean | null; loginFailCount: number;
  notes: string | null; createdAt: string;
}

interface AutomationTask {
  id: number; siteAccountId: number; taskType: string; name: string;
  instruction: string; status: string; progress: number;
  currentStep: string | null; totalSteps: number;
  startedAt: string | null; completedAt: string | null;
  errorMessage: string | null; createdAt: string;
}

interface TaskStep {
  id: number; stepNumber: number; type: string; content: string;
  screenshotUrl: string | null; selector: string | null;
  inputText: string | null; durationMs: number | null;
  success: boolean; errorMessage: string | null; createdAt: string;
}

// ─────────────────── 模板定义 ───────────────────

const TEMPLATE_CATEGORIES = [
  { id: "all",    label: "全部",    icon: <LayoutGrid className="w-4 h-4" /> },
  { id: "forum",  label: "论坛",    icon: <MessageSquare className="w-4 h-4" /> },
  { id: "social", label: "社交媒体", icon: <Users className="w-4 h-4" /> },
  { id: "content",label: "内容创作", icon: <BookOpen className="w-4 h-4" /> },
  { id: "shop",   label: "电商",    icon: <ShoppingBag className="w-4 h-4" /> },
  { id: "growth", label: "涨粉增长", icon: <TrendingUp className="w-4 h-4" /> },
];

interface Template {
  id: string;
  category: string;
  icon: React.ReactNode;
  title: string;
  desc: string;
  taskType: string;
  buildInstruction: (account: SiteAccount) => string;
  estimatedSteps: number;
  tags: string[];
  color: string; // Tailwind bg class
}

const TEMPLATES: Template[] = [
  // ─── 论坛 ───
  {
    id: "forum_checkin",
    category: "forum",
    icon: <Star className="w-5 h-5" />,
    title: "每日签到",
    desc: "自动完成论坛每日签到，领取积分奖励",
    taskType: "browse_and_post",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），找到每日签到或打卡入口，完成签到操作。如果今天已签到则记录已签到状态后退出。`,
    estimatedSteps: 6,
    tags: ["积分", "每日"],
    color: "bg-amber-50 text-amber-700 border-amber-200",
  },
  {
    id: "forum_post_daily",
    category: "forum",
    icon: <FileText className="w-5 h-5" />,
    title: "发布原创帖子",
    desc: "Insi 生成一篇原创内容，发布到指定板块",
    taskType: "browse_and_post",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），进入热门板块，结合当前热点话题，生成一篇 300 字左右的原创帖子（技术分享、生活感悟或时事评论均可），发布后记录帖子链接。`,
    estimatedSteps: 10,
    tags: ["原创", "积分"],
    color: "bg-blue-50 text-blue-700 border-blue-200",
  },
  {
    id: "forum_reply",
    category: "forum",
    icon: <MessageSquare className="w-5 h-5" />,
    title: "批量回复热帖",
    desc: "浏览热门帖子，Insi 生成有价值的回复",
    taskType: "search_and_reply",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），进入热帖榜或最新帖子列表，选取 3-5 篇有讨论价值的帖子，针对每篇帖子的核心观点生成有实质内容的回复（不少于 50 字），逐一发送。`,
    estimatedSteps: 18,
    tags: ["互动", "积分"],
    color: "bg-indigo-50 text-indigo-700 border-indigo-200",
  },
  {
    id: "forum_weekly_report",
    category: "forum",
    icon: <TrendingUp className="w-5 h-5" />,
    title: "发布周报/日记",
    desc: "生成个人总结类帖子，保持账号活跃度",
    taskType: "browse_and_post",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），进入日记或周报相关板块，生成一篇简短的个人周记（可包括：本周学习收获、有趣的事、下周计划），字数 200-400 字，语气自然真实，发布完成。`,
    estimatedSteps: 8,
    tags: ["日记", "活跃"],
    color: "bg-green-50 text-green-700 border-green-200",
  },

  // ─── 社交媒体 ───
  {
    id: "social_like_follow",
    category: "social",
    icon: <Users className="w-5 h-5" />,
    title: "关注 + 点赞互动",
    desc: "批量关注目标用户，点赞近期内容",
    taskType: "custom",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），搜索与 AI、科技、编程相关的热门用户，关注其中粉丝数适中（1k-50k）的 5 个账号，并为他们的最新 2 条内容点赞。`,
    estimatedSteps: 20,
    tags: ["涨粉", "互动"],
    color: "bg-pink-50 text-pink-700 border-pink-200",
  },
  {
    id: "social_comment",
    category: "social",
    icon: <MessageSquare className="w-5 h-5" />,
    title: "热帖评论互动",
    desc: "找到热门内容，留下有价值的评论",
    taskType: "search_and_reply",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），进入热门/推荐页，找到互动量高的帖子（点赞>100），针对其内容留下真实、有见地的评论（30-80字），完成 3-5 条后退出。`,
    estimatedSteps: 15,
    tags: ["曝光", "互动"],
    color: "bg-violet-50 text-violet-700 border-violet-200",
  },

  // ─── 内容创作 ───
  {
    id: "content_article",
    category: "content",
    icon: <BookOpen className="w-5 h-5" />,
    title: "发布技术文章",
    desc: "AI 生成技术干货，发布到内容平台",
    taskType: "browse_and_post",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），创作一篇 500-800 字的技术文章，主题围绕 AI 工具使用、编程技巧或效率提升，配上简洁的标题和 3 个相关标签，发布为公开文章。`,
    estimatedSteps: 12,
    tags: ["干货", "技术"],
    color: "bg-cyan-50 text-cyan-700 border-cyan-200",
  },
  {
    id: "content_short",
    category: "content",
    icon: <Zap className="w-5 h-5" />,
    title: "发布短内容 / 动态",
    desc: "发布 140 字以内的日常动态或感悟",
    taskType: "browse_and_post",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），发布一条简短的动态或说说（100-140字），内容围绕最近学到的有趣知识点或生活小感悟，语气轻松，附上 2-3 个话题标签。`,
    estimatedSteps: 6,
    tags: ["动态", "日常"],
    color: "bg-teal-50 text-teal-700 border-teal-200",
  },

  // ─── 电商 ───
  {
    id: "shop_review",
    category: "shop",
    icon: <Star className="w-5 h-5" />,
    title: "发布商品评价",
    desc: "为已购商品撰写真实有用的评价",
    taskType: "custom",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），进入"我的订单"，找到已收货待评价的订单，针对每件商品根据其类别撰写一条真实、具体的好评（60-120字），包含使用体验描述，提交评价。`,
    estimatedSteps: 14,
    tags: ["评价", "返积分"],
    color: "bg-orange-50 text-orange-700 border-orange-200",
  },
  {
    id: "shop_wishlist",
    category: "shop",
    icon: <ShoppingBag className="w-5 h-5" />,
    title: "收藏 + 加购清单",
    desc: "收藏目标商品，加入购物车",
    taskType: "custom",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），搜索"数码配件"或"办公用品"，筛选出评分 4.7 以上、价格合理的商品，收藏 5 件、加入购物车 2 件，完成后截图记录。`,
    estimatedSteps: 10,
    tags: ["收藏", "选品"],
    color: "bg-rose-50 text-rose-700 border-rose-200",
  },

  // ─── 涨粉增长 ───
  {
    id: "growth_profile",
    category: "growth",
    icon: <TrendingUp className="w-5 h-5" />,
    title: "优化个人主页",
    desc: "完善头像、简介、标签，提升主页吸引力",
    taskType: "custom",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），进入个人资料编辑页，检查并优化：个人简介（突出专业方向，100字以内）、兴趣标签（添加 5 个相关标签），确认头像已上传，保存修改。`,
    estimatedSteps: 8,
    tags: ["资料", "曝光"],
    color: "bg-lime-50 text-lime-700 border-lime-200",
  },
  {
    id: "growth_search_reply",
    category: "growth",
    icon: <Search className="w-5 h-5" />,
    title: "关键词搜索引流",
    desc: "搜索目标关键词，在相关内容下留下专业回复",
    taskType: "search_and_reply",
    buildInstruction: (a) => `登录 ${a.siteName}（${a.siteUrl}），搜索"AI 工具"、"效率提升"等关键词，找到近 7 天内的高互动内容，在 4-6 篇下面留下专业、有见地的评论，自然提及自己的相关经验。`,
    estimatedSteps: 20,
    tags: ["引流", "曝光"],
    color: "bg-sky-50 text-sky-700 border-sky-200",
  },
];

// ─────────────────── 工具函数 ───────────────────

const API_BASE = "/api/automation";

async function apiFetch(path: string, options?: RequestInit) {
  const token = localStorage.getItem("auth_token");
  const authHeaders: Record<string, string> = token
    ? { Authorization: `Bearer ${token}` }
    : {};
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...authHeaders, ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || "请求失败");
  }
  return res.json();
}

// 清理系统注入的 [注意：...] 前缀

function cleanInstruction(raw: string): string {
  return raw.replace(/^\[注意：[^\]]*\]\s*/g, "").trim();
}

export function TaskCard({ task, onStart, onPause, onCancel, onDelete, onView, onRetry }: {
  task: AutomationTask; onStart: () => void; onPause: () => void;
  onCancel: () => void; onDelete: () => void; onView: () => void; onRetry: () => void;
}) {
  const statusCfg: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
    pending:   { color: "bg-gray-100 text-gray-600",   icon: <Clock className="w-3.5 h-3.5" />,              label: "待执行" },
    running:   { color: "bg-blue-100 text-blue-700",   icon: <Loader2 className="w-3.5 h-3.5 animate-spin" />, label: "执行中" },
    paused:    { color: "bg-yellow-100 text-yellow-700",icon: <Pause className="w-3.5 h-3.5" />,              label: "已暂停" },
    completed: { color: "bg-green-100 text-green-700", icon: <CheckCircle className="w-3.5 h-3.5" />,         label: "已完成" },
    failed:    { color: "bg-red-100 text-red-700",     icon: <AlertCircle className="w-3.5 h-3.5" />,         label: "失败" },
    cancelled: { color: "bg-gray-100 text-gray-400",   icon: <Square className="w-3.5 h-3.5" />,              label: "已取消" },
  };
  const s = statusCfg[task.status] || statusCfg.pending;
  const cleanedInstruction = cleanInstruction(task.instruction);

  return (
    <div className="bg-white rounded-2xl border hover:shadow-md transition-shadow p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <h4 className="font-semibold text-sm">{task.name}</h4>
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.color}`}>
              {s.icon} {s.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 line-clamp-1">{cleanedInstruction}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
            <span>{task.totalSteps} 步</span>
            {task.startedAt && <span>{new Date(task.startedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {task.status === "pending" && (
            <button onClick={onStart} className="p-1.5 rounded-xl hover:bg-green-50 text-green-600" title="启动"><Play className="w-4 h-4" /></button>
          )}
          {task.status === "running" && (
            <>
              <button onClick={onView} className="p-1.5 rounded-xl hover:bg-blue-50 text-blue-600" title="查看实况"><Eye className="w-4 h-4" /></button>
              <button onClick={onPause} className="p-1.5 rounded-xl hover:bg-yellow-50 text-yellow-600" title="暂停"><Pause className="w-4 h-4" /></button>
              <button onClick={onCancel} className="p-1.5 rounded-xl hover:bg-red-50 text-red-500" title="取消"><Square className="w-4 h-4" /></button>
            </>
          )}
          {task.status === "paused" && (
            <button onClick={onStart} className="p-1.5 rounded-xl hover:bg-green-50 text-green-600" title="继续"><Play className="w-4 h-4" /></button>
          )}
          {(task.status === "completed" || task.status === "failed" || task.status === "cancelled") && (
            <button onClick={onView} className="p-1.5 rounded-xl hover:bg-blue-50 text-blue-600" title="查看详情"><Eye className="w-4 h-4" /></button>
          )}
          <button onClick={onDelete} className="p-1.5 rounded-xl hover:bg-red-50 text-red-400" title="删除"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>

      {/* 执行进度 */}
      {task.status === "running" && task.progress > 0 && (
        <div className="mt-3">
          <div className="flex justify-between text-xs text-gray-400 mb-1">
            <span className="truncate">{task.currentStep || "执行中..."}</span>
            <span>{Math.round(task.progress)}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${task.progress}%` }} />
          </div>
        </div>
      )}

      {/* 失败信息 + 重试 */}
      {task.status === "failed" && task.errorMessage && (
        <div className="mt-3 p-2.5 bg-red-50 rounded-xl text-xs text-red-600 flex items-start gap-2">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="line-clamp-2">{task.errorMessage}</p>
          </div>
          <button onClick={onRetry} className="flex items-center gap-1 px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 rounded-lg whitespace-nowrap shrink-0">
            <RotateCcw className="w-3 h-3" /> 重试
          </button>
        </div>
      )}

      {/* 完成后的论坛同步提示（mpsboring相关任务） */}
      {task.status === "completed" && task.name.toLowerCase().includes("签到") || task.status === "completed" && task.name.includes("发帖") || task.status === "completed" && task.name.includes("回复") ? (
        <SyncHint />
      ) : null}
    </div>
  );
}

export function SyncHint() {
  const utils = trpc.useUtils();
  const syncMutation = trpc.fishCoin.syncFromForum.useMutation({
    onSuccess: () => { utils.fishCoin.getBalance.invalidate(); },
  });
  const [done, setDone] = useState(false);

  if (done) return (
    <div className="mt-2 flex items-center gap-1.5 text-xs text-green-600">
      <CheckCircle className="w-3.5 h-3.5" /> 鱼币余额已同步
    </div>
  );

  return (
    <div className="mt-2 flex items-center gap-2">
      <span className="text-xs text-gray-400">论坛可能已获得积分</span>
      <button
        onClick={() => { syncMutation.mutate(); setDone(true); }}
        disabled={syncMutation.isPending}
        className="flex items-center gap-1 text-xs px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors">
        {syncMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Coins className="w-3 h-3" />}
        同步鱼币
      </button>
    </div>
  );
}

// ─────────────────── 主页面 ───────────────────
