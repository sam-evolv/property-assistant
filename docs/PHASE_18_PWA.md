# Phase 18: PWA Packaging for iOS + Android

**Status:** Complete  
**Date:** November 15, 2025  
**Goal:** Make OpenHouse AI installable as a native-feeling Progressive Web App

---

## Overview

Phase 18 transforms the tenant portal into a fully functional Progressive Web App (PWA) that can be installed on iOS and Android devices. Users get a native app experience with offline support, home screen installation, and optimized performance.

---

## Deliverables

### 1. Web App Manifest ✅

**File:** `apps/tenant-portal/public/manifest.json`

Complete PWA manifest with:
- ✅ App name and description
- ✅ Display mode: standalone
- ✅ Theme color: #1A73E8 (customizable per tenant)
- ✅ Icons (192px, 512px, maskable)
- ✅ App shortcuts (quick actions)
- ✅ Categories and metadata

```json
{
  "name": "OpenHouse AI - Property Assistant",
  "short_name": "OpenHouse",
  "description": "AI-powered property assistant for homeowners",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#1A73E8",
  "icons": [...]
}
```

---

### 2. PWA Icons ✅

**Location:** `apps/tenant-portal/public/icons/`

Generated icons:
- ✅ `icon-192.png` - Standard icon (192×192)
- ✅ `icon-512.png` - High-res icon (512×512)
- ✅ `maskable-icon.png` - Maskable icon for Android adaptive icons
- ✅ `apple-touch-icon.png` - iOS home screen icon

