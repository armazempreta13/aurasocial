import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Importing common bundles statically to prevent flicker on first load
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

const isBrowser = typeof window !== 'undefined';

if (isBrowser) {
  i18n.use(LanguageDetector);
}

i18n
  .use(initReactI18next)
  .init({
    resources,
    defaultNS: 'common',
    fallbackLng: 'pt-BR',
    supportedLngs: ['pt-BR', 'pt', 'en'],
    load: 'currentOnly',
    nonExplicitSupportedLngs: true,
    
    interpolation: {
      escapeValue: false,
    },
    
    detection: isBrowser ? {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'i18nextLng',
      caches: ['localStorage'],
    } : undefined
  });

export default i18n;
