/**
 * LaTeX 公式自动修复工具 v2
 *
 * 核心改进：
 * 1. $100, $50 等货币不误触发
 * 2. \( ... \) 和 \[ ... \] 转换为 $ ... $ 和 $$ ... $$
 * 3. 混合定界符 (…\) 和 \(…) 也能修复
 * 4. 代码块内的内容完全跳过
 * 5. 裸 LaTeX 命令（\frac{}{} 等）自动包裹 $
 * 6. \, \; \! 等非字母间距命令正确处理
 * 7. 流式安全：不完整内容不会产生误修复
 */

// ═══════ LaTeX 命令集 ═══════

const MATH_COMMANDS = new Set([
  // 运算符
  'div', 'times', 'pm', 'mp', 'cdot', 'ast', 'star', 'circ',
  'oplus', 'otimes', 'odot', 'cup', 'cap', 'setminus', 'land', 'lor',
  // 关系符
  'leq', 'geq', 'neq', 'approx', 'equiv', 'sim', 'cong', 'simeq',
  'le', 'ge', 'ne', 'propto', 'll', 'gg', 'subset', 'supset',
  'subseteq', 'supseteq', 'in', 'notin', 'ni',
  // 希腊字母
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta',
  'theta', 'vartheta', 'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi',
  'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma', 'tau', 'upsilon',
  'phi', 'varphi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon',
  'Phi', 'Psi', 'Omega',
  // 大运算符
  'sum', 'prod', 'coprod', 'int', 'iint', 'iiint', 'oint',
  'bigcup', 'bigcap', 'bigoplus', 'bigotimes',
  'lim', 'limsup', 'liminf', 'sup', 'inf',
  // 函数
  'sin', 'cos', 'tan', 'cot', 'sec', 'csc',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh',
  'log', 'ln', 'exp', 'max', 'min', 'arg', 'det', 'dim', 'gcd',
  // 箭头
  'to', 'rightarrow', 'leftarrow', 'leftrightarrow', 'Rightarrow',
  'Leftarrow', 'Leftrightarrow', 'mapsto', 'implies', 'iff',
  // 其他常用
  'infty', 'partial', 'nabla', 'forall', 'exists', 'neg', 'emptyset',
  'therefore', 'because', 'ldots', 'cdots', 'vdots', 'ddots',
  'quad', 'qquad',
]);

const PARAM_COMMANDS = new Set([
  'frac', 'dfrac', 'tfrac', 'cfrac', 'sqrt', 'root',
  'text', 'textbf', 'textit', 'textrm', 'mathrm', 'mathbf', 'mathit',
  'mathcal', 'mathbb', 'mathfrak', 'mathsf',
  'hat', 'bar', 'vec', 'dot', 'ddot', 'tilde', 'widehat', 'widetilde',
  'overline', 'underline', 'overbrace', 'underbrace',
  'binom', 'tbinom', 'dbinom', 'boxed', 'cancel',
]);

const DELIMITERS = new Set([
  'left', 'right', 'big', 'Big', 'bigg', 'Bigg',
  'langle', 'rangle', 'lfloor', 'rfloor', 'lceil', 'rceil',
]);

// 非字母间距命令（\, \; \! 等）
const SPACING_CHARS = new Set([',', ';', '!', ':', ' ']);

/**
 * 检测文本是否包含 LaTeX 数学命令（含 \, \; 等间距命令）
 */
function containsMathCommand(text: string): boolean {
  const re = /\\([a-zA-Z]+)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const cmd = m[1];
    if (MATH_COMMANDS.has(cmd) || PARAM_COMMANDS.has(cmd) || DELIMITERS.has(cmd)) {
      return true;
    }
  }
  // 检查非字母间距命令 \, \; \!
  if (/\\[,;!:]/.test(text)) return true;
  // 上下标
  if (/[_^]\{/.test(text) || /[_^]\w/.test(text)) return true;
  return false;
}

/**
 * 按代码块分割 Markdown
 */
