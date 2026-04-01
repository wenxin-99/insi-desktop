/**
 * 隐私政策页面
 */

import { useEffect } from "react";
import { Link } from "wouter";
import { Shield, ArrowLeft, Lock, Eye, Database, Trash2, Cookie, Bell } from "lucide-react";
import BackButton from "@/components/BackButton";

export default function PrivacyPolicy() {
  useEffect(() => {
    document.title = "隐私政策 — Insi 智能平台";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 border-b bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
        <div className="container max-w-4xl flex items-center gap-3 py-3">
          <BackButton />
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="font-semibold">隐私政策</span>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-10 px-4">
        {/* 标题区 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-100 dark:bg-blue-900/30 mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">隐私政策</h1>
          <p className="text-muted-foreground">最后更新日期：2026 年 3 月 1 日</p>
        </div>

        {/* 引言 */}
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <p className="text-lg leading-relaxed text-muted-foreground mb-8">
            Insi 智能平台（以下简称"本平台"或"我们"）非常重视您的个人信息和隐私保护。
            本隐私政策旨在向您说明我们如何收集、使用、存储、共享和保护您的个人信息，
            以及您如何管理您的个人信息。请在使用我们的服务前仔细阅读本隐私政策。
          </p>

          {/* 第一条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <Database className="h-5 w-5 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold m-0">一、我们收集的信息</h2>
            </div>
            <div className="pl-[52px] space-y-4">
              <div>
                <h3 className="font-semibold mb-1">1.1 您主动提供的信息</h3>
                <p className="text-muted-foreground leading-relaxed">
                  注册信息：用户名、电子邮箱、手机号码（如适用）、登录密码。<br />
                  个人资料：您在个人主页中设置的昵称、头像等。<br />
                  充值与支付信息：充值金额、支付方式、订单号等交易信息。<br />
                  反馈与客服内容：您通过客服系统、用户反馈功能提交的信息。
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">1.2 使用过程中产生的信息</h3>
                <p className="text-muted-foreground leading-relaxed">
                  AI 对话记录：您与 AI 的对话内容，包括文字、图片、文件等。<br />
                  生成内容记录：AI 为您生成的图片、视频、文档等内容。<br />
                  操作日志：功能使用时间、频率、偏好设置等。<br />
                  设备信息：浏览器类型、操作系统版本、屏幕分辨率、IP 地址等。
                </p>
              </div>
              <div>
                <h3 className="font-semibold mb-1">1.3 第三方登录信息</h3>
                <p className="text-muted-foreground leading-relaxed">
                  当您选择通过第三方平台（如 GitHub）登录时，我们会获取该平台授权的公开信息，
                  如用户名、头像等。我们不会获取您未授权的任何信息。
                </p>
              </div>
            </div>
          </section>

          {/* 第二条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold m-0">二、信息的使用</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p>我们收集的信息将用于以下目的：</p>
              <p><strong className="text-foreground">提供服务</strong> — 维持 AI 对话、图片生成、视频生成、作业批改、深度研究等核心功能的正常运行。</p>
              <p><strong className="text-foreground">账户管理</strong> — 处理注册、登录、身份验证、充值、订阅等账户相关操作。</p>
              <p><strong className="text-foreground">个性化体验</strong> — 基于 AI 记忆功能和人格配置，提供更符合您需求的服务。</p>
              <p><strong className="text-foreground">服务改进</strong> — 分析匿名化的使用数据以优化产品功能和用户体验。</p>
              <p><strong className="text-foreground">安全保障</strong> — 检测和防范欺诈、滥用等安全风险。</p>
              <p><strong className="text-foreground">通知推送</strong> — 发送系统更新、任务完成、余额变动等服务相关通知。</p>
            </div>
          </section>

          {/* 第三条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <Lock className="h-5 w-5 text-violet-600" />
              </div>
              <h2 className="text-xl font-bold m-0">三、信息的存储与安全</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">加密传输</strong> — 所有数据传输均使用 HTTPS / TLS 加密协议，防止传输过程中的窃听和篡改。</p>
              <p><strong className="text-foreground">加密存储</strong> — 用户密码使用不可逆加密算法存储，任何人（包括平台工作人员）均无法获取您的明文密码。</p>
              <p><strong className="text-foreground">访问控制</strong> — 您的对话记录和个人数据仅您本人可见，平台采用严格的权限管理机制。</p>
              <p><strong className="text-foreground">数据备份</strong> — 定期进行数据备份，防止意外丢失。</p>
              <p><strong className="text-foreground">存储位置</strong> — 数据存储在中国境内合规的云服务器上，符合相关法律法规要求。</p>
              <p><strong className="text-foreground">存储期限</strong> — 我们仅在实现服务目的所需的最短期限内保留您的个人信息。账户注销后，我们将在合理期限内删除或匿名化处理您的个人信息。</p>
            </div>
          </section>

          {/* 第四条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <Bell className="h-5 w-5 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold m-0">四、信息的共享与披露</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p>我们<strong className="text-foreground">不会</strong>向第三方出售、出租您的个人信息。以下情况除外：</p>
              <p><strong className="text-foreground">经您同意</strong> — 获得您的明确授权后，我们可能与指定的第三方共享特定信息。</p>
              <p><strong className="text-foreground">法律要求</strong> — 为遵守法律法规、行政命令或司法判决的要求。</p>
              <p><strong className="text-foreground">服务提供商</strong> — 我们可能使用第三方 AI 模型（如 DeepSeek、OpenAI 等）处理您的请求，此类数据共享仅限于提供服务所需的最低限度。</p>
              <p><strong className="text-foreground">安全保护</strong> — 为保护平台、用户或公众的合法权益、财产或安全。</p>
            </div>
          </section>

          {/* 第五条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
                <Cookie className="h-5 w-5 text-cyan-600" />
              </div>
              <h2 className="text-xl font-bold m-0">五、Cookie 与类似技术</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p>本平台使用 Cookie 和类似技术以实现以下目的：</p>
              <p><strong className="text-foreground">身份验证</strong> — 维持您的登录状态，避免重复登录。</p>
              <p><strong className="text-foreground">偏好记忆</strong> — 记住您的语言、主题等界面偏好设置。</p>
              <p><strong className="text-foreground">安全保障</strong> — 辅助身份验证和异常检测。</p>
              <p>您可以通过浏览器设置管理或清除 Cookie。请注意，禁用 Cookie 可能影响部分功能的正常使用。</p>
            </div>
          </section>

          {/* 第六条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30">
                <Trash2 className="h-5 w-5 text-rose-600" />
              </div>
              <h2 className="text-xl font-bold m-0">六、您的权利</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p>根据相关法律法规，您享有以下权利：</p>
              <p><strong className="text-foreground">访问权</strong> — 您可以随时查看和导出您的个人数据。</p>
              <p><strong className="text-foreground">更正权</strong> — 您可以更新和修改您的个人信息。</p>
              <p><strong className="text-foreground">删除权</strong> — 您可以删除特定数据（如对话记录、AI 记忆），也可以申请注销账户并删除所有数据。</p>
              <p><strong className="text-foreground">撤回同意</strong> — 您可以随时撤回之前给予的授权同意。</p>
              <p>如需行使上述权利，请通过 AI 客服转人工或发送邮件至 support@aiplatform.com 联系我们。</p>
            </div>
          </section>

          {/* 第七条 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-3">七、未成年人保护</h2>
            <p className="text-muted-foreground leading-relaxed pl-[52px]">
              本平台不面向 14 岁以下的未成年人提供服务。如果我们发现收集了 14 岁以下未成年人的个人信息，
              将尽快删除相关数据。若您是未成年人的监护人，发现被监护人使用了本平台，请及时与我们联系。
            </p>
          </section>

          {/* 第八条 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-3">八、政策更新</h2>
            <p className="text-muted-foreground leading-relaxed pl-[52px]">
              我们可能不时更新本隐私政策。重大变更时我们会通过系统通知或在平台显著位置发布公告。
              建议您定期查阅本页面以了解最新的隐私政策。继续使用我们的服务即表示您同意更新后的政策。
            </p>
          </section>

          {/* 第九条 */}
          <section className="mb-10">
            <h2 className="text-xl font-bold mb-3">九、联系我们</h2>
            <div className="pl-[52px] text-muted-foreground leading-relaxed space-y-2">
              <p>如您对本隐私政策有任何疑问、意见或建议，可通过以下方式联系我们：</p>
              <p>邮箱：support@aiplatform.com</p>
              <p>AI 客服：平台内侧边栏「AI 客服」→ 转人工</p>
              <p>我们将在收到您的请求后 15 个工作日内答复。</p>
            </div>
          </section>
        </div>

        {/* 底部导航 */}
        <div className="border-t pt-6 mt-12 flex items-center justify-between text-sm text-muted-foreground">
          <Link href="/terms" className="hover:text-foreground transition-colors">
            查看服务条款与免责声明 →
          </Link>
          <span>© 2026 paper insights</span>
        </div>
      </main>
    </div>
  );
}
