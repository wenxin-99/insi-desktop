/**
 * CodeCanvas.tsx — 代码 Canvas 执行面板
 *
 * 对标 ChatGPT Canvas 的核心体验：
 *   1. 代码编辑器（行号 + 语法高亮基础版）
 *   2. ▶ Run 按钮 → 浏览器内执行 Python/JS/TS
 *   3. 控制台输出面板（log/error/warn）
 *   4. 错误 → AI 一键修复按钮
 *   5. 与聊天消息流无缝集成
 *
 * 支持的语言：
 *   - Python（Pyodide WebAssembly，首次加载 ~5s）
 *   - JavaScript（sandboxed iframe，即时可用）
 *   - TypeScript（类型擦除 → JS 执行）
 *   - HTML（已有 CodeSandboxPreview 处理，不在此组件中）
 *
 * 使用方式：
 *   <CodeCanvas
 *     code={code}
 *     language="python"
 *     onFixError={(ctx) => sendMessage(`修复这个错误: ${ctx.error}`)}
 *     onCodeChange={(newCode) => ...}
 *   />
 */

import { useState, useCallback, useRef, useEffect, memo } from "react";
import { Play, Square, Loader2, Copy, Check, Download, ChevronDown, ChevronUp, Bug, Maximize2, Minimize2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ConsoleOutput } from "./ConsoleOutput";
import { runPython, initPyodide, isPyodideReady } from "./pyodideRunner";
import { runJavaScript, runTypeScript } from "./jsRunner";
import type { SupportedLanguage, ConsoleEntry, ExecutionResult, RunnerStatus, FixErrorContext } from "./types";

// ═══════════ Props ═══════════

interface CodeCanvasProps {
  /** 初始代码 */
  code: string;
  /** 编程语言 */
  language: SupportedLanguage;
  /** 文件名（用于显示） */
  fileName?: string;
  /** 代码变更回调 */
  onCodeChange?: (code: string) => void;
  /** AI 一键修复回调 */
  onFixError?: (context: FixErrorContext) => void;
  /** 只读模式 */
  readOnly?: boolean;
  /** 自动展开控制台 */
  autoExpandConsole?: boolean;
}

// ═══════════ 语言配置 ═══════════

const LANG_CONFIG: Record<SupportedLanguage, { label: string; icon: string; color: string }> = {
  python:     { label: "Python",     icon: "🐍", color: "text-yellow-600 bg-yellow-50 dark:text-yellow-400 dark:bg-yellow-950/30" },
  javascript: { label: "JavaScript", icon: "JS", color: "text-amber-600 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/30" },
  typescript: { label: "TypeScript", icon: "TS", color: "text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-950/30" },
  html:       { label: "HTML",       icon: "🌐", color: "text-orange-600 bg-orange-50 dark:text-orange-400 dark:bg-orange-950/30" },
};

// ═══════════ 主组件 ═══════════

