self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data.json();
  } catch {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'is this ai?', {
      body: data.body || '',
      icon: '/icon.png',
      badge: '/icon-32.png',
      tag: data.tag || 'isthisai',
      data: { url: data.url || '/' },
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data || {}).url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    }),
  );
});
