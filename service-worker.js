/**
 * Mind Dump - Service Worker
 * Cache-first strategy for offline support
 */

const CACHE_NAME = 'mind-dump-v2';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/manifest.json',
  '/styles/app.css',
  '/src/main.js',
  '/src/ui.js',
  '/src/storage.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// External CDN assets to cache
const CDN_ASSETS = [
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css',
  'https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/js/bootstrap.bundle.min.js'
];

// Install event - cache all essential assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[SW] Caching app assets');
        // Cache local assets
        const localCaching = cache.addAll(ASSETS_TO_CACHE);
        
        // Cache CDN assets (may fail if offline during install)
        const cdnCaching = Promise.allSettled(
          CDN_ASSETS.map(url => 
            fetch(url)
              .then(response => {
                if (response.ok) {
                  return cache.put(url, response);
                }
              })
              .catch(err => console.log('[SW] CDN cache failed:', url, err))
          )
        );
        
        return Promise.all([localCaching, cdnCaching]);
      })
      .then(() => {
        console.log('[SW] All assets cached');
        // Skip waiting to activate immediately
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[SW] Cache failed:', error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  
  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames
            .filter((name) => name !== CACHE_NAME)
            .map((name) => {
              console.log('[SW] Deleting old cache:', name);
              return caches.delete(name);
            })
        );
      })
      .then(() => {
        console.log('[SW] Service worker activated');
        // Take control of all pages immediately
        return self.clients.claim();
      })
  );
});

// Fetch event - cache-first strategy
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return;
  }
  
  // Handle navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match('/index.html')
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Return cached index.html but also update cache in background
            fetchAndCache(request);
            return cachedResponse;
          }
          return fetchAndCache(request);
        })
        .catch(() => {
          return caches.match('/index.html');
        })
    );
    return;
  }
  
  // Handle other requests with cache-first strategy
  event.respondWith(
    caches.match(request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // Return cached version, update in background
          if (isLocalAsset(url)) {
            fetchAndCache(request);
          }
          return cachedResponse;
        }
        
        // Not in cache, fetch from network
        return fetchAndCache(request);
      })
      .catch(() => {
        // Offline and not in cache
        console.log('[SW] Fetch failed, offline:', request.url);
        
        // Return a fallback for images
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

// Helper: Check if URL is a local asset
function isLocalAsset(url) {
  return url.origin === self.location.origin;
}

// Helper: Fetch and update cache
function fetchAndCache(request) {
  return fetch(request)
    .then((response) => {
      // Don't cache non-successful responses
      if (!response || response.status !== 200) {
        return response;
      }
      
      // Clone the response for caching
      const responseToCache = response.clone();
      
      caches.open(CACHE_NAME)
        .then((cache) => {
          cache.put(request, responseToCache);
        });
      
      return response;
    });
}

// Listen for messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});
