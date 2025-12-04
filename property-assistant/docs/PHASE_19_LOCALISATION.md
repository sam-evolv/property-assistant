# PHASE 19 — MULTI-LANGUAGE SUPPORT (LOCALISATION ENGINE)

**Status:** ✅ COMPLETE  
**Date:** November 15, 2025

## Overview

Phase 19 introduces comprehensive internationalization (i18n) support for both the Tenant Portal and Developer Portal, enabling homeowners and developers to use OpenHouse AI in their preferred language.

### Supported Languages

**Tenant Portal:**
- 🇬🇧 **EN** — English (Default)
- 🇮🇪 **IE** — English (Ireland)
- 🇵🇱 **PL** — Polski (Polish)
- 🇪🇸 **ES** — Español (Spanish)
- 🇫🇷 **FR** — Français (French)

**Developer Portal:**
- 🇬🇧 **EN** — English (Default)
- 🇵🇱 **PL** — Polski (Polish)

---

## Architecture

### Translation System

```
apps/tenant-portal/
├── i18n/                      # Translation files
│   ├── en.json               # English (base)
│   ├── ie.json               # Irish English
│   ├── pl.json               # Polish
│   ├── es.json               # Spanish
│   └── fr.json               # French
├── lib/
│   └── i18n.ts               # Translation utilities
└── components/
    ├── providers/
    │   └── LocaleProvider.tsx # React Context provider
    └── LanguageSelector.tsx   # UI component
```

### Language Detection Priority

The system resolves the user's language in this order:

1. **URL Parameter** — `?lang=pl` (highest priority)
2. **localStorage** — Previously selected language
3. **Cookie** — `locale` cookie
4. **Browser Language** — `navigator.language`
5. **Default** — English (fallback)

---

## Translation Files

### Structure

Each translation file follows this nested JSON structure:

```json
{
  "common": {
    "welcome": "Welcome",
    "send": "Send",
    ...
  },
  "nav": {
    "chat": "Chat",
    "map": "Map",
    ...
  },
  "chat": {
    "title": "Welcome to {developmentName} Assistant",
    "greeting": "👋 Hello! I'm your property assistant.",
    ...
  },
  "onboarding": { ... },
  "offline": { ... },
  "documents": { ... },
  "map": { ... },
  "noticeboard": { ... },
  "language": { ... },
  "pwa": { ... }
}
```

### Variable Interpolation

Translations support variable substitution using `{variableName}` syntax:

```typescript
// Translation file
{
  "chat": {
    "title": "Welcome to {developmentName} Assistant"
  }
}

// Usage in code
t('chat.title', { developmentName: 'Longview Park' })
// Result: "Welcome to Longview Park Assistant"
```

---

## Usage in Components

### Client Components

```typescript
'use client';

import { useLocale } from '@/components/providers/LocaleProvider';

export function MyComponent() {
  const { t, locale, setLocale } = useLocale();

  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <p>{t('chat.greeting')}</p>
      <p>Current language: {locale}</p>
      
      <button onClick={() => setLocale('pl')}>
        Switch to Polish
      </button>
    </div>
  );
}
```

### With Variable Interpolation

```typescript
const { t } = useLocale();

<h1>{t('chat.title', { developmentName: 'Longview Park' })}</h1>
// Output (EN): "Welcome to Longview Park Assistant"
// Output (PL): "Witamy w asystencie Longview Park"
```

### Dot Notation Access

Access nested translations using dot notation:

```typescript
t('common.welcome')      // "Welcome"
t('chat.greeting')       // "👋 Hello! I'm your property assistant."
t('offline.title')       // "You're Offline"
t('language.select')     // "Select Language"
```

---

## Language Selector Component

Add the language selector to any page:

```typescript
import { LanguageSelector } from '@/components/LanguageSelector';

export function Header() {
  return (
    <header>
      <nav>
        {/* Other nav items */}
        <LanguageSelector />
      </nav>
    </header>
  );
}
```

**Features:**
- Globe icon with current language name
- Dropdown with all supported languages
- Checkmark on active language
- Persists selection to localStorage + cookie
- Mobile-responsive (shows "EN" instead of "English" on small screens)

---

## Adding New Languages

### 1. Create Translation File

```bash
# Create new translation file
cp apps/tenant-portal/i18n/en.json apps/tenant-portal/i18n/de.json
```

### 2. Translate Content

Edit `de.json` and translate all strings:

```json
{
  "common": {
    "welcome": "Willkommen",
    "send": "Senden",
    ...
  }
}
```

### 3. Update i18n Utilities

Edit `apps/tenant-portal/lib/i18n.ts`:

```typescript
import de from '../i18n/de.json';

export type Locale = 'en' | 'ie' | 'pl' | 'es' | 'fr' | 'de';

const translations = {
  en,
  ie,
  pl,
  es,
  fr,
  de, // Add new language
};

export const SUPPORTED_LOCALES: Locale[] = ['en', 'ie', 'pl', 'es', 'fr', 'de'];

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  ie: 'English (Ireland)',
  pl: 'Polski',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch', // Add new language name
};
```

