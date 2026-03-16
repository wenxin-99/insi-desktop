/**
 * GlobalFeedbackFab — 全局浮动反馈按钮
 *
 * [FIXED] #10: 移除了 console.error 全局劫持，错误采集统一在 usePassiveSignals 中
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { MessageSquarePlus, X, Send, Bug, Lightbulb, Wrench, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

const FEEDBACK_TYPES = [
  { id: "bug",         label: "Bug 报告",   icon: Bug,        color: "text-red-500" },
  { id: "feature",     label: "功能建议",   icon: Lightbulb,  color: "text-amber-500" },
  { id: "improvement", label: "改进建议",   icon: Wrench,     color: "text-blue-500" },
  { id: "other",       label: "其他",       icon: HelpCircle, color: "text-gray-500" },
] as const;

export function GlobalFeedbackFab() {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"bug" | "feature" | "improvement" | "other">("bug");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [rating, setRating] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  const submitMutation = trpc.aiOps.submitFeedback.useMutation({
    onSuccess: () => { toast.success("反馈已提交，感谢您帮助我们改进！", { duration: 3000 }); resetForm(); },
    onError: (err) => { toast.error("提交失败: " + err.message); setSubmitting(false); },
  });

  const resetForm = () => { setOpen(false); setTitle(""); setContent(""); setRating(3); setType("bug"); setSubmitting(false); };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => { if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const collectContext = useCallback(() => ({
    pageUrl: window.location.pathname + window.location.search,
    userAgent: navigator.userAgent,
    timestamp: Date.now(),
    performanceData: {
      pageLoadTime: performance.timing?.loadEventEnd > 0
        ? performance.timing.loadEventEnd - performance.timing.navigationStart : undefined,
    },
  }), []);

  const handleSubmit = () => {
    if (!title.trim()) { toast.error("请填写标题"); return; }
    setSubmitting(true);
    submitMutation.mutate({ type, title: title.trim(), content: content.trim() || title.trim(), rating, pageUrl: window.location.pathname, context: collectContext() });
  };

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg hover:shadow-xl hover:scale-105 transition-all duration-200 flex items-center justify-center group"
          title="提交反馈">
          <MessageSquarePlus className="h-5 w-5 group-hover:scale-110 transition-transform" />
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-end p-4 sm:p-6 pointer-events-none">
          <div ref={panelRef} className="pointer-events-auto w-full max-w-sm bg-popover border border-border rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <MessageSquarePlus className="h-4.5 w-4.5 text-primary" />
                <span className="font-semibold text-sm">提交反馈</span>
              </div>
              <button onClick={resetForm} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-muted transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">反馈类型</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {FEEDBACK_TYPES.map(ft => {
                    const Icon = ft.icon;
                    return (
                      <button key={ft.id} onClick={() => setType(ft.id)}
                        className={`flex flex-col items-center gap-1 p-2 rounded-lg text-xs transition-all ${type === ft.id ? "bg-primary/10 text-primary ring-1 ring-primary/30" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
                        <Icon className={`h-4 w-4 ${type === ft.id ? ft.color : ""}`} />
                        <span className="font-medium">{ft.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">标题 <span className="text-destructive">*</span></label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="简要描述问题或建议..." maxLength={200}
                  className="w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">详细说明</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder="请详细描述..." rows={3} maxLength={2000}
                  className="w-full text-sm bg-muted/50 border border-border rounded-lg px-3 py-2 resize-none placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-ring" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">整体体验评分</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(n => (
                    <button key={n} onClick={() => setRating(n)} className={`text-lg transition-transform hover:scale-110 ${n <= rating ? "grayscale-0" : "grayscale opacity-30"}`}>⭐</button>
                  ))}
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground/60 leading-relaxed">提交时会自动采集当前页面路径和性能数据，不会采集任何个人隐私信息。</p>
            </div>
            <div className="px-5 py-3 border-t border-border bg-muted/20">
              <Button className="w-full h-9" onClick={handleSubmit} disabled={submitting || !title.trim()}>
                {submitting ? <><span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin mr-1.5" />提交中...</> : <><Send className="h-3.5 w-3.5 mr-1.5" />提交反馈</>}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
