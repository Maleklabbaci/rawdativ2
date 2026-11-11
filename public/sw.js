// Incrémenté pour activer le moteur Web Push Parent + cache applicatif.
const CACHE_NAME = 'rawdha-static-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname.endsWith('.html')) {
    event.respondWith(
      fetch(request, { cache: 'no-store' }).catch(() => caches.match(request)),
    );
    return;
  }

  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      })),
    );
  }
});

// Réception de vraies notifications Web Push (RFC 8291 VAPID — Android Chrome & iPhone iOS 16.4+ PWA)
self.addEventListener('push', (event) => {
  let payload = {
    title: 'Rawdha+ — Info Crèche',
    body: 'Nouvelle notification de la crèche de votre enfant.',
    url: '/espace-parent',
    tag: 'rawdha-parent-push',
  };

  if (event.data) {
    try {
      const parsed = event.data.json();
      payload = {
        title: parsed.title || payload.title,
        body: parsed.body || parsed.message || payload.body,
        url: parsed.url || payload.url,
        tag: parsed.tag || parsed.notificationId || payload.tag,
      };
    } catch {
      const rawText = event.data.text();
      if (rawText) payload.body = rawText;
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: payload.tag,
      vibrate: [180, 80, 180],
      data: { url: payload.url },
    }),
  );
});

// Relais local pour prévisualisation instantanée et confirmation d’activation
self.addEventListener('message', (event) => {
  const data = event.data;
  if (!data || data.type !== 'RAWDHA_SHOW_LOCAL_PUSH') return;
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

  event.waitUntil(
    self.registration.showNotification(data.title || 'Rawdha+ — Espace Parent', {
      body: data.body || '',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: data.tag || `rawdha-local-${Date.now()}`,
      vibrate: [160, 70, 160],
      data: { url: data.url || '/espace-parent' },
    }),
  );
});

// Ouverture directe de l’Espace Parent au toucher de la notification sur écran verrouillé
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/espace-parent';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes('/espace-parent') && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
      return undefined;
    }),
  );
});
