/**
 * pages/PlaybookMarket.tsx — 统一自动化市场
 *
 * ★ 合并 Skill（轻量技能）+ Playbook（Agent 工作流）为单一市场
 *
 * 路由:
 *   /playbooks           — 市场浏览（统一）
 *   /playbooks/mine      — 我的（Playbook + 已安装 Skill）
 *   /playbooks/:id       — 详情（Playbook 类型）
 *   /playbooks/new       — 新建 Playbook
 *   /playbooks/:id/edit  — 编辑 Playbook
 *   /skills/:id          — 详情（Skill 类型，跳转已有页面）
 */
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  Store, Plus, Search, Star, Play, GitFork, Download,
  Loader2, Filter, Clock, Coins, ChevronRight,
  Sparkles, Inbox, Bookmark, Zap, Globe, Terminal,
  Bot, Command, ToggleRight,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { PlaybookDetail } from "./playbook/PlaybookDetail";
import { PlaybookEditor } from "./playbook/PlaybookEditor";

const CATEGORIES = [
  { key: "", label: "全部", icon: "🔥" },
  { key: "research", label: "调研", icon: "🔍" },
  { key: "content", label: "内容", icon: "✍️" },
  { key: "code", label: "代码", icon: "💻" },
  { key: "data", label: "数据", icon: "📊" },
  { key: "monitor", label: "监控", icon: "📡" },
  { key: "devops", label: "运维", icon: "🚀" },
  { key: "forum", label: "论坛", icon: "💬" },
  { key: "desktop", label: "桌面", icon: "🖥️" },
  { key: "general", label: "通用", icon: "🤖" },
];

const SOURCE_FILTERS = [
  { key: "all", label: "全部" },
  { key: "playbook", label: "Agent 工作流" },
  { key: "skill", label: "轻量技能" },
];

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "text-gray-500 bg-gray-100" },
  pending_review: { label: "审核中", color: "text-amber-600 bg-amber-50" },
  published: { label: "已发布", color: "text-green-600 bg-green-50" },
  rejected: { label: "已驳回", color: "text-red-600 bg-red-50" },
  archived: { label: "已归档", color: "text-gray-400 bg-gray-50" },
};

const PIPELINE_LABELS: Record<string, string> = {
  chat: "对话",
  scheduled_research: "深度研究",
  automation: "浏览器自动化",
  webhook: "Webhook",
  composite: "组合",
};

