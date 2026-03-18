/**
 * sandboxPanel/CodeEditor.tsx — 代码编辑器（方案A：跟随主题）
 *
 * ★ 修复：Monaco CDN 加载失败时回退到 <pre>，不再永远 "Loading..."
 */
import { useMemo, lazy, Suspense } from "react";
import { Code2 } from "lucide-react";
import type { CodeState } from "@/hooks/useSandboxSocket";

// Monaco 懒加载（CDN 失败时不阻塞整个组件）
const LazyMonaco = lazy(() =>
  import("@monaco-editor/react").catch(() => ({
    default: () => null as any, // 加载失败返回空组件
  }))
);

/** 纯文本回退编辑器（Monaco 不可用时） */
function PlainCodeView({ code, language, filename }: { code: string; language: string; filename: string }) {
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-mono text-purple-400">
          <Code2 className="w-3 h-3" />
          <span>{filename || "output"}</span>
          {language && <span className="text-purple-500/40">({language})</span>}
        </div>
      </div>
      <pre className="flex-1 overflow-auto p-4 text-[13px] leading-6 font-mono text-[#d4d4d4] whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  );
}

export function CodeEditor({ code }: { code: CodeState }) {
  const monacoLanguage = useMemo(() => {
    const langMap: Record<string, string> = {
      markdown: "markdown", javascript: "javascript", typescript: "typescript",
      python: "python", json: "json", html: "html", css: "css",
      text: "plaintext", bash: "shell", shell: "shell", sql: "sql",
      yaml: "yaml", xml: "xml", ini: "ini",
    };
    return langMap[code.language] || "markdown";
  }, [code.language]);

  if (!code.code) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background relative overflow-hidden">
        <style>{`
          @keyframes code-fall {
            0% { transform: translateY(-100%); opacity: 0; }
            10% { opacity: 0.08; }
            90% { opacity: 0.08; }
            100% { transform: translateY(100vh); opacity: 0; }
          }
          .code-col {
            position: absolute; top: 0; font-family: monospace; font-size: 9px;
            color: currentColor; opacity: 0.05; writing-mode: vertical-rl;
            animation: code-fall linear infinite;
            pointer-events: none; user-select: none;
          }
        `}</style>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="code-col text-foreground"
            style={{ left: `${15 + i * 14}%`, animationDuration: `${7 + Math.random() * 8}s`, animationDelay: `${Math.random() * 5}s` }}>
            {'{}()=>const;let var fn return if else for while import export class interface type'.split(' ').sort(() => Math.random() - 0.5).join(' ')}
          </div>
        ))}

        <div className="relative z-10 text-center px-8">
          <div className="w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-purple-500/5 border border-purple-500/10">
            <Code2 className="w-7 h-7 text-purple-500/25" />
          </div>
          <p className="text-sm font-medium text-foreground/50 mb-1">Agent 尚未编辑代码</p>
          <p className="text-xs text-muted-foreground/40">
            修改文件或撰写报告时，内容将在此显示
          </p>
          <p className="text-[10px] text-muted-foreground/30 mt-3 bg-muted/30 rounded-full px-3 py-1 inline-block">
            💡 试试切换到终端或浏览器
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background">
      {/* 文件标签 */}
      <div className="flex items-center gap-1 px-2 py-1.5 bg-muted/30 border-b border-border/50 overflow-x-auto">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-mono bg-purple-500/5 border border-purple-500/15 text-purple-600 dark:text-purple-400">
          <Code2 className="w-3 h-3" />
          <span>{code.filename || "output"}</span>
          {code.language && <span className="text-purple-400/50 dark:text-purple-500/40">({code.language})</span>}
        </div>
        {code.history && code.history.length > 1 && (
          <span className="text-[10px] font-mono text-muted-foreground/40 ml-2">
            +{code.history.length - 1} versions
          </span>
        )}
      </div>
      <div className="flex-1">
        <Suspense fallback={<PlainCodeView code={code.code} language={code.language} filename={code.filename || "output"} />}>
          <LazyMonaco height="100%" language={monacoLanguage} value={code.code} theme="vs-dark"
            loading={<PlainCodeView code={code.code} language={code.language} filename={code.filename || "output"} />}
            options={{ readOnly: true, minimap: { enabled: false }, fontSize: 13, lineNumbers: "on",
              scrollBeyondLastLine: false, wordWrap: "on", automaticLayout: true, padding: { top: 8 },
              renderLineHighlight: "none", overviewRulerBorder: false, hideCursorInOverviewRuler: true,
              scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 } }} />
        </Suspense>
      </div>
    </div>
  );
}
