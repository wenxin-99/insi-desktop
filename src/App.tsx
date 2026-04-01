import { lazy, Suspense, useEffect } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useTokenRefresh } from "./_core/hooks/useTokenRefresh";
import { Route, Switch, useLocation } from "wouter";

/** 兼容旧路由的重定向组件 */
function RedirectTo({ path }: { path: string }) {
  const [, navigate] = useLocation();
  useEffect(() => { navigate(path, { replace: true }); }, []);
  return null;
}
import { AnimatePresence, motion } from "framer-motion";
import { useSwipeBack } from "./hooks/useSwipeBack";
import ErrorBoundary from "./components/ErrorBoundary";
import { RouteErrorBoundary } from "./components/RouteErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { GlobalBackgroundTaskHandler } from "./components/GlobalBackgroundTaskHandler";
import { PassiveSignalCollector } from "./hooks/usePassiveSignals";
import { useMicPermission } from "./hooks/useMicPermission";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmProvider } from "@/components/ConfirmDialog";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";

// 登录页优先加载（退出后立即可见，不参与懒加载）
import ForumLogin from "./pages/ForumLogin";
import NotFound from "@/pages/NotFound";

// 其余页面全部懒加载，减少首屏 bundle 体积
const Home                  = lazy(() => import("./pages/Home"));
const Dashboard             = lazy(() => import("./pages/Dashboard"));
const Chat                  = lazy(() => import("./pages/Chat"));
const Files                 = lazy(() => import("./pages/Files"));
const Transactions          = lazy(() => import("./pages/Transactions"));
const Notifications         = lazy(() => import("./pages/Notifications"));
const Profile               = lazy(() => import("./pages/Profile"));
const Recharge              = lazy(() => import("./pages/Recharge"));
const Help                  = lazy(() => import("./pages/Help"));
const Invite                = lazy(() => import("./pages/Invite"));
const Feedback              = lazy(() => import("./pages/Feedback"));
const WechatBind            = lazy(() => import("./pages/WechatBind"));
const VIPMembership         = lazy(() => import("./pages/VIPMembership"));
const ModelComparison       = lazy(() => import("./pages/ModelComparison"));
const OAuthDiagnostics      = lazy(() => import("./pages/OAuthDiagnostics").then(m => ({ default: m.OAuthDiagnostics })));
const DiscountManagement    = lazy(() => import("./pages/DiscountManagement"));
const ImageGallery          = lazy(() => import("./pages/ImageGallery"));
const VideoGallery          = lazy(() => import("./pages/VideoGallery"));
const VideoHistory          = lazy(() => import("./pages/VideoHistory"));
const VideoShare            = lazy(() => import("./pages/VideoShare"));
const Research              = lazy(() => import("./pages/Research"));
const ResearchTask          = lazy(() => import("./pages/ResearchTask"));
// [已删除] 老自动化独立页面已由 Agent 中心替代
const Memory                = lazy(() => import("./pages/Memory"));
const ScheduledTasks        = lazy(() => import("./pages/ScheduledTasks"));
const SkillDetail           = lazy(() => import("./pages/skills/SkillDetail"));
const PersonaSettings       = lazy(() => import("./pages/PersonaSettings"));
const BotStore              = lazy(() => import("./pages/BotStore"));
const BotShare              = lazy(() => import("./pages/BotShare"));
const KnowledgeBase         = lazy(() => import("./pages/KnowledgeBase"));
const CompanionSettings     = lazy(() => import("./pages/CompanionSettings"));
const ChannelBindings       = lazy(() => import("./pages/ChannelBindings"));
const VoiceChat             = lazy(() => import("./pages/VoiceChat"));
const HomeworkCorrection    = lazy(() => import("./pages/HomeworkCorrection"));
const HomeworkHistory       = lazy(() => import("./pages/HomeworkHistory"));
const CorrectionShare       = lazy(() => import("./pages/CorrectionShare"));
const ChatShare             = lazy(() => import("./pages/ChatShare"));
const WrongQuestionBook     = lazy(() => import("./pages/WrongQuestionBook"));
const StorageStats          = lazy(() => import("./pages/StorageStats"));
const HomeworkPricingConfig = lazy(() => import("./pages/HomeworkPricingConfig"));
const Pricing               = lazy(() => import("./pages/Pricing"));
const Orders                = lazy(() => import("./pages/Orders"));
const Subscription          = lazy(() => import("./pages/Subscription"));
const PaymentSuccess        = lazy(() => import("./pages/PaymentSuccess"));
const PaymentCancel         = lazy(() => import("./pages/PaymentCancel"));