export default function PlaybookMarket() {
  const [, navigate] = useLocation();
  const [matchDetail, paramsDetail] = useRoute("/playbooks/:id");
  const [matchEdit, paramsEdit] = useRoute("/playbooks/:id/edit");
  const [matchNew] = useRoute("/playbooks/new");
  const [matchMine] = useRoute("/playbooks/mine");

  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [sourceType, setSourceType] = useState<"all" | "playbook" | "skill">("all");
  const [tab, setTab] = useState<"market" | "mine">("market");

  // ── 所有 hooks 必须在早期返回之前调用 ──
  const isMyTab = matchMine || tab === "mine";
  const isSubRoute = !!(matchNew || (matchEdit && paramsEdit?.id) || (matchDetail && paramsDetail?.id && paramsDetail.id !== "mine" && paramsDetail.id !== "new"));

  const marketQuery = trpc.playbook.marketUnified.useQuery(
    { category: category || undefined, search: search || undefined, sourceType, limit: 30 },
    { enabled: !isMyTab && !isSubRoute, retry: false, refetchOnWindowFocus: false },
  );
  const mineQuery = trpc.playbook.mineUnified.useQuery(undefined, {
    enabled: isMyTab && !isSubRoute, retry: false, refetchOnWindowFocus: false,
  });

  // ── 编辑器路由 ──
  if (matchNew) {
    return <DashboardLayout><PlaybookEditor onSaved={(id) => navigate(`/playbooks/${id}`)} /></DashboardLayout>;
  }
  if (matchEdit && paramsEdit?.id && paramsEdit.id !== "mine" && paramsEdit.id !== "new") {
    return <DashboardLayout><PlaybookEditor playbookId={paramsEdit.id} onSaved={() => navigate(`/playbooks/${paramsEdit!.id}`)} /></DashboardLayout>;
  }

  // ── Playbook 详情路由 ──
  if (matchDetail && paramsDetail?.id && paramsDetail.id !== "mine" && paramsDetail.id !== "new") {
    return <DashboardLayout><PlaybookDetail id={paramsDetail.id} onBack={() => navigate("/playbooks")} /></DashboardLayout>;
  }

  // ── 市场 / 我的 ──

  const items = isMyTab ? (mineQuery.data || []) : (marketQuery.data?.items || []);
  const isLoading = isMyTab ? mineQuery.isLoading : marketQuery.isLoading;

  const handleCardClick = (item: any) => {
    if (item.sourceType === "skill") {
      navigate(`/skills/${item.sourceId}`);
    } else {
      navigate(`/playbooks/${item.sourceId}`);
    }
  };

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">

          {/* 头部 */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Store className="w-6 h-6 text-primary" />
                自动化市场
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                发现、安装、运行 Agent 工作流和轻量技能
              </p>
            </div>
            <button
              onClick={() => navigate("/playbooks/new")}
              className="px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 flex items-center gap-2 shadow-lg shadow-primary/20"
            >
              <Plus className="w-4 h-4" /> 创建工作流
            </button>
          </div>

          {/* Tab + 搜索 + 类型筛选 */}
          <div className="flex items-center gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
              <button
                onClick={() => { setTab("market"); navigate("/playbooks"); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  !isMyTab ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Store className="w-3.5 h-3.5 inline mr-1" /> 市场
              </button>
              <button
                onClick={() => { setTab("mine"); navigate("/playbooks/mine"); }}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  isMyTab ? "bg-background shadow-sm" : "text-muted-foreground"
                }`}
              >
                <Bookmark className="w-3.5 h-3.5 inline mr-1" /> 我的
              </button>
            </div>

            {/* 类型筛选（市场 Tab） */}
            {!isMyTab && (
              <div className="flex items-center gap-1 bg-muted/50 rounded-xl p-1">
                {SOURCE_FILTERS.map(f => (
                  <button
                    key={f.key}
                    onClick={() => setSourceType(f.key as any)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      sourceType === f.key ? "bg-background shadow-sm" : "text-muted-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            )}

            {/* 搜索 */}
            {!isMyTab && (
              <div className="flex-1 max-w-sm relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="搜索..."
                  className="w-full pl-9 pr-4 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            )}

            {/* 统计 */}
            {!isMyTab && marketQuery.data && (
              <div className="text-xs text-muted-foreground flex items-center gap-2 ml-auto">
                <span>{String(marketQuery.data.totalPlaybooks)} 工作流</span>
                <span>·</span>
                <span>{String(marketQuery.data.totalSkills)} 技能</span>
              </div>
            )}
          </div>

          {/* 分类（仅市场） */}
          {!isMyTab && (
            <div className="flex items-center gap-1.5 mb-6 overflow-x-auto pb-1">
              {CATEGORIES.map(c => (
                <button
                  key={c.key}
                  onClick={() => setCategory(c.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                    category === c.key
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "bg-muted/60 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <span>{c.icon}</span> {c.label}
                </button>
              ))}
            </div>
          )}

          {/* 卡片网格 */}
          {isLoading ? (
            <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-30" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-20 text-muted-foreground">
              <Inbox className="w-16 h-16 mx-auto mb-4 opacity-10" />
              <p className="font-medium mb-1">{isMyTab ? "还没有自动化工具" : "暂无匹配结果"}</p>
              <button onClick={() => navigate("/playbooks/new")} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm hover:opacity-90">
                <Plus className="w-4 h-4 inline mr-1" /> 创建第一个
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {items.map((item: any) => {
                const price = parseFloat(item.price || "0");
                const isSkill = item.sourceType === "skill";
                const statusInfo = STATUS_LABELS[item.status] || null;
                return (
                  <div
                    key={item.id}
                    onClick={() => handleCardClick(item)}
                    className="group rounded-2xl border bg-card p-5 hover:shadow-lg hover:border-primary/30 cursor-pointer transition-all"
                  >
                    {/* 头部 */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-2xl">{item.icon}</span>
                        <div>
                          <h3 className="font-bold text-sm group-hover:text-primary transition-colors">{item.title}</h3>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {/* 类型徽标 */}
                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                              isSkill
                                ? "bg-violet-100 text-violet-700"
                                : "bg-blue-100 text-blue-700"
                            }`}>
                              {isSkill ? "轻量技能" : "Agent 工作流"}
                            </span>
                            {/* 技能子类型 */}
                            {isSkill && item.pipelineType && (
                              <span className="text-[10px] text-muted-foreground">
                                {PIPELINE_LABELS[item.pipelineType] || item.pipelineType}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        {item.isOfficial && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">官方</span>}
                        {/* "我的"tab 状态徽标 */}
                        {isMyTab && statusInfo && (
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </span>
                        )}
                        {/* 已安装技能的激活状态 */}
                        {isMyTab && isSkill && item.isInstalled && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${item.isActive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                            {item.isActive ? "启用" : "停用"}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* 描述 */}
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-3 min-h-[2rem]">{item.description}</p>

                    {/* 触发方式标签（仅 Skill） */}
                    {isSkill && item.triggers && (
                      <div className="flex items-center gap-1.5 mb-2">
                        {item.triggers.cron && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Clock className="w-2.5 h-2.5" /> 定时
                          </span>
                        )}
                        {item.triggers.command && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Command className="w-2.5 h-2.5" /> {String(item.triggers.command)}
                          </span>
                        )}
                        {item.triggers.keywords?.length > 0 && (
                          <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5">
                            <Sparkles className="w-2.5 h-2.5" /> 关键词
                          </span>
                        )}
                      </div>
                    )}

                    {/* 底部统计 */}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-3">
                        {item.rating && (
                          <span className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-amber-400 fill-amber-400" />{String(item.rating)}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5">
                          {isSkill ? <Download className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                          {String(item.runCount || 0)}
                        </span>
                        {!isSkill && (
                          <span className="flex items-center gap-0.5">
                            <GitFork className="w-3 h-3" />{String(item.installCount || 0)}
                          </span>
                        )}
                      </div>
                      {price > 0 && <span className="flex items-center gap-0.5 text-amber-600 font-medium"><Coins className="w-3 h-3" />{String(price)} 🐟</span>}
                    </div>

                    {/* Tags */}
                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        {item.tags.slice(0, 3).map((tag: string) => (
                          <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{String(tag)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
