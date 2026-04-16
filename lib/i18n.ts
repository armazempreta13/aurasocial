import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Imorting common bundles statically to prevent flicker on first load
import enCommon from './locales/en/common.json';
import ptBrCommon from './locales/pt-BR/common.json';

const resources = {
  en: {
    common: enCommon,
  },
  'pt-BR': {
    common: ptBrCommon,
  },
  pt: {
    common: ptBrCommon, // Fallback for general Portuguese
  }
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    defaultNS: 'common',
    fallbackLng: 'en',
    
    interpolation: {
      escapeValue: false, // react already safes from xss
    },
    
    detection: {
      // Order of detection
      order: ['localStorage', 'navigator'],
      // localStorage key
      lookupLocalStorage: 'i18nextLng',
      // cache user language on
      caches: ['localStorage'],
    }
  });

export default i18n;
