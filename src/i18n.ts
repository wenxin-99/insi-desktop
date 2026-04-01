import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import zh from './locales/zh.json';
import en from './locales/en.json';

// 检测浏览器语言
const detectBrowserLanguage = (): 'zh' | 'en' => {
  const browserLang = navigator.language.toLowerCase();
  // 如果是中文相关语言（zh, zh-CN, zh-TW等），返回'zh'
  if (browserLang.startsWith('zh')) {
    return 'zh';
  }
  // 其他语言默认返回'en'
  return 'en';
};

// 获取初始语言：优先使用localStorage，其次是浏览器语言，最后是默认中文
const getInitialLanguage = (): 'zh' | 'en' => {
  const storedLang = localStorage.getItem('language');
  if (storedLang === 'zh' || storedLang === 'en') {
    return storedLang;
  }
  return detectBrowserLanguage();
};

i18n
  .use(initReactI18next)
  .init({
    resources: {
      zh: { translation: zh },
      en: { translation: en },
    },
    lng: getInitialLanguage(),
    fallbackLng: 'zh',
    interpolation: {
      escapeValue: false,
    },
  });

// 保存初始语言到localStorage
if (!localStorage.getItem('language')) {
  localStorage.setItem('language', i18n.language);
}

export default i18n;
