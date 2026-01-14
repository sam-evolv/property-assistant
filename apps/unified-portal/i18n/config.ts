export const locales = ['en', 'pl', 'ga', 'es', 'ru', 'pt', 'lv', 'lt', 'ro'] as const;
export const defaultLocale = 'en' as const;

export type Locale = (typeof locales)[number];

export const localeNames: Record<Locale, string> = {
  en: 'English',
  pl: 'Polski',
  ga: 'Gaeilge',
  es: 'Español',
  ru: 'Русский',
  pt: 'Português',
  lv: 'Latviešu',
  lt: 'Lietuvių',
  ro: 'Română',
};

export const localeFlags: Record<Locale, string> = {
  en: '',
  pl: '🇵🇱',
  ga: '🇮🇪',
  es: '🇪🇸',
  ru: '🇷🇺',
  pt: '🇵🇹',
  lv: '🇱🇻',
  lt: '🇱🇹',
  ro: '🇷🇴',
};

export function isValidLocale(locale: string): locale is Locale {
  return locales.includes(locale as Locale);
}
