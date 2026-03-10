/**
 * Service Worker for offline inspection support.
 *
 * Caches inspection API responses and photo blobs for offline access.
 * Uses Cache API for network responses and delegates to IndexedDB for
 * structured data via the main thread.
 */

const CACHE_NAME = "teeem-inspections-v1";

// API routes to cache for offline
const CACHEABLE_PATTERNS = [
  /\/api\/v1\/property_inspections\/\d+$/,
  /\/api\/v1\/property_inspections\/\d+\/inspection_rooms/,
  /\/api\/v1\/storage_blobs\/\d+\/download/,
  /\/api\/v1\/inspection_room_templates$/,
];

// Install: pre-cache shell assets
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Pre-cache minimal assets for offline shell
      return cache.addAll([
        "/offline.html",
      ]).catch(() => {
        // offline.html may not exist yet, that's ok
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name.startsWith("teeem-inspections-") && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch: network-first with cache fallback for inspection data
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);

  // Only intercept matching API requests
  const isCacheable = CACHEABLE_PATTERNS.some((pattern) => pattern.test(url.pathname));

  if (!isCacheable) return;

  // Only cache GET requests
  if (event.request.method !== "GET") return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, clone);
          });
        }
        return response;
      })
      .catch(() => {
        // Network failed, try cache
        return caches.match(event.request).then((cached) => {
          if (cached) return cached;

          // Return offline fallback for navigation requests
          if (event.request.mode === "navigate") {
            return caches.match("/offline.html");
          }

          // Return error response for API calls
          return new Response(
            JSON.stringify({ success: false, error: "Offline - data not cached" }),
            {
              status: 503,
              headers: { "Content-Type": "application/json" },
            }
          );
        });
      })
  );
});

// Background sync: process queued updates when back online
self.addEventListener("sync", (event) => {
  if (event.tag === "inspection-sync") {
    event.waitUntil(
      // Notify the main thread to process the sync queue
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => {
          client.postMessage({ type: "INSPECTION_SYNC_REQUESTED" });
        });
      })
    );
  }
});

// Handle messages from main thread
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
