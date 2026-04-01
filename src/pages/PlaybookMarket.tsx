/**
 * pages/PlaybookMarket.tsx — 统一自动化市场
 * ★ v3: 移动端全适配 + 可视化画布编辑器集成
 */
import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import {
  Store, Plus, Search, Star, Play, GitFork, Download,
  Loader2, Clock, Coins, Edit3,
  Sparkles, Inbox, Bookmark, Command, X,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";
import { PlaybookDetail } from "./playbook/PlaybookDetail";
import { WorkflowCanvas } from "./playbook/WorkflowCanvas";

const CATEGORIES = [
  { key: "", label: "全部", icon: "🔥" }, { key: "research", label: "调研", icon: "🔍" },
  { key: "content", label: "内容", icon: "✍️" }, { key: "code", label: "代码", icon: "💻" },
  { key: "data", label: "数据", icon: "📊" }, { key: "monitor", label: "监控", icon: "📡" },
  { key: "devops", label: "运维", icon: "🚀" }, { key: "forum", label: "论坛", icon: "💬" },
  { key: "desktop", label: "桌面", icon: "🖥️" }, { key: "general", label: "通用", icon: "🤖" },
];
const SOURCE_FILTERS = [
  { key: "all", label: "全部" }, { key: "playbook", label: "工作流" }, { key: "skill", label: "技能" },
];
const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "text-gray-500 bg-gray-100 dark:bg-gray-800" },
  pending_review: { label: "审核中", color: "text-amber-600 bg-amber-50 dark:bg-amber-950/40" },
  published: { label: "已发布", color: "text-green-600 bg-green-50 dark:bg-green-950/40" },
  rejected: { label: "已驳回", color: "text-red-600 bg-red-50 dark:bg-red-950/40" },
  archived: { label: "已归档", color: "text-gray-400 bg-gray-50 dark:bg-gray-800" },
};
const PIPELINE_LABELS: Record<string, string> = {
  chat: "对话", scheduled_research: "深度研究", automation: "浏览器自动化", webhook: "Webhook", composite: "组合",
};

