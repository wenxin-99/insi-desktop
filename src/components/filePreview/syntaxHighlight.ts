/**
 * 轻量语法高亮引擎
 * 支持 TypeScript/JavaScript, CSS, HTML, JSON, Python, PHP, SQL, Bash, Markdown, YAML
 * 不依赖外部库，按 token 类型返回 spans
 */

export interface HighlightToken {
  text: string;
  type: 'keyword' | 'string' | 'comment' | 'number' | 'operator' | 'function' | 'type' | 'property' | 'tag' | 'attr' | 'punctuation' | 'regex' | 'builtin' | 'plain';
}

// ─── Token 颜色映射（VS Code Dark+ 风格） ───
export const tokenColors: Record<HighlightToken['type'], string> = {
  keyword:     '#c586c0',   // 紫粉色
  string:      '#ce9178',   // 橙色
  comment:     '#6a9955',   // 绿色
  number:      '#b5cea8',   // 浅绿
  operator:    '#d4d4d4',   // 浅灰
  function:    '#dcdcaa',   // 黄色
  type:        '#4ec9b0',   // 青色
  property:    '#9cdcfe',   // 浅蓝
  tag:         '#569cd6',   // 蓝色
  attr:        '#9cdcfe',   // 浅蓝
  punctuation: '#808080',   // 灰色
  regex:       '#d16969',   // 暗红
  builtin:     '#4fc1ff',   // 亮蓝
  plain:       '#d4d4d4',   // 默认文本色
};

// ─── 语言关键字 ───
const JS_KEYWORDS = new Set([
  'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'finally',
  'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'let', 'new',
  'of', 'return', 'static', 'super', 'switch', 'this', 'throw', 'try', 'typeof',
  'var', 'void', 'while', 'with', 'yield', 'enum', 'implements', 'interface',
  'package', 'private', 'protected', 'public', 'abstract', 'as', 'type', 'declare',
  'readonly', 'namespace', 'module', 'keyof', 'infer', 'satisfies',
]);

const JS_BUILTINS = new Set([
  'true', 'false', 'null', 'undefined', 'NaN', 'Infinity',
  'console', 'window', 'document', 'Promise', 'Array', 'Object', 'String',
  'Number', 'Boolean', 'Map', 'Set', 'WeakMap', 'WeakSet', 'Symbol', 'RegExp',
  'Error', 'TypeError', 'JSON', 'Math', 'Date', 'parseInt', 'parseFloat',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval', 'fetch',
  'require', 'process', 'Buffer', 'global', '__dirname', '__filename',
]);

const PY_KEYWORDS = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'finally', 'for', 'from', 'global',
  'if', 'import', 'in', 'is', 'lambda', 'nonlocal', 'not', 'or', 'pass',
  'raise', 'return', 'try', 'while', 'with', 'yield',
]);

const PY_BUILTINS = new Set([
  'True', 'False', 'None', 'self', 'cls', 'print', 'len', 'range', 'type',
  'int', 'str', 'float', 'list', 'dict', 'set', 'tuple', 'bool', 'super',
  'isinstance', 'issubclass', 'enumerate', 'zip', 'map', 'filter', 'sorted',
  'input', 'open', 'Exception', 'ValueError', 'TypeError', 'KeyError',
]);

const SQL_KEYWORDS = new Set([
  'select', 'from', 'where', 'and', 'or', 'not', 'in', 'is', 'null', 'like',
  'between', 'exists', 'insert', 'into', 'values', 'update', 'set', 'delete',
  'create', 'table', 'alter', 'drop', 'index', 'view', 'join', 'inner', 'left',
  'right', 'outer', 'on', 'group', 'by', 'order', 'having', 'limit', 'offset',
  'union', 'all', 'distinct', 'as', 'case', 'when', 'then', 'else', 'end',
  'primary', 'key', 'foreign', 'references', 'constraint', 'default', 'auto_increment',
  'varchar', 'int', 'integer', 'text', 'boolean', 'date', 'timestamp', 'float',
  'double', 'decimal', 'char', 'blob', 'bigint', 'smallint',
]);

