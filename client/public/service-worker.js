// Service Worker for Cloud Camera PWA

const CACHE_NAME = 'cloud-camera-v1';

// Assets to cache on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon-192x192.svg',
  '/icons/icon-512x512.svg',
  '/icons/apple-touch-icon.svg'
];

// Install event - cache static assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('Caching static assets');
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => {
        return Promise.all(
          cacheNames.filter(cacheName => {
            return cacheName !== CACHE_NAME;
          }).map(cacheName => {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          })
        );
      })
      .then(() => self.clients.claim())
  );
});

// Fetch event - serve from cache or network
self.addEventListener('fetch', event => {
  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin) && 
      !event.request.url.includes('cdnjs.cloudflare.com')) {
    return;
  }
  
  // Handle GET requests
  if (event.request.method === 'GET') {
    event.respondWith(
      caches.match(event.request)
        .then(cachedResponse => {
          if (cachedResponse) {
            return cachedResponse;
          }
          
          return fetch(event.request)
            .then(response => {
              // Don't cache if response is not valid
              if (!response || response.status !== 200 || response.type !== 'basic') {
                return response;
              }
              
              // Clone response to cache and return
              const responseToCache = response.clone();
              caches.open(CACHE_NAME)
                .then(cache => {
                  cache.put(event.request, responseToCache);
                });
              
              return response;
            })
            .catch(() => {
              // Return fallback for HTML
              if (event.request.headers.get('accept').includes('text/html')) {
                return caches.match('/index.html');
              }
              // Return fallback for images
              if (event.request.url.match(/\.(jpg|jpeg|png|gif|svg)$/)) {
                return new Response(
                  '<svg width="400" height="300" xmlns="http://www.w3.org/2000/svg">' +
                  '<text x="50%" y="50%" font-family="sans-serif" font-size="24" text-anchor="middle">' +
                  'Image Unavailable Offline' +
                  '</text></svg>',
                  { 
                    headers: {'Content-Type': 'image/svg+xml'} 
                  }
                );
              }
            });
        })
    );
  }
});

// Background sync for media uploads
self.addEventListener('sync', event => {
  if (event.tag === 'sync-media') {
    event.waitUntil(syncMedia());
  }
});

// Check for pending uploads and try to upload them
function syncMedia() {
  return new Promise((resolve, reject) => {
    // This would normally handle the background upload process
    // For simplicity, we're using localStorage in the main app
    // This is a placeholder for potential future implementation
    
    // Send a message to clients that sync is happening
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'SYNC_STARTED'
        });
      });
    });
    
    // Resolve to indicate sync was successful
    // In a real implementation, we would check localStorage, upload media, then resolve
    resolve();
  });
}

// Listen for messages from the client
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
