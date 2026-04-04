// High Rollers Poker — Service Worker (App Shell Cache)
const CACHE_NAME = "high-rollers-v1";

const APP_SHELL = [
  "/",
  "/index.html",
  "/manifest.json",
];

// Install: pre-cache the app shell
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL))
  );
  // Activate immediately instead of waiting for old SW to retire
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// Fetch: network-first for API/ws, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Never cache API calls, WebSocket upgrades, or hot-module-replacement
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/ws") ||
    url.pathname.includes("__vite") ||
    event.request.method !== "GET"
  ) {
    return; // Let the browser handle it normally
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      // Return cached version while fetching an update in the background
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cached); // If network fails, fall back to cache

      return cached || fetchPromise;
    })
  );
});
