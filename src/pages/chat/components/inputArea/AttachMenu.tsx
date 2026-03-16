/**
 * AttachMenu — "+" 按钮弹出的功能菜单
 *
 * 修复：
 *  - hasArrow 按钮 onClick 加 e.stopPropagation()，防止冒泡到 document 触发 handleClose
 *  - 用透明遮罩层替代 document.addEventListener，更可靠
 *  - /api/github/tasks 500 容错处理
 */

import { useRef, useState } from 'react';
import {
  Image as ImageIcon, FileText, Camera, BookOpen, Github,
  ChevronLeft, Loader2, GitBranch, FolderOpen, Search, X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { trpc } from '@/lib/trpc';
import axios from 'axios';
import type { SelectedKB } from '@/components/KnowledgeBasePicker';
import type { SelectedGitHubRepo } from '@/components/GitHubRepoPicker';

interface AttachMenuProps {
  open: boolean;
  onClose: () => void;
  onImageAttachment: () => void;
  onFileAttachment: () => void;
  onCamera: () => void;
  t: (key: string) => string;
  selectedKB?: SelectedKB | null;
  onKBSelect?: (kb: SelectedKB | null) => void;
  selectedGitHubRepo?: SelectedGitHubRepo | null;
  onGitHubRepoSelect?: (repo: SelectedGitHubRepo | null) => void;
}

type SubPanel = null | 'kb' | 'github';
type GHTab = 'workspaces' | 'repos';

export function AttachMenu({
  open, onClose,
  onImageAttachment, onFileAttachment, onCamera, t,
  selectedKB, onKBSelect,
  selectedGitHubRepo, onGitHubRepoSelect,
}: AttachMenuProps) {
  const [sub, setSub] = useState<SubPanel>(null);
  const [ghTab, setGhTab] = useState<GHTab>('workspaces');
  const [ghSearch, setGhSearch] = useState('');
  const [ghTasks, setGhTasks] = useState<any[]>([]);
  const [ghRepos, setGhRepos] = useState<any[]>([]);
  const [ghError, setGhError] = useState<string | null>(null);
  const [ghConnected, setGhConnected] = useState<boolean | null>(null);
  const [loadingTasks, setLoadingTasks] = useState(false);
  const [loadingRepos, setLoadingRepos] = useState(false);

  // KB 数据
  const { data: kbs, isLoading: kbLoading } = trpc.knowledgeBase.list.useQuery(undefined, {
    enabled: open && sub === 'kb',
  });

  // 打开 GitHub 子面板时加载
  function openGitHub() {
    setSub('github');
    loadGHTasks();
    checkGHConnection();
  }

  async function checkGHConnection() {
    try {
      const { data } = await axios.get('/api/github/connection');
      setGhConnected(data.connected);
    } catch { setGhConnected(false); }
  }

  async function loadGHTasks() {
    setLoadingTasks(true);
    setGhError(null);
    try {
      const { data } = await axios.get('/api/github/tasks');
      setGhTasks((data.tasks || []).filter((t: any) => t.status === 'ready'));
    } catch (err: any) {
      setGhError(err?.response?.data?.error || err.message || '加载失败');
      setGhTasks([]);
    } finally {
      setLoadingTasks(false);
    }
  }

  async function loadGHRepos() {
    setLoadingRepos(true);
    try {
      const { data } = await axios.get('/api/github/repos?limit=30');
      setGhRepos(data.repos || []);
    } catch { setGhRepos([]); }
    finally { setLoadingRepos(false); }
  }

  function handleClose() { setSub(null); onClose(); }

  function selectKB(kb: any) {
    onKBSelect?.(selectedKB?.id === kb.id ? null : { id: kb.id, name: kb.name });
    handleClose();
  }
  function selectGHTask(task: any) {
    onGitHubRepoSelect?.({ taskId: task.id, fullName: task.repoFullName, branch: task.branch });
    handleClose();
  }
  function selectGHRepo(repo: any) {
    onGitHubRepoSelect?.({ fullName: repo.full_name, branch: repo.default_branch });
    handleClose();
  }

  if (!open) return null;

  const mainItems = [
    {
      icon: ImageIcon, label: t('chat.attachMenu.image'), hint: t('chat.attachMenu.imageHint'),
      color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 dark:bg-violet-950/40',
      onClick: () => { onImageAttachment(); handleClose(); },
      mobileOnly: false, hasArrow: false,
    },
    {
      icon: FileText, label: t('chat.attachMenu.file'), hint: t('chat.attachMenu.fileHint'),
      color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-950/40',
      onClick: () => { onFileAttachment(); handleClose(); },
      mobileOnly: false, hasArrow: false,
    },
    {
      icon: Camera, label: t('chat.attachMenu.camera'), hint: t('chat.attachMenu.cameraHint'),
      color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/40',
      onClick: () => { onCamera(); handleClose(); },
      mobileOnly: true, hasArrow: false,
    },
    ...(onKBSelect ? [{
      icon: BookOpen,
      label: selectedKB ? `知识库：${selectedKB.name}` : '关联知识库',
      hint: selectedKB ? '已关联，点击更换' : '在对话中引用知识库',
      color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/40',
      active: !!selectedKB,
      onClick: () => setSub('kb'),   // ← 只切换子面板，不关菜单
      mobileOnly: false, hasArrow: true,
    }] : []),
    ...(onGitHubRepoSelect ? [{
      icon: Github,
      label: selectedGitHubRepo ? `GitHub：${selectedGitHubRepo.fullName.split('/')[1]}` : '绑定 GitHub 仓库',
      hint: selectedGitHubRepo ? `${selectedGitHubRepo.fullName}@${selectedGitHubRepo.branch}` : 'AI 读取/操作代码库',
      color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-800/60',
      active: !!selectedGitHubRepo,
      onClick: () => openGitHub(),   // ← 只切换子面板，不关菜单
      mobileOnly: false, hasArrow: true,
    }] : []),
  ];

  const filteredTasks = ghTasks.filter(t => t.repoFullName.toLowerCase().includes(ghSearch.toLowerCase()));
  const filteredRepos = ghRepos.filter(r => r.full_name.toLowerCase().includes(ghSearch.toLowerCase()));

  return (
    <>
      {/* 透明遮罩：点击外部关闭 */}
      <div
        className="fixed inset-0 z-40"
        onClick={handleClose}
      />

      {/* 菜单主体 */}
      <div
        className="absolute bottom-full left-0 mb-2 w-60 bg-popover border border-border rounded-xl shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2 duration-150 overflow-hidden"
        onClick={(e) => e.stopPropagation()}  // ← 菜单内部阻止冒泡到遮罩
      >
        {/* ── 子面板：知识库 ── */}
        {sub === 'kb' && (
          <div>
            <div className="px-2 pt-2 pb-1">
              <button type="button" onClick={() => setSub(null)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2">
                <ChevronLeft className="h-3.5 w-3.5" />返回
              </button>
              <p className="text-xs font-medium px-1 pb-1">选择知识库</p>
            </div>
            <div className="max-h-[200px] overflow-y-auto px-1.5 pb-2">
              {kbLoading ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              ) : !kbs || (kbs as any[]).length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">暂无知识库</p>
              ) : (
                <div className="space-y-0.5">
                  {selectedKB && (
                    <button type="button"
                      onClick={() => { onKBSelect?.(null); handleClose(); }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-muted transition-colors text-muted-foreground">
                      <X className="h-3.5 w-3.5" />取消关联
                    </button>
                  )}
                  {(kbs as any[]).map((kb: any) => (
                    <button key={kb.id} type="button" onClick={() => selectKB(kb)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left hover:bg-muted transition-colors",
                        selectedKB?.id === kb.id && "bg-muted"
                      )}>
                      <BookOpen className="h-3.5 w-3.5 text-emerald-500 flex-shrink-0" />
                      <span className="flex-1 truncate text-xs font-medium">{kb.name}</span>
                      <span className="text-[10px] text-muted-foreground">{kb.chunkCount}片段</span>
                      {selectedKB?.id === kb.id && <span className="text-[10px] text-emerald-500">✓</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── 子面板：GitHub ── */}
        {sub === 'github' && (
          <div>
            <div className="px-2 pt-2 pb-1">
              <button type="button" onClick={() => setSub(null)}
                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-1.5">
                <ChevronLeft className="h-3.5 w-3.5" />返回
              </button>
              <p className="text-xs font-medium px-1 pb-1 flex items-center gap-1.5">
                <Github className="h-3.5 w-3.5" />绑定 GitHub 仓库
              </p>
            </div>
            {/* Tab */}
            <div className="flex border-b border-border mx-2 mb-2">
              {(['workspaces', 'repos'] as GHTab[]).map(tab => (
                <button key={tab} type="button"
                  className={cn(
                    "text-[11px] pb-1.5 px-2 border-b-2 -mb-px transition-colors flex items-center gap-1",
                    ghTab === tab
                      ? "border-primary text-foreground font-medium"
                      : "border-transparent text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => {
                    setGhTab(tab);
                    if (tab === 'repos' && ghConnected === true && ghRepos.length === 0) loadGHRepos();
                  }}>
                  {tab === 'workspaces'
                    ? <><FolderOpen className="h-3 w-3" />已克隆</>
                    : <><GitBranch className="h-3 w-3" />仓库</>}
                </button>
              ))}
            </div>
            {/* 搜索 */}
            <div className="px-2 pb-2">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                <input value={ghSearch} onChange={e => setGhSearch(e.target.value)}
                  placeholder="搜索..." type="text"
                  className="w-full h-7 text-xs pl-7 pr-2 rounded-md border border-input bg-background focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
            </div>
            {/* 内容 */}
            <div className="max-h-[190px] overflow-y-auto px-1.5 pb-2">
              {ghTab === 'workspaces' ? (
                loadingTasks ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : ghError ? (
                  <div className="text-center py-4 text-[11px] text-muted-foreground">
                    <p className="text-red-500 mb-1">加载失败</p>
                    <p className="opacity-70 mb-2">{ghError}</p>
                    <button type="button" className="text-primary underline" onClick={loadGHTasks}>重试</button>
                  </div>
                ) : filteredTasks.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-muted-foreground">
                    <FolderOpen className="h-5 w-5 mx-auto mb-1.5 opacity-40" />
                    {ghTasks.length === 0 ? '暂无已克隆仓库' : '没有匹配结果'}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {selectedGitHubRepo && (
                      <button type="button"
                        onClick={() => { onGitHubRepoSelect?.(null); handleClose(); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-muted transition-colors text-muted-foreground">
                        <X className="h-3.5 w-3.5" />取消绑定
                      </button>
                    )}
                    {filteredTasks.map(task => (
                      <button key={task.id} type="button" onClick={() => selectGHTask(task)}
                        className={cn(
                          "w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left hover:bg-muted transition-colors",
                          selectedGitHubRepo?.taskId === task.id && "bg-muted"
                        )}>
                        <Github className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-xs font-medium">{task.repoFullName}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <GitBranch className="h-2.5 w-2.5" />{task.branch}
                            <span className="text-green-500 ml-1">✓</span>
                          </div>
                        </div>
                        {selectedGitHubRepo?.taskId === task.id && <span className="text-[10px] text-primary">✓</span>}
                      </button>
                    ))}
                  </div>
                )
              ) : (
                ghConnected === false ? (
                  <div className="text-center py-6 text-[11px] text-muted-foreground">
                    <Github className="h-5 w-5 mx-auto mb-1.5 opacity-40" />未连接 GitHub<br />
                    <button type="button" className="text-primary underline mt-1"
                      onClick={() => { window.location.href = '/api/github/login'; }}>立即连接</button>
                  </div>
                ) : loadingRepos ? (
                  <div className="flex justify-center py-6">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredRepos.length === 0 ? (
                  <div className="text-center py-6 text-[11px] text-muted-foreground">
                    {ghRepos.length === 0 ? '没有可用仓库' : '没有匹配结果'}
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {selectedGitHubRepo && !selectedGitHubRepo.taskId && (
                      <button type="button"
                        onClick={() => { onGitHubRepoSelect?.(null); handleClose(); }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-xs hover:bg-muted transition-colors text-muted-foreground">
                        <X className="h-3.5 w-3.5" />取消绑定
                      </button>
                    )}
                    {filteredRepos.map(repo => (
                      <button key={repo.id} type="button" onClick={() => selectGHRepo(repo)}
                        className="w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left hover:bg-muted transition-colors">
                        <Github className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="truncate text-xs font-medium">{repo.full_name}</div>
                          <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <GitBranch className="h-2.5 w-2.5" />{repo.default_branch}
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
          </div>
        )}

        {/* ── 主菜单 ── */}
        {sub === null && (
          <>
            <div className="p-1.5">
              {mainItems.map((item, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();  // ← 关键：阻止冒泡，防止遮罩/外部关闭
                    item.onClick();
                  }}
                  className={cn(
                    "flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-left transition-colors hover:bg-accent",
                    item.mobileOnly && "md:hidden",
                    item.active && "bg-accent/50"
                  )}
                >
                  <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0", item.bg)}>
                    <item.icon className={cn("h-4 w-4", item.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{item.label}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{item.hint}</div>
                  </div>
                  {item.hasArrow && (
                    <ChevronLeft className="h-3.5 w-3.5 text-muted-foreground rotate-180 flex-shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="border-t border-border mx-1.5" />
            <div className="px-4 py-2.5 text-[11px] text-muted-foreground">
              💡 {t('chat.attachMenu.dragHint')}
            </div>
          </>
        )}
      </div>
    </>
  );
}
