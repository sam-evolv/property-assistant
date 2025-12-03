import en from '../i18n/en.json';
import pl from '../i18n/pl.json';
import ga from '../i18n/ga.json';

export type Locale = 'en' | 'pl' | 'ga';

const translations = {
  en,
  pl,
  ga,
};

export const SUPPORTED_LOCALES: Locale[] = ['en', 'pl', 'ga'];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  pl: 'Polski',
  ga: 'Gaeilge',
};

const DEFAULT_LOCALE: Locale = 'en';
const LOCALE_STORAGE_KEY = 'openhouse_dev_locale';

function getNestedValue(obj: any, path: string): string | undefined {
  const keys = path.split('.');
  let current = obj;
  
  for (const key of keys) {
    if (current && typeof current === 'object' && key in current) {
      current = current[key];
    } else {
      return undefined;
    }
  }
  
  return typeof current === 'string' ? current : undefined;
}

function interpolate(template: string, variables?: Record<string, string>): string {
  if (!variables) return template;
  
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return variables[key] !== undefined ? variables[key] : match;
  });
}

export function detectBrowserLanguage(): Locale {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  
  const browserLang = navigator.language.toLowerCase();
  const langCode = browserLang.split('-')[0] as Locale;
  
  if (SUPPORTED_LOCALES.includes(langCode)) {
    return langCode;
  }
  
  return DEFAULT_LOCALE;
}

export function getStoredLocale(): Locale | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && SUPPORTED_LOCALES.includes(stored as Locale)) {
      return stored as Locale;
    }
  } catch (e) {
    console.warn('Failed to read locale from localStorage:', e);
  }
  
  return null;
}

export function setLocale(locale: Locale): void {
  if (typeof window === 'undefined') return;
  
  try {
    localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch (e) {
    console.warn('Failed to store locale in localStorage:', e);
  }
}

export function resolveLocale(): Locale {
  return getStoredLocale() || detectBrowserLanguage() || DEFAULT_LOCALE;
}

export function getTranslations(locale: Locale = DEFAULT_LOCALE) {
  const localeTranslations = translations[locale] || translations[DEFAULT_LOCALE];
  
  function t(key: string, variables?: Record<string, string>): string {
    const value = getNestedValue(localeTranslations, key);
    
    if (!value) {
      const fallback = getNestedValue(translations.en, key);
      if (!fallback) {
        console.warn(`Missing translation for key: ${key}`);
        return key;
      }
      return interpolate(fallback, variables);
    }
    
    return interpolate(value, variables);
  }
  
  return { t, locale };
}
