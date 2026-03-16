/**
 * diffParser.ts (v2)
 *
 * 增强：Word-level Diff — 在同一行内标记具体变化的字符
 *
 * 工作流:
 *   1. parseCodeDiffs()  → 提取 <replace> XML 块
 *   2. computeDiffLines() → 行级 LCS diff
 *   3. injectInlineHighlights() → 自动配对相邻 removed/added 行
 *   4. computeWordDiff() → 对每对行做 token-level LCS, 标记变化的字符片段
 *   5. 结果写入 DiffLine.inlineSegments, 前端用不同底色渲染
 */

// ═══════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════

export interface CodeDiff {
  file: string;
  search: string;
  replacement: string;
  reason: string;
  rawXml: string;
}

/** 行内差异片段 */
export interface InlineSegment {
  text: string;
  /** 'equal'=未变, 'changed'=变化 */
  type: 'equal' | 'changed';
}

export interface DiffLine {
  type: 'context' | 'removed' | 'added' | 'separator';
  content: string;
  lineNumber?: number;
  /** 行内高亮片段 — removed/added 配对行才有 */
  inlineSegments?: InlineSegment[];
}

// ═══════════════════════════════════════
// 1. 解析 <replace> 块
// ═══════════════════════════════════════

export function parseCodeDiffs(content: string): CodeDiff[] {
  const diffs: CodeDiff[] = [];

  // 模式1: 直接 XML
  const direct = /<replace\s+file=["']([^"']+)["']\s*>([\s\S]*?)<\/replace>/gi;
  let m;
  while ((m = direct.exec(content)) !== null) {
    const d = _parseBody(m[1].trim(), m[2], m[0]);
    if (d) diffs.push(d);
  }

  // 模式2: ```xml 包裹
  if (diffs.length === 0) {
    const xmlBlocks = /```xml\s*\n([\s\S]*?)\n\s*```/gi;
    let xm;
    while ((xm = xmlBlocks.exec(content)) !== null) {
      const inner = /<replace\s+file=["']([^"']+)["']\s*>([\s\S]*?)<\/replace>/gi;
      let im;
      while ((im = inner.exec(xm[1])) !== null) {
        const d = _parseBody(im[1].trim(), im[2], xm[0]);
        if (d) diffs.push(d);
      }
    }
  }
  return diffs;
}

function _parseBody(file: string, body: string, raw: string): CodeDiff | null {
  const s = body.match(/<search>([\s\S]*?)<\/search>/i);
  const r = body.match(/<replacement>([\s\S]*?)<\/replacement>/i);
  const n = body.match(/<reason>([\s\S]*?)<\/reason>/i);
  if (!s || !r) return null;
  return { file, search: _trim(s[1]), replacement: _trim(r[1]), reason: n ? n[1].trim() : '', rawXml: raw };
}

function _trim(code: string): string {
  const lines = code.split('\n');
  let a = 0;
  while (a < lines.length && lines[a].trim() === '') a++;
  let b = lines.length - 1;
  while (b > a && lines[b].trim() === '') b--;
  return lines.slice(a, b + 1).join('\n');
}

// ═══════════════════════════════════════
// 2. 行级 LCS
// ═══════════════════════════════════════

interface LCSEntry { oldIndex: number; newIndex: number; }

function _lineLCS(a: string[], b: string[]): LCSEntry[] {
  const m = a.length, n = b.length;
  if (m * n > 1_000_000) return _greedyLCS(a, b);

  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1].trimEnd() === b[j - 1].trimEnd()
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);

  const res: LCSEntry[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1].trimEnd() === b[j - 1].trimEnd()) { res.unshift({ oldIndex: i - 1, newIndex: j - 1 }); i--; j--; }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }
  return res;
}

