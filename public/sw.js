// Recovery worker for installations still controlled by the former Workbox
// PWA. Cache Storage is isolated by origin, so clearing every bucket here is
// the reliable way to remove app-shell caches whose generated names varied
// between Workbox releases.

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        await Promise.allSettled(cacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
        const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
        await Promise.allSettled(clients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  );
});