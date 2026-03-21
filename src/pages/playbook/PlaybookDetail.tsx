/**
 * pages/playbook/PlaybookDetail.tsx — Playbook 详情 + 运行 + 评分
 *
 * ★ 新增: 运行前费用预估、审批状态展示
 */
import { useState, useMemo } from "react";
import {
  ArrowLeft, Play, GitFork, Star, Edit, Trash2, Clock,
  Zap, Wrench, Loader2, CheckCircle, XCircle, Timer,
  Coins, Copy, Settings, AlertCircle, FileText, Send,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

interface Props { id: string; onBack: () => void; }

/** 审核备注显示（兼容纯文本和 AI JSON 格式） */
function ReviewNoteDisplay({ note }: { note: string }) {
  let aiData: any = null;
  try {
    const parsed = JSON.parse(note);
    if (parsed && parsed.ai) aiData = parsed;
  } catch {}

  if (aiData) {
    return (
      <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200">
        <p className="text-xs font-medium text-red-700 flex items-center gap-1">
          <XCircle className="w-3.5 h-3.5" /> AI 审核未通过 (评分 {String(aiData.score)}/100)
        </p>
        <p className="text-xs text-red-600 mt-1">{String(aiData.summary || "")}</p>
        {Array.isArray(aiData.issues) && aiData.issues.length > 0 && (
          <div className="mt-1.5 space-y-0.5">
            {aiData.issues.slice(0, 5).map((issue: any, i: number) => (
              <p key={i} className="text-[10px] text-red-500">
                {issue.severity === "error" ? "❌" : "⚠️"} {String(issue.message || "")}
              </p>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 p-2.5 rounded-lg bg-red-50 border border-red-200">
      <p className="text-xs text-red-600 flex items-start gap-1">
        <XCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
        <span>驳回原因：{note}</span>
      </p>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "草稿", color: "text-gray-500 bg-gray-100" },
  pending_review: { label: "审核中", color: "text-amber-600 bg-amber-50 border border-amber-200" },
  published: { label: "已发布", color: "text-green-600 bg-green-50" },
  rejected: { label: "已驳回", color: "text-red-600 bg-red-50 border border-red-200" },
  archived: { label: "已归档", color: "text-gray-400 bg-gray-50" },
};

export function PlaybookDetail({ id, onBack }: Props) {
  const [, navigate] = useLocation();
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [runParams, setRunParams] = useState<Record<string, any>>({});
  const [ratingScore, setRatingScore] = useState(5);
  const [ratingComment, setRatingComment] = useState("");

  // ★ 桌面授权状态
  const [desktopStatus, setDesktopStatus] = useState<{ connected: boolean; authorized: boolean } | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const detailQuery = trpc.playbook.detail.useQuery({ id });
  const runMut = trpc.playbook.run.useMutation({ onSuccess: (r) => { navigate(`/agent/${r.taskId}`); } });
  const forkMut = trpc.playbook.fork.useMutation({ onSuccess: (r) => navigate(`/playbooks/${r.id}/edit`) });
  const rateMut = trpc.playbook.rate.useMutation({ onSuccess: () => { detailQuery.refetch(); setShowRatingDialog(false); } });
  const deleteMut = trpc.playbook.delete.useMutation({ onSuccess: () => onBack() });

  // ★ 费用预估
  const estimateQuery = trpc.playbook.estimate.useQuery({ id }, { enabled: showRunDialog });

  const pb = detailQuery.data;
  if (!pb) return <div className="p-10 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-30" /></div>;

  const steps = pb.steps || [];
  const parameters = pb.parameters || [];
  const price = parseFloat(pb.price as any) || 0;
  const statusInfo = STATUS_MAP[pb.status] || STATUS_MAP.draft;

  // ★ 桌面 Playbook 授权检查
  const isDesktopPlaybook = pb.category === "desktop";
  const checkDesktopAuth = async () => {
    try {
      const res = await fetch("/api/desktop/status", { credentials: "include" });
      if (res.ok) setDesktopStatus(await res.json());
    } catch {}
  };
  const handleAuthorize = async () => {
    setAuthLoading(true);
    try {
      const res = await fetch("/api/desktop/authorize", { method: "POST", credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        if (data.success) setDesktopStatus(prev => prev ? { ...prev, authorized: true } : null);
      }
    } catch {} finally { setAuthLoading(false); }
  };

  // 初始化参数默认值
  const initParams = () => {
    const p: Record<string, any> = {};
    for (const param of parameters) { p[param.key] = param.default || ""; }
    setRunParams(p);
  };

  const handleRun = () => {
    runMut.mutate({ playbookId: id, params: runParams });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      {/* 顶栏 */}
      <button onClick={onBack} className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ArrowLeft className="w-4 h-4" /> 返回市场
      </button>

      {/* 标题区 */}
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-start gap-3">
          <span className="text-4xl">{pb.icon}</span>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold">{pb.title}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">{pb.description}</p>
            <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
              <span className="bg-muted px-2 py-0.5 rounded">{pb.category}</span>
              {pb.rating && <span className="flex items-center gap-0.5"><Star className="w-3 h-3 text-amber-400 fill-amber-400" />{pb.rating} ({pb.ratingCount})</span>}
              <span className="flex items-center gap-0.5"><Play className="w-3 h-3" />{pb.runCount} 次运行</span>
              <span className="flex items-center gap-0.5"><GitFork className="w-3 h-3" />{pb.forkCount} 次 Fork</span>
              {price > 0 && <span className="font-medium text-amber-600"><Coins className="w-3 h-3 inline" /> {price} 🐟/次</span>}
              {pb.isOfficial && <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">官方模板</span>}
            </div>
            {pb.tags?.length > 0 && (
              <div className="flex gap-1 mt-2">{(pb.tags as string[]).map(t => <span key={t} className="text-[10px] bg-muted px-2 py-0.5 rounded">{t}</span>)}</div>
            )}

            {/* ★ 驳回原因 / AI 审核结果 */}
            {pb.status === "rejected" && (pb as any).reviewNote && (
              <ReviewNoteDisplay note={String((pb as any).reviewNote)} />
            )}
          </div>
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => { initParams(); setShowRunDialog(true); if (pb?.category === "desktop") checkDesktopAuth(); }}
            disabled={pb.status !== "published" && !pb.isOfficial}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1.5 shadow-lg shadow-primary/20"
          >
            <Play className="w-4 h-4" /> 运行
          </button>
          <button onClick={() => forkMut.mutate({ id })} className="px-3 py-2 border rounded-xl text-sm hover:bg-muted flex items-center gap-1.5">
            <GitFork className="w-4 h-4" /> Fork
          </button>
          <button onClick={() => setShowRatingDialog(true)} className="px-3 py-2 border rounded-xl text-sm hover:bg-muted flex items-center gap-1.5">
            <Star className="w-4 h-4" /> 评分
          </button>
          {!pb.isOfficial && (
            <>
              <button onClick={() => navigate(`/playbooks/${id}/edit`)} className="px-3 py-2 border rounded-xl text-sm hover:bg-muted flex items-center gap-1.5">
                <Edit className="w-4 h-4" /> 编辑
              </button>
              <button
                onClick={() => { if (confirm("确定要删除此 Playbook？此操作不可撤销。")) deleteMut.mutate({ id }); }}
                disabled={deleteMut.isPending}
                className="px-3 py-2 border border-red-200 rounded-xl text-sm text-red-500 hover:bg-red-50 flex items-center gap-1.5 disabled:opacity-50"
              >
                <Trash2 className="w-4 h-4" /> {deleteMut.isPending ? "删除中..." : "删除"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* 步骤列表 */}
      <div className="rounded-2xl border bg-card p-5 mb-6">
        <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Zap className="w-4 h-4 text-amber-500" /> 执行步骤</h2>
        <div className="space-y-2">
          {steps.map((step: any, i: number) => (
            <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
              <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{step.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{step.toolId}</span>
                  {step.condition && <span className="text-xs text-amber-600">条件: {step.condition}</span>}
                  <span className="text-xs text-muted-foreground">错误策略: {step.onError}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 参数说明 */}
      {parameters.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 mb-6">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Settings className="w-4 h-4 text-blue-500" /> 可配置参数</h2>
          <div className="space-y-2">
            {parameters.map((p: any) => (
              <div key={p.key} className="flex items-center justify-between p-2 rounded-lg bg-muted/30">
                <div>
                  <span className="text-sm font-medium">{p.label}</span>
                  {p.required && <span className="text-red-500 text-xs ml-1">*</span>}
                  {p.description && <p className="text-xs text-muted-foreground">{p.description}</p>}
                </div>
                <span className="text-xs bg-muted px-2 py-0.5 rounded font-mono">{p.type}{p.default ? ` = ${p.default}` : ""}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 执行历史 */}
      {pb.recentRuns?.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 mb-6">
          <h2 className="font-bold text-sm mb-3 flex items-center gap-2"><Clock className="w-4 h-4 text-gray-500" /> 最近执行</h2>
          <div className="space-y-1.5">
            {pb.recentRuns.map((run: any) => (
              <div key={run.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/30">
                <div className="flex items-center gap-2">
                  {run.status === "completed" ? <CheckCircle className="w-3.5 h-3.5 text-green-500" /> : <XCircle className="w-3.5 h-3.5 text-red-500" />}
                  <span>{run.triggerType}</span>
                  <span className="text-muted-foreground">{new Date(run.startedAt).toLocaleString("zh-CN")}</span>
                </div>
                <div className="flex items-center gap-2">
                  {run.durationMs && <span><Timer className="w-3 h-3 inline" /> {(run.durationMs / 1000).toFixed(0)}s</span>}
                  {run.agentTaskId && (
                    <button onClick={() => navigate(`/agent/${run.agentTaskId}`)} className="text-primary hover:underline">查看详情</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ 运行对话框 ═══ */}
      {showRunDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowRunDialog(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-md mx-4 p-5 border" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Play className="w-5 h-5 text-primary" /> 运行 {pb.title}</h3>

            {/* 动态参数表单 */}
            {parameters.length > 0 ? (
              <div className="space-y-3 mb-4 max-h-[40vh] overflow-y-auto">
                {parameters.map((p: any) => (
                  <div key={p.key}>
                    <label className="text-xs font-medium mb-1 block">
                      {p.label} {p.required && <span className="text-red-500">*</span>}
                    </label>
                    {p.type === "textarea" ? (
                      <textarea
                        value={runParams[p.key] || ""}
                        onChange={e => setRunParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                        placeholder={p.placeholder}
                        className="w-full p-2 rounded-lg border bg-background text-sm h-20 resize-none"
                      />
                    ) : p.type === "select" ? (
                      <select
                        value={runParams[p.key] || ""}
                        onChange={e => setRunParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                        className="w-full p-2 rounded-lg border bg-background text-sm"
                      >
                        <option value="">选择...</option>
                        {(p.options || []).map((o: string) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    ) : p.type === "boolean" ? (
                      <label className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={!!runParams[p.key]}
                          onChange={e => setRunParams(prev => ({ ...prev, [p.key]: e.target.checked }))}
                          className="rounded"
                        />
                        <span className="text-sm">{p.description || "启用"}</span>
                      </label>
                    ) : (
                      <input
                        type={p.type === "number" ? "number" : "text"}
                        value={runParams[p.key] || ""}
                        onChange={e => setRunParams(prev => ({ ...prev, [p.key]: e.target.value }))}
                        placeholder={p.placeholder}
                        className="w-full p-2 rounded-lg border bg-background text-sm"
                      />
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground mb-4">此 Playbook 无需配置参数，直接运行即可。</p>
            )}

            {/* ★ 费用预估区域 */}
            {estimateQuery.data && (
              <div className="rounded-xl bg-muted/40 p-3 mb-4">
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1"><Coins className="w-3 h-3" /> 费用预估</p>
                <div className="flex items-center justify-between text-sm">
                  <div className="space-y-0.5">
                    {estimateQuery.data.playbookPrice > 0 && (
                      <p className="text-xs">Playbook 费用: <span className="font-medium text-amber-600">{estimateQuery.data.playbookPrice} 🐟</span></p>
                    )}
                    <p className="text-xs">Agent 运行预估: <span className="font-medium text-blue-600">~{estimateQuery.data.estimatedAgentCost} 🐟</span></p>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-primary">~{estimateQuery.data.totalEstimate} 🐟</p>
                    <p className="text-[10px] text-muted-foreground">预估总计</p>
                  </div>
                </div>
                {estimateQuery.data.breakdown.length > 0 && (
                  <div className="mt-2 pt-2 border-t space-y-0.5">
                    {estimateQuery.data.breakdown.map((b: any) => (
                      <div key={b.category} className="flex items-center justify-between text-[10px] text-muted-foreground">
                        <span className="font-mono">{b.category}</span>
                        <span>{b.count}×{b.unitCost}={b.subtotal}🐟</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* ★ 桌面授权提示 */}
            {isDesktopPlaybook && desktopStatus && !desktopStatus.authorized && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3 mb-4">
                <p className="text-xs text-amber-700 dark:text-amber-400 mb-2">
                  {desktopStatus.connected
                    ? "⚠️ 桌面客户端已连接，但未授权 AI 控制桌面"
                    : "❌ 桌面客户端未连接，请先启动 Insi Desktop Agent"}
                </p>
                {desktopStatus.connected && (
                  <button
                    onClick={handleAuthorize}
                    disabled={authLoading}
                    className="px-4 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 disabled:opacity-50"
                  >
                    {authLoading ? "授权中..." : "✓ 授权 AI 控制桌面"}
                  </button>
                )}
              </div>
            )}
            {isDesktopPlaybook && desktopStatus?.authorized && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-3">✓ 桌面已授权，可以运行</p>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRunDialog(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">取消</button>
              <button
                onClick={handleRun}
                disabled={runMut.isPending || (isDesktopPlaybook && (!desktopStatus?.connected || !desktopStatus?.authorized))}
                className="px-5 py-2 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
              >
                {runMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                开始执行{estimateQuery.data ? ` (~${estimateQuery.data.totalEstimate}🐟)` : ""}
              </button>
            </div>

            {runMut.error && <p className="text-xs text-red-500 mt-2">{runMut.error.message}</p>}
          </div>
        </div>
      )}

      {/* ═══ 评分对话框 ═══ */}
      {showRatingDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowRatingDialog(false)}>
          <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 border" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-base mb-4 flex items-center gap-2"><Star className="w-5 h-5 text-amber-400" /> 评价 {pb.title}</h3>
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRatingScore(s)}>
                  <Star className={`w-6 h-6 transition-colors ${s <= ratingScore ? "text-amber-400 fill-amber-400" : "text-gray-300"}`} />
                </button>
              ))}
              <span className="text-sm ml-2">{ratingScore}/5</span>
            </div>
            <textarea
              value={ratingComment}
              onChange={e => setRatingComment(e.target.value)}
              placeholder="写一句评语（可选）"
              className="w-full p-2 rounded-lg border bg-background text-sm h-16 resize-none mb-3"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowRatingDialog(false)} className="px-4 py-2 text-sm text-muted-foreground">取消</button>
              <button
                onClick={() => rateMut.mutate({ playbookId: id, score: ratingScore, comment: ratingComment || undefined })}
                disabled={rateMut.isPending}
                className="px-4 py-2 bg-amber-500 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                提交评分
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
