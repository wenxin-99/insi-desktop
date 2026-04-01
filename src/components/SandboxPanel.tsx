/**
 * SandboxPanel - 研究沙箱面板（方案A：跟随主题 + 科技感点缀）
 * 
 * 背景跟随 light/dark 主题，科技感通过 HUD 信息条、霓虹高光、
 * 数据流动线来体现，不用硬编码深色背景。
 */
import { useState, useEffect } from "react";
import {
  Globe, Code2, Terminal as TerminalIcon,
  Loader2, Wifi, WifiOff, Signal, Cpu,
} from "lucide-react";
import type { Socket } from "socket.io-client";
import type { BrowserState, CodeState, TerminalState } from "@/hooks/useSandboxSocket";

import { BrowserPreview } from "./sandboxPanel/BrowserPreview";
import { CodeEditor } from "./sandboxPanel/CodeEditor";
import { TerminalView } from "./sandboxPanel/TerminalView";
import { RemoteFileExplorer } from "./sandboxPanel/RemoteFileExplorer";

import { TaskInstructionInput } from "./sandboxPanel/TaskInstructionInput";
import { FolderOpen } from "lucide-react";

interface SandboxPanelProps {
  browser: BrowserState;
  code: CodeState;
  terminal: TerminalState;
  activeTab: "browser" | "code" | "terminal";
  onTabChange: (tab: "browser" | "code" | "terminal") => void;
  isConnected: boolean;
  taskId?: number | null;
  socket?: Socket | null;
  clickIndicator?: { x: number; y: number; description: string; key: number } | null;
  screenshotTimeout?: boolean;
  pendingConfirmation?: { action: string; description: string; screenshot: string; timeoutMs: number; timestamp: number } | null;
  onConfirmationResolved?: () => void;
  cursorPosition?: { x: number; y: number } | null;
  browserTabs?: Array<{ index: number; url: string; title: string; active: boolean }>;
  helpNeeded?: { reason: string; category: string } | null;
  onHelpDismiss?: () => void;
}

const tabs = [
  { id: "browser" as const, label: "浏览器", icon: Globe, color: "#06b6d4", lightBg: "rgba(6,182,212,0.06)" },
  { id: "code" as const, label: "代码", icon: Code2, color: "#a78bfa", lightBg: "rgba(167,139,250,0.06)" },
  { id: "terminal" as const, label: "终端", icon: TerminalIcon, color: "#34d399", lightBg: "rgba(52,211,153,0.06)" },
];

