/**
 * researchFlow/types.ts — 对话流模式共享类型
 */

export type StepCategory = 'think' | 'search' | 'browse' | 'command' | 'code' | 'observe' | 'summary' | 'progress';

export interface FlowStep {
  id: string;
  category: StepCategory;
  title: string;
  detail?: string;
  screenshot?: string;        // base64 缩略图
  screenshotBase64?: string;  // 完整截图 base64（来自 sandbox.browser）
  url?: string;
  timestamp: number;
}

export interface FlowStepGroup {
  type: 'step';
  step: FlowStep;
}

export interface FlowCollapsedGroup {
  type: 'collapsed';
  steps: FlowStep[];
}

export type FlowItem = FlowStepGroup | FlowCollapsedGroup;

/** 任务执行阶段 */
export type TaskPhase = 'search' | 'analyze' | 'write';

export interface PhaseInfo {
  key: TaskPhase;
  label: string;
  weight: number;  // 占总进度的权重 (0-1)
}

/** 研究任务的标准阶段 */
export const RESEARCH_PHASES: PhaseInfo[] = [
  { key: 'search',  label: '搜索',  weight: 0.3 },
  { key: 'analyze', label: '分析',  weight: 0.4 },
  { key: 'write',   label: '撰写',  weight: 0.3 },
];

/** 步骤分类的视觉配置 */
export const STEP_CONFIG: Record<StepCategory, { label: string; color: string; bgColor: string; borderColor: string; darkBgColor: string; darkBorderColor: string }> = {
  think:    { label: '思考', color: '#d97706', bgColor: '#fffbeb', borderColor: '#fde68a', darkBgColor: 'rgba(120,53,15,0.12)', darkBorderColor: 'rgba(253,230,138,0.15)' },
  search:   { label: '搜索', color: '#3b82f6', bgColor: '#eff6ff', borderColor: '#bfdbfe', darkBgColor: 'rgba(30,64,175,0.12)', darkBorderColor: 'rgba(191,219,254,0.15)' },
  browse:   { label: '浏览', color: '#6366f1', bgColor: '#eef2ff', borderColor: '#c7d2fe', darkBgColor: 'rgba(67,56,202,0.12)', darkBorderColor: 'rgba(199,210,254,0.15)' },
  command:  { label: '终端', color: '#0891b2', bgColor: '#ecfeff', borderColor: '#a5f3fc', darkBgColor: 'rgba(14,116,144,0.12)', darkBorderColor: 'rgba(165,243,252,0.15)' },
  code:     { label: '代码', color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#ddd6fe', darkBgColor: 'rgba(91,33,182,0.12)', darkBorderColor: 'rgba(221,214,254,0.15)' },
  observe:  { label: '分析', color: '#059669', bgColor: '#ecfdf5', borderColor: '#a7f3d0', darkBgColor: 'rgba(6,95,70,0.12)', darkBorderColor: 'rgba(167,243,208,0.15)' },
  summary:  { label: '撰写', color: '#7c3aed', bgColor: '#f5f3ff', borderColor: '#ddd6fe', darkBgColor: 'rgba(91,33,182,0.12)', darkBorderColor: 'rgba(221,214,254,0.15)' },
  progress: { label: '进度', color: '#6366f1', bgColor: '#eef2ff', borderColor: '#c7d2fe', darkBgColor: 'rgba(67,56,202,0.12)', darkBorderColor: 'rgba(199,210,254,0.15)' },
};

/** 根据步骤分类推断当前阶段 */
export function inferPhase(steps: FlowStep[]): TaskPhase {
  if (steps.length === 0) return 'search';
  const last = steps[steps.length - 1];
  if (last.category === 'summary') return 'write';
  const hasObserve = steps.some(s => s.category === 'observe');
  const searchCount = steps.filter(s => s.category === 'search').length;
  if (hasObserve || searchCount >= 2) return 'analyze';
  return 'search';
}
