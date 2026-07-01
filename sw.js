const CACHE_NAME = "graphique-eloise-v2";
const APP_SHELL = [
  "./",
  "./printing-pos.html",
  "./styles.css",
  "./app.js",
  "./android-install.html",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-192.png",
  "./icon-512.png",
  "./img/logo.png",
  "./img/mat-a4.jpg",
  "./img/mat-phototop.jpg",
  "./img/mat-sintra.jpg",
  "./img/mat-ink-bw.jpg",
  "./img/mat-ink-color.jpg",
  "./img/mat-laminate.jpg",
  "./img/svc-bw.jpg",
  "./img/svc-color.jpg",
  "./img/svc-sintra.jpg",
  "./img/svc-lamination.jpg",
  "./img/svc-design.jpg",
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put("./printing-pos.html", copy));
          return response;
        })
        .catch(() => caches.match("./printing-pos.html"))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => {
      const fresh = fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      }).catch(() => cached);
      return cached || fresh;
    })
  );
});
