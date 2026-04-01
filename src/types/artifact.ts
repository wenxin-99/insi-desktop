/**
 * Artifact & SolutionPicker 共享类型
 *
 * ★ 从 pages/chat/types.ts 提取到此处，避免 components/ → pages/chat/ 的反向引用
 *   导致 Vite 代码分割时产生 chunk 循环依赖（"Cannot access 'X' before initialization"）
 */

export interface ArtifactData {
  id: string;
  title: string;
  language: 'html' | 'react' | 'vue' | 'css' | 'javascript' | 'mermaid' | 'svg';
  code: string;
  description?: string;
  version: number;
  previousCode?: string;
  status: 'streaming' | 'complete' | 'approved' | 'rejected';
}

export interface SolutionPickerData {
  id: string;
  question: string;
  options: Array<{ title: string; description?: string }>;
  allowCustom: boolean;
  allowSkip: boolean;
  selectedIndex?: number;
  customText?: string;
  status: 'pending' | 'selected' | 'skipped';
}
