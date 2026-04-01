/**
 * GitHub Workspace — P0+P1 全面升级版
 *
 * 升级:
 *   P0: CodeMirror 编辑器 + Side-by-side Diff + OAuth scope 修复
 *   P1: Pull/Fetch + 分支切换 + Stash + AI Commit Message
 *
 * 三步流程:
 *   1. 选择仓库 + 分支 → 克隆到沙箱
 *   2. 查看/编辑文件，终端执行命令
 *   3. AI 生成 commit message → 选择策略同步回 GitHub
 */
import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Github, Search, GitBranch, Download, FolderOpen, ArrowLeft,
  RefreshCw, Loader2, CheckCircle2, Upload, FileCode,
  Clock, Trash2, Eye, ChevronRight, File, Folder,
  Save, Link2, Play, ArrowDown, Sparkles,
  X,
} from "lucide-react";
import { toast } from "sonner";
import axios from "axios";
import { Link } from "wouter";
import { CodeEditor } from "@/components/github/CodeEditor";
import { DiffViewer } from "@/components/github/DiffViewer";
import { BranchManager } from "@/components/github/BranchManager";
import DashboardLayout from "@/components/DashboardLayout";

// ═══════ 类型 ═══════

interface Repo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  description: string | null;
  default_branch: string;
  clone_url: string;
  language: string | null;
  stargazers_count: number;
  size: number;
}

interface Branch {
  name: string;
  commit: { sha: string };
}

