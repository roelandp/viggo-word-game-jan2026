// sw.js
// Service Worker voor caching van de app-bestanden.
// Zorgt ervoor dat de app offline speelbaar is zodra geladen.

const CACHE_NAME = 'grillworstje-v2';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './words.js',
  './manifest.webmanifest',
  './assets/icon-192.png',
  './assets/icon-512.png'
  // Voeg evt. grillworstje.png toe als je een afbeelding gebruikt
];

// Install event: cache de bestanden en forceer directe activatie
self.addEventListener('install', event => {
  self.skipWaiting(); // Forceer directe activatie van wachtende updates
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event: serve from cache first, fallback to network
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      })
  );
});

// Activate event: clean up old caches en claim alle clients
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      return self.clients.claim(); // Neem controle over alle clients
    })
  );
});