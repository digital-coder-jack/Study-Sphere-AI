/* =====================================================================
   Study Sphere AI  -  sw.js  (Progressive Web App service worker)
   ---------------------------------------------------------------------
   Strategy:
     * App shell (HTML/CSS/JS/icons) -> stale-while-revalidate cache.
     * API calls (/api/*)            -> network-only (never cached; they
                                        are user-specific + streaming).
     * Navigations offline           -> fall back to /offline.html.
   Bump CACHE_VERSION on every deploy to invalidate old caches and
   trigger the in-app "update available" notification.
   ===================================================================== */

const CACHE_VERSION = 'ss-cache-v3';
const OFFLINE_URL = '/offline.html';

const APP_SHELL = [
  '/',
  '/offline.html',
  '/dashboard',
  '/chat',
  '/tools',
  '/css/premium-design-system.css',
  '/css/style.css',
  '/css/responsive.css',
  '/js/config.js',
  '/js/app.js',
  '/js/pwa.js',
  '/assets/logo.png',
  '/assets/logo-192.png',
  '/assets/logo-512.png',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) =>
      // addAll fails the whole install if any single request 404s, so add
      // individually and ignore failures (some routes may not exist yet).
      Promise.allSettled(APP_SHELL.map((url) => cache.add(url)))
    )
  );
  // Activate the new worker as soon as it finishes installing.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

// Allow the page to tell a waiting worker to take over immediately.
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache API / streaming / cross-origin requests.
  if (url.pathname.startsWith('/api/') || url.origin !== self.location.origin) {
    return; // let the browser handle it normally
  }

  // Navigations: try network first, fall back to cache, then offline page.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || networkFetch;
    })
  );
});

// Background sync placeholder (queued actions can be flushed here).
self.addEventListener('sync', (event) => {
  if (event.tag === 'ss-sync') {
    event.waitUntil(Promise.resolve());
  }
});
