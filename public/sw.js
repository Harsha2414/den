/* Den service worker: makes Den installable and shows a friendly page when offline.
 * Deliberately small and safe:
 *  - Den's pages and data always come from the network (never stale posts or messages).
 *  - Only files that never change (/_next/static, icons, fonts) are kept, so the app opens faster.
 *  - When a page can't load because the phone is offline, /offline.html is shown. */
const VERSION = "den-sw-1";
const STATIC = `${VERSION}-static`;
const OFFLINE = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC).then((c) => c.addAll([OFFLINE, "/icons/icon-192.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Pages: always the network; the offline page only when there's no connection.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(OFFLINE)));
    return;
  }

  // Files with a version in their name never change: keep them.
  const sameOrigin = url.origin === self.location.origin;
  const immutable = (sameOrigin && (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/"))) || url.hostname === "fonts.gstatic.com";
  if (immutable) {
    event.respondWith(
      caches.open(STATIC).then(async (c) => {
        const hit = await c.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) c.put(req, res.clone());
        return res;
      }),
    );
  }
  // Everything else (Supabase, LiveKit, the API) goes straight to the network as usual.
});
