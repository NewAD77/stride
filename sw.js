/* Stride service worker.
   - /api/ calls: never cached (always network) so live data is fresh.
   - App shell (HTML/navigation): network-first so new versions load immediately,
     falling back to cache only when offline.
   - Other static assets (icons, Chart.js): cache-first for speed/offline. */
const CACHE = "stride-v3";
const ASSETS = [
  "index.html",
  "manifest.webmanifest",
  "apple-touch-icon.png",
  "icon-192.png",
  "icon-512.png",
  "https://cdn.jsdelivr.net/npm/chart.js@4.5.0/dist/chart.umd.js"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

function cachePut(req, res) {
  const copy = res.clone();
  caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
  return res;
}

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // Live data: always network, never cache.
  if (url.pathname.startsWith("/api/")) return;

  // App shell: network-first so updates appear right away.
  const isShell = e.request.mode === "navigate" ||
    url.pathname === "/" || url.pathname.endsWith("/index.html");
  if (isShell) {
    e.respondWith(
      fetch(e.request).then((res) => cachePut(e.request, res))
        .catch(() => caches.match(e.request).then((h) => h || caches.match("index.html")))
    );
    return;
  }

  // Other static assets: cache-first.
  e.respondWith(
    caches.match(e.request).then((hit) =>
      hit || fetch(e.request).then((res) => cachePut(e.request, res)).catch(() => caches.match("index.html"))
    )
  );
});
