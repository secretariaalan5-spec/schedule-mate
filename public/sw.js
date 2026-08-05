// Recovery worker for installations that still run the former Workbox PWA.
// It intentionally owns no cache: once the browser checks /sw.js for an
// update, this worker removes the stale registrations/caches and releases the
// page so the current Vite bundle is fetched from the network.
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key)))),
      self.registration.unregister(),
    ]).then(() => self.clients.matchAll({ type: "window", includeUncontrolled: true }))
      .then((clients) => Promise.all(clients.map((client) => client.navigate(client.url)))),
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request));
});