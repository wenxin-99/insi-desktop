import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { BookOpen, MessageSquare, Image, FileText, Mic, Coins, Search, Video, HelpCircle } from "lucide-react";
import BackButton from "@/components/BackButton";
import DashboardLayout from '@/components/DashboardLayout';

export default function Help() {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const tutorialsRaw = t('help.tutorials', { returnObjects: true });
  const tutorialsData = (Array.isArray(tutorialsRaw) ? tutorialsRaw : []) as Array<{
    title: string;
    description: string;
    steps: string[];
  }>;

  const tutorials = [
    {
      icon: MessageSquare,
      ...tutorialsData[0],
      gradient: "from-blue-500 to-cyan-500",
    },
    {
      icon: Image,
      ...tutorialsData[1],
      gradient: "from-purple-500 to-pink-500",
    },
    {
      icon: FileText,
      ...tutorialsData[2],
      gradient: "from-green-500 to-emerald-500",
    },
    {
      icon: Mic,
      ...tutorialsData[3],
      gradient: "from-orange-500 to-amber-500",
    },
  ];

  const faqsRaw = t('help.faqs', { returnObjects: true });
  const faqs = (Array.isArray(faqsRaw) ? faqsRaw : []) as Array<{
    question: string;
    answer: string;
  }>;

  const filteredFaqs = faqs.filter(
    (faq) =>
      searchQuery === "" ||
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DashboardLayout>
    <div className="container max-w-6xl py-8">
      <BackButton className="mb-4" />
      {/* 页面标题 */}
      <div className="text-center mb-12">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect mb-4">
          <HelpCircle className="h-5 w-5 text-primary" />
          <span className="text-sm font-medium">{t('help.badge')}</span>
        </div>
        <h1 className="text-4xl font-bold mb-4">{t('help.title')}</h1>
        <p className="text-xl text-muted-foreground">
          {t('help.description')}
        </p>
      </div>

      <Tabs defaultValue="tutorials" className="w-full">
        <TabsList className="grid w-full grid-cols-2 mb-8">
          <TabsTrigger value="tutorials" className="text-base">
            <BookOpen className="mr-2 h-4 w-4" />
            {t('help.tabs.tutorials')}
          </TabsTrigger>
          <TabsTrigger value="faq" className="text-base">
            <HelpCircle className="mr-2 h-4 w-4" />
            {t('help.tabs.faq')}
          </TabsTrigger>
        </TabsList>

        {/* 功能教程 */}
        <TabsContent value="tutorials" className="space-y-6">
          {tutorials.map((tutorial, index) => (
            <Card key={index} className="overflow-hidden">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${tutorial.gradient} flex items-center justify-center`}>
                    <tutorial.icon className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <CardTitle className="text-2xl">{tutorial.title}</CardTitle>
                    <CardDescription className="text-base mt-1">
                      {tutorial.description}
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {tutorial.steps.map((step, stepIndex) => (
                    <div key={stepIndex} className="flex items-start gap-3">
                      <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {stepIndex + 1}
                      </div>
                      <p className="text-sm text-muted-foreground pt-0.5">{step}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {/* 视频教程占位 */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-500 to-pink-500 flex items-center justify-center">
                  <Video className="h-7 w-7 text-white" />
                </div>
                <div>
                  <CardTitle className="text-2xl">{t('help.videoTutorial.title', '视频教程')}</CardTitle>
                  <CardDescription className="text-base mt-1">
                    {t('help.videoTutorial.description', '观看视频快速上手')}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="aspect-video bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <Video className="h-12 w-12 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">{t('help.videoTutorial.comingSoon', '视频教程即将上线')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* 常见问题 */}
        <TabsContent value="faq" className="space-y-6">
          {/* 搜索框 */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('help.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* FAQ列表 */}
          <Card>
            <CardContent className="p-0">
              <Accordion type="single" collapsible className="w-full">
                {filteredFaqs.map((faq, index) => (
                  <AccordionItem key={index} value={`item-${index}`} className="border-b last:border-b-0 px-6">
                    <AccordionTrigger className="text-left hover:no-underline py-4">
                      <span className="font-medium">{faq.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground pb-4">
                      {faq.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          {filteredFaqs.length === 0 && (
            <div className="text-center py-12">
              <Search className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">{t('help.noResults')}</p>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* 联系支持 */}
      <Card className="mt-12 elegant-gradient">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold mb-2">{t('help.contactSupport')}</h2>
          <p className="text-muted-foreground mb-6">
            {t('help.noResultsDesc')}
          </p>
          <div className="flex items-center justify-center gap-4">
            <div className="text-sm">
              <div className="font-medium">{t('help.contactSupport')}</div>
              <div className="text-muted-foreground">support@aiplatform.com</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
    </DashboardLayout>
  );
}
