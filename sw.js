// Tombstone. On first activation this wipes
// caches, unregisters itself, and reloads open clients so they stop being
// SW-controlled. Safe to delete this file after a deploy cycle long enough
// that all existing clients have visited at least once (SW update check
// runs on every navigation + every 24h).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.navigate(c.url));
  })());
});
