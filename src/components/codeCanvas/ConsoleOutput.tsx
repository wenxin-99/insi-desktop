/**
 * ConsoleOutput.tsx — 控制台输出面板
 *
 * 显示代码执行的控制台输出，支持：
 *   - log/warn/error/info 分颜色
 *   - 错误行号高亮
 *   - 返回值显示
 *   - 自动滚到底部
 *   - 清空按钮
 */

import { useEffect, useRef, memo } from "react";
import { Trash2, AlertTriangle, Bug } from "lucide-react";
import type { ConsoleEntry, ExecutionResult } from "./types";

interface ConsoleOutputProps {
  entries: ConsoleEntry[];
  result: ExecutionResult | null;
  onClear: () => void;
  /** 点击错误行号 → 跳转到编辑器对应行 */
  onErrorLineClick?: (line: number) => void;
  /** 一键修复按钮（只在有错误时显示） */
  onFixError?: () => void;
  className?: string;
}

const LEVEL_STYLES: Record<string, { color: string; bg: string; icon?: string }> = {
  log:    { color: "text-foreground",             bg: "" },
  info:   { color: "text-blue-600 dark:text-blue-400", bg: "" },
  warn:   { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50/50 dark:bg-amber-950/20" },
  error:  { color: "text-red-600 dark:text-red-400",   bg: "bg-red-50/50 dark:bg-red-950/20" },
  result: { color: "text-green-600 dark:text-green-400", bg: "bg-green-50/50 dark:bg-green-950/20" },
};

export const ConsoleOutput = memo(function ConsoleOutput({
  entries, result, onClear, onErrorLineClick, onFixError, className,
}: ConsoleOutputProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries.length, result]);

  const hasError = result && !result.success;
  const isEmpty = entries.length === 0 && !result;

  return (
    <div className={`flex flex-col ${className || ""}`}>
      {/* 标题栏 */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-muted/30 border-b">
        <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">Console</span>
        <div className="flex items-center gap-1">
          {hasError && onFixError && (
            <button
              onClick={onFixError}
              className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-900/40 border border-red-200 dark:border-red-800 rounded transition-colors"
            >
              <Bug className="w-3 h-3" />
              AI 修复
            </button>
          )}
          {!isEmpty && (
            <button
              onClick={onClear}
              className="p-1 hover:bg-muted rounded transition-colors"
              title="清空控制台"
            >
              <Trash2 className="w-3 h-3 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* 输出区域 */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto font-mono text-xs leading-relaxed min-h-[60px] max-h-[300px]"
      >
        {isEmpty ? (
          <div className="flex items-center justify-center h-full text-muted-foreground/50 text-[11px]">
            点击 ▶ Run 查看输出
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {entries.map((entry) => {
              const style = LEVEL_STYLES[entry.level] || LEVEL_STYLES.log;
              return (
                <div
                  key={entry.id}
                  className={`px-3 py-1 ${style.bg} ${style.color} whitespace-pre-wrap break-all`}
                >
                  {entry.level === "warn" && <span className="mr-1">⚠</span>}
                  {entry.level === "error" && <span className="mr-1">✗</span>}
                  {entry.lineNumber && onErrorLineClick && (
                    <button
                      onClick={() => onErrorLineClick(entry.lineNumber!)}
                      className="mr-1 underline decoration-dotted hover:text-foreground"
                    >
                      [行 {entry.lineNumber}]
                    </button>
                  )}
                  {entry.content}
                </div>
              );
            })}

            {/* 返回值 */}
            {result?.returnValue && (
              <div className={`px-3 py-1 ${LEVEL_STYLES.result.color} ${LEVEL_STYLES.result.bg}`}>
                ← {result.returnValue}
              </div>
            )}

            {/* 错误信息 */}
            {hasError && result.error && (
              <div className={`px-3 py-2 ${LEVEL_STYLES.error.bg}`}>
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <span className="text-red-600 dark:text-red-400 font-medium">Error</span>
                    {result.errorLine && onErrorLineClick && (
                      <button
                        onClick={() => onErrorLineClick(result.errorLine!)}
                        className="ml-1.5 text-red-500/70 underline decoration-dotted hover:text-red-500 text-[10px]"
                      >
                        行 {result.errorLine}
                      </button>
                    )}
                    <pre className="mt-0.5 text-red-600 dark:text-red-400 whitespace-pre-wrap break-all">
                      {result.error}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            {/* 执行成功摘要 */}
            {result?.success && (
              <div className="px-3 py-1 text-muted-foreground/60 text-[10px]">
                ✓ 执行完成 ({result.durationMs}ms)
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
