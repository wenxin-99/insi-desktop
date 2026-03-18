/**
 * pages/admin/PlaybookApprovals.tsx — Playbook 审批管理
 *
 * 管理员审核用户提交的 Playbook：通过 / 驳回 / 查看详情
 */
import { useState } from "react";
import {
  CheckCircle, XCircle, Eye, Loader2, Clock, Play,
  Star, Zap, Settings, Store, AlertCircle, Inbox,
} from "lucide-react";
import { trpc } from "@/lib/trpc";
import DashboardLayout from "@/components/DashboardLayout";

/** AI 预审结果面板 */
function AIPreReviewPanel({ reviewNote }: { reviewNote?: string | null }) {
  if (!reviewNote) return null;
  let aiReview: any = null;
  try {
    const parsed = JSON.parse(String(reviewNote));
    if (parsed && parsed.ai) aiReview = parsed;
  } catch {}
  if (!aiReview) return null;

  return (
    <div className="mb-4 rounded-xl border bg-muted/30 p-3">
      <h3 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1">🤖 AI 预审结果</h3>
      <div className="grid grid-cols-4 gap-2 text-center mb-2">
        <div className={`p-1.5 rounded-lg ${Number(aiReview.score) >= 80 ? "bg-green-50" : Number(aiReview.score) <= 30 ? "bg-red-50" : "bg-amber-50"}`}>
          <p className="text-sm font-bold">{String(aiReview.score)}</p>
          <p className="text-[9px] text-muted-foreground">综合</p>
        </div>
        <div className={`p-1.5 rounded-lg ${Number(aiReview.safetyScore) >= 70 ? "bg-green-50" : "bg-red-50"}`}>
          <p className="text-sm font-bold">{String(aiReview.safetyScore)}</p>
          <p className="text-[9px] text-muted-foreground">安全</p>
        </div>
        <div className="p-1.5 rounded-lg bg-blue-50">
          <p className="text-sm font-bold">{String(aiReview.qualityScore)}</p>
          <p className="text-[9px] text-muted-foreground">质量</p>
        </div>
        <div className="p-1.5 rounded-lg bg-purple-50">
          <p className="text-sm font-bold">{String(aiReview.policyScore)}</p>
          <p className="text-[9px] text-muted-foreground">政策</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mb-1">{String(aiReview.summary || "")}</p>
      {Array.isArray(aiReview.issues) && aiReview.issues.length > 0 && (
        <div className="space-y-0.5 mt-1.5">
          {aiReview.issues.map((issue: any, i: number) => (
            <p key={i} className={`text-[10px] flex items-start gap-1 ${
              issue.severity === "error" ? "text-red-600" :
              issue.severity === "warning" ? "text-amber-600" : "text-gray-400"
            }`}>
              <span>{issue.severity === "error" ? "❌" : issue.severity === "warning" ? "⚠️" : "ℹ️"}</span>
              <span>{String(issue.message || "")}</span>
            </p>
          ))}
        </div>
      )}
      <p className={`text-[10px] font-medium mt-2 ${
        aiReview.decision === "auto_approve" ? "text-green-600" :
        aiReview.decision === "auto_reject" ? "text-red-600" : "text-amber-600"
      }`}>
        AI 建议: {aiReview.decision === "auto_approve" ? "通过" :
                  aiReview.decision === "auto_reject" ? "驳回" : "需人工审核"}
      </p>
    </div>
  );
}

