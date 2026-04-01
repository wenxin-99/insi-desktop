/**
 * Word-level diff — 行内变更高亮
 * 在已知两行为 removed/added 对时，找出行内具体改动的 token
 */

export interface WordSpan {
  text: string;
  changed: boolean;
}

/**
 * 将一行文本拆分为 word tokens（保留空白和标点）
 */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (/\s/.test(line[i])) {
      let j = i;
      while (j < line.length && /\s/.test(line[j])) j++;
      tokens.push(line.slice(i, j));
      i = j;
    } else if (/[a-zA-Z0-9_$]/.test(line[i])) {
      let j = i;
      while (j < line.length && /[a-zA-Z0-9_$]/.test(line[j])) j++;
      tokens.push(line.slice(i, j));
      i = j;
    } else {
      tokens.push(line[i]);
      i++;
    }
  }
  return tokens;
}

/**
 * 简化 LCS 求两个 token 数组的最长公共子序列
 * 返回公共子序列的 index 对 [oldIdx, newIdx][]
 */
function lcsTokens(a: string[], b: string[]): [number, number][] {
  const m = a.length;
  const n = b.length;

  // 如果太大则跳过（直接标记整行为变更）
  if (m * n > 50000) return [];

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯
  const pairs: [number, number][] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      pairs.push([i - 1, j - 1]);
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  pairs.reverse();
  return pairs;
}

/**
 * 计算两行之间的 word-level diff
 * 返回 oldLine 和 newLine 的 WordSpan 数组
 */
export function computeWordDiff(
  oldLine: string,
  newLine: string,
): { oldSpans: WordSpan[]; newSpans: WordSpan[] } {
  const oldTokens = tokenize(oldLine);
  const newTokens = tokenize(newLine);

  if (oldTokens.length === 0 && newTokens.length === 0) {
    return { oldSpans: [], newSpans: [] };
  }

  const lcs = lcsTokens(oldTokens, newTokens);

  // 如果 LCS 为空，整行都是变更
  if (lcs.length === 0) {
    return {
      oldSpans: oldTokens.map(t => ({ text: t, changed: true })),
      newSpans: newTokens.map(t => ({ text: t, changed: true })),
    };
  }

  // 构建 old spans
  const oldSpans: WordSpan[] = [];
  const oldMatched = new Set(lcs.map(p => p[0]));
  for (let i = 0; i < oldTokens.length; i++) {
    oldSpans.push({ text: oldTokens[i], changed: !oldMatched.has(i) });
  }

  // 构建 new spans
  const newSpans: WordSpan[] = [];
  const newMatched = new Set(lcs.map(p => p[1]));
  for (let i = 0; i < newTokens.length; i++) {
    newSpans.push({ text: newTokens[i], changed: !newMatched.has(i) });
  }

  return { oldSpans, newSpans };
}

/**
 * 合并相邻的同类型 spans 以减少 DOM 节点
 */
export function mergeSpans(spans: WordSpan[]): WordSpan[] {
  if (spans.length === 0) return [];
  const merged: WordSpan[] = [{ ...spans[0] }];
  for (let i = 1; i < spans.length; i++) {
    const last = merged[merged.length - 1];
    if (last.changed === spans[i].changed) {
      last.text += spans[i].text;
    } else {
      merged.push({ ...spans[i] });
    }
  }
  return merged;
}
