# Agent Task: Care Polish Items 5-11

Work in `apps/unified-portal/`. Make all these changes carefully, run typecheck at the end, fix errors, then commit and notify.

---

## CHANGE 5: Conversation history in AssistantScreen

File: `app/care/[installationId]/screens/AssistantScreen.tsx`

Currently the chat starts fresh every time. Add a conversation history sidebar/list at the top of the screen.

Read the full AssistantScreen.tsx first to understand the existing state and structure.

Add a "Past Conversations" section above the chat input area (or as a collapsible panel at the top of the screen). When the screen mounts, fetch from Supabase:

Add a `useEffect` that on mount calls `/api/care/conversations?installation_id=${installationId}` — create this API endpoint too.

### Create `app/api/care/conversations/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const installationId = searchParams.get('installation_id');
  if (!installationId) return NextResponse.json({ conversations: [] });

  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('care_conversations')
    .select('id, title, message_count, created_at, updated_at')
    .eq('installation_id', installationId)
    .order('updated_at', { ascending: false })
    .limit(10);

  return NextResponse.json({ conversations: data || [] });
}
```

In AssistantScreen, add state: `const [conversations, setConversations] = useState<any[]>([])` and `const [showHistory, setShowHistory] = useState(false)`.

Add a small "History" icon button in the header area of the chat. When clicked, toggles a compact dropdown/panel showing past conversations (title, time ago). Clicking a past conversation sets the `conversation_id` state so the chat continues that thread. Keep the UI minimal — just a clock icon button that reveals a list. If no past conversations, show "No previous conversations."

---

## CHANGE 6: Fix hardcoded "System Healthy" badge

File: `app/care/[installationId]/screens/HomeScreen.tsx`

The status badge always shows emerald green "System Healthy" regardless of actual health_status.

Find the status badge section (it has `bg-emerald-500` dot and `text-emerald-600` text saying "System Healthy").

Replace it with dynamic logic:

```tsx
const healthConfig = {
  healthy: { dot: 'bg-emerald-500', text: 'text-emerald-600', label: 'System Healthy' },
  degraded: { dot: 'bg-amber-500', text: 'text-amber-600', label: 'Performance Degraded' },
  fault: { dot: 'bg-red-500', text: 'text-red-600', label: 'System Fault' },
};
const hc = healthConfig[installation.health_status as keyof typeof healthConfig] || healthConfig.healthy;
```

Then use `hc.dot`, `hc.text`, `hc.label` in the badge. Also change the top gradient bar on the system status card:
- healthy → `from-emerald-400 via-emerald-500 to-teal-500` (keep as is)
- degraded → `from-amber-400 via-amber-500 to-orange-400`
- fault → `from-red-400 via-red-500 to-rose-500`

---

## CHANGE 7: Fix hardcoded roof pitch in ProfileScreen

File: `app/care/[installationId]/screens/ProfileScreen.tsx`

Find the Equipment details list. The "Roof Pitch" item has a hardcoded value of `'35°'`.

Change it to: `installation.system_specs.roof_pitch ? installation.system_specs.roof_pitch + '°' : 'Not recorded'`

Also check the "System Orientation" item — it falls back to `'South-facing'` which is fine, but also add a fallback for if `system_specs` is undefined by using `installation.system_specs?.roof_orientation || 'Not recorded'`.

---

## CHANGE 8: Functional search in Guides screen

File: `app/care/[installationId]/screens/GuidesScreen.tsx`

The search bar is purely decorative. Make it functional:

1. Add `const [searchQuery, setSearchQuery] = useState('');` 
2. Wire the search bar input: replace the static `<span>` placeholder with an actual `<input>` element that updates `searchQuery` on change.
3. Filter the guide items: when `searchQuery` is not empty, filter `videoGuides`, `documents`, and `troubleshooting` arrays to only show items where `title.toLowerCase().includes(searchQuery.toLowerCase())`.
4. If search returns no results across all sections, show a simple "No results for '{query}'" message.
5. Style the input to match the existing container (no border, transparent background, same font/color as the placeholder).

---

## CHANGE 9: Wire Care Dashboard Intelligence to real system types

File: `app/care-dashboard/intelligence/intelligence-client.tsx`

Near the top of the file there's `MOCK_SYSTEM_TYPES` — a hardcoded array of system types used to filter the chat context.

Replace the mock with a `useEffect` that fetches distinct system types from the installations:

```ts
// Add to state
const [systemTypes, setSystemTypes] = useState(MOCK_SYSTEM_TYPES); // keep mock as default

