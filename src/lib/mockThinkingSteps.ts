import { ThinkingStep } from '@/components/ThinkingProcessPanel';

/**
 * 模拟AI思考流程数据
 * 在实际应用中，这些数据应该从后端API实时获取
 */
export function generateMockThinkingSteps(): ThinkingStep[] {
  const now = Date.now();
  
  return [
    {
      id: '1',
      name: '分析用户问题',
      status: 'completed',
      startTime: now - 5000,
      endTime: now - 4500,
      details: '识别问题类型：技术咨询\n关键词：语音识别、错误修复',
    },
    {
      id: '2',
      name: '搜索相关资料',
      status: 'completed',
      startTime: now - 4500,
      endTime: now - 3200,
      substeps: [
        {
          id: '2-1',
          name: '查询文档库',
          status: 'completed',
          startTime: now - 4500,
          endTime: now - 4000,
          details: '找到3篇相关文档',
        },
        {
          id: '2-2',
          name: '检索代码示例',
          status: 'completed',
          startTime: now - 4000,
          endTime: now - 3200,
          details: '找到5个相关代码片段',
        },
      ],
    },
    {
      id: '3',
      name: '生成解决方案',
      status: 'completed',
      startTime: now - 3200,
      endTime: now - 1800,
      details: '基于搜索结果生成3种可能的解决方案',
    },
    {
      id: '4',
      name: '编写回答',
      status: 'completed',
      startTime: now - 1800,
      endTime: now - 500,
      substeps: [
        {
          id: '4-1',
          name: '组织内容结构',
          status: 'completed',
          startTime: now - 1800,
          endTime: now - 1500,
        },
        {
          id: '4-2',
          name: '生成代码示例',
          status: 'completed',
          startTime: now - 1500,
          endTime: now - 800,
        },
        {
          id: '4-3',
          name: '添加说明文字',
          status: 'completed',
          startTime: now - 800,
          endTime: now - 500,
        },
      ],
    },
    {
      id: '5',
      name: '质量检查',
      status: 'completed',
      startTime: now - 500,
      endTime: now,
      details: '检查语法、逻辑、完整性',
    },
  ];
}

/**
 * 生成实时思考流程（模拟流式输出）
 */
export function generateStreamingThinkingSteps(): ThinkingStep[] {
  const now = Date.now();
  
  return [
    {
      id: '1',
      name: '理解问题',
      status: 'completed',
      startTime: now - 2000,
      endTime: now - 1800,
    },
    {
      id: '2',
      name: '检索知识库',
      status: 'running',
      startTime: now - 1800,
      details: '正在搜索相关文档...',
    },
    {
      id: '3',
      name: '生成回答',
      status: 'pending',
      startTime: now,
    },
  ];
}