const Agent = lazy(() => import("./pages/Agent"));
const AgentDashboard = lazy(() => import("./pages/admin/AgentDashboard"));
const PlaybookMarket = lazy(() => import("./pages/PlaybookMarket"));
const Projects = lazy(() => import("./pages/Projects"));
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const JoinProject = lazy(() => import("./pages/JoinProject"));
// 管理员页面（使用量少，最适合懒加载）
const AdminDashboard        = lazy(() => import("./pages/admin/Dashboard"));
const AdminUsers            = lazy(() => import("./pages/admin/Users"));
const AdminInvitations      = lazy(() => import("./pages/admin/Invitations"));
const AdminFeedbacks        = lazy(() => import("./pages/admin/Feedbacks"));
const AdminExport           = lazy(() => import("./pages/admin/Export"));
const AdminNotifications    = lazy(() => import("./pages/admin/SystemNotifications"));
const AdminQuotaManagement  = lazy(() => import("./pages/admin/QuotaManagement"));
const ModelManagement       = lazy(() => import("./pages/admin/ModelManagement"));
const PackagePricingCenter  = lazy(() => import("./pages/admin/PackagePricingCenter"));
const ProxyManagement       = lazy(() => import("./pages/admin/ProxyManagement"));
const ProxyRulesManagement  = lazy(() => import("./pages/admin/ProxyRulesManagement"));
const StorageSettings       = lazy(() => import("./pages/admin/StorageSettings"));
const ImageGenerationTest   = lazy(() => import("./pages/admin/ImageGenerationTest"));
const AuthModeTest          = lazy(() => import("./pages/admin/AuthModeTest"));
const VideoApiConfig        = lazy(() => import("./pages/admin/VideoApiConfig"));
const SystemSettings        = lazy(() => import("./pages/admin/SystemSettings"));
const ChannelSettings       = lazy(() => import("./pages/admin/ChannelSettings"));
const VoiceSettings         = lazy(() => import("./pages/admin/VoiceSettings"));
const VoicePackageManagement = lazy(() => import("./pages/admin/VoicePackageManagement"));
const SSHSettings           = lazy(() => import("./pages/admin/SSHSettings"));
const TokenStats            = lazy(() => import("./pages/admin/TokenStats"));
const PDFWatermarkConfig    = lazy(() => import("./pages/admin/PDFWatermarkConfig"));
const FishCoinManagement    = lazy(() => import("./pages/admin/FishCoinManagement"));
const ForumBenefitsManagement = lazy(() => import("./pages/ForumBenefitsManagement"));
const PaymentConfig         = lazy(() => import("./pages/admin/PaymentConfig"));
const BillingConfig          = lazy(() => import("./pages/admin/BillingConfig"));
// AI 运维管理页面
const AdminAIOps            = lazy(() => import("./pages/admin/AIOps"));
const AdminAIOpsChat        = lazy(() => import("./pages/admin/AIOpsChat"));
const AdminAIOpsApprovals   = lazy(() => import("./pages/admin/AIOpsApprovals"));
const AdminAIOpsKnowledge   = lazy(() => import("./pages/admin/AIOpsKnowledge"));
const AdminAIOpsAnalytics   = lazy(() => import("./pages/admin/AIOpsAnalytics"));
const AdminPlaybookApprovals = lazy(() => import("./pages/admin/PlaybookApprovals"));
const PromptEvolution       = lazy(() => import("./pages/admin/PromptEvolution"));
const KnowledgeBaseManagement = lazy(() => import("./pages/admin/KnowledgeBaseManagement"));

// 智能客服页面
const CustomerService       = lazy(() => import("./pages/CustomerService"));
const CSKnowledgeBase       = lazy(() => import("./pages/admin/CSKnowledgeBase"));
const CSWorkbench           = lazy(() => import("./pages/admin/CSWorkbench"));
const CSAnalytics           = lazy(() => import("./pages/admin/CSAnalytics"));

// GitHub 工作区
const GitHubWorkspace       = lazy(() => import("./pages/GitHubWorkspace"));