function splitByCodeBlocks(markdown: string): Array<{ inCode: boolean; text: string }> {
  const parts: Array<{ inCode: boolean; text: string }> = [];
  const lines = markdown.split('\n');
  let inFence = false;
  let fenceMarker = '';
  let buffer: string[] = [];

  for (const line of lines) {
    if (!inFence) {
      const openMatch = line.match(/^(`{3,})(\w*.*)$/);
      if (openMatch) {
        if (buffer.length > 0) {
          parts.push({ inCode: false, text: buffer.join('\n') });
          buffer = [];
        }
        inFence = true;
        fenceMarker = openMatch[1];
        buffer.push(line);
      } else {
        buffer.push(line);
      }
    } else {
      buffer.push(line);
      if (line.trimEnd() === fenceMarker) {
        parts.push({ inCode: true, text: buffer.join('\n') });
        buffer = [];
        inFence = false;
        fenceMarker = '';
      }
    }
  }
  if (buffer.length > 0) {
    parts.push({ inCode: inFence, text: buffer.join('\n') });
  }
  return parts;
}

/**
 * 修复行内代码外的 LaTeX
 */
function fixLatexInLine(line: string): string {
  const parts: string[] = [];
  let lastIdx = 0;
  const inlineCodeRe = /`[^`]+`/g;
  let m: RegExpExecArray | null;

  while ((m = inlineCodeRe.exec(line)) !== null) {
    if (m.index > lastIdx) {
      parts.push(fixLatexSegment(line.slice(lastIdx, m.index)));
    }
    parts.push(m[0]);
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < line.length) {
    parts.push(fixLatexSegment(line.slice(lastIdx)));
  }
  return parts.join('');
}

/**
 * 构建 LaTeX 命令匹配模式（含 \, \; 等间距命令）
 */
function buildLatexPattern(): string {
  const allCommands = [...MATH_COMMANDS, ...PARAM_COMMANDS, ...DELIMITERS];
  const cmdPattern = allCommands.map(cmd => `\\\\${cmd}`).join('|');
  const specialPatterns = [
    '\\\\text\\{[^}]+\\}',                      // \text{...}
    '\\\\frac\\{[^}]*\\}\\{[^}]*\\}',           // \frac{...}{...}
    '\\\\sqrt(?:\\[[^\\]]+\\])?\\{[^}]*\\}',     // \sqrt{...} or \sqrt[n]{...}
    '\\\\[,;!:]',                                 // \, \; \! \:
  ];
  return `(?:${cmdPattern}|${specialPatterns.join('|')})`;
}

const LATEX_PATTERN = buildLatexPattern();

/**
 * 修复一段非代码文本中的 LaTeX
 */
function fixLatexSegment(text: string): string {
  let fixed = text;

  // Step 1: 同时有 \( 和 \) → $ ... $
  fixed = fixed.replace(
    new RegExp(`\\\\\\(([^)]*(?:${LATEX_PATTERN})[^)]*)\\\\\\)`, 'g'),
    (_, p1) => `($${p1}$)`
  );

  // Step 2: (... \) — 左括号普通，右括号转义
  fixed = fixed.replace(
    new RegExp(`\\(([^)]*(?:${LATEX_PATTERN})[^)]*)\\\\\\)`, 'g'),
    (_, p1) => `($${p1}$)`
  );

  // Step 3: \( ...) — 左括号转义，右括号普通
  fixed = fixed.replace(
    new RegExp(`\\\\\\(([^)]*(?:${LATEX_PATTERN})[^)]*)\\)`, 'g'),
    (_, p1) => `($${p1}$)`
  );

  // Step 4: \[ ... \] → $$ ... $$
  fixed = fixed.replace(/\\\[([\s\S]*?)\\\]/g, (_, inner) => `$$${inner}$$`);

  // Step 5: 检查是否已有 $ 定界符 → 如果有，跳过后续自动包裹
  if (/\$[^$]+\$|\$\$[^$]+\$\$/.test(fixed)) {
    return fixed;
  }

  // Step 6: 括号内的 LaTeX 表达式
  fixed = fixed.replace(
    new RegExp(`\\(([^)]*(?:${LATEX_PATTERN})[^)]*)\\)`, 'g'),
    (_, p1) => `($${p1}$)`
  );

  // Step 7: 裸 LaTeX 表达式自动包裹
  if (containsMathCommand(fixed) && !/\$/.test(fixed)) {
    fixed = wrapBareMathExpressions(fixed);
  }

  return fixed;
}

/**
 * 检查字符串中某个位置是否已经在 $...$ 内
 */
function isInsideDollarSigns(text: string, offset: number): boolean {
  const before = text.substring(0, offset);
  const dollarsBefore = (before.match(/\$/g) || []).length;
  return dollarsBefore % 2 === 1;
}

/**
 * 包裹不在 $ 内的裸 LaTeX 数学表达式
 */
function wrapBareMathExpressions(text: string): string {
  return text.replace(
    new RegExp(
      `(?:^|(?<=[^$]))` +           // 前面不是 $
      `([\\d\\s]*` +                 // 可选前缀数字/空格
      `(?:${LATEX_PATTERN})` +       // 至少一个 LaTeX 命令
      `[\\d\\s+\\-*/=<>().,]*` +     // 后续内容
      `(?:(?:${LATEX_PATTERN})[\\d\\s+\\-*/=<>().,]*)*` + // 更多命令
      `)` +
      `(?=[^$]|$)`,                  // 后面不是 $
      'g'
    ),
    (match, p1, offset, str) => {
      if (isInsideDollarSigns(str, offset)) return match;
      const trimmed = p1.trim();
      if (!trimmed || !containsMathCommand(trimmed)) return match;
      // 避免误匹配转义符
      if (/^\\[nrt]$/.test(trimmed)) return match;
      return `$${trimmed}$`;
    }
  );
}

/**
 * 智能修复 LaTeX 公式（主入口）
 */
export function smartFixLatex(text: string): string {
  if (!text) return text;
  if (!text.includes('\\')) return text;

  const parts = splitByCodeBlocks(text);

  return parts.map(part => {
    if (part.inCode) return part.text;
    return part.text.split('\n').map(line => {
      if (line.trim().startsWith('$$')) return line;
      return fixLatexInLine(line);
    }).join('\n');
  }).join('\n');
}

/**
 * 检测文本中是否包含 LaTeX 命令
 */
export function hasLatexCommands(text: string): boolean {
  if (!text) return false;
  return containsMathCommand(text);
}
