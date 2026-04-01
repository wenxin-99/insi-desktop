/**
 * 技能市场页面
 *
 * src/pages/skills/SkillMarket.tsx
 */
import { useState, useMemo } from "react";
import PageLayout from "@/components/PageLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Search, Sparkles, Download, Star, Clock, ChevronRight,
  Loader2, Zap, Filter,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

// ═══════════ 分类图标映射 ═══════════

const CATEGORY_ICONS: Record<string, string> = {
  information: "📰",
  automation: "🤖",
  data: "📊",
  development: "💻",
  life: "🏠",
  content: "✍️",
  education: "📚",
  business: "💼",
};

// ═══════════ 技能卡片 ═══════════

function SkillCard({ skill, onInstall, installed }: {
  skill: any;
  onInstall: (skill: any) => void;
  installed: boolean;
}) {
  const config = skill.config || {};
  const tags = Array.isArray(skill.tags) ? skill.tags : [];

  return (
    <div className="border rounded-xl bg-card hover:shadow-md transition-all duration-200 overflow-hidden group">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl shrink-0">
            {skill.icon || "🔧"}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-base truncate">{skill.name}</h3>
              {skill.isOfficial && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                  官方
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{skill.description}</p>
          </div>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-3">
            {tags.slice(0, 4).map((tag: string, i: number) => (
              <Badge key={i} variant="outline" className="text-[11px] px-2 py-0 font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Stats + Action */}
        <div className="flex items-center justify-between mt-4 pt-3 border-t">
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Download className="w-3 h-3" /> {skill.installCount || 0}
            </span>
            {config.estimatedCost && (
              <span className="flex items-center gap-1">
                <Zap className="w-3 h-3" /> ~{config.estimatedCost} 🐟/次
              </span>
            )}
            {parseFloat(skill.rating) > 0 && (
              <span className="flex items-center gap-1">
                <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                {parseFloat(skill.rating).toFixed(1)}
              </span>
            )}
          </div>
          <Button
            size="sm"
            variant={installed ? "outline" : "default"}
            onClick={() => onInstall(skill)}
            disabled={installed}
            className="h-7 text-xs"
          >
            {installed ? "已安装" : "安装"}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ═══════════ 主页面 ═══════════

export default function SkillMarket() {
  const [, navigate] = useLocation();
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  // 数据获取
  const categoriesQuery = trpc.skill.categories.useQuery();
  const marketQuery = trpc.skill.market.useQuery({
    category: selectedCategory || undefined,
    search: searchQuery || undefined,
    page: 1,
    pageSize: 50,
  });
  const installedQuery = trpc.skill.installed.useQuery();

  const installedSkillIds = useMemo(() => {
    return new Set((installedQuery.data || []).map((us: any) => us.skillId));
  }, [installedQuery.data]);

  const categories = categoriesQuery.data || [];
  const skills = marketQuery.data?.skills || [];

  const handleInstall = (skill: any) => {
    // 导航到技能详情/安装页
    navigate(`/skills/${skill.id}`);
  };

  return (
    <PageLayout>
      <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Sparkles className="w-7 h-7 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">技能市场</h1>
              <p className="text-sm text-muted-foreground">
                安装预置技能，或创建自定义技能，让 AI 帮你自动完成各种任务
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/skills/mine")}>
              我的技能 <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="搜索技能..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          <Button
            variant={selectedCategory === null ? "default" : "outline"}
            size="sm"
            onClick={() => setSelectedCategory(null)}
            className="h-8 text-xs"
          >
            全部
          </Button>
          {categories.map((cat: any) => (
            <Button
              key={cat.key}
              variant={selectedCategory === cat.key ? "default" : "outline"}
              size="sm"
              onClick={() => setSelectedCategory(cat.key)}
              className="h-8 text-xs"
            >
              {cat.icon} {cat.label}
              {cat.count > 0 && (
                <span className="ml-1 opacity-60">({cat.count})</span>
              )}
            </Button>
          ))}
        </div>

        {/* Skill Grid */}
        {marketQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : skills.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Search className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p className="text-lg font-medium">
              {searchQuery ? "未找到匹配的技能" : "暂无技能"}
            </p>
            <p className="text-sm mt-1">
              {searchQuery ? "尝试其他关键词" : "官方技能正在加载中..."}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {skills.map((skill: any) => (
              <SkillCard
                key={skill.id}
                skill={skill}
                onInstall={handleInstall}
                installed={installedSkillIds.has(skill.id)}
              />
            ))}
          </div>
        )}
      </div>
    </PageLayout>
  );
}
