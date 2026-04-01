/**
 * shikiHighlighter.ts — Shiki WASM 高亮引擎懒加载单例
 *
 * VS Code 同款 TextMate 语法引擎，300+ 语言支持。
 * - 懒加载：首次调用时才初始化（~200KB WASM）
 * - 单例：全局共享一个 highlighter 实例
 * - 容错：加载失败自动 fallback 到 null（调用方回退 tokenize）
 * - 中国 CDN：优先 cdn.jsdelivr.net（国内可达）
 */

import type { Highlighter, BundledLanguage, BundledTheme } from 'shiki';

let highlighterPromise: Promise<Highlighter | null> | null = null;
let highlighterInstance: Highlighter | null = null;

// 预加载的常用语言（其余按需加载）
const PRELOAD_LANGS: BundledLanguage[] = [
  'javascript', 'typescript', 'python', 'json', 'html', 'css',
  'bash', 'sql', 'yaml', 'markdown', 'jsx', 'tsx',
];

// 主题
const THEME: BundledTheme = 'catppuccin-mocha';

// 语言别名标准化
const LANG_ALIAS: Record<string, string> = {
  js: 'javascript', ts: 'typescript', py: 'python', rb: 'ruby',
  sh: 'bash', yml: 'yaml', md: 'markdown', kt: 'kotlin',
  objc: 'objectivec', 'objective-c': 'objectivec', 'obj-c': 'objectivec',
  hs: 'haskell', rs: 'rust', cs: 'csharp', 'c++': 'cpp',
  text: 'plaintext', txt: 'plaintext',
};

/**
 * 标准化语言名称
 */
export function normalizeLang(lang: string): string {
  const lower = (lang || '').toLowerCase().trim();
  return LANG_ALIAS[lower] || lower || 'plaintext';
}

/**
 * 获取或初始化 Shiki highlighter 单例
 */
export async function getHighlighter(): Promise<Highlighter | null> {
  if (highlighterInstance) return highlighterInstance;

  if (!highlighterPromise) {
    highlighterPromise = initHighlighter();
  }

  return highlighterPromise;
}

async function initHighlighter(): Promise<Highlighter | null> {
  try {
    // 动态导入 shiki（Vite 会自动 code-split）
    const { createHighlighter } = await import('shiki');

    const instance = await createHighlighter({
      themes: [THEME],
      langs: PRELOAD_LANGS,
    });

    highlighterInstance = instance;
    return instance;
  } catch (err) {
    console.warn('[Shiki] Failed to initialize, will fallback to tokenize:', err);
    highlighterInstance = null;
    highlighterPromise = null; // 允许重试
    return null;
  }
}

/**
 * 按需加载语言（如果尚未加载）
 */
async function ensureLang(hl: Highlighter, lang: string): Promise<boolean> {
  try {
    const loaded = hl.getLoadedLanguages();
    if (loaded.includes(lang as any)) return true;

    // 尝试动态加载
    await hl.loadLanguage(lang as BundledLanguage);
    return true;
  } catch {
    // 该语言不被 Shiki 支持，回退
    return false;
  }
}

/**
 * 高亮代码，返回带 <span> 的 HTML 字符串
 *
 * @param code 源代码
 * @param lang 语言标识
 * @returns { html: string, fromShiki: boolean } — fromShiki=false 表示应使用 fallback
 */
export async function highlightCode(
  code: string,
  lang: string
): Promise<{ html: string; fromShiki: boolean }> {
  // 超长代码跳过 Shiki（避免 WASM 卡顿）
  if (code.length > 200_000) {
    return { html: '', fromShiki: false };
  }
  // 超多行也跳过（高效计数，不 split）
  let lineCount = 1;
  for (let i = 0; i < code.length && lineCount <= 5000; i++) {
    if (code.charCodeAt(i) === 10) lineCount++;
  }
  if (lineCount > 5000) {
    return { html: '', fromShiki: false };
  }

  const normalized = normalizeLang(lang);
  if (normalized === 'plaintext' || normalized === 'text') {
    return { html: '', fromShiki: false };
  }

  const hl = await getHighlighter();
  if (!hl) return { html: '', fromShiki: false };

  const langOk = await ensureLang(hl, normalized);
  if (!langOk) return { html: '', fromShiki: false };

  try {
    const result = hl.codeToHtml(code, {
      lang: normalized as BundledLanguage,
      theme: THEME,
    });

    // Shiki 输出 <pre class="shiki ..."><code>...</code></pre>
    // 提取 <code> 内容（去掉外层 pre/code 标签，因为 CodeBlock 已有自己的 pre/code）
    const codeMatch = result.match(/<code[^>]*>([\s\S]*)<\/code>/);
    if (!codeMatch) return { html: '', fromShiki: false };

    // 提取内部 HTML，去掉每行的 <span class="line"> 包裹（CodeBlock 自己管理行号）
    let inner = codeMatch[1];
    // Shiki v1 输出每行一个 <span class="line">inner_spans</span>
    // 按行处理：每行去掉首尾的 line wrapper，保留内部 token spans
    inner = inner.split('\n').map(line =>
      line.replace(/^<span class="line">(.*)<\/span>$/, '$1')
    ).join('\n');

    return { html: inner, fromShiki: true };
  } catch (err) {
    console.warn('[Shiki] Highlight failed for', normalized, err);
    return { html: '', fromShiki: false };
  }
}

/**
 * 同步检查 Shiki 是否已就绪（不触发加载）
 */
export function isShikiReady(): boolean {
  return highlighterInstance !== null;
}

/**
 * 预热：在空闲时预加载 Shiki（不阻塞首屏）
 */
export function preloadShiki(): void {
  if (highlighterInstance || highlighterPromise) return;
  // 使用 requestIdleCallback 在空闲时加载
  const idle = (window as any).requestIdleCallback || ((cb: () => void) => setTimeout(cb, 2000));
  idle(() => {
    getHighlighter().catch(() => {});
  });
}
