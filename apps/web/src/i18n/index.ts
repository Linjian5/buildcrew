import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import zh from './locales/zh.json';
import ja from './locales/ja.json';

/**
 * Normalize any browser locale string to the backend-accepted values: 'en' | 'zh' | 'ja'.
 * Handles variants like zh-Hans, zh-Hant, zh-CN, zh-TW, ja-JP, en-US, etc.
 */
export function normalizeLocale(lang: string): 'en' | 'zh' | 'ja' {
  if (lang.startsWith('zh')) return 'zh';
  if (lang.startsWith('ja')) return 'ja';
  return 'en';
}

/**
 * Shorthand: get the current i18n language normalized for backend API calls.
 */
export function getApiLocale(): 'en' | 'zh' | 'ja' {
  return normalizeLocale(i18n.language);
}

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      zh: { translation: zh },
      ja: { translation: ja },
    },
    supportedLngs: ['en', 'zh', 'ja'],
    fallbackLng: 'en',
    load: 'languageOnly', // 'zh-CN' → matches 'zh', 'ja-JP' → matches 'ja'
    interpolation: { escapeValue: false },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'buildcrew-lang',
    },
  });

export default i18n;