**Icon Design:**
- Modern minimalist design
- Blue gradient (#1A73E8)
- House silhouette with AI circuit elements
- Professional, trustworthy aesthetic
- Optimized for small sizes

---

### 3. Service Worker ✅

**File:** `apps/tenant-portal/public/sw.js`

Advanced caching strategies:

**Cache-First Strategy** (Static Assets):
- Next.js static files (`/_next/static/`)
- Images (png, jpg, svg, webp)
- CSS and JavaScript files
- Icons and manifest

**Network-First Strategy** (Dynamic Content):
- API endpoints (`/api/`)
- Chat interface
- Onboarding flows
- Real-time data

**Features:**
- ✅ Automatic cache versioning
- ✅ Old cache cleanup on activation
- ✅ Offline fallback page
- ✅ Update notifications
- ✅ Skip waiting support
- ✅ Clear cache command

**Cache Management:**
```javascript
const CACHE_VERSION = 'v1';
const CACHE_NAME = `openhouse-${CACHE_VERSION}`;

// Precached on install
const PRECACHE_URLS = ['/', '/offline', '/icons/...'];
```

---

### 4. Service Worker Registration ✅

**File:** `apps/tenant-portal/components/providers/PWAProvider.tsx`

Client-side service worker management:
- ✅ Automatic registration on mount
- ✅ Update checking every 60 seconds
- ✅ User notification for updates
- ✅ Graceful error handling

**Usage:**
```tsx
<PWAProvider>
  <App />
</PWAProvider>
```

---

### 5. Offline Fallback Page ✅

**File:** `apps/tenant-portal/app/offline/page.tsx`

User-friendly offline experience:
- ✅ Clear offline indicator
- ✅ Helpful messaging
- ✅ Retry button
- ✅ Tips for cached content
- ✅ Professional design

**Features:**
- Wi-Fi icon with alert badge
- Explanation of offline mode
- "Try Again" button (reloads page)
- Mobile-optimized layout

---

### 6. iOS-Specific Meta Tags ✅

**Location:** `apps/tenant-portal/app/layout.tsx`

Critical iOS PWA support:
- ✅ `apple-mobile-web-app-capable="yes"`
- ✅ `apple-mobile-web-app-status-bar-style="default"`
- ✅ `apple-touch-icon` link
- ✅ App title for iOS
- ✅ Viewport optimization

**Metadata Configuration:**
```typescript
export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'OpenHouse',
  },
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192.png',
    apple: '/icons/apple-touch-icon.png',
  },
};
```

---

## Installation Instructions

### iOS (Safari)

1. Open https://app.openhouseai.ie in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Edit the name if desired
5. Tap **"Add"**

The app will appear on your home screen like a native app.

**iOS Limitations:**
- Background refresh limited
- Push notifications not supported
- Web Bluetooth limited
- Cache size limits (~50MB)

---

### Android (Chrome)

1. Open https://app.openhouseai.ie in Chrome
2. Tap the **⋮** menu button
3. Select **"Install app"** or **"Add to Home Screen"**
4. Tap **"Install"**

Alternatively, Chrome may show an install banner automatically.

**Android Features:**
- Full service worker support
- Background sync capable
- Larger cache limits
- Web Bluetooth support

---

### Desktop (Chrome/Edge)

1. Open https://app.openhouseai.ie
2. Look for the **install icon** in the address bar (⊕ or ⬇)
3. Click **"Install"**

The app will open in its own window without browser chrome.

---

## PWA Features

### Offline Support ✅

**What Works Offline:**
- Previously viewed pages (cached)
- Static assets (icons, CSS, JS)
- Offline fallback page
- Service worker logic

**What Requires Connection:**
- API calls (chat, documents)
- First-time page loads
- User authentication
- Real-time data

**Cache Strategy:**
```
Static Assets → Cache-First
API Endpoints → Network-First (with cache fallback)
Navigation → Network-First → Offline Page
```

---

### Update Mechanism ✅

**Automatic Updates:**
1. Service worker checks for updates every 60 seconds
2. When new version detected, prompts user
3. User confirms → new SW installed
4. Page reloads with latest version

**Manual Cache Clear:**
```javascript
// Send message to service worker
navigator.serviceWorker.controller.postMessage({
  type: 'CLEAR_CACHE'
});
```

---

### Performance Benefits

**Instant Loading:**
- Cached assets load instantly
- No network delay for static files
- Smoother page transitions

**Reduced Data Usage:**
- Static assets cached locally
- Only dynamic content fetched
- Optimized image delivery

**Better UX:**
- Works in low/no connectivity
- Faster perceived performance
- Native app feel

---

## Cache Invalidation Strategy

### Versioned Caches

Each deployment gets a new cache version:
```javascript
const CACHE_VERSION = 'v1'; // Increment: v2, v3, etc.
```

**On Activate:**
- Old caches automatically deleted
- Only current version kept
- Prevents cache bloat

### Manual Invalidation

**Development:**
```bash
# Clear browser cache
Shift + Cmd + R (Mac)
Ctrl + Shift + R (Windows/Linux)
```

**Production:**
1. Increment `CACHE_VERSION` in sw.js
2. Deploy new service worker
3. Users auto-update on next visit

---

## Tenant Theme Integration ✅

### Dynamic Theme Color

**Implemented:** Dynamic manifest generation via `app/manifest.ts`

The manifest is now generated dynamically per tenant request:

```typescript
// app/manifest.ts
export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const headersList = headers();
  const host = headersList.get('host') || '';
  
  // Extract tenant from subdomain
  const subdomain = host.split('.')[0];
  
  // Resolve tenant and get theme
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, subdomain),
  });
  
  return {
    name: `${tenant.name} - Property Assistant`,
    theme_color: tenant.theme_color || '#1A73E8',
    ...
  };
}
```

**How It Works:**
1. Next.js serves dynamic `/manifest.webmanifest` route
2. Manifest function resolves tenant from subdomain in hostname
3. Queries database for tenant's `theme_color` field
4. Returns customized manifest with tenant branding
5. Browser caches manifest per origin (automatic multi-tenancy)

**Example:**
- `longview-estates.app.openhouseai.ie` → Longview theme color
- `sunrise-villas.app.openhouseai.ie` → Sunrise theme color
- Each tenant gets their own branded PWA experience

---

## Lighthouse PWA Checklist

### Required (✅ = Implemented)

- ✅ **Web app manifest** - Valid manifest.json
- ✅ **Service worker** - Registered and active
- ✅ **HTTPS** - Enforced in production
- ✅ **Viewport meta tag** - Mobile-optimized
- ✅ **Icons** - 192px and 512px provided
- ✅ **Theme color** - Set in manifest and meta
- ✅ **Display mode** - Standalone
- ✅ **Start URL** - Valid and responds 200

### Recommended (✅ = Implemented)

- ✅ **Maskable icon** - Adaptive icon for Android
- ✅ **Apple touch icon** - iOS home screen
- ✅ **Offline fallback** - /offline page
- ✅ **Cache strategy** - Proper caching
- ⚠️ **Update prompt** - Implemented (could be enhanced)
- ⚠️ **Shortcuts** - Basic shortcuts added

### Target Score

**Expected Lighthouse PWA Score:** ≥ 95/100

**How to Test:**
1. Open DevTools in Chrome
2. Go to Lighthouse tab
3. Select "Progressive Web App"
4. Click "Analyze page load"
5. Review results

---

## Troubleshooting

### Service Worker Not Registering

**Symptoms:**
- Console shows SW registration error
- Offline mode doesn't work
- No install prompt

**Solutions:**
```javascript
// Check registration
navigator.serviceWorker.getRegistration().then(reg => {
  console.log('SW registered:', !!reg);
});

// Unregister and retry
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => reg.unregister());
});
```

---

### iOS Install Not Working

**Common Issues:**
1. **Not using Safari** - Must use Safari browser
2. **Not HTTPS** - PWA requires HTTPS (localhost exempt)
3. **Missing meta tags** - Verify apple-mobile-web-app tags
4. **Manifest invalid** - Check manifest.json syntax

**Verify:**
```bash
# Check manifest is accessible
curl https://app.openhouseai.ie/manifest.json

# Verify icons exist
curl -I https://app.openhouseai.ie/icons/apple-touch-icon.png
```

---

### Cache Not Updating

**Problem:** Old content still showing after deployment

**Solution:**
1. Increment CACHE_VERSION in sw.js
2. Deploy changes
3. Users will auto-update on next visit

**Force Update:**
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => {
    reg.update();
    reg.unregister();
  });
  location.reload();
});
```

---

### Offline Page Not Showing

**Check:**
1. Service worker active
2. `/offline` route exists
3. Offline page precached
4. Network truly offline (not just slow)

**Test Offline:**
1. Chrome DevTools → Application
2. Service Workers → Offline checkbox
3. Navigate to page
4. Should see offline fallback

---

## Known Limitations

### iOS Safari
- ❌ Push notifications not supported
- ❌ Background sync limited
- ❌ Web Bluetooth limited
- ⚠️ Cache size ~50MB limit
- ⚠️ No install banner (manual only)

### Android Chrome
- ✅ Full PWA support
- ✅ Push notifications work
- ✅ Background sync available
- ⚠️ Some manufacturers restrict background

### Desktop
- ✅ Full PWA support on Chrome/Edge
- ❌ Firefox limited PWA support
- ❌ Safari (Mac) no install support

---

## Performance Metrics

### Expected Load Times

**First Visit (No Cache):**
- Initial load: 2-3s
- API data: 1-2s
- Total: 3-5s

**Repeat Visit (Cached):**
- Initial load: <500ms
- API data: 1-2s
- Total: 1.5-2.5s

**Offline:**
- Cached pages: <100ms
- Offline fallback: <100ms

### Cache Size

**Typical Cache:**
- Static assets: 2-5MB
- Icons: 500KB
- Fonts: 200KB
- **Total: ~3-6MB**

**Maximum:**
- iOS: ~50MB
- Android: ~100MB (device dependent)
- Desktop: ~500MB

---

## Future Enhancements

### Phase 18.1 (Planned)
- [ ] **Push Notifications** - For chat replies
- [ ] **Background Sync** - Queue messages offline
- [ ] **Share Target** - Share to app
- [ ] **File Handling** - Open documents

### Phase 18.2 (Planned)
- [ ] **Dynamic Manifest** - Per-tenant themes
- [ ] **Custom Splash Screens** - Tenant branding
- [ ] **App Shortcuts** - Context menus
- [ ] **Badge API** - Unread message counts

### Phase 18.3 (Planned)
- [ ] **Periodic Background Sync** - Auto-fetch updates
- [ ] **Web Push** - Real-time notifications
- [ ] **Advanced Caching** - Predictive prefetch
- [ ] **Workbox Integration** - Advanced strategies

---

## References

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Web App Manifest](https://web.dev/add-manifest/)
- [iOS PWA Support](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/ConfiguringWebApplications/ConfiguringWebApplications.html)
- [Lighthouse PWA Audit](https://web.dev/lighthouse-pwa/)

---

**Document Version:** 1.0  
**Last Updated:** November 15, 2025  
**Status:** PWA Implementation Complete