// Add useEffect
useEffect(() => {
  fetch('/api/care/system-types')
    .then(r => r.json())
    .then(data => { if (data.systemTypes?.length) setSystemTypes(data.systemTypes); })
    .catch(() => {}); // silently fall back to mock
}, []);
```

Create `app/api/care/system-types/route.ts`:

```ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export async function GET() {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('installations')
    .select('system_type')
    .eq('is_active', true);

  const unique = [...new Set((data || []).map((r: any) => r.system_type).filter(Boolean))];
  const systemTypes = unique.map((t: string) => ({
    id: t,
    name: t.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }));

  // Always include core types
  const base = [
    { id: 'solar_pv', name: 'Solar PV' },
    { id: 'heat_pump', name: 'Heat Pump' },
    { id: 'ev_charger', name: 'EV Charger' },
    { id: 'battery_storage', name: 'Battery Storage' },
  ];
  const merged = [...base, ...systemTypes.filter(t => !base.find(b => b.id === t.id))];

  return NextResponse.json({ systemTypes: merged });
}
```

---

## CHANGE 10: Add service worker for offline support

Create `apps/unified-portal/public/sw.js`:

```js
const CACHE_NAME = 'openhouse-care-v1';
const STATIC_ASSETS = [
  '/branding/openhouse-ai-logo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  // Only cache GET requests for care routes
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (!url.pathname.startsWith('/care')) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (url.pathname.match(/\.(png|jpg|svg|ico|woff2?)$/))) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // Return cached version if offline
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;
          // Return offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return new Response(
              `<!DOCTYPE html><html><head><meta charset="utf-8"><title>OpenHouse Care</title></head><body style="font-family:sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#fafafa;"><div style="text-align:center;padding:2rem;"><h2 style="color:#1a1a1a;">You're offline</h2><p style="color:#888;">Your care portal will be available when you reconnect.</p></div></body></html>`,
              { headers: { 'Content-Type': 'text/html' } }
            );
          }
        });
      })
  );
});
```

Register it in `app/care/[installationId]/layout.tsx`. After the existing imports, add a client component for SW registration:

Create `app/care/sw-register.tsx`:
```tsx
'use client';
import { useEffect } from 'react';
export function SWRegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
  }, []);
  return null;
}
```

Import and render `<SWRegister />` inside the `CareAppProvider` in `app/care/[installationId]/layout.tsx`. Since layout.tsx is a server component, you can add `<SWRegister />` as a child alongside `{children}` inside the `CareAppProvider`. The CareAppProvider already wraps children so you need to check how it renders and add SWRegister as a sibling inside the provider's children.

Actually, simpler: add the SWRegister as a direct child in layout.tsx's return:
```tsx
return (
  <CareAppProvider installationId={installationId} installation={installationData}>
    <SWRegister />
    {children}
  </CareAppProvider>
);
```

---

## After ALL changes:

1. Run `npm run typecheck` and fix any new TypeScript errors introduced by these changes (ignore pre-existing errors).
2. Run: `git add -A && git commit -m 'feat: care polish - conversation history, dynamic health badge, search, offline SW, real system types'`
3. Run: `openclaw system event --text "Done: Care polish changes 5-10 complete" --mode now`