export default function PlaybookMarket() {
  const [, navigate] = useLocation();
  const [matchDetail, paramsDetail] = useRoute("/playbooks/:id");
  const [matchEdit, paramsEdit] = useRoute("/playbooks/:id/edit");
  const [matchNew] = useRoute("/playbooks/new");
  const [matchMine] = useRoute("/playbooks/mine");
  const [category, setCategory] = useState("");
  const [search, setSearch] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [sourceType, setSourceType] = useState<"all" | "playbook" | "skill">("all");
  const [tab, setTab] = useState<"market" | "mine">("market");
  const isMyTab = matchMine || tab === "mine";
  const isSubRoute = !!(matchNew || (matchEdit && paramsEdit?.id) || (matchDetail && paramsDetail?.id && paramsDetail.id !== "mine" && paramsDetail.id !== "new"));
  const marketQuery = trpc.playbook.marketUnified.useQuery(
    { category: category || undefined, search: search || undefined, sourceType, limit: 30 },
    { enabled: !isMyTab && !isSubRoute, retry: false, refetchOnWindowFocus: false },
  );
  const mineQuery = trpc.playbook.mineUnified.useQuery(undefined, { enabled: isMyTab && !isSubRoute, retry: false, refetchOnWindowFocus: false });

  if (matchNew) return <WorkflowCanvas onSaved={(id) => navigate(`/playbooks/${id}`)} onBack={() => navigate("/playbooks")} />;
  if (matchEdit && paramsEdit?.id && paramsEdit.id !== "mine" && paramsEdit.id !== "new")
    return <WorkflowCanvas playbookId={paramsEdit.id} onSaved={() => navigate(`/playbooks/${paramsEdit!.id}`)} onBack={() => navigate(`/playbooks/${paramsEdit!.id}`)} />;
  if (matchDetail && paramsDetail?.id && paramsDetail.id !== "mine" && paramsDetail.id !== "new")
    return <DashboardLayout><PlaybookDetail id={paramsDetail.id} onBack={() => navigate("/playbooks")} /></DashboardLayout>;

  const items = isMyTab ? (mineQuery.data || []) : (marketQuery.data?.items || []);
  const isLoading = isMyTab ? mineQuery.isLoading : marketQuery.isLoading;
  const handleCardClick = (item: any) => navigate(item.sourceType === "skill" ? `/skills/${item.sourceId}` : `/playbooks/${item.sourceId}`);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-background pb-24 sm:pb-6">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-4 sm:py-6">
          {/* 头部 */}
          <div className="flex items-start sm:items-center justify-between mb-4 sm:mb-6 gap-3">
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Store className="w-5 h-5 sm:w-6 sm:h-6 text-primary flex-shrink-0" />
                <span className="truncate">自动化市场</span>
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 hidden sm:block">发现、安装、运行 Agent 工作流和轻量技能</p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {!isMyTab && (
                <button onClick={() => setShowSearch(!showSearch)} className="sm:hidden p-2 border rounded-xl hover:bg-muted">
                  {showSearch ? <X className="w-4 h-4" /> : <Search className="w-4 h-4" />}
                </button>
              )}
              <button onClick={() => navigate("/playbooks/new")} className="hidden sm:flex px-4 py-2.5 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:opacity-90 items-center gap-2 shadow-lg shadow-primary/20">
                <Plus className="w-4 h-4" /> 创建工作流
              </button>
            </div>
          </div>

          {/* 移动端搜索 */}
          {showSearch && !isMyTab && (
            <div className="mb-3 sm:hidden relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..." autoFocus className="w-full pl-9 pr-4 py-2.5 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          )}

          {/* Tab + 筛选 */}
          <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4 overflow-x-auto pb-0.5 scrollbar-hide">
            <div className="flex items-center gap-0.5 bg-muted/50 rounded-xl p-0.5 sm:p-1 flex-shrink-0">
              <button onClick={() => { setTab("market"); navigate("/playbooks"); }} className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${!isMyTab ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Store className="w-3.5 h-3.5 inline mr-1" /> 市场</button>
              <button onClick={() => { setTab("mine"); navigate("/playbooks/mine"); }} className={`px-3 sm:px-4 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-all whitespace-nowrap ${isMyTab ? "bg-background shadow-sm" : "text-muted-foreground"}`}><Bookmark className="w-3.5 h-3.5 inline mr-1" /> 我的</button>
            </div>
            {!isMyTab && (
              <div className="flex items-center gap-0.5 bg-muted/50 rounded-xl p-0.5 sm:p-1 flex-shrink-0">
                {SOURCE_FILTERS.map(f => <button key={f.key} onClick={() => setSourceType(f.key as any)} className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-[11px] sm:text-xs font-medium whitespace-nowrap transition-all ${sourceType === f.key ? "bg-background shadow-sm" : "text-muted-foreground"}`}>{f.label}</button>)}
              </div>
            )}
            {!isMyTab && <div className="hidden sm:block flex-1 max-w-sm relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索..." className="w-full pl-9 pr-4 py-2 rounded-xl border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" /></div>}
            {!isMyTab && marketQuery.data && <div className="hidden md:flex text-xs text-muted-foreground items-center gap-2 ml-auto flex-shrink-0"><span>{String(marketQuery.data.totalPlaybooks)} 工作流</span><span>·</span><span>{String(marketQuery.data.totalSkills)} 技能</span></div>}
          </div>

          {/* 分类 */}
          {!isMyTab && (
            <div className="flex items-center gap-1.5 mb-4 sm:mb-6 overflow-x-auto pb-1 scrollbar-hide -mx-3 px-3 sm:mx-0 sm:px-0">
              {CATEGORIES.map(c => <button key={c.key} onClick={() => setCategory(c.key)} className={`flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full text-[11px] sm:text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${category === c.key ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted/60 text-muted-foreground hover:bg-muted active:bg-muted"}`}><span>{c.icon}</span> {c.label}</button>)}
            </div>
          )}

          {/* 卡片 */}
          {isLoading ? (
            <div className="text-center py-16 sm:py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-30" /></div>
          ) : items.length === 0 ? (
            <div className="text-center py-16 sm:py-20 text-muted-foreground"><Inbox className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 opacity-10" /><p className="font-medium mb-1 text-sm">{isMyTab ? "还没有自动化工具" : "暂无匹配结果"}</p><button onClick={() => navigate("/playbooks/new")} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm hover:opacity-90"><Plus className="w-4 h-4 inline mr-1" /> 创建第一个</button></div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {items.map((item: any) => {
                const price = parseFloat(item.price || "0"); const isSkill = item.sourceType === "skill"; const statusInfo = STATUS_LABELS[item.status] || null;
                return (
                  <div key={item.id} onClick={() => handleCardClick(item)} className="group rounded-xl sm:rounded-2xl border bg-card p-4 sm:p-5 hover:shadow-lg hover:border-primary/30 active:scale-[0.99] cursor-pointer transition-all">
                    <div className="flex items-start justify-between mb-2 sm:mb-3">
                      <div className="flex items-center gap-2 sm:gap-2.5 min-w-0"><span className="text-xl sm:text-2xl flex-shrink-0">{item.icon}</span><div className="min-w-0"><h3 className="font-bold text-[13px] sm:text-sm group-hover:text-primary transition-colors truncate">{item.title}</h3><div className="flex items-center gap-1.5 mt-0.5"><span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${isSkill ? "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-400" : "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-400"}`}>{isSkill ? "技能" : "工作流"}</span>{isSkill && item.pipelineType && <span className="text-[10px] text-muted-foreground">{PIPELINE_LABELS[item.pipelineType] || item.pipelineType}</span>}</div></div></div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">{item.isOfficial && <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full font-medium">官方</span>}{isMyTab && statusInfo && <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${statusInfo.color}`}>{statusInfo.label}</span>}</div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 mb-2.5 sm:mb-3 min-h-[2rem]">{item.description}</p>
                    {isSkill && item.triggers && <div className="flex items-center gap-1.5 mb-2 flex-wrap">{item.triggers.cron && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> 定时</span>}{item.triggers.command && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5"><Command className="w-2.5 h-2.5" /> {String(item.triggers.command)}</span>}{item.triggers.keywords?.length > 0 && <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded flex items-center gap-0.5"><Sparkles className="w-2.5 h-2.5" /> 关键词</span>}</div>}
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <div className="flex items-center gap-2.5">{item.rating && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{String(item.rating)}</span>}<span className="flex items-center gap-0.5">{isSkill ? <Download className="w-3 h-3" /> : <Play className="w-3 h-3" />}{String(item.runCount || 0)}</span>{!isSkill && <span className="flex items-center gap-0.5"><GitFork className="w-3 h-3" />{String(item.installCount || 0)}</span>}</div>
                      <div className="flex items-center gap-1.5">{price > 0 && <span className="flex items-center gap-0.5 text-amber-600 font-medium"><Coins className="w-3 h-3" />{String(price)} 🐟</span>}{isMyTab && !isSkill && <button onClick={e => { e.stopPropagation(); navigate(`/playbooks/${item.sourceId}/edit`); }} className="p-1.5 rounded-lg hover:bg-muted opacity-60 sm:opacity-0 group-hover:opacity-100 transition-opacity" title="编辑"><Edit3 className="w-3.5 h-3.5" /></button>}</div>
                    </div>
                    {Array.isArray(item.tags) && item.tags.length > 0 && <div className="flex items-center gap-1 mt-2">{item.tags.slice(0, 3).map((tag: string) => <span key={tag} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{String(tag)}</span>)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* 移动端 FAB */}
      <button onClick={() => navigate("/playbooks/new")} className="sm:hidden fixed bottom-20 right-4 z-30 w-14 h-14 bg-primary text-primary-foreground rounded-full shadow-xl shadow-primary/30 flex items-center justify-center active:scale-95 transition-transform">
        <Plus className="w-6 h-6" />
      </button>
    </DashboardLayout>
  );
}