### 4. Test

```bash
# Test in browser with URL parameter
http://localhost:5000/?lang=de

# Or use language selector in UI
```

---

## Tenant-Specific Overrides

### Future Enhancement

Tenants can override specific translation strings by adding a `locale_overrides` field to the tenant configuration:

```typescript
// Database schema (future)
{
  tenant_id: '...',
  locale_overrides: {
    pl: {
      "chat.greeting": "Witaj w swoim nowym domu!" // Custom Polish greeting
    }
  }
}

// Usage in code
function getTranslationWithOverride(key: string, tenant: Tenant): string {
  const override = tenant.locale_overrides?.[locale]?.[key];
  if (override) return override;
  return t(key);
}
```

**Implementation:**
1. Add `locale_overrides` JSON column to `tenants` table
2. Modify `getTranslations()` to check tenant overrides first
3. Add UI in developer portal to manage custom translations

---

## PWA Considerations

### Manifest Translations ✅

The PWA manifest is now fully localized using server-side locale detection.

**Implementation:**

```typescript
// app/manifest.ts
import { getServerLocale } from '@/lib/i18n-server';
import { getAllTranslations } from '@/lib/i18n';

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  // Resolve locale from Cookie → Accept-Language → Default
  const locale = getServerLocale();
  const translations = getAllTranslations(locale);
  
  // Manifest uses localized strings
  return {
    name: `${tenantName} - ${translations.common.welcome}`,
    description: translations.pwa.installMessage,
    ...
  };
}
```

**How It Works:**
1. Manifest route calls `getServerLocale()` on every request
2. Resolves locale from cookie (user preference) or Accept-Language header
3. Loads translations for detected locale
4. Returns localized manifest JSON
5. Browser caches manifest per origin + locale combination

**Example:**
- Irish visitor (Accept-Language: en-IE) → Manifest in Irish English
- Polish visitor (Accept-Language: pl-PL) → Manifest in Polish
- Returning user with locale cookie → Manifest in saved preference

This ensures PWA installation prompts and home screen names display in the user's language.

### Offline Page

The offline page now supports full i18n:

```typescript
// apps/tenant-portal/app/offline/page.tsx
const { t } = useLocale();

<h1>{t('offline.title')}</h1>
<p>{t('offline.message')}</p>
```

When offline, the language preference is maintained via localStorage.

---

## Testing Multi-Language Flows

### Manual Testing

#### 1. URL Parameter Override
```
http://localhost:5000/?lang=pl
```
Should load entire app in Polish.

#### 2. Language Selector
1. Open tenant portal
2. Click Globe icon (top-right)
3. Select "Polski"
4. Verify all UI text changes to Polish
5. Refresh page — language should persist

#### 3. Browser Language Detection
```javascript
// In browser console
navigator.language = 'pl-PL'; // Simulate Polish browser
localStorage.removeItem('openhouse_locale'); // Clear saved preference
location.reload(); // Should detect and use Polish
```

#### 4. PWA Installation (iOS)
1. Open tenant portal in Safari
2. Change language to Polish
3. Add to Home Screen
4. Open PWA — should maintain Polish language

#### 5. PWA Installation (Android)
1. Open tenant portal in Chrome
2. Change language to Spanish
3. Install app
4. Open PWA — should maintain Spanish language

### Automated Testing

```typescript
// Example test
import { resolveLocale, setLocale } from '@/lib/i18n';

test('Language resolution priority', () => {
  // Set URL param
  window.location.search = '?lang=pl';
  expect(resolveLocale()).toBe('pl');
  
  // Clear URL, use localStorage
  window.location.search = '';
  setLocale('es');
  expect(resolveLocale()).toBe('es');
});
```

---

## RTL Language Support

### Current Status

The system is **RTL-safe** but does not currently support RTL languages (Arabic, Hebrew, etc.).

### Adding RTL Support

To add RTL languages in the future:

#### 1. Add RTL Direction Detection

```typescript
// lib/i18n.ts
const RTL_LOCALES: Locale[] = ['ar', 'he'];

export function isRTL(locale: Locale): boolean {
  return RTL_LOCALES.includes(locale);
}
```

#### 2. Update Layout

```typescript
// app/layout.tsx
import { resolveLocale, isRTL } from '@/lib/i18n';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = resolveLocale();
  const direction = isRTL(locale) ? 'rtl' : 'ltr';

  return (
    <html lang={locale} dir={direction}>
      <body>{children}</body>
    </html>
  );
}
```

#### 3. Add RTL Styles

```css
/* globals.css */
[dir='rtl'] {
  text-align: right;
}

[dir='rtl'] .chat-message {
  flex-direction: row-reverse;
}
```

---

## Performance Considerations

### Bundle Size

Each translation file adds ~3-5KB to the bundle. With 5 languages, total overhead is ~15-25KB (compressed).

### Lazy Loading (Future Optimization)

For larger apps, implement lazy loading:

```typescript
// Instead of importing all at once
import en from '../i18n/en.json';

// Dynamically import only needed locale
const loadTranslations = async (locale: Locale) => {
  const translations = await import(`../i18n/${locale}.json`);
  return translations.default;
};
```

### Server-Side Resolution

For better initial page load, resolve locale server-side:

```typescript
// app/layout.tsx (server component)
import { cookies, headers } from 'next/headers';
import { getLocaleFromCookie } from '@/lib/i18n';

export default function RootLayout({ children }) {
  const initialLocale = getLocaleFromCookie(); // Server-side
  
  return (
    <html>
      <body>
        <LocaleProvider initialLocale={initialLocale}>
          {children}
        </LocaleProvider>
      </body>
    </html>
  );
}
```

---

## Migration Guide

### Updating Existing Components

#### Before (Hardcoded Text)
```typescript
export function MyComponent() {
  return (
    <div>
      <h1>Welcome</h1>
      <button>Send</button>
    </div>
  );
}
```

#### After (i18n)
```typescript
'use client';

import { useLocale } from '@/components/providers/LocaleProvider';

export function MyComponent() {
  const { t } = useLocale();
  
  return (
    <div>
      <h1>{t('common.welcome')}</h1>
      <button>{t('common.send')}</button>
    </div>
  );
}
```

### Adding New Translation Keys

1. Add key to all language files:

```json
// en.json
{
  "myFeature": {
    "title": "My Feature",
    "description": "This is my new feature"
  }
}

// pl.json
{
  "myFeature": {
    "title": "Moja funkcja",
    "description": "To jest moja nowa funkcja"
  }
}
```

2. Use in component:

```typescript
const { t } = useLocale();

<h2>{t('myFeature.title')}</h2>
<p>{t('myFeature.description')}</p>
```

---

## Troubleshooting

### Issue: Language not persisting after refresh

**Solution:** Check that localStorage and cookies are working:

```javascript
// In browser console
localStorage.getItem('openhouse_locale'); // Should show selected language
document.cookie; // Should include 'locale=pl'
```

### Issue: Missing translation shows key instead of text

**Symptom:** UI shows `chat.greeting` instead of translated text

**Solution:**
1. Check the translation key exists in `en.json`
2. Verify the translation file is properly formatted JSON
3. Check browser console for warnings: `Missing translation for key: ...`

### Issue: Wrong language detected from browser

**Solution:** Override with URL parameter:

```
http://localhost:5000/?lang=en
```

Then select desired language from UI selector.

### Issue: Component shows old translation after language change

**Symptom:** Some text remains in old language after switching

**Cause:** Component is not using `useLocale()` hook

**Solution:** Ensure component imports and uses the hook:

```typescript
'use client'; // Must be client component

import { useLocale } from '@/components/providers/LocaleProvider';

export function MyComponent() {
  const { t } = useLocale(); // Hook provides reactive translations
  // ...
}
```

---

## Developer Portal i18n

The developer portal has basic i18n support with English and Polish:

### Structure

```
apps/developer-portal/
├── i18n/
│   ├── en.json
│   └── pl.json
└── lib/
    └── i18n.ts
```

### Usage

Same API as tenant portal:

```typescript
import { useLocale } from '@/lib/i18n';

const { t, locale } = useLocale();
```

### Adding More Languages

Follow the same process as tenant portal (see "Adding New Languages" section above).

---

## Future Enhancements

### 1. Tenant-Specific Translations
Allow tenants to customize translations for their brand voice.

### 2. Dynamic Content Translation
Integrate with translation APIs to translate user-generated content (documents, announcements).

### 3. Language-Specific Fonts
Optimize typography for each language:

```typescript
const fontByLocale = {
  en: Inter,
  pl: Inter,
  ar: Cairo, // Arabic font
  ja: 'Noto Sans JP', // Japanese font
};
```

### 4. Pluralization Rules
Handle complex plural forms:

```json
{
  "messages": {
    "one": "You have 1 message",
    "other": "You have {count} messages"
  }
}
```

### 5. Date/Time Localization
Format dates according to locale:

```typescript
new Intl.DateTimeFormat(locale, {
  dateStyle: 'long',
  timeStyle: 'short'
}).format(new Date());
```

---

## Summary

✅ **Delivered:**
- 5 languages for tenant portal (EN, IE, PL, ES, FR)
- 2 languages for developer portal (EN, PL)
- Full i18n infrastructure with fallbacks
- Language selector UI component
- Professional translations for all UI strings
- Cookie + localStorage persistence
- URL parameter override support
- Browser language auto-detection
- PWA offline language support
- Comprehensive documentation

🚀 **Production Ready:**
- All hardcoded text migrated to i18n system
- Fallback mechanisms prevent missing translations
- SSR-compatible implementation
- Tenant-aware architecture ready for customization
- RTL-safe (ready for Arabic/Hebrew expansion)

---

**Last Updated:** November 15, 2025  
**Phase:** 19 — Multi-Language Support