export const CodeCanvas = memo(function CodeCanvas({
  code: initialCode,
  language,
  fileName,
  onCodeChange,
  onFixError,
  readOnly = false,
  autoExpandConsole = false,
}: CodeCanvasProps) {
  const [code, setCode] = useState(initialCode);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [status, setStatus] = useState<RunnerStatus>("idle");
  const [showConsole, setShowConsole] = useState(autoExpandConsole);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineCountRef = useRef<HTMLDivElement>(null);

  const config = LANG_CONFIG[language] || LANG_CONFIG.javascript;
  const isRunnable = language !== "html"; // HTML 用 CodeSandboxPreview
  const isPython = language === "python";

  // 同步外部 code 变更
  useEffect(() => { setCode(initialCode); }, [initialCode]);

  // 行号同步滚动
  const syncScroll = useCallback(() => {
    if (textareaRef.current && lineCountRef.current) {
      lineCountRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  // ── 执行代码 ──
  const runCode = useCallback(async () => {
    if (status === "running") return;

    setConsoleEntries([]);
    setResult(null);
    setShowConsole(true);

    const onConsole = (entry: ConsoleEntry) => {
      setConsoleEntries(prev => [...prev, entry]);
    };

    try {
      if (isPython) {
        if (!isPyodideReady()) {
          setStatus("loading");
          await initPyodide((s) => setStatus(s));
        }
        setStatus("running");
        const execResult = await runPython(code, onConsole);
        setResult(execResult);
      } else if (language === "typescript") {
        setStatus("running");
        const execResult = await runTypeScript(code, onConsole);
        setResult(execResult);
      } else {
        setStatus("running");
        const execResult = await runJavaScript(code, onConsole);
        setResult(execResult);
      }
    } catch (err: any) {
      setResult({
        success: false,
        console: [],
        error: err.message || "执行失败",
        durationMs: 0,
      });
    } finally {
      setStatus("idle");
    }
  }, [code, language, isPython, status]);

  // ── AI 一键修复 ──
  const handleFixError = useCallback(() => {
    if (!result?.error || !onFixError) return;

    const consoleText = consoleEntries
      .map(e => `[${e.level}] ${e.content}`)
      .join("\n");

    onFixError({
      code,
      language,
      error: result.error,
      errorLine: result.errorLine,
      consoleOutput: consoleText,
    });
  }, [result, code, language, consoleEntries, onFixError]);

  // ── 编辑代码 ──
  const handleCodeChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newCode = e.target.value;
    setCode(newCode);
    onCodeChange?.(newCode);
  }, [onCodeChange]);

  // ── Tab 键支持 ──
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Tab") {
      e.preventDefault();
      const ta = e.currentTarget;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const newCode = code.substring(0, start) + "  " + code.substring(end);
      setCode(newCode);
      onCodeChange?.(newCode);
      requestAnimationFrame(() => {
        ta.selectionStart = ta.selectionEnd = start + 2;
      });
    }
    // Ctrl/Cmd + Enter = Run
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      runCode();
    }
  }, [code, onCodeChange, runCode]);

  // ── 复制 ──
  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [code]);

  // ── 下载 ──
  const handleDownload = useCallback(() => {
    const ext = language === "python" ? "py" : language === "typescript" ? "ts" : "js";
    const name = fileName || `code.${ext}`;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  }, [code, language, fileName]);

  // ── 行号计算 ──
  const lines = code.split("\n");
  const lineNumbers = lines.map((_, i) => i + 1);

  // ── 错误行高亮 ──
  const errorLine = result?.errorLine;

  const containerCls = isFullscreen
    ? "fixed inset-4 z-50 bg-background border border-border rounded-xl shadow-2xl flex flex-col"
    : "rounded-xl border border-border bg-background overflow-hidden flex flex-col";

  return (
    <>
      {isFullscreen && <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setIsFullscreen(false)} />}

      <div className={containerCls}>
        {/* ── 顶部工具栏 ── */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-muted/50 border-b">
          <div className="flex items-center gap-2">
            {/* 语言标签 */}
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${config.color}`}>
              {config.icon.length <= 2 ? <span className="font-mono">{config.icon}</span> : config.icon}
              {config.label}
            </span>
            {fileName && (
              <span className="text-[11px] text-muted-foreground font-mono">{fileName}</span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Run 按钮 */}
            {isRunnable && (
              <Button
                size="sm"
                onClick={status === "running" ? undefined : runCode}
                disabled={status === "running" || status === "loading"}
                className="h-6 px-2.5 text-[11px] gap-1 bg-green-600 hover:bg-green-700 text-white"
              >
                {status === "loading" ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />加载 Python...</>
                ) : status === "running" ? (
                  <><Loader2 className="w-3 h-3 animate-spin" />运行中</>
                ) : (
                  <><Play className="w-3 h-3" />Run</>
                )}
              </Button>
            )}

            {/* 工具按钮 */}
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleCopy} title="复制">
              {copied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={handleDownload} title="下载">
              <Download className="w-3 h-3" />
            </Button>
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0" onClick={() => setIsFullscreen(!isFullscreen)}>
              {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {/* ── 代码编辑器 ── */}
        <div className={`relative flex overflow-hidden ${isFullscreen ? "flex-1" : "max-h-[400px]"}`}>
          {/* 行号 */}
          <div
            ref={lineCountRef}
            className="flex-shrink-0 w-10 overflow-hidden bg-muted/30 border-r text-right select-none"
          >
            {lineNumbers.map(n => (
              <div
                key={n}
                className={`px-1.5 text-[11px] leading-[1.65rem] font-mono ${
                  errorLine === n
                    ? "bg-red-100 dark:bg-red-950/40 text-red-500 font-bold"
                    : "text-muted-foreground/40"
                }`}
              >
                {n}
              </div>
            ))}
          </div>

          {/* 代码文本区 */}
          <textarea
            ref={textareaRef}
            value={code}
            onChange={handleCodeChange}
            onKeyDown={handleKeyDown}
            onScroll={syncScroll}
            readOnly={readOnly}
            spellCheck={false}
            className={[
              "flex-1 resize-none outline-none bg-transparent p-3",
              "font-mono text-[13px] leading-[1.65rem] text-foreground",
              "overflow-y-auto whitespace-pre tab-size-2",
              readOnly ? "cursor-default" : "",
            ].join(" ")}
            style={{ minHeight: Math.min(lines.length * 26 + 24, isFullscreen ? 9999 : 400) }}
          />
        </div>

        {/* ── Ctrl+Enter 提示 ── */}
        {isRunnable && !showConsole && (
          <div className="px-3 py-1 border-t bg-muted/20 text-[10px] text-muted-foreground/50 flex items-center justify-between">
            <span>Ctrl+Enter 运行</span>
            {isPython && !isPyodideReady() && (
              <span className="text-amber-500">Python 引擎将在首次运行时加载（约 5 秒）</span>
            )}
          </div>
        )}

        {/* ── 控制台展开/折叠 ── */}
        {isRunnable && (
          <button
            onClick={() => setShowConsole(!showConsole)}
            className="flex items-center justify-between w-full px-3 py-1 border-t bg-muted/20 hover:bg-muted/40 transition-colors"
          >
            <span className="text-[11px] text-muted-foreground font-medium">
              Console
              {consoleEntries.length > 0 && (
                <span className="ml-1.5 text-[10px] opacity-60">({consoleEntries.length})</span>
              )}
              {result && !result.success && (
                <span className="ml-1.5 text-red-500 text-[10px]">● Error</span>
              )}
            </span>
            {showConsole ? <ChevronDown className="w-3 h-3 text-muted-foreground" /> : <ChevronUp className="w-3 h-3 text-muted-foreground" />}
          </button>
        )}

        {/* ── 控制台输出 ── */}
        {showConsole && isRunnable && (
          <ConsoleOutput
            entries={consoleEntries}
            result={result}
            onClear={() => { setConsoleEntries([]); setResult(null); }}
            onErrorLineClick={(line) => {
              // 滚动编辑器到错误行
              if (textareaRef.current) {
                const lineHeight = 26;
                textareaRef.current.scrollTop = (line - 1) * lineHeight;
                textareaRef.current.focus();
                // 选中错误行
                const lineStarts = code.split("\n").reduce<number[]>((acc, l, i) => {
                  acc.push(i === 0 ? 0 : acc[i - 1] + code.split("\n")[i - 1].length + 1);
                  return acc;
                }, []);
                if (lineStarts[line - 1] !== undefined) {
                  const start = lineStarts[line - 1];
                  const end = start + (code.split("\n")[line - 1]?.length || 0);
                  textareaRef.current.setSelectionRange(start, end);
                }
              }
            }}
            onFixError={onFixError ? handleFixError : undefined}
            className={isFullscreen ? "flex-shrink-0 h-[200px]" : ""}
          />
        )}
      </div>
    </>
  );
});

// ═══════════ 工具函数 ═══════════

/** 判断代码语言是否支持浏览器内执行 */
export function isRunnableInBrowser(language: string): boolean {
  const lang = language.toLowerCase();
  return ["python", "javascript", "js", "typescript", "ts"].includes(lang);
}

/** 从文件名推断语言 */
export function inferLanguage(fileName: string): SupportedLanguage {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  switch (ext) {
    case "py": return "python";
    case "ts": case "tsx": return "typescript";
    case "js": case "jsx": return "javascript";
    case "html": case "htm": return "html";
    default: return "javascript";
  }
}

/** 从代码内容推断语言 */
export function inferLanguageFromCode(code: string): SupportedLanguage {
  // Python 特征
  if (/^\s*(?:def |class |import |from |print\(|if __name__)/m.test(code)) return "python";
  // TypeScript 特征
  if (/(?:interface |type |\?: |: string|: number|: boolean|<[A-Z]\w*>)/m.test(code)) return "typescript";
  // HTML 特征
  if (/<!DOCTYPE|<html|<head|<body/i.test(code)) return "html";
  // 默认 JavaScript
  return "javascript";
}