export default function PlaybookApprovals() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [rejectNote, setRejectNote] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState<string | null>(null);

  const pendingQuery = trpc.playbook.pendingList.useQuery();
  const approveMut = trpc.playbook.approve.useMutation({
    onSuccess: () => { pendingQuery.refetch(); setSelectedId(null); },
  });
  const rejectMut = trpc.playbook.reject.useMutation({
    onSuccess: () => { pendingQuery.refetch(); setShowRejectDialog(null); setRejectNote(""); },
  });

  const detailQuery = trpc.playbook.detail.useQuery(
    { id: selectedId! },
    { enabled: !!selectedId },
  );

  const pbs = pendingQuery.data || [];

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Store className="w-5 h-5 text-primary" />
              Playbook 审批
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              审核用户提交的 Playbook，通过后将公开到市场
            </p>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50 text-amber-600 font-medium">
              <Clock className="w-3.5 h-3.5" /> {pbs.length} 待审核
            </span>
          </div>
        </div>

        {pendingQuery.isLoading ? (
          <div className="text-center py-20"><Loader2 className="w-8 h-8 animate-spin mx-auto opacity-30" /></div>
        ) : pbs.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <Inbox className="w-16 h-16 mx-auto mb-4 opacity-10" />
            <p className="font-medium">暂无待审核的 Playbook</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr] gap-6">
            {/* 左侧：待审列表 */}
            <div className="space-y-3">
              {pbs.map((pb: any) => {
                const steps = pb.steps || [];
                return (
                  <div
                    key={pb.id}
                    onClick={() => setSelectedId(pb.id)}
                    className={`rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                      selectedId === pb.id ? "border-primary bg-primary/5" : "bg-card"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">{pb.icon}</span>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-sm">{pb.title}</h3>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{pb.description}</p>
                        <div className="flex items-center gap-2 mt-2 text-[10px] text-muted-foreground">
                          <span className="bg-muted px-1.5 py-0.5 rounded">{pb.category}</span>
                          <span>{steps.length} 步骤</span>
                          <span>用户#{pb.userId}</span>
                          <span>{new Date(pb.updatedAt).toLocaleDateString("zh-CN")}</span>
                        </div>
                        {/* AI 预审分数 */}
                        {(pb as any).aiReview && (
                          <div className={`mt-1.5 flex items-center gap-1.5 text-[10px] font-medium ${
                            (pb as any).aiReview.score >= 80 ? "text-green-600" :
                            (pb as any).aiReview.score <= 30 ? "text-red-600" : "text-amber-600"
                          }`}>
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-current/10">
                              🤖 AI {(pb as any).aiReview.score}分
                            </span>
                            <span className="opacity-70">{(pb as any).aiReview.summary?.slice(0, 30)}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 快捷操作 */}
                    <div className="flex items-center gap-2 mt-3 pt-3 border-t">
                      <button
                        onClick={(e) => { e.stopPropagation(); approveMut.mutate({ id: pb.id }); }}
                        disabled={approveMut.isPending}
                        className="flex-1 px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-1"
                      >
                        <CheckCircle className="w-3 h-3" /> 通过
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowRejectDialog(pb.id); }}
                        className="flex-1 px-3 py-1.5 bg-red-500 text-white rounded-lg text-xs font-medium hover:opacity-90 flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> 驳回
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 右侧：详情预览 */}
            {selectedId && detailQuery.data ? (
              <div className="rounded-2xl border bg-card p-5 sticky top-6">
                <div className="flex items-start gap-3 mb-4">
                  <span className="text-3xl">{detailQuery.data.icon}</span>
                  <div>
                    <h2 className="font-bold">{detailQuery.data.title}</h2>
                    <p className="text-sm text-muted-foreground mt-1">{detailQuery.data.description}</p>
                    <div className="flex gap-1 mt-2">
                      {(detailQuery.data.tags as string[] || []).map(t => (
                        <span key={t} className="text-[10px] bg-muted px-2 py-0.5 rounded">{t}</span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 步骤列表 */}
                <div className="mb-4">
                  <h3 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><Zap className="w-3 h-3" /> 执行步骤</h3>
                  <div className="space-y-1.5">
                    {(detailQuery.data.steps || []).map((step: any, i: number) => (
                      <div key={i} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-muted/30">
                        <span className="w-5 h-5 rounded-full bg-primary/10 text-primary text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                        <span className="font-medium">{step.name}</span>
                        <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">{step.toolId}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 参数列表 */}
                {(detailQuery.data.parameters || []).length > 0 && (
                  <div className="mb-4">
                    <h3 className="text-xs font-bold text-muted-foreground mb-2 flex items-center gap-1"><Settings className="w-3 h-3" /> 参数</h3>
                    <div className="space-y-1">
                      {(detailQuery.data.parameters || []).map((p: any) => (
                        <div key={p.key} className="flex items-center justify-between text-xs p-1.5 rounded-lg bg-muted/30">
                          <span>{p.label} {p.required && <span className="text-red-500">*</span>}</span>
                          <span className="font-mono text-[10px]">{p.type}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* ★ AI 预审结果 */}
                <AIPreReviewPanel reviewNote={(detailQuery.data as any)?.reviewNote} />

                {/* 审核操作 */}
                <div className="flex items-center gap-2 pt-4 border-t">
                  <div className="flex-1">
                    <input
                      value={approveNote}
                      onChange={e => setApproveNote(e.target.value)}
                      placeholder="审核备注（可选）"
                      className="w-full p-2 rounded-lg border bg-background text-xs"
                    />
                  </div>
                  <button
                    onClick={() => approveMut.mutate({ id: selectedId, note: approveNote || undefined })}
                    disabled={approveMut.isPending}
                    className="px-4 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-50 flex items-center gap-1"
                  >
                    {approveMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                    通过
                  </button>
                  <button
                    onClick={() => setShowRejectDialog(selectedId)}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:opacity-90 flex items-center gap-1"
                  >
                    <XCircle className="w-4 h-4" /> 驳回
                  </button>
                </div>
              </div>
            ) : selectedId ? (
              <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto opacity-30" /></div>
            ) : (
              <div className="text-center py-10 text-muted-foreground text-sm">
                <Eye className="w-8 h-8 mx-auto mb-2 opacity-20" />
                点击左侧 Playbook 查看详情
              </div>
            )}
          </div>
        )}

        {/* ═══ 驳回对话框 ═══ */}
        {showRejectDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setShowRejectDialog(null)}>
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5 border" onClick={e => e.stopPropagation()}>
              <h3 className="font-bold text-base mb-3 flex items-center gap-2"><XCircle className="w-5 h-5 text-red-500" /> 驳回 Playbook</h3>
              <textarea
                value={rejectNote}
                onChange={e => setRejectNote(e.target.value)}
                placeholder="请填写驳回原因（必填），用户将看到此信息"
                className="w-full p-2 rounded-lg border bg-background text-sm h-24 resize-none mb-3"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRejectDialog(null)} className="px-4 py-2 text-sm text-muted-foreground">取消</button>
                <button
                  onClick={() => rejectMut.mutate({ id: showRejectDialog, note: rejectNote })}
                  disabled={!rejectNote.trim() || rejectMut.isPending}
                  className="px-4 py-2 bg-red-500 text-white rounded-xl text-sm font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {rejectMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "确认驳回"}
                </button>
              </div>
              {rejectMut.error && <p className="text-xs text-red-500 mt-2">{rejectMut.error.message}</p>}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
