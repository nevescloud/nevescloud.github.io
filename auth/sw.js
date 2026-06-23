// /auth/ service worker — narrow scope, stale-while-revalidate for the
// shim's two files. Scope deliberately kept to /auth/ so this cannot
// interfere with subproject SWs or any root-scope worker.
//
// Kill switch: postMessage({ cmd: 'self-destruct' }) → wipes cache, unregisters.
// Bump VERSION when changing this file or the shipped /auth/ assets.

const VERSION = 'neevs-auth-v1';
const PRECACHE = ['/auth/', '/auth/lib.js', '/auth/index.html'];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(PRECACHE);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter((k) => k.startsWith('neevs-auth-') && k !== VERSION)
          .map((k) => caches.delete(k)),
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith('/auth/')) return;
  if (url.pathname === '/auth/sw.js') return;

  event.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req);
    const network = fetch(req).then((res) => {
      if (res.ok) cache.put(req, res.clone()).catch(() => {});
      return res;
    }).catch(() => null);
    return cached || (await network) || Response.error();
  })());
});

self.addEventListener('message', (event) => {
  if (event.data?.cmd !== 'self-destruct') return;
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k.startsWith('neevs-auth-')).map((k) => caches.delete(k)));
    await self.registration.unregister();
    const clients = await self.clients.matchAll();
    clients.forEach((c) => c.navigate(c.url));
  })());
});