function _greedyLCS(a: string[], b: string[]): LCSEntry[] {
  const res: LCSEntry[] = [];
  const bm = new Map<string, number[]>();
  b.forEach((l, i) => { const k = l.trimEnd(); if (!bm.has(k)) bm.set(k, []); bm.get(k)!.push(i); });
  let last = -1;
  for (let i = 0; i < a.length; i++) {
    const c = bm.get(a[i].trimEnd());
    if (!c) continue;
    const n = c.find(j => j > last);
    if (n !== undefined) { res.push({ oldIndex: i, newIndex: n }); last = n; }
  }
  return res;
}

// ═══════════════════════════════════════
// 3. computeDiffLines (行级 + 自动注入行内高亮)
// ═══════════════════════════════════════

export function computeDiffLines(diff: CodeDiff): DiffLine[] {
  const oldL = diff.search.split('\n'), newL = diff.replacement.split('\n');
  const raw: DiffLine[] = [];
  const lcs = _lineLCS(oldL, newL);

  let oi = 0, ni = 0, oln = 1, nln = 1;
  for (const { oldIndex, newIndex } of lcs) {
    while (oi < oldIndex) { raw.push({ type: 'removed', content: oldL[oi], lineNumber: oln++ }); oi++; }
    while (ni < newIndex) { raw.push({ type: 'added', content: newL[ni], lineNumber: nln++ }); ni++; }
    raw.push({ type: 'context', content: oldL[oi], lineNumber: oln++ });
    oi++; ni++; nln++;
  }
  while (oi < oldL.length) { raw.push({ type: 'removed', content: oldL[oi], lineNumber: oln++ }); oi++; }
  while (ni < newL.length) { raw.push({ type: 'added', content: newL[ni], lineNumber: nln++ }); ni++; }

  return _injectInline(raw);
}

// ═══════════════════════════════════════
// 4. Word-level Diff (token 级 LCS)
// ═══════════════════════════════════════

/** 对两行文本做字符级 diff, 返回两组标注片段 */
export function computeWordDiff(oldStr: string, newStr: string): {
  oldSegments: InlineSegment[];
  newSegments: InlineSegment[];
} {
  const ot = _tokenize(oldStr), nt = _tokenize(newStr);
  const lcs = _tokenLCS(ot, nt);
  return {
    oldSegments: _buildSegs(ot, lcs.map(e => e.oldIndex)),
    newSegments: _buildSegs(nt, lcs.map(e => e.newIndex)),
  };
}

/** 将字符串拆为保留空格/标点的 token 数组 */
function _tokenize(s: string): string[] {
  const t: string[] = [];
  let cur = '';
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (/\s/.test(ch) || /[{}()[\];:,.<>+\-=!&|?/\\@#$%^*~`"']/.test(ch)) {
      if (cur) { t.push(cur); cur = ''; }
      t.push(ch);
    } else { cur += ch; }
  }
  if (cur) t.push(cur);
  return t;
}

function _tokenLCS(a: string[], b: string[]): LCSEntry[] {
  const m = a.length, n = b.length;
  if (m * n > 500_000) {
    const res: LCSEntry[] = [];
    const bm = new Map<string, number[]>();
    b.forEach((t, i) => { if (!bm.has(t)) bm.set(t, []); bm.get(t)!.push(i); });
    let last = -1;
    for (let i = 0; i < m; i++) {
      const c = bm.get(a[i]); if (!c) continue;
      const n = c.find(j => j > last);
      if (n !== undefined) { res.push({ oldIndex: i, newIndex: n }); last = n; }
    }
    return res;
  }
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] + 1 : Math.max(dp[i - 1][j], dp[i][j - 1]);
  const res: LCSEntry[] = [];
  let i = m, j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) { res.unshift({ oldIndex: i - 1, newIndex: j - 1 }); i--; j--; }
    else if (dp[i - 1][j] > dp[i][j - 1]) i--;
    else j--;
  }
  return res;
}

