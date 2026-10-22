const CACHE = "english-app-v13";
// Only the app shell is required; a failed optional file must not block the update (iOS would keep the old worker).
const CORE = ["./", "./index.html"];
const FILES = ["./", "./index.html", "./manifest.json", "./icon.svg",
  "./vendor/pdfjs/pdf.min.mjs", "./vendor/pdfjs/pdf.worker.min.mjs",
  "./icons/icon-180.png", "./icons/apple-touch-icon.png?v=9", "./icons/icon-192.png", "./icons/icon-512.png", "./icons/favicon-32.png"];

// A redirected response (e.g. a host redirecting /index.html to /) cannot be used for a navigation; store a clean copy.
function clean(r) {
  return r.redirected ? r.blob().then(b => new Response(b, { status: r.status, statusText: r.statusText, headers: r.headers })) : r;
}

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => Promise.all(FILES.map(f => {
        const p = fetch(f, { cache: "reload" }).then(r => {
          if (!r.ok) throw new Error(f + " " + r.status);
          return Promise.resolve(clean(r)).then(c => cache.put(f, c));
        });
        return CORE.includes(f) ? p : p.catch(() => {});
      })))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key =>
          key.startsWith("english-app-") && key !== CACHE
        ).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          Promise.resolve(clean(copy)).then(c => caches.open(CACHE).then(cache => cache.put(event.request, c))).catch(() => {});
        }
        return response;
      })
      .catch(() => caches.match(event.request).then(r => r || (event.request.mode === "navigate" ? caches.match("./") : r)))
  );
});
