
const CACHE = 'calcettomix-shell-v4';

const APP_HOME = new URL(
  './',
  self.registration.scope
);

self.addEventListener('install', event => {
  event.waitUntil(
    self.skipWaiting()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();

      await Promise.all(
        keys
          .filter(k => k.startsWith('calcettomix-shell-'))
          .map(k => caches.delete(k))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', event => {
  if (
    event.request.method !== 'GET' ||
    event.request.mode !== 'navigate'
  ) return;

  const url = new URL(event.request.url);

  if (
    url.origin !== APP_HOME.origin ||
    !url.pathname.startsWith(APP_HOME.pathname)
  ) return;

  event.respondWith(
    fetch(event.request).catch(async () => {
      const cache = await caches.open(CACHE);
      return (
        await cache.match(APP_HOME.href) ||
        Response.error()
      );
    })
  );
});

self.addEventListener('push', event => {
  let data = {};

  try {
    data = event.data?.json() || {};
  } catch {}

  event.waitUntil(
    self.registration.showNotification(
      data.title || 'CalcettoMix',
      {
        body: data.body || 'Hai una nuova notifica',
        icon: new URL(
          'icons/icon-192.png',
          APP_HOME
        ).href,
        badge: new URL(
          'icons/icon-192.png',
          APP_HOME
        ).href,
        tag: data.tag || 'calcettomix',
        data: data.data || {}
      }
    )
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  // Apre sempre la PWA dal percorso GitHub Pages corretto.
  const target = APP_HOME.href;

  event.waitUntil(
    (async () => {
      const clientsList =
        await self.clients.matchAll({
          type: 'window',
          includeUncontrolled: true
        });

      const existing = clientsList.find(client =>
        client.url.startsWith(APP_HOME.href)
      );

      if (existing) {
        await existing.focus();
        await existing.navigate(target);
      } else {
        await self.clients.openWindow(target);
      }
    })()
  );
});
