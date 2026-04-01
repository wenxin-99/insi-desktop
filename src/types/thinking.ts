/**
 * 统一的思考步骤类型定义
 */

export type ThinkingStepStatus = 'pending' | 'running' | 'completed' | 'error';

export type ThinkingStep = {
  id: string;
  name: string;
  status: ThinkingStepStatus;
  startTime: number;
  endTime?: number;
  details?: string;
  substeps?: ThinkingStep[];
};
