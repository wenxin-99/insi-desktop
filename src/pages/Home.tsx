import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare, Image, FileText, Mic, Sparkles, ArrowRight, CheckCircle2, TrendingUp, Users, Zap, BookOpen, FileSearch, Brain, Lightbulb, BarChart3, Github } from "lucide-react";
import { FishCoinBalance } from "@/components/FishCoinBalance";

import { Link } from "wouter";
import { useEffect } from "react";
import { toast } from "sonner";

export default function Home() {
  const { user, loading } = useAuth();
  const { t } = useTranslation();

  // 设置页面标题（SEO优化）
  useEffect(() => {
    document.title = "Insi智能代理平台 - 作业批改、论文解析、学术研究助手 | Paper Insights";
  }, []);

  // GitHub OAuth 错误提示
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const githubError = params.get("github_error");
    if (githubError) {
      toast.error(`GitHub 登录失败: ${githubError}`);
      // 清除 URL 参数，避免刷新重复提示
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // 直接在组件内生成OAuth登录URL，避免模块加载问题
  const getExternalLoginUrl = (redirectPath: string = "/") => {
    const portalUrl = "https://mpsboring.com/oauth/authorize";
    const clientId = "5";
    const redirectUri = `${window.location.origin}/api/forum/callback`;
    const state = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: "code",
      state: state,
    });
    
    return `${portalUrl}?${params.toString()}`;
  };



  const benefits = [
    { icon: Zap, text: t('home.benefits.fastParsing') },
    { icon: Brain, text: t('home.benefits.deepUnderstanding') },
    { icon: TrendingUp, text: t('home.benefits.dataVisualization') },
    { icon: Users, text: t('home.benefits.academicSecurity') },
  ];

  const features = [
    {
      icon: FileSearch,
      title: t('home.features.paperAnalysis.title'),
      description: t('home.features.paperAnalysis.description'),
      color: "text-blue-600",
      bgColor: "bg-blue-50 dark:bg-blue-950",
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Brain,
      title: t('home.features.academicChat.title'),
      description: t('home.features.academicChat.description'),
      color: "text-indigo-600",
      bgColor: "bg-indigo-50 dark:bg-indigo-950",
      gradient: "from-indigo-500 to-purple-500",
    },
    {
      icon: BarChart3,
      title: t('home.features.dataVisualization.title'),
      description: t('home.features.dataVisualization.description'),
      color: "text-cyan-600",
      bgColor: "bg-cyan-50 dark:bg-cyan-950",
      gradient: "from-cyan-500 to-blue-500",
    },
    {
      icon: Lightbulb,
      title: t('home.features.researchInspiration.title'),
      description: t('home.features.researchInspiration.description'),
      color: "text-purple-600",
      bgColor: "bg-purple-50 dark:bg-purple-950",
      gradient: "from-purple-500 to-pink-500",
    },
  ];

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="flex flex-col items-center gap-4">
          <Sparkles className="h-12 w-12 text-blue-600 animate-pulse" />
          <div className="text-muted-foreground">加载中...</div>
        </div>
      </div>
    );
  }

  if (user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* 导航栏 */}
        <nav className="border-b bg-white/80 dark:bg-gray-900/80 backdrop-blur-md supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 sticky top-0 z-50">
          <div className="container flex h-16 items-center justify-center relative">
            {/* 左侧导航链接 */}
            <div className="absolute left-0 flex items-center gap-2 md:gap-4">
              {user.role === "admin" && (
                <Link href="/admin">
                  <Button variant="outline" size="sm" className="text-xs md:text-sm">{t('home.nav.dashboard')}</Button>
                </Link>
              )}
              <Link href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:inline">
                {t('home.nav.features')}
              </Link>
              <Link href="#tutorial" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:inline">
                {t('home.nav.tutorial')}
              </Link>
              <Link href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors hidden md:inline">
                {t('home.nav.pricing')}
              </Link>
            </div>
            
            {/* 中间LOGO */}
            <Link href="/" className="flex items-center gap-3 group">
              <Sparkles className="h-7 w-7 text-blue-600 group-hover:rotate-12 transition-transform" />
              <span className="text-2xl font-bold tracking-wider bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent" style={{ fontFamily: '"Inter", sans-serif', letterSpacing: '0.05em' }}>
                paper <span className="font-light italic">insights</span>
              </span>
            </Link>
            
            {/* 右侧按钮 */}
            <div className="absolute right-0 flex items-center">
              <Link href="/dashboard">
                <Button size="sm" className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-xs md:text-sm px-2 md:px-4">{t('home.enterWorkspace')}</Button>
              </Link>
            </div>
          </div>
        </nav>

        {/* 主内容 */}
        <main className="container py-12">
          {/* 欢迎区域 */}
          <div className="text-center mb-16 relative">
            {/* 装饰性星星 */}
            <div className="absolute top-0 left-1/4 w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
            <div className="absolute top-10 right-1/3 w-1.5 h-1.5 bg-cyan-400 rounded-full animate-pulse delay-75" />
            <div className="absolute top-20 left-1/3 w-1 h-1 bg-indigo-400 rounded-full animate-pulse delay-150" />
            
            {/* 用户头像 */}
            {user.avatarUrl && (
              <div className="flex justify-center mb-6">
                <div className="relative">
                  <img 
                    src={user.avatarUrl} 
                    alt={user.name || "用户"}
                    className="w-24 h-24 rounded-full border-4 border-blue-200 dark:border-blue-800 shadow-xl"
                  />
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-500 rounded-full flex items-center justify-center shadow-lg">
                    <Sparkles className="h-4 w-4 text-white" />
                  </div>
                </div>
              </div>
            )}
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4 break-words max-w-full px-4 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent">
              {t('home.welcome', { name: user.name || t('common.user') })}
            </h1>
            <p className="text-xl text-muted-foreground mb-8">
              {t('home.subtitle')}
            </p>
            <FishCoinBalance 
              balance={user.fishCoinBalance} 
              loading={loading}
              size="lg"
            />
          </div>

          {/* 作业批改突出展示 */}
          <Link href="/homework">
            <Card className="mb-16 cursor-pointer hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 border-red-200 dark:border-red-900 bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950 dark:to-rose-950">
              <CardHeader className="flex flex-row items-center gap-6 p-8">
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-red-500 to-rose-500 flex items-center justify-center shadow-2xl" role="img" aria-label="作业批改图标">
                  <BookOpen className="h-10 w-10 text-white" aria-hidden="true" />
                </div>
                <div className="flex-1">
                  <CardTitle className="text-3xl mb-2 bg-gradient-to-r from-red-600 to-rose-600 bg-clip-text text-transparent">{t('home.features.homework.title')}</CardTitle>
                  <CardDescription className="text-lg text-muted-foreground">{t('home.features.homework.description')}</CardDescription>
                </div>
                <ArrowRight className="h-8 w-8 text-red-600" />
              </CardHeader>
            </Card>
          </Link>

          {/* 功能卡片 */}
          <div id="features" className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-12">
            {features.map((feature, index) => (
              <Card 
                key={index} 
                className="group cursor-pointer hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:scale-105 h-full border-blue-100 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm animate-fade-in-up"
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <CardHeader>
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`} role="img" aria-label={`${feature.title}图标`}>
                    <feature.icon className="h-7 w-7 text-white" aria-hidden="true" />
                  </div>
                  <CardTitle className="text-xl">{feature.title}</CardTitle>
                  <CardDescription className="text-base">{feature.description}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>

          {/* 优势特点 */}
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-center mb-8 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">{t('home.whyChoose')}</h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex flex-col items-center text-center p-6 rounded-2xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-blue-100 dark:border-gray-700 hover:shadow-lg transition-all hover:-translate-y-1">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-4 shadow-lg" role="img" aria-label={`${benefit.text}图标`}>
                    <benefit.icon className="h-8 w-8 text-white" aria-hidden="true" />
                  </div>
                  <p className="font-medium">{benefit.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 快速开始 */}
          <Card className="bg-gradient-to-br from-blue-600 via-cyan-600 to-indigo-600 border-0 shadow-2xl">
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-white">
                  <h2 className="text-2xl font-bold mb-2">{t('home.readyToStart.title')}</h2>
                  <p className="text-blue-50">
                    {t('home.readyToStart.description')}
                  </p>
                </div>
                <Link href="/dashboard">
                  <Button size="lg" className="bg-white text-blue-600 hover:bg-blue-50 shadow-lg">
                    {t('home.enterWorkspace')}
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  // 未登录用户看到的页面
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* 背景装饰 */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-blue-400/20 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-cyan-400/20 rounded-full blur-3xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-400/10 rounded-full blur-3xl" />
        </div>
        
        {/* 装饰性星星 */}
        <div className="absolute top-20 left-1/4 w-3 h-3 bg-blue-500 rounded-full animate-pulse" />
        <div className="absolute top-40 right-1/3 w-2 h-2 bg-cyan-500 rounded-full animate-pulse delay-75" />
        <div className="absolute top-60 left-1/3 w-2.5 h-2.5 bg-indigo-500 rounded-full animate-pulse delay-150" />
        <div className="absolute bottom-40 right-1/4 w-2 h-2 bg-purple-500 rounded-full animate-pulse delay-300" />
        
        <div className="container relative py-24 md:py-32">
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-3 mb-8 px-4 py-2 rounded-full bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-blue-200 dark:border-gray-700 shadow-lg">
              <Sparkles className="h-6 w-6 text-blue-600 animate-pulse" aria-label="Insi驱动图标" />
              <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent uppercase tracking-wider">
                Insi驱动的学术研究平台
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-blue-600 via-cyan-600 to-indigo-600 bg-clip-text text-transparent leading-tight">
              paper insights
            </h1>
            <p className="text-2xl md:text-3xl font-medium mb-4 text-gray-700 dark:text-gray-300">
              让Insi成为您的研究伙伴
            </p>
            <p className="text-lg md:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto">
              <strong>作业智能批改</strong>、<strong>论文PDF解析</strong>、<strong>学术对话</strong>、<strong>数据可视化</strong>，全方位提升学生和研究者的学习效率
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 text-white text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all"
                style={{ background: 'linear-gradient(to right, #2563eb, #0891b2)' }}
                onClick={() => {
                  window.location.href = getExternalLoginUrl("/");
                }}
              >
                <Sparkles className="mr-2 h-5 w-5" aria-hidden="true" />
                开始使用
                <ArrowRight className="ml-2 h-5 w-5" aria-hidden="true" />
              </Button>
              <Button
                size="lg"
                className="text-lg px-8 py-6 text-white shadow-xl hover:shadow-2xl transition-all"
                style={{ background: '#24292f' }}
                onClick={() => {
                  window.location.href = "/api/github/login";
                }}
              >
                <Github className="mr-2 h-5 w-5" aria-hidden="true" />
                GitHub 登录
              </Button>
              <Link href="/forum-login">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 py-6 w-full border-2 border-blue-200 hover:border-blue-300 hover:bg-blue-50 dark:border-gray-700 dark:hover:bg-gray-800"
                >
                  账号密码登录
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container py-24 relative">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">核心功能</h2>
          <p className="text-xl text-muted-foreground">
            专为学术研究打造的智能工具集
          </p>
        </div>
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, index) => (
            <Card 
              key={index} 
              className="group hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 hover:scale-105 border-blue-100 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 backdrop-blur-sm animate-fade-in-up"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <CardHeader>
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform shadow-lg`}>
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                <CardTitle className="text-xl">{feature.title}</CardTitle>
                <CardDescription className="text-base">{feature.description}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      {/* Benefits Section */}
      <section className="container py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">为什么选择我们</h2>
          <p className="text-xl text-muted-foreground">
            专业、高效、可靠的学术研究助手
          </p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {benefits.map((benefit, index) => (
            <div key={index} className="flex flex-col items-center text-center p-8 rounded-2xl bg-white/50 dark:bg-gray-800/50 backdrop-blur-sm border border-blue-100 dark:border-gray-700 hover:shadow-xl transition-all hover:-translate-y-2">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center mb-6 shadow-lg">
                <benefit.icon className="h-10 w-10 text-white" />
              </div>
              <p className="font-semibold text-lg">{benefit.text}</p>
            </div>
          ))}
        </div>
      </section>



      {/* CTA Section */}
      <section className="container py-24">
        <Card className="bg-gradient-to-br from-blue-600 via-cyan-600 to-indigo-600 border-0 shadow-2xl overflow-hidden relative">
          {/* 装饰性元素 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-white/10 rounded-full blur-3xl" />
          
          <CardContent className="p-12 relative">
            <div className="text-center max-w-2xl mx-auto">
              <Sparkles className="h-16 w-16 text-white mx-auto mb-6 animate-pulse" aria-label="星星图标" />
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-white">
                开启智能研究之旅
              </h2>
              <p className="text-xl text-blue-50 mb-10">
                注册即可获得初始🐟币，立即体验强大的Insi学术研究功能
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  size="lg"
                  className="bg-white text-blue-600 hover:bg-blue-50 text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all"
                  onClick={() => {
                    window.location.href = getExternalLoginUrl("/");
                  }}
                >
                  <Sparkles className="mr-2 h-5 w-5" />
                  立即开始
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
                <Button
                  size="lg"
                  className="text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all border-2 border-white/30"
                  style={{ background: '#24292f', color: '#fff' }}
                  onClick={() => {
                    window.location.href = "/api/github/login";
                  }}
                >
                  <Github className="mr-2 h-5 w-5" />
                  GitHub 登录
                </Button>
                <Link href="/forum-login">
                  <Button
                    size="lg"
                    variant="outline"
                    className="text-lg px-8 py-6 border-2 border-white text-white hover:bg-white/20 backdrop-blur-sm"
                  >
                    账号密码登录
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Footer */}
      <footer className="border-t border-blue-100 dark:border-gray-800 py-8 bg-white/50 dark:bg-gray-900/50 backdrop-blur-sm">
        <div className="container text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Sparkles className="h-5 w-5 text-blue-600" />
            <span className="font-bold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">paper insights</span>
          </div>
          <p className="text-muted-foreground">© 2026 paper insights. 由🐟币驱动</p>
        </div>
      </footer>
    </div>
  );
}
