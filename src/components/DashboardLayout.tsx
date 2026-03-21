import { useAuth } from "@/_core/hooks/useAuth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar";
import { getLoginUrl } from "@/const";
import { useIsMobile } from "@/hooks/useMobile";
import { LayoutDashboard, LogOut, Brain as BrainIcon, PanelLeft, Users, Bot, Ticket, MessageSquare, FileText, Image, Video, Mic, Coins, Settings, Bell, UserCircle, Wallet, HelpCircle, UserPlus, MessageCircle, Download, Gauge, Crown, Package, TrendingUp, Percent, Home, DollarSign, CreditCard, Receipt, ShoppingBag, Network, HardDrive, TestTube, Mic2, Terminal, Clock, ChevronDown, Brain, BarChart3, Cpu, Sparkles, Shield, Headphones, BookOpen, Dna, Database, Github, Store, Search } from "lucide-react";
import { SettingsMenu } from "@/components/SettingsMenu";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { CSSProperties, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { DashboardLayoutSkeleton } from './DashboardLayoutSkeleton';
import { Button } from "./ui/button";
import { useTranslation } from "react-i18next";

// userMenuItems will be generated dynamically using t() in the component

// adminMenuItems will be generated dynamically using t() in the component

const SIDEBAR_WIDTH_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 200;
const MAX_WIDTH = 480;

export default function DashboardLayout({
  children,
  hideHeader = false,
}: {
  children: React.ReactNode;
  hideHeader?: boolean;
}) {
  const { t } = useTranslation();
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem(SIDEBAR_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_WIDTH;
  });
  const { loading, user } = useAuth();
  // 必须在组件最顶部调用useIsMobile，在所有条件语句和early return之前
  const isMobile = useIsMobile();

  useEffect(() => {
    localStorage.setItem(SIDEBAR_WIDTH_KEY, sidebarWidth.toString());
  }, [sidebarWidth]);

  if (loading) {
    return <DashboardLayoutSkeleton />
  }

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="flex flex-col items-center gap-8 p-8 max-w-md w-full">
          <div className="flex flex-col items-center gap-6">
            <h1 className="text-2xl font-semibold tracking-tight text-center">
              {t('dashboard.signInToContinue')}
            </h1>
            <p className="text-sm text-muted-foreground text-center max-w-sm">
              {t('dashboard.signInDescription')}
            </p>
          </div>
          <Button
            onClick={() => {
              window.location.href = getLoginUrl();
            }}
            size="lg"
            className="w-full shadow-lg hover:shadow-xl transition-all"
          >
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      defaultOpen={false}
      style={
        {
          "--sidebar-width": `${sidebarWidth}px`,
        } as CSSProperties
      }
    >
      <DashboardLayoutContent setSidebarWidth={setSidebarWidth} hideHeader={hideHeader}>
        {children}
      </DashboardLayoutContent>
    </SidebarProvider>
  );
}

type DashboardLayoutContentProps = {
  children: React.ReactNode;
  setSidebarWidth: (width: number) => void;
  hideHeader?: boolean;
};