interface RepoTask {
  id: number;
  repoFullName: string;
  branch: string;
  status: string;
  statusMessage: string | null;
  progress: number;
  workspacePath: string | null;
  pullRequestUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FileItem {
  name: string;
  path: string;
  type: "file" | "dir";
  status?: string;
}

interface FileChange {
  status: string;
  path: string;
}

interface OpenFile {
  path: string;
  content: string;
  language: string;
  modified: boolean;
  originalContent: string;
}

// ═══════ 主组件 ═══════

export default function GitHubWorkspace() {
  const { user } = useAuth();
  const [phase, setPhase] = useState<"select" | "workspace">("select");
  const [activeTask, setActiveTask] = useState<RepoTask | null>(null);

  // GitHub 连接状态
  const [ghConnected, setGhConnected] = useState<boolean | null>(null);
  const [ghLogin, setGhLogin] = useState("");

  // 仓库选择
  const [repos, setRepos] = useState<Repo[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [searchQ, setSearchQ] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<Repo | null>(null);
  const [selectedBranch, setSelectedBranch] = useState("");
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [loadingBranches, setLoadingBranches] = useState(false);

  // 任务列表
  const [tasks, setTasks] = useState<RepoTask[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(false);

  // 工作区
  const [files, setFiles] = useState<FileItem[]>([]);
  const [currentPath, setCurrentPath] = useState("");
  const [changes, setChanges] = useState<FileChange[]>([]);
  const [diffContent, setDiffContent] = useState("");
  const [wsTab, setWsTab] = useState<"files" | "changes" | "diff" | "terminal">("files");

  // 多文件 tab
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFileIdx, setActiveFileIdx] = useState(-1);

  // 终端
  const [termCmd, setTermCmd] = useState("");
  const [termOutput, setTermOutput] = useState<string[]>([]);
  const [termRunning, setTermRunning] = useState(false);
  const termRef = useRef<HTMLDivElement>(null);

  // 同步
  const [syncStrategy, setSyncStrategy] = useState("create_pr");
  const [commitMsg, setCommitMsg] = useState("");
  const [newBranch, setNewBranch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [generatingMsg, setGeneratingMsg] = useState(false);

  // P1: Pull
  const [pulling, setPulling] = useState(false);
  // P1: 当前分支（动态更新）
  const [currentBranch, setCurrentBranch] = useState("");

  const [cloning, setCloning] = useState(false);
  const [pollingId, setPollingId] = useState<number | null>(null);

  // ═══════ GitHub 连接检查 ═══════

  useEffect(() => {
    (async () => {
      try {
        const { data } = await axios.get("/api/github/connection");
        setGhConnected(data.connected);
        setGhLogin(data.login || "");
      } catch {
        setGhConnected(false);
      }
    })();
    const params = new URLSearchParams(window.location.search);
    if (params.get("github_linked") === "1") {
      toast.success("GitHub 账号已关联！");
      window.history.replaceState({}, "", window.location.pathname);
      setGhConnected(true);
    }
  }, []);

  const handleConnectGitHub = async () => {
    try {
      const { data } = await axios.post("/api/github/connect");
      if (data.redirectUrl) window.location.href = data.redirectUrl;
    } catch (err: any) {
      toast.error(err.response?.data?.error || "连接失败");
    }
  };

  // ═══════ 数据加载 ═══════

  const loadTasks = useCallback(async () => {
    setLoadingTasks(true);
    try {
      const { data } = await axios.get("/api/github/tasks");
      setTasks(data.tasks || []);
    } catch {}
    setLoadingTasks(false);
  }, []);

  const loadRepos = useCallback(async (q?: string) => {
    setLoadingRepos(true);
    try {
      const params = q ? `?q=${encodeURIComponent(q)}` : "";
      const { data } = await axios.get(`/api/github/repos${params}`);
      setRepos(data.repos || []);
    } catch (err: any) {
      if (err.response?.status === 401) toast.error("GitHub 未连接或 token 已过期");
    }
    setLoadingRepos(false);
  }, []);

  const loadBranches = useCallback(async (fullName: string) => {
    setLoadingBranches(true);
    try {
      const { data } = await axios.get(`/api/github/repos/${fullName}/branches`);
      setBranches(data.branches || []);
    } catch {}
    setLoadingBranches(false);
  }, []);

  useEffect(() => {
    loadTasks();
    loadRepos();
  }, [loadTasks, loadRepos]);

  // 轮询克隆进度
  useEffect(() => {
    if (!pollingId) return;
    const interval = setInterval(async () => {
      try {
        const { data } = await axios.get(`/api/github/workspace/${pollingId}/status`);
        const t = data.task as RepoTask;
        if (t.status === "ready" || t.status === "synced") {
          setActiveTask(t);
          setCurrentBranch(t.branch);
          setPhase("workspace");
          setCloning(false);
          setPollingId(null);
          toast.success("仓库克隆完成！");
          loadTasks();
        } else if (t.status === "error") {
          setCloning(false);
          setPollingId(null);
          toast.error(`克隆失败: ${t.statusMessage}`);
          loadTasks();
        }
      } catch {}
    }, 3000);
    return () => clearInterval(interval);
  }, [pollingId, loadTasks]);

  // ═══════ 仓库选择操作 ═══════

  const handleSelectRepo = (repo: Repo) => {
    setSelectedRepo(repo);
    setSelectedBranch(repo.default_branch);
    loadBranches(repo.full_name);
  };

  const handleClone = async () => {
    if (!selectedRepo || !selectedBranch) return;
    setCloning(true);
    try {
      const { data } = await axios.post("/api/github/workspace/clone", {
        repoFullName: selectedRepo.full_name,
        repoCloneUrl: selectedRepo.clone_url,
        branch: selectedBranch,
      });
      if (data.success) {
        toast.info("克隆已开始，请稍候...");
        setPollingId(data.taskId);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "克隆失败");
      setCloning(false);
    }
  };

  // ═══════ 工作区操作 ═══════

  const handleOpenTask = async (task: RepoTask) => {
    setActiveTask(task);
    setCurrentBranch(task.branch);
    setPhase("workspace");
    setCurrentPath("");
    setOpenFiles([]);
    setActiveFileIdx(-1);
    loadWorkspaceFiles(task.id, "");
    loadWorkspaceChanges(task.id);
  };

  const loadWorkspaceFiles = async (taskId: number, path: string) => {
    try {
      const { data } = await axios.get(
        `/api/github/workspace/${taskId}/files?path=${encodeURIComponent(path)}`
      );
      setFiles(data.files || []);
      setCurrentPath(path);
    } catch {}
  };

  const loadWorkspaceChanges = async (taskId: number) => {
    try {
      const { data } = await axios.get(`/api/github/workspace/${taskId}/status`);
      setChanges(data.changes || []);
    } catch {}
  };

  const handleOpenFile = async (item: FileItem) => {
    if (!activeTask) return;
    if (item.type === "dir") {
      loadWorkspaceFiles(activeTask.id, item.path);
      return;
    }

    // 检查是否已打开
    const existIdx = openFiles.findIndex((f) => f.path === item.path);
    if (existIdx >= 0) {
      setActiveFileIdx(existIdx);
      return;
    }

    try {
      const { data } = await axios.get(
        `/api/github/workspace/${activeTask.id}/file?path=${encodeURIComponent(item.path)}`
      );
      const newFile: OpenFile = {
        path: item.path,
        content: data.content,
        language: data.language,
        modified: false,
        originalContent: data.content,
      };
      setOpenFiles((prev) => {
        setActiveFileIdx(prev.length); // prev.length = 新文件将被追加到的位置
        return [...prev, newFile];
      });
    } catch {
      toast.error("读取文件失败");
    }
  };

  const handleCloseFile = (idx: number) => {
    const file = openFiles[idx];
    if (file?.modified && !confirm(`${file.path} 有未保存的修改，确定关闭？`)) return;

    setOpenFiles((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      // 在同一个更新周期内计算正确的 activeFileIdx
      if (next.length === 0) {
        setActiveFileIdx(-1);
      } else if (activeFileIdx > idx) {
        setActiveFileIdx(activeFileIdx - 1);
      } else if (activeFileIdx === idx) {
        // 关闭的是当前活跃文件：切换到前一个，或保持 0
        setActiveFileIdx(Math.min(idx, next.length - 1));
      }
      // activeFileIdx < idx 时无需变动
      return next;
    });
  };

  const handleFileContentChange = (value: string) => {
    if (activeFileIdx < 0) return;
    setOpenFiles((prev) =>
      prev.map((f, i) =>
        i === activeFileIdx
          ? { ...f, content: value, modified: value !== f.originalContent }
          : f
      )
    );
  };

  const handleSaveFile = async () => {
    if (!activeTask || activeFileIdx < 0) return;
    const file = openFiles[activeFileIdx];
    if (!file.modified) return;

    try {
      await axios.post(`/api/github/workspace/${activeTask.id}/file`, {
        path: file.path,
        content: file.content,
      });
      setOpenFiles((prev) =>
        prev.map((f, i) =>
          i === activeFileIdx
            ? { ...f, modified: false, originalContent: f.content }
            : f
        )
      );
      toast.success("已保存");
      loadWorkspaceChanges(activeTask.id);
    } catch (err: any) {
      toast.error("保存失败: " + (err.response?.data?.error || err.message));
    }
  };

  // ═══════ P1: Pull ═══════

  const handlePull = async () => {
    if (!activeTask) return;
    setPulling(true);
    try {
      const { data } = await axios.post(`/api/github/workspace/${activeTask.id}/pull`);
      if (data.success) {
        toast.success(data.message);
        loadWorkspaceFiles(activeTask.id, currentPath);
        loadWorkspaceChanges(activeTask.id);
      } else {
        toast.error(data.message);
        if (data.conflicts?.length) {
          toast.error(`冲突文件: ${data.conflicts.join(", ")}`);
        }
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || "拉取失败");
    }
    setPulling(false);
  };

  // ═══════ Diff ═══════

  const handleViewDiff = async (filePath?: string) => {
    if (!activeTask) return;
    try {
      const params = filePath ? `?path=${encodeURIComponent(filePath)}` : "";
      const { data } = await axios.get(
        `/api/github/workspace/${activeTask.id}/diff${params}`
      );
      setDiffContent(data.diff || "(无变更)");
      setWsTab("diff");
    } catch {}
  };

  // ═══════ 终端 ═══════

  const MAX_TERM_LINES = 500;

  const handleExecCommand = async () => {
    if (!activeTask || !termCmd.trim()) return;
    setTermRunning(true);
    setTermOutput((prev) => [...prev.slice(-MAX_TERM_LINES + 1), `$ ${termCmd}`]);
    try {
      const { data } = await axios.post(`/api/github/workspace/${activeTask.id}/exec`, {
        command: termCmd,
      });
      const output =
        (data.stdout || "") + (data.stderr ? `\n[stderr] ${data.stderr}` : "");
      setTermOutput((prev) => [...prev, output, `[exit code: ${data.exitCode}]`]);
      setTermCmd("");
      loadWorkspaceChanges(activeTask.id);
    } catch (err: any) {
      setTermOutput((prev) => [
        ...prev,
        `[错误] ${err.response?.data?.error || err.message}`,
      ]);
    }
    setTermRunning(false);
    // 自动滚动到底部
    setTimeout(() => termRef.current?.scrollTo(0, termRef.current.scrollHeight), 50);
  };

  // ═══════ P1: AI Commit Message ═══════

  const handleGenerateCommitMsg = async () => {
    if (!activeTask) return;
    setGeneratingMsg(true);
    try {
      const { data } = await axios.post(
        `/api/github/workspace/${activeTask.id}/suggest-commit`
      );
      if (data.message) {
        setCommitMsg(data.message);
        toast.success("已生成提交信息");
      }
    } catch {
      toast.error("生成失败，请手动输入");
    }
    setGeneratingMsg(false);
  };

  // ═══════ 同步 ═══════

  const handleSync = async () => {
    if (!activeTask || !commitMsg.trim()) {
      toast.error("请输入提交信息");
      return;
    }
    setSyncing(true);
    try {
      await axios.post(`/api/github/workspace/${activeTask.id}/sync`, {
        strategy: syncStrategy,
        commitMessage: commitMsg,
        newBranchName: newBranch || undefined,
      });
      toast.success("同步已开始");
      const poll = setInterval(async () => {
        const { data } = await axios.get(
          `/api/github/workspace/${activeTask.id}/status`
        );
        const t = data.task as RepoTask;
        if (t.status === "synced") {
          clearInterval(poll);
          setSyncing(false);
          setActiveTask(t);
          toast.success(t.pullRequestUrl ? "PR 已创建！" : "同步完成！");
          loadTasks();
        } else if (t.status === "error") {
          clearInterval(poll);
          setSyncing(false);
          toast.error(`同步失败: ${t.statusMessage}`);
        }
      }, 3000);
    } catch (err: any) {
      setSyncing(false);
      toast.error(err.response?.data?.error || "同步失败");
    }
  };

  const handleDeleteTask = async (taskId: number) => {
    if (!confirm("确定要删除此工作区？所有未同步的变更将丢失。")) return;
    try {
      await axios.delete(`/api/github/workspace/${taskId}`);
      toast.success("工作区已清理");
      if (activeTask?.id === taskId) {
        setPhase("select");
        setActiveTask(null);
      }
      loadTasks();
    } catch {
      toast.error("清理失败");
    }
  };

  const handleBranchChanged = (newBr: string) => {
    // 检查是否有未保存的文件
    const unsaved = openFiles.filter((f) => f.modified);
    if (unsaved.length > 0) {
      const names = unsaved.map((f) => f.path.split("/").pop()).join(", ");
      if (!confirm(`切换分支将关闭所有编辑器。以下文件有未保存修改:\n${names}\n\n确定继续？`)) {
        return;
      }
    }
    setCurrentBranch(newBr);
    if (activeTask) {
      loadWorkspaceFiles(activeTask.id, "");
      loadWorkspaceChanges(activeTask.id);
      setOpenFiles([]);
      setActiveFileIdx(-1);
    }
  };

  // ═══════ 渲染: 仓库选择 ═══════

  if (phase === "select") {
    return (
      <DashboardLayout>
      <div className="bg-background">
        <div className="container max-w-6xl py-8 space-y-8">
          {/* 标题 */}
          <div className="flex items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon"><ArrowLeft className="h-5 w-5" /></Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Github className="h-6 w-6" /> GitHub 工作区
              </h1>
              <p className="text-muted-foreground text-sm">
                克隆仓库到沙箱编辑测试，完成后同步回 GitHub
              </p>
            </div>
          </div>

          {/* GitHub 连接状态 */}
          {ghConnected === false && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <Link2 className="h-5 w-5 text-amber-600" />
                  <div>
                    <p className="font-medium text-sm">GitHub 未连接</p>
                    <p className="text-xs text-muted-foreground">
                      连接 GitHub 后可以浏览和克隆您的仓库
                    </p>
                  </div>
                </div>
                <Button onClick={handleConnectGitHub} className="gap-2">
                  <Github className="h-4 w-4" /> 连接 GitHub
                </Button>
              </CardContent>
            </Card>
          )}
          {ghConnected === true && ghLogin && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Github className="h-4 w-4" />
              <span>
                已连接: <strong>{ghLogin}</strong>
              </span>
            </div>
          )}

          {/* 已有任务 */}
          {tasks.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Clock className="h-4 w-4" /> 活跃工作区
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {tasks.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <Badge
                        variant={
                          t.status === "ready" || t.status === "synced"
                            ? "default"
                            : t.status === "cloning" || t.status === "syncing"
                            ? "secondary"
                            : "destructive"
                        }
                        className="shrink-0"
                      >
                        {t.status === "ready"
                          ? "就绪"
                          : t.status === "synced"
                          ? "已同步"
                          : t.status === "cloning"
                          ? "克隆中"
                          : t.status === "syncing"
                          ? "同步中"
                          : t.status === "error"
                          ? "错误"
                          : t.status}
                      </Badge>
                      <div className="min-w-0">
                        <p className="font-medium truncate">{t.repoFullName}</p>
                        <p className="text-xs text-muted-foreground">
                          <GitBranch className="inline h-3 w-3 mr-1" />
                          {t.branch}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {t.pullRequestUrl && (
                        <a href={t.pullRequestUrl} target="_blank" rel="noreferrer">
                          <Button variant="outline" size="sm">
                            查看 PR
                          </Button>
                        </a>
                      )}
                      {(t.status === "ready" || t.status === "synced") && (
                        <Button size="sm" onClick={() => handleOpenTask(t)}>
                          <FolderOpen className="h-3 w-3 mr-1" /> 打开
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteTask(t.id)}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {/* 仓库搜索 & 列表 */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">克隆新仓库</CardTitle>
              <CardDescription>选择要克隆到沙箱的 GitHub 仓库</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-10"
                    placeholder="搜索仓库..."
                    value={searchQ}
                    onChange={(e) => setSearchQ(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && loadRepos(searchQ)}
                  />
                </div>
                <Button
                  variant="outline"
                  onClick={() => loadRepos(searchQ)}
                  disabled={loadingRepos}
                >
                  {loadingRepos ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Search className="h-4 w-4" />
                  )}
                </Button>
              </div>

              <div className="space-y-1 max-h-80 overflow-y-auto">
                {repos.map((repo) => (
                  <div
                    key={repo.id}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors hover:bg-muted/50 ${
                      selectedRepo?.id === repo.id ? "border-primary bg-primary/5" : ""
                    }`}
                    onClick={() => handleSelectRepo(repo)}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{repo.full_name}</p>
                      {repo.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {repo.description}
                        </p>
                      )}
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {repo.language && <span>{repo.language}</span>}
                        <span>⭐ {repo.stargazers_count}</span>
                        <span>{(repo.size / 1024).toFixed(1)} MB</span>
                      </div>
                    </div>
                    {repo.private && (
                      <Badge variant="outline" className="shrink-0 text-xs">
                        Private
                      </Badge>
                    )}
                  </div>
                ))}
                {repos.length === 0 && !loadingRepos && (
                  <p className="text-center text-muted-foreground py-8">
                    暂无仓库。请确认已连接 GitHub 账号。
                  </p>
                )}
              </div>

              {selectedRepo && (
                <>
                  <Separator />
                  <div className="flex items-end gap-4">
                    <div className="flex-1">
                      <Label className="text-sm mb-1 block">分支</Label>
                      <Select value={selectedBranch} onValueChange={setSelectedBranch}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {branches.map((b) => (
                            <SelectItem key={b.name} value={b.name}>
                              <GitBranch className="inline h-3 w-3 mr-1" />
                              {b.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      onClick={handleClone}
                      disabled={cloning || !selectedBranch}
                      className="gap-2"
                    >
                      {cloning ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      {cloning ? "克隆中..." : "克隆到沙箱"}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      </DashboardLayout>
    );
  }

  // ═══════ 渲染: 工作区 ═══════

  const activeFile = activeFileIdx >= 0 ? openFiles[activeFileIdx] : null;

  return (
    <DashboardLayout>
    <div className="bg-background">
      <div className="container max-w-7xl py-4 space-y-3">
        {/* ── 顶栏 ── */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                setPhase("select");
                setOpenFiles([]);
                setActiveFileIdx(-1);
              }}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h2 className="font-bold flex items-center gap-2">
                <Github className="h-5 w-5" />
                {activeTask?.repoFullName}
              </h2>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="text-xs">
                  {activeTask?.status === "ready"
                    ? "就绪"
                    : activeTask?.status === "synced"
                    ? "已同步"
                    : activeTask?.status}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* P1: 分支管理 */}
            {activeTask && (
              <BranchManager
                taskId={activeTask.id}
                currentBranch={currentBranch || activeTask.branch}
                onBranchChanged={handleBranchChanged}
              />
            )}

            {/* P1: Pull 按钮 */}
            <Button
              variant="outline"
              size="sm"
              onClick={handlePull}
              disabled={pulling}
              className="gap-1.5"
            >
              {pulling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <ArrowDown className="h-3.5 w-3.5" />
              )}
              Pull
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (activeTask) {
                  loadWorkspaceFiles(activeTask.id, currentPath);
                  loadWorkspaceChanges(activeTask.id);
                }
              }}
            >
              <RefreshCw className="h-3 w-3 mr-1" /> 刷新
            </Button>
          </div>
        </div>

        <div
          className="grid grid-cols-1 lg:grid-cols-3 gap-3"
          style={{ minHeight: "calc(100vh - 130px)" }}
        >
          {/* ── 左侧: 文件树 + 变更 ── */}
          <Card className="lg:col-span-1 flex flex-col">
            <div className="flex border-b">
              {(["files", "changes", "diff", "terminal"] as const).map((tab) => (
                <button
                  key={tab}
                  className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
                    wsTab === tab
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setWsTab(tab);
                    if (tab === "changes" && activeTask)
                      loadWorkspaceChanges(activeTask.id);
                    if (tab === "diff" && activeTask) handleViewDiff();
                  }}
                >
                  {tab === "files"
                    ? "文件"
                    : tab === "changes"
                    ? `变更(${changes.length})`
                    : tab === "diff"
                    ? "Diff"
                    : "终端"}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-2">
              {wsTab === "files" && (
                <div className="space-y-0.5">
                  {currentPath && (
                    <button
                      className="w-full flex items-center gap-2 p-2 rounded text-sm hover:bg-muted transition-colors"
                      onClick={() => {
                        const parent = currentPath
                          .split("/")
                          .slice(0, -1)
                          .join("/");
                        activeTask && loadWorkspaceFiles(activeTask.id, parent);
                      }}
                    >
                      <ArrowLeft className="h-3 w-3" /> ..
                    </button>
                  )}
                  {files.map((f) => (
                    <button
                      key={f.path}
                      className="w-full flex items-center gap-2 p-2 rounded text-sm hover:bg-muted transition-colors text-left"
                      onClick={() => handleOpenFile(f)}
                    >
                      {f.type === "dir" ? (
                        <Folder className="h-4 w-4 text-blue-500 shrink-0" />
                      ) : (
                        <File className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate">{f.name}</span>
                      {f.status && (
                        <Badge variant="outline" className="ml-auto text-xs shrink-0">
                          {f.status}
                        </Badge>
                      )}
                      {f.type === "dir" && (
                        <ChevronRight className="h-3 w-3 ml-auto shrink-0 text-muted-foreground" />
                      )}
                    </button>
                  ))}
                </div>
              )}

              {wsTab === "changes" && (
                <div className="space-y-0.5">
                  {changes.length === 0 && (
                    <p className="text-center text-muted-foreground py-8 text-sm">
                      没有未提交的变更
                    </p>
                  )}
                  {changes.map((c) => (
                    <button
                      key={c.path}
                      className="w-full flex items-center gap-2 p-2 rounded text-sm hover:bg-muted transition-colors text-left"
                      onClick={() => handleViewDiff(c.path)}
                    >
                      <Badge
                        variant={
                          c.status === "M"
                            ? "default"
                            : c.status === "A" || c.status === "?"
                            ? "secondary"
                            : "destructive"
                        }
                        className="text-xs w-6 justify-center shrink-0"
                      >
                        {c.status}
                      </Badge>
                      <span className="truncate">{c.path}</span>
                    </button>
                  ))}
                </div>
              )}

              {wsTab === "diff" && <DiffViewer diff={diffContent} />}

              {wsTab === "terminal" && (
                <div className="flex flex-col h-full">
                  <div
                    ref={termRef}
                    className="flex-1 overflow-y-auto bg-gray-900 rounded-t p-2 font-mono text-xs text-green-400 min-h-[200px] max-h-[50vh]"
                  >
                    {termOutput.length === 0 && (
                      <p className="text-gray-500">
                        输入命令执行，如 npm test, ls, git log 等
                      </p>
                    )}
                    {termOutput.map((line, i) => (
                      <div
                        key={i}
                        className={`whitespace-pre-wrap break-all ${
                          line.startsWith("$")
                            ? "text-cyan-400"
                            : line.startsWith("[错误]") || line.startsWith("[stderr]")
                            ? "text-red-400"
                            : ""
                        }`}
                      >
                        {line}
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Input
                      className="rounded-t-none font-mono text-sm h-9"
                      placeholder="输入命令..."
                      value={termCmd}
                      onChange={(e) => setTermCmd(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" && !termRunning && handleExecCommand()
                      }
                      disabled={termRunning}
                    />
                    <Button
                      size="sm"
                      className="rounded-t-none h-9"
                      onClick={handleExecCommand}
                      disabled={termRunning || !termCmd.trim()}
                    >
                      {termRunning ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Play className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* ── 右侧: 编辑器 + 同步面板 ── */}
          <div className="lg:col-span-2 flex flex-col gap-3">
            {/* 多文件 Tab 栏 */}
            {openFiles.length > 0 && (
              <div className="flex items-center gap-0.5 overflow-x-auto bg-secondary/30 rounded-t-lg px-1 pt-1">
                {openFiles.map((file, idx) => {
                  const fileName = file.path.split("/").pop() || file.path;
                  return (
                    <div
                      key={file.path}
                      className={`flex items-center gap-1 px-3 py-1.5 rounded-t text-xs cursor-pointer transition-colors shrink-0 ${
                        idx === activeFileIdx
                          ? "bg-background text-foreground font-medium"
                          : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                      }`}
                      onClick={() => setActiveFileIdx(idx)}
                    >
                      <FileCode className="h-3 w-3 shrink-0" />
                      <span className="truncate max-w-[120px]">{fileName}</span>
                      {file.modified && (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                      )}
                      <button
                        className="ml-1 opacity-40 hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseFile(idx);
                        }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* 代码编辑器 */}
            <Card className="flex-1 flex flex-col min-h-0">
              {activeFile ? (
                <>
                  <CardHeader className="py-2 px-4 border-b flex-row items-center gap-2">
                    <FileCode className="h-4 w-4 shrink-0" />
                    <span className="text-xs font-mono truncate flex-1">
                      {activeFile.path}
                    </span>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {activeFile.language}
                    </Badge>
                    {activeFile.modified && (
                      <Button
                        size="sm"
                        onClick={handleSaveFile}
                        className="gap-1 h-7 shrink-0"
                      >
                        <Save className="h-3 w-3" />
                        保存
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-hidden">
                    <CodeEditor
                      value={activeFile.content}
                      language={activeFile.language}
                      onChange={handleFileContentChange}
                      onSave={(_) => handleSaveFile()}
                      height="calc(100vh - 380px)"
                    />
                  </CardContent>
                </>
              ) : (
                <CardContent className="flex items-center justify-center h-full min-h-[300px]">
                  <div className="text-center text-muted-foreground">
                    <Eye className="h-12 w-12 mx-auto mb-2 opacity-20" />
                    <p className="text-sm">点击左侧文件查看和编辑内容</p>
                    <p className="text-xs mt-1 opacity-60">支持语法高亮、代码折叠、Ctrl+S 保存</p>
                  </div>
                </CardContent>
              )}
            </Card>

            {/* 同步面板 */}
            <Card>
              <CardHeader className="py-3 px-4">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Upload className="h-4 w-4" /> 同步到 GitHub
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs mb-1 block">同步策略</Label>
                    <Select value={syncStrategy} onValueChange={setSyncStrategy}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="create_pr">
                          创建 Pull Request (推荐)
                        </SelectItem>
                        <SelectItem value="push_new_branch">推送到新分支</SelectItem>
                        <SelectItem value="push_direct">直接推送到源分支</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {syncStrategy !== "push_direct" && (
                    <div>
                      <Label className="text-xs mb-1 block">新分支名</Label>
                      <Input
                        className="h-9"
                        placeholder={`sandbox/${currentBranch || activeTask?.branch || "main"}-patch`}
                        value={newBranch}
                        onChange={(e) => setNewBranch(e.target.value)}
                      />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <Label className="text-xs">提交信息</Label>
                    {/* P1: AI 生成按钮 */}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 text-xs gap-1 text-muted-foreground hover:text-foreground"
                      onClick={handleGenerateCommitMsg}
                      disabled={generatingMsg || changes.length === 0}
                    >
                      {generatingMsg ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Sparkles className="h-3 w-3" />
                      )}
                      AI 生成
                    </Button>
                  </div>
                  <Textarea
                    rows={2}
                    placeholder="描述你的变更..."
                    value={commitMsg}
                    onChange={(e) => setCommitMsg(e.target.value)}
                  />
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">
                    {changes.length} 个文件变更
                  </span>
                  <Button
                    onClick={handleSync}
                    disabled={syncing || changes.length === 0}
                    className="gap-2"
                  >
                    {syncing ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="h-4 w-4" />
                    )}
                    {syncing ? "同步中..." : "同步到 GitHub"}
                  </Button>
                </div>

                {activeTask?.pullRequestUrl && (
                  <div className="flex items-center gap-2 p-2 rounded bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
                    <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                    <a
                      href={activeTask.pullRequestUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-green-700 dark:text-green-400 hover:underline truncate"
                    >
                      {activeTask.pullRequestUrl}
                    </a>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
    </DashboardLayout>
  );
}
