/**
 * GitHubRepoPicker — 输入框工具栏中的 GitHub 仓库选择器
 *
 * - 未选中：显示 GitHub 图标按钮，点击弹出选择面板
 * - 已选中：显示带库名的 Badge，点击 X 取消
 * - 用户不选则不触发任何同步/拉取操作
 *
 * 数据来源：
 *   优先展示已克隆任务（/api/github/tasks, status=ready）
 *   同时展示 GitHub 仓库列表（/api/github/repos）
 */
import { useState, useEffect } from "react";
import axios from "axios";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Github, X, Loader2, FolderOpen, GitBranch, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

export interface SelectedGitHubRepo {
  /** github_repo_tasks.id（已克隆工作区）或 null（仅绑定仓库名） */
  taskId?: number;
  /** owner/repo */
  fullName: string;
  branch?: string;
}

interface GitHubRepoPickerProps {
  selectedRepo: SelectedGitHubRepo | null;
  onSelect: (repo: SelectedGitHubRepo | null) => void;
  className?: string;
}

interface RepoTask {
  id: number;
  repoFullName: string;
  branch: string;
  status: string;
  statusMessage: string | null;
}

interface GHRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  language: string | null;
}

export function GitHubRepoPicker({ selectedRepo, onSelect, className }: GitHubRepoPickerProps) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"workspaces" | "repos">("workspaces");
  const [tasks, setTasks] = useState<RepoTask[]>([]);
  const [repos, setRepos] = useState<GHRepo[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [ghConnected, setGhConnected] = useState<boolean | null>(null);
  const [search, setSearch] = useState("");

  // 展开时加载数据
  useEffect(() => {
    if (!open) return;
    loadTasks();
    checkConnection();
  }, [open]);

  useEffect(() => {
    if (!open || tab !== "repos" || ghConnected !== true) return;
    loadRepos();
  }, [open, tab, ghConnected]);

  async function checkConnection() {
    try {
      const { data } = await axios.get("/api/github/connection");
      setGhConnected(data.connected);
    } catch {
      setGhConnected(false);
    }
  }

  async function loadTasks() {
    setLoadingTasks(true);
    try {
      const { data } = await axios.get("/api/github/tasks");
      setTasks((data.tasks || []).filter((t: RepoTask) => t.status === "ready"));
    } catch {
      setTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }

  async function loadRepos() {
    setLoadingRepos(true);
    try {
      const { data } = await axios.get("/api/github/repos?limit=30");
      setRepos(data.repos || []);
    } catch {
      setRepos([]);
    } finally {
      setLoadingRepos(false);
    }
  }

  function selectTask(task: RepoTask) {
    onSelect({ taskId: task.id, fullName: task.repoFullName, branch: task.branch });
    setOpen(false);
  }

  function selectRepo(repo: GHRepo) {
    onSelect({ fullName: repo.full_name, branch: repo.default_branch });
    setOpen(false);
  }

  // ────────── 已选中 → Badge ──────────
  if (selectedRepo) {
    const shortName = selectedRepo.fullName.split("/")[1] ?? selectedRepo.fullName;
    return (
      <Badge
        variant="secondary"
        className={cn(
          "flex items-center gap-1 cursor-pointer hover:bg-secondary/80 transition-colors max-w-[130px]",
          className
        )}
        onClick={() => onSelect(null)}
        title={`已绑定仓库：${selectedRepo.fullName}${selectedRepo.branch ? ` @ ${selectedRepo.branch}` : ""}\n点击取消绑定`}
      >
        <Github className="h-3 w-3 flex-shrink-0" />
        <span className="truncate text-xs">{shortName}</span>
        {selectedRepo.branch && (
          <span className="text-[10px] opacity-60 truncate hidden sm:inline">@{selectedRepo.branch}</span>
        )}
        <X className="h-3 w-3 ml-0.5 opacity-60 flex-shrink-0" />
      </Badge>
    );
  }

  // ────────── 未选中 → 图标按钮 ──────────
  const filteredTasks = tasks.filter(t =>
    t.repoFullName.toLowerCase().includes(search.toLowerCase())
  );
  const filteredRepos = repos.filter(r =>
    r.full_name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn("h-8 px-2 text-muted-foreground hover:text-foreground", className)}
          title="绑定 GitHub 仓库"
          type="button"
        >
          <Github className="h-4 w-4" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0 overflow-hidden" align="start" side="top">
        {/* 头部 */}
        <div className="flex items-center gap-2 px-3 pt-3 pb-2">
          <Github className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium">绑定 GitHub 仓库</span>
        </div>
        <p className="text-[11px] text-muted-foreground px-3 pb-2">
          选择后 AI 才会读取/同步该仓库
        </p>

        {/* Tab 切换 */}
        <div className="flex border-b border-border mx-3 mb-2">
          {(["workspaces", "repos"] as const).map(t => (
            <button
              key={t}
              className={cn(
                "text-xs pb-1.5 px-2 transition-colors border-b-2 -mb-px",
                tab === t
                  ? "border-primary text-foreground font-medium"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
              onClick={() => setTab(t)}
              type="button"
            >
              {t === "workspaces" ? (
                <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />已克隆工作区</span>
              ) : (
                <span className="flex items-center gap-1"><GitBranch className="h-3 w-3" />GitHub 仓库</span>
              )}
            </button>
          ))}
        </div>

        {/* 搜索框 */}
        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索仓库..."
              className="h-7 text-xs pl-7"
            />
          </div>
        </div>

        {/* 内容区 */}
        <div className="max-h-[220px] overflow-y-auto px-1.5 pb-2">
          {tab === "workspaces" ? (
            loadingTasks ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredTasks.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                <FolderOpen className="h-6 w-6 mx-auto mb-2 opacity-40" />
                {tasks.length === 0 ? "暂无已克隆仓库" : "没有匹配结果"}
                <br />
                <span>前往 GitHub 工作区先克隆仓库</span>
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredTasks.map(task => (
                  <button
                    key={task.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    onClick={() => selectTask(task)}
                  >
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Github className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-xs">{task.repoFullName}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <GitBranch className="h-2.5 w-2.5" />
                        {task.branch}
                        <span className="ml-1 text-green-500">✓ 就绪</span>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          ) : (
            /* GitHub 仓库列表 */
            ghConnected === false ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                <Github className="h-6 w-6 mx-auto mb-2 opacity-40" />
                未连接 GitHub
                <br />
                <button
                  type="button"
                  className="text-primary underline mt-1"
                  onClick={() => { window.location.href = "/api/github/login"; }}
                >
                  立即连接
                </button>
              </div>
            ) : loadingRepos ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            ) : filteredRepos.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                {repos.length === 0 ? "没有可用仓库" : "没有匹配结果"}
              </div>
            ) : (
              <div className="space-y-0.5">
                {filteredRepos.map(repo => (
                  <button
                    key={repo.id}
                    type="button"
                    className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left text-sm hover:bg-muted transition-colors"
                    onClick={() => selectRepo(repo)}
                  >
                    <div className="w-6 h-6 rounded bg-muted flex items-center justify-center flex-shrink-0">
                      <Github className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium text-xs">{repo.full_name}</div>
                      <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <GitBranch className="h-2.5 w-2.5" />
                        {repo.default_branch}
                        {repo.language && <span>· {repo.language}</span>}
                        {repo.private && <span>· 🔒</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )
          )}
        </div>

        {/* 底部提示 */}
        <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground">
          💡 不选择则 AI 不会自动读取或同步 GitHub
        </div>
      </PopoverContent>
    </Popover>
  );
}
