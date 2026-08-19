const CACHE_NAME = "pmc-management-pwa-v3";

const APP_SHELL = [
  "./",
  "./index.html",
  "./app-config.js",
  "./api-shim.js",
  "./manifest.webmanifest",
  "./icons/pmc-app-192-v3.png",
  "./icons/pmc-app-512-v3.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const req = event.request;
  const url = new URL(req.url);

  // Only handle GET requests from this app
  if (req.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Navigation requests:
  // Try the latest online index first.
  // If offline, use the cached version.
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put("./index.html", copy);
          });

          return response;
        })
        .catch(() => caches.match("./index.html"))
    );

    return;
  }

  // Other app files:
  // Use cache first, then network.
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) {
        return cached;
      }

      return fetch(req).then(response => {
        const copy = response.clone();

        caches.open(CACHE_NAME).then(cache => {
          cache.put(req, copy);
        });

        return response;
      });
    })
  );
});
