/**
 * DashboardLayout 菜单配置
 * 从 DashboardLayout.tsx 拆分
 */
import {
  LayoutDashboard, MessageSquare, Image, Video, Coins, ShoppingBag,
  Receipt, UserPlus, MessageCircle, Bot, Brain, Clock, HelpCircle, Headphones,
  Users, Ticket, Bell, Network, TrendingUp, TestTube, Package, Mic2,
  Gauge, Percent, CreditCard, Settings, HardDrive, FileText, Terminal,
  Download, Cpu, Sparkles, Shield,
} from "lucide-react";

export interface MenuItem {
  icon: any;
  label: string;
  path: string;
}

export interface MenuGroup {
  label: string;
  items: MenuItem[];
}

export function getUserMenuItems(t: (key: string, fallback?: string) => string): MenuItem[] {
  return [
    { icon: LayoutDashboard, label: t('dashboard.menu.user.workspace'), path: "/dashboard" },
    { icon: MessageSquare, label: t('dashboard.menu.user.aiChat'), path: "/chat" },
    { icon: Headphones, label: "语音对话", path: "/voice-chat" },
    { icon: Image, label: t('dashboard.menu.user.imageHistory'), path: "/images" },
    { icon: Video, label: t('dashboard.menu.user.videoHistory'), path: "/video-history" },
    { icon: Coins, label: t('dashboard.menu.user.coinManagement'), path: "/transactions" },
    { icon: ShoppingBag, label: t('dashboard.menu.user.productPurchase'), path: "/recharge" },
    { icon: Receipt, label: "充值订单", path: "/orders" },
    { icon: UserPlus, label: t('dashboard.menu.user.inviteFriends'), path: "/invite" },
    { icon: MessageCircle, label: t('dashboard.menu.user.userFeedback'), path: "/feedback" },
    { icon: Bot, label: t('dashboard.menu.user.automationSandbox'), path: "/automation" },
    { icon: Brain, label: "我的记忆", path: "/memory" },
    { icon: Clock, label: t('dashboard.menu.user.scheduledTasks'), path: "/scheduled-tasks" },
    { icon: HelpCircle, label: t('dashboard.menu.user.helpCenter'), path: "/help" },
  ];
}

export function getAdminMenuGroups(t: (key: string, fallback?: string) => string): MenuGroup[] {
  return [
    { label: t('dashboard.menu.admin.group.overview', '总览'), items: [
      { icon: LayoutDashboard, label: t('dashboard.menu.admin.dashboard'), path: "/admin" },
    ]},
    { label: t('dashboard.menu.admin.group.users', '用户运营'), items: [
      { icon: Users, label: t('dashboard.menu.admin.userManagement'), path: "/admin/users" },
      { icon: Ticket, label: t('dashboard.menu.admin.invitationCodes'), path: "/admin/invitations" },
      { icon: MessageCircle, label: t('dashboard.menu.admin.feedbackManagement'), path: "/admin/feedbacks" },
      { icon: Bell, label: t('dashboard.menu.admin.systemNotifications'), path: "/admin/notifications" },
    ]},
    { label: t('dashboard.menu.admin.group.ai', 'AI 服务'), items: [
      { icon: Bot, label: t('dashboard.menu.admin.modelManagement'), path: "/admin/models" },
      { icon: Network, label: t('dashboard.menu.admin.proxyManagement'), path: "/admin/proxies" },
      { icon: TrendingUp, label: t('dashboard.menu.admin.modelComparison'), path: "/model-comparison" },
      { icon: TestTube, label: t('dashboard.menu.admin.imageTest'), path: "/admin/image-test" },
    ]},
    { label: t('dashboard.menu.admin.group.billing', '套餐与计费'), items: [
      { icon: Package, label: t('dashboard.menu.admin.group.packagePricing', '套餐与定价'), path: "/admin/packages" },
      { icon: Mic2, label: '语音套餐', path: "/admin/voice-packages" },
      { icon: Percent, label: t('dashboard.menu.admin.discountManagement'), path: "/admin/discount" },
      { icon: Coins, label: t('dashboard.menu.admin.coinManagement'), path: "/admin/fish-coin-management" },
      { icon: CreditCard, label: t('dashboard.menu.admin.paymentConfig'), path: "/admin/payment-config" },
    ]},
    { label: t('dashboard.menu.admin.group.infra', '基础设施'), items: [
      { icon: Settings, label: t('dashboard.menu.admin.systemSettings'), path: "/admin/system-settings" },
      { icon: HardDrive, label: t('dashboard.menu.admin.storageSettings'), path: "/admin/storage-settings" },
      { icon: FileText, label: t('dashboard.menu.admin.pdfWatermarkConfig'), path: "/admin/pdf-watermark-config" },
      { icon: Terminal, label: t('dashboard.menu.admin.sshSettings'), path: "/admin/ssh-settings" },
      { icon: Download, label: t('dashboard.menu.admin.dataExport'), path: "/admin/export" },
      { icon: Bot, label: t('dashboard.menu.user.automationSandbox'), path: "/automation" },
      { icon: Clock, label: t('dashboard.menu.user.scheduledTasks'), path: "/scheduled-tasks" },
    ]},
    { label: 'AI 运维', items: [
      { icon: Cpu, label: "AI 运维中心", path: "/admin/ai-ops" },
      { icon: Sparkles, label: "AI 运维助手", path: "/admin/ai-ops/chat" },
      { icon: Shield, label: "修复审批", path: "/admin/ai-ops/approvals" },
      { icon: Brain, label: "修复知识库", path: "/admin/ai-ops/knowledge" },
      { icon: TrendingUp, label: "数据分析", path: "/admin/ai-ops/analytics" },
    ]},
  ];
}
