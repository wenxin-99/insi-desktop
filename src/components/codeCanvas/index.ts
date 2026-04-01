/**
 * codeCanvas — 浏览器端代码执行 Canvas
 *
 * 对标 ChatGPT Canvas 的代码运行能力。
 */
export { CodeCanvas, isRunnableInBrowser, inferLanguage, inferLanguageFromCode } from "./CodeCanvas";
export { ConsoleOutput } from "./ConsoleOutput";
export { runPython, initPyodide, isPyodideReady, destroyPyodide } from "./pyodideRunner";
export { runJavaScript, runTypeScript } from "./jsRunner";
export type {
  SupportedLanguage, ConsoleEntry, ConsoleLevel,
  ExecutionResult, RunnerStatus, FixErrorContext,
} from "./types";
