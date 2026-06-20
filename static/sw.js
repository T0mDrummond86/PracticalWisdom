/* Practical Wisdom — service worker.
 *
 * Strategy:
 *   - App shell (HTML/CSS/JS/icons) is precached on install and served cache-first.
 *   - Navigations are network-first, falling back to the cached shell when offline,
 *     so the UI always loads with no connection.
 *   - /api/ requests are network-first, falling back to any cached copy, then to a
 *     small "offline" JSON response.
 *   - Google Fonts (cross-origin) and other /static/ assets are cached at runtime.
 *
 * Bump CACHE when you ship new shell assets — the old cache is purged on activate.
 */
const CACHE = "pw-cache-v1";

const SHELL = [
  "/",
  "/static/styles.css",
  "/static/app.js",
  "/static/favicon.svg",
  "/static/manifest.json",
  "/static/icons/icon-192.png",
  "/static/icons/icon-512.png",
  "/static/icons/icon-512-maskable.png",
  "/static/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // allSettled so one missing/blocked asset can't fail the whole install.
    await Promise.allSettled(SHELL.map((url) => cache.add(url)));
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

// The page posts this when the user accepts an update; we then activate immediately.
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;            // never interfere with POST/PUT/etc.
  const url = new URL(req.url);

  // Navigations → network-first, cached shell as the offline fallback.
  if (req.mode === "navigate") {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (e) {
        return (await caches.match("/")) || Response.error();
      }
    })());
    return;
  }

  // Dynamic API → network-first, then cache, then a graceful offline payload.
  if (url.origin === self.location.origin && url.pathname.startsWith("/api/")) {
    event.respondWith((async () => {
      try {
        return await fetch(req);
      } catch (e) {
        const cached = await caches.match(req);
        if (cached) return cached;
        return new Response(
          JSON.stringify({ error: "offline", offline: true }),
          { status: 503, headers: { "Content-Type": "application/json" } }
        );
      }
    })());
    return;
  }

  // Everything else (static assets + Google Fonts) → cache-first, fill cache on miss.
  event.respondWith((async () => {
    const cached = await caches.match(req);
    if (cached) return cached;
    try {
      const res = await fetch(req);
      const isFont = url.hostname.endsWith("fonts.googleapis.com") || url.hostname.endsWith("fonts.gstatic.com");
      const isStatic = url.origin === self.location.origin && url.pathname.startsWith("/static/");
      if ((isFont || isStatic) && (res.ok || res.type === "opaque")) {
        const cache = await caches.open(CACHE);
        cache.put(req, res.clone());
      }
      return res;
    } catch (e) {
      return cached || Response.error();
    }
  })());
});
