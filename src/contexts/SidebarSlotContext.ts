/**
 * SidebarSlotContext — 侧边栏插槽通信
 *
 * DashboardLayout 提供 slotRef（空 DOM 容器）
 * Chat.tsx 读取 slotRef，通过 createPortal 渲染对话列表进去
 *
 * ★ slotReady 是关键：React ref 在 commit 阶段才设置值，
 *   但子组件在 render 阶段就需要读取。slotReady 作为 state
 *   触发子组件在 ref 就绪后重新渲染。
 */
import { createContext, useContext } from 'react';
import type { RefObject } from 'react';

interface SidebarSlotContextValue {
  /** 侧边栏内容区的 DOM ref */
  slotRef: RefObject<HTMLDivElement | null>;
  /** ref 是否已就绪（DOM 已挂载） — 用于触发消费者重渲染 */
  slotReady: boolean;
  /** 当前是否处于 slot 模式 */
  isSlotActive: boolean;
  /** Chat.tsx 调用此方法激活/停用 slot */
  setSlotActive: (active: boolean) => void;
  /** 关闭移动端侧边栏 sheet */
  closeMobileSidebar: () => void;
}

export const SidebarSlotContext = createContext<SidebarSlotContextValue | null>(null);

export function useSidebarSlot() {
  return useContext(SidebarSlotContext);
}
