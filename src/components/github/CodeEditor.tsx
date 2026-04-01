/**
 * CodeEditor — CodeMirror 6 代码编辑器
 *
 * 特性:
 *   - 语法高亮 (JS/TS/Python/JSON/HTML/CSS/Markdown/Go/Rust/Shell)
 *   - 行号 + 代码折叠
 *   - 暗色/亮色主题自适应
 *   - 可编辑/只读模式切换
 *   - Ctrl+S 保存快捷键
 *
 * 依赖: pnpm add @uiw/react-codemirror
 *   @codemirror/lang-javascript @codemirror/lang-json
 *   @codemirror/lang-python @codemirror/lang-html
 *   @codemirror/lang-css @codemirror/lang-markdown
 */
import { useCallback, useMemo, useState, useEffect } from "react";
import CodeMirror from "@uiw/react-codemirror";
import { javascript } from "@codemirror/lang-javascript";
import { json } from "@codemirror/lang-json";
import { python } from "@codemirror/lang-python";
import { html } from "@codemirror/lang-html";
import { css } from "@codemirror/lang-css";
import { markdown } from "@codemirror/lang-markdown";
import { EditorView, keymap } from "@codemirror/view";

function getLanguageExtension(lang: string) {
  switch (lang) {
    case "typescript":
    case "tsx":
      return javascript({ typescript: true, jsx: true });
    case "javascript":
    case "jsx":
      return javascript({ jsx: true });
    case "python":
      return python();
    case "json":
      return json();
    case "html":
    case "xml":
    case "vue":
    case "svelte":
      return html();
    case "css":
    case "scss":
    case "less":
      return css();
    case "markdown":
      return markdown();
    default:
      return javascript(); // 默认用 JS（覆盖大部分 C-like 语言）
  }
}

interface CodeEditorProps {
  value: string;
  language: string;
  readOnly?: boolean;
  onChange?: (value: string) => void;
  onSave?: (value: string) => void;
  height?: string;
  className?: string;
}

export function CodeEditor({
  value,
  language,
  readOnly = false,
  onChange,
  onSave,
  height = "100%",
  className,
}: CodeEditorProps) {
  const langExt = useMemo(() => getLanguageExtension(language), [language]);

  const saveKeymap = useMemo(
    () =>
      keymap.of([
        {
          key: "Mod-s",
          run: (view) => {
            onSave?.(view.state.doc.toString());
            return true;
          },
        },
      ]),
    [onSave]
  );

  const handleChange = useCallback(
    (val: string) => {
      onChange?.(val);
    },
    [onChange]
  );

  // 响应式暗色模式检测
  const [isDark, setIsDark] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-color-scheme: dark)").matches
  );

  useEffect(() => {
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!mq) return;
    const handler = (e: MediaQueryListEvent) => setIsDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return (
    <CodeMirror
      value={value}
      height={height}
      theme={isDark ? "dark" : "light"}
      extensions={[langExt, saveKeymap, EditorView.lineWrapping]}
      onChange={handleChange}
      readOnly={readOnly}
      className={className}
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: !readOnly,
        highlightSelectionMatches: true,
        bracketMatching: true,
        closeBrackets: !readOnly,
        autocompletion: !readOnly,
        indentOnInput: !readOnly,
      }}
    />
  );
}
