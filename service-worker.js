/**
 * Mind Dump - Service Worker
 * Cache-first strategy for offline support. A version is one atomic cache:
 * everything in ASSETS_TO_CACHE is fetched together at install and served as-is until the
 * page accepts the next version (no per-file background refresh, so HTML and modules never mix
 * versions).
 *
 * Every file the app needs offline must be listed in ASSETS_TO_CACHE
 * (tests/service-worker.test.js enforces this). Bump CACHE_NAME on every release that changes
 * a cached file: that is what makes the browser install a new version and the page offer it.
 * Paths are relative so the app also works when served from a sub-path.
 */

const CACHE_NAME = 'mind-dump-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './styles/app.css',
  './vendor/bootstrap/bootstrap.min.css',
  './vendor/bootstrap/bootstrap.bundle.min.js',
  './src/main.js',
  './src/categories.js',
  './src/render.js',
  './src/storage.js',
  './src/toast.js',
  './src/ui.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Navigations reject cached responses that came through a redirect, so store a clean copy.
async function cleanResponse(response) {
  if (!response.redirected) return response;
  const body = await response.blob();
  return new Response(body, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers
  });
}

// Install: all-or-nothing. If any asset fails, the new version is not installed
// and the previous one keeps serving, instead of activating half-cached.
async function precache() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(ASSETS_TO_CACHE.map(async (url) => {
    const response = await fetch(url, { cache: 'reload' });
    if (!response.ok) throw new Error(`Failed to precache ${url}: ${response.status}`);
    await cache.put(url, await cleanResponse(response));
  }));
}

self.addEventListener('install', (event) => {
  // No skipWaiting() here: the page asks for it when the user accepts the update.
  event.waitUntil(precache());
});

// Activate: drop caches from older versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch: cache-first, refreshed in the background
self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => cached || fetchAndCache(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request)
      .then((cached) => cached || fetchAndCache(request))
      .catch(() => {
        if (request.destination === 'image') {
          return new Response(
            '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect fill="#ddd" width="100" height="100"/></svg>',
            { headers: { 'Content-Type': 'image/svg+xml' } }
          );
        }
        return new Response('Offline', { status: 503 });
      })
  );
});

// Only reached for URLs that are not part of the precached version (the precache always wins),
// so an active cache never has individual files swapped under a running page.
function fetchAndCache(request) {
  return fetch(request).then((response) => {
    if (!response || response.status !== 200) return response;

    const copy = response.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
    return response;
  });
}

// Messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
