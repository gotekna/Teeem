// Service Worker for Trapid Field - Offline Support
// Last updated: 2025-11-23 - Clear cached column choices API errors
const CACHE_VERSION = 'trapid-field-v8'
const STATIC_CACHE = `${CACHE_VERSION}-static`
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`
const API_CACHE = `${CACHE_VERSION}-api`

// Assets to cache immediately on install
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json'
]

// API routes to cache for offline use
const CACHEABLE_API_ROUTES = [
  '/api/v1/constructions',
  '/api/v1/sm_tasks'
]

// Install event - cache static assets
self.addEventListener('install', (event) => {
  console.log('[SW] Installing service worker...')
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then((cache) => {
        console.log('[SW] Caching static assets')
        return cache.addAll(STATIC_ASSETS)
      })
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...')
  event.waitUntil(
    caches.keys()
      .then((keys) => {
        return Promise.all(
          keys
            .filter((key) => key.startsWith('trapid-field-') && key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== API_CACHE)
            .map((key) => {
              console.log('[SW] Removing old cache:', key)
              return caches.delete(key)
            })
        )
      })
      .then(() => self.clients.claim())
  )
})

// Fetch event - serve from cache, fall back to network
self.addEventListener('fetch', (event) => {
  const { request } = event
  const url = new URL(request.url)

  // In development, don't intercept API calls to the backend
  // Service workers intercept ALL fetch requests, even to different origins
  // We must let requests to the local backend pass through without caching/offline handling
  // This applies to both direct backend calls (port 3000) and Vite proxy calls (port 5173)
  if (url.hostname === 'localhost' && url.pathname.startsWith('/api/')) {
    // Don't call event.respondWith() - let the request pass through naturally
    return
  }

  // Skip non-GET requests (POST, PUT, DELETE go to network)
  if (request.method !== 'GET') {
    // Queue failed POST requests for later sync
    if (!navigator.onLine && request.method === 'POST' && url.pathname.includes('/api/v1/sm_field/')) {
      event.respondWith(
        new Response(JSON.stringify({
          success: true,
          offline: true,
          message: 'Queued for sync when online'
        }), {
          headers: { 'Content-Type': 'application/json' }
        })
      )
      return
    }
    return
  }

  // API requests - network first, cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstStrategy(request, API_CACHE))
    return
  }

  // NEVER cache Vite dev source files (jsx, tsx, ts) - let Vite handle them
  if (url.pathname.match(/\.(jsx|tsx|ts)$/) || url.pathname.includes('/src/pages/') || url.pathname.includes('/src/components/')) {
    // Don't intercept - let request go through naturally to Vite dev server
    return
  }

  // Static assets - cache first, network fallback
  if (isStaticAsset(url.pathname)) {
    event.respondWith(cacheFirstStrategy(request, STATIC_CACHE))
    return
  }

  // HTML pages - network first for fresh content
  if (request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(networkFirstStrategy(request, DYNAMIC_CACHE))
    return
  }

  // Everything else - stale while revalidate
  event.respondWith(staleWhileRevalidate(request, DYNAMIC_CACHE))
})

// Cache-first strategy
async function cacheFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  if (cached) {
    return cached
  }

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    console.log('[SW] Cache-first failed:', error)
    return new Response('Offline', { status: 503 })
  }
}

// Network-first strategy
async function networkFirstStrategy(request, cacheName) {
  const cache = await caches.open(cacheName)

  try {
    const response = await fetch(request)
    if (response.ok) {
      cache.put(request, response.clone())
    }
    return response
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', request.url)
    const cached = await cache.match(request)
    if (cached) {
      return cached
    }

    // Return offline response for API requests
    if (request.url.includes('/api/')) {
      return new Response(JSON.stringify({
        success: false,
        offline: true,
        error: 'You are offline'
      }), {
        status: 503,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    return new Response('Offline', { status: 503 })
  }
}

// Stale-while-revalidate strategy
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName)
  const cached = await cache.match(request)

  const fetchPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone())
      }
      return response
    })
    .catch(() => null)

  return cached || fetchPromise
}

// Check if URL is a static asset
function isStaticAsset(pathname) {
  return /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/i.test(pathname)
}

// Background sync for offline data
self.addEventListener('sync', (event) => {
  console.log('[SW] Background sync:', event.tag)

  if (event.tag === 'sm-field-sync') {
    event.waitUntil(syncOfflineData())
  }
})

// Sync offline data when back online
async function syncOfflineData() {
  // This triggers the frontend to sync its localStorage queue
  const clients = await self.clients.matchAll()
  clients.forEach((client) => {
    client.postMessage({ type: 'SYNC_OFFLINE_DATA' })
  })
}

// Push notifications (for future use)
self.addEventListener('push', (event) => {
  if (!event.data) return

  const data = event.data.json()
  const options = {
    body: data.body,
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/'
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || 'Trapid', options)
  )
})

// Notification click handler
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  event.waitUntil(
    self.clients.openWindow(event.notification.data.url)
  )
})

console.log('[SW] Service worker loaded')
