/**
 * Phase 3.3: 执行报告展示组件
 *
 * 在聊天卡片底部"查看报告"按钮点击后展开显示。
 * 接收 AutomationReport JSON 并渲染为结构化运营数据。
 */
import { useState } from "react";
import {
  BarChart3, CheckCircle2, XCircle, Clock, Fish, FileText,
  MessageSquare, ChevronDown, ChevronUp, ExternalLink,
} from "lucide-react";

interface ReportData {
  taskBatchId?: string;
  totalAccounts: number;
  successCount: number;
  failedCount: number;
  generatedAt?: string;
  results: Array<{
    username: string;
    taskId: number;
    status: "success" | "failed" | "partial";
    posts: Array<{ title: string; url: string; contentLength: number; hasImages: boolean }>;
    replies: Array<{ targetPostUrl: string; contentLength: number }>;
    duration: number;
    totalSteps: number;
    tokenCost: number;
    errorMessage?: string;
  }>;
  summary: {
    totalPosts: number;
    totalReplies: number;
    totalDuration: number;
    totalCost: number;
    averagePostLength: number;
    costEfficiency: number;
    successRate: number;
  };
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}秒`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return sec > 0 ? `${min}分${sec}秒` : `${min}分钟`;
}

export default function ExecutionReport({ report }: { report: ReportData }) {
  const [expanded, setExpanded] = useState(false);
  const s = report.summary;

  return (
    <div className="mt-3 border border-gray-200 rounded-xl overflow-hidden bg-white">
      {/* 摘要行 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 text-sm">
          <BarChart3 className="w-4 h-4 text-blue-500" />
          <span className="font-medium">执行报告</span>
          <span className="text-gray-400">·</span>
          <span className="text-green-600">{s.totalPosts} 帖</span>
          <span className="text-blue-600">{s.totalReplies} 回复</span>
          <span className="text-gray-400">·</span>
          <span className="text-gray-500">{formatDuration(s.totalDuration)}</span>
          <span className="text-gray-400">·</span>
          <span className="text-amber-600">{s.totalCost} 🐟</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>

      {/* 展开详情 */}
      {expanded && (
        <div className="border-t border-gray-100 px-4 py-3 space-y-4">
          {/* 统计卡片 */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <StatCard
              icon={<CheckCircle2 className="w-4 h-4 text-green-500" />}
              label="成功率"
              value={`${s.successRate}%`}
            />
            <StatCard
              icon={<FileText className="w-4 h-4 text-blue-500" />}
              label="发帖数"
              value={String(s.totalPosts)}
            />
            <StatCard
              icon={<MessageSquare className="w-4 h-4 text-indigo-500" />}
              label="回帖数"
              value={String(s.totalReplies)}
            />
            <StatCard
              icon={<Clock className="w-4 h-4 text-gray-500" />}
              label="总耗时"
              value={formatDuration(s.totalDuration)}
            />
          </div>

          {/* 效率指标 */}
          <div className="flex items-center gap-4 text-xs text-gray-500">
            <span>平均内容长度: <b className="text-gray-700">{s.averagePostLength}</b> 字</span>
            {s.costEfficiency > 0 && (
              <span>性价比: <b className="text-gray-700">{s.costEfficiency}</b> 字/🐟</span>
            )}
          </div>

          {/* 各账号详情 */}
          {report.results.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-gray-500">各账号详情</div>
              {report.results.map((r, i) => (
                <div key={i} className="p-2.5 rounded-lg bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {r.status === "success" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                      ) : r.status === "partial" ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-amber-500" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500" />
                      )}
                      <span className="text-sm font-medium">{r.username}</span>
                    </div>
                    <div className="text-xs text-gray-400">
                      {r.totalSteps} 步 · {formatDuration(r.duration)} · {r.tokenCost} 🐟
                    </div>
                  </div>

                  {/* 帖子列表 */}
                  {r.posts.map((p, j) => (
                    <div key={j} className="mt-1.5 ml-5 flex items-center gap-1.5 text-xs">
                      <FileText className="w-3 h-3 text-gray-400" />
                      {p.url ? (
                        <a href={p.url} target="_blank" rel="noopener noreferrer"
                           className="text-blue-600 hover:underline flex items-center gap-0.5">
                          {p.title || "帖子"} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ) : (
                        <span className="text-gray-600">{p.title || "帖子"}</span>
                      )}
                      <span className="text-gray-400">({p.contentLength}字{p.hasImages ? " 含图" : ""})</span>
                    </div>
                  ))}

                  {r.replies.map((rr, j) => (
                    <div key={`r${j}`} className="mt-1 ml-5 flex items-center gap-1.5 text-xs">
                      <MessageSquare className="w-3 h-3 text-gray-400" />
                      <span className="text-gray-600">回复 ({rr.contentLength}字)</span>
                    </div>
                  ))}

                  {r.errorMessage && (
                    <div className="mt-1 ml-5 text-xs text-red-500">{r.errorMessage}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-gray-50">
      {icon}
      <div>
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-semibold">{value}</div>
      </div>
    </div>
  );
}
