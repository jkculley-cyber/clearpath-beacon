// Beacon Service Worker — v2 (notification support)
// Network-first for HTML/JS/CSS, stale-while-revalidate for images/fonts
const CACHE_NAME = 'beacon-v2';

// Install — no precaching, just activate immediately
self.addEventListener('install', () => self.skipWaiting());

// Activate — clean old caches, claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — strategy based on request type
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and cross-origin
  if (request.method !== 'GET' || url.origin !== location.origin) return;

  // HTML pages — network first, fall back to cache
  if (request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html')) {
    event.respondWith(
      fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request).then((r) => r || caches.match('/')))
    );
    return;
  }

  // JS/CSS — network first with cache fallback
  if (url.pathname.endsWith('.js') || url.pathname.endsWith('.css')) {
    event.respondWith(
      fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      }).catch(() => caches.match(request))
    );
    return;
  }

  // Images/fonts/icons — stale-while-revalidate
  if (/\.(png|jpg|jpeg|svg|ico|woff2?|ttf|eot)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        });
        return cached || networkFetch;
      })
    );
    return;
  }

  // Everything else — network first
  event.respondWith(
    fetch(request).catch(() => caches.match(request))
  );
});

// Notification click — focus or open Beacon and navigate to the target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) client.navigate(targetUrl).catch(() => {});
          return;
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
    })
  );
});

// Receive scheduling messages from the page (the page is the only scheduler in v1)
self.addEventListener('message', (event) => {
  if (event.data?.type === 'BEACON_NOTIFY') {
    const { title, body, url } = event.data;
    self.registration.showNotification(title || 'Beacon Reminder', {
      body: body || '',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: event.data.tag || 'beacon-reminder',
      data: { url: url || '/' },
    });
  }
  // Auth-aware purge: clear all cached pages/JS/CSS so the next user on this
  // device cannot retrieve the previous counselor's UI state from cache.
  if (event.data?.type === 'BEACON_PURGE_CACHE') {
    event.waitUntil(
      caches.keys().then((keys) => Promise.all(keys.map((k) => caches.delete(k))))
    );
  }
  // Cache-bust banner / VersionMonitor: when a new SW is installed and the
  // page tells us "user clicked Refresh now," skip the wait so the new
  // bundle takes over on next navigation. Standard PWA upgrade pattern.
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
