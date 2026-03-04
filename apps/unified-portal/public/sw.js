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
