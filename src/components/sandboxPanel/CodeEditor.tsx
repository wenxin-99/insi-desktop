/**
 * sandboxPanel/CodeEditor.tsx — 代码编辑器（方案A：跟随主题）
 *
 * ★ 修复：Monaco CDN 加载失败时回退到 <pre>，不再永远 "Loading..."
 */
import { useMemo, lazy, Suspense } from "react";
import { Code2 } from "lucide-react";
import type { CodeState } from "@/hooks/useSandboxSocket";
import { useShikiHighlight } from '@/components/HighlightedCode';

// Monaco 懒加载（CDN 失败时不阻塞整个组件）
const LazyMonaco = lazy(() =>
  import("@monaco-editor/react").catch(() => ({
    default: () => null as any, // 加载失败返回空组件
  }))
);

/* ── 轻量语法着色（与 CanvasEditor 相同方案） ── */
const TOKEN_RULES: Array<{ re: RegExp; cls: string }> = [
  { re: /\/\/[^\n]*/g, cls: 'ce-cmt' },
  { re: /\/\*[\s\S]*?\*\//g, cls: 'ce-cmt' },
  { re: /<!--[\s\S]*?-->/g, cls: 'ce-cmt' },
  { re: /"(?:[^"\\]|\\.)*"/g, cls: 'ce-str' },
  { re: /'(?:[^'\\]|\\.)*'/g, cls: 'ce-str' },
  { re: /`(?:[^`\\]|\\.)*`/g, cls: 'ce-str' },
  { re: /&lt;\/?([a-zA-Z][\w-]*)/g, cls: 'ce-tag' },
  { re: /\b(const|let|var|function|return|if|else|for|while|import|export|from|class|extends|new|this|async|await|try|catch|throw|typeof|true|false|null|undefined)\b/g, cls: 'ce-kw' },
  { re: /\b(display|position|margin|padding|border|background|color|font|width|height|top|left|right|bottom|flex|grid|gap|overflow|transition|animation|transform|opacity)(?=\s*:)/g, cls: 'ce-css' },
  { re: /\b\d+\.?\d*(px|em|rem|%|vh|vw|s|ms|deg)?\b/g, cls: 'ce-num' },
  { re: /#[0-9a-fA-F]{3,8}\b/g, cls: 'ce-num' },
];
function escapeHtml(s: string) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function tokenize(code: string): string {
  const esc = escapeHtml(code);
  const spans: Array<{ start: number; end: number; cls: string }> = [];
  for (const rule of TOKEN_RULES) {
    const re = new RegExp(rule.re.source, rule.re.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(esc)) !== null) {
      const s = m.index, e = m.index + m[0].length;
      if (!spans.some(sp => !(e <= sp.start || s >= sp.end))) spans.push({ start: s, end: e, cls: rule.cls });
    }
  }
  spans.sort((a, b) => a.start - b.start);
  let result = '', cursor = 0;
  for (const sp of spans) {
    if (sp.start > cursor) result += esc.slice(cursor, sp.start);
    result += `<span class="${sp.cls}">${esc.slice(sp.start, sp.end)}</span>`;
    cursor = sp.end;
  }
  if (cursor < esc.length) result += esc.slice(cursor);
  return result;
}

/* ★ 深色滚动条 CSS（共享给 PlainCodeView） */
const DARK_SCROLLBAR_CSS = `
.dark-scroll::-webkit-scrollbar{width:8px;height:8px}
.dark-scroll::-webkit-scrollbar-track{background:transparent}
.dark-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.15);border-radius:4px}
.dark-scroll::-webkit-scrollbar-thumb:hover{background:rgba(255,255,255,.25)}
.dark-scroll::-webkit-scrollbar-corner{background:transparent}
.ce-cmt{color:#6c7086;font-style:italic}.ce-str{color:#a6e3a1}
.ce-tag{color:#89b4fa}.ce-kw{color:#cba6f7}.ce-css{color:#89dceb}.ce-num{color:#fab387}
`;

/** 纯文本回退编辑器（Monaco 不可用时）★ 带 Shiki 高亮 + 行号 + 可见滚动条 */
function PlainCodeView({ code, language, filename }: { code: string; language: string; filename: string }) {
  const lines = code.split('\n');
  const fallbackHtml = lines.length < 8000 ? tokenize(code) : escapeHtml(code);
  const highlighted = useShikiHighlight(code, language, fallbackHtml);
  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <style dangerouslySetInnerHTML={{ __html: DARK_SCROLLBAR_CSS }} />
      <div className="flex items-center gap-1 px-2 py-1.5 bg-[#252526] border-b border-[#3c3c3c] overflow-x-auto">
        <div className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-mono text-purple-400">
          <Code2 className="w-3 h-3" />
          <span>{filename || "output"}</span>
          {language && <span className="text-purple-500/40">({language})</span>}
        </div>
      </div>
      <div className="flex flex-1 overflow-hidden">
        {/* 行号 */}
        <div className="flex-shrink-0 overflow-hidden select-none bg-[#1e1e1e] border-r border-white/5 py-3 px-1" style={{ width: 44 }}>
          {lines.map((_, i) => (
            <div key={i} className="text-right pr-2 text-[11px] leading-[20px] text-[#6c7086] font-mono">{i + 1}</div>
          ))}
        </div>
        {/* 代码 */}
        <pre className="dark-scroll flex-1 overflow-auto p-3 text-[13px] leading-[20px] font-mono text-[#d4d4d4] whitespace-pre m-0"
          dangerouslySetInnerHTML={{ __html: highlighted + '\n' }}
        />
      </div>
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
