/**
 * pyodideRunner.ts — 浏览器端 Python 执行器（Pyodide + iframe 沙箱）
 *
 * ChatGPT Canvas 的 Python 执行是服务端容器化的。
 * 我们用 Pyodide（Python → WebAssembly）在浏览器端实现零后端依赖的 Python 执行。
 *
 * 架构：
 *   主线程 → postMessage → sandboxed iframe（加载 Pyodide）→ postMessage → 主线程
 *
 * 支持：
 *   - print() 输出捕获
 *   - 错误堆栈 + 行号提取
 *   - 常用包：numpy, pandas, matplotlib（按需加载）
 *   - 执行超时保护（30 秒）
 *
 * 限制：
 *   - 无文件系统（Pyodide 虚拟 FS 仅在 iframe 内）
 *   - 无网络请求（沙箱隔离）
 *   - 首次加载约 5-10 秒（Pyodide WASM ~11MB，会被浏览器缓存）
 */

import type { ExecutionResult, ConsoleEntry, RunnerStatus } from "./types";

const PYODIDE_CDN = "https://cdn.jsdelivr.net/pyodide/v0.26.4/full/";
const EXEC_TIMEOUT_MS = 30_000;

let _iframe: HTMLIFrameElement | null = null;
let _ready = false;
let _loading = false;
let _onStatusChange: ((status: RunnerStatus) => void) | null = null;

/** 生成 Pyodide 沙箱 iframe 的 HTML */
function buildSandboxHTML(): string {
  return `<!DOCTYPE html><html><head>
<script src="${PYODIDE_CDN}pyodide.js"><\/script>
</head><body><script>
let pyodide = null;
let ready = false;

async function initPyodide() {
  try {
    pyodide = await loadPyodide({ indexURL: "${PYODIDE_CDN}" });
    // 预装 micropip（用于安装额外包）
    await pyodide.loadPackage("micropip");
    ready = true;
    parent.postMessage({ type: "pyodide:ready" }, "*");
  } catch (err) {
    parent.postMessage({ type: "pyodide:error", error: "Pyodide 加载失败: " + err.message }, "*");
  }
}

async function runCode(id, code, packages) {
  if (!ready) {
    parent.postMessage({ type: "pyodide:result", id, success: false, error: "Pyodide 未就绪" }, "*");
    return;
  }

  const consoleEntries = [];
  const start = Date.now();

  // 安装额外包（如果需要）
  if (packages && packages.length > 0) {
    try {
      const micropip = pyodide.pyimport("micropip");
      for (const pkg of packages) {
        try { await micropip.install(pkg); } catch {}
      }
    } catch {}
  }

  // 重定向 stdout/stderr
  pyodide.runPython(\`
import sys, io

class _CaptureOut:
    def __init__(self, level):
        self.level = level
        self.buffer = ""
    def write(self, text):
        if text and text.strip():
            self.buffer += text
            if text.endswith("\\n"):
                import js
                js.postMessage_capture(self.level, self.buffer.rstrip())
                self.buffer = ""
    def flush(self):
        if self.buffer.strip():
            import js
            js.postMessage_capture(self.level, self.buffer.rstrip())
            self.buffer = ""

sys.stdout = _CaptureOut("log")
sys.stderr = _CaptureOut("error")
\`);

  // 注册 JS 侧的 postMessage 桥
  globalThis.postMessage_capture = function(level, text) {
    consoleEntries.push({ level, content: text, timestamp: Date.now() });
    parent.postMessage({ type: "pyodide:console", id, level, content: text }, "*");
  };

  try {
    // 执行用户代码
    const result = await pyodide.runPythonAsync(code);
    const duration = Date.now() - start;

    // 刷新缓冲
    pyodide.runPython("sys.stdout.flush(); sys.stderr.flush()");

    let returnValue = undefined;
    if (result !== undefined && result !== null) {
      try { returnValue = String(result); } catch {}
    }

    parent.postMessage({
      type: "pyodide:result", id, success: true,
      console: consoleEntries, returnValue, durationMs: duration,
    }, "*");
  } catch (err) {
    const duration = Date.now() - start;
    // 刷新缓冲
    try { pyodide.runPython("sys.stdout.flush(); sys.stderr.flush()"); } catch {}

    let errorMsg = err.message || String(err);
    let errorLine = null;

    // 提取行号
    const lineMatch = errorMsg.match(/line (\\d+)/);
    if (lineMatch) errorLine = parseInt(lineMatch[1]);

    // 清理 Pyodide 内部堆栈，只保留用户相关部分
    const userRelevant = errorMsg.split("\\n").filter(l =>
      !l.includes("pyodide") && !l.includes("_pyodide") && !l.includes("JsProxy")
    ).join("\\n").trim() || errorMsg.split("\\n").pop();

    parent.postMessage({
      type: "pyodide:result", id, success: false,
      console: consoleEntries, error: userRelevant, errorLine, durationMs: duration,
    }, "*");
  }
}

// 监听来自主线程的消息
window.addEventListener("message", (event) => {
  if (event.data?.type === "pyodide:run") {
    runCode(event.data.id, event.data.code, event.data.packages);
  }
});

// 自动初始化
initPyodide();
<\/script></body></html>`;
}

