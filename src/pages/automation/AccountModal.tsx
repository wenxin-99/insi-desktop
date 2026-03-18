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

// ─────────────────── 账号弹窗 ───────────────────

export function AccountModal({ open, onClose, onSave, editAccount }: {
  open: boolean; onClose: () => void;
  onSave: (data: any) => void; editAccount?: SiteAccount | null;
}) {
  const [form, setForm] = useState({ siteName: "", siteUrl: "", loginUrl: "", username: "", password: "", notes: "" });

  useEffect(() => {
    if (editAccount) {
      setForm({ siteName: editAccount.siteName, siteUrl: editAccount.siteUrl, loginUrl: editAccount.loginUrl, username: editAccount.username, password: "", notes: editAccount.notes || "" });
    } else {
      setForm({ siteName: "", siteUrl: "", loginUrl: "", username: "", password: "", notes: "" });
    }
  }, [editAccount, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 space-y-4">
        <h3 className="text-lg font-bold">{editAccount ? "编辑站点账号" : "添加站点账号"}</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">站点名称 *</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="如：V2EX、知乎、mpsboring"
              value={form.siteName} onChange={e => setForm(f => ({ ...f, siteName: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">站点首页 URL *</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://www.example.com"
              value={form.siteUrl} onChange={e => setForm(f => ({ ...f, siteUrl: e.target.value }))} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">登录页 URL *</label>
            <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="https://www.example.com/signin"
              value={form.loginUrl} onChange={e => setForm(f => ({ ...f, loginUrl: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">用户名 *</label>
              <input className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.username} onChange={e => setForm(f => ({ ...f, username: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">密码 *</label>
              <input type="password" className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">备注</label>
            <textarea className="w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" rows={2}
              value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">取消</button>
          <button onClick={() => onSave(form)} className="px-4 py-2 text-sm bg-blue-600 text-white rounded-xl hover:bg-blue-700">
            {editAccount ? "保存修改" : "添加账号"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────── 模板选择弹窗 ───────────────────
