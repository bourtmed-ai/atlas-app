const CACHE_NAME = "atlas-v4";
const ASSETS = [
  "./",
  "./index.html",
  "./app.js",
  "./auth.js",
  "./supabase-client.js",
  "./onboarding.js",
  "./station-picker.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Code files (HTML/JS): always try the network first so updates show up immediately.
// Only fall back to the cached copy if there's no connection (offline support).
function isCodeFile(url) {
  return url.endsWith(".js") || url.endsWith(".html") || url.endsWith("/");
}

self.addEventListener("fetch", (event) => {
  const url = event.request.url;

  if (isCodeFile(url)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request).then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          return response;
        });
      })
    );
  }
});