function DashboardLayoutContent({
  children,
  setSidebarWidth,
  hideHeader = false,
}: DashboardLayoutContentProps) {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { state, toggleSidebar, isMobile: isSidebarMobile, setOpenMobile } = useSidebar();
  const isCollapsed = state === "collapsed" && !isSidebarMobile; // 移动端 sheet 模式下不算折叠
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);

  // ============ 路径匹配辅助函数 ============
  // wouter 的 location 在某些版本/用法下可能包含 query/hash（例如 /chat?conversation=xxx）。
  // 如果直接用 location === path，会导致侧边栏高亮与移动端标题失效。
  const normalizePath = (path: string) => {
    const base = path.split("?")[0].split("#")[0];
    if (base.length > 1 && base.endsWith("/")) return base.slice(0, -1);
    return base || "/";
  };

  const isPathMatch = (currentPath: string, itemPath: string) => {
    const cur = normalizePath(currentPath);
    const target = normalizePath(itemPath);
    if (cur === target) return true;
    if (target !== "/" && cur.startsWith(`${target}/`)) return true;
    return false;
  };
  
  // Generate menu items dynamically
  // ★ 方案 A 侧边栏精简：4 主导航 + 2 折叠分组
  // 主导航（始终可见）
  const primaryNavItems = [
    { icon: MessageSquare, label: "Insi 对话", path: "/chat" },
    { icon: Search, label: "深度研究", path: "/dashboard" },
    { icon: LayoutDashboard, label: "创作工坊", path: "/images" },
    { icon: Mic, label: "语音对话", path: "/voice-chat" },
  ];

  // 折叠分组：工具 & 创作
  const studioItems = [
    { icon: Image, label: "图片历史", path: "/images" },
    { icon: Video, label: "视频历史", path: "/video-history" },
    { icon: Github, label: "GitHub 工作区", path: "/github-workspace" },
    { icon: Cpu, label: "Agent 中心", path: "/agent" },
    { icon: Store, label: "自动化市场", path: "/playbooks" },
    { icon: Headphones, label: "AI 客服", path: "/customer-service" },
  ];

  // 折叠分组：账户 & 个人（合并了原来的"账户"和"设置"）
  const accountItems = [
    { icon: Coins, label: "🐟币管理", path: "/transactions" },
    { icon: ShoppingBag, label: "产品购买", path: "/pricing" },
    { icon: Receipt, label: "订单历史", path: "/orders" },
    { icon: Crown, label: "订阅管理", path: "/subscription" },
    { icon: UserPlus, label: "邀请好友", path: "/invite" },
    { icon: Bell, label: "通知", path: "/notifications" },
    { icon: MessageCircle, label: "用户反馈", path: "/feedback" },
    { icon: Brain, label: "我的记忆", path: "/memory" },
    { icon: Sparkles, label: "AI 人格配置", path: "/settings/persona" },
    { icon: MessageCircle, label: "渠道管理", path: "/settings/channels" },
    { icon: HelpCircle, label: "帮助中心", path: "/help" },
  ];

  // 完整扁平列表（用于路径匹配）
  const userMenuItems = [
    ...primaryNavItems,
    ...studioItems,
    ...accountItems,
  ];
  
  const adminMenuGroups = [
    {
      id: 'overview',
      label: t('dashboard.menu.admin.group.overview', '总览'),
      items: [
        { icon: LayoutDashboard, label: t('dashboard.menu.admin.dashboard'), path: "/admin" },
      ],
    },
    {
      id: 'users',
      label: t('dashboard.menu.admin.group.users', '用户运营'),
      items: [
        { icon: Users, label: t('dashboard.menu.admin.userManagement'), path: "/admin/users" },
        { icon: Ticket, label: t('dashboard.menu.admin.invitationCodes'), path: "/admin/invitations" },
        { icon: MessageCircle, label: t('dashboard.menu.admin.feedbackManagement'), path: "/admin/feedbacks" },
        { icon: Bell, label: t('dashboard.menu.admin.systemNotifications'), path: "/admin/notifications" },
      ],
    },
    {
      id: 'ai',
      label: t('dashboard.menu.admin.group.ai', 'AI 服务'),
      items: [
        { icon: Bot, label: t('dashboard.menu.admin.modelManagement'), path: "/admin/models" },
        { icon: Network, label: t('dashboard.menu.admin.proxyManagement'), path: "/admin/proxies" },
        { icon: TrendingUp, label: t('dashboard.menu.admin.modelComparison'), path: "/model-comparison" },
        { icon: BarChart3, label: 'Token 统计', path: "/admin/token-stats" },
        { icon: TestTube, label: t('dashboard.menu.admin.imageTest'), path: "/admin/image-test" },
      ],
    },
    {
      id: 'billing',
      label: t('dashboard.menu.admin.group.billing', '套餐与计费'),
      items: [
        { icon: Package, label: t('dashboard.menu.admin.group.packagePricing', '套餐与定价'), path: "/admin/packages" },
        { icon: Database, label: "知识库管理", path: "/admin/knowledge-base" },
        { icon: Mic2, label: '语音套餐', path: "/admin/voice-packages" },
        { icon: Gauge, label: t('dashboard.menu.admin.quotaManagement'), path: "/admin/quota" },
        { icon: Percent, label: t('dashboard.menu.admin.discountManagement'), path: "/admin/discount" },
        { icon: Crown, label: "论坛等级福利", path: "/admin/forum-benefits" },
        { icon: Coins, label: t('dashboard.menu.admin.coinManagement'), path: "/admin/fish-coin-management" },
        { icon: CreditCard, label: t('dashboard.menu.admin.paymentConfig'), path: "/admin/payment-config" },
        { icon: Settings, label: "计费配置", path: "/admin/billing-config" },

      ],
    },
    {
      id: 'infra',
      label: t('dashboard.menu.admin.group.infra', '基础设施'),
      items: [
        { icon: Settings, label: t('dashboard.menu.admin.systemSettings'), path: "/admin/system-settings" },
        { icon: MessageSquare, label: "渠道配置", path: "/admin/channel-settings" },
        { icon: HardDrive, label: t('dashboard.menu.admin.storageSettings'), path: "/admin/storage-settings" },
        { icon: FileText, label: t('dashboard.menu.admin.pdfWatermarkConfig'), path: "/admin/pdf-watermark-config" },
        { icon: Terminal, label: t('dashboard.menu.admin.sshSettings'), path: "/admin/ssh-settings" },
        { icon: Download, label: t('dashboard.menu.admin.dataExport'), path: "/admin/export" },
        { icon: Clock, label: "定时任务管理", path: "/agent?scheduled=true" },
      ],
    },
    {
      id: 'ai-ops',
      label: 'AI 运维',
      items: [
        { icon: Cpu, label: "AI 运维中心", path: "/admin/ai-ops" },
        { icon: Sparkles, label: "AI 运维助手", path: "/admin/ai-ops/chat" },
        { icon: Shield, label: "修复审批", path: "/admin/ai-ops/approvals" },
        { icon: Brain, label: "修复知识库", path: "/admin/ai-ops/knowledge" },
        { icon: TrendingUp, label: "数据分析", path: "/admin/ai-ops/analytics" },
        { icon: Dna, label: "提示词进化", path: "/admin/prompt-evolution" },
        { icon: Store, label: "Playbook 审批", path: "/admin/playbook-approvals" },
      ],
    },
    {
      id: 'cs',
      label: '智能客服',
      items: [
        { icon: BookOpen, label: "客服知识库", path: "/admin/cs-knowledge" },
        { icon: Headphones, label: "客服工作台", path: "/admin/cs-workbench" },
        { icon: BarChart3, label: "客服数据看板", path: "/admin/cs-analytics" },
      ],
    },
    {
      id: 'agent',
      label: 'Agent 系统',
      items: [
        { icon: Cpu, label: "Agent 仪表盘", path: "/admin/agent-dashboard" },
      ],
    },
  ];

  // 扁平化分组，用于路由匹配
  const adminMenuItems = adminMenuGroups.flatMap(g => g.items);
  
  // 根据用户角色选择菜单
  const normalizedLocation = normalizePath(location);

  // 对管理员用户：
  // 1) /admin* 路由一定进入管理员菜单
  // 2) 以及“仅管理员菜单里存在”的页面（例如 /model-comparison、/homework/pricing-config）也视为管理员上下文
  //    避免仅用 startsWith('/admin') 导致这些页面回落到普通用户菜单。
  const userPathSet = new Set(userMenuItems.map((i) => normalizePath(i.path)));
  const adminOnlyMenuItems = adminMenuItems.filter(
    (i) => !userPathSet.has(normalizePath(i.path))
  );
  const isInAdmin =
    user?.role === "admin" &&
    (normalizedLocation.startsWith("/admin") ||
      adminOnlyMenuItems.some((i) => isPathMatch(normalizedLocation, i.path)));

  const menuItems = user?.role === "admin" && isInAdmin ? adminMenuItems : userMenuItems;

  // 选择“最长前缀匹配”的菜单项，避免 /admin 同时匹配 /admin/users 导致多项高亮
  const activeMenuItem = [...menuItems]
    .filter((item) => isPathMatch(normalizedLocation, item.path))
    .sort((a, b) => normalizePath(b.path).length - normalizePath(a.path).length)[0];

  useEffect(() => {
    if (isCollapsed) {
      setIsResizing(false);
    }
  }, [isCollapsed]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      const sidebarLeft = sidebarRef.current?.getBoundingClientRect().left ?? 0;
      const newWidth = e.clientX - sidebarLeft;
      if (newWidth >= MIN_WIDTH && newWidth <= MAX_WIDTH) {
        setSidebarWidth(newWidth);
      }
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, setSidebarWidth]);

  return (
    <>
      <div className="relative" ref={sidebarRef}>
        <Sidebar
          collapsible="icon"
          className="border-r-0"
          disableTransition={isResizing}
        >
          <SidebarHeader className="h-16 justify-center">
            <div className="flex items-center gap-1 px-1 transition-all w-full justify-between">
              <button
                onClick={toggleSidebar}
                className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                aria-label="Toggle navigation"
              >
                <PanelLeft className="h-4 w-4 text-muted-foreground" />
              </button>
              {!isCollapsed && (
                <div className="flex items-center gap-1">
                  <SettingsMenu />
                  <button
                    onClick={() => setLocation('/')}
                    className="h-8 w-8 flex items-center justify-center hover:bg-accent rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring shrink-0"
                    aria-label="返回首页"
                    title="返回首页"
                  >
                    <Home className="h-4 w-4 text-muted-foreground" />
                  </button>
                </div>
              )}
            </div>
          </SidebarHeader>

          <SidebarContent className="gap-0">
            {user?.role === "admin" && isInAdmin ? (
              // 管理员分组菜单
              adminMenuGroups.map((group) => {
                const groupHasActive = group.items.some(item => activeMenuItem?.path === item.path);
                return (
                  <Collapsible key={group.id} defaultOpen={groupHasActive || group.items.length <= 2}>
                    <CollapsibleTrigger asChild>
                      <button className="flex items-center w-full px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden">
                        <span>{group.label}</span>
                        <ChevronDown className="ml-auto h-3 w-3 transition-transform duration-200 [[data-state=closed]_&]:rotate-[-90deg]" />
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="group-data-[collapsible=icon]:hidden">
                      <SidebarMenu className="px-2 py-0.5">
                        {group.items.map(item => {
                          const isActive = activeMenuItem?.path === item.path;
                          return (
                            <SidebarMenuItem key={item.path}>
                              <SidebarMenuButton
                                isActive={isActive}
                                onClick={() => { setLocation(item.path); if (isSidebarMobile) setOpenMobile(false); }}
                                tooltip={item.label}
                                className="h-10 transition-colors font-normal"
                              >
                                <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                                <span>{item.label}</span>
                              </SidebarMenuButton>
                            </SidebarMenuItem>
                          );
                        })}
                      </SidebarMenu>
                    </CollapsibleContent>
                    {/* 折叠态 icon-only 也要显示图标 */}
                    <SidebarMenu className="px-2 py-0.5 group-data-[collapsible=icon]:block hidden">
                      {group.items.map(item => {
                        const isActive = activeMenuItem?.path === item.path;
                        return (
                          <SidebarMenuItem key={item.path}>
                            <SidebarMenuButton
                              isActive={isActive}
                              onClick={() => setLocation(item.path)}
                              tooltip={item.label}
                              className="h-10 transition-colors font-normal"
                            >
                              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </Collapsible>
                );
              })
            ) : (
              // ★ 方案 A：主导航 + 折叠分组
              <>
                {/* 主导航（4 个核心入口） */}
                <SidebarMenu className="px-2 py-1">
                  {primaryNavItems.map((item, idx) => {
                    const isActive = activeMenuItem?.path === item.path;
                    return (
                      <SidebarMenuItem key={`primary-${idx}-${item.path}`}>
                        <SidebarMenuButton
                          isActive={isActive}
                          onClick={() => setLocation(item.path)}
                          tooltip={item.label}
                          className="h-10 transition-colors font-normal"
                        >
                          <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                          <span>{item.label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>

                {/* 分隔线 */}
                <div className="mx-4 my-1 border-t border-border/50 group-data-[collapsible=icon]:hidden" />

                {/* 折叠分组：工具 */}
                <Collapsible defaultOpen={studioItems.some(i => activeMenuItem?.path === i.path)}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center w-full px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden">
                      <span>工具</span>
                      <ChevronDown className="ml-auto h-3 w-3 transition-transform duration-200 [[data-state=closed]_&]:rotate-[-90deg]" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu className="px-2 py-0.5">
                      {studioItems.map((item, idx) => {
                        const isActive = activeMenuItem?.path === item.path;
                        return (
                          <SidebarMenuItem key={`studio-${idx}-${item.path}`}>
                            <SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 transition-colors font-normal text-sm">
                              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>

                {/* 折叠分组：账户与个人 */}
                <Collapsible defaultOpen={accountItems.some(i => activeMenuItem?.path === i.path)}>
                  <CollapsibleTrigger asChild>
                    <button className="flex items-center w-full px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider cursor-pointer hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden">
                      <span>账户</span>
                      <ChevronDown className="ml-auto h-3 w-3 transition-transform duration-200 [[data-state=closed]_&]:rotate-[-90deg]" />
                    </button>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenu className="px-2 py-0.5">
                      {accountItems.map((item, idx) => {
                        const isActive = activeMenuItem?.path === item.path;
                        return (
                          <SidebarMenuItem key={`account-${idx}-${item.path}`}>
                            <SidebarMenuButton isActive={isActive} onClick={() => setLocation(item.path)} tooltip={item.label} className="h-9 transition-colors font-normal text-sm">
                              <item.icon className={`h-4 w-4 ${isActive ? "text-primary" : ""}`} />
                              <span>{item.label}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        );
                      })}
                    </SidebarMenu>
                  </CollapsibleContent>
                </Collapsible>
              </>
            )}
          </SidebarContent>

          <SidebarFooter className="p-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-3 rounded-lg px-1 py-1 hover:bg-accent/50 transition-colors w-full text-left group-data-[collapsible=icon]:justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <Avatar className="h-9 w-9 border shrink-0">
                    {user?.avatarUrl ? (
                      <img 
                        src={user.avatarUrl} 
                        alt={user.name || t('dashboard.user')} 
                        className="h-full w-full object-cover rounded-full" 
                        onError={(e) => {
                          // 头像加载失败时隐藏图片，显示fallback
                          e.currentTarget.style.display = 'none';
                        }}
                      />
                    ) : null}
                    <AvatarFallback className="text-xs font-medium">
                      {user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                    <p className="text-sm font-medium truncate leading-none">
                      {user?.name || "-"}
                    </p>
                    <p className="text-xs text-muted-foreground truncate mt-1.5">
                      {user?.email || "-"}
                    </p>
                  </div>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem
                  onClick={logout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{t('dashboard.signOut')}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarFooter>
        </Sidebar>
        {/* 拖拽手柄：可见的线条 + 更宽的可点击区域 */}
        <div
          className={`absolute top-0 right-0 w-1 h-full bg-border transition-colors ${isCollapsed ? "hidden" : ""}`}
          style={{ zIndex: 50 }}
        />
        <div
          className={`absolute top-0 right-0 w-3 h-full cursor-col-resize hover:bg-primary/10 transition-colors ${isCollapsed ? "hidden" : ""} ${isResizing ? "bg-primary/20" : ""}`}
          onMouseDown={() => {
            if (isCollapsed) return;
            setIsResizing(true);
          }}
          style={{ zIndex: 51, marginRight: "-4px" }}
          title="拖拽调整侧边栏宽度"
        />
      </div>

      <SidebarInset>
        {/* Header - 移动端和桌面端都显示（hideHeader 时在移动端隐藏） */}
        {!hideHeader && (
        <div className="flex border-b h-14 items-center bg-background/95 px-3 backdrop-blur supports-[backdrop-filter]:backdrop-blur sticky top-0 z-40 lg:hidden">
          {/* 左侧：SidebarTrigger */}
          <div className="flex items-center gap-3">
            <SidebarTrigger className="h-9 w-9 rounded-lg bg-background" />
          </div>
          
          {/* 中间：居中标题 */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <span className="text-base font-semibold tracking-tight text-foreground">
              {activeMenuItem?.label ?? "Menu"}
            </span>
          </div>
          
          {/* 右侧：返回按钮 */}
          <div className="flex items-center gap-2 ml-auto">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="h-9 w-9 p-0"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6"/>
              </svg>
            </Button>
          </div>
        </div>
        )}
        <main className={`flex-1 pb-0 md:pl-6 md:pb-0 ${hideHeader ? 'pt-1 px-2 md:px-4' : 'pt-2 px-4'}`}>{children}</main>
      </SidebarInset>
    </>
  );
}
