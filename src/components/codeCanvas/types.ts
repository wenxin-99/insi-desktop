/**
 * codeCanvas/types.ts — 代码执行结果和控制台类型
 */

export type SupportedLanguage = "python" | "javascript" | "typescript" | "html";

export type ConsoleLevel = "log" | "warn" | "error" | "info" | "result";

export interface ConsoleEntry {
  id: string;
  level: ConsoleLevel;
  content: string;
  timestamp: number;
  /** 错误的行号（可选） */
  lineNumber?: number;
}

export interface ExecutionResult {
  success: boolean;
  /** 控制台输出条目 */
  console: ConsoleEntry[];
  /** 最终返回值（如果有） */
  returnValue?: string;
  /** 执行耗时 ms */
  durationMs: number;
  /** 错误信息（如果失败） */
  error?: string;
  /** 错误行号 */
  errorLine?: number;
}

export type RunnerStatus = "idle" | "loading" | "running" | "ready" | "error";

/** 传给 AI 一键修复的上下文 */
export interface FixErrorContext {
  code: string;
  language: SupportedLanguage;
  error: string;
  errorLine?: number;
  consoleOutput: string;
}
