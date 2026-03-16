/**
 * sandboxPanel/TerminalView.tsx — 终端视图（方案A）
 *
 * 终端内容区保持深色（终端天然深色），标题栏跟随主题。
 * 科技感通过 CRT 纹理、荧光绿光标、命令行高亮实现。
 */
import { useEffect, useRef } from "react";
import { Terminal as TerminalIcon } from "lucide-react";
import { sanitize } from '@/lib/sanitizeHtml';
import type { TerminalState } from "@/hooks/useSandboxSocket";

export function TerminalView({ terminal }: { terminal: TerminalState }) {
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [terminal.lines.length]);

  const parseAnsi = (text: string): string => {
    const colorMap: Record<string, string> = {
      "30": "#1e1e1e", "31": "#ff5555", "32": "#50fa7b", "33": "#f1fa8c",
      "34": "#6272a4", "35": "#ff79c6", "36": "#8be9fd", "37": "#f8f8f2", "90": "#6272a4",
    };
    let result = text;
    result = result.replace(/\x1b\[(\d+)m(.*?)(?:\x1b\[0m|$)/g, (_, code, content) => {
      const color = colorMap[code]; return color ? `<span style="color:${color}">${content}</span>` : content;
    });
    result = result.replace(/\x1b\[\d+m/g, "");
    result = result.replace(/\r?\n/g, "<br/>");
    return result;
  };

  const hasRealContent = terminal.lines.length > 1 ||
    (terminal.lines.length === 1 && !terminal.lines[0].content.includes('自动化沙箱终端已就绪'));

  return (
    <div className="flex flex-col h-full">
      <style>{`
        @keyframes term-blink { 0%,100% { opacity: 1; } 50% { opacity: 0; } }
        @keyframes term-glow { 0%,100% { box-shadow: 0 0 3px rgba(52,211,153,0.2); } 50% { box-shadow: 0 0 8px rgba(52,211,153,0.4); } }
        .term-cursor-v2 {
          display: inline-block; width: 7px; height: 13px; background: #34d399;
          animation: term-blink 1s step-end infinite, term-glow 2s ease-in-out infinite;
          vertical-align: text-bottom; margin-left: 2px; border-radius: 1px;
        }
        .term-line-hover:hover { background: rgba(52,211,153,0.03); }
        .term-crt-v2 {
          background: repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.008) 2px, rgba(255,255,255,0.008) 4px);
          pointer-events: none; position: absolute; inset: 0; z-index: 1;
        }
      `}</style>

      {/* 终端标题栏（跟随主题） */}
      <div className="flex items-center gap-2 px-3 py-2 shrink-0 border-b border-border/50 bg-muted/20">
        <TerminalIcon className="w-3.5 h-3.5 text-emerald-500/60" />
        <span className="text-[10px] font-mono tracking-wider text-emerald-600/40 dark:text-emerald-400/40 uppercase">
          Agent Shell // Bash
        </span>
        {hasRealContent && (
          <span className="text-[9px] font-mono ml-auto text-muted-foreground/30">
            {terminal.lines.length} lines
          </span>
        )}
      </div>

      {/* 终端内容（保持深色——终端天然是黑底绿字） */}
      <div className="flex-1 relative overflow-hidden" style={{ background: '#0d1117' }}>
        {/* CRT 纹理 */}
        <div className="term-crt-v2" />

        <div ref={terminalRef} className="relative z-10 h-full overflow-auto p-3 font-mono text-xs leading-5 text-gray-300">
          {!hasRealContent ? (
            <div className="flex flex-col items-center justify-center h-full">
              {/* 骨架 */}
              <div className="w-full max-w-[220px] space-y-3 mb-6">
                <div className="flex items-center gap-2 opacity-15">
                  <span style={{ color: '#34d399' }}>$</span>
                  <div className="h-2.5 rounded animate-pulse w-3/4" style={{ background: '#34d399' }} />
                </div>
                <div className="pl-4 space-y-1.5 opacity-8">
                  <div className="h-2 rounded animate-pulse w-full" style={{ background: '#34d399', animationDelay: '0.2s', opacity: 0.08 }} />
                  <div className="h-2 rounded animate-pulse w-5/6" style={{ background: '#34d399', animationDelay: '0.4s', opacity: 0.06 }} />
                  <div className="h-2 rounded animate-pulse w-2/3" style={{ background: '#34d399', animationDelay: '0.6s', opacity: 0.05 }} />
                </div>
                <div className="flex items-center gap-2 opacity-10">
                  <span style={{ color: '#34d399' }}>$</span>
                  <div className="h-2.5 rounded animate-pulse w-1/2" style={{ background: '#34d399', animationDelay: '0.8s' }} />
                </div>
              </div>

              <TerminalIcon className="w-7 h-7 mb-2" style={{ color: 'rgba(52,211,153,0.12)' }} />
              <p className="text-[11px] font-mono tracking-wider mb-1" style={{ color: 'rgba(52,211,153,0.35)' }}>
                STANDBY
              </p>
              <p className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.1)' }}>
                SSH 命令和输出将在此实时显示
              </p>
            </div>
          ) : (
            <>
              {terminal.lines.map((line, index) => (
                <div key={index} className="term-line-hover px-1 -mx-1 rounded"
                  dangerouslySetInnerHTML={{ __html: sanitize(parseAnsi(line.content)) }} />
              ))}
              <span className="term-cursor-v2" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
