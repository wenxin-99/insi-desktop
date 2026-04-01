/**
 * repairJson.ts — 容错 JSON 解析
 *
 * 处理 AI 输出中常见的 JSON 格式问题：
 *   1. JSON 前后混入自然语言文字 → 提取 {...} 部分
 *   2. 尾部逗号 → 移除 [,] / {,}
 *   3. 截断 JSON（流式未完成）→ 尝试补全括号
 *   4. 单引号 → 双引号
 *   5. 无引号的中文/英文 value → 加引号
 *   6. 属性名无引号 → 加引号
 */

/**
 * 尝试解析 JSON 字符串，解析失败时自动修复后重试。
 * @returns { data, error } — 成功时 data 为解析结果，失败时 error 为错误描述
 */
export function safeParseJson<T = any>(
  raw: string
): { data: T | null; error: string | null } {
  // 第 0 步：快速路径 — 直接 parse 成功就返回
  const trimmed = raw.trim();
  try {
    return { data: JSON.parse(trimmed) as T, error: null };
  } catch {
    // 继续修复流程
  }

  // 第 1 步：提取 JSON 对象/数组（跳过前后的自然语言文字）
  let jsonStr = extractJsonBlock(trimmed);
  if (!jsonStr) {
    return { data: null, error: '未找到有效的 JSON 数据' };
  }

  // 第 2 步：逐步修复
  jsonStr = repairJsonString(jsonStr);

  // 第 3 步：尝试解析修复后的结果
  try {
    return { data: JSON.parse(jsonStr) as T, error: null };
  } catch (e) {
    return { data: null, error: (e as Error).message };
  }
}

/**
 * 从混合文本中提取最外层 JSON 对象或数组
 * 处理场景：AI 在 JSON 前后输出了解释性文字
 */
function extractJsonBlock(str: string): string | null {
  // 找第一个 { 或 [
  const objStart = str.indexOf('{');
  const arrStart = str.indexOf('[');

  let start: number;
  let openChar: string;
  let closeChar: string;

  if (objStart === -1 && arrStart === -1) return null;
  if (objStart === -1) {
    start = arrStart;
    openChar = '[';
    closeChar = ']';
  } else if (arrStart === -1) {
    start = objStart;
    openChar = '{';
    closeChar = '}';
  } else {
    // 用先出现的那个
    if (objStart < arrStart) {
      start = objStart;
      openChar = '{';
      closeChar = '}';
    } else {
      start = arrStart;
      openChar = '[';
      closeChar = ']';
    }
  }

  // 找匹配的闭合括号（注意跳过字符串内的括号）
  let depth = 0;
  let inString = false;
  let escapeNext = false;
  let end = -1;

  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === openChar) depth++;
    if (ch === closeChar) {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end !== -1) {
    return str.substring(start, end + 1);
  }

  // 括号未闭合（可能是截断的 JSON）→ 返回从 start 到末尾
  return str.substring(start);
}

/**
 * 修复常见的 JSON 格式问题
 */
function repairJsonString(str: string): string {
  let s = str;

  // ★ 2-pre: 修复字符串值内的未转义引号（AI 最常见的 JSON 破坏模式）
  // 例: "desc": "传统意义的"冬天"在大部分地区消失" → "desc": "传统意义的\"冬天\"在大部分地区消失"
  s = escapeEmbeddedQuotes(s);

  // 2a: 单引号 → 双引号（仅在非字符串上下文中）
  s = replaceSingleQuotes(s);

  // 2b: 无引号的属性名 → 加引号
  // { foo: "bar" } → { "foo": "bar" }
  s = s.replace(/(?<=[\{,]\s*)([a-zA-Z_\u4e00-\u9fff][\w\u4e00-\u9fff]*)\s*:/g, '"$1":');

  // 2c: 无引号的中文/混合值 → 加引号
  // { "key": 无变化 } → { "key": "无变化" }
  // 匹配 : 后面跟非 JSON 合法 token 开头的内容（不是 " { [ 数字 true false null）
  s = s.replace(
    /:\s*([^"\[\{}\]\s,\d\-][^,\}\]]*?)(?=\s*[,\}\]])/g,
    (match, val) => {
      const trimVal = val.trim();
      // 如果已经是合法 JSON 值，不处理
      if (/^(true|false|null)$/.test(trimVal)) return match;
      if (/^-?\d/.test(trimVal)) return match;
      return `: "${trimVal}"`;
    }
  );

  // 2d: 尾部逗号 → 移除
  s = s.replace(/,\s*([}\]])/g, '$1');

  // 2e: 截断 JSON → 尝试补全括号
  s = closeBrackets(s);

  return s;
}

/**
 * 简单的单引号替换（避免破坏字符串内容中的撇号）
 */
function replaceSingleQuotes(str: string): string {
  // 只替换看起来像 JSON 结构的单引号对
  // 'key': 'value' → "key": "value"
  return str.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, '"$1"');
}

