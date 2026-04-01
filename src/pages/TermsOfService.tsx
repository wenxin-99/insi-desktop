/**
 * 服务条款与免责声明页面
 */

import { useEffect } from "react";
import { Link } from "wouter";
import {
  FileText, Scale, AlertTriangle, UserCheck, Ban, CreditCard,
  ShieldAlert, Globe, Gavel, RefreshCw, Mail,
} from "lucide-react";
import BackButton from "@/components/BackButton";

export default function TermsOfService() {
  useEffect(() => {
    document.title = "服务条款与免责声明 — Insi 智能平台";
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-gray-950 dark:to-gray-900">
      {/* 顶部导航 */}
      <header className="sticky top-0 z-10 border-b bg-white/80 dark:bg-gray-950/80 backdrop-blur-sm">
        <div className="container max-w-4xl flex items-center gap-3 py-3">
          <BackButton />
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            <span className="font-semibold">服务条款与免责声明</span>
          </div>
        </div>
      </header>

      <main className="container max-w-4xl py-10 px-4">
        {/* 标题区 */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-900/30 mb-4">
            <Scale className="h-8 w-8 text-indigo-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">服务条款与免责声明</h1>
          <p className="text-muted-foreground">最后更新日期：2026 年 3 月 1 日</p>
        </div>

        {/* 引言 */}
        <div className="prose prose-gray dark:prose-invert max-w-none">
          <div className="p-4 mb-8 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900/50">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200 m-0">
                请您在使用 Insi 智能平台（以下简称"本平台"或"我们"）的服务之前，
                仔细阅读并充分理解本服务条款。一旦您注册、登录或使用我们的服务，
                即视为您已阅读、理解并同意接受本条款的约束。
              </p>
            </div>
          </div>

          {/* 第一条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30">
                <Globe className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-xl font-bold m-0">一、服务概述</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p>本平台是一个集成多种 AI 能力的一站式服务平台，向用户提供包括但不限于以下功能：</p>
              <p>AI 智能对话（多种大语言模型）、AI 图片生成、AI 视频生成、语音对话（语音转文字与文字转语音）、
                 作业智能批改、深度研究与报告生成、网站自动化操作、GitHub 代码协作、
                 Agent 智能代理、项目协作空间等。</p>
              <p>具体功能以平台实际提供为准，我们保留随时增加、修改或停止部分功能的权利。</p>
            </div>
          </section>

          {/* 第二条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30">
                <UserCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold m-0">二、账户注册与管理</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">注册资格</strong> — 您需要年满 14 周岁且具有完全民事行为能力。
                 若您是未成年人（14-18 周岁），请在监护人的陪同和指导下使用本平台。</p>
              <p><strong className="text-foreground">真实信息</strong> — 您应在注册时提供真实、准确的信息，
                 并在信息变更时及时更新。因虚假信息导致的后果由您自行承担。</p>
              <p><strong className="text-foreground">账户安全</strong> — 您有责任保管好自己的账户和密码。
                 因您自身原因导致的账户被盗、密码泄露等安全问题，平台不承担责任。
                 发现异常请立即联系客服。</p>
              <p><strong className="text-foreground">账户注销</strong> — 您有权随时申请注销账户。
                 注销后您的个人数据将被删除或匿名化处理，已消费的鱼币和已购买的会员服务不予退还。</p>
            </div>
          </section>

          {/* 第三条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-900/30">
                <Ban className="h-5 w-5 text-rose-600" />
              </div>
              <h2 className="text-xl font-bold m-0">三、用户行为规范</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p>您在使用本平台服务时，承诺遵守以下规范：</p>
              <p><strong className="text-foreground">合法使用</strong> — 不得利用平台从事违反法律法规的活动，
                 包括但不限于制作、传播违法信息或有害内容。</p>
              <p><strong className="text-foreground">禁止滥用</strong> — 不得利用技术手段攻击、干扰平台正常运行；
                 不得恶意刷取鱼币或利用系统漏洞获取不当利益。</p>
              <p><strong className="text-foreground">内容规范</strong> — 不得利用 AI 生成违法、淫秽、暴力、歧视性内容；
                 不得利用 AI 生成虚假信息进行欺诈；不得生成侵犯他人知识产权的内容。</p>
              <p><strong className="text-foreground">尊重他人</strong> — 在项目协作、社区交流中应尊重他人，
                 不得进行骚扰、人身攻击或歧视行为。</p>
              <p><strong className="text-foreground">自动化规范</strong> — 使用网站自动化和 Agent 功能时，
                 应遵守目标网站的使用协议和 robots.txt 规则，不得用于非法数据采集或恶意操作。</p>
              <p className="text-rose-600 dark:text-rose-400">
                违反上述规范的，平台有权对您的账户采取警告、限制功能、暂停服务或永久封禁等措施，
                且已消费的费用不予退还。情节严重的，平台保留追究法律责任的权利。
              </p>
            </div>
          </section>

          {/* 第四条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30">
                <CreditCard className="h-5 w-5 text-amber-600" />
              </div>
              <h2 className="text-xl font-bold m-0">四、费用与支付</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">鱼币</strong> — 鱼币是平台的虚拟货币，用于消费各项 AI 服务。
                 鱼币充值后到账即视为交付完成。已到账的鱼币充值一般不支持退款。</p>
              <p><strong className="text-foreground">会员订阅</strong> — 会员服务按周期计费。您可以随时取消订阅，
                 取消后当前周期内的权益继续有效至到期日。</p>
              <p><strong className="text-foreground">价格变更</strong> — 我们保留调整服务价格的权利。
                 价格调整将提前通知，不影响已购买的服务。</p>
              <p><strong className="text-foreground">扣费失败</strong> — AI 服务请求失败（如图片生成失败、对话返回错误）
                 不会扣除鱼币。如发生异常扣费，经核实后全额退还。</p>
              <p><strong className="text-foreground">充值异常</strong> — 如充值支付成功但鱼币未到账，
                 请在「订单历史」页面查看记录，并联系人工客服处理，我们承诺 24 小时内解决。</p>
            </div>
          </section>

          {/* 第五条 — 免责声明（核心） */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30">
                <ShieldAlert className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-xl font-bold m-0">五、免责声明</h2>
            </div>
            <div className="pl-[52px] space-y-4">
              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">5.1 AI 生成内容声明</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  本平台提供的 AI 服务基于人工智能模型生成内容。AI 生成的所有内容（包括但不限于文字回答、
                  图片、视频、代码、研究报告等）<strong>仅供参考</strong>，不构成任何专业建议（包括但不限于
                  法律、医学、金融、投资建议）。我们<strong>不保证</strong> AI 生成内容的准确性、完整性、
                  时效性或适用性。用户应自行判断和验证 AI 输出内容的可靠性，并对基于 AI 内容所做的决策
                  承担全部责任。
                </p>
              </div>

              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">5.2 作业批改声明</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  AI 作业批改功能仅作为学习辅助工具，不代替专业教师的教学评估。
                  批改结果可能存在误差，请以正式教学评价为准。
                </p>
              </div>

              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">5.3 第三方模型声明</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  本平台集成的 AI 模型（如 DeepSeek、GPT、Claude、Gemini 等）由第三方提供商维护。
                  我们无法完全控制第三方模型的输出质量和可用性。因第三方模型调整、故障或停服
                  导致的服务中断或质量变化，我们将尽力寻找替代方案，但不承担由此产生的赔偿责任。
                </p>
              </div>

              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">5.4 自动化操作声明</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  使用网站自动化、Agent 代理、定时任务等功能时，用户应确保操作目标和内容的合法性。
                  因用户设定的自动化任务导致的第三方纠纷或法律风险，由用户自行承担。
                  平台不对自动化操作的执行结果做任何担保。
                </p>
              </div>

              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">5.5 服务可用性声明</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  平台力求提供稳定、不间断的服务，但不做 100% 可用性承诺。
                  因以下原因导致的服务中断或数据损失，平台不承担赔偿责任：
                  系统维护与升级（将尽量提前通知）；不可抗力（自然灾害、战争、政策变更等）；
                  第三方服务中断（云服务商、AI 模型提供商、支付服务商等）；
                  网络安全事件（DDoS 攻击、黑客入侵等，平台将尽最大努力防范）。
                </p>
              </div>

              <div className="p-4 rounded-xl border border-red-200 bg-red-50/50 dark:bg-red-950/20 dark:border-red-900/50">
                <h3 className="font-semibold text-red-700 dark:text-red-400 mb-2">5.6 数据安全声明</h3>
                <p className="text-muted-foreground leading-relaxed text-sm">
                  尽管我们采取了多种安全措施保护您的数据，但任何互联网传输和电子存储方式
                  都不能保证 100% 安全。我们无法对数据传输的绝对安全性做出保证。
                  建议您对重要文件进行自行备份。
                </p>
              </div>
            </div>
          </section>

          {/* 第六条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30">
                <FileText className="h-5 w-5 text-violet-600" />
              </div>
              <h2 className="text-xl font-bold m-0">六、知识产权</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">平台权利</strong> — 本平台的界面设计、代码、图标、
                 品牌标识等受知识产权法保护。未经书面授权，不得复制、修改、传播或用于商业目的。</p>
              <p><strong className="text-foreground">用户内容</strong> — 您通过平台上传的内容（文字、图片、
                 文件等）的知识产权归您所有。您授权平台在提供服务过程中使用这些内容。</p>
              <p><strong className="text-foreground">AI 生成内容</strong> — AI 为您生成的内容（图片、视频、
                 文字等），您有权自由使用。但请注意 AI 生成的内容可能与他人已有作品存在相似，
                 使用前请自行评估知识产权风险。平台不对 AI 生成内容的独创性做出保证。</p>
            </div>
          </section>

          {/* 第七条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30">
                <RefreshCw className="h-5 w-5 text-cyan-600" />
              </div>
              <h2 className="text-xl font-bold m-0">七、条款变更</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p>我们保留随时修改本服务条款的权利。修改后的条款将在本页面公布并更新"最后更新日期"。</p>
              <p>对于重大条款变更，我们将通过系统通知、弹窗提示或邮件等方式告知您。
                 如您在条款变更后继续使用本平台服务，即视为您同意修改后的条款。
                 如您不同意修改后的条款，请停止使用本平台服务。</p>
            </div>
          </section>

          {/* 第八条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <Gavel className="h-5 w-5 text-indigo-600" />
              </div>
              <h2 className="text-xl font-bold m-0">八、法律适用与争议解决</h2>
            </div>
            <div className="pl-[52px] space-y-3 text-muted-foreground leading-relaxed">
              <p>本服务条款受中华人民共和国法律管辖并按其解释。</p>
              <p>因使用本平台服务引起的或与之相关的任何争议，双方应首先友好协商解决。
                 协商不成的，任何一方均有权向平台运营者所在地有管辖权的人民法院提起诉讼。</p>
              <p>本条款的任何条款被认定为无效或不可执行的，不影响其余条款的效力。</p>
            </div>
          </section>

          {/* 第九条 */}
          <section className="mb-10">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-teal-100 dark:bg-teal-900/30">
                <Mail className="h-5 w-5 text-teal-600" />
              </div>
              <h2 className="text-xl font-bold m-0">九、联系方式</h2>
            </div>
            <div className="pl-[52px] text-muted-foreground leading-relaxed space-y-2">
              <p>如您对本服务条款有任何疑问，请通过以下方式联系我们：</p>
              <p>邮箱：support@aiplatform.com</p>
              <p>AI 客服：平台内侧边栏「AI 客服」→ 转人工</p>
            </div>
          </section>
        </div>

        {/* 底部导航 */}
        <div className="border-t pt-6 mt-12 flex items-center justify-between text-sm text-muted-foreground">
          <Link href="/privacy" className="hover:text-foreground transition-colors">
            查看隐私政策 →
          </Link>
          <span>© 2026 paper insights</span>
        </div>
      </main>
    </div>
  );
}