function _buildSegs(tokens: string[], matched: number[]): InlineSegment[] {
  const set = new Set(matched);
  const segs: InlineSegment[] = [];
  let cType: 'equal' | 'changed' | null = null, cText = '';
  for (let i = 0; i < tokens.length; i++) {
    const t = set.has(i) ? 'equal' : 'changed';
    if (t === cType) { cText += tokens[i]; }
    else { if (cType && cText) segs.push({ text: cText, type: cType }); cType = t; cText = tokens[i]; }
  }
  if (cType && cText) segs.push({ text: cText, type: cType });
  return segs;
}

// ═══════════════════════════════════════
// 5. 注入行内高亮
// ═══════════════════════════════════════

/** 扫描 removed/added 块对, 逐行注入 word-level diff */
function _injectInline(lines: DiffLine[]): DiffLine[] {
  const r = [...lines];
  let i = 0;
  while (i < r.length) {
    const rs = i;
    while (i < r.length && r[i].type === 'removed') i++;
    const re = i;
    const as = i;
    while (i < r.length && r[i].type === 'added') i++;
    const ae = i;
    const rc = re - rs, ac = ae - as;
    if (rc > 0 && ac > 0 && rc <= 20 && ac <= 20) {
      const pc = Math.min(rc, ac);
      for (let p = 0; p < pc; p++) {
        const ol = r[rs + p].content, nl = r[as + p].content;
        if (_sim(ol, nl) < 0.15) continue;
        const { oldSegments, newSegments } = computeWordDiff(ol, nl);
        r[rs + p] = { ...r[rs + p], inlineSegments: oldSegments };
        r[as + p] = { ...r[as + p], inlineSegments: newSegments };
      }
    }
    if (rc === 0 && ac === 0) i++;
  }
  return r;
}

/** Jaccard token 相似度 */
function _sim(a: string, b: string): number {
  if (a === b) return 1;
  const sa = new Set(_tokenize(a)), sb = new Set(_tokenize(b));
  let inter = 0;
  for (const t of sa) if (sb.has(t)) inter++;
  const union = sa.size + sb.size - inter;
  return union === 0 ? 0 : inter / union;
}

// ═══════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════

export function removeReplaceBlocks(content: string): string {
  let c = content;
  c = c.replace(/```xml\s*\n[\s\S]*?<replace[\s\S]*?<\/replace>[\s\S]*?\n\s*```/gi, '');
  c = c.replace(/<replace\s+file=["'][^"']+["']\s*>[\s\S]*?<\/replace>/gi, '');
  c = c.replace(/```xml\s*\n\s*```/gi, '');
  return c.replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * 将 <replace> 块替换为编号占位符 ___DIFF_N___，保留周围的 markdown 上下文。
 * 
 * ★ 关键：必须按文档顺序编号，与 parseCodeDiffs 提取顺序一致。
 * parseCodeDiffs 的 pattern 1 按 <replace> 在文档中的出现顺序提取，
 * 所以这里也按 <replace> 的出现位置顺序编号。
 */
export function inlineReplaceBlocks(content: string): string {
  let c = content;
  let idx = 0;
  
  // 单遍扫描：按 <replace> 标签在文档中的出现顺序编号
  // 无论是裸露的还是包裹在 ```xml 中的，都按出现位置处理
  c = c.replace(/<replace\s+file=["'][^"']+["']\s*>[\s\S]*?<\/replace>/gi, () => `___DIFF_${idx++}___`);
  
  // 清理残留的空 ```xml 围栏（<replace> 已被替换，只剩空壳）
  c = c.replace(/```xml\s*\n\s*___DIFF_(\d+)___\s*\n\s*```/g, '___DIFF_$1___');
  c = c.replace(/```xml\s*\n\s*```/gi, '');
  
  return c.replace(/\n{3,}/g, '\n\n').trim();
}

export function hasReplaceBlocks(content: string): boolean {
  return /<replace\s+file=["'][^"']+["']\s*>/i.test(content);
}
