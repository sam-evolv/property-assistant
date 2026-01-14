'use client';

import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import type { Locale } from './config';
import { defaultLocale, isValidLocale, locales, localeNames, localeFlags } from './config';
import { getNestedValue, interpolate } from './messages';

import enMessages from './locales/en/common.json';
import plMessages from './locales/pl/common.json';
import gaMessages from './locales/ga/common.json';
import esMessages from './locales/es/common.json';
import ruMessages from './locales/ru/common.json';
import ptMessages from './locales/pt/common.json';
import lvMessages from './locales/lv/common.json';
import ltMessages from './locales/lt/common.json';
import roMessages from './locales/ro/common.json';

const allMessages: Record<Locale, Record<string, any>> = {
  en: enMessages,
  pl: plMessages,
  ga: gaMessages,
  es: esMessages,
  ru: ruMessages,
  pt: ptMessages,
  lv: lvMessages,
  lt: ltMessages,
  ro: roMessages,
};

const STORAGE_KEY = 'purchaser_language';

interface I18nContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, params?: Record<string, string | number>) => string;
  tArray: (key: string) => string[];
  isHydrated: boolean;
  locales: readonly Locale[];
  localeNames: Record<Locale, string>;
  localeFlags: Record<Locale, string>;
}

const I18nContext = createContext<I18nContextValue | null>(null);

function getStoredLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale;
  
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && isValidLocale(stored)) {
    return stored;
  }
  return defaultLocale;
}

interface I18nProviderProps {
  children: ReactNode;
  initialLocale?: Locale;
}

export function I18nProvider({ children, initialLocale }: I18nProviderProps) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale || defaultLocale);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const storedLocale = getStoredLocale();
    setLocaleState(storedLocale);
    setIsHydrated(true);
  }, []);

  const setLocale = useCallback((newLocale: Locale) => {
    if (isValidLocale(newLocale)) {
      setLocaleState(newLocale);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY, newLocale);
      }
    }
  }, []);

  const messages = useMemo(() => allMessages[locale] || allMessages[defaultLocale], [locale]);
  const fallbackMessages = allMessages[defaultLocale];

  const t = useCallback((key: string, params?: Record<string, string | number>): string => {
    let value = getNestedValue(messages, key);
    
    if (value === undefined) {
      value = getNestedValue(fallbackMessages, key);
      
      if (process.env.NODE_ENV === 'development' && locale !== defaultLocale) {
        console.warn(`[i18n] Missing translation key "${key}" for locale "${locale}"`);
      }
    }
    
    if (value === undefined) {
      if (process.env.NODE_ENV === 'development') {
        console.error(`[i18n] Translation key "${key}" not found in any locale`);
      }
      return key;
    }
    
    return interpolate(value, params);
  }, [messages, fallbackMessages, locale]);

  const tArray = useCallback((key: string): string[] => {
    const value = getNestedValue(messages, key) ?? getNestedValue(fallbackMessages, key);
    if (Array.isArray(value)) {
      return value;
    }
    return [];
  }, [messages, fallbackMessages]);

  const contextValue = useMemo<I18nContextValue>(() => ({
    locale,
    setLocale,
    t,
    tArray,
    isHydrated,
    locales,
    localeNames,
    localeFlags,
  }), [locale, setLocale, t, tArray, isHydrated]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}

export function useLocale(): Locale {
  const { locale } = useI18n();
  return locale;
}

export function useT() {
  const { t } = useI18n();
  return t;
}
