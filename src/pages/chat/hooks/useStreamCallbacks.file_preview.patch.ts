/**
 * useStreamCallbacks.ts — file_preview 事件处理补丁
 *
 * 在 useStreamCallbacks.ts 的 SSE 事件处理器中添加以下回调
 * 位置：与 onContent / onOperation / onThinking 等回调并列
 */

// ═══════ 新增回调处理 ═══════

// 在构建 streamCallbacks 对象时，添加：
onFilePreview: (data: {
  fileName: string;
  action: 'create' | 'modify' | 'delete';
  newContent?: string;
  oldContent?: string;
  timestamp: number;
}) => {
  // 构建预览内容
  let previewContent = '';

  if (data.action === 'modify' && data.oldContent && data.newContent) {
    // 有旧代码和新代码 → 构建 diff 格式
    previewContent = `// ──── 旧代码 ────\n${data.oldContent}\n\n// ──── 新代码 ────\n${data.newContent}`;
  } else if (data.newContent) {
    // 仅有新代码（创建文件）
    previewContent = data.newContent;
  }

  if (previewContent) {
    // 更新或添加到多文件预览
    setPreviewFile({
      name: data.fileName,
      content: previewContent,
      isLive: true,  // 流式中
    });

    // 更新文件名引用
    lastFileNameRef.current = data.fileName;
    previewOpenedRef.current = true;
  }
},

// ═══════ SSE 解析层改动 ═══════

// 在 chatStream 的 EventSource 消息解析中（通常在 useSendMessage.ts 或 chatApi.ts），
// 需要识别 type: 'file_preview' 并路由到上述回调：

// 示例：
// case 'file_preview':
//   callbacks.onFilePreview?.(data);
//   break;

// ═══════ 渐进式迁移说明 ═══════
//
// 1. 服务端新增 sendFilePreview() 调用不影响现有逻辑
// 2. 前端同时保留旧的正则解析逻辑（useChatEffects 中的代码块提取）
// 3. file_preview 事件优先级高于正则解析
// 4. 当服务端全面覆盖后，可以移除 useChatEffects 中的正则提取逻辑
//
// 判断是否使用 file_preview 事件：
//   if (hasReceivedFilePreviewEvent) {
//     // 跳过正则解析
//   } else {
//     // 回退到旧的正则解析
//   }