/**
 * 尝试闭合未配对的括号（处理截断 JSON）
 */
function closeBrackets(str: string): string {
  const stack: string[] = [];
  let inString = false;
  let escapeNext = false;

  for (const ch of str) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === '\\') {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;

    if (ch === '{') stack.push('}');
    else if (ch === '[') stack.push(']');
    else if (ch === '}' || ch === ']') {
      if (stack.length && stack[stack.length - 1] === ch) stack.pop();
    }
  }

  // 如果在字符串内截断，先闭合字符串
  let suffix = '';
  if (inString) suffix += '"';

  // 闭合所有未配对的括号（反序）
  while (stack.length) {
    suffix += stack.pop();
  }

  return str + suffix;
}

/**
 * ★ 修复字符串值内未转义的双引号
 *
 * AI 常见错误：
 *   "desc": "传统意义的"冬天"在大部分地区消失"
 *   → "desc": "传统意义的\"冬天\"在大部分地区消失"
 *
 * 检测逻辑：逐字符扫描，追踪 JSON 结构状态。
 * 在字符串值内遇到 `"` 时，如果后续不像结构符号（不跟 `:,]}` 或空白+结构符号），
 * 则判定为嵌入引号并转义。
 */
function escapeEmbeddedQuotes(str: string): string {
  const result: string[] = [];
  let i = 0;
  let inString = false;
  let isKey = true; // 在对象中，第一个字符串是 key，第二个是 value

  while (i < str.length) {
    const ch = str[i];

    // 转义字符直接保留
    if (ch === '\\' && i + 1 < str.length) {
      result.push(ch, str[i + 1]);
      i += 2;
      continue;
    }

    if (!inString) {
      // 不在字符串内
      if (ch === '"') {
        inString = true;
        result.push(ch);
        i++;
        continue;
      }
      // 遇到 : 说明下一个字符串是 value（不是 key）
      if (ch === ':') isKey = false;
      // 遇到 , { [ 说明下一个字符串是 key
      if (ch === ',' || ch === '{' || ch === '[') isKey = true;
      result.push(ch);
      i++;
      continue;
    }

    // 在字符串内，遇到 "
    if (ch === '"') {
      // 判断这个 " 是结构性闭合还是嵌入内容
      // 看后面跳过空白后的第一个非空字符
      let j = i + 1;
      while (j < str.length && (str[j] === ' ' || str[j] === '\t' || str[j] === '\n' || str[j] === '\r')) j++;
      const nextChar = j < str.length ? str[j] : '';

      // 结构性闭合：" 后面是 , } ] : 或 EOF
      const isStructural = nextChar === '' || nextChar === ',' || nextChar === '}' || nextChar === ']' || nextChar === ':';

      if (isStructural) {
        // 正常闭合字符串
        inString = false;
        result.push(ch);
        i++;
        continue;
      }

      // 非结构性 → 嵌入引号，转义
      result.push('\\', '"');
      i++;
      continue;
    }

    result.push(ch);
    i++;
  }

  return result.join('');
}