// 政策页面
const PrivacyPolicy         = lazy(() => import("./pages/PrivacyPolicy"));
const TermsOfService        = lazy(() => import("./pages/TermsOfService"));

/** 懒加载 fallback：透明占位，避免 layout shift */
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center">
    <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

/** ★ P2: 为 lazy route 包装 ErrorBoundary + Suspense */
function LazyRoute({ children, name }: { children: React.ReactNode; name?: string }) {
  return (
    <RouteErrorBoundary routeName={name}>
      <Suspense fallback={<PageLoader />}>
        {children}
      </Suspense>
    </RouteErrorBoundary>
  );
}

function Router() {
  const [location] = useLocation();
  
  return (
    <Suspense fallback={<PageLoader />}>
    <AnimatePresence mode="wait">
      <motion.div
        key={location}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
      >
        <Switch location={location}>
          <Route path="/" component={Home} />
      <Route path="/dashboard">{() => <LazyRoute name="dashboard"><Dashboard /></LazyRoute>}</Route>
      <Route path="/chat">{() => <LazyRoute name="chat"><Chat /></LazyRoute>}</Route>
      <Route path="/homework">{() => <LazyRoute name="homework"><HomeworkCorrection /></LazyRoute>}</Route>
      <Route path="/homework/history" component={HomeworkHistory} />
      <Route path="/homework/pricing-config" component={HomeworkPricingConfig} />
      <Route path="/admin/pdf-watermark-config" component={PDFWatermarkConfig} />
      <Route path="/admin/fish-coin-management" component={FishCoinManagement} />
      <Route path="/share/chat/:token" component={ChatShare} />
      <Route path="/share/:token" component={CorrectionShare} />
      <Route path="/wrong-questions" component={WrongQuestionBook} />
      <Route path="/storage-stats" component={StorageStats} />
      <Route path="/images">{() => <LazyRoute name="image-gallery"><ImageGallery /></LazyRoute>}</Route>
      <Route path="/videos" component={VideoGallery} />
      <Route path="/video-history" component={VideoHistory} />
      <Route path="/research">{() => <LazyRoute name="research"><Research /></LazyRoute>}</Route>
      <Route path="/research/:taskId">{({ params }) => <LazyRoute name="research-task"><ResearchTask /></LazyRoute>}</Route>
      <Route path="/memory" component={Memory} />
      <Route path="/skills/mine">{() => <RedirectTo path="/playbooks/mine" />}</Route>
      <Route path="/skills/:id" component={SkillDetail} />
      <Route path="/skills">{() => <RedirectTo path="/playbooks" />}</Route>
      <Route path="/settings/persona" component={PersonaSettings} />
      <Route path="/bot-store" component={BotStore} />
      <Route path="/bot/share/:token" component={BotShare} />
      <Route path="/knowledge-base" component={KnowledgeBase} />
      <Route path="/settings/companion" component={CompanionSettings} />
      <Route path="/settings/channels" component={ChannelBindings} />
      <Route path="/settings">{() => <RedirectTo path="/profile" />}</Route>
      {/* /automation 已由 /agent 替代 */}
      <Route path="/scheduled-tasks" component={ScheduledTasks} />
      <Route path="/share/video/:token" component={VideoShare} />

      <Route path="/files" component={Files} />
      <Route path="/transactions" component={Transactions} />
      <Route path="/notifications" component={Notifications} />
      <Route path="/profile" component={Profile} />
      <Route path="/recharge" component={Recharge} />
      <Route path="/model-comparison" component={ModelComparison} />
      <Route path="/oauth-diagnostics" component={OAuthDiagnostics} />

      <Route path="/forum-login" component={ForumLogin} />
      <Route path="/wechat-bind" component={WechatBind} />
      <Route path="/github-workspace">{() => <LazyRoute name="github-workspace"><GitHubWorkspace /></LazyRoute>}</Route>
      <Route path="/help" component={Help} />
      <Route path="/invite" component={Invite} />
      <Route path="/feedback" component={Feedback} />
      <Route path="/vip" component={VIPMembership} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      
      {/* Stripe支付路由 */}
      <Route path="/pricing" component={Pricing} />
      <Route path="/orders" component={Orders} />
      <Route path="/subscription" component={Subscription} />
      <Route path="/payment/success" component={PaymentSuccess} />
      <Route path="/payment/cancel" component={PaymentCancel} />
      
      {/* 管理员路由 */}
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/users" component={AdminUsers} />
      <Route path="/admin/models" component={ModelManagement} />
      <Route path="/admin/packages" component={PackagePricingCenter} />
      <Route path="/admin/proxies" component={ProxyManagement} />
      <Route path="/admin/proxy-rules" component={ProxyRulesManagement} />
      <Route path="/admin/storage-settings" component={StorageSettings} />
      <Route path="/admin/image-test" component={ImageGenerationTest} />
      <Route path="/admin/invitations" component={AdminInvitations} />
      <Route path="/admin/feedbacks" component={AdminFeedbacks} />
      <Route path="/admin/notifications" component={AdminNotifications} />
      <Route path="/admin/quota" component={AdminQuotaManagement} />
      <Route path="/admin/export" component={AdminExport} />
      <Route path="/admin/auth-mode-test" component={AuthModeTest} />
      <Route path="/admin/discount" component={DiscountManagement} />
      <Route path="/admin/forum-benefits" component={ForumBenefitsManagement} />
      <Route path="/admin/video-api" component={VideoApiConfig} />
      <Route path="/admin/system-settings" component={SystemSettings} />
      <Route path="/admin/channel-settings" component={ChannelSettings} />
      <Route path="/admin/ssh-settings" component={SSHSettings} />
      <Route path="/admin/voice-settings" component={VoiceSettings} />
      <Route path="/admin/voice-packages" component={VoicePackageManagement} />
      <Route path="/admin/token-stats" component={TokenStats} />
      <Route path="/voice-chat">{() => <LazyRoute name="voice-chat"><VoiceChat /></LazyRoute>}</Route>
      <Route path="/admin/payment-config" component={PaymentConfig} />
      <Route path="/admin/billing-config" component={BillingConfig} />

      {/* AI 运维路由 */}
      <Route path="/admin/ai-ops" component={AdminAIOps} />
      <Route path="/admin/ai-ops/chat" component={AdminAIOpsChat} />
      <Route path="/admin/ai-ops/approvals" component={AdminAIOpsApprovals} />
      <Route path="/admin/ai-ops/knowledge" component={AdminAIOpsKnowledge} />
      <Route path="/admin/ai-ops/analytics" component={AdminAIOpsAnalytics} />
      <Route path="/admin/playbook-approvals" component={AdminPlaybookApprovals} />
      <Route path="/admin/knowledge-base" component={KnowledgeBaseManagement} />
      <Route path="/admin/prompt-evolution" component={PromptEvolution} />

      {/* 智能客服 */}
      <Route path="/customer-service" component={CustomerService} />
      <Route path="/admin/cs-knowledge" component={CSKnowledgeBase} />
      <Route path="/admin/cs-workbench" component={CSWorkbench} />
      <Route path="/admin/cs-analytics" component={CSAnalytics} />
      
      <Route path="/agent" component={Agent} />
      <Route path="/agent/:taskId" component={Agent} />
      <Route path="/admin/agent-dashboard" component={AgentDashboard} />
      <Route path="/playbooks" component={PlaybookMarket} />
      <Route path="/playbooks/mine" component={PlaybookMarket} />
      <Route path="/projects" component={Projects} />
      <Route path="/projects/join/:token" component={JoinProject} />
      <Route path="/projects/:id" component={ProjectDetail} />
      <Route path="/playbooks/new" component={PlaybookMarket} />
      <Route path="/playbooks/:id" component={PlaybookMarket} />
      <Route path="/playbooks/:id/edit" component={PlaybookMarket} />
          <Route path="/404" component={NotFound} />
          <Route component={NotFound} />
        </Switch>
      </motion.div>
    </AnimatePresence>
    </Suspense>
  );
}

function App() {
  // Token自动刷新
  useTokenRefresh();
  // 左滑返回手势
  useSwipeBack();
  // 全局麦克风权限预热（解决每次刷新都弹授权的问题）
  useMicPermission();
  
  return (
    <ErrorBoundary>
      <ThemeProvider
        defaultTheme="light"
        switchable
      >
        <NotificationProvider>
          <TooltipProvider>
            <ConfirmProvider>
            <Router />
            <GlobalBackgroundTaskHandler />
            <PassiveSignalCollector />
            <Toaster richColors position="top-center" duration={2500} />
            <PWAInstallPrompt />
          </ConfirmProvider>
          </TooltipProvider>
        </NotificationProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;