const PHP_KEYWORDS = new Set([
  'abstract', 'and', 'array', 'as', 'break', 'callable', 'case', 'catch',
  'class', 'clone', 'const', 'continue', 'declare', 'default', 'do', 'echo',
  'else', 'elseif', 'empty', 'enddeclare', 'endfor', 'endforeach', 'endif',
  'endswitch', 'endwhile', 'extends', 'final', 'finally', 'fn', 'for',
  'foreach', 'function', 'global', 'goto', 'if', 'implements', 'include',
  'instanceof', 'interface', 'isset', 'list', 'match', 'namespace', 'new',
  'or', 'print', 'private', 'protected', 'public', 'readonly', 'require',
  'return', 'static', 'switch', 'throw', 'trait', 'try', 'unset', 'use',
  'var', 'while', 'xor', 'yield',
]);

const CSS_KEYWORDS = new Set([
  'important', 'inherit', 'initial', 'unset', 'revert', 'none', 'auto',
  'block', 'inline', 'flex', 'grid', 'absolute', 'relative', 'fixed', 'sticky',
  'solid', 'dashed', 'dotted', 'hidden', 'visible', 'scroll', 'nowrap',
  'center', 'left', 'right', 'top', 'bottom', 'transparent',
]);

const BASH_KEYWORDS = new Set([
  'if', 'then', 'else', 'elif', 'fi', 'case', 'esac', 'for', 'while', 'until',
  'do', 'done', 'in', 'function', 'select', 'time', 'return', 'exit',
  'local', 'declare', 'export', 'readonly', 'unset', 'shift', 'set',
  'echo', 'printf', 'read', 'cd', 'pwd', 'ls', 'cp', 'mv', 'rm', 'mkdir',
  'chmod', 'chown', 'grep', 'sed', 'awk', 'find', 'xargs', 'cat', 'head',
  'tail', 'sort', 'uniq', 'wc', 'curl', 'wget', 'tar', 'gzip', 'ssh',
  'sudo', 'apt', 'yum', 'npm', 'node', 'python', 'pip', 'git',
]);

// ─── 通用 tokenizer ───

function tokenizeLine(line: string, lang: string): HighlightToken[] {
  if (!line || typeof line !== 'string') return [{ text: String(line ?? ''), type: 'plain' }];

  switch (lang) {
    case 'typescript':
    case 'javascript':
    case 'jsx':
    case 'tsx':
      return tokenizeJsTs(line);
    case 'python':
      return tokenizePython(line);
    case 'css':
      return tokenizeCss(line);
    case 'html':
      return tokenizeHtml(line);
    case 'json':
      return tokenizeJson(line);
    case 'sql':
      return tokenizeSql(line);
    case 'php':
      return tokenizePhp(line);
    case 'bash':
    case 'shell':
      return tokenizeBash(line);
    case 'yaml':
      return tokenizeYaml(line);
    case 'markdown':
      return tokenizeMarkdown(line);
    case 'diff':
      return tokenizeDiff(line);
    default:
      return [{ text: line, type: 'plain' }];
  }
}

// ─── JS/TS tokenizer ───

