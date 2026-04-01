/**
 * RemoteFileExplorer.tsx — 远程文件浏览器
 *
 * 在 SandboxPanel 中为 SSH 任务提供可视化文件浏览体验。
 * 用户点击目录展开、点击文件查看内容，通过 sendPrompt
 * 触发 Agent 工具调用（不直接执行 SSH 命令）。
 *
 * 纯展示组件，数据来源：
 * - 初始数据从 terminal 输出中提取 ls -la 结果
 * - 交互通过 Socket task_instruction 或 sendPrompt 驱动
 */
import { useState, useCallback } from "react";
import {
  Folder, FileText, FileCode, Image, Database,
  Search, RefreshCw,
  File, Settings, Shield, HardDrive,
} from "lucide-react";
import type { Socket } from "socket.io-client";

interface FileEntry {
  name: string;
  type: "file" | "dir" | "link";
  size?: string;
  permissions?: string;
  modified?: string;
  children?: FileEntry[];
  expanded?: boolean;
  path: string;
}

interface Props {
  taskId: number | null;
  socket: Socket | null;
  cwd?: string;
}

const ICON_MAP: Record<string, any> = {
  ts: FileCode, tsx: FileCode, js: FileCode, jsx: FileCode, py: FileCode,
  json: Settings, yml: Settings, yaml: Settings, conf: Settings, ini: Settings,
  png: Image, jpg: Image, jpeg: Image, svg: Image, gif: Image,
  db: Database, sqlite: Database, sql: Database,
  log: FileText, md: FileText, txt: FileText,
};

function getFileIcon(name: string, type: string) {
  if (type === "dir") return Folder;
  const ext = name.split(".").pop()?.toLowerCase() || "";
  return ICON_MAP[ext] || File;
}

export function RemoteFileExplorer({ taskId, socket, cwd = "/" }: Props) {
  const [searchQuery, setSearchQuery] = useState("");
  const [quickPaths] = useState([
    { label: "项目目录", path: "/www/wwwroot" },
    { label: "Nginx 配置", path: "/etc/nginx" },
    { label: "日志", path: "/var/log" },
    { label: "PM2 日志", path: "~/.pm2/logs" },
    { label: "系统服务", path: "/etc/systemd/system" },
    { label: "定时任务", path: "/var/spool/cron" },
  ]);

  const sendInstruction = useCallback((instruction: string) => {
    if (!socket || !taskId) return;
    socket.emit("task_instruction", { taskId, instruction });
  }, [socket, taskId]);

  const handleQuickPath = (path: string) => {
    sendInstruction(`请列出 ${path} 目录的文件列表，用 file.list 工具查看`);
  };

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    sendInstruction(`请在服务器上搜索包含 "${searchQuery}" 的文件内容，使用 ssh.file_search 工具`);
    setSearchQuery("");
  };

  const handleAction = (action: string) => {
    const actions: Record<string, string> = {
      service: "请检查服务器上所有运行中的服务状态，使用 ssh.service_status 工具",
      process: "请查看服务器当前进程列表，按 CPU 使用率排序，使用 ssh.process_list 工具",
      disk: "请分析服务器磁盘使用情况，使用 ssh.disk_analysis 工具",
      ports: "请列出服务器所有监听端口，使用 ssh.port_check 工具",
      pm2: "请检查 PM2 所有进程状态，使用 ssh.service_status 工具，manager 设为 pm2",
      nginx: "请检查 Nginx 配置是否正确并查看运行状态：先 nginx -t 测试配置，再查看 systemctl status nginx",
    };
    const instruction = actions[action];
    if (instruction) sendInstruction(instruction);
  };

  return (
    <div className="h-full flex flex-col bg-background overflow-hidden">
      {/* 搜索栏 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted/20 shrink-0">
        <Search className="w-3.5 h-3.5 text-muted-foreground/50 shrink-0" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
          placeholder="搜索文件内容..."
          className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted-foreground/40 outline-none"
        />
        {searchQuery && (
          <button onClick={handleSearch} className="text-[10px] px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
            搜索
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto px-3 py-2 space-y-3">
        {/* 快捷路径 */}
        <div>
          <div className="text-[10px] font-medium text-muted-foreground/60 mb-1.5">快捷路径</div>
          <div className="grid grid-cols-2 gap-1">
            {quickPaths.map((p) => (
              <button
                key={p.path}
                onClick={() => handleQuickPath(p.path)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-colors text-left"
              >
                <Folder className="w-3 h-3 text-amber-500/70 shrink-0" />
                <span className="truncate">{p.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 运维快捷操作 */}
        <div>
          <div className="text-[10px] font-medium text-muted-foreground/60 mb-1.5">运维操作</div>
          <div className="grid grid-cols-2 gap-1">
            {[
              { key: "service", icon: Settings, label: "服务状态", color: "text-blue-500/70" },
              { key: "process", icon: HardDrive, label: "进程列表", color: "text-green-500/70" },
              { key: "disk", icon: Database, label: "磁盘分析", color: "text-amber-500/70" },
              { key: "ports", icon: Shield, label: "端口检查", color: "text-purple-500/70" },
              { key: "pm2", icon: RefreshCw, label: "PM2 状态", color: "text-cyan-500/70" },
              { key: "nginx", icon: FileCode, label: "Nginx 检查", color: "text-red-500/70" },
            ].map((item) => (
              <button
                key={item.key}
                onClick={() => handleAction(item.key)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-foreground/70 hover:bg-muted/50 hover:text-foreground transition-colors text-left"
              >
                <item.icon className={`w-3 h-3 ${item.color} shrink-0`} />
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 常用运维命令模板 */}
        <div>
          <div className="text-[10px] font-medium text-muted-foreground/60 mb-1.5">常用命令</div>
          <div className="space-y-1">
            {[
              { label: "查看最近错误日志", cmd: "请查看 /var/log/nginx/error.log 最后 50 行，使用 ssh.file_tail 工具" },
              { label: "检查 PM2 错误日志", cmd: "请查看 PM2 错误日志，使用 ssh.file_tail 查看 ~/.pm2/logs/ 下的 error 日志" },
              { label: "查找大文件", cmd: "请分析磁盘使用，找到大文件，使用 ssh.disk_analysis 工具 mode=large_files" },
              { label: "重启服务", cmd: "请列出所有 PM2 进程状态，我需要确认要重启哪个服务" },
            ].map((item, i) => (
              <button
                key={i}
                onClick={() => sendInstruction(item.cmd)}
                className="w-full text-left px-2 py-1.5 rounded-md text-[11px] text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-colors"
              >
                → {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 底部状态 */}
      <div className="px-3 py-1.5 border-t border-border/30 text-[9px] text-muted-foreground/40 text-center shrink-0">
        通过 SSH 连接操作 · 所有命令由 AI Agent 安全执行
      </div>
    </div>
  );
}
