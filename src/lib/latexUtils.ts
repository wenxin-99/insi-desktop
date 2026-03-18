/**
 * LaTeX公式自动修复工具
 * 
 * 用于检测和修复未被$符号包裹的LaTeX命令
 */

/**
 * 常见的LaTeX命令列表
 */
const LATEX_COMMANDS = {
  // 基础运算符
  operators: ['div', 'times', 'pm', 'mp', 'cdot', 'ast', 'star'],
  // 关系符
  relations: ['leq', 'geq', 'neq', 'approx', 'equiv', 'sim', 'cong'],
  // 希腊字母
  greekLetters: [
    'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'zeta', 'eta', 'theta',
    'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'rho', 'sigma',
    'tau', 'upsilon', 'phi', 'chi', 'psi', 'omega',
    'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon',
    'Phi', 'Psi', 'Omega'
  ],
  // 求和、积分等
  bigOperators: ['sum', 'prod', 'int', 'oint', 'bigcup', 'bigcap', 'lim'],
  // 函数
  functions: ['sin', 'cos', 'tan', 'log', 'ln', 'exp', 'max', 'min'],
  // 空格命令
  spaces: [',', ':', ';', '!', 'quad', 'qquad'],
};

/**
 * 构建LaTeX命令的正则表达式模式
 */
function buildLatexPattern(): string {
  const allCommands = [
    ...LATEX_COMMANDS.operators,
    ...LATEX_COMMANDS.relations,
    ...LATEX_COMMANDS.greekLetters,
    ...LATEX_COMMANDS.bigOperators,
    ...LATEX_COMMANDS.functions,
    ...LATEX_COMMANDS.spaces,
  ];
  
  // 转义反斜杠，构建命令模式
  const commandPattern = allCommands.map(cmd => `\\\\${cmd}`).join('|');
  
  // 添加特殊结构模式
  const specialPatterns = [
    '\\\\text\\{[^}]+\\}',       // \text{...}
    '\\\\frac\\{[^}]+\\}\\{[^}]+\\}',  // \frac{...}{...}
    '\\\\sqrt(?:\\[[^\\]]+\\])?\\{[^}]+\\}',  // \sqrt{...} 或 \sqrt[n]{...}
  ];
  
  return `(?:${commandPattern}|${specialPatterns.join('|')})`;
}

/**
 * 检查字符串中某个位置是否已经在$...$内
 */
function isInsideDollarSigns(text: string, offset: number): boolean {
  const before = text.substring(0, offset);
  const dollarsBefore = (before.match(/\$/g) || []).length;
  return dollarsBefore % 2 === 1;
}

/**
 * 智能修复LaTeX公式
 * 
 * 只包裹明确的数学表达式，避免误包裹普通文本
 * 
 * @param text 原始文本
 * @returns 修复后的文本
 */
export function smartFixLatex(text: string): string {
  if (!text) return text;
  
  let fixed = text;
  
  const latexPattern = buildLatexPattern();
  
  // 步骤1：修复同时有\(和\)的LaTeX表达式（最高优先级）
  // 例如：\(21 \div 7 \, \text{○} \, 7 \times 3\) -> ($21 \div 7 \, \text{○} \, 7 \times 3$)
  fixed = fixed.replace(
    new RegExp(`\\\\\\(([^)]*(?:${latexPattern})[^)]*)\\\\\\)`, 'g'),
    (match, p1) => `($${p1}$)`
  );
  
  // 步骤2：修复以\)结尾的LaTeX表达式
  // 例如：(21 \div 7 \, \text{○} \, 7 \times 3\) -> ($21 \div 7 \, \text{○} \, 7 \times 3$)
  fixed = fixed.replace(
    new RegExp(`\\(([^)]*(?:${latexPattern})[^)]*)\\\\\\)`, 'g'),
    (match, p1) => `($${p1}$)`
  );
  
  // 步骤3：修复以\(开头的LaTeX表达式
  // 例如：\(21 \div 7 \, \text{○} \, 7 \times 3) -> ($21 \div 7 \, \text{○} \, 7 \times 3$)
  fixed = fixed.replace(
    new RegExp(`\\\\\\(([^)]*(?:${latexPattern})[^)]*)\\)`, 'g'),
    (match, p1) => `($${p1}$)`
  );
  
  // 检查是否已经有$符号包裹的公式
  const hasLatexDelimiters = /\$[^$]+\$|\$\$[^$]+\$\$/.test(fixed);
  if (hasLatexDelimiters) {
    // 如果已经有$符号，不再继续处理
    return fixed;
  }
  
  // 步骤4：检测并包裹括号内的LaTeX表达式
  // 例如：(21 \div 7 \, \text{○} \, 7 \times 3) -> ($21 \div 7 \, \text{○} \, 7 \times 3$)
  fixed = fixed.replace(
    new RegExp(`\\(([^)]*(?:${latexPattern})[^)]*)\\)`, 'g'),
    (match, p1) => `($${p1}$)`
  );
  
  // 步骤5：检测并包裹完整的数学表达式（包含多个运算符和比较符）
  // 例如：21 \div 7 < 7 \times 3 -> $21 \div 7 < 7 \times 3$
  fixed = fixed.replace(
    new RegExp(
      `(?<!\\$)` + // 前面不是$
      `([\\d\\s]*` + // 可选的数字和空格
      `(?:${latexPattern})` + // 至少一个LaTeX命令
      `[\\d\\s+\\-*/=<>()]*` + // 数字、运算符、比较符
      `(?:(?:${latexPattern})[\\d\\s+\\-*/=<>()]*)*` + // 可选的更多LaTeX命令和运算符
      `)` +
      `(?!\\$)`, // 后面不是$
      'g'
    ),
    (match, p1, offset, string) => {
      // 检查是否已经在$...$内
      if (isInsideDollarSigns(string, offset)) {
        return match;
      }
      
      // 清理多余的空格
      const cleaned = p1.trim();
      
      // 如果表达式太短（只有一个命令），单独包裹
      if (cleaned.length < 10 && !cleaned.includes(' ')) {
        return `$${cleaned}$`;
      }
      
      // 对于复杂表达式，包裹整个表达式
      return `$${cleaned}$`;
    }
  );
  
  // 步骤6：处理比较表达式的特殊情况
  // 例如：21 \div 7 < 7 \times 3
  fixed = fixed.replace(
    new RegExp(
      `(?<!\\$)` +
      `([\\d\\s]*(?:${latexPattern})[\\d\\s+\\-*/]*)` + // 左边表达式
      `\\s*([<>]=?)\\s*` + // 比较运算符
      `([\\d\\s]*(?:${latexPattern})[\\d\\s+\\-*/]*)` + // 右边表达式
      `(?!\\$)`,
      'g'
    ),
    (match, left, op, right, offset, string) => {
      // 检查是否已经在$...$内
      if (isInsideDollarSigns(string, offset)) {
        return match;
      }
      
      // 包裹整个比较表达式
      const cleaned = `${left.trim()} ${op} ${right.trim()}`;
      return `$${cleaned}$`;
    }
  );
  
  return fixed;
}

/**
 * 检测文本中是否包含LaTeX命令
 * 
 * @param text 要检测的文本
 * @returns 是否包含LaTeX命令
 */
export function hasLatexCommands(text: string): boolean {
  if (!text) return false;
  
  const latexPattern = buildLatexPattern();
  return new RegExp(latexPattern).test(text);
}