function tokenizeJsTs(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    // Single-line comment
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    // Multi-line comment (start)
    if (line[i] === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end >= 0) {
        tokens.push({ text: line.slice(i, end + 2), type: 'comment' });
        i = end + 2;
      } else {
        tokens.push({ text: line.slice(i), type: 'comment' });
        break;
      }
      continue;
    }

    // String (single, double, backtick)
    if (line[i] === '"' || line[i] === "'" || line[i] === '`') {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++;
        j++;
      }
      tokens.push({ text: line.slice(i, j + 1), type: 'string' });
      i = j + 1;
      continue;
    }

    // Number
    if (/[0-9]/.test(line[i]) && (i === 0 || /[\s,;:=+\-*/%(<>!&|^~[{]/.test(line[i - 1]))) {
      let j = i;
      if (line[j] === '0' && (line[j + 1] === 'x' || line[j + 1] === 'X')) j += 2;
      while (j < line.length && /[0-9a-fA-F._xXn]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    // Word (keyword, builtin, identifier)
    if (/[a-zA-Z_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      const word = line.slice(i, j);

      // Check if it's a function call
      const nextNonSpace = line.slice(j).match(/^\s*\(/);

      if (JS_KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (JS_BUILTINS.has(word)) {
        tokens.push({ text: word, type: 'builtin' });
      } else if (nextNonSpace) {
        tokens.push({ text: word, type: 'function' });
      } else if (/^[A-Z]/.test(word) && word.length > 1) {
        tokens.push({ text: word, type: 'type' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      i = j;
      continue;
    }

    // JSX/HTML-like tags
    if (line[i] === '<' && /[a-zA-Z\/]/.test(line[i + 1] || '')) {
      const tagMatch = line.slice(i).match(/^<\/?([a-zA-Z][a-zA-Z0-9.]*)/);
      if (tagMatch) {
        tokens.push({ text: '<' + (line[i + 1] === '/' ? '/' : ''), type: 'punctuation' });
        i += (line[i + 1] === '/' ? 2 : 1);
        tokens.push({ text: tagMatch[1], type: 'tag' });
        i += tagMatch[1].length;
        continue;
      }
    }

    // Operators
    if (/[=+\-*/%<>!&|^~?:]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[=+\-*/%<>!&|^~?:]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'operator' });
      i = j;
      continue;
    }

    // Punctuation
    if (/[{}\[\]();,.]/.test(line[i])) {
      tokens.push({ text: line[i], type: 'punctuation' });
      i++;
      continue;
    }

    // Whitespace & other
    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'plain' });
      i = j;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

// ─── Python tokenizer ───

function tokenizePython(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '#') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    if ((line[i] === '"' || line[i] === "'")) {
      const triple = line.slice(i, i + 3);
      if (triple === '"""' || triple === "'''") {
        const end = line.indexOf(triple, i + 3);
        if (end >= 0) {
          tokens.push({ text: line.slice(i, end + 3), type: 'string' });
          i = end + 3;
        } else {
          tokens.push({ text: line.slice(i), type: 'string' });
          break;
        }
        continue;
      }
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++;
        j++;
      }
      tokens.push({ text: line.slice(i, j + 1), type: 'string' });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(line[i]) && (i === 0 || /[\s,;:=+\-*/%(<>!&|^~[\]{]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[0-9._xXoObBeEjJ]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    if (line[i] === '@') {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'function' });
      i = j;
      continue;
    }

    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      const nextNonSpace = line.slice(j).match(/^\s*\(/);

      if (PY_KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (PY_BUILTINS.has(word)) {
        tokens.push({ text: word, type: 'builtin' });
      } else if (nextNonSpace) {
        tokens.push({ text: word, type: 'function' });
      } else if (/^[A-Z]/.test(word) && word.length > 1) {
        tokens.push({ text: word, type: 'type' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      i = j;
      continue;
    }

    if (/[=+\-*/%<>!&|^~:]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[=+\-*/%<>!&|^~:]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'operator' });
      i = j;
      continue;
    }

    if (/[{}\[\]();,.]/.test(line[i])) {
      tokens.push({ text: line[i], type: 'punctuation' });
      i++;
      continue;
    }

    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'plain' });
      i = j;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

// ─── CSS tokenizer ───

function tokenizeCss(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end >= 0) {
        tokens.push({ text: line.slice(i, end + 2), type: 'comment' });
        i = end + 2;
      } else {
        tokens.push({ text: line.slice(i), type: 'comment' });
        break;
      }
      continue;
    }

    if (line[i] === '"' || line[i] === "'") {
      const quote = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== quote) {
        if (line[j] === '\\') j++;
        j++;
      }
      tokens.push({ text: line.slice(i, j + 1), type: 'string' });
      i = j + 1;
      continue;
    }

    if (line[i] === '#' && /[0-9a-fA-F]/.test(line[i + 1] || '')) {
      let j = i + 1;
      while (j < line.length && /[0-9a-fA-F]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    if (/[0-9]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[0-9.%a-zA-Z]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    if (line[i] === '@') {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z\-]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'keyword' });
      i = j;
      continue;
    }

    if (line[i] === '.' && /[a-zA-Z_\-]/.test(line[i + 1] || '')) {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_\-]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'type' });
      i = j;
      continue;
    }

    if (/[a-zA-Z\-_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9\-_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      const afterWord = line.slice(j).trimStart();

      if (afterWord.startsWith(':') && !afterWord.startsWith('::')) {
        tokens.push({ text: word, type: 'property' });
      } else if (CSS_KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else {
        tokens.push({ text: word, type: 'tag' });
      }
      i = j;
      continue;
    }

    if (/[{}\[\]();:,>~+]/.test(line[i])) {
      tokens.push({ text: line[i], type: 'punctuation' });
      i++;
      continue;
    }

    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'plain' });
      i = j;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

// ─── HTML tokenizer ───

function tokenizeHtml(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    if (line.slice(i, i + 4) === '<!--') {
      const end = line.indexOf('-->', i + 4);
      if (end >= 0) {
        tokens.push({ text: line.slice(i, end + 3), type: 'comment' });
        i = end + 3;
      } else {
        tokens.push({ text: line.slice(i), type: 'comment' });
        break;
      }
      continue;
    }

    if (line[i] === '<') {
      const tagMatch = line.slice(i).match(/^<\/?([a-zA-Z][a-zA-Z0-9-]*)/);
      if (tagMatch) {
        tokens.push({ text: line[i] + (line[i + 1] === '/' ? '/' : ''), type: 'punctuation' });
        i += (line[i + 1] === '/' ? 2 : 1);
        tokens.push({ text: tagMatch[1], type: 'tag' });
        i += tagMatch[1].length;

        // Parse attributes until >
        while (i < line.length && line[i] !== '>') {
          if (/\s/.test(line[i])) {
            let j = i;
            while (j < line.length && /\s/.test(line[j])) j++;
            tokens.push({ text: line.slice(i, j), type: 'plain' });
            i = j;
            continue;
          }
          if (/[a-zA-Z\-_:@]/.test(line[i])) {
            let j = i;
            while (j < line.length && /[a-zA-Z0-9\-_:@.]/.test(line[j])) j++;
            tokens.push({ text: line.slice(i, j), type: 'attr' });
            i = j;
            continue;
          }
          if (line[i] === '=') {
            tokens.push({ text: '=', type: 'operator' });
            i++;
            continue;
          }
          if (line[i] === '"' || line[i] === "'") {
            const q = line[i];
            let j = i + 1;
            while (j < line.length && line[j] !== q) j++;
            tokens.push({ text: line.slice(i, j + 1), type: 'string' });
            i = j + 1;
            continue;
          }
          tokens.push({ text: line[i], type: 'plain' });
          i++;
        }
        if (i < line.length && (line[i] === '>' || line.slice(i, i + 2) === '/>')) {
          const close = line.slice(i, i + 2) === '/>' ? '/>' : '>';
          tokens.push({ text: close, type: 'punctuation' });
          i += close.length;
        }
        continue;
      }
    }

    // Text content
    let j = i;
    while (j < line.length && line[j] !== '<') j++;
    if (j > i) {
      tokens.push({ text: line.slice(i, j), type: 'plain' });
      i = j;
    } else {
      tokens.push({ text: line[i], type: 'plain' });
      i++;
    }
  }

  return tokens;
}

// ─── JSON tokenizer ───

function tokenizeJson(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '"') {
      let j = i + 1;
      while (j < line.length && line[j] !== '"') {
        if (line[j] === '\\') j++;
        j++;
      }
      const str = line.slice(i, j + 1);
      // Check if this is a key (followed by :)
      const after = line.slice(j + 1).trimStart();
      if (after.startsWith(':')) {
        tokens.push({ text: str, type: 'property' });
      } else {
        tokens.push({ text: str, type: 'string' });
      }
      i = j + 1;
      continue;
    }

    if (/[0-9\-]/.test(line[i]) && (i === 0 || /[\s,:\[{]/.test(line[i - 1]))) {
      let j = i;
      if (line[j] === '-') j++;
      while (j < line.length && /[0-9.eE+\-]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    if (line.slice(i, i + 4) === 'true' || line.slice(i, i + 5) === 'false' || line.slice(i, i + 4) === 'null') {
      const word = line.slice(i).match(/^(true|false|null)/);
      if (word) {
        tokens.push({ text: word[0], type: 'builtin' });
        i += word[0].length;
        continue;
      }
    }

    if (/[{}\[\]:,]/.test(line[i])) {
      tokens.push({ text: line[i], type: 'punctuation' });
      i++;
      continue;
    }

    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'plain' });
      i = j;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

// ─── SQL tokenizer ───

function tokenizeSql(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '-' && line[i + 1] === '-') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    if (line[i] === "'" || line[i] === '"') {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) j++;
      tokens.push({ text: line.slice(i, j + 1), type: 'string' });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (SQL_KEYWORDS.has(word.toLowerCase())) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (word.toUpperCase() === 'NULL' || word.toUpperCase() === 'TRUE' || word.toUpperCase() === 'FALSE') {
        tokens.push({ text: word, type: 'builtin' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      i = j;
      continue;
    }

    if (/[=<>!+\-*/%]/.test(line[i])) {
      tokens.push({ text: line[i], type: 'operator' });
      i++;
      continue;
    }

    if (/[{}\[\]();,.]/.test(line[i])) {
      tokens.push({ text: line[i], type: 'punctuation' });
      i++;
      continue;
    }

    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'plain' });
      i = j;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

// ─── PHP tokenizer ───

function tokenizePhp(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '/' && line[i + 1] === '/') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }
    if (line[i] === '#' && line[i + 1] !== '[') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    if (line[i] === '/' && line[i + 1] === '*') {
      const end = line.indexOf('*/', i + 2);
      if (end >= 0) {
        tokens.push({ text: line.slice(i, end + 2), type: 'comment' });
        i = end + 2;
      } else {
        tokens.push({ text: line.slice(i), type: 'comment' });
        break;
      }
      continue;
    }

    if (line[i] === '$') {
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'property' });
      i = j;
      continue;
    }

    if (line[i] === '"' || line[i] === "'") {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) {
        if (line[j] === '\\') j++;
        j++;
      }
      tokens.push({ text: line.slice(i, j + 1), type: 'string' });
      i = j + 1;
      continue;
    }

    if (/[0-9]/.test(line[i]) && (i === 0 || /[\s,;:=+\-*/%(<>!&|^~[\]{]/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[0-9._xX]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (PHP_KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else if (/^[A-Z]/.test(word) && word.length > 1) {
        tokens.push({ text: word, type: 'type' });
      } else {
        const nextNonSpace = line.slice(j).match(/^\s*\(/);
        tokens.push({ text: word, type: nextNonSpace ? 'function' : 'plain' });
      }
      i = j;
      continue;
    }

    if (/[=+\-*/%<>!&|^~?:.]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[=+\-*/%<>!&|^~?:.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'operator' });
      i = j;
      continue;
    }

    if (/[{}\[\]();,]/.test(line[i])) {
      tokens.push({ text: line[i], type: 'punctuation' });
      i++;
      continue;
    }

    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'plain' });
      i = j;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

// ─── Bash tokenizer ───

function tokenizeBash(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];
  let i = 0;

  while (i < line.length) {
    if (line[i] === '#') {
      tokens.push({ text: line.slice(i), type: 'comment' });
      break;
    }

    if (line[i] === '"' || line[i] === "'") {
      const q = line[i];
      let j = i + 1;
      while (j < line.length && line[j] !== q) {
        if (line[j] === '\\') j++;
        j++;
      }
      tokens.push({ text: line.slice(i, j + 1), type: 'string' });
      i = j + 1;
      continue;
    }

    if (line[i] === '$') {
      if (line[i + 1] === '{') {
        const end = line.indexOf('}', i + 2);
        if (end >= 0) {
          tokens.push({ text: line.slice(i, end + 1), type: 'property' });
          i = end + 1;
          continue;
        }
      }
      if (line[i + 1] === '(') {
        tokens.push({ text: '$(', type: 'operator' });
        i += 2;
        continue;
      }
      let j = i + 1;
      while (j < line.length && /[a-zA-Z0-9_]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'property' });
      i = j;
      continue;
    }

    if (/[0-9]/.test(line[i]) && (i === 0 || /\s/.test(line[i - 1]))) {
      let j = i;
      while (j < line.length && /[0-9.]/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'number' });
      i = j;
      continue;
    }

    if (/[a-zA-Z_]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_\-]/.test(line[j])) j++;
      const word = line.slice(i, j);
      if (BASH_KEYWORDS.has(word)) {
        tokens.push({ text: word, type: 'keyword' });
      } else {
        tokens.push({ text: word, type: 'plain' });
      }
      i = j;
      continue;
    }

    if (/[|&;<>()]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[|&;<>]/.test(line[j])) j++;
      if (j === i) j++;
      tokens.push({ text: line.slice(i, j), type: 'operator' });
      i = j;
      continue;
    }

    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push({ text: line.slice(i, j), type: 'plain' });
      i = j;
      continue;
    }

    tokens.push({ text: line[i], type: 'plain' });
    i++;
  }

  return tokens;
}