export default function SandboxPanel({
  browser, code, terminal,
  activeTab, onTabChange,
  isConnected, taskId, socket,
  clickIndicator, screenshotTimeout,
  pendingConfirmation, onConfirmationResolved,
  cursorPosition,
  browserTabs,
  helpNeeded, onHelpDismiss,
}: SandboxPanelProps) {
  const [uptime, setUptime] = useState(0);
  const [showFiles, setShowFiles] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setUptime(s => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmtUptime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const activeTab_ = tabs.find(t => t.id === activeTab)!;

  return (
    <div className="flex flex-col h-full border-l bg-background overflow-hidden">
      <style>{`
        .hud-tab { position: relative; transition: all 0.25s ease; }
        .hud-tab::after {
          content: ''; position: absolute; bottom: 0; left: 50%; transform: translateX(-50%);
          width: 0; height: 2px; border-radius: 2px;
          transition: all 0.25s ease;
        }
        .hud-tab.active::after { width: 60%; }
        @keyframes data-flow {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .data-flow-line {
          height: 1px;
          background-size: 200% 100%;
          animation: data-flow 4s linear infinite;
        }
        .hud-corner {
          position: absolute; width: 6px; height: 6px; opacity: 0.15;
        }
        .hud-corner-tl { top: 0; left: 0; border-top: 1.5px solid; border-left: 1.5px solid; }
        .hud-corner-tr { top: 0; right: 0; border-top: 1.5px solid; border-right: 1.5px solid; }
        .hud-corner-bl { bottom: 0; left: 0; border-bottom: 1.5px solid; border-left: 1.5px solid; }
        .hud-corner-br { bottom: 0; right: 0; border-bottom: 1.5px solid; border-right: 1.5px solid; }
      `}</style>

      {/* ═══ HUD 信息条 ═══ */}
      <div className="flex items-center justify-between px-3 py-1 border-b border-border/50 bg-muted/20">
        <div className="flex items-center gap-2">
          <Cpu className="w-3 h-3 animate-pulse" style={{ color: activeTab_.color }} />
          <span className="text-[9px] font-mono tracking-wider text-muted-foreground/40">
            SANDBOX {taskId ? `// TASK-${taskId}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-mono tracking-wider text-muted-foreground/30">
            {fmtUptime(uptime)}
          </span>
          <div className="flex items-center gap-1.5">
            {isConnected ? (
              <>
                <div className="relative">
                  <Signal className="w-3 h-3 text-emerald-500" />
                  <div className="absolute -top-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                </div>
                <span className="text-[9px] font-mono text-emerald-500">LINKED</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-[9px] font-mono text-red-400">OFFLINE</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* 数据流动线 */}
      <div className="data-flow-line" style={{
        background: `linear-gradient(90deg, transparent 0%, ${activeTab_.color}40 50%, transparent 100%)`,
        backgroundSize: '200% 100%',
      }} />

      {/* ═══ Tab 栏 ═══ */}
      <div className="flex items-center border-b border-border/50 bg-muted/10">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id && !showFiles;
          return (
            <button
              key={tab.id}
              onClick={() => { onTabChange(tab.id); setShowFiles(false); }}
              className={`hud-tab flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-mono tracking-wide ${isActive ? 'active' : ''}`}
              style={{
                color: isActive ? tab.color : undefined,
                textShadow: isActive ? `0 0 10px ${tab.color}30` : undefined,
                // 下划线颜色
                '--tab-color': tab.color,
              } as React.CSSProperties}
            >
              <style>{`
                .hud-tab.active[style*="${tab.color}"]::after {
                  background: ${tab.color};
                  box-shadow: 0 0 6px ${tab.color}50;
                }
              `}</style>
              <Icon className={`w-3.5 h-3.5 ${isActive ? '' : 'text-muted-foreground/50'}`} />
              <span className={isActive ? 'uppercase' : 'uppercase text-muted-foreground/50'}>
                {tab.label}
              </span>
              {tab.id === "browser" && browser.isLoading && (
                <Loader2 className="w-3 h-3 animate-spin" style={{ color: tab.color }} />
              )}
            </button>
          );
        })}

        {/* ★ SSH 文件/运维快捷入口 */}
        <button
          onClick={() => setShowFiles(!showFiles)}
          className={`hud-tab flex items-center gap-1.5 px-4 py-2.5 text-[11px] font-mono tracking-wide ${showFiles ? "active" : ""}`}
          style={{
            color: showFiles ? "#f59e0b" : undefined,
            textShadow: showFiles ? "0 0 10px rgba(245,158,11,0.3)" : undefined,
          }}
        >
          <style>{`.hud-tab.active[style*="f59e0b"]::after { background: #f59e0b; box-shadow: 0 0 6px rgba(245,158,11,0.5); }`}</style>
          <FolderOpen className={`w-3.5 h-3.5 ${showFiles ? "" : "text-muted-foreground/50"}`} />
          <span className={showFiles ? "uppercase" : "uppercase text-muted-foreground/50"}>文件</span>
        </button>
      </div>

      {/* ═══ 内容区 ═══ */}
      <div className="flex-1 overflow-hidden relative">
        {/* HUD 四角标记 */}
        <div className="hud-corner hud-corner-tl" style={{ borderColor: showFiles ? "#f59e0b" : activeTab_.color }} />
        <div className="hud-corner hud-corner-tr" style={{ borderColor: showFiles ? "#f59e0b" : activeTab_.color }} />
        <div className="hud-corner hud-corner-bl" style={{ borderColor: showFiles ? "#f59e0b" : activeTab_.color }} />
        <div className="hud-corner hud-corner-br" style={{ borderColor: showFiles ? "#f59e0b" : activeTab_.color }} />

        {showFiles ? (
          <RemoteFileExplorer taskId={taskId ?? null} socket={socket ?? null} />
        ) : (
          <>
            {activeTab === "browser" && <BrowserPreview browser={browser} taskId={taskId} socket={socket} clickIndicator={clickIndicator} screenshotTimeout={screenshotTimeout} pendingConfirmation={pendingConfirmation} onConfirmationResolved={onConfirmationResolved} cursorPosition={cursorPosition} browserTabs={browserTabs} helpNeeded={helpNeeded} onHelpDismiss={onHelpDismiss} />}
            {activeTab === "code" && <CodeEditor code={code} />}
            {activeTab === "terminal" && <TerminalView terminal={terminal} />}
          </>
        )}
      </div>

      {/* ★ P1⑥：任务中途指令输入 */}
      <TaskInstructionInput taskId={taskId ?? null} socket={socket ?? null} isRunning={!!taskId && isConnected} />
    </div>
  );
}
