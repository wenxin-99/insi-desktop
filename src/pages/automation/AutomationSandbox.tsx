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
import TakeoverPanel from "./TakeoverPanel";
import ExecutionReport from "./ExecutionReport";

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

export function AutomationSandbox({ taskId }: { taskId: number }) {
  const sandbox = useSandboxSocket(taskId);
  const [activeTab, setActiveTab] = useState<"browser" | "terminal" | "thinking">("browser");
  const terminalRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [takeoverActive, setTakeoverActive] = useState(false);

  // ★ Phase 3: 监听 completed_summary 事件，提取报告数据
  const [completedReport, setCompletedReport] = useState<any>(null);
  useEffect(() => {
    if (!sandbox.socket) return;
    const handleSandboxEvent = (event: any) => {
      if (event?.payload?.status === 'completed_summary' && event.taskId === taskId) {
        const rs = event.payload.resultSummary;
        if (rs?.contentInfo || rs?.billing) {
          // 构建 ExecutionReport 需要的数据格式
          setCompletedReport({
            totalAccounts: 1,
            successCount: rs.completed ? 1 : 0,
            failedCount: rs.completed ? 0 : 1,
            results: [{
              username: event.payload.accountName || '',
              taskId,
              status: rs.completed ? (rs.partial ? 'partial' : 'success') : 'failed',
              posts: rs.contentInfo?.allPublished?.filter((c: any) => c.type === 'post').map((c: any) => ({
                title: rs.contentInfo?.title || '帖子',
                url: c.url || '',
                contentLength: c.length || 0,
                hasImages: false,
              })) || [],
              replies: rs.contentInfo?.allPublished?.filter((c: any) => c.type === 'reply').map((c: any) => ({
                targetPostUrl: c.url || '',
                contentLength: c.length || 0,
              })) || [],
              duration: 0,
              totalSteps: rs.totalSteps || 0,
              tokenCost: rs.billing?.totalCost || 0,
            }],
            summary: {
              totalPosts: rs.contentInfo?.postCount || 0,
              totalReplies: rs.contentInfo?.replyCount || 0,
              totalDuration: 0,
              totalCost: rs.billing?.totalCost || 0,
              averagePostLength: rs.contentInfo?.contentLength || 0,
              costEfficiency: 0,
              successRate: rs.completed ? 100 : 0,
            },
          });
        }
      }
    };
    sandbox.socket.on('sandbox_event', handleSandboxEvent);
    return () => { sandbox.socket?.off('sandbox_event', handleSandboxEvent); };
  }, [sandbox.socket, taskId]);

  useEffect(() => {
    if (terminalRef.current && activeTab === "terminal") {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [sandbox.terminal?.lines, activeTab]);

  const handleTakeoverClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!takeoverActive || !imgRef.current) return;
    e.preventDefault();
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (1920 / rect.width));
    const y = Math.round((e.clientY - rect.top) * (1080 / rect.height));
    sandbox.socket?.emit("takeover_action", { taskId, action: "click", payload: { x, y } });
    imgRef.current.focus();
  };

  const handleTakeoverKeyDown = (e: React.KeyboardEvent) => {
    if (!takeoverActive) return;
    e.preventDefault();
    const keyMap: Record<string, string> = { Enter: "Enter", Backspace: "Backspace", Delete: "Delete", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight" };
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      sandbox.socket?.emit("takeover_action", { taskId, action: "type", payload: { text: e.key } });
    } else if (e.ctrlKey || e.metaKey) {
      sandbox.socket?.emit("takeover_action", { taskId, action: "press", payload: { key: `Control+${e.key}` } });
    } else {
      sandbox.socket?.emit("takeover_action", { taskId, action: "press", payload: { key: keyMap[e.key] || e.key } });
    }
  };

  const handleTakeoverWheel = (e: React.WheelEvent) => {
    if (!takeoverActive) return;
    e.preventDefault();
    sandbox.socket?.emit("takeover_action", { taskId, action: "scroll", payload: { deltaX: e.deltaX, deltaY: e.deltaY } });
  };

  const tabs = [
    { id: "browser" as const, label: "浏览器", icon: <Globe className="w-4 h-4" />, active: sandbox.browser.isLoading },
    { id: "terminal" as const, label: "终端", icon: <Terminal className="w-4 h-4" />, active: false },
    { id: "thinking" as const, label: "思考过程", icon: <Bot className="w-4 h-4" />, active: !!sandbox.thinking },
  ];

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="flex items-center border-b bg-gray-50 px-2">
        {tabs.map(tab => (
          <button key={tab.id}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.icon} {tab.label}
            {tab.active && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 px-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${sandbox.isConnected ? "bg-green-500" : "bg-red-400"}`} />
          {sandbox.isConnected ? "已连接" : "断开"}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "browser" && (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b">
              <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 text-sm text-gray-600 truncate font-mono bg-white rounded-lg px-2 py-1 border text-xs">
                {sandbox.browser.url || "等待 Insi 打开网页..."}
              </div>
              {sandbox.browser.isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            </div>
            <div className="flex-1 overflow-auto bg-gray-200 flex items-center justify-center relative">
              {sandbox.browser.screenshot ? (
                <img ref={imgRef} src={sandbox.browser.screenshot.startsWith('data:') ? sandbox.browser.screenshot : `data:image/jpeg;base64,${sandbox.browser.screenshot}`} alt="浏览器画面"
                  className={`max-w-full max-h-full object-contain ${takeoverActive ? "cursor-crosshair" : ""}`}
                  onClick={handleTakeoverClick} onWheel={handleTakeoverWheel}
                  tabIndex={0} onKeyDown={handleTakeoverKeyDown}
                  onMouseDown={e => { if (takeoverActive) { e.preventDefault(); imgRef.current?.focus(); } }}
                  style={takeoverActive ? { outline: "3px solid #f97316", outlineOffset: "2px", userSelect: "none" } : { outline: "none" }} />
              ) : (
                <div className="text-center text-gray-400 space-y-2">
                  <MonitorPlay className="w-16 h-16 mx-auto opacity-20" />
                  <p className="text-sm">等待 Insi 打开浏览器...</p>
                </div>
              )}
              {/* TakeoverPanel 替代了旧的浮动按钮 — 见组件底部 */}
            </div>
          </div>
        )}

        {activeTab === "terminal" && (
          <div ref={terminalRef} className="h-full overflow-auto bg-gray-900 p-3 font-mono text-sm">
            {(sandbox.terminal?.lines?.length ?? 0) === 0 ? (
              <div className="text-gray-500 text-center mt-10"><Terminal className="w-12 h-12 mx-auto opacity-20 mb-2" /><p>等待终端输出...</p></div>
            ) : (
              (sandbox.terminal?.lines || []).map((line, i) => (
                <div key={i} className={`py-0.5 ${line.type === "command" ? "text-green-400" : "text-gray-300"}`}>
                  {line.type === "command" && <span className="text-blue-400">$ </span>}{line.content}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "thinking" && (
          <div className="h-full overflow-auto p-4 space-y-3">
            {sandbox.steps.length === 0 && !sandbox.thinking ? (
              <div className="text-gray-400 text-center mt-10"><Bot className="w-12 h-12 mx-auto opacity-20 mb-2" /><p className="text-sm">等待 Insi 开始思考...</p></div>
            ) : (
              <>
                {sandbox.thinking && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl animate-pulse">
                    <div className="flex items-center gap-2 text-yellow-700 text-sm font-medium mb-1"><Bot className="w-4 h-4" /> Insi 正在思考...</div>
                    <p className="text-sm text-yellow-800">{sandbox.thinking}</p>
                  </div>
                )}
                {sandbox.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-2">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                      {step.payload?.stepNumber || i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400">{step.payload?.stepType || "step"} · {new Date(step.timestamp).toLocaleTimeString()}</div>
                      <p className="text-sm text-gray-700 mt-0.5">{step.payload?.content}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {sandbox.progress > 0 && (
        <div className="border-t px-3 py-2 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{sandbox.currentStep || "执行中..."}</span>
            <span>{Math.round(sandbox.progress)}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${sandbox.progress}%` }} />
          </div>
        </div>
      )}

      {/* ★ Phase 4: 增强型人工接管面板（替代旧的浮动按钮） */}
      <TakeoverPanel
        taskId={taskId}
        socket={sandbox.socket}
        isRunning={sandbox.progress > 0 && sandbox.progress < 100}
        apiFetch={apiFetch}
        onTakeoverChange={(active) => {
          setTakeoverActive(active);
          if (active && imgRef.current) setTimeout(() => imgRef.current?.focus(), 100);
        }}
      />

      {/* ★ Phase 3: 执行报告（任务完成后展示） */}
      {completedReport && <ExecutionReport report={completedReport} />}
    </div>
  );
}

// ─────────────────── 任务卡片 ───────────────────