// ─── YAML tokenizer ───

function tokenizeYaml(line: string): HighlightToken[] {
  const tokens: HighlightToken[] = [];

  if (/^\s*#/.test(line)) {
    return [{ text: line, type: 'comment' }];
  }

  const keyMatch = line.match(/^(\s*)([a-zA-Z0-9_\-.]+)(\s*:\s*)(.*)/);
  if (keyMatch) {
    if (keyMatch[1]) tokens.push({ text: keyMatch[1], type: 'plain' });
    tokens.push({ text: keyMatch[2], type: 'property' });
    tokens.push({ text: keyMatch[3], type: 'punctuation' });
    const val = keyMatch[4];
    if (/^['"]/.test(val)) {
      tokens.push({ text: val, type: 'string' });
    } else if (/^(true|false|null|~)$/i.test(val.trim())) {
      tokens.push({ text: val, type: 'builtin' });
    } else if (/^[0-9]/.test(val.trim())) {
      tokens.push({ text: val, type: 'number' });
    } else {
      tokens.push({ text: val, type: 'plain' });
    }
    return tokens;
  }

  if (/^\s*-\s/.test(line)) {
    const dashMatch = line.match(/^(\s*-\s)(.*)/);
    if (dashMatch) {
      tokens.push({ text: dashMatch[1], type: 'operator' });
      tokens.push({ text: dashMatch[2], type: 'plain' });
      return tokens;
    }
  }

  return [{ text: line, type: 'plain' }];
}

// ─── Markdown tokenizer ───

function tokenizeMarkdown(line: string): HighlightToken[] {
  if (/^#{1,6}\s/.test(line)) {
    return [{ text: line, type: 'keyword' }];
  }
  if (/^[*\-+]\s/.test(line) || /^\d+\.\s/.test(line)) {
    const match = line.match(/^([*\-+]|\d+\.)\s/);
    if (match) {
      return [
        { text: match[0], type: 'operator' },
        { text: line.slice(match[0].length), type: 'plain' },
      ];
    }
  }
  if (/^>\s/.test(line)) {
    return [{ text: line, type: 'comment' }];
  }
  if (/^```/.test(line)) {
    return [{ text: line, type: 'string' }];
  }
  return [{ text: line, type: 'plain' }];
}

// ─── Diff tokenizer ───

function tokenizeDiff(line: string): HighlightToken[] {
  if (line.startsWith('+') || /[─—]{2,}.*(替换为|新代码)/.test(line)) {
    return [{ text: line, type: 'string' }];
  }
  if (line.startsWith('-') || /[─—]{2,}.*(旧代码|原代码)/.test(line)) {
    return [{ text: line, type: 'regex' }];
  }
  if (line.startsWith('@@')) {
    return [{ text: line, type: 'keyword' }];
  }
  return [{ text: line, type: 'plain' }];
}

// ─── 对外接口：高亮整个文件（按行返回 token 数组） ───

export function highlightLines(content: string, language: string): HighlightToken[][] {
  const lines = content.split('\n');
  return lines.map(line => tokenizeLine(line, language));
}

export function highlightLine(line: string, language: string): HighlightToken[] {
  // 防御性检查：确保 line 是字符串
  if (typeof line !== 'string') {
    return [{ text: String(line ?? ''), type: 'plain' }];
  }
  return tokenizeLine(line, language || 'text');
}
