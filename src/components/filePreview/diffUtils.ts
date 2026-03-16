/**
 * 文件预览 — Diff 算法和工具函数（增强版）
 * 改进：支持中英文标记、优化大文件性能、增加 paired diff 支持
 */

// ─── 语言检测 ───

export function detectLanguage(fileName?: string, content?: string): string {
  if (fileName) {
    const ext = fileName.split('.').pop()?.toLowerCase();
    const langMap: Record<string, string> = {
      'php': 'php', 'js': 'javascript', 'ts': 'typescript', 'tsx': 'typescript',
      'jsx': 'javascript', 'css': 'css', 'html': 'html', 'htm': 'html',
      'json': 'json', 'py': 'python', 'sql': 'sql', 'md': 'markdown',
      'sh': 'bash', 'bash': 'bash', 'zsh': 'bash', 'fish': 'bash',
      'patch': 'diff', 'diff': 'diff', 'yml': 'yaml', 'yaml': 'yaml',
      'xml': 'html', 'svg': 'html', 'vue': 'html', 'svelte': 'html',
      'rs': 'typescript', 'go': 'typescript', 'java': 'typescript',
      'rb': 'python', 'lua': 'python', 'r': 'python',
      'env': 'bash', 'toml': 'yaml', 'ini': 'yaml', 'conf': 'yaml',
      'graphql': 'typescript', 'gql': 'typescript',
      'dockerfile': 'bash', 'makefile': 'bash',
    };
    if (ext && langMap[ext]) return langMap[ext];
    // 无扩展名时检查文件名
    const base = fileName.split('/').pop()?.toLowerCase() || '';
    if (base === 'dockerfile' || base === 'makefile') return 'bash';
    if (base === '.env' || base.endsWith('.env.local')) return 'bash';
  }
  if (content) {
    if (content.includes('<?php')) return 'php';
    if (content.includes('#!/bin/bash') || content.includes('#!/bin/sh')) return 'bash';
    if (/^{[\s\n]/.test(content) && content.includes('"')) return 'json';
    if (content.includes('function ') && content.includes('var ')) return 'javascript';
    if (/[─—]{2,}.*(旧代码|替换为|新代码)/.test(content)) return 'diff';
  }
  return 'text';
}

// ─── Diff 数据结构 ───

export interface DiffLine {
  type: 'unchanged' | 'added' | 'removed';
  content: string;
  oldLineNum?: number;
  newLineNum?: number;
  /** 配对行（added 对应的 removed 行或反之），用于 word-level diff */
  pairedContent?: string;
}

export interface ParsedDiff {
  hasDiff: boolean;
  oldCode: string;
  newCode: string;
  fullContent: string;
}

export type ViewMode = 'diff' | 'original' | 'modified';

// ─── LCS Diff 算法 ───

export function computeDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  const m = oldLines.length;
  const n = newLines.length;

  // 大文件使用 Myers diff 的简化版
  if (m * n > 500000) {
    return myersDiff(oldLines, newLines);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (oldLines[i - 1] === newLines[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const temp: DiffLine[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && oldLines[i - 1] === newLines[j - 1]) {
      temp.push({ type: 'unchanged', content: oldLines[i - 1], oldLineNum: i, newLineNum: j });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      temp.push({ type: 'added', content: newLines[j - 1], newLineNum: j });
      j--;
    } else {
      temp.push({ type: 'removed', content: oldLines[i - 1], oldLineNum: i });
      i--;
    }
  }

  temp.reverse();

  // 为 added/removed 对标记 pairedContent
  return pairDiffLines(temp);
}

/**
 * 为相邻的 removed→added 行配对，供 word-level diff 使用
 */
function pairDiffLines(lines: DiffLine[]): DiffLine[] {
  const result = [...lines];
  let i = 0;
  while (i < result.length) {
    // 寻找连续的 removed 块后面跟着的 added 块
    if (result[i].type === 'removed') {
      const removedStart = i;
      while (i < result.length && result[i].type === 'removed') i++;
      const removedEnd = i;

      const addedStart = i;
      while (i < result.length && result[i].type === 'added') i++;
      const addedEnd = i;

      // 一一配对
      const removedCount = removedEnd - removedStart;
      const addedCount = addedEnd - addedStart;
      const pairCount = Math.min(removedCount, addedCount);

      for (let p = 0; p < pairCount; p++) {
        result[removedStart + p].pairedContent = result[addedStart + p].content;
        result[addedStart + p].pairedContent = result[removedStart + p].content;
      }
    } else {
      i++;
    }
  }
  return result;
}

/**
 * 简化版 Myers diff（用于大文件）
 * 比逐行对比好，会寻找相似行的匹配
 */
function myersDiff(oldLines: string[], newLines: string[]): DiffLine[] {
  // 用哈希加速：先找完全相同的行
  const result: DiffLine[] = [];
  const oldSet = new Map<string, number[]>();
  oldLines.forEach((line, i) => {
    const arr = oldSet.get(line) || [];
    arr.push(i);
    oldSet.set(line, arr);
  });

  // 简化：用 patience diff 的思路 — 先找唯一行作为锚点
  const uniqueOld = new Map<string, number>();
  const uniqueNew = new Map<string, number>();

  oldLines.forEach((line, i) => {
    if (uniqueOld.has(line)) uniqueOld.set(line, -1); // mark as non-unique
    else uniqueOld.set(line, i);
  });
  newLines.forEach((line, i) => {
    if (uniqueNew.has(line)) uniqueNew.set(line, -1);
    else uniqueNew.set(line, i);
  });

  // 找到在两边都唯一的行作为锚点
  const anchors: [number, number][] = [];
  for (const [line, oldIdx] of uniqueOld) {
    if (oldIdx === -1) continue;
    const newIdx = uniqueNew.get(line);
    if (newIdx !== undefined && newIdx !== -1) {
      anchors.push([oldIdx, newIdx]);
    }
  }

  // 按旧文件位置排序并过滤非递增的新位置
  anchors.sort((a, b) => a[0] - b[0]);
  const validAnchors: [number, number][] = [];
  let lastNewIdx = -1;
  for (const [oi, ni] of anchors) {
    if (ni > lastNewIdx) {
      validAnchors.push([oi, ni]);
      lastNewIdx = ni;
    }
  }

  // 根据锚点划分区间，每个区间内逐行对比
  let oi = 0, ni = 0;
  for (const [ao, an] of validAnchors) {
    // 处理锚点前的区间
    while (oi < ao) {
      result.push({ type: 'removed', content: oldLines[oi], oldLineNum: oi + 1 });
      oi++;
    }
    while (ni < an) {
      result.push({ type: 'added', content: newLines[ni], newLineNum: ni + 1 });
      ni++;
    }
    // 锚点本身
    result.push({ type: 'unchanged', content: oldLines[oi], oldLineNum: oi + 1, newLineNum: ni + 1 });
    oi++; ni++;
  }

  // 处理最后的区间
  while (oi < oldLines.length) {
    result.push({ type: 'removed', content: oldLines[oi], oldLineNum: oi + 1 });
    oi++;
  }
  while (ni < newLines.length) {
    result.push({ type: 'added', content: newLines[ni], newLineNum: ni + 1 });
    ni++;
  }

  return pairDiffLines(result);
}

// ─── 内容解析（支持中英文标记） ───

export function parseContent(content: string): ParsedDiff {
  // 中文标记
  const oldMarkerRegex = /\/\/\s*[─—\-]{2,}\s*(旧代码|原代码|原始代码|原始|before|old code|OLD)\s*[─—\-]{2,}/i;
  const newMarkerRegex = /\/\/\s*[─—\-]{2,}\s*(新代码|替换为|修改后|修改代码|after|new code|NEW)\s*[─—\-]{2,}/i;

  const oldMatch = content.match(oldMarkerRegex);
  const newMatch = content.match(newMarkerRegex);

  if (oldMatch && newMatch && oldMatch.index !== undefined && newMatch.index !== undefined) {
    const oldStart = oldMatch.index + oldMatch[0].length;
    const oldCode = content.substring(oldStart, newMatch.index).trim();
    const newStart = newMatch.index + newMatch[0].length;
    const newCode = content.substring(newStart).trim();

    return { hasDiff: true, oldCode, newCode, fullContent: content };
  }

  return { hasDiff: false, oldCode: '', newCode: '', fullContent: content };
}

// ─── 文件扩展名提取 ───

export function getFileExtension(fileName?: string): string {
  if (!fileName) return '';
  return fileName.split('.').pop()?.toLowerCase() || '';
}

// ─── 文件图标颜色映射 ───

export function getFileIconColor(ext: string): string {
  const colorMap: Record<string, string> = {
    'ts': 'text-blue-400', 'tsx': 'text-blue-400',
    'js': 'text-yellow-400', 'jsx': 'text-yellow-400',
    'py': 'text-green-400',
    'css': 'text-pink-400', 'scss': 'text-pink-400',
    'html': 'text-orange-400', 'vue': 'text-green-400',
    'json': 'text-yellow-300',
    'md': 'text-gray-400',
    'sql': 'text-cyan-400',
    'php': 'text-purple-400',
    'sh': 'text-green-300', 'bash': 'text-green-300',
    'yaml': 'text-red-300', 'yml': 'text-red-300',
    'xml': 'text-orange-300', 'svg': 'text-orange-300',
  };
  return colorMap[ext] || 'text-blue-500';
}