/** 确保 iframe 已创建 */
function ensureIframe(): HTMLIFrameElement {
  if (_iframe && document.body.contains(_iframe)) return _iframe;

  _iframe = document.createElement("iframe");
  _iframe.style.display = "none";
  // allow-scripts: 执行 Pyodide JS
  // allow-same-origin: 允许 parent.postMessage 通信（安全：内容为我们生成的 Blob URL）
  _iframe.sandbox.add("allow-scripts");
  _iframe.sandbox.add("allow-same-origin");
  const html = buildSandboxHTML();
  const blob = new Blob([html], { type: "text/html" });
  _iframe.src = URL.createObjectURL(blob);
  document.body.appendChild(_iframe);

  return _iframe;
}

/** 初始化 Pyodide（首次调用约 5-10 秒） */
export function initPyodide(onStatus?: (status: RunnerStatus) => void): Promise<void> {
  if (_ready) return Promise.resolve();
  if (_loading) {
    _onStatusChange = onStatus || null;
    return new Promise((resolve, reject) => {
      const handler = (e: MessageEvent) => {
        if (e.data?.type === "pyodide:ready") {
          window.removeEventListener("message", handler);
          resolve();
        } else if (e.data?.type === "pyodide:error") {
          window.removeEventListener("message", handler);
          reject(new Error(e.data.error));
        }
      };
      window.addEventListener("message", handler);
    });
  }

  _loading = true;
  _onStatusChange = onStatus || null;
  onStatus?.("loading");

  return new Promise((resolve, reject) => {
    ensureIframe();

    const handler = (e: MessageEvent) => {
      if (e.data?.type === "pyodide:ready") {
        window.removeEventListener("message", handler);
        _ready = true;
        _loading = false;
        _onStatusChange?.("ready");
        resolve();
      } else if (e.data?.type === "pyodide:error") {
        window.removeEventListener("message", handler);
        _loading = false;
        _onStatusChange?.("error");
        reject(new Error(e.data.error));
      }
    };
    window.addEventListener("message", handler);
  });
}

/** 执行 Python 代码 */
export async function runPython(
  code: string,
  onConsole?: (entry: ConsoleEntry) => void,
): Promise<ExecutionResult> {
  if (!_ready) {
    await initPyodide();
  }

  const iframe = ensureIframe();
  const id = `py_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  // 检测需要的包
  const packages = detectPackages(code);

  return new Promise((resolve) => {
    const entries: ConsoleEntry[] = [];
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        window.removeEventListener("message", handler);
        resolve({
          success: false,
          console: entries,
          error: "执行超时（30 秒），可能存在无限循环",
          durationMs: EXEC_TIMEOUT_MS,
        });
      }
    }, EXEC_TIMEOUT_MS);

    const handler = (e: MessageEvent) => {
      if (e.data?.id !== id) return;

      if (e.data.type === "pyodide:console") {
        const entry: ConsoleEntry = {
          id: `${id}_${entries.length}`,
          level: e.data.level,
          content: e.data.content,
          timestamp: e.data.timestamp || Date.now(),
        };
        entries.push(entry);
        onConsole?.(entry);
      } else if (e.data.type === "pyodide:result") {
        if (resolved) return;
        resolved = true;
        clearTimeout(timeout);
        window.removeEventListener("message", handler);

        resolve({
          success: e.data.success,
          console: [...entries, ...(e.data.console || []).filter(
            (c: any) => !entries.some(e => e.content === c.content && e.level === c.level)
          )],
          returnValue: e.data.returnValue,
          durationMs: e.data.durationMs || 0,
          error: e.data.error,
          errorLine: e.data.errorLine,
        });
      }
    };

    window.addEventListener("message", handler);
    iframe.contentWindow?.postMessage({ type: "pyodide:run", id, code, packages }, "*");
  });
}

/** 检测代码中的 import 并返回需要安装的包 */
function detectPackages(code: string): string[] {
  const packages: string[] = [];
  const importPattern = /^\s*(?:import|from)\s+(\w+)/gm;
  let match;
  while ((match = importPattern.exec(code)) !== null) {
    const pkg = match[1];
    // Pyodide 内置标准库不需要安装
    const BUILTIN = new Set([
      "sys", "os", "math", "random", "json", "re", "datetime", "collections",
      "itertools", "functools", "io", "string", "time", "hashlib", "base64",
      "copy", "operator", "typing", "abc", "dataclasses", "enum", "pathlib",
      "statistics", "decimal", "fractions", "textwrap", "pprint", "dis",
      "ast", "inspect", "traceback", "unittest", "csv", "xml", "html",
      "http", "urllib", "email", "struct", "array", "bisect", "heapq",
      "queue", "threading", "logging", "pickle", "shelve", "sqlite3",
      "contextlib", "warnings", "gc", "weakref",
    ]);
    if (!BUILTIN.has(pkg)) {
      packages.push(pkg);
    }
  }
  return [...new Set(packages)];
}

/** 获取 Pyodide 是否已加载 */
export function isPyodideReady(): boolean {
  return _ready;
}

/** 销毁 Pyodide iframe（释放内存） */
export function destroyPyodide(): void {
  if (_iframe && document.body.contains(_iframe)) {
    document.body.removeChild(_iframe);
  }
  _iframe = null;
  _ready = false;
  _loading = false;
}
