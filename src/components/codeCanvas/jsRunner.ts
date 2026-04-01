/**
 * jsRunner.ts — 浏览器端 JavaScript 执行器（sandboxed iframe）
 *
 * 在隔离的 iframe 中执行 JS 代码，捕获 console.log/warn/error 输出。
 * 比 Pyodide 轻量得多 — 无需额外加载，即时可用。
 *
 * 支持：
 *   - console.log/warn/error/info 完整捕获
 *   - 同步 + 异步代码（async/await）
 *   - 表达式求值（最后一个表达式的值作为 returnValue）
 *   - 错误堆栈 + 行号提取
 *   - 执行超时 10 秒
 *
 * TypeScript 通过简单的类型擦除（移除类型注解）支持，
 * 不做完整编译。复杂 TS 特性（enum, decorator 等）不支持。
 */

import type { ExecutionResult, ConsoleEntry } from "./types";

const JS_EXEC_TIMEOUT_MS = 10_000;

/** 构建 JS 执行沙箱的 HTML */
function buildJsSandboxHTML(code: string, id: string): string {
  // 对代码进行 JSON 编码，防止在 HTML 中注入
  const safeCode = JSON.stringify(code);

  return `<!DOCTYPE html><html><body><script>
const _id = ${JSON.stringify(id)};
const _entries = [];

function _capture(level, args) {
  const content = args.map(a => {
    if (a === undefined) return "undefined";
    if (a === null) return "null";
    if (typeof a === "object") {
      try { return JSON.stringify(a, null, 2); } catch { return String(a); }
    }
    return String(a);
  }).join(" ");

  _entries.push({ level, content, timestamp: Date.now() });
  parent.postMessage({ type: "js:console", id: _id, level, content }, "*");
}

// 劫持 console
const _origConsole = { ...console };
console.log = (...args) => _capture("log", args);
console.warn = (...args) => _capture("warn", args);
console.error = (...args) => _capture("error", args);
console.info = (...args) => _capture("info", args);

(async () => {
  const _start = Date.now();
  try {
    const _code = ${safeCode};
    // 用 AsyncFunction 执行（支持顶层 await）
    const _fn = new (Object.getPrototypeOf(async function(){}).constructor)(_code);
    const _result = await _fn();
    const _duration = Date.now() - _start;

    let returnValue;
    if (_result !== undefined) {
      try { returnValue = typeof _result === "object" ? JSON.stringify(_result, null, 2) : String(_result); }
      catch { returnValue = String(_result); }
    }

    parent.postMessage({
      type: "js:result", id: _id, success: true,
      console: _entries, returnValue, durationMs: _duration,
    }, "*");
  } catch (err) {
    const _duration = Date.now() - _start;
    let errorLine = null;
    const lineMatch = (err.stack || "").match(/<anonymous>:(\\d+)/);
    if (lineMatch) errorLine = parseInt(lineMatch[1]) - 2; // 减去 wrapper 行数

    parent.postMessage({
      type: "js:result", id: _id, success: false,
      console: _entries,
      error: err.message || String(err),
      errorLine: errorLine > 0 ? errorLine : null,
      durationMs: _duration,
    }, "*");
  }
})();
<\/script></body></html>`;
}

/** 执行 JavaScript 代码 */
export async function runJavaScript(
  code: string,
  onConsole?: (entry: ConsoleEntry) => void,
): Promise<ExecutionResult> {
  const id = `js_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  return new Promise((resolve) => {
    const entries: ConsoleEntry[] = [];
    let resolved = false;

    // 创建一次性 iframe
    const iframe = document.createElement("iframe");
    iframe.style.display = "none";
    iframe.sandbox.add("allow-scripts");
    iframe.sandbox.add("allow-same-origin");

    const cleanup = () => {
      try { URL.revokeObjectURL(iframe.src); } catch {}
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener("message", handler);
        cleanup();
        resolve({
          success: false,
          console: entries,
          error: "执行超时（10 秒），可能存在无限循环",
          durationMs: JS_EXEC_TIMEOUT_MS,
        });
      }
    }, JS_EXEC_TIMEOUT_MS);

    const handler = (e: MessageEvent) => {
      if (e.data?.id !== id) return;

      if (e.data.type === "js:console") {
        const entry: ConsoleEntry = {
          id: `${id}_${entries.length}`,
          level: e.data.level,
          content: e.data.content,
          timestamp: Date.now(),
        };
        entries.push(entry);
        onConsole?.(entry);
      } else if (e.data.type === "js:result") {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        window.removeEventListener("message", handler);
        cleanup();

        resolve({
          success: e.data.success,
          console: [...entries, ...(e.data.console || []).filter(
            (c: any) => !entries.some(ex => ex.content === c.content && ex.level === c.level)
          )],
          returnValue: e.data.returnValue,
          durationMs: e.data.durationMs || 0,
          error: e.data.error,
          errorLine: e.data.errorLine,
        });
      }
    };

    window.addEventListener("message", handler);

    // 加载 iframe
    const html = buildJsSandboxHTML(code, id);
    const blob = new Blob([html], { type: "text/html" });
    iframe.src = URL.createObjectURL(blob);
    document.body.appendChild(iframe);
  });
}

/**
 * 简单的 TypeScript → JavaScript 转换
 * 仅擦除类型注解，不做完整编译。
 * 支持：类型标注、接口、type alias、泛型参数、as 断言
 * 不支持：enum（运行时语义）、decorator、namespace
 */
export function stripTypeScript(code: string): string {
  let result = code;

  // 移除 interface/type 声明块
  result = result.replace(/^\s*(?:export\s+)?(?:interface|type)\s+\w+[\s\S]*?(?=\n(?:export|const|let|var|function|class|import|\s*$))/gm, "");

  // 移除函数参数和返回值的类型注解
  result = result.replace(/:\s*[\w<>\[\]|&'"`,\s{}()=>?]+(?=\s*[,)={])/g, "");

  // 移除泛型参数 <T, U>
  result = result.replace(/<[\w\s,extends]+>/g, "");

  // 移除 as Type 断言
  result = result.replace(/\s+as\s+[\w<>\[\]|&]+/g, "");

  // 移除 ! 非空断言
  result = result.replace(/(\w)!/g, "$1");

  return result;
}

/** 执行 TypeScript 代码（先擦除类型再执行） */
export async function runTypeScript(
  code: string,
  onConsole?: (entry: ConsoleEntry) => void,
): Promise<ExecutionResult> {
  const jsCode = stripTypeScript(code);
  return runJavaScript(jsCode, onConsole);
}
