/*
 * Aquarich service worker — deliberately conservative.
 * Strategy: NETWORK-FIRST. We always try the network so an online user can never
 * be served a stale build (the #1 way a SW breaks a deployed app). The cache is
 * only an offline fallback. API/AI calls are never cached. New versions activate
 * immediately (skipWaiting + clients.claim), so a bad cache can't get "stuck".
 */
const CACHE = "aquarich-cache-v1";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // leave cross-origin alone
  if (url.pathname.startsWith("/api") || url.pathname.startsWith("/ai")) return; // never cache data

  event.respondWith(
    (async () => {
      try {
        const fresh = await fetch(req);
        const cache = await caches.open(CACHE);
        cache.put(req, fresh.clone()).catch(() => {});
        return fresh;
      } catch {
        const cached = await caches.match(req);
        if (cached) return cached;
        if (req.mode === "navigate") {
          const shell = await caches.match("/");
          if (shell) return shell;
        }
        throw new Error("offline");
      }
    })(),
  );
});
