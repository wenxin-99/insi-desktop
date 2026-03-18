/**
 * Chat.tsx — RightSidePanel 文件预览区域改动
 * 
 * 仅展示需要修改的部分，不是完整文件
 * 搜索 RightSidePanel 并应用以下改动：
 */

// ─── 改动 1：RightSidePanel 添加 noPadding ───
// 原始 (Chat.tsx ~L188):
//   <RightSidePanel
//     title={activeResearchTaskId ? t('chat.research.sandbox') : '文件预览'}
//     defaultCollapsed={false}
//   >

// 改为：
<RightSidePanel
  title={activeResearchTaskId ? t('chat.research.sandbox') : '文件预览'}
  defaultCollapsed={false}
  noPadding={!activeResearchTaskId}  // 文件预览时不加 padding
>

// ─── 改动 2：ChatHeader 移除 showThinkingPanel 相关 props ───
// 原始 ChatHeader 调用中如果传了 showThinkingPanel / setShowThinkingPanel，
// 现在可以移除这两个 props，因为 FilePreviewSheet 内部自行管理 open 状态

// ─── 改动 3：ChatToolbar 同理 ───
// 移除传给 ChatToolbar 的 showThinkingPanel 相关引用
