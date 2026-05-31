const CACHE_VERSION = 'unitravel-v1';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', event => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'Unitravel', body: event.data.text() };
  }

  const options = {
    body:               payload.body   ?? 'You have a travel update.',
    icon:               '/favicon.ico',
    badge:              '/favicon.ico',
    vibrate:            [120, 60, 120],
    tag:                payload.tag    ?? 'unitravel-crisis',
    requireInteraction: payload.requireInteraction ?? false,
    data:               { url: payload.url ?? '/' },
    actions: [
      { action: 'view',    title: 'View Update' },
      { action: 'dismiss', title: 'Dismiss'     },
    ],
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? 'Unitravel Update', options)
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const targetUrl = event.notification.data?.url ?? '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});

self.addEventListener('pushsubscriptionchange', event => {
  event.waitUntil(
    self.registration.pushManager.subscribe(event.oldSubscription.options)
      .then(subscription => {
        // In production: POST updated subscription to your server
        console.info('[SW] Push subscription renewed', subscription.endpoint);
      })
  );
});
