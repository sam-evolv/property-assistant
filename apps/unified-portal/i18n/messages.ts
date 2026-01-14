import type { Locale } from './config';
import { defaultLocale } from './config';

const messageCache = new Map<Locale, Record<string, any>>();

export async function getMessages(locale: Locale): Promise<Record<string, any>> {
  if (messageCache.has(locale)) {
    return messageCache.get(locale)!;
  }

  try {
    const messages = await import(`./locales/${locale}/common.json`);
    messageCache.set(locale, messages.default);
    return messages.default;
  } catch (error) {
    console.warn(`[i18n] Failed to load locale ${locale}, falling back to ${defaultLocale}`);
    if (locale !== defaultLocale) {
      return getMessages(defaultLocale);
    }
    return {};
  }
}

export function getNestedValue(obj: Record<string, any>, path: string): string | undefined {
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

export function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return params[key]?.toString() ?? match;
  });
}
