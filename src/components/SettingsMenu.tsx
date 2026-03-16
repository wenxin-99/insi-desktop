import { Settings, Sun, Moon, Monitor, Globe, Mic, Zap, PenLine, Check, Bell, BellOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useVoiceInputSettings, type VoiceInputMode } from "@/hooks/useVoiceInputSettings";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";

export function SettingsMenu() {
  const { theme, setTheme } = useTheme();
  const { t, i18n } = useTranslation();
  const [language, setLanguage] = useState<"zh" | "en">(
    (localStorage.getItem('language') as "zh" | "en") || "zh"
  );
  const { voiceSettings, updateVoiceSettings } = useVoiceInputSettings();
  const { notificationSettings, updateNotificationSettings } = useNotificationSettings();

  useEffect(() => {
    // 同步i18n语言
    if (i18n.language !== language) {
      i18n.changeLanguage(language);
    }
  }, [language, i18n]);

  const themeOptions = [
    { value: "light", label: t('settings.theme.light'), icon: Sun },
    { value: "dark", label: t('settings.theme.dark'), icon: Moon },
    { value: "system", label: t('settings.theme.system'), icon: Monitor },
  ] as const;

  const languageOptions = [
    { value: "zh", label: t('settings.language.zh') },
    { value: "en", label: t('settings.language.en') },
  ] as const;

  const voiceModeOptions: Array<{
    value: VoiceInputMode;
    label: string;
    desc: string;
    icon: typeof Zap;
  }> = [
    {
      value: 'auto-send',
      label: '识别即发送',
      desc: '说完自动发送，适合快速对话',
      icon: Zap,
    },
    {
      value: 'fill-input',
      label: '识别到输入框',
      desc: '可编辑确认后再发送',
      icon: PenLine,
    },
  ];

  const handleLanguageChange = (newLang: "zh" | "en") => {
    setLanguage(newLang);
    i18n.changeLanguage(newLang);
    localStorage.setItem('language', newLang);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-9 w-9">
          <Settings className="h-4 w-4" />
          <span className="sr-only">设置</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t('settings.title')}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {/* 外观切换 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Sun className="mr-2 h-4 w-4" />
            <span>{t('settings.theme.title')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {themeOptions.map((option) => {
              const Icon = option.icon;
              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => setTheme(option.value)}
                  className={theme === option.value ? "bg-accent" : ""}
                >
                  <Icon className="mr-2 h-4 w-4" />
                  <span>{option.label}</span>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 语言切换 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Globe className="mr-2 h-4 w-4" />
            <span>{t('settings.language.title')}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {languageOptions.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => handleLanguageChange(option.value)}
                className={language === option.value ? "bg-accent" : ""}
              >
                <span>{option.label}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 语音输入模式 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Mic className="mr-2 h-4 w-4" />
            <span>语音输入</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              识别完成后
            </DropdownMenuLabel>
            {voiceModeOptions.map((option) => {
              const Icon = option.icon;
              const isActive = voiceSettings.mode === option.value;
              return (
                <DropdownMenuItem
                  key={option.value}
                  onClick={() => updateVoiceSettings({ mode: option.value })}
                  className={`flex items-start gap-2 py-2.5 cursor-pointer ${isActive ? "bg-accent" : ""}`}
                >
                  <div className="flex items-start gap-2 flex-1">
                    <Icon className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{option.label}</span>
                      <span className="text-xs text-muted-foreground leading-tight">{option.desc}</span>
                    </div>
                  </div>
                  {isActive && <Check className="h-4 w-4 shrink-0 mt-0.5 text-primary" />}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        {/* 通知设置 */}
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {notificationSettings.enabled ? (
              <Bell className="mr-2 h-4 w-4" />
            ) : (
              <BellOff className="mr-2 h-4 w-4 text-muted-foreground" />
            )}
            <span>消息通知</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-64">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              选择需要接收的通知类型
            </DropdownMenuLabel>
            {/* 总开关 */}
            <DropdownMenuItem
              onClick={() => updateNotificationSettings({ enabled: !notificationSettings.enabled })}
              className="flex items-center justify-between cursor-pointer"
            >
              <span className="text-sm font-medium">接收通知</span>
              <div className={`w-9 h-5 rounded-full transition-colors relative ${notificationSettings.enabled ? 'bg-primary' : 'bg-muted-foreground/30'}`}>
                <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${notificationSettings.enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </div>
            </DropdownMenuItem>
            {notificationSettings.enabled && (
              <>
                <DropdownMenuSeparator />
                {/* 任务通知 */}
                <DropdownMenuItem
                  onClick={() => updateNotificationSettings({ taskNotify: !notificationSettings.taskNotify })}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">任务通知</span>
                    <span className="text-xs text-muted-foreground">研究完成、视频生成</span>
                  </div>
                  {notificationSettings.taskNotify && <Check className="h-4 w-4 text-primary shrink-0" />}
                </DropdownMenuItem>
                {/* 账户通知 */}
                <DropdownMenuItem
                  onClick={() => updateNotificationSettings({ accountNotify: !notificationSettings.accountNotify })}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">账户通知</span>
                    <span className="text-xs text-muted-foreground">余额不足、交易记录</span>
                  </div>
                  {notificationSettings.accountNotify && <Check className="h-4 w-4 text-primary shrink-0" />}
                </DropdownMenuItem>
                {/* 系统通知 */}
                <DropdownMenuItem
                  onClick={() => updateNotificationSettings({ systemNotify: !notificationSettings.systemNotify })}
                  className="flex items-center justify-between cursor-pointer"
                >
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm">系统通知</span>
                    <span className="text-xs text-muted-foreground">系统消息、反馈回复</span>
                  </div>
                  {notificationSettings.systemNotify && <Check className="h-4 w-4 text-primary shrink-0" />}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
