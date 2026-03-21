/**
 * 网站运营助手 - 沙箱执行面板
 * 模板数据和类型已提取到 templates.tsx / types.ts
 */
import { useState, useEffect, useRef } from "react";
import { useSandboxSocket } from "@/hooks/useSandboxSocket";
import { Bot, Globe, Loader2, MonitorPlay, Terminal } from "lucide-react";
import TakeoverPanel from "./TakeoverPanel";
import ExecutionReport from "./ExecutionReport";
import type { SiteAccount, AutomationTask, TaskStep } from "./types";
import { apiFetch } from "./types";

export function AutomationSandbox({ taskId }: { taskId: number }) {
  const sandbox = useSandboxSocket(taskId);
  const [activeTab, setActiveTab] = useState<"browser" | "terminal" | "thinking">("browser");
  const terminalRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [takeoverActive, setTakeoverActive] = useState(false);

  // ★ Phase 3: 监听 completed_summary 事件，提取报告数据
  const [completedReport, setCompletedReport] = useState<any>(null);
  useEffect(() => {
    if (!sandbox.socket) return;
    const handleSandboxEvent = (event: any) => {
      if (event?.payload?.status === 'completed_summary' && event.taskId === taskId) {
        const rs = event.payload.resultSummary;
        if (rs?.contentInfo || rs?.billing) {
          // 构建 ExecutionReport 需要的数据格式
          setCompletedReport({
            totalAccounts: 1,
            successCount: rs.completed ? 1 : 0,
            failedCount: rs.completed ? 0 : 1,
            results: [{
              username: event.payload.accountName || '',
              taskId,
              status: rs.completed ? (rs.partial ? 'partial' : 'success') : 'failed',
              posts: rs.contentInfo?.allPublished?.filter((c: any) => c.type === 'post').map((c: any) => ({
                title: rs.contentInfo?.title || '帖子',
                url: c.url || '',
                contentLength: c.length || 0,
                hasImages: false,
              })) || [],
              replies: rs.contentInfo?.allPublished?.filter((c: any) => c.type === 'reply').map((c: any) => ({
                targetPostUrl: c.url || '',
                contentLength: c.length || 0,
              })) || [],
              duration: 0,
              totalSteps: rs.totalSteps || 0,
              tokenCost: rs.billing?.totalCost || 0,
            }],
            summary: {
              totalPosts: rs.contentInfo?.postCount || 0,
              totalReplies: rs.contentInfo?.replyCount || 0,
              totalDuration: 0,
              totalCost: rs.billing?.totalCost || 0,
              averagePostLength: rs.contentInfo?.contentLength || 0,
              costEfficiency: 0,
              successRate: rs.completed ? 100 : 0,
            },
          });
        }
      }
    };
    sandbox.socket.on('sandbox_event', handleSandboxEvent);
    return () => { sandbox.socket?.off('sandbox_event', handleSandboxEvent); };
  }, [sandbox.socket, taskId]);

  useEffect(() => {
    if (terminalRef.current && activeTab === "terminal") {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [sandbox.terminal?.lines, activeTab]);

  const handleTakeoverClick = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!takeoverActive || !imgRef.current) return;
    e.preventDefault();
    const rect = imgRef.current.getBoundingClientRect();
    const x = Math.round((e.clientX - rect.left) * (1920 / rect.width));
    const y = Math.round((e.clientY - rect.top) * (1080 / rect.height));
    sandbox.socket?.emit("takeover_action", { taskId, action: "click", payload: { x, y } });
    imgRef.current.focus();
  };

  const handleTakeoverKeyDown = (e: React.KeyboardEvent) => {
    if (!takeoverActive) return;
    e.preventDefault();
    const keyMap: Record<string, string> = { Enter: "Enter", Backspace: "Backspace", Delete: "Delete", Tab: "Tab", Escape: "Escape", ArrowUp: "ArrowUp", ArrowDown: "ArrowDown", ArrowLeft: "ArrowLeft", ArrowRight: "ArrowRight" };
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
      sandbox.socket?.emit("takeover_action", { taskId, action: "type", payload: { text: e.key } });
    } else if (e.ctrlKey || e.metaKey) {
      sandbox.socket?.emit("takeover_action", { taskId, action: "press", payload: { key: `Control+${e.key}` } });
    } else {
      sandbox.socket?.emit("takeover_action", { taskId, action: "press", payload: { key: keyMap[e.key] || e.key } });
    }
  };

  const handleTakeoverWheel = (e: React.WheelEvent) => {
    if (!takeoverActive) return;
    e.preventDefault();
    sandbox.socket?.emit("takeover_action", { taskId, action: "scroll", payload: { deltaX: e.deltaX, deltaY: e.deltaY } });
  };

  const tabs = [
    { id: "browser" as const, label: "浏览器", icon: <Globe className="w-4 h-4" />, active: sandbox.browser.isLoading },
    { id: "terminal" as const, label: "终端", icon: <Terminal className="w-4 h-4" />, active: false },
    { id: "thinking" as const, label: "思考过程", icon: <Bot className="w-4 h-4" />, active: !!sandbox.thinking },
  ];

  return (
    <div className="h-full flex flex-col bg-white rounded-2xl border shadow-sm overflow-hidden">
      <div className="flex items-center border-b bg-gray-50 px-2">
        {tabs.map(tab => (
          <button key={tab.id}
            className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}
            onClick={() => setActiveTab(tab.id)}>
            {tab.icon} {tab.label}
            {tab.active && <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1.5 px-2 text-xs">
          <span className={`w-2 h-2 rounded-full ${sandbox.isConnected ? "bg-green-500" : "bg-red-400"}`} />
          {sandbox.isConnected ? "已连接" : "断开"}
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        {activeTab === "browser" && (
          <div className="h-full flex flex-col">
            <div className="flex items-center gap-2 px-3 py-2 bg-gray-100 border-b">
              <Globe className="w-4 h-4 text-gray-400 flex-shrink-0" />
              <div className="flex-1 text-sm text-gray-600 truncate font-mono bg-white rounded-lg px-2 py-1 border text-xs">
                {sandbox.browser.url || "等待 Insi 打开网页..."}
              </div>
              {sandbox.browser.isLoading && <Loader2 className="w-4 h-4 animate-spin text-blue-500" />}
            </div>
            <div className="flex-1 overflow-auto bg-gray-200 flex items-center justify-center relative">
              {sandbox.browser.screenshot ? (
                <img ref={imgRef} src={sandbox.browser.screenshot.startsWith('data:') ? sandbox.browser.screenshot : `data:image/jpeg;base64,${sandbox.browser.screenshot}`} alt="浏览器画面"
                  className={`max-w-full max-h-full object-contain ${takeoverActive ? "cursor-crosshair" : ""}`}
                  onClick={handleTakeoverClick} onWheel={handleTakeoverWheel}
                  tabIndex={0} onKeyDown={handleTakeoverKeyDown}
                  onMouseDown={e => { if (takeoverActive) { e.preventDefault(); imgRef.current?.focus(); } }}
                  style={takeoverActive ? { outline: "3px solid #f97316", outlineOffset: "2px", userSelect: "none" } : { outline: "none" }} />
              ) : (
                <div className="text-center text-gray-400 space-y-2">
                  <MonitorPlay className="w-16 h-16 mx-auto opacity-20" />
                  <p className="text-sm">等待 Insi 打开浏览器...</p>
                </div>
              )}
              {/* TakeoverPanel 替代了旧的浮动按钮 — 见组件底部 */}
            </div>
          </div>
        )}

        {activeTab === "terminal" && (
          <div ref={terminalRef} className="h-full overflow-auto bg-gray-900 p-3 font-mono text-sm">
            {(sandbox.terminal?.lines?.length ?? 0) === 0 ? (
              <div className="text-gray-500 text-center mt-10"><Terminal className="w-12 h-12 mx-auto opacity-20 mb-2" /><p>等待终端输出...</p></div>
            ) : (
              (sandbox.terminal?.lines || []).map((line, i) => (
                <div key={i} className={`py-0.5 ${line.type === "command" ? "text-green-400" : "text-gray-300"}`}>
                  {line.type === "command" && <span className="text-blue-400">$ </span>}{line.content}
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "thinking" && (
          <div className="h-full overflow-auto p-4 space-y-3">
            {sandbox.steps.length === 0 && !sandbox.thinking ? (
              <div className="text-gray-400 text-center mt-10"><Bot className="w-12 h-12 mx-auto opacity-20 mb-2" /><p className="text-sm">等待 Insi 开始思考...</p></div>
            ) : (
              <>
                {sandbox.thinking && (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl animate-pulse">
                    <div className="flex items-center gap-2 text-yellow-700 text-sm font-medium mb-1"><Bot className="w-4 h-4" /> Insi 正在思考...</div>
                    <p className="text-sm text-yellow-800">{sandbox.thinking}</p>
                  </div>
                )}
                {sandbox.steps.map((step, i) => (
                  <div key={i} className="flex items-start gap-3 p-2">
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-xs font-bold text-blue-600">
                      {step.payload?.stepNumber || i + 1}
                    </div>
                    <div className="flex-1">
                      <div className="text-xs text-gray-400">{step.payload?.stepType || "step"} · {new Date(step.timestamp).toLocaleTimeString()}</div>
                      <p className="text-sm text-gray-700 mt-0.5">{step.payload?.content}</p>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}
      </div>

      {sandbox.progress > 0 && (
        <div className="border-t px-3 py-2 bg-gray-50">
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
            <span>{sandbox.currentStep || "执行中..."}</span>
            <span>{Math.round(sandbox.progress)}%</span>
          </div>
          <div className="w-full h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${sandbox.progress}%` }} />
          </div>
        </div>
      )}

      {/* ★ Phase 4: 增强型人工接管面板（替代旧的浮动按钮） */}
      <TakeoverPanel
        taskId={taskId}
        socket={sandbox.socket}
        isRunning={sandbox.progress > 0 && sandbox.progress < 100}
        apiFetch={apiFetch}
        onTakeoverChange={(active) => {
          setTakeoverActive(active);
          if (active && imgRef.current) setTimeout(() => imgRef.current?.focus(), 100);
        }}
      />

      {/* ★ Phase 3: 执行报告（任务完成后展示） */}
      {completedReport && <ExecutionReport report={completedReport} />}
    </div>
  );
}

// ─────────────────── 任务卡片 ───────────────────
