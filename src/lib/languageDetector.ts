/**
 * 语言自动检测工具
 * 
 * 当代码块没有指定语言标识符时，根据代码内容自动推测编程语言
 */

interface LanguagePattern {
  language: string;
  patterns: RegExp[];
  keywords?: string[];
}

const languagePatterns: LanguagePattern[] = [
  // JavaScript/TypeScript
  {
    language: "javascript",
    patterns: [
      /\b(const|let|var|function|async|await|=>|import|export|require)\b/,
      /\bconsole\.(log|error|warn|info)\b/,
      /\b(document|window|navigator)\./,
      /\bnew\s+(Promise|Array|Object|Map|Set)\b/,
    ],
    keywords: ["const", "let", "var", "function", "async", "await"],
  },
  {
    language: "typescript",
    patterns: [
      /:\s*(string|number|boolean|any|void|never|unknown)\b/,
      /\binterface\s+\w+/,
      /\btype\s+\w+\s*=/,
      /\benum\s+\w+/,
      /<\w+>/,
    ],
    keywords: ["interface", "type", "enum", "readonly", "private", "public"],
  },
  // Python
  {
    language: "python",
    patterns: [
      /\bdef\s+\w+\s*\(/,
      /\bclass\s+\w+\s*:/,
      /\bimport\s+\w+/,
      /\bfrom\s+\w+\s+import/,
      /\bif\s+__name__\s*==\s*['"]__main__['"]/,
      /\bprint\s*\(/,
      /\b(True|False|None)\b/,
    ],
    keywords: ["def", "class", "import", "from", "if", "elif", "else", "for", "while"],
  },
  // Java
  {
    language: "java",
    patterns: [
      /\bpublic\s+(class|interface|enum)\s+\w+/,
      /\bprivate\s+(static\s+)?(void|int|String|boolean)\s+\w+/,
      /\bSystem\.out\.(println|print)\b/,
      /\bnew\s+\w+\s*\(/,
      /\bpackage\s+[\w.]+;/,
    ],
    keywords: ["public", "private", "protected", "class", "interface", "extends", "implements"],
  },
  // C/C++
  {
    language: "cpp",
    patterns: [
      /\b#include\s*<\w+>/,
      /\bint\s+main\s*\(/,
      /\bstd::/,
      /\bprintf\s*\(/,
      /\bcout\s*<<|cin\s*>>/,
    ],
    keywords: ["#include", "int", "void", "char", "float", "double", "struct"],
  },
  // PHP
  {
    language: "php",
    patterns: [
      /^<\?php/,
      /\$\w+\s*=/,
      /\bfunction\s+\w+\s*\(/,
      /\becho\s+/,
      /\b(public|private|protected)\s+function/,
    ],
    keywords: ["<?php", "echo", "function", "$"],
  },
  // Ruby
  {
    language: "ruby",
    patterns: [
      /\bdef\s+\w+/,
      /\bclass\s+\w+/,
      /\bend\b/,
      /\bputs\s+/,
      /\brequire\s+['"][\w\/]+['"]/,
      /@\w+/,
    ],
    keywords: ["def", "class", "end", "puts", "require", "module"],
  },
  // Go
  {
    language: "go",
    patterns: [
      /\bpackage\s+\w+/,
      /\bfunc\s+\w+\s*\(/,
      /\bimport\s+\(/,
      /\bfmt\.(Println|Printf)\b/,
      /:=/,
    ],
    keywords: ["package", "func", "import", "var", "const", "type", "struct"],
  },
  // Rust
  {
    language: "rust",
    patterns: [
      /\bfn\s+\w+\s*\(/,
      /\blet\s+(mut\s+)?\w+/,
      /\bprintln!\s*\(/,
      /\buse\s+\w+::/,
      /\bimpl\s+\w+/,
    ],
    keywords: ["fn", "let", "mut", "use", "impl", "trait", "struct"],
  },
  // SQL
  {
    language: "sql",
    patterns: [
      /\bSELECT\s+.+\s+FROM\b/i,
      /\bINSERT\s+INTO\b/i,
      /\bUPDATE\s+\w+\s+SET\b/i,
      /\bDELETE\s+FROM\b/i,
      /\bCREATE\s+(TABLE|DATABASE|INDEX)\b/i,
      /\bWHERE\s+/i,
    ],
    keywords: ["SELECT", "FROM", "WHERE", "INSERT", "UPDATE", "DELETE", "CREATE", "TABLE"],
  },
  // HTML
  {
    language: "html",
    patterns: [
      /<!DOCTYPE\s+html>/i,
      /<html[^>]*>/i,
      /<(div|span|p|a|img|table|form|input|button)[^>]*>/i,
      /<\/\w+>/,
    ],
    keywords: ["<!DOCTYPE", "<html", "<head", "<body", "<div"],
  },
  // CSS
  {
    language: "css",
    patterns: [
      /\.\w+\s*\{/,
      /#\w+\s*\{/,
      /\w+\s*:\s*[^;]+;/,
      /@media\s+/,
      /@import\s+/,
    ],
    keywords: ["color:", "background:", "font-", "margin:", "padding:"],
  },
  // JSON
  {
    language: "json",
    patterns: [
      /^\s*\{/,
      /"\w+"\s*:\s*[{\["]/,
      /^\s*\[/,
    ],
    keywords: [],
  },
  // YAML
  {
    language: "yaml",
    patterns: [
      /^\w+:\s*$/m,
      /^\s+-\s+\w+/m,
      /^---$/m,
    ],
    keywords: [],
  },
  // Bash/Shell
  {
    language: "bash",
    patterns: [
      /^#!/,
      /\becho\s+/,
      /\bif\s+\[\s+/,
      /\bfor\s+\w+\s+in\s+/,
      /\$\{?\w+\}?/,
    ],
    keywords: ["#!/bin/bash", "echo", "if", "then", "fi", "for", "do", "done"],
  },
];

/**
 * 检测代码语言
 * @param code 代码内容
 * @returns 检测到的语言，如果无法检测则返回空字符串
 */
export function detectLanguage(code: string): string {
  if (!code || code.trim().length === 0) {
    return "";
  }

  const scores: Record<string, number> = {};

  // 遍历所有语言模式
  for (const { language, patterns, keywords } of languagePatterns) {
    let score = 0;

    // 检查正则表达式模式
    for (const pattern of patterns) {
      if (pattern.test(code)) {
        score += 2; // 每个匹配的模式得2分
      }
    }

    // 检查关键词
    if (keywords) {
      for (const keyword of keywords) {
        if (code.includes(keyword)) {
          score += 1; // 每个匹配的关键词得1分
        }
      }
    }

    if (score > 0) {
      scores[language] = score;
    }
  }

  // 找到得分最高的语言
  let maxScore = 0;
  let detectedLanguage = "";

  for (const [language, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      detectedLanguage = language;
    }
  }

  // 如果得分太低（小于3），认为检测不可靠，返回空字符串
  if (maxScore < 3) {
    return "";
  }

  return detectedLanguage;
}
